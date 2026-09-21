import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.model.CharValue
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.DataType
import com.sunnychung.lib.multiplatform.kotlite.model.DelegatedValue
import com.sunnychung.lib.multiplatform.kotlite.model.DoubleValue
import com.sunnychung.lib.multiplatform.kotlite.model.ExtensionProperty
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionModifier
import com.sunnychung.lib.multiplatform.kotlite.model.GlobalProperty
import com.sunnychung.lib.multiplatform.kotlite.model.IntValue
import com.sunnychung.lib.multiplatform.kotlite.model.IteratorValue
import com.sunnychung.lib.multiplatform.kotlite.model.LambdaValue
import com.sunnychung.lib.multiplatform.kotlite.model.LibraryModule
import com.sunnychung.lib.multiplatform.kotlite.model.ListValue
import com.sunnychung.lib.multiplatform.kotlite.model.ProvidedClassDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.StringValue
import com.sunnychung.lib.multiplatform.kotlite.model.SymbolTable
import com.sunnychung.lib.multiplatform.kotlite.model.TypeParameter

/**
 * Kotlin standard library surface that Kotlite 1.1.0 does not provide, but
 * that ordinary school Kotlin relies on. Grouped as in
 * `docs/kotlin-surface.md`: number helpers, list aggregates and the
 * character-sequence side of String.
 *
 * These are native definitions rather than interpreted Kotlin, because
 * BluePlay calls some of them (clamping in particular) once per frame per
 * actor. See `scripts/smoke-kotlin-surface.mjs` for the covered surface.
 */
object BlueKStdlibModule : LibraryModule("bluek-stdlib") {

    private val BUILTIN = SourcePosition.BUILTIN

    private fun function(
        receiverType: String?,
        name: String,
        returnType: String,
        parameters: List<CustomFunctionParameter> = emptyList(),
        typeParameters: List<TypeParameter> = emptyList(),
        modifiers: Set<FunctionModifier> = emptySet(),
        executable: (Interpreter, RuntimeValue?, List<RuntimeValue>, Map<String, DataType>) -> RuntimeValue,
    ) = CustomFunctionDefinition(
        position = BUILTIN,
        receiverType = receiverType,
        functionName = name,
        returnType = returnType,
        typeParameters = typeParameters,
        parameterTypes = parameters,
        modifiers = modifiers,
        executable = executable,
    )

    /**
     * Callbacks may cross a `readln` suspension, so lambda-taking functions
     * are registered with a suspendable implementation (as the `count` patch
     * in `KotliteSession` does for the published stdlib).
     */
    private fun suspendFunction(
        receiverType: String?,
        name: String,
        returnType: String,
        parameters: List<CustomFunctionParameter>,
        typeParameters: List<TypeParameter> = emptyList(),
        executable: suspend (Interpreter, RuntimeValue?, List<RuntimeValue>, Map<String, DataType>) -> RuntimeValue,
    ) = function(receiverType, name, returnType, parameters, typeParameters) { _, _, _, _ ->
        throw IllegalStateException("$name requires asynchronous evaluation")
    }.also { it.suspendExecutable = executable }

    private fun parameter(name: String, type: String, modifiers: Set<String> = emptySet()) =
        CustomFunctionParameter(name, type, null, modifiers)

    /** Kotlite allows `vararg` only as the sole parameter, so `minOf(a, vararg b)` is not expressible. */
    private fun varargValues(arguments: List<RuntimeValue>, name: String): List<RuntimeValue> {
        val values = (arguments.firstOrNull() as? DelegatedValue<*>)?.value as? List<RuntimeValue>
            ?: throw IllegalStateException("$name expects at least one value")
        if (values.isEmpty()) throw IllegalStateException("$name needs at least one value")
        return values
    }

    private fun ints(value: RuntimeValue): Int = (value as IntValue).value
    private fun doubles(value: RuntimeValue): Double = (value as DoubleValue).value

    /**
     * Ranges are `PrimitiveIterable`s holding unwrapped Kotlin values, while
     * lists hold `RuntimeValue`s. Both reach these aggregates.
     */
    private fun elements(receiver: RuntimeValue?): List<Any?> =
        ((receiver as DelegatedValue<*>).value as Iterable<Any?>).toList()

    /** Range elements arrive as raw Kotlin values; list elements are already wrapped. */
    private fun asRuntimeValue(element: Any?, symbolTable: SymbolTable): RuntimeValue = when (element) {
        is RuntimeValue -> element
        is Int -> IntValue(element, symbolTable)
        is Double -> DoubleValue(element, symbolTable)
        is Char -> CharValue(element, symbolTable)
        is String -> StringValue(element, symbolTable)
        else -> throw IllegalStateException("Unsupported element type")
    }

    private fun elementAsInt(element: Any?): Int = when (element) {
        is IntValue -> element.value
        is Int -> element
        else -> throw IllegalStateException("Expected an Int element")
    }

    private fun elementAsDouble(element: Any?): Double = when (element) {
        is DoubleValue -> element.value
        is Double -> element
        else -> throw IllegalStateException("Expected a Double element")
    }

    // ---- B: number helpers -------------------------------------------------

    private val numberFunctions = listOf(
        function(null, "minOf", "Int", listOf(parameter("values", "Int", setOf("vararg")))) { interpreter, _, args, _ ->
            IntValue(varargValues(args, "minOf").minOf { ints(it) }, interpreter.symbolTable())
        },
        function(null, "maxOf", "Int", listOf(parameter("values", "Int", setOf("vararg")))) { interpreter, _, args, _ ->
            IntValue(varargValues(args, "maxOf").maxOf { ints(it) }, interpreter.symbolTable())
        },
        function(null, "minOf", "Double", listOf(parameter("values", "Double", setOf("vararg")))) { interpreter, _, args, _ ->
            DoubleValue(varargValues(args, "minOf").minOf { doubles(it) }, interpreter.symbolTable())
        },
        function(null, "maxOf", "Double", listOf(parameter("values", "Double", setOf("vararg")))) { interpreter, _, args, _ ->
            DoubleValue(varargValues(args, "maxOf").maxOf { doubles(it) }, interpreter.symbolTable())
        },
        function("Int", "coerceIn", "Int", listOf(parameter("minimumValue", "Int"), parameter("maximumValue", "Int"))) { interpreter, receiver, args, _ ->
            val minimum = ints(args[0])
            val maximum = ints(args[1])
            if (minimum > maximum) throw IllegalArgumentException("Cannot coerce to an empty range: maximum $maximum is less than minimum $minimum.")
            IntValue(ints(receiver!!).coerceIn(minimum, maximum), interpreter.symbolTable())
        },
        function("Int", "coerceAtLeast", "Int", listOf(parameter("minimumValue", "Int"))) { interpreter, receiver, args, _ ->
            IntValue(ints(receiver!!).coerceAtLeast(ints(args[0])), interpreter.symbolTable())
        },
        function("Int", "coerceAtMost", "Int", listOf(parameter("maximumValue", "Int"))) { interpreter, receiver, args, _ ->
            IntValue(ints(receiver!!).coerceAtMost(ints(args[0])), interpreter.symbolTable())
        },
        function("Double", "coerceIn", "Double", listOf(parameter("minimumValue", "Double"), parameter("maximumValue", "Double"))) { interpreter, receiver, args, _ ->
            val minimum = doubles(args[0])
            val maximum = doubles(args[1])
            if (minimum > maximum) throw IllegalArgumentException("Cannot coerce to an empty range: maximum $maximum is less than minimum $minimum.")
            DoubleValue(doubles(receiver!!).coerceIn(minimum, maximum), interpreter.symbolTable())
        },
        function("Double", "coerceAtLeast", "Double", listOf(parameter("minimumValue", "Double"))) { interpreter, receiver, args, _ ->
            DoubleValue(doubles(receiver!!).coerceAtLeast(doubles(args[0])), interpreter.symbolTable())
        },
        function("Double", "coerceAtMost", "Double", listOf(parameter("maximumValue", "Double"))) { interpreter, receiver, args, _ ->
            DoubleValue(doubles(receiver!!).coerceAtMost(doubles(args[0])), interpreter.symbolTable())
        },
        function("Int", "toChar", "Char") { interpreter, receiver, _, _ ->
            CharValue(ints(receiver!!).toChar(), interpreter.symbolTable())
        },
        function("Char", "digitToInt", "Int") { interpreter, receiver, _, _ ->
            val char = (receiver as CharValue).value
            if (!char.isDigit()) throw IllegalArgumentException("Char $char is not a decimal digit")
            IntValue(char.digitToInt(), interpreter.symbolTable())
        },
    )

    /**
     * `Int.MAX_VALUE` resolves through the synthetic companion type that the
     * analyzer unboxes for a class reference.
     */
    private val numberProperties = listOf(
        ExtensionProperty(
            declaredName = "MAX_VALUE",
            receiver = "Int.Companion",
            type = "Int",
            getter = { interpreter, _, _ -> IntValue(Int.MAX_VALUE, interpreter.symbolTable()) },
        ),
        ExtensionProperty(
            declaredName = "MIN_VALUE",
            receiver = "Int.Companion",
            type = "Int",
            getter = { interpreter, _, _ -> IntValue(Int.MIN_VALUE, interpreter.symbolTable()) },
        ),
    )

    // ---- C: list aggregates ------------------------------------------------

    private val listFunctions = listOf(
        function("Iterable<Int>", "sum", "Int") { interpreter, receiver, _, _ ->
            IntValue(elements(receiver).sumOf { elementAsInt(it) }, interpreter.symbolTable())
        },
        function("Iterable<Double>", "sum", "Double") { interpreter, receiver, _, _ ->
            DoubleValue(elements(receiver).sumOf { elementAsDouble(it) }, interpreter.symbolTable())
        },
        function("Iterable<Int>", "average", "Double") { interpreter, receiver, _, _ ->
            val values = elements(receiver).map { elementAsInt(it) }
            DoubleValue(if (values.isEmpty()) Double.NaN else values.sum().toDouble() / values.size, interpreter.symbolTable())
        },
        suspendFunction(
            "Iterable<T>", "sumOf", "Int",
            listOf(parameter("selector", "(T) -> Int")),
            listOf(TypeParameter("T", null)),
        ) { interpreter, receiver, args, _ ->
            val selector = args[0] as LambdaValue
            var total = 0
            for (element in elements(receiver)) {
                total += (selector.executeSuspended(arrayOf(asRuntimeValue(element, interpreter.symbolTable()))) as IntValue).value
            }
            IntValue(total, interpreter.symbolTable())
        },
        suspendFunction(
            "Iterable<T>", "reduce", "T",
            listOf(parameter("operation", "(T, T) -> T")),
            listOf(TypeParameter("T", null)),
        ) { interpreter, receiver, args, _ ->
            val operation = args[0] as LambdaValue
            val symbolTable = interpreter.symbolTable()
            val values = elements(receiver)
            if (values.isEmpty()) throw UnsupportedOperationException("Empty collection can't be reduced.")
            var accumulator = asRuntimeValue(values[0], symbolTable)
            for (index in 1 until values.size) {
                accumulator = operation.executeSuspended(arrayOf(accumulator, asRuntimeValue(values[index], symbolTable)))
            }
            accumulator
        },
        function("Iterable<List<T>>", "flatten", "List<T>", typeParameters = listOf(TypeParameter("T", null))) { interpreter, receiver, _, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val nested = elements(receiver).flatMap { (it as DelegatedValue<*>).value as Iterable<RuntimeValue> }
            ListValue(nested, typeArgs["T"] ?: symbolTable.IntType, symbolTable)
        },
        function("Iterable<Double>", "average", "Double") { interpreter, receiver, _, _ ->
            val values = elements(receiver).map { elementAsDouble(it) }
            DoubleValue(if (values.isEmpty()) Double.NaN else values.sum() / values.size, interpreter.symbolTable())
        },
    )

    /** `List.lastIndex` already exists in the Kotlite stdlib; extension property names are global. */
    private val listProperties = listOf(
        ExtensionProperty(
            declaredName = "indices",
            typeParameters = listOf(TypeParameter("T", null)),
            receiver = "List<T>",
            type = "List<Int>",
            getter = { interpreter, receiver, _ ->
                val symbolTable = interpreter.symbolTable()
                val size = ((receiver as DelegatedValue<*>).value as List<*>).size
                ListValue((0 until size).map { IntValue(it, symbolTable) }, symbolTable.IntType, symbolTable)
            },
        ),
    )

    // ---- A: String as a character sequence ---------------------------------

    private fun text(receiver: RuntimeValue?): String = (receiver as StringValue).value

    private val stringFunctions = listOf(
        function("String", "iterator", "Iterator<Char>") { interpreter, receiver, _, _ ->
            val symbolTable = interpreter.symbolTable()
            val chars: List<RuntimeValue> = text(receiver).map { CharValue(it, symbolTable) }
            IteratorValue(chars.iterator(), symbolTable.CharType, symbolTable)
        },
        function("String", "get", "Char", listOf(parameter("index", "Int")), modifiers = setOf(FunctionModifier.operator)) { interpreter, receiver, args, _ ->
            val value = text(receiver)
            val index = ints(args[0])
            if (index !in value.indices) {
                throw IndexOutOfBoundsException("index: $index, length: ${value.length}")
            }
            CharValue(value[index], interpreter.symbolTable())
        },
        function("String", "split", "List<String>", listOf(parameter("delimiter", "String"))) { interpreter, receiver, args, _ ->
            val symbolTable = interpreter.symbolTable()
            val delimiter = (args[0] as StringValue).value
            if (delimiter.isEmpty()) throw IllegalArgumentException("split needs a non-empty delimiter")
            ListValue(text(receiver).split(delimiter).map { StringValue(it, symbolTable) }, symbolTable.StringType, symbolTable)
        },
        function("String", "split", "List<String>", listOf(parameter("delimiter", "Char"))) { interpreter, receiver, args, _ ->
            val symbolTable = interpreter.symbolTable()
            val delimiter = (args[0] as CharValue).value
            ListValue(text(receiver).split(delimiter).map { StringValue(it, symbolTable) }, symbolTable.StringType, symbolTable)
        },
        function("String", "toList", "List<Char>") { interpreter, receiver, _, _ ->
            val symbolTable = interpreter.symbolTable()
            ListValue(text(receiver).map { CharValue(it, symbolTable) }, symbolTable.CharType, symbolTable)
        },
    )

    private val stringProperties = listOf(
        ExtensionProperty(
            declaredName = "indices",
            receiver = "String",
            type = "List<Int>",
            getter = { interpreter, receiver, _ ->
                val symbolTable = interpreter.symbolTable()
                ListValue(text(receiver).indices.map { IntValue(it, symbolTable) }, symbolTable.IntType, symbolTable)
            },
        ),
        ExtensionProperty(
            declaredName = "code",
            receiver = "Char",
            type = "Int",
            getter = { interpreter, receiver, _ ->
                IntValue((receiver as CharValue).value.code, interpreter.symbolTable())
            },
        ),
    )

    override val classes: List<ProvidedClassDefinition> = emptyList()
    override val properties: List<ExtensionProperty> = numberProperties + listProperties + stringProperties
    override val globalProperties: List<GlobalProperty> = emptyList()
    override val functions: List<CustomFunctionDefinition> = numberFunctions + listFunctions + stringFunctions
}
