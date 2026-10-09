package com.sunnychung.lib.multiplatform.kotlite.model

/**
 * Kotlin's `Number`, the common supertype of the numeric types. Kotlite has no
 * user-extensible abstract classes for built-in types, so it is an interface of
 * Int, Long, Double and Byte; the conversions (`toInt()`, `toDouble()`, …) are
 * native extension functions of the host (BlueK) (RT-108).
 */
object NumberInterface {
    val interfaze = ProvidedClassDefinition(
        fullQualifiedName = "Number",
        isInterface = true,
        typeParameters = emptyList(),
        isInstanceCreationAllowed = false,
        primaryConstructorParameters = emptyList(),
        constructInstance = { _, _, _ -> throw UnsupportedOperationException() },
        functions = emptyList(),
        position = SourcePosition.BUILTIN,
    )

    val numericTypes = setOf("Int", "Long", "Double", "Byte")
}
