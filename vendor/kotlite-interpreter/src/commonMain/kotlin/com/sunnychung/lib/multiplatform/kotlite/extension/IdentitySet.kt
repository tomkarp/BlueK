package com.sunnychung.lib.multiplatform.kotlite.extension

/**
 * A set that compares its elements by identity (`===`) and never calls
 * `equals`/`hashCode`, which may run interpreted student code.
 */
expect class IdentitySet<T : Any>() {
    /** Adds [value]; false if it was already contained. */
    fun add(value: T): Boolean
    operator fun contains(value: T): Boolean
}
