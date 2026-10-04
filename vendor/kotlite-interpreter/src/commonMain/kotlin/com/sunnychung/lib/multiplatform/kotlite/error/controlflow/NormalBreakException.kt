package com.sunnychung.lib.multiplatform.kotlite.error.controlflow

/** [label]: the loop of `break@label`, or empty for the innermost loop (RT-85). */
class NormalBreakException(val label: String = "") : NormalControlFlowException("Break")
