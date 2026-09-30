package com.sunnychung.lib.multiplatform.kotlite.extension

// A native JS error, e.g. a `RangeError`, has no Kotlin class name.
actual val Any.fullClassName: String
    get() = this::class.simpleName ?: (asDynamic().name as? String) ?: "Throwable"

actual val Throwable.isHostStackOverflow: Boolean
    get() {
        val name = asDynamic().name as? String
        val text = message.orEmpty()
        // V8 and JavaScriptCore: RangeError "Maximum call stack size exceeded"; SpiderMonkey: InternalError "too much recursion".
        return (name == "RangeError" && "call stack" in text) || (name == "InternalError" && "recursion" in text)
    }
