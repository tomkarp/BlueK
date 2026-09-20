package com.sunnychung.lib.multiplatform.kotlite.model

open class DelegatedValue<T : Any>(override val value: T, fullClassName: String, clazz: ClassDefinition? = null, typeArguments: List<DataType> = emptyList(), symbolTable: SymbolTable) :
    ClassInstance(symbolTable, fullClassName = fullClassName, clazz = symbolTable.findClass(fullClassName)?.first, typeArguments = typeArguments), KotlinValueHolder<T> {
    /** Host wrappers with opaque payloads expose retained runtime values without executing the payload. */
    var retainedRuntimeValues: List<RuntimeValue> = emptyList()

    // Like Kotlin: `[1, 2, 3]` and `{a=1}` instead of `List()`.
    override fun convertToString(isCallCustomFunction: Boolean): String {
        fun element(item: Any?) = (item as? RuntimeValue)?.convertToString(isCallCustomFunction) ?: item.toString()
        return when (val content = value) {
            is Collection<*> -> content.joinToString(", ", "[", "]") { element(it) }
            is Map<*, *> -> content.entries.joinToString(", ", "{", "}") { "${element(it.key)}=${element(it.value)}" }
            else -> super.convertToString(isCallCustomFunction)
        }
    }
    constructor(value: T, clazz: ClassDefinition, typeArguments: List<DataType> = emptyList(), symbolTable: SymbolTable) : this(
        value = value,
        fullClassName = clazz.fullQualifiedName,
        clazz = clazz,
        typeArguments = typeArguments,
        symbolTable = symbolTable
    )
}
