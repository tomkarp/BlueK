import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.CharValue
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.DataType
import com.sunnychung.lib.multiplatform.kotlite.model.DelegatedValue
import com.sunnychung.lib.multiplatform.kotlite.model.DoubleValue
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionModifier
import com.sunnychung.lib.multiplatform.kotlite.model.IntValue
import com.sunnychung.lib.multiplatform.kotlite.model.LambdaValue
import com.sunnychung.lib.multiplatform.kotlite.model.ListValue
import com.sunnychung.lib.multiplatform.kotlite.model.LongValue
import com.sunnychung.lib.multiplatform.kotlite.model.NullValue
import com.sunnychung.lib.multiplatform.kotlite.model.ProvidedClassDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.StringValue
import com.sunnychung.lib.multiplatform.kotlite.model.SymbolTable
import com.sunnychung.lib.multiplatform.kotlite.model.TypeParameter
import com.sunnychung.lib.multiplatform.kotlite.model.UnitValue

/**
 * The content of a Kotlin array (RT-96): fixed size, elements replaceable,
 * equal only to itself like a JVM array. As a [List] it serves every library
 * function of `List`, since the array classes are `List` subtypes in BlueK.
 */
internal class ArrayContent(private val items: Array<RuntimeValue>) : AbstractList<RuntimeValue>(), RandomAccess {
    private val identity = nextIdentity++

    override val size: Int get() = items.size

    override fun get(index: Int): RuntimeValue {
        checkIndex(index)
        return items[index]
    }

    operator fun set(index: Int, value: RuntimeValue) {
        checkIndex(index)
        items[index] = value
    }

    fun replaceAll(values: List<RuntimeValue>) = values.forEachIndexed { index, value -> items[index] = value }

    // Kotlin/JS arrays do not check bounds; Kotlin on the JVM does.
    private fun checkIndex(index: Int) {
        if (index < 0 || index >= items.size) throw IndexOutOfBoundsException("Index $index out of bounds for length ${items.size}")
    }

    override fun equals(other: Any?): Boolean = this === other
    override fun hashCode(): Int = identity

    private companion object {
        var nextIdentity = 1
    }
}

/**
 * Kotlin arrays as library classes (RT-96): `Array<T>` and the primitive
 * arrays `IntArray`, `LongArray`, `DoubleArray`, `BooleanArray`, `CharArray`.
 * Each is a `List` of its element type in BlueK (Kotlin: not), so `size`,
 * `indices`, `for`, `sum()`, `map`, `joinToString` and the rest of the list
 * library work without separate definitions. Only what arrays add or do
 * differently is defined here: construction, `set`, in-place changes and the
 * `content…` functions.
 */
internal object BlueKArrays {
    private val BUILTIN = SourcePosition.BUILTIN
    private val t = listOf(TypeParameter("T", null))
    private val comparableT = listOf(TypeParameter("T", "Comparable<T>"))

    private class Primitive(val element: String, val default: (SymbolTable) -> RuntimeValue) {
        val arrayType = "${element}Array"
        val factory = element.replaceFirstChar { it.lowercase() } + "ArrayOf"
    }

    private val primitives = listOf(
        Primitive("Int") { IntValue(0, it) },
        Primitive("Long") { LongValue(0L, it) },
        Primitive("Double") { DoubleValue(0.0, it) },
        Primitive("Boolean") { BooleanValue(false, it) },
        Primitive("Char") { CharValue('\u0000', it) },
    )

    private fun arrayClass(name: String, typeParameters: List<TypeParameter>, elementType: String) = ProvidedClassDefinition(
        position = BUILTIN,
        fullQualifiedName = name,
        typeParameters = typeParameters,
        isInstanceCreationAllowed = false,
        primaryConstructorParameters = emptyList(),
        constructInstance = { _, _, _ -> throw UnsupportedOperationException() },
        // `List` is a class in Kotlite; `MutableList` extends it the same way.
        superClassInvocationString = "List<$elementType>()",
    )

    val classes: List<ProvidedClassDefinition> =
        listOf(arrayClass("Array", t, "T")) + primitives.map { arrayClass(it.arrayType, emptyList(), it.element) }

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

    /** A new array of class [type] (`Array` or a primitive array) holding [values]. */
    fun array(type: String, values: List<RuntimeValue>, elementType: DataType?, symbolTable: SymbolTable): DelegatedValue<ArrayContent> =
        DelegatedValue(
            ArrayContent(values.toTypedArray()),
            type,
            typeArguments = if (type == "Array") listOf(elementType ?: symbolTable.AnyType) else emptyList(),
            symbolTable = symbolTable,
        )

    private fun content(receiver: RuntimeValue?): ArrayContent = (receiver as DelegatedValue<*>).value as ArrayContent

    @Suppress("UNCHECKED_CAST")
    private fun elements(value: RuntimeValue?): List<RuntimeValue> = (value as DelegatedValue<*>).value as List<RuntimeValue>

    private fun size(value: RuntimeValue): Int {
        val size = (value as IntValue).value
        if (size < 0) throw IllegalArgumentException("Negative array size: $size")
        return size
    }

    private suspend fun initialized(size: Int, init: LambdaValue, symbolTable: SymbolTable): List<RuntimeValue> =
        (0 until size).map { init.executeSuspended(arrayOf(IntValue(it, symbolTable))) }

    private fun receiverType(type: String) = if (type == "Array") "Array<T>" else type
    private fun elementType(type: String) = if (type == "Array") "T" else type.removeSuffix("Array")
    private fun typeParameters(type: String) = if (type == "Array") t else emptyList()

    /** Functions every array type has, with the element type of [type]. */
    private fun common(type: String): List<CustomFunctionDefinition> {
        val receiver = receiverType(type)
        val element = elementType(type)
        val tp = typeParameters(type)
        fun copy(interpreter: Interpreter, receiver: RuntimeValue?, values: List<RuntimeValue>) =
            array(type, values, (receiver as DelegatedValue<*>).typeArguments.firstOrNull(), interpreter.symbolTable())
        return listOf(
            function(receiver, "set", "Unit", listOf(parameter("index", "Int"), parameter("value", element)), tp, setOf(FunctionModifier.operator)) { _, r, args, _ ->
                content(r)[(args[0] as IntValue).value] = args[1]
                UnitValue
            },
            function(receiver, "contentToString", "String", typeParameters = tp) { interpreter, r, _, _ ->
                StringValue(r!!.convertToString(isCallCustomFunction = true), interpreter.symbolTable())
            },
            function(receiver, "contentEquals", "Boolean", listOf(parameter("other", "$receiver?")), tp) { interpreter, r, args, _ ->
                val other = args[0].takeIf { it !== NullValue }?.let { elements(it) }
                BooleanValue(other != null && elements(r).toList() == other.toList(), interpreter.symbolTable())
            },
            function(receiver, "fill", "Unit", listOf(parameter("element", element)), tp) { _, r, args, _ ->
                val array = content(r)
                array.indices.forEach { array[it] = args[0] }
                UnitValue
            },
            function(receiver, "reverse", "Unit", typeParameters = tp) { _, r, _, _ ->
                content(r).let { it.replaceAll(it.reversed()) }
                UnitValue
            },
            function(receiver, "shuffle", "Unit", typeParameters = tp) { _, r, _, _ ->
                content(r).let { it.replaceAll(it.shuffled()) }
                UnitValue
            },
            function(receiver, "copyOf", receiver, typeParameters = tp) { interpreter, r, _, _ ->
                copy(interpreter, r, elements(r))
            },
            function(receiver, "copyOfRange", receiver, listOf(parameter("fromIndex", "Int"), parameter("toIndex", "Int")), tp) { interpreter, r, args, _ ->
                val from = (args[0] as IntValue).value
                val to = (args[1] as IntValue).value
                val values = elements(r)
                if (from < 0 || to > values.size || from > to) throw IndexOutOfBoundsException("fromIndex: $from, toIndex: $to, size: ${values.size}")
                copy(interpreter, r, values.subList(from, to))
            },
            function(receiver, "plus", receiver, listOf(parameter("element", element)), tp, setOf(FunctionModifier.operator)) { interpreter, r, args, _ ->
                copy(interpreter, r, elements(r) + args[0])
            },
            function(receiver, "asList", "List<$element>", typeParameters = tp) { interpreter, r, _, _ ->
                ListValue(elements(r), interpreter.symbolTable().AnyType, interpreter.symbolTable())
            },
        )
    }

    val functions: List<CustomFunctionDefinition> = listOf(
        function(null, "arrayOf", "Array<T>", listOf(parameter("elements", "T", setOf("vararg"))), t) { interpreter, _, args, typeArgs ->
            array("Array", elements(args[0]), typeArgs["T"], interpreter.symbolTable())
        },
        function(null, "emptyArray", "Array<T>", typeParameters = t) { interpreter, _, _, typeArgs ->
            array("Array", emptyList(), typeArgs["T"], interpreter.symbolTable())
        },
        function(null, "arrayOfNulls", "Array<T?>", listOf(parameter("size", "Int")), t) { interpreter, _, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            array("Array", List(size(args[0])) { NullValue }, typeArgs["T"]?.copyOf(isNullable = true), symbolTable)
        },
        suspendFunction(null, "Array", "Array<T>", listOf(parameter("size", "Int"), parameter("init", "(Int) -> T")), t) { interpreter, _, args, typeArgs ->
            val symbolTable = interpreter.symbolTable()
            array("Array", initialized(size(args[0]), args[1] as LambdaValue, symbolTable), typeArgs["T"], symbolTable)
        },
        function("Collection<T>", "toTypedArray", "Array<T>", typeParameters = t) { interpreter, receiver, _, typeArgs ->
            array("Array", elements(receiver).toList(), typeArgs["T"], interpreter.symbolTable())
        },
        function("String", "toCharArray", "CharArray") { interpreter, receiver, _, _ ->
            val symbolTable = interpreter.symbolTable()
            array("CharArray", (receiver as StringValue).value.map { CharValue(it, symbolTable) }, null, symbolTable)
        },
        function("CharArray", "concatToString", "String") { interpreter, receiver, _, _ ->
            StringValue(elements(receiver).joinToString("") { (it as CharValue).value.toString() }, interpreter.symbolTable())
        },
        suspendFunction("Array<T>", "sortWith", "Unit", listOf(parameter("comparator", "Comparator<T>")), t) { _, receiver, args, _ ->
            sortInPlace(receiver, BlueKStdlibModule.spec(args[0]))
        },
    ) + sorting("Array", comparableT) + common("Array") + primitives.flatMap { primitive ->
        val type = primitive.arrayType
        common(type) + listOf(
            function(null, primitive.factory, type, listOf(parameter("elements", primitive.element, setOf("vararg")))) { interpreter, _, args, _ ->
                array(type, elements(args[0]), null, interpreter.symbolTable())
            },
            function(null, type, type, listOf(parameter("size", "Int"))) { interpreter, _, args, _ ->
                val symbolTable = interpreter.symbolTable()
                array(type, List(size(args[0])) { primitive.default(symbolTable) }, null, symbolTable)
            },
            suspendFunction(null, type, type, listOf(parameter("size", "Int"), parameter("init", "(Int) -> ${primitive.element}"))) { interpreter, _, args, _ ->
                val symbolTable = interpreter.symbolTable()
                array(type, initialized(size(args[0]), args[1] as LambdaValue, symbolTable), null, symbolTable)
            },
            function("Collection<${primitive.element}>", "to$type", type) { interpreter, receiver, _, _ ->
                array(type, elements(receiver).toList(), null, interpreter.symbolTable())
            },
        ) + if (primitive.element == "Boolean") emptyList() else sorting(type, emptyList())
    }

    private suspend fun sortInPlace(receiver: RuntimeValue?, comparator: BlueKStdlibModule.ComparatorSpec): RuntimeValue {
        val array = content(receiver)
        array.replaceAll(BlueKStdlibModule.sortWith(array.toList(), comparator))
        return UnitValue
    }

    /** `sort()` and friends, stable like Kotlin's; selectors may suspend. */
    private fun sorting(type: String, typeParameters: List<TypeParameter>): List<CustomFunctionDefinition> {
        val receiver = receiverType(type)
        val selectorTypeParameters = typeParameters(type)
        fun sorted(interpreter: Interpreter, r: RuntimeValue?, values: List<RuntimeValue>) =
            array(type, values, (r as DelegatedValue<*>).typeArguments.firstOrNull(), interpreter.symbolTable())
        return listOf(
            suspendFunction(receiver, "sort", "Unit", emptyList(), typeParameters) { _, r, _, _ ->
                sortInPlace(r, BlueKStdlibModule.ComparatorSpec.Natural(false))
            },
            suspendFunction(receiver, "sortDescending", "Unit", emptyList(), typeParameters) { _, r, _, _ ->
                sortInPlace(r, BlueKStdlibModule.ComparatorSpec.Natural(true))
            },
            suspendFunction(receiver, "sortedArray", receiver, emptyList(), typeParameters) { interpreter, r, _, _ ->
                sorted(interpreter, r, BlueKStdlibModule.sortWith(elements(r), BlueKStdlibModule.ComparatorSpec.Natural(false)))
            },
            suspendFunction(receiver, "sortedArrayDescending", receiver, emptyList(), typeParameters) { interpreter, r, _, _ ->
                sorted(interpreter, r, BlueKStdlibModule.sortWith(elements(r), BlueKStdlibModule.ComparatorSpec.Natural(true)))
            },
            suspendFunction(receiver, "sortBy", "Unit", listOf(parameter("selector", "(${elementType(type)}) -> Any?")), selectorTypeParameters) { _, r, args, _ ->
                sortInPlace(r, BlueKStdlibModule.ComparatorSpec.Selectors(listOf(args[0] as LambdaValue), false))
            },
            suspendFunction(receiver, "sortByDescending", "Unit", listOf(parameter("selector", "(${elementType(type)}) -> Any?")), selectorTypeParameters) { _, r, args, _ ->
                sortInPlace(r, BlueKStdlibModule.ComparatorSpec.Selectors(listOf(args[0] as LambdaValue), true))
            },
        )
    }
}
