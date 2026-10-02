package com.sunnychung.lib.multiplatform.kotlite.extension

actual class StringIndex actual constructor() {
    private val positions = HashMap<String, Int>()

    actual operator fun get(key: String): Int = positions[key] ?: -1

    actual operator fun set(key: String, position: Int) {
        positions[key] = position
    }
}
