package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.error.InterpreterStateException
import com.sunnychung.lib.multiplatform.kotlite.lexer.BuiltinFilename

class CallStack {

    private val activationRecords = mutableListOf<ActivationRecord>()

    /** Number of class, initializer and member-function scopes on the stack. */
    private var classCodeScopes = 0

    init {
        activationRecords += ActivationRecord(
            functionFullQualifiedName = ":builtin",
            callPosition = SourcePosition(BuiltinFilename.BUILTIN, 1, 1),
            scopeType = ScopeType.Script,
            isFunctionCall = false,
            parent = null,
            scopeLevel = 0
        )
        activationRecords += ActivationRecord(
            functionFullQualifiedName = ":global",
            callPosition = SourcePosition(BuiltinFilename.GLOBAL, 1, 1),
            scopeType = ScopeType.Script,
            isFunctionCall = false,
            parent = activationRecords.last(),
            scopeLevel = 1
        )
    }

    internal fun builtinScope() = activationRecords[0].symbolTable

    internal fun provideBuiltinClass(clazz: ClassDefinition) {
        activationRecords[0].symbolTable.declareClass(SourcePosition.BUILTIN, clazz)
    }

    internal fun provideBuiltinFunction(function: CustomFunctionDeclarationNode) {
        if (function.receiver == null) {
            activationRecords[0].symbolTable.declareFunction(SourcePosition.BUILTIN, function.transformedRefName!!, function)
        } else {
            activationRecords[0].symbolTable.declareExtensionFunction(SourcePosition.BUILTIN, function.transformedRefName!!, function)
        }
    }

    internal fun provideBuiltinExtensionProperty(property: ExtensionProperty) {
        activationRecords[0].symbolTable.declareExtensionProperty(SourcePosition.BUILTIN, property.transformedName!!, property)
    }

    /**
     * Writes one stack trace line for a function or constructor [name] (null: top-level code) at
     * [position] (null: unknown, e.g. inside a native function); a null result omits the line.
     * Hosts map positions to their own files (RT-71).
     */
    var frameFormatter: (name: String?, position: SourcePosition?) -> String? = { name, position ->
        "${name ?: "<top-level>"}(${position?.let { "${it.filename}:${it.lineNum}" } ?: "Unknown Source"})"
    }

    /**
     * Like Kotlin, innermost first: each function or constructor with the position its code has
     * reached, i.e. [currentPosition] or the call into the next frame (RT-71). Without
     * [currentPosition] the trace is that of a new exception object, which starts where it is
     * created: the constructors that create it are no frames.
     */
    fun getStacktrace(currentPosition: SourcePosition? = null): List<String> {
        // first two are built-in and global, which are not in user scope
        val records = activationRecords.subList(2, activationRecords.size)
        var index = records.lastIndex
        var position = currentPosition
        if (position == null) {
            var creation = index
            while (creation >= 0 && !records[creation].isFunctionCall) {
                if (records[creation].frameName != null) {
                    position = records[creation].callPosition
                    index = creation - 1
                }
                creation -= 1
            }
        }
        val frames = mutableListOf<String>()
        while (index >= 0) {
            val record = records[index]
            if (record.frameName != null) {
                frameFormatter(record.frameName, if (record.isNative) null else position)?.let { frames += it }
                position = record.callPosition
            }
            index -= 1
        }
        frameFormatter(null, position)?.let { frames += it }
        return frames
    }

    fun push(functionFullQualifiedName: String?, scopeType: ScopeType, callPosition: SourcePosition, isFunctionCall: Boolean = false, frameName: String? = null, isNative: Boolean = false) {
        activationRecords += ActivationRecord(
            functionFullQualifiedName = functionFullQualifiedName,
            callPosition = callPosition,
            isFunctionCall = isFunctionCall,
            parent = activationRecords.last(),
            scopeLevel = activationRecords.size,
            scopeType = scopeType,
            frameName = frameName ?: if (isFunctionCall) functionFullQualifiedName ?: "<lambda>" else null,
            isNative = isNative,
        )
        if (scopeType.isClassCode()) classCodeScopes += 1
    }

    fun pop(scopeType: ScopeType) {
        val ar = activationRecords.removeLast()
        if (ar.scopeType != scopeType) {
            throw InterpreterStateException("A wrong scope is completed")
        }
        if (scopeType.isClassCode()) classCodeScopes -= 1
    }

    fun currentSymbolTable() = activationRecords.last().symbolTable

    /** Whether evaluation currently runs inside student class code. */
    internal fun isInsideClassCode(): Boolean = classCodeScopes > 0

    private fun ScopeType.isClassCode() =
        this == ScopeType.Class || this == ScopeType.ClassInitializer || this == ScopeType.ClassMemberFunction
}
