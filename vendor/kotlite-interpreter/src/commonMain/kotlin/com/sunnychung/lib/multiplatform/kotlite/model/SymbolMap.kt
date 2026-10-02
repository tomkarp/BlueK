package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.extension.StringIndex

/**
 * Insertion-ordered map with String keys for the tables of scopes, objects and
 * classes. The interpreter creates scopes for every call and block; they hold a
 * handful of names. Up to [LINEAR_LIMIT] entries are found by a linear search
 * without hashing (Kotlin/JS computes a string's hash code on every lookup) and
 * stored in two small arrays instead of a hash table. Larger tables, such as
 * the built-in scope, additionally keep a platform hash index.
 */
class SymbolMap<V : Any> : AbstractMutableMap<String, V>() {
    private var keyArray: Array<String?> = EMPTY_KEYS
    private var valueArray: Array<Any?> = EMPTY_VALUES
    private var count = 0
    private var index: StringIndex? = null

    override val size: Int get() = count

    private fun indexOf(key: String): Int {
        index?.let { return it[key] }
        val keys = keyArray
        for (position in 0 until count) if (keys[position] == key) return position
        return -1
    }

    @Suppress("UNCHECKED_CAST")
    override fun get(key: String): V? {
        val position = indexOf(key)
        return if (position < 0) null else valueArray[position] as V
    }

    override fun containsKey(key: String): Boolean = indexOf(key) >= 0

    @Suppress("UNCHECKED_CAST")
    override fun put(key: String, value: V): V? {
        val position = indexOf(key)
        if (position >= 0) {
            val previous = valueArray[position] as V
            valueArray[position] = value
            return previous
        }
        if (count == keyArray.size) grow()
        keyArray[count] = key
        valueArray[count] = value
        index?.set(key, count)
        count += 1
        if (index == null && count > LINEAR_LIMIT) rebuildIndex()
        return null
    }

    // Explicit loops: Kotlin/JS `copyOf(newSize)` is slow for the many tiny tables.
    private fun grow() {
        val capacity = if (count == 0) 4 else count * 2
        val keys = arrayOfNulls<String>(capacity)
        val values = arrayOfNulls<Any>(capacity)
        for (position in 0 until count) {
            keys[position] = keyArray[position]
            values[position] = valueArray[position]
        }
        keyArray = keys
        valueArray = values
    }

    override fun remove(key: String): V? {
        val position = indexOf(key)
        return if (position < 0) null else removeAt(position)
    }

    @Suppress("UNCHECKED_CAST")
    private fun removeAt(position: Int): V {
        val previous = valueArray[position] as V
        keyArray.copyInto(keyArray, position, position + 1, count)
        valueArray.copyInto(valueArray, position, position + 1, count)
        count -= 1
        keyArray[count] = null
        valueArray[count] = null
        if (index != null) rebuildIndex()
        return previous
    }

    override fun clear() {
        keyArray = EMPTY_KEYS
        valueArray = EMPTY_VALUES
        count = 0
        index = null
    }

    private fun rebuildIndex() {
        index = if (count > LINEAR_LIMIT) StringIndex().also { index ->
            for (position in 0 until count) index[keyArray[position]!!] = position
        } else null
    }

    override val entries: MutableSet<MutableMap.MutableEntry<String, V>> = object : AbstractMutableSet<MutableMap.MutableEntry<String, V>>() {
        override val size: Int get() = count

        override fun add(element: MutableMap.MutableEntry<String, V>): Boolean = put(element.key, element.value) != element.value

        override fun iterator(): MutableIterator<MutableMap.MutableEntry<String, V>> = object : MutableIterator<MutableMap.MutableEntry<String, V>> {
            private var next = 0
            private var last = -1

            override fun hasNext(): Boolean = next < count

            override fun next(): MutableMap.MutableEntry<String, V> {
                if (next >= count) throw NoSuchElementException()
                last = next
                next += 1
                @Suppress("UNCHECKED_CAST")
                return Entry(keyArray[last]!!, last, valueArray[last] as V)
            }

            override fun remove() {
                check(last >= 0) { "next() must be called before remove()" }
                removeAt(last)
                next = last
                last = -1
            }
        }
    }

    /** The entry with [key], found at [position]; it follows later changes like a hash map entry. */
    private inner class Entry(override val key: String, private var position: Int, private var lastValue: V) : MutableMap.MutableEntry<String, V> {
        @Suppress("UNCHECKED_CAST")
        override val value: V
            get() {
                // Keys are unique, so the same key object at the position means the entry did not move.
                if (keyArray.getOrNull(position) !== key) position = indexOf(key)
                if (position >= 0) lastValue = valueArray[position] as V
                return lastValue
            }

        override fun setValue(newValue: V): V = put(key, newValue)!!

        override fun equals(other: Any?): Boolean = other is Map.Entry<*, *> && other.key == key && other.value == value

        override fun hashCode(): Int = key.hashCode() xor value.hashCode()

        override fun toString(): String = "$key=$value"
    }

    private companion object {
        const val LINEAR_LIMIT = 8
        val EMPTY_KEYS = arrayOfNulls<String>(0)
        val EMPTY_VALUES = arrayOfNulls<Any>(0)
    }
}
