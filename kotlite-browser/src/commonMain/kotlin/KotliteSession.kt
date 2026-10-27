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
import com.sunnychung.lib.multiplatform.kotlite.error.SemanticException
import com.sunnychung.lib.multiplatform.kotlite.error.controlflow.NormalControlFlowException
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
import com.sunnychung.lib.multiplatform.kotlite.model.StandardExceptionValue
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallNode
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.ExecutionEnvironment
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.IntValue
import com.sunnychung.lib.multiplatform.kotlite.model.LongValue
import com.sunnychung.lib.multiplatform.kotlite.model.DoubleValue
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
import com.sunnychung.lib.multiplatform.kotlite.model.*
import com.sunnychung.lib.multiplatform.kotlite.stdlib.AllStdLibModules
import com.sunnychung.lib.multiplatform.kotlite.model.GenericCollectionsModule
import com.sunnychung.lib.multiplatform.kotlite.util.KotlinFileRules
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlin.js.JSON
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
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
private data class DebugAstIndex(
    val executableLines: Set<Pair<String, Int>>,
    val statements: List<ASTNode>,
    val nodes: List<ASTNode>,
)
private data class DebugInspectionRequest(
    val objectId: String,
    val propertyName: String,
    val onComplete: (String) -> Unit,
)

private val bluePlayInternalActorProperties = setOf("worldWidth", "worldHeight", "worldCellSize")

@OptIn(ExperimentalJsExport::class)
@JsExport
class KotliteSession {

    private val output = StringBuilder()
    /** Whether the terminal output so far ends with a line break (or is empty). */
    private var outputAtLineStart = true
    /** Every name a student can call; filled while the modules are installed. */
    private val knownNames: MutableSet<String> = mutableSetOf()

    /** The source of the most recent analysis, used to explain a failed one. */

    private var environment = ExecutionEnvironment()
    private lateinit var interpreter: Interpreter
    private val handles = linkedMapOf<String, RuntimeValue>()
    private val bindingNames = linkedMapOf<String, String>()
    private val references = linkedMapOf<String, BlueKReference>()
    private val managedHandles = linkedSetOf<String>()
    private val debugPinnedHandles = linkedSetOf<String>()
    // Immutable history plus semantic lifetime boundaries, never source deletion.
    private val retiredProperties = linkedMapOf<Int, MutableList<String>>()
    private val propertyNames = linkedMapOf<String, MutableList<String>>()
    private val computedPropertyNames = linkedMapOf<String, MutableSet<String>>()
    // Inspector results belong to the runtime. Snapshots never execute getters.
    private val inspectionResults = linkedMapOf<String, MutableMap<String, String>>()
    // Values already read for a visible field. Following its arrow must not run the getter again.
    private val inspectionValues = linkedMapOf<String, MutableMap<String, RuntimeValue>>()
    private var inspectionDepth = 0
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
        set(value) {
            field = value
            debugAstIndexCache = null
        }
    /** JSON objects of the `RuntimeEffect`s since the last [takeEffects]. */
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
    private var outputEscapePending = false
    private var outputInOsc = false
    private var outputOscEscapePending = false
    private val bluePlay = BluePlayEngine { path ->
        pendingEffects += "{\"type\":\"sound\",\"name\":\"resource\",\"path\":\"${escape(path)}\"}"
    }
    private val projectFunctionRanges = mutableListOf<Triple<String, Int, Int>>()
    private var debugAstIndexCache: DebugAstIndex? = null
    private var debugMode: String? = null
    private var debugPauseCallback: ((String) -> Unit)? = null
    private var debugContinuation: Continuation<Unit>? = null
    private var debugInspectionRequest: DebugInspectionRequest? = null
    private var debugTargetDepth = 0
    private var debugPausedDepth = 0
    private val debugBreakpoints = linkedSetOf<String>()
    private val mainFunctionNames = linkedMapOf<String, String>()
    // Files whose main takes `args: Array<String>`; BlueK passes an empty array (RT-96).
    private val mainArgumentFiles = mutableSetOf<String>()

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

    /**
     * Kotlite stdlib 1.1.0 also declares `Iterable<K>.associateBy(valueSelector: (K) -> V)`,
     * which is really `associateWith`. With the same parameter shape as the
     * real `associateBy` every call becomes ambiguous, so drop that overload.
     */
    private fun isUsableStdlibFunction(function: CustomFunctionDefinition): Boolean =
        !(function.functionName == "associateBy" &&
            function.parameterTypes.singleOrNull()?.name == "valueSelector")

    private val testing = BlueKTesting()
    private var fixtureSerial = 0
    fun testState(): String = testing.state()
    fun setTestCallback(callback: (() -> Unit)?) { testing.changed = callback }
    fun noteInteraction(op: String, objectId: String, name: String, source: String, result: String) {
        // Inspector refreshes are presentation-only. Their getter evaluations
        // must never become part of a replayable object-bench fixture.
        if (op == "inspectGet") return
        if (op == "bind" && references[name]?.interactive == false && testing.hasDeclaration(name)) testing.aliases[objectId] = name
        if (op == "bind" && objectId !in testing.aliases) {
            val value = handles[objectId]
            references.entries.firstOrNull { it.key != name && referenceValue(it.value) === value }?.let { testing.aliases[objectId] = it.key }
        }
        testing.note(op, objectId, name, source, result)
    }
    fun testingAction(action: String, className: String, value: String, kind: String): String = try {
        var source: String? = null
        var replacesFixture = false
        var replacesInitializers = false
        when (action) {
            "begin" -> testing.begin(className)
            "cancel" -> testing.cancel()
            "assert" -> testing.assertion(value, kind)
            "recordSource" -> source = testing.recordedSource(value)
            "fixtureSource" -> {
                replacesFixture = testing.replacesFixture(className)
                replacesInitializers = testing.replacesInitializers(className)
                source = testing.fixtureSource(className, references.filter { it.value.onBench }.map { (name, ref) ->
                    name to (referenceValue(ref)?.type()?.toTypeNode()?.descriptiveName() ?: error("Missing object $name"))
                })
            }
            else -> error("Unknown test action.")
        }
        "{\"kind\":\"unit\",\"display\":\"Unit\"" + (source?.let { ",\"generatedSource\":${JSON.stringify(it)},\"fileName\":${JSON.stringify(testing.suites[className.ifEmpty { JSON.parse<dynamic>(testing.state()).recording as String }]?.file)},\"replacesFixture\":$replacesFixture,\"replacesInitializers\":$replacesInitializers" } ?: "") + "}"
    } catch (e: Throwable) { errorMessage(e.message ?: "Test action failed.", "request") }

    fun startTests(className: String, method: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String = try {
        val driver = testing.driver(className, method)
        startEvaluateInternal("<BlueK tests>", driver, onInput, { result -> testing.complete(result.startsWith("{\"kind\":\"error\"")); onComplete(result) }, emptySet())
    } catch (e: Throwable) { errorMessage(e.message ?: "Test run failed.", "request") }

    fun startFixture(className: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String = try {
        val suite = testing.suites[className] ?: error("Unknown test class.")
        val name = "__bluek_fixture${++fixtureSerial}"
        val code = "val $name = $className()\n" + suite.before.joinToString("\n") { "$name.`${it.name}`()" }
        startEvaluateInternal("<BlueK fixture>", code, onInput, { result ->
            if (result.startsWith("{\"kind\":\"error\"")) onComplete(result)
            else {
                try {
                    val fixture = interpreter.symbolTable().findPropertyByDeclaredName(name) as ClassInstance
                    val bindings = mutableMapOf<String, String>()
                    for (property in suite.node.declarations.filterIsInstance<PropertyDeclarationNode>()) {
                        val value = fixture.readBackingPropertyByDeclaredName(property.name) ?: continue
                        if (value === NullValue || value === UnitValue) continue
                        val id = registerExpressionValue(value)
                        val bound = bind(id, property.name)
                        check(!bound.startsWith("{\"kind\":\"error\"")) { "Cannot put ${property.name} on the bench: $bound" }
                        bindings[property.name] = id
                    }
                    runCatching { testing.seedFixture(className, bindings) }.onFailure { testing.taint(it.message ?: "This fixture cannot be captured.") }
                    onComplete(result)
                } catch (e: Throwable) { onComplete(errorMessage(e.message ?: "Fixture could not be restored.", "request")) }
            }
        }, emptySet())
    } catch (e: Throwable) { errorMessage(e.message ?: "Fixture failed.", "request") }

    private fun resetInterpreter() {
        environment = ExecutionEnvironment(functionRegistrationFilter = ::isUsableStdlibFunction, sleepHandler = { millis ->
            checkCanPause(interpreter, "Thread.sleep()")
            awaitRuntimeSleep(millis)
        })
        for (name in listOf("bluekTestStart", "bluekTestFailure", "bluekTestFinish")) environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN, receiverType = null, functionName = name, returnType = "Unit",
            parameterTypes = when (name) { "bluekTestStart" -> listOf(CustomFunctionParameter("index", "Int")); "bluekTestFailure" -> listOf(CustomFunctionParameter("error", "Throwable")); else -> emptyList() },
            executable = { _, _, args, _ ->
                when (name) { "bluekTestStart" -> testing.start((args[0] as IntValue).value); "bluekTestFailure" -> testing.failure(args[0] as ClassInstance); else -> testing.finish() }
                UnitValue
            }
        ))
        val modules = AllStdLibModules { text -> appendOutput(text) }.modules +
            listOf(GenericCollectionsModule, BlueKStdlibModule)
        modules.forEach(environment::install)
        modules.filter { it.name == "Math" }.forEach { environment.installQualified(it, "kotlin.math") }
        // Names BlueK actually provides, used to tell a misspelling from an
        // unsupported piece of Kotlin. See KotlinSurfaceHints.
        knownNames.clear()
        modules.forEach { module ->
            module.functions.forEach { knownNames += it.functionName }
            module.properties.forEach { knownNames += it.declaredName }
            if (module.name == "Math") {
                module.functions.filter { it.receiverType == null }.forEach { knownNames += "kotlin.math.${it.functionName}" }
                module.globalProperties.forEach { knownNames += "kotlin.math.${it.declaredName}" }
            }
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
        if (bluePlayEnabled) {
            bluePlay.setInspectionQuery { inspectionDepth > 0 }
            bluePlay.register(environment)
        }
        interpreter = KotliteInterpreter("<BlueK>", "", environment)
        interpreter.stackFrameFormatter = ::stackFrame
        interpreter.checkpointHook = Interpreter.CheckpointHook(::runtimeCheckpointDue) { awaitRuntimeCheckpoint() }
        interpreter.stackResetHook = { awaitRuntimeStackReset() }
        installDebugStatementHook()
    }

    private fun installDebugStatementHook() {
        interpreter.debugStatementHook = { position, depth -> debugAtStatement(position, depth) }
    }

    private suspend fun debugAtStatement(position: SourcePosition, depth: Int) {
        val mode = debugMode ?: return
        if (position.filename != "<BlueK project>") return
        val source = projectFunctionRanges.firstOrNull { position.lineNum in it.second..it.third } ?: return
        val key = "${source.first}:${position.lineNum - source.second + 1}"
        val atBreakpoint = mode != "inspecting" && key in debugBreakpoints
        val shouldPause = atBreakpoint || when (mode) {
            "start", "stepIn", "pauseRequested" -> true
            "step" -> depth <= debugTargetDepth
            else -> false
        }
        if (!shouldPause) return
        debugMode = "paused"
        debugPausedDepth = depth
        val line = position.lineNum - source.second + 1
        var notifyPause = true
        while (true) {
            val visible = linkedMapOf<String, com.sunnychung.lib.multiplatform.kotlite.model.DebugStoredProperty>()
            val debugFrames = interpreter.debugCallFrames()
            val currentScopes = debugFrames.lastOrNull()?.scopes.orEmpty()
            currentScopes.forEach { scope ->
                scope.debugStoredProperties().forEach { visible[it.name] = it }
            }
            // A synthetic `init` function is the current debug frame, but its
            // receiver lives in the enclosing constructor frame. Search outward
            // through frames so constructor pauses still expose object properties.
            val receiver = debugFrames.asReversed().asSequence()
                .flatMap { it.scopes.asReversed().asSequence() }
                .flatMap { it.debugStoredProperties().asSequence() }
                .firstOrNull { it.name == "this" }
                ?.value as? ClassInstance
            val variables = debugVariablesJson(visible.values.filterNot { it.name == "this" })
            val globalDeclarations = analyzedScript?.nodes.orEmpty()
                .filterIsInstance<PropertyDeclarationNode>()
                .filter { declaration -> projectFunctionRanges.any { declaration.position.lineNum in it.second..it.third } }
                .associateBy { it.name }
            val globals = debugVariablesJson(interpreter.debugGlobalProperties()
                .filter { it.name in globalDeclarations }
                .map { it.copy(computed = globalDeclarations.getValue(it.name).accessors?.getter != null) })
            val attributes = debugVariablesJson(receiver?.debugStoredProperties().orEmpty()
                .filterNot {
                    bluePlayEnabled
                        && it.name in bluePlayInternalActorProperties
                        && receiver?.debugPropertyOwnerName(it.name) == "Actor"
                })
            val stepInAvailable = debugStepInAvailable(position)
            val receiverObjectId = receiver?.let(::debugObjectHandle)?.let { ",\"receiverObjectId\":${JSON.stringify(it)}" } ?: ""
            val payload = "{\"fileName\":${JSON.stringify(source.first)},\"line\":$line,\"column\":${position.col},\"depth\":$depth,\"stepInAvailable\":$stepInAvailable$receiverObjectId,\"variables\":$variables,\"globals\":$globals,\"attributes\":$attributes}"
            suspendCoroutine<Unit> { continuation ->
                debugContinuation = continuation
                if (notifyPause) debugPauseCallback?.invoke(payload)
            }
            debugContinuation = null
            val inspection = debugInspectionRequest ?: return
            debugInspectionRequest = null
            debugMode = "inspecting"
            val inspectSource = inspectionSource(inspection.objectId, inspection.propertyName)
            val inspected = if (inspectSource == null) {
                errorMessage("Property is no longer available.")
            } else {
                inspectionFailure = null
                inspectedPropertyValue = null
                finishInspection(
                    inspection.objectId,
                    inspection.propertyName,
                    evaluateSuspended("<BlueK inspection>", inspectSource, inspection = true),
                )
            }
            debugMode = "paused"
            inspection.onComplete(inspected)
            // Getter inspection resumes the suspended student coroutine only
            // long enough to evaluate the getter. Re-suspend at this same
            // statement without publishing another pause; otherwise the UI
            // sees a fresh pause, refreshes the inspector, and evaluates the
            // getter forever.
            notifyPause = false
        }
    }

    fun setDebugPauseCallback(callback: ((String) -> Unit)?) { debugPauseCallback = callback }

    private fun debugVariablesJson(properties: Collection<DebugStoredProperty>): String = properties.joinToString(",", "[", "]") { item ->
        val display = debugValueDisplay(item.value)
        val computed = if (item.computed) ",\"computed\":true" else ""
        val objectId = item.value?.let(::debugObjectHandle)
        "{\"name\":${JSON.stringify(item.name)},\"type\":${JSON.stringify(item.type)},\"display\":${display?.let { JSON.stringify(it) } ?: "null"},\"initialized\":${item.value != null}$computed${objectId?.let { ",\"objectId\":${JSON.stringify(it)}" } ?: ""}}"
    }

    /** Ask the active interactive execution to pause at its next safe project statement. */
    fun requestDebugPause(): String {
        if (executionCompleted == null) return errorMessage("There is no active execution to pause.", "request")
        if (debugMode == "paused" || debugMode == "pauseRequested") return errorMessage("A debugger pause is already active or requested.", "request")
        debugMode = "pauseRequested"
        installDebugStatementHook()
        return result("unit", UnitValue)
    }

    fun setDebugBreakpoint(fileName: String, line: Int, enabled: Boolean): String {
        if (line < 1 || projectFunctionRanges.none { it.first == fileName }) return errorMessage("Breakpoint file or line is not in the current project.", "request")
        if (enabled && (fileName to line) !in debugExecutableLines()) {
            return errorMessage("A breakpoint can only be set on an executable statement.", "request")
        }
        val key = "$fileName:$line"
        if (enabled) debugBreakpoints += key else debugBreakpoints -= key
        return result("unit", UnitValue)
    }

    /** Lines and AST statements where Kotlite's statement hook can stop. */
    private fun debugAstIndex(): DebugAstIndex {
        debugAstIndexCache?.let { return it }
        val positions = linkedSetOf<SourcePosition>()
        val statements = mutableListOf<ASTNode>()
        val nodes = mutableListOf<ASTNode>()
        fun visit(node: ASTNode?) {
            if (node == null) return
            nodes += node
            when (node) {
                is ScriptNode -> node.nodes.forEach(::visit)
                is BlockNode -> node.statements.forEach { statement ->
                    positions += statement.position
                    statements += statement
                    visit(statement)
                }
                is ClassSecondaryConstructorNode -> {
                    node.delegationArguments.orEmpty().forEach(::visit)
                    visit(node.body)
                }
                is FunctionDeclarationNode -> {
                    node.valueParameters.forEach(::visit)
                    visit(node.body)
                }
                is ClassDeclarationNode -> {
                    node.primaryConstructor?.let(::visit)
                    node.superInvocations.orEmpty().forEach(::visit)
                    node.declarations.forEach { declaration ->
                        if (declaration is PropertyDeclarationNode && declaration.initialValue != null) {
                            positions += declaration.position
                        }
                        visit(declaration)
                    }
                    node.enumEntries.forEach(::visit)
                    visit(node.companionObject)
                    node.nestedClasses.forEach(::visit)
                }
                is ClassPrimaryConstructorNode -> node.parameters.forEach { parameter ->
                    if (parameter.isProperty) {
                        positions += parameter.position
                        statements += parameter
                    }
                    visit(parameter)
                }
                is ClassParameterNode -> visit(node.parameter)
                is ClassInstanceInitializerNode -> visit(node.block)
                is PropertyDeclarationNode -> {
                    if (node.initialValue != null) {
                        positions += node.position
                        statements += node
                    }
                    visit(node.initialValue)
                    visit(node.accessors)
                }
                is PropertyAccessorsNode -> {
                    visit(node.getter)
                    visit(node.setter)
                }
                is IfNode -> { visit(node.condition); visit(node.trueBlock); visit(node.falseBlock) }
                is WhileNode -> { statements += node; visit(node.condition); visit(node.body) }
                is DoWhileNode -> { statements += node; visit(node.body); visit(node.condition) }
                is ForNode -> { statements += node; visit(node.subject); visit(node.body) }
                is TryNode -> {
                    visit(node.mainBlock)
                    node.catchBlocks.forEach(::visit)
                    visit(node.finallyBlock)
                }
                is CatchNode -> visit(node.block)
                is WhenNode -> { visit(node.subject); node.entries.forEach(::visit) }
                is WhenEntryNode -> { node.conditions.forEach(::visit); visit(node.body) }
                is WhenConditionNode -> visit(node.expression)
                is WhenSubjectNode -> visit(node.value)
                is LambdaLiteralNode -> visit(node.body)
                is FunctionCallNode -> {
                    visit(node.function)
                    node.arguments.forEach(::visit)
                    visit(node.resolvedInvoke)
                }
                is FunctionCallArgumentNode -> visit(node.value)
                is AssignmentNode -> { visit(node.subject); visit(node.value) }
                is BinaryOpNode -> { visit(node.node1); visit(node.node2) }
                is UnaryOpNode -> visit(node.node)
                is NavigationNode -> visit(node.subject)
                is IndexOpNode -> { visit(node.subject); node.arguments.forEach(::visit) }
                is ReturnNode -> visit(node.value)
                is ThrowNode -> visit(node.value)
                is AsOpNode -> visit(node.expression)
                is InfixFunctionCallNode -> { visit(node.node1); visit(node.node2) }
                is ElvisOpNode -> { visit(node.primaryNode); visit(node.fallbackNode) }
                is StringNode -> node.nodes.forEach(::visit)
                is EnumEntryNode -> node.arguments.forEach(::visit)
                is DestructuringDeclarationNode -> node.statements.forEach(::visit)
                is FunctionValueParameterNode -> visit(node.defaultValue)
                is ValueParameterDeclarationNode, is TypeNode, is TypeParameterNode,
                is VariableReferenceNode, is ClassMemberReferenceNode, is IntegerNode,
                is LongNode, is DoubleNode, is BooleanNode, is NullNode, is ValueNode,
                is StringLiteralNode, is CharNode, is LabelNode, is BreakNode, is ContinueNode -> Unit
            }
        }
        visit(analyzedScript)
        val executableLines = positions.mapNotNull { position ->
            projectFunctionRanges.firstOrNull { position.lineNum in it.second..it.third }
                ?.let { it.first to (position.lineNum - it.second + 1) }
        }.toSet()
        return DebugAstIndex(executableLines, statements, nodes).also { debugAstIndexCache = it }
    }

    /** Lines where Kotlite's statement hook can stop, derived directly from its analyzed AST. */
    private fun debugExecutableLines(): Set<Pair<String, Int>> = debugAstIndex().executableLines

    /** Make a paused object value available to the passive object inspector. */
    private fun debugObjectHandle(value: RuntimeValue): String? {
        if (value !is ClassInstance) return null
        return pinDebugInspectionValue(value)
    }

    private fun pinDebugInspectionValue(value: RuntimeValue): String {
        // A debugger-local object is already available through its suspended
        // call frame. Do not create a synthetic REPL binding for it: that
        // binding would belong to the local frame, but normal handle cleanup
        // runs after the frame has been popped and would try to retire it from
        // the global symbol table.
        val id = handles.entries.firstOrNull { it.value === value }?.key ?: "object-${nextHandle++}".also {
            handles[it] = value
        }
        managedHandles += id
        debugPinnedHandles += id
        return id
    }

    /** Step in only helps when this statement can enter code defined by the project. */
    private fun debugStepInAvailable(position: SourcePosition): Boolean {
        val index = debugAstIndex()
        val fileName = projectFunctionRanges.firstOrNull { position.lineNum in it.second..it.third }?.first
            ?: return false
        val projectPosition: (SourcePosition) -> Boolean = { candidate ->
            projectFunctionRanges.any { candidate.lineNum in it.second..it.third }
        }
        val projectFunctions = index.nodes.filterIsInstance<FunctionDeclarationNode>()
            .filter { projectPosition(it.position) }
            .mapNotNull { it.transformedRefName }
            .toSet()
        val projectClasses = index.nodes.filterIsInstance<ClassDeclarationNode>()
            .filter { projectPosition(it.position) }
            .map { it.fullQualifiedName }
            .toSet()
        val projectProperties = index.nodes.filterIsInstance<PropertyDeclarationNode>()
            .filter { projectPosition(it.position) }
            .mapNotNull { it.transformedRefName }
            .toSet()
        val projectGetters = index.nodes.filterIsInstance<PropertyDeclarationNode>()
            .filter { projectPosition(it.position) && it.accessors?.getter != null }
            .map { it.name }
            .toSet()

        fun projectCall(call: FunctionCallNode): Boolean = when (call.callableType) {
            CallableType.Function, CallableType.ClassMemberFunction, CallableType.ExtensionFunction ->
                call.functionRefName in projectFunctions
            CallableType.Constructor -> call.functionRefName in projectClasses
            CallableType.Property -> call.functionRefName in projectProperties
            null -> false
        }

        fun containsProjectCall(node: ASTNode?, inCallback: Boolean = false): Boolean {
            if (node == null) return false
            return when (node) {
                is FunctionCallNode -> projectCall(node) ||
                    containsProjectCall(node.function, inCallback) ||
                    node.arguments.any { containsProjectCall(it.value, true) } ||
                    containsProjectCall(node.resolvedInvoke, inCallback)
                is FunctionCallArgumentNode -> containsProjectCall(node.value, inCallback)
                is LambdaLiteralNode -> inCallback && node.body.statements.any { containsProjectCall(it, true) }
                is PropertyDeclarationNode -> containsProjectCall(node.initialValue, inCallback)
                is AssignmentNode -> containsProjectCall(node.wholeFunctionCall, inCallback) ||
                    containsProjectCall(node.preAssignFunctionCall, inCallback) ||
                    containsProjectCall(node.assignFunctionCall, inCallback) ||
                    containsProjectCall(node.subject, inCallback) || containsProjectCall(node.value, inCallback)
                is BinaryOpNode -> containsProjectCall(node.call, inCallback) ||
                    containsProjectCall(node.node1, inCallback) || containsProjectCall(node.node2, inCallback)
                is UnaryOpNode -> containsProjectCall(node.assignFunctionCall, inCallback) ||
                    containsProjectCall(node.node, inCallback)
                is NavigationNode -> node.member.name in projectGetters || containsProjectCall(node.subject, inCallback)
                is IndexOpNode -> containsProjectCall(node.call, inCallback) ||
                    containsProjectCall(node.subject, inCallback) || node.arguments.any { containsProjectCall(it, inCallback) }
                is InfixFunctionCallNode -> containsProjectCall(node.call, inCallback) ||
                    containsProjectCall(node.node1, inCallback) || containsProjectCall(node.node2, inCallback)
                is ReturnNode -> containsProjectCall(node.value, inCallback)
                is ThrowNode -> containsProjectCall(node.value, inCallback)
                is AsOpNode -> containsProjectCall(node.expression, inCallback)
                is IfNode -> containsProjectCall(node.condition, inCallback)
                is WhileNode -> containsProjectCall(node.condition, inCallback)
                is ForNode -> containsProjectCall(node.subject, inCallback)
                is DoWhileNode -> false // The body reaches its next statement boundary before the condition.
                is WhenNode -> containsProjectCall(node.subject, inCallback) || node.entries.any { entry ->
                    entry.conditions.any { containsProjectCall(it, inCallback) }
                }
                is WhenSubjectNode -> containsProjectCall(node.value, inCallback)
                is WhenEntryNode -> node.conditions.any { containsProjectCall(it, inCallback) }
                is WhenConditionNode -> containsProjectCall(node.call, inCallback) || containsProjectCall(node.expression, inCallback)
                is ElvisOpNode -> containsProjectCall(node.primaryNode, inCallback) || containsProjectCall(node.fallbackNode, inCallback)
                is StringNode -> node.nodes.any { containsProjectCall(it, inCallback) }
                else -> false
            }
        }

        val statement = index.statements.firstOrNull { it.position == position } ?: return false
        return fileName.isNotEmpty() && containsProjectCall(statement)
    }

    /** Format only primitive payloads and runtime type metadata; never call student code. */
    private fun debugValueDisplay(value: RuntimeValue?): String? = when (value) {
        null -> null
        NullValue -> "null"
        UnitValue -> "Unit"
        is IntValue -> value.value.toString()
        is LongValue -> value.value.toString()
        is DoubleValue -> value.value.toString()
        is BooleanValue -> value.value.toString()
        is StringValue -> {
            val truncated = value.value.length > 160
            val content = if (truncated) value.value.take(160) + "…" else value.value
            buildString {
                append('"')
                content.forEach { character ->
                    append(when (character) {
                        '\\' -> "\\\\"
                        '"' -> "\\\""
                        '\n' -> "\\n"
                        '\r' -> "\\r"
                        '\t' -> "\\t"
                        else -> character.toString()
                    })
                }
                append('"')
            }
        }
        is com.sunnychung.lib.multiplatform.kotlite.model.CharValue -> value.value.toString()
        else -> "(${value.type().descriptiveName})"
    }

    /** Resume the exact suspended student coroutine at its current debug pause. */
    fun resumeDebug(action: String): String {
        val continuation = debugContinuation ?: return errorMessage("There is no active debugger pause.", "request")
        if (debugMode != "paused") return errorMessage("The debugger pause is no longer active.", "request")
        debugMode = when (action) {
            "step" -> "step".also { debugTargetDepth = debugPausedDepth }
            "stepIn" -> "stepIn"
            "continue" -> "continue"
            else -> return errorMessage("Unknown debugger action.", "request")
        }
        debugContinuation = null
        continuation.resume(Unit)
        return result("unit", UnitValue)
    }

    /** Evaluate one explicitly requested getter inside the paused interpreter coroutine. */
    fun startDebugInspectGet(objectId: String, propertyName: String, onComplete: (String) -> Unit): String {
        if (debugMode != "paused") return errorMessage("The debugger is not paused.", "request")
        val continuation = debugContinuation ?: return errorMessage("There is no active debugger pause.", "request")
        if (debugInspectionRequest != null) return errorMessage("A getter is already being evaluated.", "request")
        if (inspectionSource(objectId, propertyName) == null) return errorMessage("Property is no longer available.", "request")
        debugInspectionRequest = DebugInspectionRequest(objectId, propertyName, onComplete)
        debugContinuation = null
        continuation.resume(Unit)
        return result("started", UnitValue)
    }

    /** Read scheduler state from its owner; no duplicate simulation state lives here. */
    fun setBluePlayRunningQuery(query: () -> Boolean) = bluePlay.setRunningQuery(query)

    fun takeBluePlayIntent(): String = bluePlay.takeIntent()

    fun setBluePlaySpeed(value: Int): String {
        bluePlay.setSpeed(value)
        return result("unit", UnitValue)
    }

    /** The speed the scheduler waits for, also when student code called `setSpeed()`. */
    fun bluePlaySpeed(): Int = bluePlay.speed

    /** Run one native-scheduled step without creating a Codepad history item. */
    fun startBluePlayStep(onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        if (!bluePlay.hasShownWorld) return errorMessage("No BluePlay world has been shown yet.")
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        // Keep normal BluePlay ticks on the existing fast path unless the user
        // has armed a breakpoint or requested a pause. Reinstall the hook when
        // Pause is requested while a tick is running.
        if (debugMode == null && debugBreakpoints.isNotEmpty()) debugMode = "continue"
        val debuggerActiveForStep = debugMode != null
        if (!debuggerActiveForStep) interpreter.debugStatementHook = null
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
                    reportUncaught(throwable)
                    error(throwable, "runtime", throwable.isFatal)
                }
                try {
                    executionCompleted?.invoke(response)
                } finally {
                    executionCompleted = null
                    debugMode = null
                    debugPauseCallback = null
                    if (!debuggerActiveForStep) installDebugStatementHook()
                }
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
            // Called by BluePlay Reset: no frame of the student's source below main() in stack traces.
            val call = FunctionCallNode(VariableReferenceNode(main.position, main.name), emptyList(), emptyList(), SourcePosition.BUILTIN)
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
                    reportUncaught(throwable)
                    error(throwable, "runtime", throwable.isFatal)
                }
                executionCompleted?.invoke(response)
                executionCompleted = null
            }
        })
        return result("started", UnitValue)
    }

    /** Preserve BlueJ's form-feed terminal clear semantics for the UI. */
    private fun appendOutput(text: String) {
        repeat(countTerminalBells(text)) {
            pendingEffects += "{\"type\":\"sound\",\"name\":\"terminalBell\"}"
        }
        val clearIndex = text.lastIndexOf('\u000C')
        if (clearIndex >= 0) {
            output.clear()
            output.append('\u000C')
            output.append(text.substring(clearIndex + 1))
        } else {
            output.append(text)
        }
        if (text.isNotEmpty()) outputAtLineStart = text.last() == '\n' || text.last() == '\u000C'
        outputUpdated?.invoke()
    }

    /** Count BEL characters outside OSC sequences, where BEL closes OSC (including kitty text). */
    private fun countTerminalBells(text: String): Int {
        var bells = 0
        for (char in text) {
            if (outputInOsc) {
                if (outputOscEscapePending && char == '\\') {
                    outputInOsc = false
                    outputOscEscapePending = false
                } else if (char == '\u0007') {
                    outputInOsc = false
                    outputOscEscapePending = false
                } else {
                    outputOscEscapePending = char == '\u001B'
                }
            } else if (outputEscapePending) {
                outputInOsc = char == ']'
                outputEscapePending = char == '\u001B'
                if (outputInOsc) outputOscEscapePending = false
            } else if (char == '\u001B') {
                outputEscapePending = true
            } else if (char == '\u0007') {
                bells++
            }
        }
        return bells
    }

    /**
     * An exception that ends a program run (main, BluePlay) is printed to the terminal like Kotlin
     * does, in red: `Exception in thread "main" IllegalStateException: x` and the stack trace.
     */
    private fun reportUncaught(error: Throwable) {
        if (error.isFatal) return
        appendOutput(buildString {
            if (!outputAtLineStart) append('\n')
            append("\u001B[31mException in thread \"main\" ")
            append(errorText(error))
            append('\n')
            interpreter.stacktraceOf(error).forEach { append("    at "); append(it); append('\n') }
            append("\u001B[0m")
        })
    }

    fun setOutputCallback(callback: (() -> Unit)?) {
        outputUpdated = callback
    }

    private fun parse(filename: String, source: String): ScriptNode =
        Parser(Lexer(filename = filename, code = source)).script()

    /** Syntax-only file classification for project presentation and editing.
     * An incomplete source is deliberately unknown, not guessed from text. */
    fun classifyProjectFile(filename: String, source: String): String {
        val script = try { parse(filename, source) } catch (_: Throwable) {
            return "{\"kind\":\"unknown\"}"
        }
        val classes = script.nodes.filterIsInstance<ClassDeclarationNode>().filter { it.outerClassName == null }
        val functions = script.nodes.filterIsInstance<FunctionDeclarationNode>()
        val properties = script.nodes.filterIsInstance<PropertyDeclarationNode>()
        val kind = when {
            classes.size > 1 || (classes.isNotEmpty() && (functions.isNotEmpty() || properties.isNotEmpty())) -> "mixed"
            classes.size == 1 -> "class"
            functions.isNotEmpty() || properties.isNotEmpty() -> "functions"
            else -> "unknown"
        }
        val name = classes.singleOrNull()?.name
        val nameFrom = classes.singleOrNull()?.namePosition?.index
        return "{\"kind\":\"$kind\"" + (name?.let { ",\"className\":${JSON.stringify(it)}" } ?: "") + (nameFrom?.let { ",\"classNameFrom\":$it" } ?: "") + "}"
    }

    /** Resolve class and constructor references without executing any project code. */
    fun classRenameReferences(filenames: Array<String>, sources: Array<String>, className: String, withBluePlay: Boolean): String {
        if (filenames.size != sources.size) return "{\"error\":\"Project filenames and sources must match.\"}"
        val analysis = KotliteSession()
        analysis.configureBluePlay(withBluePlay)
        val prefix = if (withBluePlay) BluePlayLibrary.source + "\n\n" else ""
        val combined = buildString {
            append(prefix)
            filenames.indices.forEach { index ->
                if (index > 0) append("\n\n")
                append("// BlueK file: ${filenames[index]}\n")
                append(sources[index])
            }
        }
        val regions = mutableListOf<Triple<String, Int, Int>>()
        var cursor = prefix.length
        filenames.indices.forEach { index ->
            if (index > 0) cursor += 2
            cursor += "// BlueK file: ${filenames[index]}\n".length
            regions += Triple(filenames[index], cursor, cursor + sources[index].length)
            cursor += sources[index].length
        }
        return try {
            val units = regions.drop(1).map { it.second }
            val script = ReplAnalyzer.analyze("<BlueK class rename>", combined, analysis.environment, emptyMap(), units)
            analysis.analyzedScript = script
            val target = script.nodes.filterIsInstance<ClassDeclarationNode>()
                .firstOrNull { it.outerClassName == null && it.name == className }
                ?: return "{\"error\":${JSON.stringify("Class `$className` could not be resolved.")}}"
            val positions = linkedSetOf<Int>()
            fun collect(node: ASTNode?) {
                if (node == null) return
                when (node) {
                    is TypeNode -> {
                        if (node.resolvedClassName == target.fullQualifiedName) positions += node.position.index
                        node.arguments.orEmpty().forEach(::collect)
                    }
                    is VariableReferenceNode -> {
                        if (node.resolvedClassName == target.fullQualifiedName) positions += node.position.index
                    }
                    is ClassMemberReferenceNode -> Unit
                    is FunctionCallNode -> {
                        if (node.resolvedClassName == target.fullQualifiedName) positions += node.function.position.index
                        collect(node.function)
                        node.arguments.forEach(::collect)
                        node.declaredTypeArguments.forEach(::collect)
                        collect(node.resolvedInvoke)
                    }
                    is ScriptNode -> node.nodes.forEach(::collect)
                    is ClassDeclarationNode -> {
                        node.typeParameters.forEach(::collect)
                        node.primaryConstructor?.let(::collect)
                        node.superInvocations.orEmpty().forEach(::collect)
                        node.declarations.forEach(::collect)
                        node.enumEntries.forEach(::collect)
                        collect(node.companionObject)
                        node.nestedClasses.forEach(::collect)
                    }
                    is FunctionDeclarationNode -> {
                        node.receiver?.let(::collect); node.valueParameters.forEach(::collect)
                        node.typeParameters.forEach(::collect); node.extraTypeParameters.forEach(::collect)
                        node.declaredReturnType?.let(::collect); collect(node.body)
                    }
                    is PropertyDeclarationNode -> {
                        node.receiver?.let(::collect); node.declaredType?.let(::collect)
                        collect(node.initialValue); collect(node.accessors)
                    }
                    is FunctionValueParameterNode -> { node.declaredType?.let(::collect); node.defaultValue?.let(::collect) }
                    is TypeParameterNode -> node.typeUpperBound?.let(::collect)
                    is ClassPrimaryConstructorNode -> node.parameters.forEach(::collect)
                    is ClassParameterNode -> collect(node.parameter)
                    is BlockNode -> node.statements.forEach(::collect)
                    is ClassSecondaryConstructorNode -> { node.delegationArguments.orEmpty().forEach(::collect); collect(node.body) }
                    is ClassInstanceInitializerNode -> collect(node.block)
                    is PropertyAccessorsNode -> { collect(node.getter); collect(node.setter) }
                    is IfNode -> { collect(node.condition); collect(node.trueBlock); collect(node.falseBlock) }
                    is WhileNode -> { collect(node.condition); collect(node.body) }
                    is DoWhileNode -> { collect(node.body); collect(node.condition) }
                    is ForNode -> { collect(node.subject); collect(node.body) }
                    is TryNode -> { collect(node.mainBlock); node.catchBlocks.forEach(::collect); collect(node.finallyBlock) }
                    is CatchNode -> collect(node.block)
                    is WhenNode -> { collect(node.subject); node.entries.forEach(::collect) }
                    is WhenEntryNode -> { node.conditions.forEach(::collect); collect(node.body) }
                    is WhenConditionNode -> collect(node.expression)
                    is WhenSubjectNode -> collect(node.value)
                    is LambdaLiteralNode -> collect(node.body)
                    is FunctionCallArgumentNode -> collect(node.value)
                    is AssignmentNode -> { collect(node.subject); collect(node.value) }
                    is BinaryOpNode -> { collect(node.node1); collect(node.node2) }
                    is UnaryOpNode -> collect(node.node)
                    is NavigationNode -> { collect(node.subject); collect(node.member) }
                    is IndexOpNode -> { collect(node.subject); node.arguments.forEach(::collect) }
                    is ReturnNode -> collect(node.value)
                    is ThrowNode -> collect(node.value)
                    is AsOpNode -> { collect(node.expression); collect(node.type) }
                    is InfixFunctionCallNode -> { collect(node.node1); collect(node.node2) }
                    is ElvisOpNode -> { collect(node.primaryNode); collect(node.fallbackNode) }
                    is StringNode -> node.nodes.forEach(::collect)
                    is EnumEntryNode -> node.arguments.forEach(::collect)
                    is DestructuringDeclarationNode -> node.statements.forEach(::collect)
                    is ValueParameterDeclarationNode, is IntegerNode, is LongNode, is DoubleNode,
                    is BooleanNode, is NullNode, is ValueNode, is StringLiteralNode, is CharNode,
                    is LabelNode, is BreakNode, is ContinueNode -> Unit
                }
            }
            collect(script)
            val edits = positions.mapNotNull { position ->
                val region = regions.firstOrNull { position >= it.second && position + className.length <= it.third } ?: return@mapNotNull null
                "{\"fileName\":${JSON.stringify(region.first)},\"from\":${position - region.second},\"to\":${position - region.second + className.length}}"
            }
            "{\"references\":${edits.joinToString(",", "[", "]")}}"
        } catch (error: Throwable) {
            "{\"error\":${JSON.stringify(error.message ?: "Could not resolve class references.")}}"
        }
    }

    fun load(filename: String, source: String): String = evaluate(filename, source)

    /** Project files explicitly marked as test classes can also store object-bench states before they contain tests. */
    fun setTestClassFiles(filenames: Array<String>) {
        testing.setTestClassFiles(filenames.toSet())
    }

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
            return errorMessage("BluePlay supplies World.kt, Actor.kt, Image.kt and BluePlayFunctions.kt as a built-in library. Remove the BluePlay library source files from this project.", "analysis")
        }
        val mainFiles = mutableListOf<String>()
        mainArgumentFiles.clear()
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
            try {
                testing.load(filename, sources[index], script)?.let { return projectError(filename, 1, 1, it) }
            } catch (e: Throwable) { return projectError(filename, 1, 1, e.message ?: "Invalid test declaration.") }
            // The browser runtime provides the Kotlin language and standard
            // library, but no JVM libraries such as java.time or javax.swing.
            script.imports.firstOrNull { !it.path.startsWith("kotlin.") }?.let { import ->
                return projectError(filename, import.position.lineNum, import.position.col,
                    "Import `${import.path}` is not available in BlueK: Kotlin runs in the browser without JVM libraries (java.*, javax.*).")
            }
            // Nested classes belong to their outer class (RT-91).
            val classDeclarations = script.nodes.filterIsInstance<ClassDeclarationNode>().filter { it.outerClassName == null }
            if (classDeclarations.isNotEmpty()) {
                // BlueJ presents one class per source file. A file without a
                // class may still contain any number of top-level functions
                // and properties, but a class cannot be mixed with them (or
                // with another class).
                val conflictingNode = script.nodes.firstOrNull { node ->
                    (node !is ClassDeclarationNode || node !== classDeclarations.first()) && (node as? ClassDeclarationNode)?.outerClassName == null
                }
                if (conflictingNode != null) {
                    val position = statementPosition(conflictingNode)
                    return projectError(filename, position.lineNum, position.col,
                        "BlueK requires separate files for a class and top-level functions or properties, and allows only one class per file. Kotlin itself allows these declarations in the same file.")
                }
            }
            val main = script.nodes.firstOrNull { it is FunctionDeclarationNode && it.name == "main" } as FunctionDeclarationNode?
            if (main != null) mainFiles += filename
            if (main?.valueParameters?.size == 1) mainArgumentFiles += filename
            val statement = script.nodes.firstOrNull {
                it !is ClassDeclarationNode && it !is FunctionDeclarationNode && it !is PropertyDeclarationNode
            }
            if (statement != null) {
                val position = statementPosition(statement)
                return projectError(filename, position.lineNum, position.col,
                    "Only declarations are allowed at the top level of a Kotlin project file. Move this statement into a function or run it in the Codepad.")
            }
            KotlinFileRules.initializationError(script)?.let { (position, message) ->
                return projectError(filename, position.lineNum, position.col, message)
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
                // The primary constructor and the secondary ones (RT-83), as the analyzer offers them.
                val secondary = declaration.declarations.filterIsInstance<ClassSecondaryConstructorNode>()
                val primary = declaration.primaryConstructor?.parameters?.filterNot { it.isOuterObject() }?.map { it.parameter }
                    ?: if (secondary.isEmpty()) emptyList() else null
                val parameterSets = listOfNotNull(primary?.let { "" to it }) +
                    secondary.mapIndexed { index, constructor -> ".$index" to constructor.valueParameters }
                parameterSets.joinToString(",", "[", "]") { (suffix, parameters) ->
                    "{\"id\":\"${escape(declaration.name)}.constructor$suffix\",\"parameters\":${parameters.joinToString(",", "[", "]") { parameterJson(it) }}}"
                }
            }
            val primaryProperties = declaration.primaryConstructor?.parameters.orEmpty().filter { it.isProperty && !it.isOuterObject() }.map { parameter ->
                jsonProperty(declaration.name, parameter.parameter.name, parameter.parameter.type, parameter.isMutable, visibility(parameter.modifiers.toSet()), false, false, false)
            }
            val bodyProperties = declaration.declarations.filterIsInstance<PropertyDeclarationNode>().map { property ->
                jsonProperty(declaration.name, property.name, property.type, property.isMutable, visibility(property.modifiers), property.accessors?.getter != null, property.accessors?.setter != null, property.accessors?.setterIsPrivate == true)
            }
            val properties = (primaryProperties + bodyProperties).filterNot { bluePlayEnabled && declaration.name in setOf("World", "Actor", "Image") && it.contains("\"visibility\":\"private\"") }.distinctBy { it.substringBefore("\",\"name\":") }.joinToString(",", "[", "]")
            val methods = declaration.declarations.filterIsInstance<FunctionDeclarationNode>().filterNot { it is ClassSecondaryConstructorNode || it.isGenerated || (bluePlayEnabled && declaration.name in setOf("World", "Actor", "Image") && it.modifiers.any { modifier -> modifier.name == "private" }) }.mapIndexed { index, function -> jsonFunction(declaration.name, function, index) }.joinToString(",", "[", "]")
            // Every enum class is `Comparable` (RT-84); like the generated members, that is not shown.
            val supers = declaration.superInvocations.orEmpty().mapNotNull(::superName)
                .filterNot { isEnum && it == "Comparable" }
                .joinToString(",", "[", "]") { jsonTypeName(it) }
            val kind = if (declaration.isInterface) "interface" else if (declaration.isObject) "object" else if (isEnum) "enum" else if (declaration.modifiers.any { it.name == "abstract" }) "abstract" else "class"
            // Called as `Klasse.f()` from the class menu, like the methods of an object.
            val companionMethods = declaration.companionObject?.declarations.orEmpty().filterIsInstance<FunctionDeclarationNode>()
                .filterNot { it.modifiers.any { modifier -> modifier.name == "private" } }
                .mapIndexed { index, function -> jsonFunction("${declaration.name}.Companion", function, index) }
            val typeParameters = declaration.typeParameters.joinToString(",", "[", "]") { parameter -> "\"${escape(parameter.name)}\"" }
            "{\"id\":\"${escape(declaration.name)}\",\"name\":\"${escape(declaration.name)}\",\"kind\":\"$kind\",\"modifiers\":${declaration.modifiers.joinToString(",", "[", "]") { modifier -> "\"${modifier.name}\"" }},\"typeParameters\":$typeParameters,\"supertypes\":$supers,\"constructors\":$constructors,\"properties\":$properties,\"methods\":$methods${if (companionMethods.isEmpty()) "" else ",\"companionMethods\":${companionMethods.joinToString(",", "[", "]")}"}${testing.metadata(declaration.name)}${if (bluePlayEnabled && declaration.name in setOf("World", "Actor", "Image")) ",\"builtin\":true" else ""}}"
        }
        val functionJson = functions.mapIndexed { index, function ->
            val sourceFile = projectFunctionRanges.firstOrNull { function.position.lineNum in it.second..it.third }?.first
            jsonFunction("<top-level>", function, index, sourceFile, sourceFile == null && bluePlayEnabled)
        }.joinToString(",", "[", "]")
        "{\"version\":1,\"classes\":$classJson,\"functions\":$functionJson${if (bluePlayEnabled) ",\"library\":{\"id\":\"blueplay\",\"version\":1}" else ""}}"
    } catch (error: Throwable) {
        "{\"version\":1,\"classes\":[],\"error\":\"${escape(error.message ?: "Could not create Kotlite manifest.")}\"}"
    }

    /** The hidden constructor property of an inner class for its outer object (RT-92). */
    private fun com.sunnychung.lib.multiplatform.kotlite.model.ClassParameterNode.isOuterObject() = parameter.name.startsWith("this/")

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
    private suspend fun evaluateSuspended(filename: String, source: String, interactiveNames: Set<String> = emptySet(), unitOffsets: List<Int> = emptyList(), inspection: Boolean = false, program: Boolean = false): String {
        if (faulted) return errorMessage("Runtime failed. Reset or compile before running more code.", "runtime", true)
        val boundary = analysisSource.length + 1
        val candidate = analysisSource + "\n" + source
        val units = listOf(boundary) + unitOffsets.map { boundary + it }
        val analyzed = try {
            ReplAnalyzer.analyze("<BlueK project>", candidate, environment, retiredProperties, sourceUnitStarts + units)
        } catch (error: Throwable) {
            return error(error, "analysis")
        }
        if (inspection) inspectionDepth += 1
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
            var objectId = if (value !== UnitValue && !inspection) registerExpressionValue(value) else null
            reconcileReferences()
            // A fresh expression may return the value it just detached (e.g.
            // list.removeAt). Its old history handles stay invalid, but this
            // new result is transferable under a fresh provisional handle.
            if (objectId != null && objectId !in handles) objectId = registerExpressionValue(value)
            // Only a direct read of a user binding suggests its name. A method
            // result may share its identity, but has no directly used name.
            val reference = newNodes.lastOrNull() as? VariableReferenceNode
            val resultName = reference?.variableName?.takeIf {
                objectId != null && !inspection && references[it]?.symbol == reference.transformedRefName
            }
            result("value", value, objectId, name = resultName)
        } catch (error: Throwable) {
            faulted = error.isFatal
            if (program) reportUncaught(error)
            error(error, "runtime", faulted)
        } finally {
            if (inspection) inspectionDepth -= 1
        }
    }

    /** Starts one execution and returns before input waits or Thread.sleep. */
    fun startEvaluate(filename: String, source: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        return startEvaluateInternal(filename, source, onInput, onComplete, emptySet(), debugEligible = true)
    }

    /** Runs the main() of [filename]; an uncaught exception also goes to the terminal (RT-82). */
    fun startMain(filename: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        val arguments = if (filename in mainArgumentFiles) "emptyArray<String>()" else ""
        return startEvaluateInternal(filename, "${mainFunctionName(filename)}($arguments)", onInput, onComplete, emptySet(), program = true, debugEligible = true)
    }

    private fun startEvaluateInternal(filename: String, source: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit, interactiveNames: Set<String>, unitOffsets: List<Int> = emptyList(), inspection: Boolean = false, program: Boolean = false, debugEligible: Boolean = false): String {
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        if (debugEligible && debugMode == null) debugMode = "continue"
        inputRequested = onInput
        executionCompleted = onComplete
        restartRuntimeSlice()
        (suspend { evaluateSuspended(filename, source, interactiveNames, unitOffsets, inspection, program) }).startCoroutine(object : Continuation<String> {
            override val context = kotlin.coroutines.EmptyCoroutineContext
            override fun resumeWith(result: Result<String>) {
                inputContinuation = null
                inputRequested = null
                debugContinuation = null
                if (debugEligible) {
                    debugPinnedHandles.clear()
                    reconcileReferences()
                }
                executionCompleted?.invoke(result.getOrElse { error(it, "runtime", true) })
                executionCompleted = null
                debugMode = null
                debugPauseCallback = null
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
            else if (id in debugPinnedHandles) Unit
            else if (id in managedHandles) {
                bindingNames.remove(id)?.let(::retire)
                handles.remove(id)
                managedHandles.remove(id)
                inspectionResults.remove(id)
                inspectionValues.remove(id)
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
            declaration.primaryConstructor?.parameters.orEmpty().filter { it.isProperty && !it.isOuterObject() }.forEach { parameter ->
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
        }, setOf(requestedName), debugEligible = true)
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
        if (value !is ClassInstance) return result("value", value, objectId, inspection = true)
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
                if (cached != null && inspectionValues[objectId]?.get(name) === member) return@joinToString cached
                val display = member?.let(::inspectorDisplay) ?: "<uninitialized>"
                val reference = member is ClassInstance && member !is DelegatedValue<*>
                val summary = isInspectorSummary(member)
                val inspectable = member != null && member !== NullValue
                "{\"name\":\"${escape(name)}\",\"value\":\"${escape(display)}\",\"type\":${member?.let { jsonType(it.type().toTypeNode()) } ?: "null"},\"setterPrivate\":$setterPrivate,\"reference\":$reference,\"summary\":$summary,\"inspectable\":$inspectable,\"defaultObjectDisplay\":${usesDefaultObjectDisplay(member, passive = true)}}"
            }
        }
        return "{\"kind\":\"inspect\",\"objectId\":\"${escape(objectId)}\",\"className\":\"${escape(value.type().toTypeNode().descriptiveName())}\",\"fields\":$fields}"
    }

    /** Follow the shown value, including scalars, without running its getter or toString(). */
    fun inspectField(objectId: String, propertyName: String): String = inspectField(objectId, propertyName, reconcile = true)

    /** Follow an object value captured from a paused local without reconciling live locals as global roots. */
    fun inspectDebugField(objectId: String, propertyName: String): String = inspectField(objectId, propertyName, reconcile = false)

    private fun inspectField(objectId: String, propertyName: String, reconcile: Boolean): String {
        val owner = handles[objectId] as? ClassInstance
            ?: return errorMessage("Object handle is no longer available.")
        if (!propertyName.matches(Regex("[A-Za-z_]\\w*")) || propertyName !in propertyNames[owner.type().name].orEmpty())
            return errorMessage("Object reference is not available.")
        val value = if (propertyName in computedPropertyNames[owner.type().name].orEmpty())
            inspectionValues[objectId]?.get(propertyName) else owner.readBackingPropertyByDeclaredName(propertyName)
        if (value == null || value === NullValue)
            return errorMessage("Object reference is not available.")
        val referenceId = if (reconcile) registerExpressionValue(value) else pinDebugInspectionValue(value)
        if (reconcile) reconcileReferences()
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

    private fun usesDefaultObjectDisplay(value: RuntimeValue?, passive: Boolean = false): Boolean =
        value is ClassInstance && value !is DelegatedValue<*> && value.usesDefaultObjectToString(isCallCustomFunction = !passive)

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
        if (value != null) inspectionValues.getOrPut(objectId) { linkedMapOf() }[propertyName] = value
        else inspectionValues[objectId]?.remove(propertyName)
        val summary = isInspectorSummary(value)
        val reference = value is ClassInstance && value !is DelegatedValue<*>
        val inspectable = value != null && value !== NullValue
        val field = "{\"name\":\"${escape(propertyName)}\",\"value\":\"${escape(parsed.display as? String ?: "<uninitialized>")}\",\"type\":${value?.let { jsonType(it.type().toTypeNode()) } ?: "null"},\"computed\":$computed,\"setterPrivate\":$setterPrivate,\"reference\":$reference,\"summary\":$summary,\"inspectable\":$inspectable,\"defaultObjectDisplay\":${parsed.defaultObjectDisplay == true}" +
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
        debugContinuation = null
        debugInspectionRequest = null
        debugMode = null
        debugPauseCallback = null
        debugPinnedHandles.clear()
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
        inspectionValues.clear()
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
        outputAtLineStart = true
        outputEscapePending = false
        outputInOsc = false
        outputOscEscapePending = false
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
        val effects = pendingEffects.joinToString(",", "[", "]")
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
        // Active property evaluation uses toString; passive inspection remains side-effect free.
        val display = if (value === UnitValue) "Unit" else if (value === NullValue) "null" else if (inspection) inspectorDisplay(value) else value.convertToString()
        val actualKind = if (value === UnitValue) "unit" else if (value === NullValue) "null" else if (value is ClassInstance) "object" else "scalar"
        return "{\"kind\":\"$actualKind\",\"display\":\"${escape(display)}\",\"type\":${jsonType(value.type().toTypeNode())}" +
            (if (usesDefaultObjectDisplay(value, passive = inspection)) ",\"defaultObjectDisplay\":true" else "") +
            (objectId?.let { ",\"objectId\":\"${escape(it)}\",\"className\":\"${escape(value.type().toTypeNode().descriptiveName())}\"" } ?: "") +
            (name?.let { ",\"name\":\"${escape(it)}\"" } ?: "") + "}"
    }

    /**
     * Only interpreter errors lock the session (RT-82). An exception the program could catch with
     * `catch (e: Throwable)` leaves the interpreter consistent, because calls unwind through
     * `finally`: like in BlueJ, the call ends with the exception and the objects stay usable,
     * including changes the call made before it failed.
     */
    private val Throwable.isFatal: Boolean
        get() = this is InterpreterStateException || this is NormalControlFlowException

    private fun error(error: Throwable, phase: String = "analysis", fatal: Boolean = false): String =
        errorMessage(errorText(error), phase, fatal)

    private fun errorText(error: Throwable): String {
        // A Kotlin exception thrown by student code is reported by its own class
        // name, e.g. `IllegalArgumentException: Unbekannte Farbe: Blau`.
        val thrown = (error as? EvaluateRuntimeException)?.error
        // Deep recursion inside a synchronous callback (e.g. `toString`) can still exhaust the host stack.
        if (thrown == null && error.isHostStackOverflow)
            return "StackOverflowError: ${StandardExceptionValue.stackOverflowMessage(null)}"
        // `MyEx: x`, or `MyEx` without message, for the thrown object (also a student subclass).
        if (thrown != null) return thrown.wholeInstance().convertToString(isCallCustomFunction = false)
        val message = error.message ?: "Kotlite evaluation failed."
        // Callable diagnostics come from semantic lookup. Legacy property
        // errors may still receive BlueK gap hints; exception class names add
        // no useful information to either compile diagnosis.
        return KotlinSurfaceHints.rewrite(message, knownNames)
            // SemanticException and its subclasses describe compile diagnostics,
            // not exceptions thrown by the student's program.
            ?: if (error is SemanticException) message else "${error.fullClassName}: $message"
    }
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
