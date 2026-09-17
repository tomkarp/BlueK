package com.sunnychung.lib.multiplatform.kotlite.model

open class DelegatedValue<T : Any>(override val value: T, fullClassName: String, clazz: ClassDefinition? = null, typeArguments: List<DataType> = emptyList(), symbolTable: SymbolTable) :
    ClassInstance(symbolTable, fullClassName = fullClassName, clazz = symbolTable.findClass(fullClassName)?.first, typeArguments = typeArguments), KotlinValueHolder<T> {
    /** Host wrappers with opaque payloads expose retained runtime values without executing the payload. */
    var retainedRuntimeValues: List<RuntimeValue> = emptyList()
    constructor(value: T, clazz: ClassDefinition, typeArguments: List<DataType> = emptyList(), symbolTable: SymbolTable) : this(
        value = value,
        fullClassName = clazz.fullQualifiedName,
        clazz = clazz,
        typeArguments = typeArguments,
        symbolTable = symbolTable
    )
}
