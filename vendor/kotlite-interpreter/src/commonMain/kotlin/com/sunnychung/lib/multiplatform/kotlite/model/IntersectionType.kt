package com.sunnychung.lib.multiplatform.kotlite.model

/** Analysis-only conjunction: a value satisfies every bound, not just the last type guard. */
class IntersectionTypeNode(val bounds: List<TypeNode>, isNullable: Boolean = false) : TypeNode(
    SourcePosition.NONE, bounds.joinToString(" & ", "(", ")") { it.descriptiveName() }, null, isNullable,
) {
    override fun copy(isNullable: Boolean) = IntersectionTypeNode(bounds.map { it.copy(isNullable = isNullable) }, isNullable)
}

internal class IntersectionClassDefinition(bounds: List<ObjectType>, name: String) : ClassDefinition(
    currentScope = null, name = name, isInstanceCreationAllowed = false, modifiers = emptySet(),
    typeParameters = emptyList(), orderedInitializersAndPropertyDeclarations = emptyList(), declarations = emptyList(),
    rawMemberProperties = emptyList(), memberFunctions = emptyList(), primaryConstructor = null,
    superClass = bounds.firstOrNull { !it.clazz.isInterface }?.clazz,
    superInterfaces = bounds.filter { it.clazz.isInterface }.map { it.clazz },
    superInterfaceTypes = bounds.filter { it.clazz.isInterface }.map { it.toTypeNode() },
) {
    init {
        memberFunctionsForSA = emptyMap()
        bounds.firstOrNull { !it.clazz.isInterface }?.let {
            superClassInvocation = FunctionCallNode(position = SourcePosition.NONE, function = it.toTypeNode(),
                arguments = emptyList(), declaredTypeArguments = it.arguments.map { it.toTypeNode() })
        }
    }
}

class IntersectionType(val bounds: List<ObjectType>, nullable: Boolean = false) : ObjectType(
    IntersectionClassDefinition(bounds, bounds.joinToString(" & ", "(", ")") { it.descriptiveName }),
    emptyList(), nullable,
    bounds.flatMap { listOf(it) + it.superTypes }.distinctBy { it.name },
) {
    override fun toTypeNode(isResolveTypeArguments: Boolean) = IntersectionTypeNode(bounds.map { it.toTypeNode(isResolveTypeArguments) }, isNullable)
    override fun copyOf(isNullable: Boolean): ObjectType = if (this.isNullable == isNullable) this else IntersectionType(bounds.map { it.copyOf(isNullable) }, isNullable)
    override fun equals(other: Any?) = other is IntersectionType && isNullable == other.isNullable && bounds == other.bounds
    override fun hashCode() = 31 * bounds.hashCode() + isNullable.hashCode()
    override fun isCastableFrom(other: DataType) = bounds.all { it.copyOf(isNullable).isCastableFrom(other) }
    override fun isAssignableFrom(other: DataType) = bounds.all { it.copyOf(isNullable).isAssignableFrom(other) }
    override fun isConvertibleFrom(other: DataType, isResolveTypeArguments: Boolean) = bounds.all { it.copyOf(isNullable).isConvertibleFrom(other, isResolveTypeArguments) }
}

/** Remove redundant supertypes while retaining independent class/interface bounds. */
fun intersectTypes(first: ObjectType, second: ObjectType): ObjectType {
    val bounds = ((first as? IntersectionType)?.bounds ?: listOf(first)) + ((second as? IntersectionType)?.bounds ?: listOf(second))
    val distinct = bounds.distinctBy { it.descriptiveName }
    val minimal = distinct.filter { a -> distinct.none { b -> a !== b && a.isAssignableFrom(b) } }.sortedBy { it.descriptiveName }
    return if (minimal.size == 1) minimal.single() else IntersectionType(minimal, first.isNullable && second.isNullable)
}
