package com.sunnychung.lib.multiplatform.kotlite.model

class DoubleValue(override val value: Double, symbolTable: SymbolTable) : NumberValue<Double>, PrimitiveValue(symbolTable) {
    override fun primitiveType(rootSymbolTable: SymbolTable) = rootSymbolTable.DoubleType

    // Kotlin/JS prints whole doubles without a fraction (`6`); Kotlin prints `6.0`.
    override fun convertToString(): String {
        val text = value.toString()
        return if (value.isFinite() && text.none { it == '.' || it == 'e' || it == 'E' }) "$text.0" else text
    }
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is DoubleValue) return false

        if (value != other.value) return false

        return true
    }

    override fun hashCode(): Int {
        return value.hashCode()
    }
}
