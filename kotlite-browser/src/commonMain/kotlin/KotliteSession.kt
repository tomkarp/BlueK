import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.KotliteInterpreter
import com.sunnychung.lib.multiplatform.kotlite.Parser
import com.sunnychung.lib.multiplatform.kotlite.ReplAnalyzer
import com.sunnychung.lib.multiplatform.kotlite.extension.fullClassName
import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer
import com.sunnychung.lib.multiplatform.kotlite.model.ASTNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallNode
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.DelegatedValue
import com.sunnychung.lib.multiplatform.kotlite.model.ExecutionEnvironment
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.IntValue
import com.sunnychung.lib.multiplatform.kotlite.model.LambdaValue
import com.sunnychung.lib.multiplatform.kotlite.model.NullValue
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.ScriptNode
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.StringValue
import com.sunnychung.lib.multiplatform.kotlite.model.ThrowableValue
import com.sunnychung.lib.multiplatform.kotlite.model.UnitValue
import com.sunnychung.lib.multiplatform.kotlite.model.TypeNode
import com.sunnychung.lib.multiplatform.kotlite.model.VariableReferenceNode
import com.sunnychung.lib.multiplatform.kotlite.model.NavigationNode
import com.sunnychung.lib.multiplatform.kotlite.stdlib.AllStdLibModules
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.coroutines.startCoroutine

/**
 * One browser-worker session. Kotlite has no public REPL, so BlueK keeps one
 * Interpreter alive. Analysis runs on a fresh AST of the accumulated source;
 * execution visits only the newly submitted interval. Project initializers run
 * once when the session is loaded.
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
class KotliteSession {
    private val output = StringBuilder()
    private var environment = ExecutionEnvironment()
    private lateinit var interpreter: Interpreter
    private val handles = linkedMapOf<String, RuntimeValue>()
    private val bindingNames = linkedMapOf<String, String>()
    private val propertyNames = linkedMapOf<String, MutableList<String>>()
    private val computedPropertyNames = linkedMapOf<String, MutableSet<String>>()
    private val privateSetterNames = linkedMapOf<String, MutableSet<String>>()
    private var nextHandle = 1
    private var analysisSource = ""
    private var analyzedScript: ScriptNode? = null
    private var stageSnapshot = ""
    private val pendingSounds = mutableListOf<String>()
    private val inputLines = mutableListOf<String>()
    private var inputContinuation: Continuation<RuntimeValue>? = null
    private var inputNullable = false
    private var inputRequestId = 0
    private var inputRequested: ((Int) -> Unit)? = null
    private var outputUpdated: (() -> Unit)? = null
    private var executionCompleted: ((String) -> Unit)? = null
    private var faulted = false
    private val keysDown = linkedSetOf<String>()
    private var clickX: Int? = null
    private var clickY: Int? = null

    init {
        resetInterpreter()
    }

    private fun resetInterpreter() {
        environment = ExecutionEnvironment(sleepHandler = { millis ->
            // Do not leave a suspended continuation behind in legacy sync calls.
            check(executionCompleted != null) { "Thread.sleep requires asynchronous execution (startEvaluate)." }
            awaitRuntimeSleep(millis)
        })
        AllStdLibModules { text -> appendOutput(text) }.modules.forEach(environment::install)
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = "Throwable",
            functionName = "printStackTrace",
            returnType = "Unit",
            parameterTypes = emptyList(),
            executable = { _, receiver, _, _ ->
                val error = receiver as ThrowableValue
                appendOutput(buildString {
                    append(error.externalExceptionClassName ?: error.fullClassName)
                    error.message?.let { append(": "); append(it) }
                    append('\n')
                    error.stacktrace.forEach { append("    at "); append(it); append('\n') }
                })
                UnitValue
            },
        ))
        // The published Kotlite stdlib 1.1.0 exposes collection callbacks through
        // synchronous Kotlin function types. Keep the standard library surface,
        // but provide its suspendable generated equivalent for the callback that
        // must be able to cross a readln suspension.
        environment.patchFunction(
            receiverType = "Iterable<T>",
            functionName = "count",
            parameterTypes = listOf("(T) -> Boolean"),
        ) { currentInterpreter, receiver, args, _ ->
            val iterable = (receiver as DelegatedValue<*>).value as Iterable<RuntimeValue>
            val predicate = args[0] as LambdaValue
            var count = 0
            for (element in iterable) {
                if ((predicate.executeSuspended(arrayOf(element)) as BooleanValue).value) count += 1
            }
            IntValue(count, currentInterpreter.symbolTable())
        }
        suspend fun readBufferedLine(currentInterpreter: Interpreter, nullable: Boolean): RuntimeValue {
            if (inputLines.isEmpty()) {
                return suspendCoroutine { continuation ->
                    inputNullable = nullable
                    inputContinuation = continuation
                    inputRequestId += 1
                    inputRequested?.invoke(inputRequestId)
                }
            }
            val line = inputLines.removeAt(0)
            return StringValue(line, currentInterpreter.symbolTable())
        }
        fun registerRead(name: String, nullable: Boolean) {
            val definition = CustomFunctionDefinition(
                position = SourcePosition.BUILTIN,
                receiverType = null,
                functionName = name,
                returnType = if (nullable) "String?" else "String",
                parameterTypes = emptyList(),
                executable = { _, _, _, _ -> throw IllegalStateException("$name requires asynchronous evaluation") }
            )
            definition.suspendExecutable = { currentInterpreter, _, _, _ -> readBufferedLine(currentInterpreter, nullable) }
            environment.registerFunction(definition)
        }
        registerRead("readln", false)
        registerRead("readLine", true)
        registerRead("readlnOrNull", true)
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekStageUpdate",
            returnType = "Unit",
            parameterTypes = listOf(CustomFunctionParameter("snapshot", "String")),
            executable = { _, _, args, _ ->
                stageSnapshot = (args[0] as StringValue).value
                UnitValue
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekPlaySound",
            returnType = "Unit",
            parameterTypes = listOf(CustomFunctionParameter("fileName", "String")),
            executable = { _, _, args, _ ->
                pendingSounds += (args[0] as StringValue).value
                UnitValue
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekIsActorClicked",
            returnType = "Boolean",
            parameterTypes = listOf(CustomFunctionParameter("x", "Int"), CustomFunctionParameter("y", "Int")),
            executable = { interpreter, _, args, _ ->
                val matches = clickX == (args[0] as IntValue).value && clickY == (args[1] as IntValue).value
                if (matches) { clickX = null; clickY = null }
                BooleanValue(matches, interpreter.symbolTable())
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekIsWorldClicked",
            returnType = "Boolean",
            parameterTypes = emptyList(),
            executable = { interpreter, _, _, _ ->
                val matches = clickX != null && clickY != null
                if (matches) { clickX = null; clickY = null }
                BooleanValue(matches, interpreter.symbolTable())
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekIsKeyDown",
            returnType = "Boolean",
            parameterTypes = listOf(CustomFunctionParameter("key", "String")),
            executable = { interpreter, _, args, _ ->
                BooleanValue(keysDown.contains((args[0] as StringValue).value.lowercase()), interpreter.symbolTable())
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekHeading",
            returnType = "Int",
            parameterTypes = listOf(CustomFunctionParameter("fromX", "Int"), CustomFunctionParameter("fromY", "Int"), CustomFunctionParameter("toX", "Int"), CustomFunctionParameter("toY", "Int")),
            executable = { interpreter, _, args, _ ->
                val fromX = (args[0] as IntValue).value
                val fromY = (args[1] as IntValue).value
                val toX = (args[2] as IntValue).value
                val toY = (args[3] as IntValue).value
                val angle = if (fromX == toX && fromY == toY) 0 else (atan2((toY - fromY).toDouble(), (toX - fromX).toDouble()) * 180.0 / PI).roundToInt()
                IntValue((angle + 360) % 360, interpreter.symbolTable())
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekDistance",
            returnType = "Int",
            parameterTypes = listOf(CustomFunctionParameter("firstX", "Int"), CustomFunctionParameter("firstY", "Int"), CustomFunctionParameter("secondX", "Int"), CustomFunctionParameter("secondY", "Int")),
            executable = { interpreter, _, args, _ ->
                val dx = ((args[2] as IntValue).value - (args[0] as IntValue).value).toDouble()
                val dy = ((args[3] as IntValue).value - (args[1] as IntValue).value).toDouble()
                IntValue(sqrt(dx * dx + dy * dy).roundToInt(), interpreter.symbolTable())
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekMoveDeltaX",
            returnType = "Int",
            parameterTypes = listOf(CustomFunctionParameter("rotation", "Int"), CustomFunctionParameter("distance", "Int")),
            executable = { interpreter, _, args, _ ->
                val rotation = (args[0] as IntValue).value
                val distance = (args[1] as IntValue).value
                val radians = rotation.toDouble() * PI / 180.0
                IntValue((cos(radians) * distance).roundToInt(), interpreter.symbolTable())
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekMoveDeltaY",
            returnType = "Int",
            parameterTypes = listOf(CustomFunctionParameter("rotation", "Int"), CustomFunctionParameter("distance", "Int")),
            executable = { interpreter, _, args, _ ->
                val rotation = (args[0] as IntValue).value
                val distance = (args[1] as IntValue).value
                val radians = rotation.toDouble() * PI / 180.0
                IntValue((sin(radians) * distance).roundToInt(), interpreter.symbolTable())
            }
        ))
        interpreter = KotliteInterpreter("<BlueK>", "", environment)
        interpreter.checkpointHook = { awaitRuntimeCheckpoint() }
    }

    /** Preserve BlueJ's form-feed terminal clear semantics for the UI. */
    private fun appendOutput(text: String) {
        val clearIndex = text.lastIndexOf('\u000C')
        if (clearIndex >= 0) {
            output.clear()
            output.append('\u000C')
            output.append(text.substring(clearIndex + 1))
        } else {
            output.append(text)
        }
        outputUpdated?.invoke()
    }

    fun setOutputCallback(callback: (() -> Unit)?) {
        outputUpdated = callback
    }

    private fun parse(filename: String, source: String): ScriptNode =
        Parser(Lexer(filename = filename, code = source)).script()

    fun load(filename: String, source: String): String = evaluate(filename, source)

    /** Project files contain declarations, unlike executable Codepad snippets.
     * Parse every file before evaluating even the first property initializer.
     */
    fun startLoadProject(filenames: Array<String>, sources: Array<String>, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        if (filenames.size != sources.size) return errorMessage("Project filenames and sources must match.")
        for (index in sources.indices) {
            val filename = filenames[index]
            val script = try {
                parse(filename, sources[index])
            } catch (error: Throwable) {
                // Kotlite parser exceptions expose their location in the message.
                val location = Regex("line (\\d+) col (\\d+)").find(error.message.orEmpty())
                return projectError(filename, location?.groupValues?.get(1)?.toIntOrNull() ?: 1,
                    location?.groupValues?.get(2)?.toIntOrNull() ?: 1, error.message ?: "Invalid Kotlin source.")
            }
            val classDeclarations = script.nodes.filterIsInstance<ClassDeclarationNode>()
            if (classDeclarations.isNotEmpty()) {
                // BlueJ presents one class per source file. A file without a
                // class may still contain any number of top-level functions
                // and properties, but a class cannot be mixed with them (or
                // with another class).
                val conflictingNode = script.nodes.firstOrNull { node ->
                    node !is ClassDeclarationNode || node !== classDeclarations.first()
                }
                if (conflictingNode != null) {
                    val position = statementPosition(conflictingNode)
                    return projectError(filename, position.lineNum, position.col,
                        "A BlueK project file may contain one class or top-level functions and properties, but not both.")
                }
            }
            val statement = script.nodes.firstOrNull {
                it !is ClassDeclarationNode && it !is FunctionDeclarationNode && it !is PropertyDeclarationNode
            }
            if (statement != null) {
                val position = statementPosition(statement)
                return projectError(filename, position.lineNum, position.col,
                    "Only declarations are allowed at the top level of a Kotlin project file. Move this statement into a function or run it in the Codepad.")
            }
        }
        // Keep the existing combined-source positions used by manifest/diagnostic mapping.
        val source = sources.indices.joinToString("\n\n") { "// BlueK file: ${filenames[it]}\n${sources[it]}" }
        return startEvaluate("<BlueK project>", source, onInput, onComplete)
    }

    private fun statementPosition(node: ASTNode): SourcePosition = when (node) {
        // Call positions point at '('; highlight the callee instead.
        is FunctionCallNode -> statementPosition(node.function)
        is NavigationNode -> statementPosition(node.subject)
        else -> node.position
    }

    private fun projectError(filename: String, line: Int, column: Int, message: String): String {
        val diagnostic = "{\"fileName\":\"${escape(filename)}\",\"line\":$line,\"column\":$column,\"severity\":\"error\",\"message\":\"${escape(message)}\"}"
        return "{\"kind\":\"error\",\"display\":\"${escape(message)}\",\"phase\":\"analysis\",\"fatal\":false,\"diagnostics\":[$diagnostic]}"
    }

    /** Metadata for the GUI, derived from the same AST Kotlite analyzes. */
    fun manifest(): String = try {
        val script = analyzedScript ?: parse("<BlueK project>", analysisSource)
        val classes = script.nodes.filterIsInstance<ClassDeclarationNode>()
        val functions = script.nodes.filterIsInstance<FunctionDeclarationNode>()
        val classJson = classes.joinToString(",", "[", "]") { declaration ->
            val constructors = if (declaration.isInterface) "[]" else {
                val parameters = declaration.primaryConstructor?.parameters.orEmpty().joinToString(",", "[", "]") { parameterJson(it.parameter) }
                "[{\"id\":\"${escape(declaration.name)}.constructor\",\"parameters\":$parameters}]"
            }
            val primaryProperties = declaration.primaryConstructor?.parameters.orEmpty().filter { it.isProperty }.map { parameter ->
                jsonProperty(declaration.name, parameter.parameter.name, parameter.parameter.type, parameter.isMutable, parameter.modifiers.any { it.name == "private" }, false, false, false)
            }
            val bodyProperties = declaration.declarations.filterIsInstance<PropertyDeclarationNode>().map { property ->
                jsonProperty(declaration.name, property.name, property.type, property.isMutable, property.modifiers.any { it.name == "private" }, property.accessors?.getter != null, property.accessors?.setter != null, property.accessors?.setterIsPrivate == true)
            }
            val properties = (primaryProperties + bodyProperties).distinctBy { it.substringBefore("\",\"name\":") }.joinToString(",", "[", "]")
            val methods = declaration.declarations.filterIsInstance<FunctionDeclarationNode>().mapIndexed { index, function -> jsonFunction(declaration.name, function, index) }.joinToString(",", "[", "]")
            val supers = declaration.superInvocations.orEmpty().mapNotNull(::superName).joinToString(",", "[", "]") { jsonTypeName(it) }
            val kind = if (declaration.isInterface) "interface" else if (declaration.modifiers.any { it.name == "abstract" }) "abstract" else "class"
            val typeParameters = declaration.typeParameters.joinToString(",", "[", "]") { parameter -> "\"${escape(parameter.name)}\"" }
            "{\"id\":\"${escape(declaration.name)}\",\"name\":\"${escape(declaration.name)}\",\"kind\":\"$kind\",\"modifiers\":${declaration.modifiers.joinToString(",", "[", "]") { modifier -> "\"${modifier.name}\"" }},\"typeParameters\":$typeParameters,\"supertypes\":$supers,\"constructors\":$constructors,\"properties\":$properties,\"methods\":$methods}"
        }
        val functionJson = functions.mapIndexed { index, function -> jsonFunction("<top-level>", function, index) }.joinToString(",", "[", "]")
        "{\"version\":1,\"classes\":$classJson,\"functions\":$functionJson}"
    } catch (error: Throwable) {
        "{\"version\":1,\"classes\":[],\"error\":\"${escape(error.message ?: "Could not create Kotlite manifest.")}\"}"
    }

    private fun parameterJson(parameter: com.sunnychung.lib.multiplatform.kotlite.model.FunctionValueParameterNode): String =
        "{\"name\":\"${escape(parameter.name)}\",\"type\":${jsonType(parameter.type)},\"hasDefault\":${parameter.defaultValue != null}}"

    private fun jsonProperty(owner: String, name: String, type: TypeNode, mutable: Boolean, private: Boolean, getter: Boolean, setter: Boolean, setterPrivate: Boolean): String =
        "{\"id\":\"${escape(owner)}.${escape(name)}\",\"name\":\"${escape(name)}\",\"type\":${jsonType(type)},\"mutable\":$mutable,\"visibility\":\"${if (private) "private" else "public"}\",\"getter\":$getter,\"setter\":$setter,\"setterPrivate\":$setterPrivate}"

   private fun visibility(modifiers: Set<*>): String = when {
        modifiers.any { it.toString() == "private" } -> "private"
        modifiers.any { it.toString() == "protected" } -> "protected"
        else -> "public"
    }

    private fun jsonFunction(owner: String, function: FunctionDeclarationNode, index: Int): String =
        "{\"sourceLine\":${function.position.lineNum},\"id\":\"${escape(owner)}.${escape(function.name)}.$index\",\"name\":\"${escape(function.name)}\",\"declaringType\":\"${escape(owner)}\",\"parameters\":${function.valueParameters.joinToString(",", "[", "]", transform = ::parameterJson)},\"returnType\":${jsonType(function.returnType)},\"visibility\":\"${visibility(function.modifiers)}\"}"
    private fun jsonType(type: TypeNode): String =
        "{\"classifier\":\"${escape(type.name)}\",\"arguments\":${type.arguments.orEmpty().joinToString(",", "[", "]", transform = ::jsonType)},\"nullable\":${type.isNullable},\"displayName\":\"${escape(type.descriptiveName())}\"}"

    private fun jsonTypeName(name: String): String = jsonType(TypeNode(SourcePosition.NONE, name, null, false))

    private fun superName(node: com.sunnychung.lib.multiplatform.kotlite.model.ASTNode): String? = when (node) {
        is FunctionCallNode -> superName(node.function)
        is TypeNode -> node.name
        is VariableReferenceNode -> node.variableName
        is NavigationNode -> node.member.name
        else -> null
    }

    /**
     * Analyze without changing the running interpreter, then execute only the
     * new source interval. Never retry an evaluated expression: its side effects
     * cannot be rolled back. A runtime failure requires a fresh session.
     */
    fun evaluate(filename: String, source: String): String {
        // Legacy synchronous callers must retain their historical contract;
        // interactive start* calls install the yielding scheduler explicitly.
        val hook = interpreter.checkpointHook
        interpreter.checkpointHook = null
        return try {
            interpreter.runImmediately { evaluateSuspended(filename, source) }
        } finally {
            interpreter.checkpointHook = hook
        }
    }

    private suspend fun evaluateSuspended(filename: String, source: String): String {
        if (faulted) return errorMessage("Runtime failed. Reset or compile before running more code.", "runtime", true)
        val boundary = analysisSource.length + 1
        val analyzed = try {
            ReplAnalyzer.analyze("<BlueK project>", analysisSource + "\n" + source, environment)
        } catch (error: Throwable) {
            return error(error, "analysis")
        }
        return try {
            var value: RuntimeValue = UnitValue
            for (node in analyzed.nodes.filter { it.position.index >= boundary }) {
                value = interpreter.evaluateNode(node) as? RuntimeValue ?: UnitValue
            }
            analysisSource += "\n" + source
            analyzedScript = analyzed
            recordPropertyNames()
            // Kotlin values are objects from BlueK's point of view. Keep every
            // non-Unit expression addressable by the Codepad object control,
            // including values such as Int and String.
            val objectId = if (value !== UnitValue) registerExpressionValue(value) else null
            result("value", value, objectId)
        } catch (error: Throwable) {
            faulted = true
            error(error, "runtime", true)
        }
    }

    /** Starts one execution and returns before input waits or Thread.sleep. */
    fun startEvaluate(filename: String, source: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        inputRequested = onInput
        executionCompleted = onComplete
        (suspend { evaluateSuspended(filename, source) }).startCoroutine(object : Continuation<String> {
            override val context = kotlin.coroutines.EmptyCoroutineContext
            override fun resumeWith(result: Result<String>) {
                inputContinuation = null
                inputRequested = null
                executionCompleted?.invoke(result.getOrElse { error(it, "runtime", true) })
                executionCompleted = null
            }
        })
        return result("started", UnitValue)
    }

    /** Keep a value returned by a Codepad expression addressable by the GUI. */
    private fun registerExpressionValue(value: RuntimeValue): String {
        handles.entries.firstOrNull { it.value === value }?.let { return it.key }
        val binding = "__bluek_expression_${nextHandle++}"
        // Keep semantic analysis aware of the binding without evaluating the
        // expression a second time. The declaration is intentionally added
        // without an initializer; the already evaluated object is assigned
        // directly above.
        analysisSource += "\nval $binding: ${value.type().toTypeNode().descriptiveName()}"
        val script = ReplAnalyzer.analyze("<BlueK project>", analysisSource, environment)
        val declaration = script.nodes.filterIsInstance<PropertyDeclarationNode>()
            .last { it.name == binding }
        val transformedBinding = declaration.transformedRefName
            ?: error("Kotlite did not assign a runtime name to the expression binding")
        interpreter.symbolTable().declareProperty(SourcePosition.BUILTIN, transformedBinding, value.type().toTypeNode(), false)
        interpreter.symbolTable().assign(transformedBinding, value)
        analyzedScript = script
        val id = "object-${nextHandle++}"
        handles[id] = value
        bindingNames[id] = binding
        return id
    }

    private fun recordPropertyNames() {
        val declarations = analyzedScript?.nodes?.filterIsInstance<ClassDeclarationNode>().orEmpty()
        val byName = declarations.associateBy { it.name }
        fun record(declaration: ClassDeclarationNode, visiting: MutableSet<String>) {
            if (!visiting.add(declaration.name)) return
            declaration.superInvocations.orEmpty().mapNotNull(::superName).mapNotNull(byName::get).forEach { record(it, visiting) }
            val names = propertyNames.getOrPut(declaration.name) { mutableListOf() }
            val privateSetters = privateSetterNames.getOrPut(declaration.name) { linkedSetOf() }
            declaration.primaryConstructor?.parameters.orEmpty().filter { it.isProperty }.forEach { parameter ->
                if (parameter.parameter.name !in names) names += parameter.parameter.name
            }
            declaration.declarations.filterIsInstance<PropertyDeclarationNode>().forEach { property ->
                if (property.name !in names) names += property.name
                if (property.accessors?.setterIsPrivate == true) privateSetters += property.name
                // A custom setter does not make a property computed: its
                // default getter still reads the backing field. Only an
                // explicitly declared getter must stay unevaluated during
                // inspection.
                if (property.accessors?.getter != null) computedPropertyNames.getOrPut(declaration.name) { linkedSetOf() } += property.name
            }
            declaration.superInvocations.orEmpty().mapNotNull(::superName).mapNotNull(byName::get).forEach { parent ->
                propertyNames[parent.name].orEmpty().forEach { inherited ->
                    if (inherited !in names) names += inherited
                }
                computedPropertyNames[parent.name].orEmpty().forEach { computed ->
                    computedPropertyNames.getOrPut(declaration.name) { linkedSetOf() } += computed
                }
                privateSetterNames[parent.name].orEmpty().forEach { privateSetter ->
                    privateSetterNames.getOrPut(declaration.name) { linkedSetOf() } += privateSetter
                }
            }
            visiting.remove(declaration.name)
        }
        declarations.forEach { record(it, linkedSetOf()) }
    }

    fun create(className: String, argumentsSource: String, requestedName: String): String {
        if (!requestedName.matches(Regex("[A-Za-z_]\\w*"))) return errorMessage("Invalid object name.")
        if (runCatching { interpreter.symbolTable().findPropertyByDeclaredName(requestedName) }.getOrNull() != null) return errorMessage("An object or variable with this name already exists.")
        val handleName = "__bluek_handle_${nextHandle++}"
        val expression = "val $handleName = $className($argumentsSource)\nval $requestedName = $handleName"
        val evaluated = evaluate("<BlueK constructor>", expression)
        if (evaluated.startsWith("{\"kind\":\"error\"")) return evaluated
        val value = interpreter.symbolTable().findPropertyByDeclaredName(handleName)
            ?: return errorMessage("Constructor did not create an object.")
        val id = "object-${nextHandle++}"
        handles[id] = value
        bindingNames[id] = handleName
        return result("object", value, id, requestedName)
    }

    fun startCreate(className: String, argumentsSource: String, requestedName: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        if (!requestedName.matches(Regex("[A-Za-z_]\\w*"))) return errorMessage("Invalid object name.")
        if (runCatching { interpreter.symbolTable().findPropertyByDeclaredName(requestedName) }.getOrNull() != null) return errorMessage("An object or variable with this name already exists.")
        val handleName = "__bluek_handle_${nextHandle++}"
        val expression = "val $handleName = $className($argumentsSource)\nval $requestedName = $handleName"
        return startEvaluate("<BlueK constructor>", expression, onInput) { evaluated ->
            if (evaluated.startsWith("{\"kind\":\"error\"")) { onComplete(evaluated); return@startEvaluate }
            val value = interpreter.symbolTable().findPropertyByDeclaredName(handleName)
            if (value == null) { onComplete(errorMessage("Constructor did not create an object.")); return@startEvaluate }
            val id = "object-${nextHandle++}"; handles[id] = value; bindingNames[id] = handleName
            onComplete(result("object", value, id, requestedName))
        }
    }

    /** Bind an existing handle; the object itself is never copied or recreated. */
    fun bind(objectId: String, name: String): String {
        val value = handles[objectId] ?: return errorMessage("Object handle is no longer available.")
        val binding = bindingNames[objectId] ?: return errorMessage("Object handle is no longer available.")
        if (!name.matches(Regex("[A-Za-z_]\\w*"))) return errorMessage("Invalid object name.")
        val existing = runCatching { interpreter.symbolTable().findPropertyByDeclaredName(name) }.getOrNull()
        if (existing != null) {
            return if (existing === value) result("object", value, objectId, name)
            else errorMessage("An object or variable with this name already exists.")
        }
        val bound = evaluate("<BlueK object binding>", "val $name = $binding")
        if (bound.startsWith("{\"kind\":\"error\"")) return bound
        return result("object", value, objectId, name)
    }

    fun invoke(objectId: String, methodName: String, argumentsSource: String): String {
        val value = handles[objectId] ?: return errorMessage("Object handle is no longer available.")
        val binding = bindingNames[objectId]
            ?: return errorMessage("Object handle is no longer available.")
        return evaluate("<BlueK method call>", "$binding.$methodName($argumentsSource)")
    }

    fun startInvoke(objectId: String, methodName: String, argumentsSource: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        val binding = bindingNames[objectId] ?: return errorMessage("Object handle is no longer available.")
        return startEvaluate("<BlueK method call>", "$binding.$methodName($argumentsSource)", onInput, onComplete)
    }

    fun set(objectId: String, propertyName: String, valueSource: String): String {
        handles[objectId] ?: return errorMessage("Object handle is no longer available.")
        val binding = bindingNames[objectId]
            ?: return errorMessage("Object handle is no longer available.")
        if (!propertyName.matches(Regex("[A-Za-z_]\\w*"))) return errorMessage("Invalid property name.")
        return evaluate("<BlueK inspector>", "$binding.$propertyName = $valueSource")
    }

    fun startSet(objectId: String, propertyName: String, valueSource: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        val binding = bindingNames[objectId] ?: return errorMessage("Object handle is no longer available.")
        return startEvaluate("<BlueK inspector>", "$binding.$propertyName = $valueSource", onInput, onComplete)
    }

    fun inspect(objectId: String): String {
        val value = handles[objectId] ?: return errorMessage("Object handle is no longer available.")
        if (value !is ClassInstance) return result("value", value)
        // Kotlite deliberately keeps its complete member map internal, so the
        // names are collected from the source declarations while loading the
        // project. Computed properties are reported without reading them: a
        // getter may contain arbitrary student code and must not run during
        // inspection.
        val fields = propertyNames[value.type().name].orEmpty().joinToString(",", "[", "]") { name ->
            val setterPrivate = name in privateSetterNames[value.type().name].orEmpty()
            if (name in computedPropertyNames[value.type().name].orEmpty()) {
                "{\"name\":\"${escape(name)}\",\"value\":\"<computed>\",\"setterPrivate\":$setterPrivate}"
            } else {
                val member = value.readBackingPropertyByDeclaredName(name)
                val display = member?.convertToString() ?: "<uninitialized>"
                "{\"name\":\"${escape(name)}\",\"value\":\"${escape(display)}\",\"type\":${member?.let { jsonType(it.type().toTypeNode()) } ?: "null"},\"setterPrivate\":$setterPrivate}"
            }
        }
        return "{\"kind\":\"inspect\",\"objectId\":\"${escape(objectId)}\",\"className\":\"${escape(value.type().toTypeNode().descriptiveName())}\",\"fields\":$fields}"
    }

    /** Explicit property access may run a getter; passive inspection never does. */
    fun get(objectId: String, propertyName: String): String {
        val binding = bindingNames[objectId]
            ?: return errorMessage("Object handle is no longer available.")
        if (!propertyName.matches(Regex("[A-Za-z_]\\w*"))) return errorMessage("Invalid property name.")
        return evaluate("<BlueK property>", "$binding.$propertyName")
    }

    fun startGet(objectId: String, propertyName: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        val binding = bindingNames[objectId] ?: return errorMessage("Object handle is no longer available.")
        return startEvaluate("<BlueK property>", "$binding.$propertyName", onInput, onComplete)
    }

    fun reset(): String {
        inputContinuation?.resumeWith(Result.failure(RuntimeException("Runtime reset.")))
        inputContinuation = null
        executionCompleted = null
        inputRequested = null
        handles.clear()
        bindingNames.clear()
        analysisSource = ""
        analyzedScript = null
        propertyNames.clear()
        computedPropertyNames.clear()
        privateSetterNames.clear()
        nextHandle = 1
        stageSnapshot = ""
        pendingSounds.clear()
        inputLines.clear()
        faulted = false
        keysDown.clear()
        clickX = null
        clickY = null
        resetInterpreter()
        output.clear()
        return result("reset", UnitValue)
    }

    fun takeOutput(): String {
        val text = output.toString()
        output.clear()
        return text
    }

    fun takeStage(): String {
        val snapshot = if (stageSnapshot.isNotEmpty() && pendingSounds.isNotEmpty()) {
            val sounds = pendingSounds.joinToString(",", "[", "]") { "\"${escape(it)}\"" }
            stageSnapshot.removeSuffix("}}") + ",\"sounds\":$sounds}}"
        } else stageSnapshot
        stageSnapshot = ""
        pendingSounds.clear()
        return snapshot
    }

    fun setKey(key: String, pressed: Boolean): String {
        if (pressed) keysDown += key.lowercase() else keysDown -= key.lowercase()
        return result("value", UnitValue)
    }

    fun setClick(x: Int, y: Int): String {
        clickX = x
        clickY = y
        return result("value", UnitValue)
    }

    fun enqueueInput(line: String): String {
        inputContinuation?.let { continuation ->
            inputContinuation = null
            continuation.resume(StringValue(line, interpreter.symbolTable()))
        } ?: inputLines.add(line)
        return result("value", UnitValue)
    }

    fun enqueueEof(): String {
        inputContinuation?.let { continuation ->
            inputContinuation = null
            if (inputNullable) continuation.resume(NullValue)
            else continuation.resumeWith(Result.failure(RuntimeException("EOF while reading a non-null line")))
        }
        return result("value", UnitValue)
    }

    private fun result(kind: String, value: RuntimeValue, objectId: String? = null, name: String? = null): String {
        val display = if (value === UnitValue) "Unit" else if (value === NullValue) "null" else value.convertToString()
        val actualKind = if (value === UnitValue) "unit" else if (value === NullValue) "null" else if (value is ClassInstance) "object" else "scalar"
        return "{\"kind\":\"$actualKind\",\"display\":\"${escape(display)}\",\"type\":${jsonType(value.type().toTypeNode())}" +
            (objectId?.let { ",\"objectId\":\"${escape(it)}\",\"className\":\"${escape(value.type().toTypeNode().descriptiveName())}\"" } ?: "") +
            (name?.let { ",\"name\":\"${escape(it)}\"" } ?: "") + "}"
    }

    private fun error(error: Throwable, phase: String = "analysis", fatal: Boolean = false): String =
        errorMessage("${error.fullClassName}: ${error.message ?: "Kotlite evaluation failed."}", phase, fatal)
    private fun errorMessage(message: String, phase: String = "request", fatal: Boolean = false): String =
        "{\"kind\":\"error\",\"display\":\"${escape(message)}\",\"phase\":\"$phase\",\"fatal\":$fatal}"
    private fun escape(value: String): String = buildString {
        value.forEach { character ->
            when (character) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                else -> if (character.code < 32) append("\\u" + character.code.toString(16).padStart(4, '0')) else append(character)
            }
        }
    }
}

@OptIn(ExperimentalJsExport::class)
@JsExport
fun bluekCreateKotliteSession(): KotliteSession = KotliteSession()
