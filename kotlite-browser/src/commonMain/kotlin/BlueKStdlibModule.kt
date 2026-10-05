import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.model.AnyClass
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.CharValue
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
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
import com.sunnychung.lib.multiplatform.kotlite.model.LongValue
import com.sunnychung.lib.multiplatform.kotlite.model.ListValue
import com.sunnychung.lib.multiplatform.kotlite.model.PairValue
import com.sunnychung.lib.multiplatform.kotlite.model.NullValue
import com.sunnychung.lib.multiplatform.kotlite.model.ProvidedClassDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.StringValue
import com.sunnychung.lib.multiplatform.kotlite.model.SymbolTable
import com.sunnychung.lib.multiplatform.kotlite.model.TypeParameter
import com.sunnychung.lib.multiplatform.kotlite.stdlib.collections.SetValue
import com.sunnychung.lib.multiplatform.kotlite.stdlib.collections.MapValue
import com.sunnychung.lib.multiplatform.kotlite.stdlib.collections.MutableListValue
import com.sunnychung.lib.multiplatform.kotlite.stdlib.collections.MutableSetValue
import com.sunnychung.lib.multiplatform.kotlite.stdlib.collections.MutableMapValue
import com.sunnychung.lib.multiplatform.kotlite.model.ComparableRuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionType
import com.sunnychung.lib.multiplatform.kotlite.model.UnitValue
import com.sunnychung.lib.multiplatform.kotlite.stdlib.collections.MapEntryValue
import com.sunnychung.lib.multiplatform.kotlite.model.TypeNode
import kotlin.random.Random

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

    /** The values of a `vararg` parameter; unlike [varargValues] none is fine. */
    @Suppress("UNCHECKED_CAST")
    private fun varargList(arguments: List<RuntimeValue>): List<RuntimeValue> =
        (arguments.firstOrNull() as? DelegatedValue<*>)?.value as? List<RuntimeValue> ?: emptyList()

    private fun ints(value: RuntimeValue): Int = (value as IntValue).value

    /** The sum of `sumOf` results: `Int`, `Long` or `Double` as the selector returns (RT-95). */
    private fun sumValues(values: List<RuntimeValue>, resultType: DataType?, symbolTable: SymbolTable): RuntimeValue = when {
        values.all { it is IntValue } && resultType?.name != "Double" && resultType?.name != "Long" -> IntValue(values.sumOf { (it as IntValue).value }, symbolTable)
        values.all { it is IntValue || it is LongValue } && resultType?.name != "Double" ->
            LongValue(values.sumOf { if (it is IntValue) it.value.toLong() else (it as LongValue).value }, symbolTable)
        values.all { it is IntValue || it is LongValue || it is DoubleValue } -> DoubleValue(values.sumOf {
            when (it) { is IntValue -> it.value.toDouble(); is LongValue -> it.value.toDouble(); else -> (it as DoubleValue).value }
        }, symbolTable)
        else -> throw IllegalArgumentException("sumOf needs a selector that returns a number (Int, Long or Double)")
    }
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
        // Bit operations like Kotlin's infix functions on Int and Long (RT-87)
        *listOf<Pair<String, (Int, Int) -> Int>>(
            "and" to Int::and, "or" to Int::or, "xor" to Int::xor,
            "shl" to Int::shl, "shr" to Int::shr, "ushr" to Int::ushr,
        ).map { (name, operation) ->
            function("Int", name, "Int", listOf(parameter(if (name.startsWith("sh") || name == "ushr") "bitCount" else "other", "Int")), modifiers = setOf(FunctionModifier.infix)) { interpreter, receiver, args, _ ->
                IntValue(operation(ints(receiver!!), ints(args[0])), interpreter.symbolTable())
            }
        }.toTypedArray(),
        *listOf<Pair<String, (Long, Long) -> Long>>("and" to Long::and, "or" to Long::or, "xor" to Long::xor).map { (name, operation) ->
            function("Long", name, "Long", listOf(parameter("other", "Long")), modifiers = setOf(FunctionModifier.infix)) { interpreter, receiver, args, _ ->
                LongValue(operation((receiver as LongValue).value, (args[0] as LongValue).value), interpreter.symbolTable())
            }
        }.toTypedArray(),
        *listOf<Pair<String, (Long, Int) -> Long>>("shl" to Long::shl, "shr" to Long::shr, "ushr" to Long::ushr).map { (name, operation) ->
            function("Long", name, "Long", listOf(parameter("bitCount", "Int")), modifiers = setOf(FunctionModifier.infix)) { interpreter, receiver, args, _ ->
                LongValue(operation((receiver as LongValue).value, ints(args[0])), interpreter.symbolTable())
            }
        }.toTypedArray(),
        function("Int", "inv", "Int", emptyList()) { interpreter, receiver, _, _ ->
            IntValue(ints(receiver!!).inv(), interpreter.symbolTable())
        },
        function("Long", "inv", "Long", emptyList()) { interpreter, receiver, _, _ ->
            LongValue((receiver as LongValue).value.inv(), interpreter.symbolTable())
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
        // RT-94: `mod` is never negative for a positive divisor, `rem` is `%`.
        function("Int", "mod", "Int", listOf(parameter("other", "Int"))) { interpreter, receiver, args, _ ->
            IntValue(ints(receiver!!).mod(ints(args[0])), interpreter.symbolTable())
        },
        function("Int", "rem", "Int", listOf(parameter("other", "Int"))) { interpreter, receiver, args, _ ->
            IntValue(ints(receiver!!).rem(ints(args[0])), interpreter.symbolTable())
        },
        function("Int", "toString", "String", listOf(parameter("radix", "Int"))) { interpreter, receiver, args, _ ->
            StringValue(ints(receiver!!).toString(ints(args[0])), interpreter.symbolTable())
        },
        function("Int", "toFloat", "Double") { interpreter, receiver, _, _ ->
            DoubleValue(ints(receiver!!).toDouble(), interpreter.symbolTable())
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
        // Double and Char limits as in Kotlin (RT-59); `Double.MIN_VALUE` is the smallest positive value.
        constant("Double.Companion", "MAX_VALUE", "Double") { DoubleValue(Double.MAX_VALUE, it) },
        constant("Long.Companion", "MAX_VALUE", "Long") { LongValue(Long.MAX_VALUE, it) },
        constant("Long.Companion", "MIN_VALUE", "Long") { LongValue(Long.MIN_VALUE, it) },
        constant("Double.Companion", "MIN_VALUE", "Double") { DoubleValue(Double.MIN_VALUE, it) },
        constant("Double.Companion", "POSITIVE_INFINITY", "Double") { DoubleValue(Double.POSITIVE_INFINITY, it) },
        constant("Double.Companion", "NEGATIVE_INFINITY", "Double") { DoubleValue(Double.NEGATIVE_INFINITY, it) },
        constant("Double.Companion", "NaN", "Double") { DoubleValue(Double.NaN, it) },
        constant("Char.Companion", "MIN_VALUE", "Char") { CharValue(Char.MIN_VALUE, it) },
        constant("Char.Companion", "MAX_VALUE", "Char") { CharValue(Char.MAX_VALUE, it) },
    )

    private fun constant(receiver: String, name: String, type: String, value: (SymbolTable) -> RuntimeValue) =
        ExtensionProperty(declaredName = name, receiver = receiver, type = type, getter = { interpreter, _, _ -> value(interpreter.symbolTable()) })

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
        // Kotlite cannot choose overloads by the lambda's result, so one generic `sumOf` adds
        // `Int`, `Long` or `Double` results like Kotlin's overloads (RT-95).
        suspendFunction(
            "Iterable<T>", "sumOf", "R",
            listOf(parameter("selector", "(T) -> R")),
            listOf(TypeParameter("T", null), TypeParameter("R", null)),
        ) { interpreter, receiver, args, typeArgs ->
            val selector = args[0] as LambdaValue
            val symbolTable = interpreter.symbolTable()
            sumValues(elements(receiver).map { selector.executeSuspended(arrayOf(asRuntimeValue(it, symbolTable))) }, typeArgs["R"], symbolTable)
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
        // RT-59; Kotlin's own functions also check the sizes (IllegalArgumentException).
        function("Iterable<T>", "chunked", "List<List<T>>", listOf(parameter("size", "Int")), listOf(TypeParameter("T", null))) { interpreter, receiver, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            lists(elements(receiver).map { asRuntimeValue(it, symbolTable) }.chunked(ints(args[0])), typeArgs, symbolTable)
        },
        function(
            "Iterable<T>", "windowed", "List<List<T>>",
            listOf(parameter("size", "Int"), CustomFunctionParameter("step", "Int", "1"), CustomFunctionParameter("partialWindows", "Boolean", "false")),
            listOf(TypeParameter("T", null)),
        ) { interpreter, receiver, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val windows = elements(receiver).map { asRuntimeValue(it, symbolTable) }
                .windowed(ints(args[0]), ints(args[1]), (args[2] as BooleanValue).value)
            lists(windows, typeArgs, symbolTable)
        },
    )

    /** A `List<List<T>>` value from Kotlin lists of runtime values. */
    private fun lists(lists: List<List<RuntimeValue>>, typeArgs: Map<String, DataType>, symbolTable: SymbolTable): RuntimeValue {
        val elementType = typeArgs["T"] ?: symbolTable.IntType
        val listType = symbolTable.assertToDataType(TypeNode(BUILTIN, "List", listOf(elementType.toTypeNode()), false))
        return ListValue(lists.map { ListValue(it, elementType, symbolTable) }, listType, symbolTable)
    }

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
        // RT-93: empty read-only collections, e.g. `karten[name] ?: emptyList()`.
        function(null, "emptyList", "List<T>", typeParameters = listOf(TypeParameter("T", null))) { interpreter, _, _, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            ListValue(emptyList(), typeArgs["T"] ?: symbolTable.AnyType, symbolTable)
        },
        function(null, "emptySet", "Set<T>", typeParameters = listOf(TypeParameter("T", null))) { interpreter, _, _, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            SetValue(LinkedHashSet(), typeArgs["T"] ?: symbolTable.AnyType, symbolTable)
        },
        // RT-73: like Kotlin, `error(message)` throws an IllegalStateException with the message.
        function(null, "error", "Nothing", listOf(parameter("message", "Any"))) { _, _, args, _ ->
            throw IllegalStateException((args[0] as? StringValue)?.value ?: args[0].convertToString())
        },
        // RT-66: Java's format specifiers, see KotlinFormat. Kotlite allows `vararg` only as the
        // sole parameter, so `String.format(pattern, …)` takes the pattern as its first value.
        function("String", "format", "String", listOf(parameter("args", "Any?", setOf("vararg")))) { interpreter, receiver, args, _ ->
            StringValue(KotlinFormat.format(text(receiver), varargList(args)), interpreter.symbolTable())
        },
        function("String.Companion", "format", "String", listOf(parameter("args", "Any?", setOf("vararg")))) { interpreter, _, args, _ ->
            val values = varargList(args)
            val pattern = values.firstOrNull() as? StringValue ?: throw IllegalArgumentException("String.format needs a format string first")
            StringValue(KotlinFormat.format(pattern.value, values.drop(1)), interpreter.symbolTable())
        },
        // RT-59
        function("String", "lines", "List<String>") { interpreter, receiver, _, _ ->
            val symbolTable = interpreter.symbolTable()
            ListValue(text(receiver).lines().map { StringValue(it, symbolTable) }, symbolTable.StringType, symbolTable)
        },
        function("String", "zip", "List<Pair<Char, Char>>", listOf(parameter("other", "String"))) { interpreter, receiver, args, _ ->
            val symbolTable = interpreter.symbolTable()
            val pairType = symbolTable.assertToDataType(TypeNode(BUILTIN, "Pair", listOf(TypeNode(BUILTIN, "Char", null, false), TypeNode(BUILTIN, "Char", null, false)), false))
            val pairs = text(receiver).zip(text(args[0])).map { (a, b) ->
                PairValue(Pair(CharValue(a, symbolTable), CharValue(b, symbolTable)), symbolTable.CharType, symbolTable.CharType, symbolTable)
            }
            ListValue(pairs, pairType, symbolTable)
        },
        suspendFunction("String", "count", "Int", listOf(parameter("predicate", "(Char) -> Boolean"))) { interpreter, receiver, args, _ ->
            val predicate = args[0] as LambdaValue
            val symbolTable = interpreter.symbolTable()
            var count = 0
            for (c in text(receiver)) {
                if ((predicate.executeSuspended(arrayOf(CharValue(c, symbolTable))) as BooleanValue).value) count++
            }
            IntValue(count, symbolTable)
        },
        // `'a'..'z'` is a `ClosedRange<Char>`: iterable and countable as in Kotlin (RT-59).
        function("ClosedRange<Char>", "iterator", "Iterator<Char>") { interpreter, receiver, _, _ ->
            val symbolTable = interpreter.symbolTable()
            IteratorValue(chars(receiver, symbolTable).iterator(), symbolTable.CharType, symbolTable)
        },
        function("ClosedRange<Char>", "toList", "List<Char>") { interpreter, receiver, _, _ ->
            val symbolTable = interpreter.symbolTable()
            ListValue(chars(receiver, symbolTable), symbolTable.CharType, symbolTable)
        },
        function("ClosedRange<Char>", "count", "Int") { interpreter, receiver, _, _ ->
            IntValue(chars(receiver, interpreter.symbolTable()).size, interpreter.symbolTable())
        },
    )

    private fun chars(receiver: RuntimeValue?, symbolTable: SymbolTable): List<RuntimeValue> {
        val range = (receiver as DelegatedValue<*>).value as ClosedRange<*>
        return ((range.start as CharValue).value..(range.endInclusive as CharValue).value).map { CharValue(it, symbolTable) }
    }

    // ---- String as a character sequence (RT-94) ------------------------------

    private val r = listOf(TypeParameter("R", null))
    private val k = listOf(TypeParameter("K", null))
    private val v = listOf(TypeParameter("V", null))

    private fun charValues(receiver: RuntimeValue?, symbolTable: SymbolTable): List<RuntimeValue> =
        text(receiver).map { CharValue(it, symbolTable) }

    private suspend fun LambdaValue.test(value: RuntimeValue): Boolean = (executeSuspended(arrayOf(value)) as BooleanValue).value

    private fun stringList(values: List<String>, symbolTable: SymbolTable) =
        ListValue(values.map { StringValue(it, symbolTable) }, symbolTable.StringType, symbolTable)

    /**
     * Kotlin's `CharSequence` functions that students use on a `String`: a `String` is not an
     * `Iterable` in Kotlite, so these are provided for `String` one by one, with Kotlin's results.
     */
    private val textSequenceFunctions = listOf(
        suspendFunction("String", "ifBlank", "String", listOf(parameter("defaultValue", "() -> String"))) { _, receiver, args, _ ->
            if (text(receiver).isBlank()) (args[0] as LambdaValue).executeSuspended(emptyArray()) else receiver!!
        },
        suspendFunction("String", "ifEmpty", "String", listOf(parameter("defaultValue", "() -> String"))) { _, receiver, args, _ ->
            if (text(receiver).isEmpty()) (args[0] as LambdaValue).executeSuspended(emptyArray()) else receiver!!
        },
        // Kotlin has overloads for a `Char` and a `String` result; one function accepts both.
        suspendFunction("String", "replaceFirstChar", "String", listOf(parameter("transform", "(Char) -> Any"))) { interpreter, receiver, args, _ ->
            val value = text(receiver)
            if (value.isEmpty()) return@suspendFunction receiver!!
            val first = (args[0] as LambdaValue).executeSuspended(arrayOf(CharValue(value[0], interpreter.symbolTable())))
            StringValue((if (first is CharValue) first.value.toString() else first.convertToString()) + value.substring(1), interpreter.symbolTable())
        },
        function("String", "indexOf", "Int", listOf(parameter("char", "Char"))) { interpreter, receiver, args, _ ->
            IntValue(text(receiver).indexOf((args[0] as CharValue).value), interpreter.symbolTable())
        },
        function("String", "lastIndexOf", "Int", listOf(parameter("char", "Char"))) { interpreter, receiver, args, _ ->
            IntValue(text(receiver).lastIndexOf((args[0] as CharValue).value), interpreter.symbolTable())
        },
        suspendFunction("String", "map", "List<R>", listOf(parameter("transform", "(Char) -> R")), r) { interpreter, receiver, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val transform = args[0] as LambdaValue
            ListValue(charValues(receiver, symbolTable).map { transform.executeSuspended(arrayOf(it)) }, typeArgs["R"] ?: symbolTable.AnyType, symbolTable)
        },
        suspendFunction("String", "mapIndexed", "List<R>", listOf(parameter("transform", "(Int, Char) -> R")), r) { interpreter, receiver, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val transform = args[0] as LambdaValue
            ListValue(charValues(receiver, symbolTable).mapIndexed { index, c -> transform.executeSuspended(arrayOf(IntValue(index, symbolTable), c)) }, typeArgs["R"] ?: symbolTable.AnyType, symbolTable)
        },
        suspendFunction("String", "find", "Char?", listOf(parameter("predicate", "(Char) -> Boolean"))) { interpreter, receiver, args, _ ->
            val predicate = args[0] as LambdaValue
            charValues(receiver, interpreter.symbolTable()).firstOrNull { predicate.test(it) } ?: NullValue
        },
        suspendFunction("String", "findLast", "Char?", listOf(parameter("predicate", "(Char) -> Boolean"))) { interpreter, receiver, args, _ ->
            val predicate = args[0] as LambdaValue
            charValues(receiver, interpreter.symbolTable()).lastOrNull { predicate.test(it) } ?: NullValue
        },
        suspendFunction("String", "single", "Char", listOf(parameter("predicate", "(Char) -> Boolean"))) { interpreter, receiver, args, _ ->
            val predicate = args[0] as LambdaValue
            val matches = charValues(receiver, interpreter.symbolTable()).filter { predicate.test(it) }
            if (matches.isEmpty()) throw NoSuchElementException("Char sequence contains no character matching the predicate.")
            if (matches.size > 1) throw IllegalArgumentException("Char sequence contains more than one matching element.")
            matches[0]
        },
        suspendFunction("String", "sumOf", "R", listOf(parameter("selector", "(Char) -> R")), r) { interpreter, receiver, args, typeArgs ->
            val selector = args[0] as LambdaValue
            val symbolTable = interpreter.symbolTable()
            sumValues(charValues(receiver, symbolTable).map { selector.executeSuspended(arrayOf(it)) }, typeArgs["R"], symbolTable)
        },
        suspendFunction("String", "groupBy", "Map<K, List<Char>>", listOf(parameter("keySelector", "(Char) -> K")), k) { interpreter, receiver, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val keySelector = args[0] as LambdaValue
            val groups = LinkedHashMap<RuntimeValue, MutableList<RuntimeValue>>()
            for (c in charValues(receiver, symbolTable)) groups.getOrPut(keySelector.executeSuspended(arrayOf(c))) { mutableListOf() } += c
            val listType = symbolTable.assertToDataType(TypeNode(BUILTIN, "List", listOf(TypeNode(BUILTIN, "Char", null, false)), false))
            MapValue(groups.mapValuesTo(LinkedHashMap()) { ListValue(it.value, symbolTable.CharType, symbolTable) }, typeArgs["K"] ?: symbolTable.AnyType, listType, symbolTable)
        },
        suspendFunction("String", "associateWith", "Map<Char, V>", listOf(parameter("valueSelector", "(Char) -> V")), v) { interpreter, receiver, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val valueSelector = args[0] as LambdaValue
            val result = LinkedHashMap<RuntimeValue, RuntimeValue>()
            for (c in charValues(receiver, symbolTable)) result[c] = valueSelector.executeSuspended(arrayOf(c))
            MapValue(result, symbolTable.CharType, typeArgs["V"] ?: symbolTable.AnyType, symbolTable)
        },
        function("String", "toSet", "Set<Char>") { interpreter, receiver, _, _ ->
            val symbolTable = interpreter.symbolTable()
            SetValue(charValues(receiver, symbolTable).toCollection(LinkedHashSet()), symbolTable.CharType, symbolTable)
        },
        function("String", "toMutableList", "MutableList<Char>") { interpreter, receiver, _, _ ->
            val symbolTable = interpreter.symbolTable()
            MutableListValue(charValues(receiver, symbolTable).toMutableList(), symbolTable.CharType, symbolTable)
        },
        function("String", "chunked", "List<String>", listOf(parameter("size", "Int"))) { interpreter, receiver, args, _ ->
            stringList(text(receiver).chunked(ints(args[0])), interpreter.symbolTable())
        },
        function("String", "windowed", "List<String>", listOf(parameter("size", "Int"))) { interpreter, receiver, args, _ ->
            stringList(text(receiver).windowed(ints(args[0])), interpreter.symbolTable())
        },
        function("String", "maxOrNull", "Char?") { interpreter, receiver, _, _ ->
            text(receiver).maxOrNull()?.let { CharValue(it, interpreter.symbolTable()) } ?: NullValue
        },
        function("String", "minOrNull", "Char?") { interpreter, receiver, _, _ ->
            text(receiver).minOrNull()?.let { CharValue(it, interpreter.symbolTable()) } ?: NullValue
        },
        function("String", "elementAt", "Char", listOf(parameter("index", "Int"))) { interpreter, receiver, args, _ ->
            CharValue(text(receiver).elementAt(ints(args[0])), interpreter.symbolTable())
        },
        function("String", "trimIndent", "String") { interpreter, receiver, _, _ ->
            StringValue(text(receiver).trimIndent(), interpreter.symbolTable())
        },
        function("String", "trimMargin", "String") { interpreter, receiver, _, _ ->
            StringValue(text(receiver).trimMargin(), interpreter.symbolTable())
        },
        function("String", "toLong", "Long") { interpreter, receiver, _, _ ->
            LongValue(text(receiver).toLong(), interpreter.symbolTable())
        },
        function("String", "toLongOrNull", "Long?") { interpreter, receiver, _, _ ->
            text(receiver).toLongOrNull()?.let { LongValue(it, interpreter.symbolTable()) } ?: NullValue
        },
        function("Char", "digitToIntOrNull", "Int?") { interpreter, receiver, _, _ ->
            (receiver as CharValue).value.digitToIntOrNull()?.let { IntValue(it, interpreter.symbolTable()) } ?: NullValue
        },
    ) + textWithIndex()

    private fun textWithIndex() = function("String", "withIndex", "List<IndexedValue<Char>>") { interpreter, receiver, _, _ ->
        val symbolTable = interpreter.symbolTable()
        val indexedType = symbolTable.assertToDataType(TypeNode(BUILTIN, "IndexedValue", listOf(TypeNode(BUILTIN, "Char", null, false)), false))
        val indexed = charValues(receiver, symbolTable).mapIndexed { index, c ->
            DelegatedValue(IndexedValue(index, c), "IndexedValue", typeArguments = listOf(symbolTable.CharType), symbolTable = symbolTable)
        }
        ListValue(indexed, indexedType, symbolTable)
    }

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

    // ---- collections and comparators (RT-95) ---------------------------------

    /** How a `Comparator` compares; student lambdas may suspend, so comparing is suspendable. */
    internal sealed class ComparatorSpec {
        class Lambda(val comparison: LambdaValue) : ComparatorSpec()
        class Selectors(val selectors: List<LambdaValue>, val descending: Boolean) : ComparatorSpec()
        class Natural(val descending: Boolean) : ComparatorSpec()
        class Then(val first: ComparatorSpec, val second: ComparatorSpec) : ComparatorSpec()
        class Reversed(val inner: ComparatorSpec) : ComparatorSpec()
    }

    /** Like Kotlin's `compareValues`: `null` first, then natural order. */
    @Suppress("UNCHECKED_CAST")
    internal fun compareNatural(a: RuntimeValue, b: RuntimeValue): Int = when {
        a === NullValue && b === NullValue -> 0
        a === NullValue -> -1
        b === NullValue -> 1
        a is ComparableRuntimeValue<*, *> -> (a as Comparable<Any>).compareTo(b)
        else -> throw IllegalArgumentException("${a.type().descriptiveName} is not Comparable")
    }

    internal suspend fun ComparatorSpec.compare(a: RuntimeValue, b: RuntimeValue): Int = when (this) {
        is ComparatorSpec.Lambda -> ints(comparison.executeSuspended(arrayOf(a, b)))
        is ComparatorSpec.Selectors -> {
            var result = 0
            for (selector in selectors) {
                result = compareNatural(selector.executeSuspended(arrayOf(a)), selector.executeSuspended(arrayOf(b)))
                if (result != 0) break
            }
            if (descending) -result else result
        }
        is ComparatorSpec.Natural -> compareNatural(a, b).let { if (descending) -it else it }
        is ComparatorSpec.Then -> first.compare(a, b).takeIf { it != 0 } ?: second.compare(a, b)
        is ComparatorSpec.Reversed -> -inner.compare(a, b)
    }

    /** A stable merge sort, like Kotlin's `sortedWith`, with suspendable comparisons. */
    internal suspend fun sortWith(values: List<RuntimeValue>, comparator: ComparatorSpec): List<RuntimeValue> {
        if (values.size < 2) return values
        val middle = values.size / 2
        val left = sortWith(values.subList(0, middle), comparator)
        val right = sortWith(values.subList(middle, values.size), comparator)
        val result = ArrayList<RuntimeValue>(values.size)
        var i = 0
        var j = 0
        while (i < left.size && j < right.size) {
            if (comparator.compare(left[i], right[j]) <= 0) result += left[i++] else result += right[j++]
        }
        while (i < left.size) result += left[i++]
        while (j < right.size) result += right[j++]
        return result
    }

    private fun comparator(spec: ComparatorSpec, elementType: DataType?, symbolTable: SymbolTable) =
        DelegatedValue(spec, "Comparator", typeArguments = listOf(elementType ?: symbolTable.AnyType), symbolTable = symbolTable)

    internal fun spec(value: RuntimeValue): ComparatorSpec = (value as DelegatedValue<*>).value as ComparatorSpec

    @Suppress("UNCHECKED_CAST")
    private fun mutableElements(receiver: RuntimeValue?): MutableList<RuntimeValue> =
        (receiver as DelegatedValue<*>).value as MutableList<RuntimeValue>

    private fun values(receiver: RuntimeValue?, symbolTable: SymbolTable): List<RuntimeValue> =
        elements(receiver).map { asRuntimeValue(it, symbolTable) }

    private val ct = listOf(TypeParameter("T", null))

    private val comparatorClass = ProvidedClassDefinition(
        position = BUILTIN,
        fullQualifiedName = "Comparator",
        typeParameters = ct,
        isInstanceCreationAllowed = true,
        primaryConstructorParameters = listOf(parameter("comparison", "(T, T) -> Int")),
        constructInstance = { interpreter, args, _ ->
            comparator(ComparatorSpec.Lambda(args[0] as LambdaValue), (args[0].type() as? FunctionType)?.arguments?.firstOrNull(), interpreter.symbolTable())
        },
    )

    // Comparators: `sortedWith(compareBy({ it.nachname }, { it.vorname }))` and friends.
    private val collectionFunctions = (1..3).map { count ->
        // Kotlin's `compareBy(vararg selectors)`; Kotlite's `vararg` takes no function types.
        function(null, "compareBy", "Comparator<T>", (1..count).map { parameter("selector$it", "(T) -> Any?") }, ct) { interpreter, _, args, typeArgs ->
            comparator(ComparatorSpec.Selectors(args.map { it as LambdaValue }, false), typeArgs["T"], interpreter.symbolTable())
        }
    } + listOf(
        function(null, "compareByDescending", "Comparator<T>", listOf(parameter("selector", "(T) -> Any?")), ct) { interpreter, _, args, typeArgs ->
            comparator(ComparatorSpec.Selectors(listOf(args[0] as LambdaValue), true), typeArgs["T"], interpreter.symbolTable())
        },
        function(null, "naturalOrder", "Comparator<T>", typeParameters = ct) { interpreter, _, _, typeArgs ->
            comparator(ComparatorSpec.Natural(false), typeArgs["T"], interpreter.symbolTable())
        },
        function(null, "reverseOrder", "Comparator<T>", typeParameters = ct) { interpreter, _, _, typeArgs ->
            comparator(ComparatorSpec.Natural(true), typeArgs["T"], interpreter.symbolTable())
        },
        function("Comparator<T>", "thenBy", "Comparator<T>", listOf(parameter("selector", "(T) -> Any?")), ct) { interpreter, receiver, args, typeArgs ->
            comparator(ComparatorSpec.Then(spec(receiver!!), ComparatorSpec.Selectors(listOf(args[0] as LambdaValue), false)), typeArgs["T"], interpreter.symbolTable())
        },
        function("Comparator<T>", "thenByDescending", "Comparator<T>", listOf(parameter("selector", "(T) -> Any?")), ct) { interpreter, receiver, args, typeArgs ->
            comparator(ComparatorSpec.Then(spec(receiver!!), ComparatorSpec.Selectors(listOf(args[0] as LambdaValue), true)), typeArgs["T"], interpreter.symbolTable())
        },
        function("Comparator<T>", "reversed", "Comparator<T>", typeParameters = ct) { interpreter, receiver, _, typeArgs ->
            comparator(ComparatorSpec.Reversed(spec(receiver!!)), typeArgs["T"], interpreter.symbolTable())
        },
        suspendFunction("Comparator<T>", "compare", "Int", listOf(parameter("a", "T"), parameter("b", "T")), ct) { interpreter, receiver, args, _ ->
            IntValue(spec(receiver!!).compare(args[0], args[1]), interpreter.symbolTable())
        },
        suspendFunction("Iterable<T>", "sortedWith", "List<T>", listOf(parameter("comparator", "Comparator<T>")), ct) { interpreter, receiver, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            ListValue(sortWith(values(receiver, symbolTable), spec(args[0])), typeArgs["T"] ?: symbolTable.AnyType, symbolTable)
        },
        suspendFunction("Iterable<T>", "sortedWith", "List<T>", listOf(parameter("comparison", "(T, T) -> Int")), ct) { interpreter, receiver, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            ListValue(sortWith(values(receiver, symbolTable), ComparatorSpec.Lambda(args[0] as LambdaValue)), typeArgs["T"] ?: symbolTable.AnyType, symbolTable)
        },
        suspendFunction("MutableList<T>", "sortWith", "Unit", listOf(parameter("comparator", "Comparator<T>")), ct) { interpreter, receiver, args, _ ->
            val list = mutableElements(receiver)
            val sorted = sortWith(list.toList(), spec(args[0]))
            list.clear()
            list.addAll(sorted)
            UnitValue
        },
        suspendFunction("Iterable<T>", "maxWith", "T", listOf(parameter("comparator", "Comparator<T>")), ct) { interpreter, receiver, args, _ ->
            val all = values(receiver, interpreter.symbolTable())
            if (all.isEmpty()) throw NoSuchElementException("Collection is empty.")
            sortWith(all, spec(args[0])).last()
        },
        suspendFunction("Iterable<T>", "minWith", "T", listOf(parameter("comparator", "Comparator<T>")), ct) { interpreter, receiver, args, _ ->
            val all = values(receiver, interpreter.symbolTable())
            if (all.isEmpty()) throw NoSuchElementException("Collection is empty.")
            sortWith(all, spec(args[0])).first()
        },
        // Lists
        function("MutableList<T>", "add", "Unit", listOf(parameter("index", "Int"), parameter("element", "T")), ct) { _, receiver, args, _ ->
            mutableElements(receiver).add(ints(args[0]), args[1])
            UnitValue
        },
        function("MutableList<T>", "addFirst", "Unit", listOf(parameter("element", "T")), ct) { _, receiver, args, _ ->
            mutableElements(receiver).add(0, args[0])
            UnitValue
        },
        function("MutableList<T>", "addLast", "Unit", listOf(parameter("element", "T")), ct) { _, receiver, args, _ ->
            mutableElements(receiver).add(args[0])
            UnitValue
        },
        function("MutableList<T>", "reverse", "Unit", typeParameters = ct) { _, receiver, _, _ ->
            mutableElements(receiver).reverse()
            UnitValue
        },
        suspendFunction("MutableList<T>", "removeIf", "Boolean", listOf(parameter("predicate", "(T) -> Boolean")), ct) { interpreter, receiver, args, _ ->
            val list = mutableElements(receiver)
            val predicate = args[0] as LambdaValue
            val kept = list.filterNot { predicate.test(it) }
            val removed = kept.size != list.size
            list.clear()
            list.addAll(kept)
            BooleanValue(removed, interpreter.symbolTable())
        },
        function("List<T>", "slice", "List<T>", listOf(parameter("indices", "Iterable<Int>")), ct) { interpreter, receiver, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val all = values(receiver, symbolTable)
            ListValue(elements(args[0]).map { all[elementAsInt(it)] }, typeArgs["T"] ?: symbolTable.AnyType, symbolTable)
        },
        function("Iterable<T>", "zipWithNext", "List<Pair<T, T>>", typeParameters = ct) { interpreter, receiver, _, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val elementType = typeArgs["T"] ?: symbolTable.AnyType
            val pairType = symbolTable.assertToDataType(TypeNode(BUILTIN, "Pair", listOf(elementType.toTypeNode(), elementType.toTypeNode()), false))
            ListValue(values(receiver, symbolTable).zipWithNext { a, b -> PairValue(Pair(a, b), elementType, elementType, symbolTable) }, pairType, symbolTable)
        },
        suspendFunction("List<T>", "ifEmpty", "List<T>", listOf(parameter("defaultValue", "() -> List<T>")), ct) { _, receiver, args, _ ->
            if (elements(receiver).isEmpty()) (args[0] as LambdaValue).executeSuspended(emptyArray()) else receiver!!
        },
        function("Set<T>", "random", "T", typeParameters = ct) { interpreter, receiver, _, _ ->
            val all = values(receiver, interpreter.symbolTable())
            if (all.isEmpty()) throw NoSuchElementException("Collection is empty.")
            all.random()
        },
        // Java-style names that code from other sources uses.
        function(null, "arrayListOf", "MutableList<T>", listOf(parameter("elements", "T", setOf("vararg"))), ct) { interpreter, _, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            MutableListValue(varargList(args).toMutableList(), typeArgs["T"] ?: symbolTable.AnyType, symbolTable)
        },
        function(null, "ArrayList", "MutableList<T>", typeParameters = ct) { interpreter, _, _, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            MutableListValue(mutableListOf(), typeArgs["T"] ?: symbolTable.AnyType, symbolTable)
        },
        function(null, "hashSetOf", "MutableSet<T>", listOf(parameter("elements", "T", setOf("vararg"))), ct) { interpreter, _, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            MutableSetValue(varargList(args).toCollection(LinkedHashSet()), typeArgs["T"] ?: symbolTable.AnyType, symbolTable)
        },
        // Maps
        function("Map<K, V>", "isEmpty", "Boolean", typeParameters = listOf(TypeParameter("K", null), TypeParameter("V", null))) { interpreter, receiver, _, _ ->
            BooleanValue(map(receiver).isEmpty(), interpreter.symbolTable())
        },
        function("MutableMap<K, V>", "putAll", "Unit", listOf(parameter("from", "Map<K, V>")), listOf(TypeParameter("K", null), TypeParameter("V", null))) { _, receiver, args, _ ->
            @Suppress("UNCHECKED_CAST")
            ((receiver as DelegatedValue<*>).value as MutableMap<RuntimeValue, RuntimeValue>).putAll(map(args[0]))
            UnitValue
        },
        function("Map<K, V>", "toSortedMap", "Map<K, V>", typeParameters = listOf(TypeParameter("K", null), TypeParameter("V", null))) { interpreter, receiver, _, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val sorted = map(receiver).entries.sortedWith { a, b -> compareNatural(a.key, b.key) }
            MapValue(sorted.associateTo(LinkedHashMap()) { it.key to it.value }, typeArgs["K"] ?: symbolTable.AnyType, typeArgs["V"] ?: symbolTable.AnyType, symbolTable)
        },
        function(null, "emptyMap", "Map<K, V>", typeParameters = listOf(TypeParameter("K", null), TypeParameter("V", null))) { interpreter, _, _, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            MapValue(LinkedHashMap(), typeArgs["K"] ?: symbolTable.AnyType, typeArgs["V"] ?: symbolTable.AnyType, symbolTable)
        },
        function(null, "hashMapOf", "MutableMap<K, V>", listOf(parameter("pairs", "Pair<K, V>", setOf("vararg"))), listOf(TypeParameter("K", null), TypeParameter("V", null))) { interpreter, _, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            val result = LinkedHashMap<RuntimeValue, RuntimeValue>()
            for (pair in varargList(args)) {
                val entry = (pair as DelegatedValue<*>).value as Pair<*, *>
                result[entry.first as RuntimeValue] = entry.second as RuntimeValue
            }
            MutableMapValue(result, typeArgs["K"] ?: symbolTable.AnyType, typeArgs["V"] ?: symbolTable.AnyType, symbolTable)
        },
        function(null, "HashMap", "MutableMap<K, V>", typeParameters = listOf(TypeParameter("K", null), TypeParameter("V", null))) { interpreter, _, _, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            MutableMapValue(LinkedHashMap(), typeArgs["K"] ?: symbolTable.AnyType, typeArgs["V"] ?: symbolTable.AnyType, symbolTable)
        },
        // Others
        suspendFunction(null, "measureTimeMillis", "Long", listOf(parameter("block", "() -> Unit"))) { interpreter, _, args, _ ->
            val start = kotlin.time.TimeSource.Monotonic.markNow()
            (args[0] as LambdaValue).executeSuspended(emptyArray())
            LongValue(start.elapsedNow().inWholeMilliseconds, interpreter.symbolTable())
        },
    )

    // ---- maps ----------------------------------------------------------------

    /**
     * `map.entries`, a snapshot rather than a live view (RT-58). The JVM's
     * two-parameter `map.forEach { key, value -> }` cannot be added: builtin
     * overloads that differ only in the lambda's parameter count collide.
     */
    private val mapFunctions = listOf(
        // RT-59; `key in map` already worked.
        function("Map<K, V>", "containsKey", "Boolean", listOf(parameter("key", "K")), listOf(TypeParameter("K", null), TypeParameter("V", null))) { interpreter, receiver, args, _ ->
            BooleanValue(map(receiver).containsKey(args[0]), interpreter.symbolTable())
        },
        function(
            "Map<K, V>", "getOrDefault", "V",
            listOf(parameter("key", "K"), parameter("defaultValue", "V")),
            listOf(TypeParameter("K", null), TypeParameter("V", null)),
        ) { _, receiver, args, _ ->
            val map = map(receiver)
            if (map.containsKey(args[0])) map.getValue(args[0]) else args[1]
        },
    )

    @Suppress("UNCHECKED_CAST")
    private fun map(receiver: RuntimeValue?): Map<RuntimeValue, RuntimeValue> =
        (receiver as DelegatedValue<*>).value as Map<RuntimeValue, RuntimeValue>

    private val mapProperties = listOf(
        ExtensionProperty(
            declaredName = "entries",
            typeParameters = listOf(TypeParameter("K", null), TypeParameter("V", null)),
            receiver = "Map<K, V>",
            type = "Set<MapEntry<K, V>>",
            getter = { interpreter, receiver, typeArgs ->
                val symbolTable = interpreter.symbolTable()
                val keyType = typeArgs.getValue("K")
                val valueType = typeArgs.getValue("V")
                val entryType = symbolTable.assertToDataType(
                    TypeNode(BUILTIN, "MapEntry", listOf(keyType.toTypeNode(), valueType.toTypeNode()), false)
                )
                @Suppress("UNCHECKED_CAST")
                val map = (receiver as DelegatedValue<*>).value as Map<RuntimeValue, RuntimeValue>
                SetValue(map.entries.mapTo(LinkedHashSet()) { MapEntryValue(EntrySnapshot(it.key, it.value), keyType, valueType, symbolTable) }, entryType, symbolTable)
            },
        ),
    )

    /**
     * An entry that stays readable after the map changes, as on Kotlin/JVM; an
     * entry of Kotlin/JS's `LinkedHashMap` then throws `ConcurrentModificationException`.
     */
    private class EntrySnapshot(override val key: RuntimeValue, override val value: RuntimeValue) : Map.Entry<RuntimeValue, RuntimeValue> {
        override fun equals(other: Any?): Boolean = other is Map.Entry<*, *> && other.key == key && other.value == value
        override fun hashCode(): Int = key.hashCode() xor value.hashCode()
    }

    // ---- Triple, StringBuilder, Random (RT-62) -------------------------------

    private val tripleClass = ProvidedClassDefinition(
        position = BUILTIN,
        fullQualifiedName = "Triple",
        typeParameters = listOf(TypeParameter("A", null), TypeParameter("B", null), TypeParameter("C", null)),
        isInstanceCreationAllowed = true,
        primaryConstructorParameters = listOf(parameter("first", "A"), parameter("second", "B"), parameter("third", "C")),
        constructInstance = { interpreter, args, _ ->
            DelegatedValue(Triple(args[0], args[1], args[2]), "Triple", typeArguments = args.map { it.type() }, symbolTable = interpreter.symbolTable())
        },
    )

    private fun tripleProperty(name: String, type: String, part: (Triple<*, *, *>) -> Any?) = ExtensionProperty(
        declaredName = name,
        typeParameters = listOf(TypeParameter("A", null), TypeParameter("B", null), TypeParameter("C", null)),
        receiver = "Triple<A, B, C>",
        type = type,
        getter = { _, receiver, _ -> part((receiver as DelegatedValue<*>).value as Triple<*, *, *>) as RuntimeValue },
    )

    /** Members of the class, as in Kotlin; `buildString { append(…) }` reaches them through the implicit receiver. */
    private val stringBuilderMembers: List<CustomFunctionDefinition> = listOf(
        function(null, "append", "StringBuilder", listOf(parameter("value", "Any?"))) { _, receiver, args, _ ->
            builder(receiver).append(appendText(args[0])); receiver!!
        },
        function(null, "appendLine", "StringBuilder", listOf(CustomFunctionParameter("value", "Any?", "\"\""))) { _, receiver, args, _ ->
            builder(receiver).append(appendText(args[0])).append('\n'); receiver!!
        },
        function(null, "insert", "StringBuilder", listOf(parameter("index", "Int"), parameter("value", "Any?"))) { _, receiver, args, _ ->
            builder(receiver).insert(ints(args[0]), appendText(args[1])); receiver!!
        },
        function(null, "reverse", "StringBuilder") { _, receiver, _, _ -> builder(receiver).reverse(); receiver!! },
        function(null, "clear", "StringBuilder") { _, receiver, _, _ -> builder(receiver).clear(); receiver!! },
        function(null, "isEmpty", "Boolean") { interpreter, receiver, _, _ -> BooleanValue(builder(receiver).isEmpty(), interpreter.symbolTable()) },
        function(null, "get", "Char", listOf(parameter("index", "Int")), modifiers = setOf(FunctionModifier.operator)) { interpreter, receiver, args, _ ->
            CharValue(builder(receiver)[ints(args[0])], interpreter.symbolTable())
        },
    )

    /** Kotlin's `StringBuilder`, wrapping the host's; it prints its content (see `DelegatedValue`). */
    private val stringBuilderClass = ProvidedClassDefinition(
        position = BUILTIN,
        fullQualifiedName = "StringBuilder",
        typeParameters = emptyList(),
        isInstanceCreationAllowed = true,
        primaryConstructorParameters = listOf(CustomFunctionParameter("content", "String", "\"\"")),
        constructInstance = { interpreter, args, _ -> stringBuilder(StringBuilder((args[0] as StringValue).value), interpreter.symbolTable()) },
        functions = stringBuilderMembers,
    )

    private fun stringBuilder(builder: StringBuilder, symbolTable: SymbolTable) =
        DelegatedValue(builder, "StringBuilder", symbolTable = symbolTable)

    private fun builder(receiver: RuntimeValue?): StringBuilder = (receiver as DelegatedValue<*>).value as StringBuilder

    /** Text of an appended value; like Kotlin, objects use their own `toString()`. */
    private fun appendText(value: RuntimeValue): String = if (value === NullValue) "null" else value.convertToString()

    /** `Random` without `object` support: a class whose companion carries the functions, as `Int.MAX_VALUE` does. */
    private val randomClass = ProvidedClassDefinition(
        position = BUILTIN,
        fullQualifiedName = "Random",
        typeParameters = emptyList(),
        isInstanceCreationAllowed = false,
        primaryConstructorParameters = emptyList(),
        constructInstance = { _, _, _ -> throw UnsupportedOperationException("Use Random.nextInt(...) instead of Random(...).") },
    )

    private val tripleProperties = listOf(
        tripleProperty("first", "A") { it.first },
        tripleProperty("second", "B") { it.second },
        tripleProperty("third", "C") { it.third },
    )

    private val stringBuilderProperties = listOf(
        ExtensionProperty(
            declaredName = "length",
            receiver = "StringBuilder",
            type = "Int",
            getter = { interpreter, receiver, _ -> IntValue(builder(receiver).length, interpreter.symbolTable()) },
        ),
    )

    private val builderFunctions = listOf(
        suspendFunction(null, "buildString", "String", listOf(parameter("builderAction", "StringBuilder.() -> Unit"))) { interpreter, _, args, _ ->
            val symbolTable = interpreter.symbolTable()
            val result = StringBuilder()
            (args[0] as LambdaValue).executeSuspended(emptyArray(), stringBuilder(result, symbolTable))
            StringValue(result.toString(), symbolTable)
        },
    )

    private val randomFunctions = listOf(
        function("Random.Companion", "nextInt", "Int") { interpreter, _, _, _ -> IntValue(Random.nextInt(), interpreter.symbolTable()) },
        function("Random.Companion", "nextInt", "Int", listOf(parameter("until", "Int"))) { interpreter, _, args, _ ->
            IntValue(Random.nextInt(ints(args[0])), interpreter.symbolTable())
        },
        function("Random.Companion", "nextInt", "Int", listOf(parameter("from", "Int"), parameter("until", "Int"))) { interpreter, _, args, _ ->
            IntValue(Random.nextInt(ints(args[0]), ints(args[1])), interpreter.symbolTable())
        },
        function("Random.Companion", "nextDouble", "Double") { interpreter, _, _, _ -> DoubleValue(Random.nextDouble(), interpreter.symbolTable()) },
        function("Random.Companion", "nextDouble", "Double", listOf(parameter("until", "Double"))) { interpreter, _, args, _ ->
            DoubleValue(Random.nextDouble((args[0] as DoubleValue).value), interpreter.symbolTable())
        },
        function("Random.Companion", "nextDouble", "Double", listOf(parameter("from", "Double"), parameter("until", "Double"))) { interpreter, _, args, _ ->
            DoubleValue(Random.nextDouble((args[0] as DoubleValue).value, (args[1] as DoubleValue).value), interpreter.symbolTable())
        },
        function("Random.Companion", "nextBoolean", "Boolean") { interpreter, _, _, _ -> BooleanValue(Random.nextBoolean(), interpreter.symbolTable()) },
    )

    // ---- componentN and withIndex for destructuring (RT-65) -----------------

    private val ab = listOf(TypeParameter("A", null), TypeParameter("B", null))
    private val abc = ab + TypeParameter("C", null)
    private val kv = listOf(TypeParameter("K", null), TypeParameter("V", null))
    private val t = listOf(TypeParameter("T", null))

    private fun component(receiver: String, index: Int, type: String, typeParameters: List<TypeParameter>, part: (Any) -> Any?) =
        function(receiver, "component$index", type, typeParameters = typeParameters) { interpreter, value, _, _ ->
            asRuntimeValue(part((value as DelegatedValue<*>).value), interpreter.symbolTable())
        }

    private val indexedValueClass = ProvidedClassDefinition(
        position = BUILTIN,
        fullQualifiedName = "IndexedValue",
        typeParameters = t,
        isInstanceCreationAllowed = true,
        primaryConstructorParameters = listOf(parameter("index", "Int"), parameter("value", "T")),
        constructInstance = { interpreter, args, _ ->
            DelegatedValue(IndexedValue(ints(args[0]), args[1]), "IndexedValue", typeArguments = listOf(args[1].type()), symbolTable = interpreter.symbolTable())
        },
    )

    private val indexedValueProperties = listOf(
        ExtensionProperty(
            declaredName = "index", typeParameters = t, receiver = "IndexedValue<T>", type = "Int",
            getter = { interpreter, receiver, _ -> IntValue(((receiver as DelegatedValue<*>).value as IndexedValue<*>).index, interpreter.symbolTable()) },
        ),
        ExtensionProperty(
            declaredName = "value", typeParameters = t, receiver = "IndexedValue<T>", type = "T",
            getter = { _, receiver, _ -> ((receiver as DelegatedValue<*>).value as IndexedValue<*>).value as RuntimeValue },
        ),
    )

    private val componentFunctions = listOf(
        component("Pair<A, B>", 1, "A", ab) { (it as Pair<*, *>).first },
        component("Pair<A, B>", 2, "B", ab) { (it as Pair<*, *>).second },
        component("Triple<A, B, C>", 1, "A", abc) { (it as Triple<*, *, *>).first },
        component("Triple<A, B, C>", 2, "B", abc) { (it as Triple<*, *, *>).second },
        component("Triple<A, B, C>", 3, "C", abc) { (it as Triple<*, *, *>).third },
        component("MapEntry<K, V>", 1, "K", kv) { (it as Map.Entry<*, *>).key },
        component("MapEntry<K, V>", 2, "V", kv) { (it as Map.Entry<*, *>).value },
        component("IndexedValue<T>", 1, "Int", t) { (it as IndexedValue<*>).index },
        component("IndexedValue<T>", 2, "T", t) { (it as IndexedValue<*>).value },
    ) + (1..5).map { index ->
        // Like Kotlin, a list too short for the component throws IndexOutOfBoundsException.
        component("List<T>", index, "T", t) { (it as List<*>)[index - 1] }
    } + function("Iterable<T>", "withIndex", "List<IndexedValue<T>>", typeParameters = t) { interpreter, receiver, _, typeArgs ->
        val symbolTable = interpreter.symbolTable()
        val elementType = typeArgs["T"] ?: symbolTable.IntType
        val indexedType = symbolTable.assertToDataType(TypeNode(BUILTIN, "IndexedValue", listOf(elementType.toTypeNode()), false))
        val indexed = elements(receiver).mapIndexed { index, element ->
            DelegatedValue(IndexedValue(index, asRuntimeValue(element, symbolTable)), "IndexedValue", typeArguments = listOf(elementType), symbolTable = symbolTable)
        }
        ListValue(indexed, indexedType, symbolTable)
    }

    // ---- nullable receivers ------------------------------------------------

    /**
     * Kotlin allows `toString()`, `equals()` and `hashCode()` on any nullable
     * receiver (`Any?.toString()` and friends). Kotlite only has them as
     * members of `Any`, so `x.toString()` with `x: Int?` was rejected as an
     * unsafe call. A non-null receiver still resolves to the member.
     *
     * `super.toString()` in a class without superclass also resolves here, with
     * the object's `Any` part as receiver. That part then acts like `Any`
     * (whole object, no student override), RT-53.
     */
    private val nullableFunctions = listOf(
        function("Any?", "toString", "String") { interpreter, receiver, _, _ ->
            StringValue(when {
                receiver == null || receiver === NullValue -> "null"
                receiver.isInheritancePart() -> AnyClass.anyToString(receiver)
                else -> receiver.convertToString()
            }, interpreter.symbolTable())
        },
        function("Any?", "equals", "Boolean", listOf(parameter("other", "Any?"))) { interpreter, receiver, args, _ ->
            BooleanValue(when {
                receiver == null || receiver === NullValue -> args[0] === NullValue
                receiver.isInheritancePart() -> AnyClass.anyEquals(receiver, args[0])
                else -> receiver == args[0]
            }, interpreter.symbolTable())
        },
        function("Any?", "hashCode", "Int") { interpreter, receiver, _, _ ->
            IntValue(when {
                receiver == null || receiver === NullValue -> 0
                receiver.isInheritancePart() -> AnyClass.anyHashCode(receiver)
                else -> receiver.hashCode()
            }, interpreter.symbolTable())
        },
    )

    /** A part of a larger object, as `super` evaluates to it; not a value of its own. */
    private fun RuntimeValue.isInheritancePart() = this is ClassInstance && wholeInstance() !== this

    override val classes: List<ProvidedClassDefinition> = listOf(tripleClass, stringBuilderClass, randomClass, indexedValueClass, comparatorClass) + BlueKArrays.classes
    override val properties: List<ExtensionProperty> = numberProperties + listProperties + stringProperties + mapProperties + tripleProperties + stringBuilderProperties + indexedValueProperties
    override val globalProperties: List<GlobalProperty> = emptyList()
    override val functions: List<CustomFunctionDefinition> = numberFunctions + listFunctions + stringFunctions + textSequenceFunctions + collectionFunctions + mapFunctions + builderFunctions + randomFunctions + componentFunctions + nullableFunctions + BlueKArrays.functions
}
