package com.sunnychung.lib.multiplatform.kotlite.error

import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition

/** A language-rule violation established independently of library availability. */
class DefiniteSourceException(position: SourcePosition, message: String) : SemanticException(position, message)
