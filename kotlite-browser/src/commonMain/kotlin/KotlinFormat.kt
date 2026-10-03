import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.ByteValue
import com.sunnychung.lib.multiplatform.kotlite.model.CharValue
import com.sunnychung.lib.multiplatform.kotlite.model.DoubleValue
import com.sunnychung.lib.multiplatform.kotlite.model.IntValue
import com.sunnychung.lib.multiplatform.kotlite.model.LongValue
import com.sunnychung.lib.multiplatform.kotlite.model.NullValue
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import kotlin.math.abs

/**
 * Kotlin's `"%.2f".format(x)` / `String.format(...)` for school code (RT-66), following
 * `java.util.Formatter`: `%[index$][flags][width][.precision]conversion` with the conversions
 * `d x X o f s S c b % n` and the flags `- 0 + , space`.
 *
 * Unlike Kotlin/JVM it does not use the computer's locale: numbers always use `.` and `,`
 * (`"%.2f".format(3.14159)` is `3.14` also on a German system), as BlueK prints doubles.
 * Like Java, `%f` rounds half up on the shortest decimal form of the double (`0.15` -> `0.2`).
 * Errors are `IllegalArgumentException`s, as Java's format exceptions are.
 */
object KotlinFormat {
    private val specifier = Regex("%(\\d+\\$)?([-#+ 0,(]*)(\\d+)?(\\.\\d+)?([a-zA-Z%])")

    fun format(pattern: String, arguments: List<RuntimeValue>): String {
        var nextArgument = 0
        return specifier.replace(pattern) { match ->
            val (indexText, flags, widthText, precisionText, conversionText) = match.destructured
            val conversion = conversionText.single()
            val width = widthText.toIntOrNull()
            val precision = precisionText.drop(1).toIntOrNull()
            fun argument(): RuntimeValue {
                val index = indexText.dropLast(1).toIntOrNull()?.minus(1) ?: nextArgument++
                return arguments.getOrNull(index) ?: throw IllegalArgumentException("Format specifier '${match.value}' has no argument")
            }
            val text = when (conversion) {
                '%' -> "%"
                'n' -> "\n"
                'd' -> number(integer(argument(), match.value).toString(), flags)
                'x', 'X' -> integer(argument(), match.value).toString(16).let { if (conversion == 'X') it.uppercase() else it }
                'o' -> integer(argument(), match.value).toString(8)
                'f' -> number(fixed(decimal(argument(), match.value), precision ?: 6), flags)
                's', 'S' -> text(argument()).let { if (precision != null) it.take(precision) else it }
                    .let { if (conversion == 'S') it.uppercase() else it }
                'c' -> when (val value = argument()) {
                    is CharValue -> value.value.toString()
                    is IntValue -> value.value.toChar().toString()
                    else -> throw IllegalArgumentException("c != ${typeName(value)}")
                }
                'b' -> when (val value = argument()) {
                    NullValue -> "false"
                    is BooleanValue -> value.value.toString()
                    else -> "true"
                }
                else -> throw IllegalArgumentException("Conversion = '$conversion' is not supported in BlueK (use d, f, s, c, b, x, o, % or n)")
            }
            pad(text, width, flags, numeric = conversion in "dxXof")
        }
    }

    private fun integer(value: RuntimeValue, specifier: String): Long = when (value) {
        is IntValue -> value.value.toLong()
        is LongValue -> value.value
        is ByteValue -> value.value.toLong()
        else -> throw IllegalArgumentException("${specifier.last()} != ${typeName(value)}")
    }

    private fun decimal(value: RuntimeValue, specifier: String): Double = when (value) {
        is DoubleValue -> value.value
        else -> throw IllegalArgumentException("${specifier.last()} != ${typeName(value)}")
    }

    private fun text(value: RuntimeValue): String = if (value === NullValue) "null" else value.convertToString()

    private fun typeName(value: RuntimeValue): String = if (value === NullValue) "null" else value.type().name

    /** Sign, `+`/space flags and `,` grouping of the integer digits of a plain number text. */
    private fun number(plain: String, flags: String): String {
        if (plain == "NaN" || plain.endsWith("Infinity")) return plain
        val negative = plain.startsWith("-")
        var digits = plain.removePrefix("-")
        if (',' in flags) {
            val integerPart = digits.substringBefore('.')
            val grouped = integerPart.reversed().chunked(3).joinToString(",").reversed()
            digits = grouped + digits.substring(integerPart.length)
        }
        val sign = when {
            negative -> "-"
            '+' in flags -> "+"
            ' ' in flags -> " "
            else -> ""
        }
        return sign + digits
    }

    private fun pad(text: String, width: Int?, flags: String, numeric: Boolean): String {
        if (width == null || text.length >= width) return text
        return when {
            '-' in flags -> text.padEnd(width)
            '0' in flags && numeric && text.firstOrNull()?.let { it == '-' || it == '+' || it == ' ' } == true ->
                text[0] + text.substring(1).padStart(width - 1, '0')
            '0' in flags && numeric -> text.padStart(width, '0')
            else -> text.padStart(width)
        }
    }

    /** `value` with `precision` decimals, rounded half up on its shortest decimal form, as Java does. */
    internal fun fixed(value: Double, precision: Int): String {
        if (value.isNaN()) return "NaN"
        if (value.isInfinite()) return if (value > 0) "Infinity" else "-Infinity"
        val negative = value < 0 || (value == 0.0 && 1.0 / value < 0)
        val (integerDigits, fractionDigits) = plainDigits(abs(value))
        val kept = (integerDigits + fractionDigits.padEnd(precision, '0').take(precision))
        val roundUp = fractionDigits.getOrNull(precision)?.let { it >= '5' } ?: false
        val rounded = if (roundUp) increment(kept) else kept
        val integerLength = rounded.length - precision
        val result = rounded.substring(0, integerLength).ifEmpty { "0" } + if (precision > 0) "." + rounded.substring(integerLength) else ""
        return if (negative) "-$result" else result
    }

    /** The shortest decimal digits of a non-negative finite double, split at the decimal point. */
    private fun plainDigits(value: Double): Pair<String, String> {
        val text = value.toString().lowercase()
        val mantissa = text.substringBefore('e')
        val exponent = if ('e' in text) text.substringAfter('e').toInt() else 0
        val integerPart = mantissa.substringBefore('.')
        val fractionPart = mantissa.substringAfter('.', "")
        val digits = integerPart + fractionPart
        val point = integerPart.length + exponent
        return when {
            point <= 0 -> "0" to "0".repeat(-point) + digits
            point >= digits.length -> digits + "0".repeat(point - digits.length) to ""
            else -> digits.substring(0, point) to digits.substring(point)
        }
    }

    /** Adds one to a string of decimal digits (`"0999"` -> `"1000"`). */
    private fun increment(digits: String): String {
        val result = digits.toCharArray()
        var index = result.lastIndex
        while (index >= 0) {
            if (result[index] == '9') {
                result[index] = '0'
                index--
            } else {
                result[index] = result[index] + 1
                return result.concatToString()
            }
        }
        return "1" + result.concatToString()
    }
}
