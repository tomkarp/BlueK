package com.sunnychung.lib.multiplatform.kotlite.extension

/** Positions by String key, backed by the platform's fastest string hash map. */
expect class StringIndex() {
    /** The position of [key], or -1. */
    operator fun get(key: String): Int
    operator fun set(key: String, position: Int)
}
