package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.lexer.BuiltinFilename

/**
 * Generic collection operations whose implementation needs the interpreter's
 * runtime type model. The receiver element type S is resolved from the
 * collection; the reified result type T is supplied by the call site.
 */
object GenericCollectionsModule : LibraryModule("generic-collections") {
    private val filterIsInstance = CustomFunctionDefinition(
        position = SourcePosition(BuiltinFilename.BUILTIN, 1, 1),
        receiverType = "Iterable<S>",
        functionName = "filterIsInstance",
        returnType = "List<T>",
        typeParameters = listOf(TypeParameter("T", null).also { it.isReified = true }),
        parameterTypes = emptyList(),
        modifiers = setOf(FunctionModifier.inline),
        executable = { interpreter: Interpreter, receiver, _, typeArgs ->
            val values = (receiver as DelegatedValue<*>).value as Iterable<RuntimeValue>
            val target = typeArgs["T"]
                ?: throw IllegalStateException("Missing reified type argument T")
            ListValue(
                values.filter { target.acceptsRuntimeType(it.type()) },
                target,
                interpreter.symbolTable(),
            )
        },
    ).also {
        it.extraTypeParameters = listOf(TypeParameter("S", null))
    }

    override val classes: List<ProvidedClassDefinition> = emptyList()
    override val properties: List<ExtensionProperty> = emptyList()
    override val globalProperties: List<GlobalProperty> = emptyList()
    override val functions: List<CustomFunctionDefinition> = listOf(filterIsInstance)
}
