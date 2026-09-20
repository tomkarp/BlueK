package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.Interpreter

data class CustomFunctionDefinition(
    val position: SourcePosition,

    val receiverType: String?,
    val functionName: String,

    val returnType: String,
    val typeParameters: List<TypeParameter> = emptyList(),
    /**
     * List of arguments, which each is a pair of parameter name and data type.
     */
    val parameterTypes: List<CustomFunctionParameter>,
    val modifiers: Set<FunctionModifier> = emptySet(),

    val executable: (interpreter: Interpreter, receiver: RuntimeValue?, args: List<RuntimeValue>, typeArgs: Map<String, DataType>) -> RuntimeValue,
) {
    /**
     * Type parameters resolved from a generic receiver, but not supplied at
     * the call site. This keeps receiver and function type arguments
     * independent for generic extension functions.
     */
    var extraTypeParameters: List<TypeParameter> = emptyList()
    var suspendExecutable: (suspend (Interpreter, RuntimeValue?, List<RuntimeValue>, Map<String, DataType>) -> RuntimeValue)? = null
}

class CustomFunctionParameter(val name: String, val type: String, val defaultValueExpression: String? = null, val modifiers: Set<String> = emptySet())

class TypeParameter(val name: String, val typeUpperBound: String?) {
    var variance: Variance = Variance.Invariant
    var isReified: Boolean = false
}
fun TypeParameter.toTypeParameterNode(position: SourcePosition) = TypeParameterNode(
    position,
    this.name,
    this.typeUpperBound?.toTypeNode("TODO"),
    isReified = this.isReified,
    variance = this.variance,
)
fun List<TypeParameter>.toTypeParameterNodes(position: SourcePosition = SourcePosition.NONE) = this.map { it.toTypeParameterNode(position) }
