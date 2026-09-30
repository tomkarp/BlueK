package com.sunnychung.lib.multiplatform.kotlite.extension

expect val Any.fullClassName: String

/**
 * Whether the host ran out of stack, e.g. a browser's `RangeError: Maximum call stack size exceeded`.
 * Interpreted code sees it as a Kotlin `StackOverflowError`.
 */
expect val Throwable.isHostStackOverflow: Boolean
