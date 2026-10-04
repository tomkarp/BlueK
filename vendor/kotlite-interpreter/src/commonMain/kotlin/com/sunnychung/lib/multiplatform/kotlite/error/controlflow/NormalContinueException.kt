package com.sunnychung.lib.multiplatform.kotlite.error.controlflow

/** [label]: the loop of `continue@label`, or empty for the innermost loop (RT-85). */
class NormalContinueException(val label: String = "") : NormalControlFlowException("Continue")
