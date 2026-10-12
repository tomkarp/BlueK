package com.sunnychung.lib.multiplatform.kotlite.error

import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition

class ArgumentTypeMismatchException(position: SourcePosition, expected: String, actual: String)
    : SemanticException(position, "argument type mismatch: actual type is '$actual', but '$expected' was expected.")
