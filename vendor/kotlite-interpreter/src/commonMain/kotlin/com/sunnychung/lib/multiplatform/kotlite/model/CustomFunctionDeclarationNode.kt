package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.Parser
import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer

fun String.toTypeNode(filename: String) = Parser(Lexer(filename, this))
    .type(isParseDottedIdentifiers = true, isIncludeLastIdentifierAsTypeName = true)

class CustomFunctionDeclarationNode(
    val definition: CustomFunctionDefinition,
    position: SourcePosition? = null,
    name: String? = null,
    receiver: TypeNode? = null,
    returnType: TypeNode? = null,
    typeParameters: List<TypeParameterNode>? = null,
    valueParameters: List<FunctionValueParameterNode>? = null,
    modifiers: Set<FunctionModifier>? = null,
    body: BlockNode? = null,
    transformedRefName: String? = null,
) : FunctionDeclarationNode(
    position = position ?: definition.position,
    name = name ?: definition.functionName,
    receiver = receiver ?: definition.receiverType?.toTypeNode(definition.position.filename),
    declaredReturnType = returnType ?: definition.returnType.toTypeNode(definition.position.filename),
    typeParameters = typeParameters ?: definition.typeParameters.map {
        it.toTypeParameterNode(definition.position)
    },
    extraTypeParameters = definition.extraTypeParameters.toTypeParameterNodes(definition.position),
    valueParameters = valueParameters ?: definition.parameterTypes.map {
        FunctionValueParameterNode(
            position = definition.position,
            name = it.name,
            declaredType = it.type.toTypeNode(definition.position.filename),
            defaultValue = it.defaultValueExpression?.let { Parser(Lexer(definition.position.filename, it)).expression() },
            modifiers = with(Parser(Lexer("", ""))) { it.modifiers.toFunctionValueParameterModifiers() }
        )
    },
    declaredModifiers = modifiers ?: definition.modifiers,
    body = body ?: BlockNode(emptyList(), SourcePosition(definition.position.filename, 1, 1), ScopeType.Function, FunctionBodyFormat.Block, definition.returnType.toTypeNode(definition.position.filename)),
    transformedRefName = transformedRefName,
) {
    override suspend fun execute(interpreter: Interpreter, receiver: RuntimeValue?, arguments: List<RuntimeValue>, typeArguments: Map<String, DataType>): RuntimeValue {
        return definition.suspendExecutable?.invoke(interpreter, receiver, arguments, typeArguments)
            ?: definition.executable(interpreter, receiver, arguments, typeArguments)
    }

    override fun copy(
        name: String,
        receiver: TypeNode?,
        declaredReturnType: TypeNode?,
        typeParameters: List<TypeParameterNode>,
        valueParameters: List<FunctionValueParameterNode>,
        modifiers: Set<FunctionModifier>,
        body: BlockNode?,
        transformedRefName: String?,
        inferredReturnType: TypeNode?,
        extraTypeParameters: List<TypeParameterNode>,
    ): FunctionDeclarationNode {
        if (this::class != CustomFunctionDeclarationNode::class) {
            throw UnsupportedOperationException("Copying subclasses is not supported")
        }
        return CustomFunctionDeclarationNode(
            definition/*.copy(
                receiverType = receiver,
            )*/,
            name = name,
            receiver = receiver,
            returnType = declaredReturnType,
            typeParameters = typeParameters,
            valueParameters = valueParameters,
            modifiers = modifiers,
            body = body,
            transformedRefName = transformedRefName
        )
    }
}
