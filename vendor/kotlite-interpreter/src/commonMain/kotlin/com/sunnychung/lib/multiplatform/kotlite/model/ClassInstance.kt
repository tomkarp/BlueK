package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.extension.merge

open class ClassInstance(
    currentScope: SymbolTable,
    protected val fullClassName: String,
    clazz: ClassDefinition? = null,
    val typeArguments: List<DataType>,
    private val memberPropertyValues: MutableMap<String, RuntimeValueAccessor> = mutableMapOf(),

    /**
     * The purpose of `parentInstance` is to support type parameters in superclass and private properties (not supported now)
     * without introducing big changes and complexities to existing codebase.
     *
     * It can be flattened in the future.
     */
    val parentInstance: ClassInstance? = null,
) : RuntimeValue, ComparableRuntimeValue<Comparable<Any>, Any> {
    internal var clazz: ClassDefinition? = null
    internal var hasInitialized: Boolean = false
    internal var typeArgumentByName: Map<String, DataType> = emptyMap()
    internal var type: DataType? = null

    init {
        if (clazz != null) {
            attach(clazz, currentScope)
        }
    }

    final override fun type(): DataType = type ?: throw RuntimeException("This object has not been initialized")

    internal fun attach(clazz: ClassDefinition, currentScope: SymbolTable) {
        if (clazz.fullQualifiedName != fullClassName) throw RuntimeException("The class to attach does not match with class name")
        if (this.clazz != null) throw RuntimeException("This object has already been initialized")
        this.clazz = clazz

        typeArgumentByName = clazz.typeParameters.mapIndexed { index, tp ->
            tp.name to typeArguments[index]
        }.toMap()

        clazz.getDeclaredPropertiesInThisClass().forEach {
            memberPropertyValues[it.key] = RuntimeValueHolder(it.value.type.resolveTypeParameter(), it.value.isMutable, null)
        }

        clazz.getDeclaredPropertyAccessorsInThisClass().forEach {
            val backing = RuntimeValueHolder(clazz.findMemberProperty(it.key)!!.type.resolveTypeParameter(), true, null)
            memberPropertyValues[it.key] = RuntimeValueDelegate(
                type = clazz.findMemberProperty(it.key)!!.type.resolveTypeParameter(),
                reader = { interpreter ->
                    with(interpreter!!) {
                        val function = it.value.getter ?: return@with backing.read(this)
                        FunctionCallNode(
                            function,
                            emptyList(),
                            emptyList(),
                            SourcePosition("", 1, 1)
                        ).evalClassMemberAnyFunctionCall(this@ClassInstance, function, extraScopePropertyHolders = mapOf("field" to backing))
                    }
                },
                writer = { interpreter, value ->
                    if (it.value.setterIsDefault) {
                        backing.assign(interpreter, value)
                    } else {
                        with(interpreter!!) {
                            val function = it.value.setter ?: return@with backing.assign(this, value)
                            FunctionCallNode(
                                function,
                                listOf(
                                    FunctionCallArgumentNode(
                                        SourcePosition.NONE, index = 0, value = ValueNode(
                                            SourcePosition.NONE, value
                                        )
                                    )
                                ),
                                emptyList(),
                                SourcePosition("", 1, 1)
                            ).evalClassMemberAnyFunctionCall(this@ClassInstance, function, extraScopePropertyHolders = mapOf("field" to backing))
                        }
                    }
                },
                backing = backing,
            )
        }

        type = currentScope.resolveObjectType(clazz, typeArguments.map { it.toTypeNode() }, false)

        hasInitialized = true
    }

    /** Host/runtime bridge access to a declared member without exposing the class internals. */
    fun findMemberFunctionByDeclaredName(declaredName: String): FunctionDeclarationNode? =
        clazz?.findMemberFunctionsByDeclaredName(declaredName)?.values?.firstOrNull()

    internal fun assignBacking(name: String, interpreter: Interpreter, value: RuntimeValue) {
        (memberPropertyValues[name] as? RuntimeValueDelegate)?.backing?.assign(interpreter, value)
            ?: throw RuntimeException("Property $name has no backing field")
    }

    suspend fun assign(interpreter: Interpreter? = null, name: String, value: RuntimeValue): Pair<Boolean, FunctionDeclarationNode?> {
        val name = resolveRuntimeMemberName(name)
            ?: return parentInstance?.assign(interpreter = interpreter, name = name, value = value)
            ?: throw RuntimeException("Property $name is not defined in class ${clazz!!.fullQualifiedName}")

        (memberPropertyValues[name] as? RuntimeValueDelegate)?.let {
            it.assignSuspended(interpreter, value)
            return true to null
        }

        // TODO remove
        val customAccessor = clazz!!.findMemberPropertyCustomAccessor(name, inThisClassOnly = true)
        customAccessor?.setter?.let {
//            return it
            memberPropertyValues[name]!!.assignSuspended(interpreter, value)
            return true to null
        }

        val propertyDefinition = clazz!!.findMemberPropertyWithoutAccessor(name, inThisClassOnly = true)
            ?: throw RuntimeException("Property $name is not defined in class ${clazz!!.fullQualifiedName}")
//        if (!propertyDefinition.isMutable && memberPropertyValues.containsKey(name)) {
//            throw RuntimeException("val cannot be reassigned")
//        }
        if (!propertyDefinition.type.resolveTypeParameter().isAssignableFrom(value.type())) {
            throw RuntimeException("Type ${value.type().name} cannot be casted to ${propertyDefinition.type.descriptiveName}")
        }

        memberPropertyValues[name]!!.assignSuspended(interpreter, value)
        return true to null
    }

    /**
     * Return value must be either FunctionDeclarationNode (if custom getter is defined) or RuntimeValue
     */
    suspend fun read(interpreter: Interpreter? = null, name: String): Any {
        val name = resolveRuntimeMemberName(name)
            ?: return parentInstance?.read(interpreter = interpreter, name = name)
            ?: throw RuntimeException("Property $name is not defined in class ${clazz!!.fullQualifiedName}")

        (memberPropertyValues[name] as? RuntimeValueDelegate)?.let { return it.readSuspended(interpreter) }

        // TODO remove
        val customAccessor = clazz!!.findMemberPropertyCustomAccessor(name, inThisClassOnly = true)
        customAccessor?.getter?.let {
//            return it
            return memberPropertyValues[name]!!.readSuspended(interpreter)
        }

        val propertyDefinition = clazz!!.findMemberPropertyWithoutAccessor(name, inThisClassOnly = true)
            ?: throw RuntimeException("Property $name is not defined in class ${clazz!!.fullQualifiedName}")

        return memberPropertyValues[name]!!.readSuspended(interpreter)
    }

    fun getPropertyHolder(name: String): RuntimeValueAccessor? {
        val name = resolveRuntimeMemberName(name)
            ?: return parentInstance?.getPropertyHolder(name)
            ?: throw RuntimeException("Property $name is not declared in class ${clazz!!.fullQualifiedName}")

        return memberPropertyValues[name]
    }

    private fun resolveRuntimeMemberName(name: String): String? {
        // Equivalent to the first key equal to `name` or to its declared-name
        // prefix, but without scanning all members and allocating a substring
        // per member on every property access. Only when both candidates exist
        // does the key order decide, so keep the scan for that case.
        val prefix = name.substringBeforeLast('/')
        val hasName = memberPropertyValues.containsKey(name)
        val hasPrefix = prefix != name && memberPropertyValues.containsKey(prefix)
        return when {
            hasName && hasPrefix -> memberPropertyValues.keys.first { it == name || it == prefix }
            hasName -> name
            hasPrefix -> prefix
            else -> clazz!!.findMemberPropertyDeclaredName(name, inThisClassOnly = true)
        }
    }

    fun findPropertyByDeclaredName(declaredName: String, interpreter: Interpreter? = null): RuntimeValue {
        return memberPropertyValues[declaredName]?.read(interpreter)
            ?: parentInstance?.findPropertyByDeclaredName(declaredName, interpreter)
            ?: throw RuntimeException("Property $declaredName is not declared in class ${clazz!!.fullQualifiedName}")
    }

    /**
     * Reads a property's backing field without invoking a custom getter.
     * Hosts such as BlueK use this for a passive object inspector.
     */
    fun readBackingPropertyByDeclaredName(declaredName: String): RuntimeValue? {
        val name = resolveRuntimeMemberName(declaredName)
            ?: return parentInstance?.readBackingPropertyByDeclaredName(declaredName)
        val accessor = memberPropertyValues[name] ?: return parentInstance?.readBackingPropertyByDeclaredName(declaredName)
        return (accessor as? RuntimeValueDelegate)?.backing?.read(null) ?: accessor.read(null)
    }

    internal fun getAllMemberProperties(): Map<String, RuntimeValueAccessor> {
        return memberPropertyValues merge (parentInstance?.getAllMemberProperties() ?: emptyMap())
    }

    /**
     * This method should not make use of parentInstance to avoid logic errors, e.g. same type parameter name resolved
     * to an unexpected type.
     */
    private fun DataType.resolveTypeParameter(): DataType {
        if (this !is TypeParameterType) return this
        return typeArgumentByName[name]?.let {
            it.copyOf(isNullable = it.isNullable || isNullable)
        } ?: TODO()
    }

    override fun compareTo(other: ComparableRuntimeValue<Comparable<Any>, Any>): Int {
        clazz?.compareToExec?.let { executable ->
            return executable(this, other)
        }
        throw RuntimeException("Class ${clazz!!.fullQualifiedName} is not comparable")
    }

    override fun equals(other: Any?): Boolean {
        if (other !is RuntimeValue) return false
        clazz?.getSpecialFunction(SpecialFunction.Name.Equals)
            ?.call(clazz!!.interpreter!!, this, listOf(other))
            ?.let { return (it as BooleanValue).value }
        return super.equals(other)
    }

    override fun hashCode(): Int {
        clazz?.getSpecialFunction(SpecialFunction.Name.HashCode)
            ?.call(clazz!!.interpreter!!, this, emptyList())
            ?.let { return (it as IntValue).value }
        return super.hashCode()
    }

    fun originalHashCode() = super.hashCode()

    override fun convertToString(isCallCustomFunction: Boolean): String {
        if (isCallCustomFunction) {
            clazz?.getSpecialFunction(SpecialFunction.Name.ToString)
                ?.call(clazz!!.interpreter!!, this, emptyList())
                ?.let { return (it as StringValue).value }
        }
        return "${clazz!!.fullQualifiedName}()"
    }

    override fun convertToString(): String {
        return convertToString(isCallCustomFunction = true)
    }

    override fun toString(): String = convertToString()
}
