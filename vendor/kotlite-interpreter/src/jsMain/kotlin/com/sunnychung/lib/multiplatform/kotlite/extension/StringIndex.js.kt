package com.sunnychung.lib.multiplatform.kotlite.extension

// A JavaScript Map caches the hash of a string key; a Kotlin HashMap recomputes it.
actual class StringIndex actual constructor() {
    private val positions: dynamic = js("new Map()")

    actual operator fun get(key: String): Int {
        val position = positions.get(key)
        return if (position === undefined) -1 else position as Int
    }

    actual operator fun set(key: String, position: Int) {
        positions.set(key, position)
    }
}
