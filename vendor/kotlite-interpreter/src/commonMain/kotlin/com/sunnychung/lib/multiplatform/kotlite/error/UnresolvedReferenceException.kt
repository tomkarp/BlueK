package com.sunnychung.lib.multiplatform.kotlite.error

import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition

class UnresolvedReferenceException(position: SourcePosition, name: String)
    : SemanticException(position, "unresolved reference '$name'.")
