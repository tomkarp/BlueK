package com.sunnychung.lib.multiplatform.kotlite.extension

actual class IdentitySet<T : Any> actual constructor() {
    private val values = mutableListOf<T>()

    actual fun add(value: T): Boolean {
        if (contains(value)) return false
        values += value
        return true
    }

    actual operator fun contains(value: T): Boolean = values.any { it === value }
}
