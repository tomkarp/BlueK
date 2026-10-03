package com.sunnychung.lib.multiplatform.kotlite.model

open class DelegatedValue<T : Any>(override val value: T, fullClassName: String, clazz: ClassDefinition? = null, typeArguments: List<DataType> = emptyList(), symbolTable: SymbolTable) :
    ClassInstance(symbolTable, fullClassName = fullClassName, clazz = symbolTable.findClass(fullClassName)?.first, typeArguments = typeArguments), KotlinValueHolder<T> {
    /** Host wrappers with opaque payloads expose retained runtime values without executing the payload. */
    var retainedRuntimeValues: List<RuntimeValue> = emptyList()

    // Like Kotlin: `[1, 2, 3]`, `{a=1}`, `a=1` (a map entry), `(1, a)`, `(1, a, b)` and a
    // StringBuilder's content instead of `List()`.
    override fun convertToString(isCallCustomFunction: Boolean): String {
        fun element(item: Any?) = (item as? RuntimeValue)?.convertToString(isCallCustomFunction) ?: item.toString()
        return when (val content = value) {
            is Collection<*> -> content.joinToString(", ", "[", "]") { element(it) }
            is Map<*, *> -> content.entries.joinToString(", ", "{", "}") { "${element(it.key)}=${element(it.value)}" }
            is Pair<*, *> -> "(${element(content.first)}, ${element(content.second)})"
            is Map.Entry<*, *> -> "${element(content.key)}=${element(content.value)}"
            is Triple<*, *, *> -> "(${element(content.first)}, ${element(content.second)}, ${element(content.third)})"
            is StringBuilder -> content.toString()
            is IndexedValue<*> -> "IndexedValue(index=${content.index}, value=${element(content.value)})"
            else -> super.convertToString(isCallCustomFunction)
        }
    }

    /** Lists, sets, maps, map entries, pairs and triples compare by content like in Kotlin; other host values by identity. */
    private val hasContentEquality: Boolean
        get() = value.let { it is List<*> || it is Set<*> || it is Map<*, *> || it is Map.Entry<*, *> || it is Pair<*, *> || it is Triple<*, *, *> || it is IndexedValue<*> }

    // Kotlin's own equals: a list never equals a set; elements compare with their `equals`.
    private fun contentEquals(other: Any?) = other is DelegatedValue<*> && other.hasContentEquality && value == other.value

    override fun equals(other: Any?): Boolean =
        this === other || if (hasContentEquality) contentEquals(other) else super.equals(other)

    override fun hashCode(): Int = if (hasContentEquality) value.hashCode() else super.hashCode()

    /*
     * `equals()`, `hashCode()` and `toString()` of `Any` for this value. Library
     * classes may have exactly these `Any` members as their special functions,
     * which `ClassInstance` calls, so these never go back through `super`.
     */
    internal fun anyEquals(other: RuntimeValue): Boolean = this === other || hasContentEquality && contentEquals(other)
    internal fun anyHashCode(): Int = if (hasContentEquality) value.hashCode() else originalHashCode()
    // Elements of a list or pair use their own `toString()`, as in string templates.
    internal fun anyToString(): String =
        convertToString(isCallCustomFunction = value.let { it is Collection<*> || it is Map<*, *> || it is Map.Entry<*, *> || it is Pair<*, *> || it is Triple<*, *, *> || it is IndexedValue<*> })

    constructor(value: T, clazz: ClassDefinition, typeArguments: List<DataType> = emptyList(), symbolTable: SymbolTable) : this(
        value = value,
        fullClassName = clazz.fullQualifiedName,
        clazz = clazz,
        typeArguments = typeArguments,
        symbolTable = symbolTable
    )
}
