package com.sunnychung.lib.multiplatform.kotlite.model

/** The published 1.1.0 stdlib predates the interpreter's inline modifier. */
internal object StdlibInlineMetadata {
    private val eagerOperations = setOf("forEach", "forEachIndexed", "map", "mapIndexed", "mapNotNull",
        "filter", "filterNot", "filterIndexed", "all", "any", "none", "count", "first", "firstOrNull",
        "last", "lastOrNull", "single", "singleOrNull", "find", "findLast", "fold", "foldIndexed",
        "reduce", "reduceIndexed", "onEach", "takeWhile", "dropWhile", "partition")

    fun restore(module: String, definition: CustomFunctionDefinition): CustomFunctionDefinition {
        val inline = when (module) {
            "Core" -> definition.functionName in setOf("let", "run", "with", "also", "apply") &&
                definition.receiverType in setOf(null, "T")
            "Collections" -> definition.functionName in eagerOperations &&
                definition.receiverType in setOf("Iterable<T>", "PrimitiveIterable<T>", "Map<K, V>")
            "Text" -> definition.functionName in eagerOperations && definition.receiverType == "String"
            "Byte" -> definition.functionName in eagerOperations && definition.receiverType == "ByteArray"
            else -> false
        }
        if (!inline) return definition
        return definition.copy(modifiers = definition.modifiers + FunctionModifier.inline).also {
            it.extraTypeParameters = definition.extraTypeParameters
            it.suspendExecutable = definition.suspendExecutable
        }
    }
}
