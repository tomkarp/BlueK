package com.sunnychung.lib.multiplatform.kotlite.error

import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition

/** A confirmed duplicate binding, independent of standard-library coverage. */
class DuplicatePropertyException(position: SourcePosition, name: String) :
    SemanticException(position, "Property `$name` has already been declared")
