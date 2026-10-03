package com.sunnychung.lib.multiplatform.kotlite.model

class DoubleValue(override val value: Double, symbolTable: SymbolTable) : NumberValue<Double>, PrimitiveValue(symbolTable) {
    override fun primitiveType(rootSymbolTable: SymbolTable) = rootSymbolTable.DoubleType

    override fun convertToString(): String = kotlinJvmText(value)

    companion object {
        /**
         * Kotlin/JVM's `Double.toString()` (RT-60): plain from 10^-3 up to below 10^7 (`6.0`, `0.001`),
         * otherwise `1.2345678E7`, `1.0E-4`. Kotlin/JS prints `6`, `12345678` and `1e-7` instead.
         * The digits are the shortest that identify the value, as JavaScript and Java both choose them.
         */
        fun kotlinJvmText(value: Double): String {
            if (!value.isFinite()) return value.toString()
            if (value == 0.0) return if (1.0 / value < 0) "-0.0" else "0.0"
            val sign = if (value < 0) "-" else ""
            val text = kotlin.math.abs(value).toString().lowercase()
            val mantissa = text.substringBefore('e')
            val exponentOfText = if ('e' in text) text.substringAfter('e').toInt() else 0
            val allDigits = mantissa.replace(".", "")
            val firstDigit = allDigits.indexOfFirst { it != '0' }
            // value = 0.<significant digits> * 10^(exponent + 1)
            val exponent = mantissa.substringBefore('.').length - firstDigit - 1 + exponentOfText
            val significant = allDigits.substring(firstDigit).trimEnd('0')
            return sign + when {
                exponent in -3..6 && exponent >= 0 ->
                    significant.padEnd(exponent + 1, '0').let { it.substring(0, exponent + 1) + "." + it.substring(exponent + 1).ifEmpty { "0" } }
                exponent in -3..6 -> "0." + "0".repeat(-exponent - 1) + significant
                else -> significant[0] + "." + significant.substring(1).ifEmpty { "0" } + "E" + exponent
            }
        }
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
