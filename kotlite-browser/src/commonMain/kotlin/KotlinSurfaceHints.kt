/**
 * Rewrites Kotlite's generic "not found" analysis errors into BlueK's own
 * wording, in the style of the existing `Import ... is not available in BlueK`
 * message.
 *
 * Kotlite reports a missing name the same way whether the student mistyped
 * something or wrote correct Kotlin that BlueK does not implement. BlueK
 * cannot tell those apart in general - it knows its own names, but not the
 * full Kotlin standard library. So the rewrite answers in three ways:
 *
 *  1. the name is a documented BlueK gap  -> say so, and name the alternative
 *  2. the name is close to a known name   -> suggest that name
 *  3. otherwise                           -> say it may be either, rather than
 *                                            implying the student is at fault
 *
 * The gap table mirrors `docs/kotlin-surface.md` and the `gaps` list in
 * `scripts/smoke-kotlin-surface.mjs`, which keeps it honest: the smoke test
 * fails once a listed gap starts working.
 */
object KotlinSurfaceHints {

    private const val ARRAYS = "BlueK has no arrays. Use listOf(...) or mutableListOf(...) instead."
    private const val TEXT_AS_LIST = "In BlueK a String is not a full character sequence. Use `for (c in text)`, `text[i]` or `text.toList()`."

    /** Documented gaps, as in docs/kotlin-surface.md. */
    private val gaps: Map<String, String> = mapOf(
        "arrayOf" to ARRAYS,
        "intArrayOf" to ARRAYS,
        "IntArray" to ARRAYS,
        "DoubleArray" to ARRAYS,
        "Array" to ARRAYS,
        "toIntArray" to ARRAYS,
        "toTypedArray" to ARRAYS,
        "toCharArray" to TEXT_AS_LIST,
        "chunked" to TEXT_AS_LIST,
        "windowed" to TEXT_AS_LIST,
        "format" to "BlueK cannot format numbers with a format string yet. Build the text yourself, e.g. \"\$betrag Euro\".",
        "withIndex" to "`withIndex()` is not available in BlueK. Use `indices` and read the element with `liste[i]`.",
        "Math" to "`Math` belongs to Java and is not available in BlueK. Kotlin writes `abs(x)`, `sqrt(x)` and `PI` directly.",
        "java" to "Java libraries are not available in BlueK. Use the Kotlin standard library instead.",
        "kotlin" to "BlueK does not support fully qualified calls such as `kotlin.math.abs(x)`. Write `import kotlin.math.abs` at the top of the file and then `abs(x)`.",
    )

    /** Members BlueK deliberately provides for one receiver only. */
    private val memberGaps: Map<Pair<String, String>, String> = mapOf(
        ("String" to "map") to TEXT_AS_LIST,
        ("String" to "filterIndexed") to TEXT_AS_LIST,
        ("String" to "toMutableList") to TEXT_AS_LIST,
        ("Double.Companion" to "MAX_VALUE") to "BlueK provides `Int.MAX_VALUE` and `Int.MIN_VALUE`, but no Double or Char limits.",
        ("Double.Companion" to "MIN_VALUE") to "BlueK provides `Int.MAX_VALUE` and `Int.MIN_VALUE`, but no Double or Char limits.",
        ("Char.Companion" to "MAX_VALUE") to "BlueK provides `Int.MAX_VALUE` and `Int.MIN_VALUE`, but no Double or Char limits.",
        ("Char.Companion" to "MIN_VALUE") to "BlueK provides `Int.MAX_VALUE` and `Int.MIN_VALUE`, but no Double or Char limits.",
    )

    private val notDeclared = Regex("^Property `([^`]+)` is not declared")
    private val noFunction = Regex("^No matching function or constructor `([^`]+)` found for the argument types")
    private val noMemberFunction = Regex("^No matching function `([^`]+)` found for type ([^ ]+) and the argument types")
    private val noMember = Regex("^Type `([^`]+)` has no member `([^`]+)`")

    /**
     * Returns BlueK's wording for [message], or null when the message is not
     * one of the "name not found" forms and should be passed through.
     * [knownNames] are the names BlueK actually provides.
     */
    fun rewrite(message: String, knownNames: Set<String>, declaredNames: Set<String> = emptySet()): String? {
        val position = message.indexOf(" at [")
        val body = if (position >= 0) message.substring(0, position) else message
        val suffix = if (position >= 0) message.substring(position) else ""

        val rewritten = rewriteBody(body, knownNames, declaredNames) ?: return null
        return rewritten + suffix
    }

    private fun rewriteBody(body: String, knownNames: Set<String>, declaredNames: Set<String>): String? {
        /**
         * Kotlite reports a wrong argument type with the same wording as an
         * unknown name. A name that exists somewhere is therefore an argument
         * problem, and Kotlite's message - which lists the argument types - is
         * the useful one. A documented gap is decided before this, because
         * there the receiver makes the case clear (e.g. `map` exists, but not
         * for String).
         */
        fun exists(name: String) = name in knownNames || name in declaredNames

        notDeclared.find(body)?.let { match ->
            val name = match.groupValues[1]
            // Unambiguous: the name is not in scope at all.
            return gaps[name] ?: unknown(name, knownNames)
        }
        noFunction.find(body)?.let { match ->
            val name = match.groupValues[1]
            gaps[name]?.let { return it }
            if (exists(name)) return null
            return unknown(name, knownNames)
        }
        noMemberFunction.find(body)?.let { match ->
            val (name, receiver) = match.groupValues[1] to match.groupValues[2]
            definiteMemberHint(receiver, name)?.let { return it }
            if (exists(name)) return null
            return memberHint(receiver, name, knownNames)
        }
        noMember.find(body)?.let { match ->
            val (receiver, name) = match.groupValues[1] to match.groupValues[2]
            // Unambiguous: the receiver type has no such member at all.
            return memberHint(receiver, name, knownNames)
        }
        return null
    }

    /** A documented gap for this receiver and name, if there is one. */
    private fun definiteMemberHint(receiver: String, name: String): String? {
        val plain = receiver.removeSuffix("?")
        return memberGaps[plain to name] ?: gaps[name]
    }

    private fun memberHint(receiver: String, name: String, knownNames: Set<String>): String {
        val plain = receiver.removeSuffix("?")
        memberGaps[plain to name]?.takeIf { it.isNotEmpty() }?.let { return it }
        gaps[name]?.let { return it }
        suggestion(name, knownNames)?.let { return "`$name` is not available for $plain in BlueK. Did you mean `$it`?" }
        return "`$name` is unknown for $plain: neither declared in this project nor provided by BlueK. Check the spelling - BlueK does not support every part of Kotlin."
    }

    private fun unknown(name: String, knownNames: Set<String>): String {
        suggestion(name, knownNames)?.let { return "`$name` is not available in BlueK. Did you mean `$it`?" }
        return "`$name` is unknown: neither declared in this project nor provided by BlueK. Check the spelling - BlueK does not support every part of Kotlin."
    }

    /** The closest known name, if it is close enough to be worth offering. */
    private fun suggestion(name: String, knownNames: Set<String>): String? {
        if (name.length < 3) return null
        val limit = if (name.length <= 5) 1 else 2
        return knownNames
            .filter { it != name && kotlin.math.abs(it.length - name.length) <= limit }
            .map { it to distance(name, it) }
            .filter { it.second in 1..limit }
            .minByOrNull { it.second }
            ?.first
    }

    /** Levenshtein distance, capped implicitly by the short names compared here. */
    private fun distance(left: String, right: String): Int {
        var previous = IntArray(right.length + 1) { it }
        var current = IntArray(right.length + 1)
        for (i in 1..left.length) {
            current[0] = i
            for (j in 1..right.length) {
                val substitution = previous[j - 1] + if (left[i - 1] == right[j - 1]) 0 else 1
                current[j] = minOf(substitution, previous[j] + 1, current[j - 1] + 1)
            }
            val swap = previous
            previous = current
            current = swap
        }
        return previous[right.length]
    }
}
