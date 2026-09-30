package com.sunnychung.lib.multiplatform.kotlite.error

/**
 * The interpreter cannot do what the program asks at this point (e.g. a host cannot pause inside `toString()`) or
 * cannot continue consistently. This is not an exception of the interpreted program: its `catch` blocks never
 * handle it.
 */
class InterpreterStateException(message: String) : IllegalStateException(message)
