import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.extension.StringIndex
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.DataType
import com.sunnychung.lib.multiplatform.kotlite.model.DelegatedValue
import com.sunnychung.lib.multiplatform.kotlite.model.ExecutionEnvironment
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionModifier
import com.sunnychung.lib.multiplatform.kotlite.model.IntValue
import com.sunnychung.lib.multiplatform.kotlite.model.ListValue
import com.sunnychung.lib.multiplatform.kotlite.model.NullValue
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValueAccessor
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.StringValue
import com.sunnychung.lib.multiplatform.kotlite.model.TypeParameter
import com.sunnychung.lib.multiplatform.kotlite.model.UnitValue
import com.sunnychung.lib.multiplatform.kotlite.model.acceptsRuntimeType
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Native part of BluePlay for one session. The public classes `World`,
 * `Actor` and `Image` are interpreted Kotlin (see [BluePlayLibrary]) that call
 * the `bluek*` functions registered here. This engine is the only owner of what
 * they share: which actors a world contains and in which order, actor hit
 * identities, collision geometry, keyboard and click state, speed, and the
 * rendered frame. Objects are identified by the shared root of their
 * inheritance parts (see [identity]), never by a student's `equals`.
 */
internal class BluePlayEngine {
    private class ActCall(val node: FunctionCallNode, val function: FunctionDeclarationNode)

    private inner class WorldEntry(instance: ClassInstance) {
        var instance = instance
        private val part = instance.libraryPart(WORLD)
        val width = part.field("width")
        val height = part.field("height")
        val cellSize = part.field("cellSize")
        val background = part.field("background")
        val textX = part.field("textX")
        val textY = part.field("textY")
        val textValues = part.field("textValues")
        var act = actCall(instance); private set
        /** Keyed by [identity], in insertion order: the order of act(), painting and allObjects(). */
        val actors = LinkedHashMap<ClassInstance, ActorEntry>()
        /**
         * The same actors grouped by runtime type, each group in world order:
         * a query for a type `T` visits only the groups `T` accepts.
         */
        val groups = ArrayList<ActorGroup>()
        private var nextSequence = 0
        var backgroundImage: ImageModel? = null

        /** Replaces a reference to a superclass part with the more derived [deeper] one. */
        fun useInstance(deeper: ClassInstance) {
            instance = deeper
            act = actCall(deeper)
        }

        /** Appends [entry] to the world's order. */
        fun add(entry: ActorEntry) {
            entry.sequence = nextSequence++
            actors[entry.identity] = entry
            group(entry.instance.type()).add(entry)
        }

        fun remove(entry: ActorEntry) {
            actors.remove(entry.identity)
            entry.group?.remove(entry)
        }

        /** Moves [entry] to the group of its current runtime type. */
        fun regroup(entry: ActorEntry) {
            entry.group?.remove(entry)
            group(entry.instance.type()).add(entry)
        }

        private fun group(type: DataType): ActorGroup =
            groups.firstOrNull { it.type === type } ?: ActorGroup(type).also { groups += it }
    }

    private inner class ActorGroup(val type: DataType) {
        /** Ordered by [ActorEntry.sequence], i.e. like the world. */
        val members = ArrayList<ActorEntry>()

        fun add(entry: ActorEntry) {
            val position = members.indexOfLast { it.sequence < entry.sequence } + 1
            members.add(position, entry)
            entry.group = this
        }

        fun remove(entry: ActorEntry) {
            members.remove(entry)
            entry.group = null
        }
    }

    private inner class ActorEntry(instance: ClassInstance, val identity: ClassInstance, val hitId: String, var world: WorldEntry) {
        var instance = instance
        /** Position in the world's order. */
        var sequence = 0
        var group: ActorGroup? = null
        private val part = instance.libraryPart(ACTOR)
        val x = part.field("x")
        val y = part.field("y")
        val rotation = part.field("rotation")
        val image = part.field("image")
        val worldWidth = part.field("worldWidth")
        val worldHeight = part.field("worldHeight")
        val worldCellSize = part.field("worldCellSize")
        var act = actCall(instance); private set
        var className = escapeJson(instance.type().toTypeNode().descriptiveName()); private set
        var imageModel: ImageModel? = null
        var geometry: Geometry? = null

        /** Replaces a reference to a superclass part with the more derived [deeper] one. */
        fun useInstance(deeper: ClassInstance) {
            instance = deeper
            act = actCall(deeper)
            className = escapeJson(deeper.type().toTypeNode().descriptiveName())
        }
    }

    /**
     * Derived view of one `Image` instance: its frame JSON and parsed pixel
     * geometry. Both are recomputed whenever the image's fields or recorded
     * drawing operations differ from the ones they were derived from.
     */
    private class ImageModel(val image: ClassInstance) {
        private val path = image.field("path")
        private val width = image.field("imageWidth")
        private val height = image.field("imageHeight")
        private val transparency = image.field("transparency")
        private val operations = image.field("drawingOperations")
        /** The field values and operation entries this version was derived from, compared by identity. */
        private var derivedFrom: Array<RuntimeValue> = emptyArray()
        private var pathText = ""
        private var operationTexts = emptyList<String>()
        private var frameJson = ""
        private var drawing: BluePlayDrawing? = null
        // Visibility of the sample points of an unrotated actor, by lattice
        // (x and y offset 0 or 0.5 within a pixel); see [visibleAt].
        private val visibility = arrayOfNulls<BooleanArray>(4)
        private var visibilityVersion = -1

        var currentWidth = 30; private set
        var currentHeight = 30; private set
        var currentTransparency = 255; private set
        /** Changes whenever the derived state changes. */
        var version = 0; private set

        /** Revalidates against the live image; cheap when nothing changed. */
        fun refresh(): ImageModel {
            val operationValues = operations.list()
            val pathValue = path.read(null); val widthValue = width.read(null); val heightValue = height.read(null)
            val transparencyValue = transparency.read(null)
            if (isDerivedFrom(pathValue, widthValue, heightValue, transparencyValue, operationValues)) return this
            derivedFrom = arrayOf(pathValue, widthValue, heightValue, transparencyValue, *operationValues.toTypedArray())
            pathText = (pathValue as? StringValue)?.value.orEmpty()
            currentWidth = (widthValue as? IntValue)?.value ?: 30
            currentHeight = (heightValue as? IntValue)?.value ?: 30
            currentTransparency = (transparencyValue as? IntValue)?.value ?: 255
            operationTexts = operationValues.map { (it as? StringValue)?.value ?: "" }
            version += 1
            frameJson = "{\"resourcePath\":\"${escapeJson(pathText)}\",\"width\":$currentWidth,\"height\":$currentHeight,\"opacity\":${currentTransparency.toDouble() / 255.0},\"operations\":${operationTexts.joinToString(",", "[", "]") { "\"${escapeJson(it)}\"" }}}"
            drawing = null
            return this
        }

        private fun isDerivedFrom(path: RuntimeValue, width: RuntimeValue, height: RuntimeValue, transparency: RuntimeValue, operations: List<RuntimeValue>): Boolean {
            val previous = derivedFrom
            if (previous.size != operations.size + 4 || previous[0] !== path || previous[1] !== width || previous[2] !== height || previous[3] !== transparency) return false
            for (index in operations.indices) if (previous[index + 4] !== operations[index]) return false
            return true
        }

        fun frame(): String = refresh().frameJson

        /** Pixel geometry of the version of the last [refresh]; parsed on its first collision test. */
        fun drawing(): BluePlayDrawing =
            drawing ?: BluePlayDrawing.parse(pathText, currentWidth.coerceAtLeast(1), currentHeight.coerceAtLeast(1), 1.0, operationTexts)
                .also { drawing = it }

        /**
         * Whether the point ([x], [y]) of the image is opaque enough to collide.
         * Points with an offset of 0 or 0.5 within a pixel, as tested for an
         * unrotated actor, are answered from a map computed once per version.
         */
        fun visibleAt(x: Double, y: Double, masks: BluePlayMasks): Boolean {
            val width = currentWidth.coerceAtLeast(1); val height = currentHeight.coerceAtLeast(1)
            val column = floor(x).toInt(); val row = floor(y).toInt()
            val offsetX = x - column; val offsetY = y - row
            val lattice = (if (offsetX == 0.0) 0 else if (offsetX == 0.5) 1 else -1) + (if (offsetY == 0.0) 0 else if (offsetY == 0.5) 2 else -4)
            if (lattice < 0 || width * height > MAX_VISIBILITY_PIXELS) return visibleExactly(x, y, masks)
            if (visibilityVersion != version) {
                visibility.fill(null)
                visibilityVersion = version
            }
            val map = visibility[lattice] ?: BooleanArray(width * height) { pixel ->
                visibleExactly(pixel % width + offsetX, pixel / width + offsetY, masks)
            }.also { visibility[lattice] = it }
            return map[row * width + column]
        }

        private fun visibleExactly(x: Double, y: Double, masks: BluePlayMasks): Boolean =
            drawing().alphaAt(x, y, masks) * currentTransparency.coerceIn(0, 255) / 255 > 16
    }

    /**
     * Position, rotation and visible image of an actor, derived from the field
     * values and image version it names. Every assignment stores a new value
     * object, so identical values mean an unchanged actor (e.g. a target that
     * did not move since the last collision test).
     */
    private class Geometry(
        val x: RuntimeValue, val y: RuntimeValue, val rotation: RuntimeValue, val cellSize: RuntimeValue,
        val image: ImageModel?, val imageVersion: Int,
        val centerX: Double, val centerY: Double, val cos: Double, val sin: Double,
        val width: Int, val height: Int, val transparency: Int,
        val left: Double, val top: Double, val right: Double, val bottom: Double,
    )

    private val worlds = HashMap<ClassInstance, WorldEntry>()
    private val actors = HashMap<ClassInstance, ActorEntry>()
    private var shownWorld: WorldEntry? = null
    /** Every known resource path; the mask is null when no pixel data was prepared. */
    private val resources = LinkedHashMap<String, BluePlayResourceMask?>()
    private val masks: BluePlayMasks = { path -> resourceEntry(path)?.value }
    private val keysDown = LinkedHashSet<String>()
    private var clickX: Int? = null
    private var clickY: Int? = null
    private var clickActorId: String? = null
    private var nextActorId = 1
    private var frameVersion = 0
    /** Counts World.show() calls, so the UI can reopen a closed world window. */
    private var showCount = 0
    private var frame = ""
    private val pendingSounds = mutableListOf<String>()
    /** While a step or main() runs, intermediate states are not rendered. */
    private var batching = false
    var speed = 50; private set
    private var intent = ""
    private var runningQuery: () -> Boolean = { false }

    val hasShownWorld: Boolean get() = shownWorld != null

    /** Forgets all worlds and input; resources are kept until [setResources]. */
    fun reset() {
        worlds.clear(); actors.clear(); shownWorld = null
        keysDown.clear(); clickX = null; clickY = null; clickActorId = null
        nextActorId = 1; frameVersion = 0; showCount = 0; frame = ""; pendingSounds.clear()
        batching = false; speed = 50; intent = ""
    }

    fun setResources(manifest: String) {
        resources.clear()
        manifest.lines().filter { it.isNotEmpty() }.forEach { line ->
            val fields = line.split('\u0000')
            if (fields.size == 4 && fields[0].isNotEmpty()) {
                val width = fields[1].toIntOrNull()
                val height = fields[2].toIntOrNull()
                resources[fields[0]] =
                    if (width != null && height != null && width > 0 && height > 0 && fields[3].length >= width * height * 2)
                        BluePlayResourceMask(width, height, fields[3])
                    else null
            }
        }
    }

    /** Values that a world keeps alive natively, for the session's reachability of object handles. */
    fun retainedBy(value: RuntimeValue): List<RuntimeValue> =
        (value as? ClassInstance)?.let { worlds[it.identity()] }?.actors?.values?.map { it.instance } ?: emptyList()

    // ----- Scheduler, frames and input, used by the session -----

    fun setRunningQuery(query: () -> Boolean) { runningQuery = query }
    fun takeIntent(): String = intent.also { intent = "" }

    fun setSpeed(value: Int) {
        speed = value.coerceIn(1, 100)
        render()
    }

    fun beginBatch() { batching = true; frame = "" }
    fun endBatch() { batching = false }

    /** Renders the frame of the shown world, unless a step or main() is still running. */
    fun render() {
        if (batching) return
        shownWorld?.let { frame = renderStage(it) }
    }

    fun takeStage(): String {
        if (frame.isEmpty()) render()
        val stage = if (frame.isNotEmpty() && pendingSounds.isNotEmpty()) {
            frame.removeSuffix("}}") + ",\"sounds\":${pendingSounds.joinToString(",", "[", "]") { "\"${escapeJson(it)}\"" }}}}"
        } else frame
        frame = ""
        pendingSounds.clear()
        return stage
    }

    fun setKey(key: String, pressed: Boolean) {
        if (pressed) keysDown += key.lowercase() else keysDown -= key.lowercase()
    }

    fun setClick(x: Int, y: Int, actorId: String) {
        clickX = x; clickY = y; clickActorId = actorId.ifEmpty { null }
    }

    /**
     * One simulation step like BlueJ: `World.act()`, then `act()` of every actor
     * that the world contained afterwards and still contains when its turn comes.
     */
    suspend fun step(interpreter: Interpreter) {
        val world = shownWorld ?: return
        world.act?.let { invoke(interpreter, world.instance, it) }
        for (entry in world.actors.values.toList()) {
            val current = actors[entry.identity] ?: continue
            if (current.world !== world) continue
            current.act?.let { invoke(interpreter, current.instance, it) }
        }
    }

    private suspend fun invoke(interpreter: Interpreter, target: ClassInstance, call: ActCall) {
        with(interpreter) { call.node.evalClassMemberAnyFunctionCall(target, call.function) }
    }

    // ----- Native functions of the library -----

    fun register(environment: ExecutionEnvironment) {
        fun function(
            name: String, returnType: String, parameters: List<CustomFunctionParameter>, typed: Boolean = false,
            executable: (Interpreter, List<RuntimeValue>, Map<String, DataType>) -> RuntimeValue,
        ) = environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = name,
            returnType = returnType,
            // A reified type argument filters by the caller's class, like filterIsInstance<T>().
            typeParameters = if (typed) listOf(TypeParameter("T", null).also { it.isReified = true }) else emptyList(),
            parameterTypes = parameters,
            modifiers = if (typed) setOf(FunctionModifier.inline) else emptySet(),
            executable = { interpreter, _, args, typeArgs -> executable(interpreter, args, typeArgs) },
        ))
        fun parameter(name: String, type: String = "Any") = CustomFunctionParameter(name, type)
        fun Interpreter.int(value: Int) = IntValue(value, symbolTable())
        fun Interpreter.boolean(value: Boolean) = BooleanValue(value, symbolTable())
        fun List<RuntimeValue>.int(index: Int) = (this[index] as IntValue).value
        fun List<RuntimeValue>.instance(index: Int) = this[index] as ClassInstance
        fun Map<String, DataType>.target() = this["T"] ?: throw IllegalStateException("Missing reified type argument T")

        // These bridge functions take Any: the library classes are declared by
        // interpreted source after this setup. The library provides the typed API.
        function("bluekImageWidth", "Int", listOf(parameter("path", "String"))) { interpreter, args, _ ->
            val path = (args[0] as StringValue).value
            requireResource(path)
            interpreter.int(masks(path)?.width ?: 30)
        }
        function("bluekImageHeight", "Int", listOf(parameter("path", "String"))) { interpreter, args, _ ->
            val path = (args[0] as StringValue).value
            requireResource(path)
            interpreter.int(masks(path)?.height ?: 30)
        }
        function("bluekImageSnapshot", "String", listOf(parameter("image"))) { interpreter, args, _ ->
            StringValue(ImageModel(args.instance(0)).frame(), interpreter.symbolTable())
        }
        function("bluekCheckColor", "Unit", listOf(parameter("r", "Int"), parameter("g", "Int"), parameter("b", "Int"))) { _, args, _ ->
            require(args.all { (it as IntValue).value in 0..255 }) { "Color components must be in 0..255." }
            UnitValue
        }
        function("bluekShowWorld", "Unit", listOf(parameter("world"))) { _, args, _ ->
            shownWorld = world(args.instance(0))
            showCount++
            intent = "stop"
            UnitValue
        }
        function("bluekWorldAddObject", "Unit", listOf(parameter("world"), parameter("actor"), parameter("x", "Int"), parameter("y", "Int"))) { interpreter, args, _ ->
            addObject(interpreter, world(args.instance(0)), args.instance(1), args.int(2), args.int(3))
            UnitValue
        }
        function("bluekWorldRemoveObject", "Unit", listOf(parameter("world"), parameter("actor"))) { interpreter, args, _ ->
            val entry = actors[args.instance(1).identity()]
            if (entry != null && entry.world.instance.identity() === args.instance(0).identity()) removeObject(interpreter, entry)
            UnitValue
        }
        function("bluekWorldObjects", "List<T>", listOf(parameter("world")), typed = true) { interpreter, args, typeArgs ->
            val target = typeArgs.target()
            val world = worlds[args.instance(0).identity()]
            ListValue(world?.let { contained(it, target) { true } }.orEmpty().map { it.instance }, target, interpreter.symbolTable())
        }
        function("bluekWorldObjectsAt", "List<T>", listOf(parameter("world"), parameter("x", "Int"), parameter("y", "Int")), typed = true) { interpreter, args, typeArgs ->
            val target = typeArgs.target()
            val x = args.int(1); val y = args.int(2)
            val world = worlds[args.instance(0).identity()]
            ListValue(world?.let { contained(it, target) { entry -> entry.x.int() == x && entry.y.int() == y } }.orEmpty().map { it.instance },
                target, interpreter.symbolTable())
        }
        function("bluekWorldObjectCount", "Int", listOf(parameter("world"))) { interpreter, args, _ ->
            interpreter.int(worlds[args.instance(0).identity()]?.actors?.size ?: 0)
        }
        function("bluekActorWorld", "T", listOf(parameter("actor")), typed = true) { _, args, _ ->
            requireActor(args.instance(0)).world.instance
        }
        function("bluekIntersects", "Boolean", listOf(parameter("first"), parameter("second"))) { interpreter, args, _ ->
            val first = requireActor(args.instance(0)); val second = requireActor(args.instance(1))
            interpreter.boolean(intersects(geometry(first), geometry(second)))
        }
        function("bluekIntersecting", "List<T>", listOf(parameter("actor")), typed = true) { interpreter, args, typeArgs ->
            val target = typeArgs.target()
            ListValue(intersecting(requireActor(args.instance(0)), target, firstOnly = false).map { it.instance }, target, interpreter.symbolTable())
        }
        function("bluekOneIntersecting", "T?", listOf(parameter("actor")), typed = true) { _, args, typeArgs ->
            intersecting(requireActor(args.instance(0)), typeArgs.target(), firstOnly = true).firstOrNull()?.instance ?: NullValue
        }
        function("bluekIsTouching", "Boolean", listOf(parameter("actor")), typed = true) { interpreter, args, typeArgs ->
            interpreter.boolean(intersecting(requireActor(args.instance(0)), typeArgs.target(), firstOnly = true).isNotEmpty())
        }
        function("bluekRemoveTouching", "Unit", listOf(parameter("actor")), typed = true) { interpreter, args, typeArgs ->
            intersecting(requireActor(args.instance(0)), typeArgs.target(), firstOnly = true).firstOrNull()?.let { removeObject(interpreter, it) }
            UnitValue
        }
        function("bluekIsActorClicked", "Boolean", listOf(parameter("actor"))) { interpreter, args, _ ->
            val entry = requireActor(args.instance(0))
            val matches = if (!clickActorId.isNullOrEmpty()) clickActorId == entry.hitId
                else clickX == entry.x.int() && clickY == entry.y.int()
            if (matches) { clickX = null; clickY = null; clickActorId = null }
            interpreter.boolean(matches)
        }
        function("bluekIsWorldClicked", "Boolean", emptyList()) { interpreter, _, _ ->
            val matches = clickX != null && clickY != null && clickActorId.isNullOrEmpty()
            if (matches) { clickX = null; clickY = null; clickActorId = null }
            interpreter.boolean(matches)
        }
        function("bluekIsKeyDown", "Boolean", listOf(parameter("key", "String"))) { interpreter, args, _ ->
            interpreter.boolean(keysDown.contains((args[0] as StringValue).value.lowercase()))
        }
        function("bluekHeading", "Int", listOf(parameter("fromX", "Int"), parameter("fromY", "Int"), parameter("toX", "Int"), parameter("toY", "Int"))) { interpreter, args, _ ->
            val fromX = args.int(0); val fromY = args.int(1); val toX = args.int(2); val toY = args.int(3)
            val angle = if (fromX == toX && fromY == toY) 0 else (atan2((toY - fromY).toDouble(), (toX - fromX).toDouble()) * 180.0 / PI).roundToInt()
            interpreter.int((angle + 360) % 360)
        }
        function("bluekDistance", "Int", listOf(parameter("firstX", "Int"), parameter("firstY", "Int"), parameter("secondX", "Int"), parameter("secondY", "Int"))) { interpreter, args, _ ->
            val dx = (args.int(2) - args.int(0)).toDouble()
            val dy = (args.int(3) - args.int(1)).toDouble()
            interpreter.int(sqrt(dx * dx + dy * dy).roundToInt())
        }
        function("bluekMoveDeltaX", "Int", listOf(parameter("rotation", "Int"), parameter("distance", "Int"))) { interpreter, args, _ ->
            interpreter.int((cos(args.int(0).toDouble() * PI / 180.0) * args.int(1)).roundToInt())
        }
        function("bluekMoveDeltaY", "Int", listOf(parameter("rotation", "Int"), parameter("distance", "Int"))) { interpreter, args, _ ->
            interpreter.int((sin(args.int(0).toDouble() * PI / 180.0) * args.int(1)).roundToInt())
        }
        function("bluekPlaySound", "Unit", listOf(parameter("fileName", "String"))) { _, args, _ ->
            pendingSounds += (args[0] as StringValue).value
            UnitValue
        }
        val step = CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekStep",
            returnType = "Unit",
            parameterTypes = emptyList(),
            executable = { _, _, _, _ -> UnitValue },
        )
        // Like BlueJ, step() is ignored while the simulation runs.
        step.suspendExecutable = { interpreter, _, _, _ ->
            if (intent != "start" && (intent == "stop" || !runningQuery())) step(interpreter)
            UnitValue
        }
        environment.registerFunction(step)
        function("bluekSimulationStart", "Unit", emptyList()) { _, _, _ -> intent = "start"; UnitValue }
        function("bluekSimulationStop", "Unit", emptyList()) { _, _, _ -> intent = "stop"; UnitValue }
        function("bluekGetSpeed", "Int", emptyList()) { interpreter, _, _ -> interpreter.int(speed) }
        function("bluekSetSpeed", "Unit", listOf(parameter("speed", "Int"))) { _, args, _ -> setSpeed(args.int(0)); UnitValue }
    }

    // ----- World membership -----

    private fun world(instance: ClassInstance): WorldEntry {
        val entry = worlds.getOrPut(instance.identity()) { WorldEntry(instance) }
        // A reference to a superclass part (e.g. via `super`) must not hide the
        // most derived object, whose act() and type the engine needs.
        if (instance.depth() > entry.instance.depth()) entry.useInstance(instance)
        return entry
    }

    private fun requireActor(instance: ClassInstance): ActorEntry =
        actors[instance.identity()] ?: throw IllegalStateException("The actor is not in a world (add it with addObject first).")

    private fun addObject(interpreter: Interpreter, world: WorldEntry, instance: ClassInstance, x: Int, y: Int) {
        val identity = instance.identity()
        val existing = actors[identity]
        val entry = when {
            existing == null -> ActorEntry(instance, identity, "actor-${nextActorId++}", world).also { world.add(it) }
            // Re-adding an actor to its own world keeps its position in the order.
            existing.world === world -> existing
            else -> existing.also {
                it.world.remove(it)
                it.world = world
                world.add(it)
            }
        }
        actors[identity] = entry
        if (instance.depth() > entry.instance.depth()) {
            entry.useInstance(instance)
            world.regroup(entry)
        }
        val width = world.width.int()
        val height = world.height.int()
        entry.worldWidth.assign(null, IntValue(width, interpreter.symbolTable()))
        entry.worldHeight.assign(null, IntValue(height, interpreter.symbolTable()))
        entry.worldCellSize.assign(null, IntValue(world.cellSize.int(), interpreter.symbolTable()))
        // The library's x/y setters clamp exactly like this; they are final.
        entry.x.assign(null, IntValue(x.coerceIn(0, width - 1), interpreter.symbolTable()))
        entry.y.assign(null, IntValue(y.coerceIn(0, height - 1), interpreter.symbolTable()))
    }

    private fun removeObject(interpreter: Interpreter, entry: ActorEntry) {
        entry.world.remove(entry)
        // The hit id is forgotten with the entry; a re-added actor gets a new one.
        actors.remove(entry.identity)
        entry.worldWidth.assign(null, IntValue(0, interpreter.symbolTable()))
        entry.worldHeight.assign(null, IntValue(0, interpreter.symbolTable()))
        entry.worldCellSize.assign(null, IntValue(1, interpreter.symbolTable()))
    }

    // ----- Collision -----

    /**
     * The actors of [world] that are instances of [target] and match [filter],
     * in world order, or with [firstOnly] the first of them. Only the groups of
     * accepted runtime types are visited.
     */
    private inline fun contained(world: WorldEntry, target: DataType, firstOnly: Boolean = false, filter: (ActorEntry) -> Boolean): List<ActorEntry> {
        var first: ActorEntry? = null
        val result = ArrayList<ActorEntry>()
        var acceptedGroups = 0
        for (group in world.groups) {
            if (group.members.isEmpty() || !target.acceptsRuntimeType(group.type)) continue
            acceptedGroups += 1
            for (entry in group.members) {
                // A group is in world order: nothing later can precede the first found.
                if (firstOnly && first != null && entry.sequence > first.sequence) break
                if (!filter(entry)) continue
                if (firstOnly) { first = entry; break }
                result += entry
            }
        }
        if (firstOnly) return listOfNotNull(first)
        if (acceptedGroups > 1) result.sortBy { it.sequence }
        return result
    }

    /** Actors of the world of [actor] that are instances of [target] and touch it, in world order. */
    private fun intersecting(actor: ActorEntry, target: DataType, firstOnly: Boolean): List<ActorEntry> {
        val own = geometry(actor)
        return contained(actor.world, target, firstOnly) { other -> other !== actor && intersects(own, geometry(other)) }
    }

    /** The model of the actor's current image; null for an actor without image. */
    private fun imageOf(entry: ActorEntry): ImageModel? {
        val instance = entry.image.read(null) as? ClassInstance ?: return null
        return entry.imageModel?.takeIf { it.image === instance } ?: ImageModel(instance).also { entry.imageModel = it }
    }

    private fun geometry(entry: ActorEntry): Geometry {
        val x = entry.x.read(null); val y = entry.y.read(null)
        val rotation = entry.rotation.read(null); val cellSize = entry.worldCellSize.read(null)
        val image = imageOf(entry)?.refresh()
        val imageVersion = image?.version ?: 0
        entry.geometry?.let { cached ->
            if (cached.x === x && cached.y === y && cached.rotation === rotation && cached.cellSize === cellSize &&
                cached.image === image && cached.imageVersion == imageVersion) return cached
        }
        val width = image?.currentWidth ?: 30
        val height = image?.currentHeight ?: 30
        val cell = ((cellSize as? IntValue)?.value ?: 0).coerceAtLeast(1)
        val centerX = (((x as? IntValue)?.value ?: 0) + 0.5) * cell
        val centerY = (((y as? IntValue)?.value ?: 0) + 0.5) * cell
        val radians = ((rotation as? IntValue)?.value ?: 0) * PI / 180.0
        val cosine = cos(radians); val sine = sin(radians)
        val boundsWidth = width.toDouble().coerceAtLeast(1.0); val boundsHeight = height.toDouble().coerceAtLeast(1.0)
        val halfWidth = (abs(cosine) * boundsWidth + abs(sine) * boundsHeight) / 2.0
        val halfHeight = (abs(sine) * boundsWidth + abs(cosine) * boundsHeight) / 2.0
        return Geometry(x, y, rotation, cellSize, image, imageVersion,
            centerX, centerY, cosine, sine, width.coerceAtLeast(1), height.coerceAtLeast(1),
            image?.currentTransparency?.coerceIn(0, 255) ?: 255,
            centerX - halfWidth, centerY - halfHeight, centerX + halfWidth, centerY + halfHeight).also { entry.geometry = it }
    }

    /** Visible pixels overlap: a pixel centre inside both rotated images where both are opaque enough. */
    private fun intersects(first: Geometry, second: Geometry): Boolean {
        val left = max(first.left, second.left)
        val top = max(first.top, second.top)
        val right = min(first.right, second.right)
        val bottom = min(first.bottom, second.bottom)
        if (left >= right || top >= bottom) return false
        val firstX = floor(left).toInt(); val lastX = ceil(right).toInt()
        var y = floor(top).toInt()
        val lastY = ceil(bottom).toInt()
        while (y < lastY) {
            var x = firstX
            while (x < lastX) {
                if (visible(first, x + 0.5, y + 0.5) && visible(second, x + 0.5, y + 0.5)) return true
                x += 1
            }
            y += 1
        }
        return false
    }

    private fun visible(geometry: Geometry, worldX: Double, worldY: Double): Boolean {
        // An actor without image is a fully visible placeholder.
        val image = geometry.image ?: return true
        if (geometry.transparency <= 16) return false
        val dx = worldX - geometry.centerX; val dy = worldY - geometry.centerY
        val localX = geometry.cos * dx + geometry.sin * dy + geometry.width / 2.0
        val localY = -geometry.sin * dx + geometry.cos * dy + geometry.height / 2.0
        if (localX < 0 || localY < 0 || localX >= geometry.width || localY >= geometry.height) return false
        // Unrotated, the points tested lie on a fixed lattice of the image.
        if (geometry.cos == 1.0 && geometry.sin == 0.0) return image.visibleAt(localX, localY, masks)
        return image.drawing().alphaAt(localX, localY, masks) * geometry.transparency / 255 > 16
    }

    // ----- Resources -----

    private fun resourceEntry(path: String): Map.Entry<String, BluePlayResourceMask?>? =
        resources.entries.firstOrNull { it.key == path }
            ?: resources.entries.firstOrNull { it.key == "images/$path" }
            ?: resources.entries.firstOrNull { it.key.endsWith("/$path") }

    /**
     * Mirrors BluePlay's own message for a file that is not there, so a typo in
     * `Image("duckk.png")` fails loudly instead of yielding an invisible 30x30
     * placeholder. The names help with a misspelled standard graphic.
     */
    private fun requireResource(path: String) {
        if (resourceEntry(path) != null) return
        val available = resources.keys
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

    // ----- Frames -----

    /**
     * The frame of the shown world. Each distinct image appears once in
     * `images`; actors refer to it by index (many actors usually look alike).
     */
    private fun renderStage(world: WorldEntry): String {
        val images = StringBuilder("[")
        val imageIndexes = StringIndex()
        var imageCount = 0
        val objects = StringBuilder("[")
        for (entry in world.actors.values) {
            if (objects.length > 1) objects.append(',')
            val image = imageOf(entry)?.frame() ?: PLACEHOLDER_IMAGE
            var index = imageIndexes[image]
            if (index < 0) {
                index = imageCount++
                imageIndexes[image] = index
                if (images.length > 1) images.append(',')
                images.append(image)
            }
            objects.append("{\"hitId\":\"").append(entry.hitId).append("\",\"className\":\"").append(entry.className)
                .append("\",\"x\":").append(entry.x.int()).append(",\"y\":").append(entry.y.int())
                .append(",\"rotation\":").append(entry.rotation.int()).append(",\"image\":").append(index).append('}')
        }
        images.append(']')
        objects.append(']')
        val textX = world.textX.list(); val textY = world.textY.list(); val textValues = world.textValues.list()
        val texts = textValues.indices.joinToString(",", "[", "]") { index ->
            "{\"x\":${(textX.getOrNull(index) as? IntValue)?.value ?: 0},\"y\":${(textY.getOrNull(index) as? IntValue)?.value ?: 0},\"text\":\"${escapeJson((textValues[index] as? StringValue)?.value ?: "")}\"}"
        }
        val backgroundInstance = world.background.read(null) as? ClassInstance
        val background = backgroundInstance?.let { instance ->
            world.backgroundImage?.takeIf { it.image === instance } ?: ImageModel(instance).also { world.backgroundImage = it }
        }
        return "{\"stage\":{\"frameVersion\":${++frameVersion},\"showCount\":$showCount,\"width\":${world.width.int()},\"height\":${world.height.int()},\"cellSize\":${world.cellSize.int()},\"backgroundColor\":\"rgb(255,255,255)\",\"background\":${background?.frame() ?: PLACEHOLDER_IMAGE},\"speed\":$speed,\"simulation\":\"paused\",\"images\":$images,\"objects\":$objects,\"texts\":$texts}}"
    }

    private companion object {
        const val WORLD = "World"
        const val ACTOR = "Actor"
        /** Larger images are tested pixel by pixel instead of keeping a visibility map. */
        const val MAX_VISIBILITY_PIXELS = 256 * 256
        const val PLACEHOLDER_IMAGE = "{\"width\":30,\"height\":30,\"opacity\":1,\"operations\":[\"fill|rgb(180,180,190)\",\"drawRect|0|0|29|29|rgb(90,90,100)\",\"drawString|?|12|20|rgb(90,90,100)\"]}"

        /** The storage of a library field; reading it never runs a getter. */
        fun ClassInstance.field(name: String): RuntimeValueAccessor =
            getPropertyHolder(name) ?: throw IllegalStateException("The BluePlay field $name is missing.")

        fun RuntimeValueAccessor.int(): Int = (read(null) as? IntValue)?.value ?: 0
        fun RuntimeValueAccessor.list(): List<RuntimeValue> = (read(null) as? DelegatedValue<*>)?.value as? List<RuntimeValue> ?: emptyList()

        /**
         * The shared root of an object's inheritance parts. Every part (e.g. the
         * `Actor` part of a `Laser`) maps to the same root, whose class `Any`
         * compares and hashes by identity.
         */
        fun ClassInstance.identity(): ClassInstance {
            var instance = this
            while (true) instance = instance.parentInstance ?: return instance
        }

        fun ClassInstance.depth(): Int {
            var depth = 0
            var instance: ClassInstance? = parentInstance
            while (instance != null) { depth += 1; instance = instance.parentInstance }
            return depth
        }

        /** The part declared by the library class, so a subclass field of the same name cannot shadow it. */
        fun ClassInstance.libraryPart(className: String): ClassInstance {
            var instance: ClassInstance? = this
            while (instance != null) {
                if (instance.type().name == className) return instance
                instance = instance.parentInstance
            }
            throw IllegalStateException("A BluePlay $className was expected.")
        }

        /** Most actors inherit the empty default act(); skipping it has no observable effect. */
        fun actCall(instance: ClassInstance): ActCall? {
            val function = instance.findMemberFunctionByDeclaredName("act") ?: return null
            if (function.body?.statements?.isEmpty() == true) return null
            // Called by the library: no frame of the student's source below act() in stack traces.
            return ActCall(FunctionCallNode(function, emptyList(), emptyList(), SourcePosition.BUILTIN), function)
        }
    }
}
