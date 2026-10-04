import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.KotliteInterpreter
import com.sunnychung.lib.multiplatform.kotlite.Parser
import com.sunnychung.lib.multiplatform.kotlite.ReplAnalyzer
import com.sunnychung.lib.multiplatform.kotlite.extension.fullClassName
import com.sunnychung.lib.multiplatform.kotlite.extension.isHostStackOverflow
import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer
import com.sunnychung.lib.multiplatform.kotlite.model.ASTNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassSecondaryConstructorNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.error.EvaluateRuntimeException
import com.sunnychung.lib.multiplatform.kotlite.error.InterpreterStateException
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
import com.sunnychung.lib.multiplatform.kotlite.model.StandardExceptionValue
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallNode
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.ExecutionEnvironment
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.IntValue
import com.sunnychung.lib.multiplatform.kotlite.model.LambdaValue
import com.sunnychung.lib.multiplatform.kotlite.model.NullValue
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.reachableRuntimeValues
import com.sunnychung.lib.multiplatform.kotlite.model.ScriptNode
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.StringValue
import com.sunnychung.lib.multiplatform.kotlite.model.ThrowableValue
import com.sunnychung.lib.multiplatform.kotlite.model.UnitValue
import com.sunnychung.lib.multiplatform.kotlite.model.TypeNode
import com.sunnychung.lib.multiplatform.kotlite.model.VariableReferenceNode
import com.sunnychung.lib.multiplatform.kotlite.model.NavigationNode
import com.sunnychung.lib.multiplatform.kotlite.model.DelegatedValue
import com.sunnychung.lib.multiplatform.kotlite.stdlib.AllStdLibModules
import com.sunnychung.lib.multiplatform.kotlite.model.GenericCollectionsModule
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlin.js.JSON
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
private data class BlueKReference(val symbol: String, val interactive: Boolean, var onBench: Boolean)

@OptIn(ExperimentalJsExport::class)
@JsExport
class KotliteSession {

    private val output = StringBuilder()
    /** Every name a student can call; filled while the modules are installed. */
    private val knownNames: MutableSet<String> = mutableSetOf()

    /** The source of the most recent analysis, used to explain a failed one. */
    private var analysisCandidate: String = ""

    private var environment = ExecutionEnvironment()
    private lateinit var interpreter: Interpreter
    private val handles = linkedMapOf<String, RuntimeValue>()
    private val bindingNames = linkedMapOf<String, String>()
    private val references = linkedMapOf<String, BlueKReference>()
    private val managedHandles = linkedSetOf<String>()
    // Immutable history plus semantic lifetime boundaries, never source deletion.
    private val retiredProperties = linkedMapOf<Int, MutableList<String>>()
    private val propertyNames = linkedMapOf<String, MutableList<String>>()
    private val computedPropertyNames = linkedMapOf<String, MutableSet<String>>()
    // Inspector results belong to the runtime. Snapshots never execute getters.
    private val inspectionResults = linkedMapOf<String, MutableMap<String, String>>()
    private var inspectionFailure: String? = null
    private var inspectedPropertyValue: RuntimeValue? = null
    private val privateSetterNames = linkedMapOf<String, MutableSet<String>>()
    private var nextHandle = 1
    private var analysisSource = ""
    // Start offsets of the sources appended to `analysisSource` (project,
    // BluePlay library, Codepad inputs, bindings). Top-level declarations are
    // visible before their position only within their own source.
    private val sourceUnitStarts = mutableListOf<Int>()
    private var analyzedScript: ScriptNode? = null
    private val pendingEffects = mutableListOf<String>()
    private val inputLines = mutableListOf<String>()
    private var inputContinuation: Continuation<RuntimeValue>? = null
    private var inputNullable = false
    private var inputRequestId = 0
    private var inputRequested: ((Int) -> Unit)? = null
    private var outputUpdated: (() -> Unit)? = null
    private var executionCompleted: ((String) -> Unit)? = null
    private var faulted = false
    private var bluePlayEnabled = false
    private val bluePlay = BluePlayEngine()
    private val projectFunctionRanges = mutableListOf<Triple<String, Int, Int>>()
    private val mainFunctionNames = linkedMapOf<String, String>()

    /** The callable name of the main() declared in [filename]. */
    fun mainFunctionName(filename: String): String = mainFunctionNames[filename] ?: "main"

    init {
        resetInterpreter()
    }

    @Suppress("UNUSED_PARAMETER") // The generation stays part of the worker bridge.
    fun configureBluePlay(enabled: Boolean, generationId: String = "") {
        bluePlayEnabled = enabled
        bluePlay.reset()
        bluePlay.setResources("")
        projectFunctionRanges.clear()
        resetInterpreter()
    }

    fun setBluePlayResources(manifest: String) = bluePlay.setResources(manifest)

    /**
     * Pausing here would leave a continuation behind that is never resumed: in a
     * legacy synchronous call, or in a callback that has to return first
     * (Interpreter.canSuspend). This is a limit of BlueK, not an exception of the
     * program, so no catch block of the program may hide it.
     */
    private fun checkCanPause(currentInterpreter: Interpreter, operation: String) {
        if (executionCompleted == null) {
            throw InterpreterStateException("$operation requires asynchronous execution (startEvaluate).")
        }
        if (!currentInterpreter.canSuspend) {
            throw InterpreterStateException(
                "$operation cannot pause inside toString(), equals(), hashCode(), compareTo() or a library callback " +
                    "that must return immediately. Call it outside and pass the result in."
            )
        }
    }

    private fun resetInterpreter() {
        environment = ExecutionEnvironment(sleepHandler = { millis ->
            checkCanPause(interpreter, "Thread.sleep()")
            awaitRuntimeSleep(millis)
        })
        environment.registerClass(BlueKClass.definition())
        environment.registerFunction(BlueKClass.beepFunction { pendingEffects += "beep" })
        val modules = AllStdLibModules { text -> appendOutput(text) }.modules +
            listOf(GenericCollectionsModule, BlueKStdlibModule)
        modules.forEach(environment::install)
        // Names BlueK actually provides, used to tell a misspelling from an
        // unsupported piece of Kotlin. See KotlinSurfaceHints.
        knownNames.clear()
        modules.forEach { module ->
            module.functions.forEach { knownNames += it.functionName }
            module.properties.forEach { knownNames += it.declaredName }
        }
        knownNames += setOf("readln", "readLine", "readlnOrNull", "println", "print", "main")
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekInspectProperty",
            returnType = "Any?",
            parameterTypes = listOf(CustomFunctionParameter("objectId", "String"), CustomFunctionParameter("property", "String")),
            executable = { _, _, _, _ -> throw InterpreterStateException("Inspector property access requires its suspendable path.") },
        ).also { definition ->
            definition.suspendExecutable = { currentInterpreter, _, args, _ ->
                val owner = handles[(args[0] as StringValue).value] as ClassInstance
                (owner.read(currentInterpreter, (args[1] as StringValue).value) as RuntimeValue).also { inspectedPropertyValue = it }
            }
        })
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekInspectFailure",
            returnType = "Nothing?",
            parameterTypes = listOf(CustomFunctionParameter("error", "Throwable")),
            executable = { _, _, args, _ ->
                // `MyEx: x` as Kotlin prints it, without running a student `toString()`.
                inspectionFailure = (args[0] as ClassInstance).convertToString(isCallCustomFunction = false)
                NullValue
            },
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = "Throwable",
            functionName = "printStackTrace",
            returnType = "Unit",
            parameterTypes = emptyList(),
            executable = { _, receiver, _, _ ->
                val error = (receiver as ClassInstance).throwablePart()!!
                appendOutput(buildString {
                    append(error.externalExceptionClassName ?: receiver.type().name)
                    error.message?.let { append(": "); append(it) }
                    append('\n')
                    error.stacktrace.forEach { append("    at "); append(it); append('\n') }
                })
                UnitValue
            },
        ))
        // The published Kotlite stdlib 1.1.0 exposes collection callbacks through
        // synchronous Kotlin function types. The interpreter replays those calls
        // when a callback suspends (StdlibReplayMetadata). Keep the standard
        // library surface, but provide suspendable equivalents for `count`,
        // whose loops then yield as well, and for the in-place filters, which
        // cannot be replayed.
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
        fun patchInPlaceFilter(functionName: String, removeMatching: Boolean) {
            environment.patchFunction(
                receiverType = "MutableList<T>",
                functionName = functionName,
                parameterTypes = listOf("(T) -> Boolean"),
            ) { currentInterpreter, receiver, args, _ ->
                val list = (receiver as DelegatedValue<*>).value as MutableList<RuntimeValue>
                val predicate = args[0] as LambdaValue
                // Evaluate every predicate before changing the list.
                val kept = list.toList().filter { element ->
                    (predicate.executeSuspended(arrayOf(element)) as BooleanValue).value != removeMatching
                }
                val changed = kept.size != list.size
                if (changed) {
                    list.clear()
                    list.addAll(kept)
                }
                BooleanValue(changed, currentInterpreter.symbolTable())
            }
        }
        patchInPlaceFilter("removeAll", removeMatching = true)
        patchInPlaceFilter("retainAll", removeMatching = false)
        // The stdlib calls Kotlin/JS's String.substring, which follows JavaScript:
        // it clamps and swaps out-of-range indices instead of throwing, so
        // "abc".substring(5) would yield "". Check the bounds as Kotlin does.
        environment.patchFunction(
            receiverType = "String",
            functionName = "substring",
            parameterTypes = listOf("Int", "Int"),
        ) { currentInterpreter, receiver, args, _ ->
            val text = (receiver as StringValue).value
            val startIndex = (args[0] as IntValue).value
            val endIndex = (args[1] as IntValue).value
            if (startIndex < 0 || startIndex > endIndex || endIndex > text.length) {
                throw IndexOutOfBoundsException("begin $startIndex, end $endIndex, length ${text.length}")
            }
            StringValue(text.substring(startIndex, endIndex), currentInterpreter.symbolTable())
        }
        suspend fun readBufferedLine(currentInterpreter: Interpreter, name: String, nullable: Boolean): RuntimeValue {
            if (inputLines.isEmpty()) {
                checkCanPause(currentInterpreter, "$name()")
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
            definition.suspendExecutable = { currentInterpreter, _, _, _ -> readBufferedLine(currentInterpreter, name, nullable) }
            environment.registerFunction(definition)
        }
        registerRead("readln", false)
        registerRead("readLine", true)
        registerRead("readlnOrNull", true)
        if (bluePlayEnabled) bluePlay.register(environment)
        interpreter = KotliteInterpreter("<BlueK>", "", environment)
        interpreter.stackFrameFormatter = ::stackFrame
        interpreter.checkpointHook = Interpreter.CheckpointHook(::runtimeCheckpointDue) { awaitRuntimeCheckpoint() }
        interpreter.stackResetHook = { awaitRuntimeStackReset() }
    }

    /** Read scheduler state from its owner; no duplicate simulation state lives here. */
    fun setBluePlayRunningQuery(query: () -> Boolean) = bluePlay.setRunningQuery(query)

    fun takeBluePlayIntent(): String = bluePlay.takeIntent()

    fun setBluePlaySpeed(value: Int): String {
        bluePlay.setSpeed(value)
        return result("unit", UnitValue)
    }

    /** Run one native-scheduled step without creating a Codepad history item. */
    fun startBluePlayStep(onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        if (!bluePlay.hasShownWorld) return errorMessage("No BluePlay world has been shown yet.")
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        inputRequested = onInput
        executionCompleted = onComplete
        bluePlay.beginBatch() // any earlier frame is stale once the step runs
        restartRuntimeSlice()
        (suspend {
            bluePlay.step(interpreter)
            UnitValue
        }).startCoroutine(object : Continuation<UnitValue> {
            override val context = kotlin.coroutines.EmptyCoroutineContext
            override fun resumeWith(outcome: Result<UnitValue>) {
                bluePlay.endBatch()
                inputContinuation = null
                inputRequested = null
                val response = try {
                    result("unit", outcome.getOrThrow())
                } catch (throwable: Throwable) {
                    error(throwable, "runtime", true)
                }
                executionCompleted?.invoke(response)
                executionCompleted = null
            }
        })
        return result("started", UnitValue)
    }

    fun startBluePlayMain(filename: String?, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        if (filename != null && filename !in mainFunctionNames) return errorMessage("No main() in $filename.")
        val selectedName = filename?.let { mainFunctionName(it) }
        val main = analyzedScript?.nodes?.filterIsInstance<FunctionDeclarationNode>()
            ?.singleOrNull {
                it.valueParameters.isEmpty() &&
                    (if (selectedName != null) it.name == selectedName
                     else it.name == "main" || it.name.startsWith(MAIN_ALIAS_PREFIX))
            }
            ?: return errorMessage("BluePlay Reset needs an unambiguous parameterless main().")
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        inputRequested = onInput
        executionCompleted = onComplete
        bluePlay.beginBatch()
        restartRuntimeSlice()
        (suspend {
            val call = FunctionCallNode(VariableReferenceNode(main.position, main.name), emptyList(), emptyList(), main.position)
            interpreter.evalFunctionCall(
                callNode = call,
                functionNode = main,
                extraScopeParameters = emptyMap(),
                extraTypeResolutions = emptyList(),
            ).result
        }).startCoroutine(object : Continuation<RuntimeValue> {
            override val context = kotlin.coroutines.EmptyCoroutineContext
            override fun resumeWith(outcome: Result<RuntimeValue>) {
                bluePlay.endBatch()
                bluePlay.render()
                inputContinuation = null
                inputRequested = null
                val response = try {
                    result("unit", outcome.getOrThrow())
                } catch (throwable: Throwable) {
                    error(throwable, "runtime", true)
                }
                executionCompleted?.invoke(response)
                executionCompleted = null
            }
        })
        return result("started", UnitValue)
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
    fun startLoadProject(filenames: Array<String>, sources: Array<String>, libraryId: String?, libraryVersion: Int, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        if (filenames.size != sources.size) return errorMessage("Project filenames and sources must match.")
        if (libraryId == BluePlayLibrary.id && libraryVersion == BluePlayLibrary.version) {
            bluePlayEnabled = true
        }
        if (bluePlayEnabled && filenames.any { it in setOf("World.kt", "Actor.kt", "Image.kt", "BluePlayFunctions.kt") }) {
            return errorMessage("BluePlay supplies World.kt, Actor.kt, Image.kt and BluePlayFunctions.kt as a built-in library. Remove the framework source files from this project.", "analysis")
        }
        val mainFiles = mutableListOf<String>()
        for (index in sources.indices) {
            val filename = filenames[index]
            val script = try {
                parse(filename, sources[index])
            } catch (error: Throwable) {
                // Kotlite parser exceptions expose their location in the message.
                val location = Regex("line (\\d+) col (\\d+)").find(error.message.orEmpty())
                    ?: Regex(":(\\d+):(\\d+)\\]$").find(error.message.orEmpty()) // SemanticException of the parser
                return projectError(filename, location?.groupValues?.get(1)?.toIntOrNull() ?: 1,
                    location?.groupValues?.get(2)?.toIntOrNull() ?: 1, error.message ?: "Invalid Kotlin source.")
            }
            // The browser runtime provides the Kotlin language and standard
            // library, but no JVM libraries such as java.time or javax.swing.
            script.imports.firstOrNull { !it.path.startsWith("kotlin.") }?.let { import ->
                return projectError(filename, import.position.lineNum, import.position.col,
                    "Import `${import.path}` is not available in BlueK: Kotlin runs in the browser without JVM libraries (java.*, javax.*).")
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
            if (script.nodes.any { it is FunctionDeclarationNode && it.name == "main" }) mainFiles += filename
            val statement = script.nodes.firstOrNull {
                it !is ClassDeclarationNode && it !is FunctionDeclarationNode && it !is PropertyDeclarationNode
            }
            if (statement != null) {
                val position = statementPosition(statement)
                return projectError(filename, position.lineNum, position.col,
                    "Only declarations are allowed at the top level of a Kotlin project file. Move this statement into a function or run it in the Codepad.")
            }
        }
        // Like Kotlin, every file may declare its own main(). The files share one
        // script here, so all but one get an internal name; the manifest still
        // presents them as main. Buttons always pass the chosen file explicitly.
        // The unaliased name only preserves the existing Codepad main() binding.
        mainFunctionNames.clear()
        val primaryMain = mainFiles.firstOrNull { it == "Main.kt" } ?: mainFiles.firstOrNull()
        val projectSources = sources.indices.map { index ->
            val filename = filenames[index]
            if (filename !in mainFiles) return@map sources[index]
            if (filename == primaryMain) {
                mainFunctionNames[filename] = "main"
                return@map sources[index]
            }
            val internalName = MAIN_ALIAS_PREFIX + filename.removeSuffix(".kt").replace(Regex("[^A-Za-z0-9_]"), "_")
            mainFunctionNames[filename] = internalName
            sources[index].replace(Regex("(^|\n)([ \t]*)fun(\\s+)main(\\s*\\()")) { match ->
                "${match.groupValues[1]}${match.groupValues[2]}fun${match.groupValues[3]}$internalName${match.groupValues[4]}"
            }
        }
        // Keep the existing combined-source positions used by manifest/diagnostic mapping.
        val projectSource = sources.indices.joinToString("\n\n") { "// BlueK file: ${filenames[it]}\n${projectSources[it]}" }
        projectFunctionRanges.clear()
        var lineCursor = 2 + if (bluePlayEnabled) BluePlayLibrary.source.split('\n').size + 1 else 0
        sources.indices.forEach { index ->
            val first = lineCursor + 1
            val last = first + sources[index].split('\n').size - 1
            projectFunctionRanges += Triple(filenames[index], first, last)
            lineCursor = last + 2
        }
        val source = if (bluePlayEnabled) BluePlayLibrary.source + "\n\n" + projectSource else projectSource
        // The library must not see top-level declarations of the project.
        val projectOffsets = if (bluePlayEnabled) listOf(BluePlayLibrary.source.length + 2) else emptyList()
        return startEvaluateInternal("<BlueK project>", source, onInput, { result ->
            val reported = withAccessorWarnings(withProjectDiagnostic(result))
            // Not loaded: later code must not be attributed to the project files (RT-71).
            if (result.startsWith("{\"kind\":\"error\"")) projectFunctionRanges.clear()
            onComplete(reported)
        }, emptySet(), projectOffsets)
    }

    /**
     * Kotlin compiles an accessor that uses its own property instead of
     * `field`, but it calls itself until the stack overflows. IntelliJ warns
     * about it; BlueK reports it as a warning of a successful compile.
     */
    private fun withAccessorWarnings(result: String): String {
        if (result.startsWith("{\"kind\":\"error\"")) return result
        val warnings = analyzedScript?.nodes.orEmpty()
            .filterIsInstance<ClassDeclarationNode>()
            .flatMap { listOfNotNull(it, it.companionObject) }
            .flatMap { it.declarations.filterIsInstance<PropertyDeclarationNode>() }
            .flatMap { property ->
                listOfNotNull(
                    property.selfCallingSetter?.let { it to "The setter of `${property.name}` assigns `${property.name}` and so calls itself endlessly. Write `field = value` to store the value." },
                    property.selfCallingGetter?.let { it to "The getter of `${property.name}` reads `${property.name}` and so calls itself endlessly. Use `field` for the stored value." },
                )
            }
            .mapNotNull { (position, message) ->
                val range = projectFunctionRanges.firstOrNull { position.lineNum in it.second..it.third } ?: return@mapNotNull null
                "{\"fileName\":\"${escape(range.first)}\",\"line\":${position.lineNum - range.second + 1},\"column\":${position.col},\"severity\":\"warning\",\"message\":\"${escape(message)}\"}"
            }
        if (warnings.isEmpty()) return result
        return result.removeSuffix("}") + ",\"diagnostics\":${warnings.joinToString(",", "[", "]")}}"
    }

    /**
     * Map an error position in the combined source (library prefix + files) to
     * the project file and line, so that editors highlight the right place.
     */
    private fun withProjectDiagnostic(result: String): String {
        if (!result.startsWith("{\"kind\":\"error\"") || "\"diagnostics\"" in result) return result
        val location = Regex("<BlueK project>:(\\d+):(\\d+)").find(result) ?: return result
        val line = location.groupValues[1].toInt()
        val range = projectFunctionRanges.firstOrNull { line in it.second..it.third } ?: return result
        val message = Regex("\"display\":\"((?:[^\"\\\\]|\\\\.)*)\"").find(result)?.groupValues?.get(1) ?: return result
        val diagnostic = "{\"fileName\":\"${escape(range.first)}\",\"line\":${line - range.second + 1},\"column\":${location.groupValues[2]},\"severity\":\"error\",\"message\":\"$message\"}"
        return result.removeSuffix("}") + ",\"diagnostics\":[$diagnostic]}"
    }

    /**
     * A stack trace line as Kotlin writes it, `Karte.wert(Karte.kt:3)`, with the file and line of
     * the project file instead of the combined source (RT-71). Code typed in the Codepad has no
     * file: its top-level line is left out, a function declared there shows `(Codepad)`. A native
     * function has no position (`toInt(Kotlin library)`).
     */
    private fun stackFrame(name: String?, position: SourcePosition?): String? {
        val location = position?.takeIf { it.filename == "<BlueK project>" }?.let { sourcePosition ->
            val line = sourcePosition.lineNum
            projectFunctionRanges.firstOrNull { line in it.second..it.third }?.let { "${it.first}:${line - it.second + 1}" }
                ?: if (bluePlayEnabled && line < (projectFunctionRanges.firstOrNull()?.second ?: 0)) "BluePlay" else "Codepad"
        }
        if (name == null) return location?.takeIf { it.contains(".kt:") }?.let { "<top-level>($it)" }
        val function = if (name.startsWith(MAIN_ALIAS_PREFIX)) "main" else name
        return "$function(${location ?: "Kotlin library"})"
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
            val isEnum = declaration.modifiers.any { it.name == "enum" }
            val constructors = if (declaration.isInterface || declaration.isObject || isEnum) "[]" else {
                val secondary = declaration.declarations.filterIsInstance<ClassSecondaryConstructorNode>()
                val parameterSets = if (secondary.isEmpty()) listOf(declaration.primaryConstructor?.parameters.orEmpty().map { it.parameter })
                    else secondary.map { it.valueParameters }
                parameterSets.mapIndexed { index, parameters ->
                    "{\"id\":\"${escape(declaration.name)}.constructor${if (secondary.isEmpty()) "" else ".$index"}\",\"parameters\":${parameters.joinToString(",", "[", "]") { parameterJson(it) }}}"
                }.joinToString(",", "[", "]")
            }
            val primaryProperties = declaration.primaryConstructor?.parameters.orEmpty().filter { it.isProperty }.map { parameter ->
                jsonProperty(declaration.name, parameter.parameter.name, parameter.parameter.type, parameter.isMutable, visibility(parameter.modifiers.toSet()), false, false, false)
            }
            val bodyProperties = declaration.declarations.filterIsInstance<PropertyDeclarationNode>().map { property ->
                jsonProperty(declaration.name, property.name, property.type, property.isMutable, visibility(property.modifiers), property.accessors?.getter != null, property.accessors?.setter != null, property.accessors?.setterIsPrivate == true)
            }
            val properties = (primaryProperties + bodyProperties).filterNot { bluePlayEnabled && declaration.name in setOf("World", "Actor", "Image") && it.contains("\"visibility\":\"private\"") }.distinctBy { it.substringBefore("\",\"name\":") }.joinToString(",", "[", "]")
            val methods = declaration.declarations.filterIsInstance<FunctionDeclarationNode>().filterNot { it is ClassSecondaryConstructorNode || it.isGenerated || (bluePlayEnabled && declaration.name in setOf("World", "Actor", "Image") && it.modifiers.any { modifier -> modifier.name == "private" }) }.mapIndexed { index, function -> jsonFunction(declaration.name, function, index) }.joinToString(",", "[", "]")
            val supers = declaration.superInvocations.orEmpty().mapNotNull(::superName).joinToString(",", "[", "]") { jsonTypeName(it) }
            val kind = if (declaration.isInterface) "interface" else if (declaration.isObject) "object" else if (isEnum) "enum" else if (declaration.modifiers.any { it.name == "abstract" }) "abstract" else "class"
            // Called as `Klasse.f()` from the class menu, like the methods of an object.
            val companionMethods = declaration.companionObject?.declarations.orEmpty().filterIsInstance<FunctionDeclarationNode>()
                .filterNot { it.modifiers.any { modifier -> modifier.name == "private" } }
                .mapIndexed { index, function -> jsonFunction("${declaration.name}.Companion", function, index) }
            val typeParameters = declaration.typeParameters.joinToString(",", "[", "]") { parameter -> "\"${escape(parameter.name)}\"" }
            "{\"id\":\"${escape(declaration.name)}\",\"name\":\"${escape(declaration.name)}\",\"kind\":\"$kind\",\"modifiers\":${declaration.modifiers.joinToString(",", "[", "]") { modifier -> "\"${modifier.name}\"" }},\"typeParameters\":$typeParameters,\"supertypes\":$supers,\"constructors\":$constructors,\"properties\":$properties,\"methods\":$methods${if (companionMethods.isEmpty()) "" else ",\"companionMethods\":${companionMethods.joinToString(",", "[", "]")}"}${if (bluePlayEnabled && declaration.name in setOf("World", "Actor", "Image")) ",\"builtin\":true" else ""}}"
        }
        val functionJson = functions.mapIndexed { index, function ->
            val sourceFile = projectFunctionRanges.firstOrNull { function.position.lineNum in it.second..it.third }?.first
            jsonFunction("<top-level>", function, index, sourceFile, sourceFile == null && bluePlayEnabled)
        }.joinToString(",", "[", "]")
        "{\"version\":1,\"classes\":$classJson,\"functions\":$functionJson${if (bluePlayEnabled) ",\"library\":{\"id\":\"blueplay\",\"version\":1}" else ""}}"
    } catch (error: Throwable) {
        "{\"version\":1,\"classes\":[],\"error\":\"${escape(error.message ?: "Could not create Kotlite manifest.")}\"}"
    }

    private fun parameterJson(parameter: com.sunnychung.lib.multiplatform.kotlite.model.FunctionValueParameterNode): String =
        "{\"name\":\"${escape(parameter.name)}\",\"type\":${jsonType(parameter.type)},\"hasDefault\":${parameter.defaultValue != null}}"

    private fun jsonProperty(owner: String, name: String, type: TypeNode, mutable: Boolean, visibility: String, getter: Boolean, setter: Boolean, setterPrivate: Boolean): String =
        "{\"id\":\"${escape(owner)}.${escape(name)}\",\"name\":\"${escape(name)}\",\"type\":${jsonType(type)},\"mutable\":$mutable,\"visibility\":\"$visibility\",\"getter\":$getter,\"setter\":$setter,\"setterPrivate\":$setterPrivate}"

   private fun visibility(modifiers: Set<*>): String = when {
        modifiers.any { it.toString() == "private" } -> "private"
        modifiers.any { it.toString() == "protected" } -> "protected"
        else -> "public"
    }

    private fun jsonFunction(owner: String, function: FunctionDeclarationNode, index: Int, sourceFile: String? = null, builtin: Boolean = false): String =
        "{\"sourceLine\":${function.position.lineNum},\"id\":\"${escape(owner)}.${escape(function.name)}.$index\",\"name\":\"${escape(if (function.name.startsWith(MAIN_ALIAS_PREFIX)) "main" else function.name)}\",\"declaringType\":\"${escape(owner)}\",\"typeParameters\":${function.typeParameters.joinToString(",", "[", "]") { parameter -> "\"${escape(parameter.name + (parameter.typeUpperBound?.let { " : " + it.descriptiveName() } ?: ""))}\"" }},\"parameters\":${function.valueParameters.joinToString(",", "[", "]", transform = ::parameterJson)},\"returnType\":${jsonType(function.returnType)},\"visibility\":\"${visibility(function.modifiers)}\"${sourceFile?.let { ",\"sourceFile\":\"${escape(it)}\"" } ?: ""}${if (builtin) ",\"builtin\":true" else ""}}"
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
        return evaluateWithBindings(filename, source, emptySet()).also { bluePlay.render() }
    }

    private fun evaluateWithBindings(filename: String, source: String, interactiveNames: Set<String>, inspection: Boolean = false): String {
        // Legacy synchronous callers must retain their historical contract;
        // interactive start* calls install the yielding scheduler explicitly.
        val hook = interpreter.checkpointHook
        interpreter.checkpointHook = null
        return try {
            interpreter.runImmediately { evaluateSuspended(filename, source, interactiveNames, inspection = inspection) }
        } finally {
            interpreter.checkpointHook = hook
        }
    }

    /** [unitOffsets]: further source units inside [source], as offsets into it. */
    private suspend fun evaluateSuspended(filename: String, source: String, interactiveNames: Set<String> = emptySet(), unitOffsets: List<Int> = emptyList(), inspection: Boolean = false): String {
        if (faulted) return errorMessage("Runtime failed. Reset or compile before running more code.", "runtime", true)
        val boundary = analysisSource.length + 1
        val candidate = analysisSource + "\n" + source
        analysisCandidate = candidate
        val units = listOf(boundary) + unitOffsets.map { boundary + it }
        val analyzed = try {
            ReplAnalyzer.analyze("<BlueK project>", candidate, environment, retiredProperties, sourceUnitStarts + units)
        } catch (error: Throwable) {
            return error(error, "analysis")
        }
        return try {
            var value: RuntimeValue = UnitValue
            for (node in analyzed.nodes.filter { it.position.index >= boundary }) {
                value = interpreter.evaluateNode(node) as? RuntimeValue ?: UnitValue
            }
            val newNodes = analyzed.nodes.filter { it.position.index >= boundary }
            analysisSource += "\n" + source
            sourceUnitStarts += units
            newNodes.filterIsInstance<PropertyDeclarationNode>().forEach { declaration ->
                if (!declaration.name.startsWith("__bluek_")) {
                    val interactive = declaration.name in interactiveNames
                    references[declaration.name] = BlueKReference(declaration.transformedRefName!!, interactive, interactive)
                }
            }
            analyzedScript = analyzed
            recordPropertyNames()
            // Kotlin values are objects from BlueK's point of view. Keep every
            // non-Unit expression addressable by the Codepad object control,
            // including values such as Int and String.
            var objectId = if (value !== UnitValue && (!inspection || value is ClassInstance && value !is DelegatedValue<*>)) registerExpressionValue(value) else null
            reconcileReferences()
            // A fresh expression may return the value it just detached (e.g.
            // list.removeAt). Its old history handles stay invalid, but this
            // new result is transferable under a fresh provisional handle.
            if (objectId != null && objectId !in handles) objectId = registerExpressionValue(value)
            result("value", value, objectId, inspection = inspection)
        } catch (error: Throwable) {
            faulted = true
            error(error, "runtime", true)
        }
    }

    /** Starts one execution and returns before input waits or Thread.sleep. */
    fun startEvaluate(filename: String, source: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        return startEvaluateInternal(filename, source, onInput, onComplete, emptySet())
    }

    private fun startEvaluateInternal(filename: String, source: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit, interactiveNames: Set<String>, unitOffsets: List<Int> = emptyList(), inspection: Boolean = false): String {
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        inputRequested = onInput
        executionCompleted = onComplete
        restartRuntimeSlice()
        (suspend { evaluateSuspended(filename, source, interactiveNames, unitOffsets, inspection) }).startCoroutine(object : Continuation<String> {
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
        val syntheticSource = "val $binding: ${value.type().toTypeNode().descriptiveName()}"
        val bindingStart = analysisSource.length + 1
        val script = ReplAnalyzer.analyze("<BlueK project>", analysisSource + "\n" + syntheticSource, environment, retiredProperties, sourceUnitStarts + bindingStart)
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
        analysisSource += "\n" + syntheticSource
        sourceUnitStarts += bindingStart
        return id
    }

    private fun referenceValue(reference: BlueKReference): RuntimeValue? =
        runCatching { interpreter.symbolTable().read(reference.symbol) }.getOrNull()

    private fun retire(name: String) {
        interpreter.symbolTable().undeclarePropertyByDeclaredName(name)
        retiredProperties.getOrPut(analysisSource.length + 1) { mutableListOf() }.add(name)
    }

    /** Bindings own values; handles are views and do not keep named objects alive. */
    private fun reconcileReferences() {
        val roots = references.values.mapNotNull(::referenceValue)
        // Give every named value a canonical handle, including mutable Codepad variables.
        roots.forEach(::registerExpressionValue)
        val reachable = reachableRuntimeValues(roots, bluePlay::retainedBy)
        handles.toList().forEach { (id, value) ->
            if (value in reachable) managedHandles += id
            else if (id in managedHandles) {
                bindingNames.remove(id)?.let(::retire)
                handles.remove(id)
                managedHandles.remove(id)
                inspectionResults.remove(id)
            }
        }
    }

    /** Authoritative namespace and live views; passive and safe during output callbacks. */
    fun referenceSnapshot(): String {
        val entries = references.map { (name, reference) ->
            val value = referenceValue(reference)
            val id = handles.entries.firstOrNull { it.value === value }?.key
            "{\"name\":\"${escape(name)}\",\"origin\":\"${if (reference.interactive) "interactive" else "persistent"}\",\"onBench\":${reference.onBench},\"objectId\":${id?.let { "\"${escape(it)}\"" } ?: "null"},\"className\":\"${escape(value?.type()?.toTypeNode()?.descriptiveName() ?: "")}\"}"
        }.joinToString(",", "[", "]")
        val ids = handles.keys.joinToString(",", "[", "]") { "\"${escape(it)}\"" }
        return "{\"references\":$entries,\"liveObjectIds\":$ids}"
    }

    private fun recordPropertyNames() {
        val declarations = analyzedScript?.nodes?.filterIsInstance<ClassDeclarationNode>().orEmpty().flatMap { listOfNotNull(it, it.companionObject) }
        val byName = declarations.associateBy { it.name }
        fun record(declaration: ClassDeclarationNode, visiting: MutableSet<String>) {
            if (!visiting.add(declaration.name)) return
            declaration.superInvocations.orEmpty().mapNotNull(::superName).mapNotNull(byName::get).forEach { record(it, visiting) }
            val names = propertyNames.getOrPut(declaration.name) { mutableListOf() }
            val privateSetters = privateSetterNames.getOrPut(declaration.name) { linkedSetOf() }
            declaration.primaryConstructor?.parameters.orEmpty().filter { it.isProperty }.forEach { parameter ->
                if (parameter.parameter.name !in names) names += parameter.parameter.name
            }
            declaration.declarations.filterIsInstance<PropertyDeclarationNode>().filterNot { bluePlayEnabled && declaration.name in setOf("World", "Actor", "Image") && it.modifiers.any { modifier -> modifier.name == "private" } }.forEach { property ->
                if (property.name !in names) names += property.name
                if (property.accessors?.setterIsPrivate == true) privateSetters += property.name
                // A custom setter does not make a property computed: its
                // default getter still reads the backing field. Only an
                // explicitly declared getter needs its last inspection result
                // instead of a passive backing-field read.
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
        if (!validReferenceName(requestedName)) return errorMessage("Invalid object name.")
        val evaluated = evaluateWithBindings("<BlueK constructor>", "val $requestedName = $className($argumentsSource)", setOf(requestedName))
        if (evaluated.startsWith("{\"kind\":\"error\"")) return evaluated
        return createdReference(requestedName)
    }

    private fun validReferenceName(name: String): Boolean =
        name.matches(Regex("[A-Za-z_]\\w*")) && !name.startsWith("__bluek_") &&
            runCatching { (parse("<name>", "val $name: Int").nodes.single() as PropertyDeclarationNode).name == name }.getOrDefault(false)

    private fun createdReference(name: String): String {
        val value = referenceValue(references.getValue(name)) ?: return errorMessage("Constructor did not create an object.")
        return result("object", value, registerExpressionValue(value), name)
    }

    fun startCreate(className: String, argumentsSource: String, requestedName: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        if (!validReferenceName(requestedName)) return errorMessage("Invalid object name.")
        val expression = "val $requestedName = $className($argumentsSource)"
        return startEvaluateInternal("<BlueK constructor>", expression, onInput, { evaluated ->
            if (evaluated.startsWith("{\"kind\":\"error\"")) { onComplete(evaluated); return@startEvaluateInternal }
            onComplete(createdReference(requestedName))
        }, setOf(requestedName))
    }

    /** Bind an existing handle; the object itself is never copied or recreated. */
    fun bind(objectId: String, name: String): String {
        val value = handles[objectId] ?: return errorMessage("Object handle is no longer available.")
        val binding = bindingNames[objectId] ?: return errorMessage("Object handle is no longer available.")
        if (!validReferenceName(name)) return errorMessage("Invalid object name.")
        val existing = runCatching { interpreter.symbolTable().findPropertyByDeclaredName(name) }.getOrNull()
        if (existing != null) {
            if (existing !== value) return errorMessage("An object or variable with this name already exists.")
            references.getValue(name).onBench = true
            return result("object", value, objectId, name)
        }
        val bound = bindValue(binding, name)
        if (bound.startsWith("{\"kind\":\"error\"")) return bound
        return result("object", value, objectId, name)
    }

    private fun bindValue(binding: String, name: String): String =
        evaluateWithBindings("<BlueK object binding>", "val $name = $binding", setOf(name))

    fun remove(objectId: String, name: String): String {
        val value = handles[objectId] ?: return errorMessage("Object handle is no longer available.")
        val reference = references[name] ?: return errorMessage("This name is no longer available.")
        if (!reference.onBench || referenceValue(reference) !== value) return errorMessage("This object-bench reference has changed.")
        if (reference.interactive) {
            retire(name)
            references.remove(name)
        } else reference.onBench = false
        reconcileReferences()
        return result("unit", UnitValue)
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
        // project. Snapshot publication stays passive; explicit inspection
        // refreshes evaluate every property through startInspectGet.
        val fields = propertyNames[value.type().name].orEmpty().joinToString(",", "[", "]") { name ->
            val setterPrivate = name in privateSetterNames[value.type().name].orEmpty()
            val cached = inspectionResults[objectId]?.get(name)
            if (name in computedPropertyNames[value.type().name].orEmpty()) {
                cached ?: "{\"name\":\"${escape(name)}\",\"value\":\"<computed>\",\"computed\":true,\"setterPrivate\":$setterPrivate}"
            } else {
                val member = value.readBackingPropertyByDeclaredName(name)
                val display = member?.let(::inspectorDisplay) ?: "<uninitialized>"
                val reference = member is ClassInstance && member !is DelegatedValue<*>
                val summary = isInspectorSummary(member)
                "{\"name\":\"${escape(name)}\",\"value\":\"${escape(display)}\",\"type\":${member?.let { jsonType(it.type().toTypeNode()) } ?: "null"},\"setterPrivate\":$setterPrivate,\"reference\":$reference,\"summary\":$summary}"
            }
        }
        return "{\"kind\":\"inspect\",\"objectId\":\"${escape(objectId)}\",\"className\":\"${escape(value.type().toTypeNode().descriptiveName())}\",\"fields\":$fields}"
    }

    /** Follow a stored object reference without running its getter or toString(). */
    fun inspectField(objectId: String, propertyName: String): String {
        val owner = handles[objectId] as? ClassInstance
            ?: return errorMessage("Object handle is no longer available.")
        if (!propertyName.matches(Regex("[A-Za-z_]\\w*")) || propertyName !in propertyNames[owner.type().name].orEmpty() ||
            propertyName in computedPropertyNames[owner.type().name].orEmpty())
            return errorMessage("Object reference is not available.")
        val value = owner.readBackingPropertyByDeclaredName(propertyName)
        if (value !is ClassInstance || value is DelegatedValue<*>)
            return errorMessage("Object reference is not available.")
        val referenceId = registerExpressionValue(value)
        reconcileReferences()
        return inspect(referenceId)
    }

    /**
     * Passive text for an inspected field: never runs a student `toString()`,
     * and shows the size and first elements of collections instead of `MutableList()`
     * pairs as `(1, a)`, triples as `(1, a, b)` and map entries as `a=1`.
     */
    private fun inspectorDisplay(value: RuntimeValue): String {
        val content = (value as? DelegatedValue<*>)?.value
        if (content is Collection<*>) {
            val shown = content.take(5).joinToString(", ") { (it as? RuntimeValue)?.let(::inspectorDisplay) ?: it.toString() }
            return "[$shown${if (content.size > 5) ", …" else ""}] (size ${content.size})"
        }
        if (content is Map<*, *>) return "{…} (size ${content.size})"
        if (content is Pair<*, *>) return listOf(content.first, content.second)
            .joinToString(", ", "(", ")") { (it as? RuntimeValue)?.let(::inspectorDisplay) ?: it.toString() }
        if (content is Map.Entry<*, *>) return listOf(content.key, content.value)
            .joinToString("=") { (it as? RuntimeValue)?.let(::inspectorDisplay) ?: it.toString() }
        if (content is Triple<*, *, *>) return listOf(content.first, content.second, content.third)
            .joinToString(", ", "(", ")") { (it as? RuntimeValue)?.let(::inspectorDisplay) ?: it.toString() }
        return if (value is ClassInstance && value !is DelegatedValue<*>) value.convertToString(isCallCustomFunction = false) else value.convertToString()
    }

    /** Collections, pairs, triples, map entries and StringBuilders are shown as a summary that is no Kotlin expression. */
    private fun isInspectorSummary(value: RuntimeValue?): Boolean =
        (value as? DelegatedValue<*>)?.value.let { it is Collection<*> || it is Map<*, *> || it is Map.Entry<*, *> || it is Pair<*, *> || it is Triple<*, *, *> || it is StringBuilder }

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

    private fun inspectionSource(objectId: String, propertyName: String): String? {
        val owner = handles[objectId] as? ClassInstance ?: return null
        if (propertyName !in propertyNames[owner.type().name].orEmpty()) return null
        return "try { bluekInspectProperty(\"${escape(objectId)}\", \"${escape(propertyName)}\") } catch (__bluek_error: Throwable) { bluekInspectFailure(__bluek_error) }"
    }

    private fun finishInspection(objectId: String, propertyName: String, evaluated: String): String {
        val failure = inspectionFailure
        inspectionFailure = null
        val response = if (failure != null) errorMessage(failure, "runtime") else evaluated
        val parsed = JSON.parse<dynamic>(response)
        val owner = handles[objectId] as? ClassInstance ?: return response
        val computed = propertyName in computedPropertyNames[owner.type().name].orEmpty()
        val setterPrivate = propertyName in privateSetterNames[owner.type().name].orEmpty()
        val value = inspectedPropertyValue
        inspectedPropertyValue = null
        val summary = isInspectorSummary(value)
        val reference = value is ClassInstance && value !is DelegatedValue<*> && parsed.kind != "error"
        val field = "{\"name\":\"${escape(propertyName)}\",\"value\":\"${escape(parsed.display as? String ?: "<uninitialized>")}\",\"type\":${JSON.stringify(parsed.type ?: null)},\"computed\":$computed,\"setterPrivate\":$setterPrivate,\"reference\":$reference,\"summary\":$summary" +
            (if (reference) ",\"objectId\":\"${escape(parsed.objectId as String)}\"" else "") +
            (if (parsed.kind == "error") ",\"error\":\"${escape(parsed.display as String)}\"" else "") + "}"
        inspectionResults.getOrPut(objectId) { linkedMapOf() }[propertyName] = field
        return response
    }

    fun inspectGet(objectId: String, propertyName: String): String {
        val source = inspectionSource(objectId, propertyName) ?: return errorMessage("Property is no longer available.")
        inspectionFailure = null; inspectedPropertyValue = null
        return finishInspection(objectId, propertyName, evaluateWithBindings("<BlueK inspection>", source, emptySet(), inspection = true))
    }

    fun startInspectGet(objectId: String, propertyName: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        val source = inspectionSource(objectId, propertyName) ?: return errorMessage("Property is no longer available.")
        inspectionFailure = null; inspectedPropertyValue = null
        return startEvaluateInternal("<BlueK inspection>", source, onInput, { evaluated ->
            onComplete(finishInspection(objectId, propertyName, evaluated))
        }, emptySet(), inspection = true)
    }

    fun reset(): String {
        inputContinuation?.resumeWith(Result.failure(RuntimeException("Runtime reset.")))
        inputContinuation = null
        executionCompleted = null
        inputRequested = null
        handles.clear()
        bindingNames.clear()
        references.clear()
        managedHandles.clear()
        retiredProperties.clear()
        analysisSource = ""
        sourceUnitStarts.clear()
        analyzedScript = null
        propertyNames.clear()
        computedPropertyNames.clear()
        inspectionResults.clear()
        inspectionFailure = null
        inspectedPropertyValue = null
        privateSetterNames.clear()
        pendingEffects.clear()
        inputLines.clear()
        faulted = false
        bluePlay.reset()
        projectFunctionRanges.clear()
        resetInterpreter()
        output.clear()
        return result("reset", UnitValue)
    }

    fun takeOutput(): String {
        val text = output.toString()
        output.clear()
        return text
    }

    /**
     * The BluePlay library does not render on every state change; the frame of
     * the shown world is produced when it is requested.
     */
    fun takeStage(): String = bluePlay.takeStage()

    fun renderBluePlay() = bluePlay.render()

    fun takeEffects(): String {
        val effects = pendingEffects.joinToString(",", "[", "]") { "{\"type\":\"sound\",\"name\":\"${escape(it)}\"}" }
        pendingEffects.clear()
        return effects
    }

    fun setKey(key: String, pressed: Boolean): String {
        bluePlay.setKey(key, pressed)
        return result("value", UnitValue)
    }

    fun setClick(x: Int, y: Int, actorId: String): String {
        bluePlay.setClick(x, y, actorId)
        return result("value", UnitValue)
    }

    fun enqueueInput(line: String): String {
        inputContinuation?.let { continuation ->
            inputContinuation = null
            restartRuntimeSlice()
            continuation.resume(StringValue(line, interpreter.symbolTable()))
        } ?: inputLines.add(line)
        return result("value", UnitValue)
    }

    fun enqueueEof(): String {
        inputContinuation?.let { continuation ->
            inputContinuation = null
            restartRuntimeSlice()
            if (inputNullable) continuation.resume(NullValue)
            else continuation.resumeWith(Result.failure(RuntimeException("EOF while reading a non-null line")))
        }
        return result("value", UnitValue)
    }

    private fun result(kind: String, value: RuntimeValue, objectId: String? = null, name: String? = null, inspection: Boolean = false): String {
        val display = if (value === UnitValue) "Unit" else if (value === NullValue) "null" else if (inspection) inspectorDisplay(value) else value.convertToString()
        val actualKind = if (value === UnitValue) "unit" else if (value === NullValue) "null" else if (value is ClassInstance) "object" else "scalar"
        return "{\"kind\":\"$actualKind\",\"display\":\"${escape(display)}\",\"type\":${jsonType(value.type().toTypeNode())}" +
            (objectId?.let { ",\"objectId\":\"${escape(it)}\",\"className\":\"${escape(value.type().toTypeNode().descriptiveName())}\"" } ?: "") +
            (name?.let { ",\"name\":\"${escape(it)}\"" } ?: "") + "}"
    }

    private fun error(error: Throwable, phase: String = "analysis", fatal: Boolean = false): String {
        // A Kotlin exception thrown by student code is reported by its own class
        // name, e.g. `IllegalArgumentException: Unbekannte Farbe: Blau`.
        val thrown = (error as? EvaluateRuntimeException)?.error
        // Deep recursion inside a synchronous callback (e.g. `toString`) can still exhaust the host stack.
        if (thrown == null && error.isHostStackOverflow)
            return errorMessage("StackOverflowError: ${StandardExceptionValue.stackOverflowMessage(null)}", phase, fatal)
        // `MyEx: x`, or `MyEx` without message, for the thrown object (also a student subclass).
        if (thrown != null) return errorMessage(thrown.wholeInstance().convertToString(isCallCustomFunction = false), phase, fatal)
        val message = error.message ?: "Kotlite evaluation failed."
        // A missing name is reported by Kotlite as an ordinary analysis error.
        // BlueK says instead which side the gap is on; the exception class name
        // would only add noise there.
        KotlinSurfaceHints.rewrite(message, knownNames, declaredNames())
            ?.let { return errorMessage(it, phase, fatal) }
        return errorMessage("${error.fullClassName}: $message", phase, fatal)
    }
    /**
     * Names the student declared in the analyzed source. Kotlite reports a
     * wrong argument type with the same wording as an unknown name, so a name
     * found here must keep Kotlite's message - it lists the argument types.
     */
    private fun declaredNames(): Set<String> =
        Regex("\\b(?:fun|class|val|var)\\s+([A-Za-z_][A-Za-z0-9_]*)")
            .findAll(analysisCandidate)
            .mapTo(mutableSetOf()) { it.groupValues[1] }

    private fun errorMessage(message: String, phase: String = "request", fatal: Boolean = false): String =
        "{\"kind\":\"error\",\"display\":\"${escape(message)}\",\"phase\":\"$phase\",\"fatal\":$fatal}"
    private fun escape(value: String): String = escapeJson(value)
}

/** Content of a JSON string literal. */
internal fun escapeJson(value: String): String = buildString {
    value.forEach { character ->
        when (character) {
            '\\' -> append("\\\\")
            '"' -> append("\\\"")
            else -> if (character.code < 32) append("\\u" + character.code.toString(16).padStart(4, '0')) else append(character)
        }
    }
}

private const val MAIN_ALIAS_PREFIX = "main__"

@OptIn(ExperimentalJsExport::class)
@JsExport
fun bluekCreateKotliteSession(): KotliteSession = KotliteSession()
