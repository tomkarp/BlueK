import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.KotliteInterpreter
import com.sunnychung.lib.multiplatform.kotlite.Parser
import com.sunnychung.lib.multiplatform.kotlite.ReplAnalyzer
import com.sunnychung.lib.multiplatform.kotlite.extension.fullClassName
import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer
import com.sunnychung.lib.multiplatform.kotlite.model.ASTNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.error.EvaluateRuntimeException
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
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
private data class BlueKReference(val symbol: String, val interactive: Boolean, var onBench: Boolean)
private data class BluePlayResourceMask(val width: Int, val height: Int, val alphaHex: String)
private data class BluePlayActorBounds(val left: Double, val top: Double, val right: Double, val bottom: Double)

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
    private val privateSetterNames = linkedMapOf<String, MutableSet<String>>()
    private var nextHandle = 1
    private var analysisSource = ""
    private var analyzedScript: ScriptNode? = null
    private var stageSnapshot = ""
    private val pendingSounds = mutableListOf<String>()
    private val pendingEffects = mutableListOf<String>()
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
    private var clickActorId: String? = null
    private var bluePlayEnabled = false
    private var bluePlayWorld: ClassInstance? = null
    private val bluePlayActors = mutableListOf<Pair<ClassInstance, ClassInstance>>()
    // Keyed by bluePlayIdentity(): every inheritance part of one object shares
    // that root, so the lookup is O(1) instead of a scan per actor and frame.
    private val bluePlayActorIds = mutableMapOf<ClassInstance, String>()
    /** Every known resource path; the mask is null when no pixel data was prepared. */
    private val bluePlayResources = linkedMapOf<String, BluePlayResourceMask?>()
    private var nextBluePlayActorId = 1
    private var bluePlayActorHint: ClassInstance? = null
    private var bluePlaySpeed = 50
    private var bluePlayFrameVersion = 0
    private var bluePlayBatching = false
    private var bluePlayIntent = ""
    private var bluePlayGeneration = ""
    private val projectFunctionRanges = mutableListOf<Triple<String, Int, Int>>()
    private val mainFunctionNames = linkedMapOf<String, String>()

    /** The callable name of the main() declared in [filename]. */
    fun mainFunctionName(filename: String): String = mainFunctionNames[filename] ?: "main"

    init {
        resetInterpreter()
    }

    fun configureBluePlay(enabled: Boolean, generationId: String = "") {
        bluePlayEnabled = enabled
        bluePlayGeneration = generationId
        bluePlayWorld = null
        bluePlayActors.clear()
        bluePlayActorIds.clear()
        bluePlayResources.clear()
        nextBluePlayActorId = 1
        bluePlayActorHint = null
        bluePlaySpeed = 50
        bluePlayFrameVersion = 0
        bluePlayBatching = false
        bluePlayIntent = ""
        projectFunctionRanges.clear()
        resetInterpreter()
    }

    fun setBluePlayResources(manifest: String) {
        bluePlayResources.clear()
        manifest.lines().filter { it.isNotEmpty() }.forEach { line ->
            val fields = line.split('\u0000')
            if (fields.size == 4 && fields[0].isNotEmpty()) {
                val width = fields[1].toIntOrNull()
                val height = fields[2].toIntOrNull()
                bluePlayResources[fields[0]] =
                    if (width != null && height != null && width > 0 && height > 0 && fields[3].length >= width * height * 2)
                        BluePlayResourceMask(width, height, fields[3])
                    else null
            }
        }
    }

    private fun resetInterpreter() {
        environment = ExecutionEnvironment(sleepHandler = { millis ->
            // Do not leave a suspended continuation behind in legacy sync calls.
            check(executionCompleted != null) { "Thread.sleep requires asynchronous execution (startEvaluate)." }
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
            parameterTypes = listOf(CustomFunctionParameter("actor", "Any"), CustomFunctionParameter("x", "Int"), CustomFunctionParameter("y", "Int")),
            executable = { interpreter, _, args, _ ->
                val actor = args[0] as ClassInstance
                val actorId = bluePlayActorIds[actor.bluePlayIdentity()]
                val matches = if (!clickActorId.isNullOrEmpty()) clickActorId == actorId else
                    clickX == (args[1] as IntValue).value && clickY == (args[2] as IntValue).value
                if (matches) { clickX = null; clickY = null; clickActorId = null }
                BooleanValue(matches, interpreter.symbolTable())
            }
        ))
        // Compatibility overload for projects exported before the native
        // BluePlay library started passing a stable actor identity.
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekIsActorClicked",
            returnType = "Boolean",
            parameterTypes = listOf(CustomFunctionParameter("x", "Int"), CustomFunctionParameter("y", "Int")),
            executable = { interpreter, _, args, _ ->
                val matches = clickActorId.isNullOrEmpty() && clickX == (args[0] as IntValue).value && clickY == (args[1] as IntValue).value
                if (matches) { clickX = null; clickY = null; clickActorId = null }
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
                if (matches) { clickX = null; clickY = null; clickActorId = null }
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
        if (bluePlayEnabled) registerBluePlayNativeFunctions()
        interpreter = KotliteInterpreter("<BlueK>", "", environment)
        interpreter.checkpointHook = { awaitRuntimeCheckpoint() }
    }

    private fun registerBluePlayNativeFunctions() {
        fun definition(name: String, returnType: String, parameters: List<CustomFunctionParameter>, executable: (Interpreter, List<RuntimeValue>) -> RuntimeValue) =
            environment.registerFunction(CustomFunctionDefinition(
                position = SourcePosition.BUILTIN,
                receiverType = null,
                functionName = name,
                returnType = returnType,
                parameterTypes = parameters,
                executable = { currentInterpreter, _, args, _ -> executable(currentInterpreter, args) },
            ))
        // These bridge functions deliberately use Any: the student-defined
        // BluePlay classes are added to the environment after this runtime
        // setup, so resolving World/Actor here would fail for an empty symbol
        // table. The combined library source still provides the typed public API.
        definition("bluekImageWidth", "Int", listOf(CustomFunctionParameter("path", "String"))) { currentInterpreter, args ->
            val path = (args[0] as StringValue).value
            requireResource(path)
            IntValue(resourceMask(path)?.width ?: 30, currentInterpreter.symbolTable())
        }
        definition("bluekImageHeight", "Int", listOf(CustomFunctionParameter("path", "String"))) { currentInterpreter, args ->
            val path = (args[0] as StringValue).value
            requireResource(path)
            IntValue(resourceMask(path)?.height ?: 30, currentInterpreter.symbolTable())
        }
        definition("bluekActiveWorld", "Any", emptyList()) { _, _ ->
            bluePlayWorld ?: throw IllegalStateException("No BluePlay world is shown yet. Call show() on a world first.")
        }
        definition("bluekShowWorld", "Unit", listOf(CustomFunctionParameter("world", "Any"))) { _, args ->
            bluePlayWorld = args[0] as ClassInstance
            UnitValue
        }
        definition("bluekRenderWorld", "Unit", listOf(CustomFunctionParameter("world", "Any"))) { _, args ->
            val world = args[0] as ClassInstance
            if (!bluePlayBatching && bluePlayWorld === world) stageSnapshot = renderBluePlayStage(world)
            UnitValue
        }
        definition("bluekRenderActor", "Unit", listOf(CustomFunctionParameter("actor", "Any"))) { _, args ->
            val actor = args[0] as ClassInstance
            if (!bluePlayBatching) {
                bluePlayActors.firstOrNull { sameBluePlayInstance(it.second, actor) }?.first?.let { world ->
                    if (bluePlayWorld === world) stageSnapshot = renderBluePlayStage(world)
                }
            }
            UnitValue
        }
        definition("bluekWorldAddObject", "Unit", listOf(
            CustomFunctionParameter("world", "Any"),
            CustomFunctionParameter("actor", "Any"),
            CustomFunctionParameter("x", "Int"),
            CustomFunctionParameter("y", "Int"),
        )) { currentInterpreter, args ->
            val world = args[0] as ClassInstance
            val actor = args[1] as ClassInstance
            val previousWorld = bluePlayActors.firstOrNull { sameBluePlayInstance(it.second, actor) }?.first
            if (previousWorld != null && previousWorld !== world) removeBluePlayActorFromWorld(previousWorld, actor)
            bluePlayActors.removeAll { sameBluePlayInstance(it.second, actor) }
            bluePlayActors += world to actor
            bluePlayActorId(actor)
            val worldWidth = intMember(world, "width", 1)
            val worldHeight = intMember(world, "height", 1)
            val x = (args[2] as IntValue).value.coerceIn(0, worldWidth - 1)
            val y = (args[3] as IntValue).value.coerceIn(0, worldHeight - 1)
            fun assignInt(name: String, value: Int) {
                currentInterpreter.runImmediately { actor.assign(currentInterpreter, name, IntValue(value, currentInterpreter.symbolTable())) }
            }
            assignInt("worldWidth", worldWidth)
            assignInt("worldHeight", worldHeight)
            assignInt("worldCellSize", intMember(world, "cellSize", 1))
            assignInt("x", x)
            assignInt("y", y)
            UnitValue
        }
        definition("bluekObjectX", "Int", listOf(CustomFunctionParameter("actor", "Any"))) { currentInterpreter, args ->
            IntValue(intMember(args[0] as ClassInstance, "x"), currentInterpreter.symbolTable())
        }
        definition("bluekObjectY", "Int", listOf(CustomFunctionParameter("actor", "Any"))) { currentInterpreter, args ->
            IntValue(intMember(args[0] as ClassInstance, "y"), currentInterpreter.symbolTable())
        }
        definition("bluekWorldRemoveObject", "Unit", listOf(
            CustomFunctionParameter("world", "Any"), CustomFunctionParameter("actor", "Any"),
        )) { currentInterpreter, args ->
            val world = args[0] as ClassInstance
            val requestedActor = args[1] as ClassInstance
            val actor = bluePlayActors.firstOrNull { it.first === world && sameBluePlayInstance(it.second, requestedActor) }?.second
                ?: bluePlayActorHint?.takeIf { hinted -> bluePlayActors.any { it.first === world && it.second === hinted } }
                ?: requestedActor
            bluePlayActors.removeAll { it.first === world && sameBluePlayInstance(it.second, actor) }
            removeBluePlayActorFromWorld(world, actor)
            // Forget the hit id of an actor that left every world; otherwise each
            // removed actor (e.g. every laser shot) is retained and scanned forever.
            if (bluePlayActors.none { sameBluePlayInstance(it.second, actor) }) bluePlayActorIds.remove(actor.bluePlayIdentity())
            bluePlayActorHint = null
            fun assignInt(name: String, value: Int) {
                currentInterpreter.runImmediately { actor.assign(currentInterpreter, name, IntValue(value, currentInterpreter.symbolTable())) }
            }
            assignInt("worldWidth", 0)
            assignInt("worldHeight", 0)
            assignInt("worldCellSize", 1)
            UnitValue
        }
        definition("bluekActorWorld", "Any", listOf(CustomFunctionParameter("actor", "Any"))) { _, args ->
            val actor = args[0] as ClassInstance
            val entry = bluePlayActors.firstOrNull { sameBluePlayInstance(it.second, actor) }
                ?: throw IllegalStateException("The actor is not in a world (add it with addObject first).")
            bluePlayActorHint = entry.second
            entry.first
        }
        definition("bluekIntersects", "Boolean", listOf(
            CustomFunctionParameter("first", "Any"), CustomFunctionParameter("second", "Any"),
        )) { currentInterpreter, args ->
            val first = args[0] as ClassInstance
            val second = args[1] as ClassInstance
            BooleanValue(bluePlayIntersects(first, second), currentInterpreter.symbolTable())
        }
        val tickDefinition = CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekWorldTick",
            returnType = "Unit",
            parameterTypes = listOf(CustomFunctionParameter("world", "Any")),
            executable = { _, _, _, _ -> UnitValue },
        )
        tickDefinition.suspendExecutable = { currentInterpreter, _, args, _ ->
            val world = args[0] as ClassInstance
            suspend fun invokeMember(target: ClassInstance, name: String) {
                val function = target.findMemberFunctionByDeclaredName(name) ?: return
                if (function.hasEmptyBody()) return
                with(currentInterpreter) {
                    FunctionCallNode(function, emptyList(), emptyList(), function.position)
                        .evalClassMemberAnyFunctionCall(target, function)
                }
            }
            invokeMember(world, "act")
            bluePlayActors.filter { it.first === world }.map { it.second }.forEach { actor ->
                if (bluePlayActors.any { it.first === world && it.second === actor }) invokeMember(actor, "act")
            }
            UnitValue
        }
        environment.registerFunction(tickDefinition)
        definition("bluekSimulationStart", "Unit", emptyList()) { _, _ -> bluePlayIntent = "start"; UnitValue }
        definition("bluekSimulationStop", "Unit", emptyList()) { _, _ -> bluePlayIntent = "stop"; UnitValue }
        definition("bluekGetSpeed", "Int", emptyList()) { currentInterpreter, _ -> IntValue(bluePlaySpeed, currentInterpreter.symbolTable()) }
        definition("bluekSetSpeed", "Unit", listOf(CustomFunctionParameter("speed", "Int"))) { _, args ->
            setBluePlaySpeed((args[0] as IntValue).value)
            UnitValue
        }
    }

    private fun member(instance: ClassInstance, name: String): RuntimeValue? =
        runCatching { instance.readBackingPropertyByDeclaredName(name) }.getOrNull()

    private fun intMember(instance: ClassInstance, name: String, fallback: Int = 0): Int =
        (member(instance, name) as? IntValue)?.value ?: fallback

    private fun stringMember(instance: ClassInstance, name: String, fallback: String = ""): String =
        (member(instance, name) as? StringValue)?.value ?: fallback

    private fun sameBluePlayInstance(first: ClassInstance, second: ClassInstance): Boolean {
        var firstPart: ClassInstance? = first
        while (firstPart != null) {
            var secondPart: ClassInstance? = second
            while (secondPart != null) {
                if (firstPart === secondPart) return true
                secondPart = secondPart.parentInstance
            }
            firstPart = firstPart.parentInstance
        }
        return false
    }

    private fun resourceEntry(path: String): Map.Entry<String, BluePlayResourceMask?>? =
        bluePlayResources.entries.firstOrNull { it.key == path }
            ?: bluePlayResources.entries.firstOrNull { it.key == "images/$path" }
            ?: bluePlayResources.entries.firstOrNull { it.key.endsWith("/$path") }

    private fun resourceMask(path: String): BluePlayResourceMask? = resourceEntry(path)?.value

    /**
     * Mirrors BluePlay's own message for a file that is not there, so a typo in
     * `Image("duckk.png")` fails loudly instead of yielding an invisible 30x30
     * placeholder. The names help with a misspelled standard graphic.
     */
    private fun requireResource(path: String) {
        if (resourceEntry(path) != null) return
        val available = bluePlayResources.keys
            .filter { it.startsWith("images/") }
            .map { it.removePrefix("images/") }
            .sorted()
        val names = if (available.isEmpty()) ""
            else " Available: " + available.take(12).joinToString(", ") +
                (if (available.size > 12) ", ... (${available.size} in total)" else "") + "."
        throw IllegalArgumentException(
            "Image file not found: $path (expected e.g. in the folder 'images/').$names"
        )
    }

    /** The shared root of an object's inheritance parts; see [sameBluePlayInstance]. */
    private fun ClassInstance.bluePlayIdentity(): ClassInstance {
        var instance = this
        while (true) instance = instance.parentInstance ?: return instance
    }

    private fun bluePlayActorId(actor: ClassInstance): String =
        bluePlayActorIds.getOrPut(actor.bluePlayIdentity()) { "actor-${nextBluePlayActorId++}" }

    private fun runtimeList(value: RuntimeValue?): List<RuntimeValue> =
        (value as? DelegatedValue<*>)?.value as? List<RuntimeValue> ?: emptyList()

    private fun removeBluePlayActorFromWorld(world: ClassInstance, actor: ClassInstance) {
        val actors = (member(world, "actors") as? DelegatedValue<*>)?.value as? MutableList<RuntimeValue> ?: return
        actors.removeAll { value -> value is ClassInstance && sameBluePlayInstance(value, actor) }
    }

    private fun imageFrame(image: ClassInstance?): String {
        if (image == null) return "{\"width\":30,\"height\":30,\"opacity\":1,\"operations\":[]}"
        val path = stringMember(image, "path")
        val width = intMember(image, "imageWidth", 30)
        val height = intMember(image, "imageHeight", 30)
        val transparency = intMember(image, "transparency", 255)
        val operations = stringMember(image, "drawingJson", "[]")
        // drawingJson is a computed property in the adapter; call its backing
        // data instead so stage publication stays passive.
        val rawOperations = runtimeList(member(image, "drawingOperations")).joinToString(",", "[", "]") { value ->
            "\"${escape((value as? StringValue)?.value ?: "")}\""
        }
        return "{\"resourcePath\":\"${escape(path)}\",\"width\":$width,\"height\":$height,\"opacity\":${transparency.toDouble() / 255.0},\"operations\":$rawOperations}"
    }

    private fun actorBounds(actor: ClassInstance): BluePlayActorBounds {
        val image = member(actor, "image") as? ClassInstance
        val width = intMember(image ?: actor, "imageWidth", 30).toDouble().coerceAtLeast(1.0)
        val height = intMember(image ?: actor, "imageHeight", 30).toDouble().coerceAtLeast(1.0)
        val cell = intMember(actor, "worldCellSize", 1).coerceAtLeast(1)
        val centerX = (intMember(actor, "x") + 0.5) * cell
        val centerY = (intMember(actor, "y") + 0.5) * cell
        val radians = intMember(actor, "rotation") * PI / 180.0
        val halfWidth = (kotlin.math.abs(cos(radians)) * width + kotlin.math.abs(sin(radians)) * height) / 2.0
        val halfHeight = (kotlin.math.abs(sin(radians)) * width + kotlin.math.abs(cos(radians)) * height) / 2.0
        return BluePlayActorBounds(centerX - halfWidth, centerY - halfHeight, centerX + halfWidth, centerY + halfHeight)
    }

    private fun operationPixelVisible(operation: String, x: Double, y: Double): Boolean {
        val parts = operation.split('|')
        fun number(index: Int): Double = parts.getOrNull(index)?.toDoubleOrNull() ?: 0.0
        return when (parts.firstOrNull()) {
            "fill" -> true
            "fillRect", "drawImage" -> x >= number(if (parts[0] == "drawImage") 2 else 1) &&
                y >= number(if (parts[0] == "drawImage") 3 else 2) &&
                x < number(if (parts[0] == "drawImage") 2 else 1) + number(if (parts[0] == "drawImage") 4 else 3) &&
                y < number(if (parts[0] == "drawImage") 3 else 2) + number(if (parts[0] == "drawImage") 5 else 4)
            "drawRect" -> {
                val left = number(1); val top = number(2); val right = left + number(3); val bottom = top + number(4)
                x >= left - 1 && y >= top - 1 && x <= right + 1 && y <= bottom + 1 &&
                    (x <= left + 1 || x >= right - 1 || y <= top + 1 || y >= bottom - 1)
            }
            "fillOval", "drawOval" -> {
                val width = number(3); val height = number(4)
                if (width <= 0 || height <= 0) false else {
                    val dx = (x - number(1) - width / 2) / (width / 2)
                    val dy = (y - number(2) - height / 2) / (height / 2)
                    val distance = dx * dx + dy * dy
                    if (parts[0] == "fillOval") distance <= 1.0 else distance in 0.78..1.22
                }
            }
            "drawLine" -> {
                val x1 = number(1); val y1 = number(2); val x2 = number(3); val y2 = number(4)
                val lengthSquared = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
                val amount = if (lengthSquared == 0.0) 0.0 else (((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared).coerceIn(0.0, 1.0)
                val nearestX = x1 + amount * (x2 - x1); val nearestY = y1 + amount * (y2 - y1)
                (x - nearestX) * (x - nearestX) + (y - nearestY) * (y - nearestY) <= 2.25
            }
            "drawString" -> x >= number(2) && x <= number(2) + (parts.getOrNull(1)?.length ?: 0) * 8 && y >= number(3) - 12 && y <= number(3) + 3
            else -> false
        }
    }

    private fun actorPixelVisible(actor: ClassInstance, worldX: Double, worldY: Double): Boolean {
        val image = member(actor, "image") as? ClassInstance ?: return true
        val width = intMember(image, "imageWidth", 30).coerceAtLeast(1)
        val height = intMember(image, "imageHeight", 30).coerceAtLeast(1)
        val transparency = intMember(image, "transparency", 255).coerceIn(0, 255)
        if (transparency <= 16) return false
        val cell = intMember(actor, "worldCellSize", 1).coerceAtLeast(1)
        val centerX = (intMember(actor, "x") + 0.5) * cell
        val centerY = (intMember(actor, "y") + 0.5) * cell
        val radians = intMember(actor, "rotation") * PI / 180.0
        val dx = worldX - centerX; val dy = worldY - centerY
        val localX = cos(radians) * dx + sin(radians) * dy + width / 2.0
        val localY = -sin(radians) * dx + cos(radians) * dy + height / 2.0
        if (localX < 0 || localY < 0 || localX >= width || localY >= height) return false
        val path = stringMember(image, "path")
        val mask = if (path.isEmpty()) null else resourceMask(path)
        if (mask != null) {
            val sourceX = ((localX / width) * mask.width).toInt().coerceIn(0, mask.width - 1)
            val sourceY = ((localY / height) * mask.height).toInt().coerceIn(0, mask.height - 1)
            val offset = (sourceY * mask.width + sourceX) * 2
            val alpha = mask.alphaHex.substring(offset, offset + 2).toIntOrNull(16) ?: 0
            return alpha * transparency / 255 > 16
        }
        if (path.isNotEmpty()) return true
        val operations = runtimeList(member(image, "drawingOperations")).mapNotNull { (it as? StringValue)?.value }
        return operations.any { operationPixelVisible(it, localX, localY) }
    }

    private fun bluePlayIntersects(first: ClassInstance, second: ClassInstance): Boolean {
        val firstBounds = actorBounds(first); val secondBounds = actorBounds(second)
        val left = kotlin.math.max(firstBounds.left, secondBounds.left)
        val top = kotlin.math.max(firstBounds.top, secondBounds.top)
        val right = kotlin.math.min(firstBounds.right, secondBounds.right)
        val bottom = kotlin.math.min(firstBounds.bottom, secondBounds.bottom)
        if (left >= right || top >= bottom) return false
        var y = kotlin.math.floor(top).toInt()
        val lastY = kotlin.math.ceil(bottom).toInt()
        while (y < lastY) {
            var x = kotlin.math.floor(left).toInt()
            val lastX = kotlin.math.ceil(right).toInt()
            while (x < lastX) {
                if (actorPixelVisible(first, x + 0.5, y + 0.5) && actorPixelVisible(second, x + 0.5, y + 0.5)) return true
                x += 1
            }
            y += 1
        }
        return false
    }

    private fun renderBluePlayStage(world: ClassInstance): String {
        val width = intMember(world, "width", 1)
        val height = intMember(world, "height", 1)
        val cellSize = intMember(world, "cellSize", 1)
        val background = member(world, "background") as? ClassInstance
        val objects = bluePlayActors.filter { it.first === world }.joinToString(",", "[", "]") { (_, actor) ->
            val image = member(actor, "image") as? ClassInstance
            val frame = imageFrame(image)
            val objectId = handles.entries.firstOrNull { it.value === actor }?.key
            "{\"objectId\":${objectId?.let { "\"${escape(it)}\"" } ?: "null"},\"hitId\":\"${bluePlayActorId(actor)}\",\"className\":\"${escape(actor.type().toTypeNode().descriptiveName())}\",\"x\":${intMember(actor, "x")},\"y\":${intMember(actor, "y")},\"rotation\":${intMember(actor, "rotation")},\"image\":$frame}"
        }
        val textX = runtimeList(member(world, "textX"))
        val textY = runtimeList(member(world, "textY"))
        val textValues = runtimeList(member(world, "textValues"))
        val texts = textValues.indices.joinToString(",", "[", "]") { index ->
            "{\"x\":${(textX.getOrNull(index) as? IntValue)?.value ?: 0},\"y\":${(textY.getOrNull(index) as? IntValue)?.value ?: 0},\"text\":\"${escape((textValues[index] as? StringValue)?.value ?: "")}\"}"
        }
        val bgPath = background?.let { stringMember(it, "path") } ?: stringMember(world, "backgroundPath")
        val bgOps = background?.let { runtimeList(member(it, "drawingOperations")).joinToString(",", "[", "]") { value -> "\"${escape((value as? StringValue)?.value ?: "")}\"" } } ?: "[]"
        return "{\"stage\":{\"worldId\":${handles.entries.firstOrNull { it.value === world }?.key?.let { "\"${escape(it)}\"" } ?: "null"},\"frameVersion\":${++bluePlayFrameVersion},\"width\":$width,\"height\":$height,\"cellSize\":$cellSize,\"backgroundColor\":\"${escape(stringMember(world, "backgroundColor", "rgb(255,255,255)"))}\",\"backgroundPath\":\"${escape(bgPath)}\",\"backgroundOperations\":$bgOps,\"speed\":$bluePlaySpeed,\"simulation\":\"paused\",\"objects\":$objects,\"texts\":$texts}}"
    }

    fun takeBluePlayIntent(): String = bluePlayIntent.also { bluePlayIntent = "" }

    fun setBluePlaySpeed(value: Int): String {
        bluePlaySpeed = value.coerceIn(1, 100)
        bluePlayWorld?.let { world ->
            interpreter.runImmediately {
                world.assign(interpreter, "speed", IntValue(bluePlaySpeed, interpreter.symbolTable()))
            }
            if (!bluePlayBatching) stageSnapshot = renderBluePlayStage(world)
        }
        return result("unit", UnitValue)
    }

    private suspend fun invokeDirect(instance: ClassInstance, name: String): RuntimeValue {
        val function = instance.findMemberFunctionByDeclaredName(name)
            ?: throw IllegalStateException("BluePlay member $name is not available.")
        // Most actors inherit the empty default act(). Skipping an empty body
        // has no observable effect but saves a full interpreted call per actor.
        if (function.hasEmptyBody()) return UnitValue
        return with(interpreter) {
            FunctionCallNode(function, emptyList(), emptyList(), function.position)
                .evalClassMemberAnyFunctionCall(instance, function)
        }
    }

    private fun FunctionDeclarationNode.hasEmptyBody(): Boolean = body?.statements?.isEmpty() == true

    /** Run one native-scheduled step without creating a Codepad history item. */
    fun startBluePlayStep(onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        val world = bluePlayWorld ?: return errorMessage("No BluePlay world has been shown yet.")
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        inputRequested = onInput
        executionCompleted = onComplete
        bluePlayBatching = true
        stageSnapshot = "" // any earlier frame is stale once the step runs
        (suspend {
            invokeDirect(world, "act")
            val actors = bluePlayActors.filter { it.first === world }.map { it.second }
            actors.forEach { actor ->
                if (bluePlayActors.any { it.first === world && it.second === actor }) invokeDirect(actor, "act")
            }
            bluePlayBatching = false
            UnitValue
        }).startCoroutine(object : Continuation<UnitValue> {
            override val context = kotlin.coroutines.EmptyCoroutineContext
            override fun resumeWith(outcome: Result<UnitValue>) {
                bluePlayBatching = false
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

    fun startBluePlayMain(onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        val main = analyzedScript?.nodes?.filterIsInstance<FunctionDeclarationNode>()
            ?.singleOrNull { it.name == "main" && it.valueParameters.isEmpty() }
            ?: return errorMessage("BluePlay Reset needs an unambiguous parameterless main().")
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        inputRequested = onInput
        executionCompleted = onComplete
        bluePlayBatching = true
        (suspend {
            val call = FunctionCallNode(VariableReferenceNode(main.position, "main"), emptyList(), emptyList(), main.position)
            interpreter.evalFunctionCall(
                callNode = call,
                functionNode = main,
                extraScopeParameters = emptyMap(),
                extraTypeResolutions = emptyList(),
            ).result
        }).startCoroutine(object : Continuation<RuntimeValue> {
            override val context = kotlin.coroutines.EmptyCoroutineContext
            override fun resumeWith(outcome: Result<RuntimeValue>) {
                bluePlayBatching = false
                bluePlayWorld?.let { stageSnapshot = renderBluePlayStage(it) }
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
        // script here, so all but the primary main (Main.kt, as BlueJ's Reset
        // uses) get an internal name; the manifest still presents them as main.
        mainFunctionNames.clear()
        val primaryMain = mainFiles.firstOrNull { it == "Main.kt" } ?: mainFiles.firstOrNull()
        val projectSources = sources.indices.map { index ->
            val filename = filenames[index]
            if (filename !in mainFiles || filename == primaryMain) return@map sources[index]
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
        return startEvaluate("<BlueK project>", source, onInput) { result -> onComplete(withProjectDiagnostic(result)) }
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
            "{\"id\":\"${escape(declaration.name)}\",\"name\":\"${escape(declaration.name)}\",\"kind\":\"$kind\",\"modifiers\":${declaration.modifiers.joinToString(",", "[", "]") { modifier -> "\"${modifier.name}\"" }},\"typeParameters\":$typeParameters,\"supertypes\":$supers,\"constructors\":$constructors,\"properties\":$properties,\"methods\":$methods${if (bluePlayEnabled && declaration.name in setOf("World", "Actor", "Image")) ",\"builtin\":true" else ""}}"
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

    private fun jsonProperty(owner: String, name: String, type: TypeNode, mutable: Boolean, private: Boolean, getter: Boolean, setter: Boolean, setterPrivate: Boolean): String =
        "{\"id\":\"${escape(owner)}.${escape(name)}\",\"name\":\"${escape(name)}\",\"type\":${jsonType(type)},\"mutable\":$mutable,\"visibility\":\"${if (private) "private" else "public"}\",\"getter\":$getter,\"setter\":$setter,\"setterPrivate\":$setterPrivate}"

   private fun visibility(modifiers: Set<*>): String = when {
        modifiers.any { it.toString() == "private" } -> "private"
        modifiers.any { it.toString() == "protected" } -> "protected"
        else -> "public"
    }

    private fun jsonFunction(owner: String, function: FunctionDeclarationNode, index: Int, sourceFile: String? = null, builtin: Boolean = false): String =
        "{\"sourceLine\":${function.position.lineNum},\"id\":\"${escape(owner)}.${escape(function.name)}.$index\",\"name\":\"${escape(if (function.name.startsWith(MAIN_ALIAS_PREFIX)) "main" else function.name)}\",\"declaringType\":\"${escape(owner)}\",\"parameters\":${function.valueParameters.joinToString(",", "[", "]", transform = ::parameterJson)},\"returnType\":${jsonType(function.returnType)},\"visibility\":\"${visibility(function.modifiers)}\"${sourceFile?.let { ",\"sourceFile\":\"${escape(it)}\"" } ?: ""}${if (builtin) ",\"builtin\":true" else ""}}"
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
        return evaluateWithBindings(filename, source, emptySet()).also {
            bluePlayWorld?.let { world -> stageSnapshot = renderBluePlayStage(world) }
        }
    }

    private fun evaluateWithBindings(filename: String, source: String, interactiveNames: Set<String>): String {
        // Legacy synchronous callers must retain their historical contract;
        // interactive start* calls install the yielding scheduler explicitly.
        val hook = interpreter.checkpointHook
        interpreter.checkpointHook = null
        return try {
            interpreter.runImmediately { evaluateSuspended(filename, source, interactiveNames) }
        } finally {
            interpreter.checkpointHook = hook
        }
    }

    private suspend fun evaluateSuspended(filename: String, source: String, interactiveNames: Set<String> = emptySet()): String {
        if (faulted) return errorMessage("Runtime failed. Reset or compile before running more code.", "runtime", true)
        val boundary = analysisSource.length + 1
        val candidate = analysisSource + "\n" + source
        analysisCandidate = candidate
        val analyzed = try {
            ReplAnalyzer.analyze("<BlueK project>", candidate, environment, retiredProperties)
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
            var objectId = if (value !== UnitValue) registerExpressionValue(value) else null
            reconcileReferences()
            // A fresh expression may return the value it just detached (e.g.
            // list.removeAt). Its old history handles stay invalid, but this
            // new result is transferable under a fresh provisional handle.
            if (objectId != null && objectId !in handles) objectId = registerExpressionValue(value)
            result("value", value, objectId)
        } catch (error: Throwable) {
            faulted = true
            error(error, "runtime", true)
        }
    }

    /** Starts one execution and returns before input waits or Thread.sleep. */
    fun startEvaluate(filename: String, source: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit): String {
        return startEvaluateInternal(filename, source, onInput, onComplete, emptySet())
    }

    private fun startEvaluateInternal(filename: String, source: String, onInput: (Int) -> Unit, onComplete: (String) -> Unit, interactiveNames: Set<String>): String {
        if (executionCompleted != null) return errorMessage("Another runtime command is running.")
        inputRequested = onInput
        executionCompleted = onComplete
        (suspend { evaluateSuspended(filename, source, interactiveNames) }).startCoroutine(object : Continuation<String> {
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
        val script = ReplAnalyzer.analyze("<BlueK project>", analysisSource + "\n" + syntheticSource, environment, retiredProperties)
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
        val reachable = reachableRuntimeValues(roots)
        handles.toList().forEach { (id, value) ->
            if (reachable.any { it === value }) managedHandles += id
            else if (id in managedHandles) {
                bindingNames.remove(id)?.let(::retire)
                handles.remove(id)
                managedHandles.remove(id)
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
        // project. Computed properties are reported without reading them: a
        // getter may contain arbitrary student code and must not run during
        // inspection.
        val fields = propertyNames[value.type().name].orEmpty().joinToString(",", "[", "]") { name ->
            val setterPrivate = name in privateSetterNames[value.type().name].orEmpty()
            if (name in computedPropertyNames[value.type().name].orEmpty()) {
                "{\"name\":\"${escape(name)}\",\"value\":\"<computed>\",\"setterPrivate\":$setterPrivate}"
            } else {
                val member = value.readBackingPropertyByDeclaredName(name)
                val display = member?.let(::inspectorDisplay) ?: "<uninitialized>"
                "{\"name\":\"${escape(name)}\",\"value\":\"${escape(display)}\",\"type\":${member?.let { jsonType(it.type().toTypeNode()) } ?: "null"},\"setterPrivate\":$setterPrivate}"
            }
        }
        return "{\"kind\":\"inspect\",\"objectId\":\"${escape(objectId)}\",\"className\":\"${escape(value.type().toTypeNode().descriptiveName())}\",\"fields\":$fields}"
    }

    /**
     * Passive text for an inspected field: never runs a student `toString()`,
     * and shows the size and first elements of collections instead of `MutableList()`.
     */
    private fun inspectorDisplay(value: RuntimeValue): String {
        val content = (value as? DelegatedValue<*>)?.value
        if (content is Collection<*>) {
            val shown = content.take(5).joinToString(", ") { (it as? RuntimeValue)?.let(::inspectorDisplay) ?: it.toString() }
            return "[$shown${if (content.size > 5) ", …" else ""}] (size ${content.size})"
        }
        if (content is Map<*, *>) return "{…} (size ${content.size})"
        return if (value is ClassInstance && value !is DelegatedValue<*>) value.convertToString(isCallCustomFunction = false) else value.convertToString()
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
        references.clear()
        managedHandles.clear()
        retiredProperties.clear()
        analysisSource = ""
        analyzedScript = null
        propertyNames.clear()
        computedPropertyNames.clear()
        privateSetterNames.clear()
        stageSnapshot = ""
        pendingSounds.clear()
        pendingEffects.clear()
        inputLines.clear()
        faulted = false
        keysDown.clear()
        clickX = null
        clickY = null
        bluePlayWorld = null
        bluePlayActors.clear()
        bluePlayActorIds.clear()
        bluePlaySpeed = 50
        bluePlayFrameVersion = 0
        bluePlayBatching = false
        bluePlayIntent = ""
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

    fun takeStage(): String {
        // The BluePlay library does not render on every state change; produce
        // the frame of the current world when it is requested.
        if (stageSnapshot.isEmpty()) renderBluePlay()
        val snapshot =if (stageSnapshot.isNotEmpty() && pendingSounds.isNotEmpty()) {
            val sounds = pendingSounds.joinToString(",", "[", "]") { "\"${escape(it)}\"" }
            stageSnapshot.removeSuffix("}}") + ",\"sounds\":$sounds}}"
        } else stageSnapshot
        stageSnapshot = ""
        pendingSounds.clear()
        return snapshot
    }

    fun renderBluePlay() {
        if (bluePlayBatching) return
        bluePlayWorld?.let { world -> stageSnapshot = renderBluePlayStage(world) }
    }

    fun takeEffects(): String {
        val effects = pendingEffects.joinToString(",", "[", "]") { "{\"type\":\"sound\",\"name\":\"${escape(it)}\"}" }
        pendingEffects.clear()
        return effects
    }

    fun setKey(key: String, pressed: Boolean): String {
        if (pressed) keysDown += key.lowercase() else keysDown -= key.lowercase()
        return result("value", UnitValue)
    }

    fun setClick(x: Int, y: Int, actorId: String): String {
        clickX = x
        clickY = y
        clickActorId = actorId.ifEmpty { null }
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

    private fun error(error: Throwable, phase: String = "analysis", fatal: Boolean = false): String {
        // A Kotlin exception thrown by student code is reported by its own class
        // name, e.g. `IllegalArgumentException: Unbekannte Farbe: Blau`.
        val thrown = (error as? EvaluateRuntimeException)?.error
        val name = thrown?.let { it.externalExceptionClassName ?: it.type().name } ?: error.fullClassName
        val message = thrown?.message ?: error.message ?: "Kotlite evaluation failed."
        // A missing name is reported by Kotlite as an ordinary analysis error.
        // BlueK says instead which side the gap is on; the exception class name
        // would only add noise there.
        if (thrown == null) {
            KotlinSurfaceHints.rewrite(message, knownNames, declaredNames())
                ?.let { return errorMessage(it, phase, fatal) }
        }
        return errorMessage("$name: $message", phase, fatal)
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

private const val MAIN_ALIAS_PREFIX = "main__"

@OptIn(ExperimentalJsExport::class)
@JsExport
fun bluekCreateKotliteSession(): KotliteSession = KotliteSession()
