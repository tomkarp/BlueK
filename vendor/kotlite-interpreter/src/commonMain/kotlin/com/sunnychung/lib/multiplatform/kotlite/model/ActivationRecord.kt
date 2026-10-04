package com.sunnychung.lib.multiplatform.kotlite.model

class ActivationRecord(
    val functionFullQualifiedName: String?,
    val scopeType: ScopeType,
    val callPosition: SourcePosition,
    val isFunctionCall: Boolean,
    private val parent: ActivationRecord?,
    private val scopeLevel: Int,
    /** The name of this record in a stack trace (`Karte.wert`, `Karte.<init>`); null if it is no frame. */
    val frameName: String? = null,
    /** A native (host) function: its code has no source position. */
    val isNative: Boolean = false,
) {
    val symbolTable: SymbolTable = SymbolTable(
        scopeLevel = scopeLevel,
        scopeName = functionFullQualifiedName ?: "<anonymous>",
        scopeType = scopeType,
        parentScope = parent?.symbolTable
    )
}
