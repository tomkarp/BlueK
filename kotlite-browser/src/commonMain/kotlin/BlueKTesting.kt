import com.sunnychung.lib.multiplatform.kotlite.Parser
import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer
import com.sunnychung.lib.multiplatform.kotlite.model.*

private val kotlinHardKeywords = setOf(
    "as", "break", "class", "continue", "do", "else", "false", "for", "fun",
    "if", "in", "interface", "is", "null", "object", "package", "return",
    "super", "this", "throw", "true", "try", "typealias", "typeof", "val",
    "var", "when", "while",
)

/** Keep required escaped identifiers, but omit backticks around ordinary Kotlin names. */
private fun simplifyIdentifiers(source: String): String {
    val replacements = Lexer("<fixture>", source).readAllTokens()
        .filter { token ->
            token.type == TokenType.Identifier &&
                source.substring(token.position.index, token.endExclusive.index).startsWith('`') &&
                token.value.toString().matches(Regex("[A-Za-z_][A-Za-z0-9_]*")) &&
                token.value.toString() !in kotlinHardKeywords
        }
    var simplified = source
    for (token in replacements.asReversed()) {
        val start = token.position.index
        val end = token.endExclusive.index
        simplified = simplified.removeRange(end - 1, end).removeRange(start, start + 1)
    }
    return simplified
}

/** Session-owned test discovery, results and a replayable object-bench recipe. */
internal class BlueKTesting {
    data class Suite(val file: String, val source: String, val node: ClassDeclarationNode) {
        val methods get() = node.declarations.filterIsInstance<FunctionDeclarationNode>()
        val tests get() = methods.filter { "Test" in it.annotations }
        val before get() = methods.filter { "BeforeTest" in it.annotations }
        val after get() = methods.filter { "AfterTest" in it.annotations }
    }
    data class Case(val suite: Suite, val method: FunctionDeclarationNode, var status: String = "pending", val errors: MutableList<String> = mutableListOf())
    val suites = linkedMapOf<String, Suite>()
    private var explicitTestClassFiles = emptySet<String>()
    private var cases = emptyList<Case>()
    private var current = -1
    private var runStatus = "idle"
    val journal = mutableListOf<String>()
    val aliases = mutableMapOf<String, String>()
    private var serial = 0
    private val declaredNames = mutableSetOf<String>()
    private val objectBindings = mutableSetOf<String>()
    private var blocked: String? = null
    private val assertionIndexes = mutableSetOf<Int>()
    var recording: String? = null
        private set
    private var recordingStart = 0
    private var lastResult: String? = null
    private var expectedType: String? = null
    private var suggestedExpected: String? = null
    var changed: (() -> Unit)? = null
    private fun q(s: String) = JSON.stringify(s)
    private fun parse(file: String, source: String) = Parser(Lexer(file, source)).script()
    private fun validMethodName(name: String) = name.isNotBlank() && name.none { it in "`\n\r.;[]/<>:\\" }
    private fun validClassName(name: String) = name.matches(Regex("[A-Za-z_][A-Za-z0-9_]*"))
    fun setTestClassFiles(files: Set<String>) {
        explicitTestClassFiles = files
    }
    fun load(file: String, source: String, script: ScriptNode): String? {
        if (script.nodes.filterIsInstance<FunctionDeclarationNode>().any { it.annotations.isNotEmpty() }) return "Test annotations require a test class."
        for (node in script.nodes.filterIsInstance<ClassDeclarationNode>()) {
            val suite = Suite(file, source, node)
            if (suite.methods.none { it.annotations.isNotEmpty() } && node.annotations.isEmpty() && file !in explicitTestClassFiles) continue
            if (node.outerClassName != null || node.isObject || node.isInterface || node.typeParameters.isNotEmpty() || node.superInvocations.orEmpty().isNotEmpty() || node.modifiers.any { it.name in setOf("abstract", "enum", "sealed") }) return "Test classes must be ordinary top-level classes without inheritance or type parameters."
            if (node.primaryConstructor?.parameters.orEmpty().isNotEmpty() || node.declarations.any { it is ClassSecondaryConstructorNode }) return "Test classes need a parameterless constructor."
            for (method in suite.methods.filter { it.annotations.isNotEmpty() }) {
                if (!validMethodName(method.name)) return "Annotated method names must be valid on Kotlin/JVM; spaces in backticks are supported."
                if (method.valueParameters.isNotEmpty() || method.typeParameters.isNotEmpty() || method.receiver != null || method.modifiers.any { it.name in setOf("private", "protected") } || method.returnType.name != "Unit") return "Annotated method ${method.name} must be public, parameterless and return Unit."
                if (method.annotations.count { it != "Ignore" } > 1 || "Ignore" in method.annotations && "Test" !in method.annotations) return "Incompatible test annotations on ${method.name}."
            }
            if (suite.before.size > 1 || suite.after.size > 1) return "BlueK supports one @BeforeTest and one @AfterTest method per class."
            suites[node.name] = suite
        }
        return null
    }
    fun metadata(name: String): String {
        val suite = suites[name] ?: return ""
        return ",\"testing\":{\"fileName\":${q(suite.file)},\"methods\":[${suite.tests.joinToString(",") { "{\"name\":${q(it.name)},\"line\":${it.position.lineNum},\"ignored\":${"Ignore" in it.annotations || "Ignore" in suite.node.annotations}}" }}]}"
    }
    fun state(): String = "{\"status\":${q(runStatus)},\"cases\":[${cases.joinToString(",") { "{\"className\":${q(it.suite.node.name)},\"name\":${q(it.method.name)},\"fileName\":${q(it.suite.file)},\"line\":${it.method.position.lineNum},\"status\":${q(it.status)},\"errors\":${JSON.stringify(it.errors.toTypedArray())}}" }}],\"recording\":${recording?.let(::q) ?: "null"},\"canCapture\":${blocked == null && journal.isNotEmpty()},\"captureError\":${blocked?.let(::q) ?: "null"},\"lastResult\":${lastResult?.let(::q) ?: "null"},\"lastType\":${expectedType?.let(::q) ?: "null"},\"suggestedExpected\":${suggestedExpected?.let(::q) ?: "null"}}"
    fun driver(className: String, method: String): String {
        if (recording != null) error("Finish or cancel the recording first.")
        if (className.isNotEmpty() && className !in suites) error("Unknown test class.")
        if (method.isNotEmpty() && suites[className]?.tests?.none { it.name == method } != false) error("Unknown test method.")
        cases = suites.values.filter { className.isEmpty() || it.node.name == className }.flatMap { s -> s.tests.filter { method.isEmpty() || it.name == method }.map { Case(s, it, if ("Ignore" in it.annotations || "Ignore" in s.node.annotations) "ignored" else "pending") } }
        runStatus = "running"
        return cases.mapIndexedNotNull { index, c ->
            if (c.status == "ignored") return@mapIndexedNotNull null
            val before = c.suite.before.joinToString("\n") { "__bluek_fixture.`${it.name}`()" }
            val after = c.suite.after.joinToString("\n") { "try { __bluek_fixture.`${it.name}`() } catch (e: Throwable) { bluekTestFailure(e) }" }
            """bluekTestStart($index)
try {
    val __bluek_fixture = ${c.suite.node.name}()
    try {
        $before
        __bluek_fixture.`${c.method.name}`()
    } catch (e: Throwable) { bluekTestFailure(e) }
    finally { $after }
} catch (e: Throwable) { bluekTestFailure(e) }
bluekTestFinish()
"""
        }.joinToString("\n")
    }
    fun start(index: Int) { current = index; cases[index].status = "running"; changed?.invoke() }
    fun failure(value: ClassInstance) {
        val throwable = value.throwablePart()
        cases[current].errors += value.convertToString(isCallCustomFunction = false) + "\n" + throwable?.stacktrace.orEmpty().joinToString("\n")
        cases[current].status = if (cases[current].status == "error") "error" else if ((value.type() as? ObjectType)?.let { it.name == "AssertionError" || it.superTypes.any { parent -> parent.name == "AssertionError" } } == true || throwable?.externalExceptionClassName?.endsWith("AssertionError") == true) "failed" else "error"
    }
    fun finish() { if (cases[current].status == "running") cases[current].status = "passed"; changed?.invoke() }
    fun complete(error: Boolean) { runStatus = if (error) "aborted" else "completed"; cases.filter { it.status in setOf("pending", "running") }.forEach { it.status = "aborted" }; changed?.invoke() }
    fun taint(reason: String) { blocked = reason }
    fun hasDeclaration(name: String): Boolean = name in declaredNames
    /** Called only after successful operations; handles retain the expression that created them. */
    fun note(op: String, id: String, name: String, source: String, response: String) {
        val result = JSON.parse<dynamic>(response)
        if (result.kind == "error") { if (result.phase == "runtime" || result.fatal == true) taint("A failed call may have changed objects. Reset and recreate the fixture."); return }
        if (op == "bind" && aliases[id] == name && name in declaredNames && journal.any { statement ->
                parse("<recording>", statement).nodes.filterIsInstance<PropertyDeclarationNode>().any { it.name == name }
            }) {
            // Exposing an existing Codepad reference does not create a new Kotlin declaration.
            aliases[id] = name
            objectBindings += name
            return
        }
        if (op in setOf("create", "bind") && name in declaredNames) { taint("This bench name was already used in the replay history. Reset before reusing names in a fixture."); return }
        val evalNodes = if (op == "eval") runCatching { parse("<recording>", source).nodes }.getOrNull() else null
        if (op == "eval" && result.kind != "unit" && (evalNodes == null || evalNodes.size != 1 || evalNodes[0] is PropertyDeclarationNode)) { taint("Record a single Codepad expression at a time when retaining its result."); return }
        evalNodes?.filterIsInstance<PropertyDeclarationNode>()?.forEach { declaredNames += it.name }
        var expression = when (op) {
            "create" -> "val $name = $source"
            "invoke", "get", "set" -> {
                val receiver = aliases[id] ?: run { taint("This object has no replayable creation history."); return }
                "$receiver.$source"
            }
            "bind" -> "val $name = ${aliases[id] ?: run { taint("This result cannot be replayed."); return }}"
            "eval" -> source
            "main" -> { taint("main() and simulation state cannot be captured."); return }
            else -> return
        }
        if (op in setOf("invoke", "get", "eval") && result.kind != "unit") {
            var variable: String
            do { variable = "result${++serial}" } while (variable in declaredNames)
            declaredNames += variable
            expression = "val $variable = $expression"
            lastResult = variable
            expectedType = result.type?.classifier as? String
            val display = result.display as? String ?: ""
            suggestedExpected = when {
                result.kind == "null" -> "null"
                expectedType == "String" -> q(display).replace("$", "\\$")
                expectedType == "Char" -> "'" + display.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "'"
                expectedType == "Long" -> display + "L"
                expectedType == "Double" && display in setOf("NaN", "Infinity", "-Infinity") -> when (display) { "NaN" -> "Double.NaN"; "Infinity" -> "Double.POSITIVE_INFINITY"; else -> "Double.NEGATIVE_INFINITY" }
                result.kind == "scalar" -> display
                else -> null
            }
            (result.objectId as? String)?.let { aliases[it] = variable }
        } else lastResult = null
        if (op in setOf("create", "bind")) {
            declaredNames += name
            objectBindings += name
        }
        if (op in setOf("create", "bind")) (result.objectId as? String)?.let { aliases[it] = name }
        // Do not store hidden runtime bindings in portable source.
        if (expression.contains("__bluek_")) { taint("This operation uses an internal runtime binding."); return }
        journal += expression
        changed?.invoke()
    }
    fun begin(name: String) { check(blocked == null) { blocked!! }; check(name in suites) { "Unknown test class." }; recording = name; recordingStart = journal.size; lastResult = null; changed?.invoke() }
    fun cancel() { val kept = journal.filterIndexed { index, _ -> index !in assertionIndexes }; journal.clear(); journal.addAll(kept); assertionIndexes.clear(); recording = null; lastResult = null; changed?.invoke() }
    fun assertion(expected: String, kind: String) {
        check(recording != null) { "No recording is running." }
        val result = lastResult ?: error("Call a value-returning method first.")
        val code = when (kind) { "null" -> "assertNull($result)"; "notNull" -> "assertNotNull($result)"; else -> "assertEquals($expected, $result)" }
        parse("<assertion>", code)
        assertionIndexes += journal.size
        journal += code
        lastResult = null
        changed?.invoke()
    }
    private fun append(suite: Suite, code: String): String {
        val tokens = Lexer(suite.file, suite.source).readAllTokens()
        val end = tokens.lastOrNull { it.type == TokenType.Symbol && it.value == "}" && it.position.index < suite.node.sourceEnd }?.position?.index
        val imports = if (parse(suite.file, suite.source).imports.any { it.path == "kotlin.test.*" }) "" else "import kotlin.test.*\n"
        if (end == null) return imports + suite.source.substring(0, suite.node.sourceEnd).trimEnd() + " {\n$code\n}\n" + suite.source.substring(suite.node.sourceEnd)
        return imports + suite.source.substring(0, end) + "\n" + code + "\n" + suite.source.substring(end)
    }
    fun recordedSource(method: String): String {
        val suite = suites[recording] ?: error("No recording is running.")
        check(blocked == null) { blocked!! }
        check(suite.methods.none { it.name == method }) { "A method with this name already exists." }
        check(validMethodName(method)) { "Choose a Kotlin/JVM-compatible method name; spaces are supported, but punctuation such as dots is not." }
        val source = append(suite, "    @Test\n    fun ${identifier(method)}() {\n" + journal.drop(recordingStart).joinToString("\n") { "        ${simplifyIdentifiers(it)}" } + "\n    }")
        parse(suite.file, source)
        return source
    }
    fun replacesFixture(name: String): Boolean = suites[name]?.let { suite ->
        suite.node.declarations.any { it is PropertyDeclarationNode || it is ClassInstanceInitializerNode } || suite.before.isNotEmpty()
    } ?: false
    fun replacesInitializers(name: String): Boolean = suites[name]?.node?.declarations?.any { it is ClassInstanceInitializerNode } == true

    private fun memberStart(suite: Suite, member: ASTNode): Int {
        val start = when (member) {
            is FunctionDeclarationNode -> member.sourceStart
            is PropertyDeclarationNode -> member.sourceStart
            else -> member.position.index
        }
        val lineStart = suite.source.lastIndexOf('\n', start - 1) + 1
        return if (suite.source.substring(lineStart, start).isBlank()) lineStart else start
    }

    private fun replaceFixture(suite: Suite, block: String): String {
        val declarations = suite.node.declarations
        val removed = declarations.filter { it is PropertyDeclarationNode || it is ClassInstanceInitializerNode } + suite.before
        val markers = Lexer(suite.file, suite.source, isParseComment = true).readAllTokens().filter {
            it.type == TokenType.Comment && it.position.index in suite.node.position.index until suite.node.sourceEnd &&
                it.value.toString().trim() in setOf("// BlueK fixture begin", "// BlueK fixture end")
        }
        if (removed.isEmpty() && markers.isEmpty()) return append(suite, block)
        val ranges = removed.map { member ->
            val start = memberStart(suite, member)
            val end = when (member) {
                is FunctionDeclarationNode -> member.sourceEnd
                is PropertyDeclarationNode -> member.sourceEnd
                is ClassInstanceInitializerNode -> member.sourceEnd
                else -> error("Unsupported state declaration.")
            }
            start until end
        }.plus(markers.map { it.position.index until it.endExclusive.index }).sortedBy { it.first }
        val merged = mutableListOf<IntRange>()
        for (range in ranges) {
            val previous = merged.lastOrNull()
            if (previous != null && range.first <= previous.last + 1)
                merged[merged.lastIndex] = previous.first..maxOf(previous.last, range.last)
            else merged += range
        }
        val output = StringBuilder()
        var cursor = 0
        merged.forEachIndexed { index, range ->
            output.append(suite.source.substring(cursor, range.first))
            if (index == 0) output.append(block).append('\n')
            cursor = range.last + 1
        }
        output.append(suite.source.substring(cursor))
        val updated = output.toString()
        return if (parse(suite.file, updated).imports.any { it.path == "kotlin.test.*" }) updated
        else "import kotlin.test.*\n$updated"
    }
    fun fixtureSource(name: String, fields: List<Pair<String, String>>): String {
        check(blocked == null) { blocked!! }
        check(validClassName(name)) { "Choose a valid Kotlin class name." }
        check(fields.isNotEmpty()) { "The object bench is empty." }
        check(fields.none { it.second in setOf("Int", "Long", "Double", "Boolean", "Char", "Float", "Byte", "Short") }) { "Fixtures currently require object references, not scalar bench values." }
        val fieldNames = fields.map { it.first }.toSet()
        check(fields.none { it.first.startsWith("result") && it.first.removePrefix("result").toIntOrNull() != null }) { "Choose a bench name other than the reserved recording result names." }
        val statements = journal.flatMap { statement ->
            parse("<recording>", statement).sourceRanges.map { statement.substring(it).trim() }
        }
        val declarations = statements.map { parse("<recording>", it).nodes.singleOrNull() as? PropertyDeclarationNode }
        check(statements.none { statement ->
            parse("<recording>", statement).nodes.any { node ->
                node is AssignmentNode && (node.subject as? VariableReferenceNode)?.variableName in fieldNames
            }
        }) { "A saved val reference cannot be reassigned. Use a fresh bench name, or edit the state class manually." }
        fun initializer(index: Int): String = declarations[index]?.initialValueSourceRange?.let { statements[index].substring(it).trim() }
            ?: error("The object bench creation could not be saved as a Kotlin initializer.")
        val fieldIndexes = fieldNames.associateWith { field ->
            declarations.indexOfFirst { it?.name == field }.also { check(it >= 0) { "The object bench creation for $field could not be saved." } }
        }
        val types = fields.toMap()
        val recipe = statements.mapIndexed { index, statement ->
            val declared = declarations[index]?.name
            val temporary = declared != null && declared !in fieldNames &&
                (declared in objectBindings || declared.startsWith("result") && declared.removePrefix("result").toIntOrNull() != null)
            if (temporary && statements.drop(index + 1).none { later -> usesName(later, declared!!) }) initializer(index) else statement
        }
        val lastField = fieldIndexes.values.maxOrNull()!!
        // Hoisting constructors over earlier calls or local declarations changes their arguments and side effects.
        // In that case initialise the val fields in an ordinary Kotlin init block, in the original order.
        val orderedInit = (0..lastField).any { declarations[it]?.name !in fieldNames }
        val block = if (orderedInit) {
            fields.joinToString("\n") { (field, type) -> "    val ${identifier(field)}: $type" } +
                "\n\n    init {\n" + recipe.mapIndexed { index, statement ->
                    val field = declarations[index]?.name
                    val code = if (field in fieldNames) "${identifier(field!!)} = ${initializer(index)}" else statement
                    "        ${simplifyIdentifiers(code)}"
                }.joinToString("\n") + "\n    }"
        } else {
            (0..lastField).joinToString("\n") { index ->
                val field = declarations[index]!!.name
                "    val ${identifier(field)}: ${types[field]} = ${initializer(index)}"
            } + "\n\n    @BeforeTest\n    fun setUp() {\n" +
                recipe.drop(lastField + 1).joinToString("\n") { "        ${simplifyIdentifiers(it)}" } + "\n    }"
        }
        val suite = suites[name] ?: run {
            val source = "import kotlin.test.*\n\nclass $name {\n" + block + "\n}\n"
            parse("$name.kt", source)
            return source
        }
        val updated = replaceFixture(suite, block)
        parse(suite.file, updated)
        return updated
    }
    private fun identifier(name: String): String = if (name.matches(Regex("[A-Za-z_][A-Za-z0-9_]*")) && name !in kotlinHardKeywords) name else "`$name`"
    private fun usesName(source: String, name: String): Boolean = Lexer("<recording>", source).readAllTokens().any { it.type == TokenType.Identifier && it.value == name }
    private fun blockRecipe(suite: Suite, start: Int, end: Int, expressionBody: Boolean = false): List<String> {
        val tokens = Lexer(suite.file, suite.source).readAllTokens().filter { it.position.index in start until end }
        val first = tokens.first { it.type == TokenType.Symbol && it.value == if (expressionBody) "=" else "{" }
        val last = if (expressionBody) end else tokens.last { it.type == TokenType.Symbol && it.value == "}" }.position.index
        val body = suite.source.substring(first.endExclusive.index, last)
        return if (body.isBlank()) emptyList() else parse("<fixture>", body).sourceRanges.map { body.substring(it).trim() }
    }
    fun fixtureRecipe(name: String): List<String> {
        val suite = suites[name] ?: error("Unknown test class.")
        val initializers = suite.node.declarations.flatMap { member ->
            when (member) {
                is PropertyDeclarationNode -> member.initialValueSourceRange?.let { listOf("val ${identifier(member.name)} = " + suite.source.substring(it).trim()) }.orEmpty()
                is ClassInstanceInitializerNode -> blockRecipe(suite, member.position.index, member.sourceEnd)
                else -> emptyList()
            }
        }
        return initializers + suite.before.flatMap { blockRecipe(suite, it.position.index, it.sourceEnd, it.body?.format == FunctionBodyFormat.Expression) }
    }
    fun seedFixture(name: String, bindings: Map<String, String>) {
        aliases.clear(); aliases.putAll(bindings.entries.associate { it.value to it.key })
        journal.clear(); assertionIndexes.clear(); declaredNames.clear(); objectBindings.clear(); blocked = null
        for (line in fixtureRecipe(name)) {
            val tokens = Lexer("<fixture>", line).readAllTokens()
            var source = line
            // Replay no longer has the surrounding test instance: qualify its stored fields by their bench names.
            val thisPrefixes = tokens.windowed(3).filter { it[0].value == "this" && it[1].value == "." && it[2].value in bindings }
            for (prefix in thisPrefixes.asReversed()) source = source.removeRange(prefix[0].position.index, prefix[1].endExclusive.index)
            val node = parse("<fixture>", source).nodes.singleOrNull()
            val assignedName = ((node as? AssignmentNode)?.subject as? VariableReferenceNode)?.variableName
            if (assignedName in bindings && assignedName !in declaredNames && (node as AssignmentNode).operator == "=") source = "val $source"
            journal += source
            parse("<fixture>", source).nodes.filterIsInstance<PropertyDeclarationNode>().forEach {
                check(it.name !in declaredNames) { "A local variable shadows a state property. Rename the local variable before saving this state." }
                declaredNames += it.name; objectBindings += it.name
            }
        }
        declaredNames.addAll(bindings.keys)
        serial = journal.mapNotNull { Regex("val result(\\d+)").find(it)?.groupValues?.get(1)?.toIntOrNull() }.maxOrNull() ?: 0
    }
}
