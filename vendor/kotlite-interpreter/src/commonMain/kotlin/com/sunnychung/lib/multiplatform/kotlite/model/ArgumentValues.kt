package com.sunnychung.lib.multiplatform.kotlite.model

/**
 * Already evaluated call arguments by position, which replace the evaluation
 * of the call's argument nodes. Calls only look them up by position; an array
 * avoids building a hash map for every accessor call or compound assignment.
 */
internal class ArgumentValues(private val arguments: Array<RuntimeValue?>) : AbstractMap<Int, RuntimeValue>() {
    override fun get(key: Int): RuntimeValue? = if (key in arguments.indices) arguments[key] else null

    override fun containsKey(key: Int): Boolean = get(key) != null

    override val size: Int get() = arguments.count { it != null }

    override fun isEmpty(): Boolean = arguments.all { it == null }

    override val entries: Set<Map.Entry<Int, RuntimeValue>>
        get() = arguments.indices.mapNotNull { index -> arguments[index]?.let { value -> object : Map.Entry<Int, RuntimeValue> {
            override val key = index
            override val value = value
        } } }.toSet()

    companion object {
        /** The value of the argument at [index]. */
        fun of(index: Int, value: RuntimeValue): Map<Int, RuntimeValue> =
            ArgumentValues(arrayOfNulls<RuntimeValue>(index + 1).also { it[index] = value })
    }
}
