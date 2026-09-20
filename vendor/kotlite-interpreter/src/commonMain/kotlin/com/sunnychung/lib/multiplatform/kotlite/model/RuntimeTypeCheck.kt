package com.sunnychung.lib.multiplatform.kotlite.model

/** Runtime classifier checks deliberately do not inspect erased generic arguments. */
fun DataType.acceptsRuntimeType(actual: DataType): Boolean {
    if (actual is NothingType) return actual.isNullable && isNullable
    if (actual.isNullable && !isNullable) return false
    return when (this) {
        is AnyType -> true
        is TypeParameterType -> upperBound.acceptsRuntimeType(actual)
        is FunctionType -> actual is FunctionType &&
            arguments.size + (if (receiverType != null) 1 else 0) ==
            actual.arguments.size + (if (actual.receiverType != null) 1 else 0)
        is ObjectType -> isCastableFrom(actual)
        else -> isAssignableFrom(actual)
    }
}
