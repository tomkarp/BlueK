package com.sunnychung.lib.multiplatform.kotlite.model

/**
 * The published 1.1.0 stdlib calls lambdas synchronously
 * (`LambdaValue.execute`). Its higher-order functions only compute a result
 * from their receiver, arguments and callback results, so they are replayed
 * when a lambda suspends ([CustomFunctionDefinition.isReplayable]).
 */
internal object StdlibReplayMetadata {
    private val stdlibModules = setOf("Core", "Collections", "Text", "Byte")

    /** They change the receiver between callbacks; an abandoned attempt would leave it half-changed. */
    private val inPlaceOperations = setOf("MutableList<T>" to "removeAll", "MutableList<T>" to "retainAll")

    fun mark(module: String, definition: CustomFunctionDefinition): CustomFunctionDefinition {
        if (module in stdlibModules &&
            definition.parameterTypes.any { "->" in it.type } &&
            (definition.receiverType to definition.functionName) !in inPlaceOperations
        ) {
            definition.isReplayable = true
        }
        return definition
    }
}
