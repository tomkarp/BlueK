package com.sunnychung.lib.multiplatform.kotlite.extension

// A JavaScript Set compares objects by reference.
actual class IdentitySet<T : Any> actual constructor() {
    private val values: dynamic = js("new Set()")

    actual fun add(value: T): Boolean {
        if (values.has(value) as Boolean) return false
        values.add(value)
        return true
    }

    actual operator fun contains(value: T): Boolean = values.has(value) as Boolean
}
