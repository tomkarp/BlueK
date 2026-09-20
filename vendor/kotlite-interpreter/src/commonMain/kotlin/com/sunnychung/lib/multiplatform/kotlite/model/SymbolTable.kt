package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.Parser
import com.sunnychung.lib.multiplatform.kotlite.error.DuplicateIdentifierException
import com.sunnychung.lib.multiplatform.kotlite.error.IdentifierClassifier
import com.sunnychung.lib.multiplatform.kotlite.extension.resolveGenericParameterTypeArguments
import com.sunnychung.lib.multiplatform.kotlite.extension.resolveGenericParameterTypeToUpperBound
import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer
import com.sunnychung.lib.multiplatform.kotlite.log
import com.sunnychung.lib.multiplatform.kotlite.util.ClassMemberResolver

open class SymbolTable(
    val scopeLevel: Int,
    val scopeName: String,
    val scopeType: ScopeType,
    var parentScope: SymbolTable?,
    val returnType: DataType? = null,
    val isInitOnCreate: Boolean = true,
) {
    init {
        if (parentScope == this) {
            throw RuntimeException("There is an immediate cycle in symbol table hierarchy")
        }

        // Only `this` can close a cycle while it is being constructed; avoid a
        // set allocation here because a scope is created for every call/block.
        var parent = parentScope
        while (parent != null) {
            if (parent == this) {
                throw RuntimeException("There is a cycle in symbol table hierarchy")
            }
            parent = parent.parentScope
        }
    }

    // Invocation tokens captured by inline lambdas. Tokens contain no runtime objects.
    private var returnTargetsStore: MutableMap<String, Any>? = null
    internal val returnTargets: MutableMap<String, Any> get() = returnTargetsStore ?: mutableMapOf<String, Any>().also { returnTargetsStore = it }
    internal fun findReturnTarget(id: String): Any? = returnTargetsStore?.get(id) ?: parentScope?.findReturnTarget(id)

    // Scopes of blocks and calls frequently declare no local property at all.
    private var propertyDeclarationsStore: MutableMap<String, PropertyType>? = null
    private var propertyValuesStore: MutableMap<String, RuntimeValueAccessor>? = null
    private val propertyDeclarations: MutableMap<String, PropertyType> get() = propertyDeclarationsStore ?: mutableMapOf<String, PropertyType>().also { propertyDeclarationsStore = it }
    internal val propertyValues: MutableMap<String, RuntimeValueAccessor> get() = propertyValuesStore ?: mutableMapOf<String, RuntimeValueAccessor>().also { propertyValuesStore = it }
    private var transformedSymbolsStore: MutableMap<Pair<IdentifierClassifier, String>, String>? = null
    private var transformedSymbolsByDeclaredNameStore: MutableMap<Pair<IdentifierClassifier, String>, String>? = null
    internal val transformedSymbols: MutableMap<Pair<IdentifierClassifier, String>, String> get() = transformedSymbolsStore ?: mutableMapOf<Pair<IdentifierClassifier, String>, String>().also { transformedSymbolsStore = it } // only use in SemanticAnalyzer. transformed name -> original name
    internal val transformedSymbolsByDeclaredName: MutableMap<Pair<IdentifierClassifier, String>, String> get() = transformedSymbolsByDeclaredNameStore ?: mutableMapOf<Pair<IdentifierClassifier, String>, String>().also { transformedSymbolsByDeclaredNameStore = it } // only use in SemanticAnalyzer. original name -> transformed name

    // Most runtime call/block scopes never declare classes, functions or types.
    // Allocate their metadata tables only if actually used, not on every act call.
    // Plain nullable fields instead of `by lazy`: Kotlin/JS creates a property
    // reference on every delegated access, which dominated interpreter call time.
    // Lookups read `*Store` directly so that a miss does not allocate a table.
    private var propertyOwnersStore: MutableMap<String, PropertyOwnerInfo>? = null
    internal val propertyOwners: MutableMap<String, PropertyOwnerInfo> get() = propertyOwnersStore ?: mutableMapOf<String, PropertyOwnerInfo>().also { propertyOwnersStore = it } // only use in SemanticAnalyzer
    private var functionOwnersStore: MutableMap<String, String>? = null
    internal val functionOwners: MutableMap<String, String> get() = functionOwnersStore ?: mutableMapOf<String, String>().also { functionOwnersStore = it } // only use in SemanticAnalyzer
    private var functionDeclarationsStore: MutableMap<String, FunctionDeclarationNode>? = null
    protected val functionDeclarations: MutableMap<String, FunctionDeclarationNode> get() = functionDeclarationsStore ?: mutableMapOf<String, FunctionDeclarationNode>().also { functionDeclarationsStore = it }
    private var extensionFunctionDeclarationsStore: MutableMap<String, Pair<DataType, FunctionDeclarationNode>>? = null
    protected val extensionFunctionDeclarations: MutableMap<String, Pair<DataType, FunctionDeclarationNode>> get() = extensionFunctionDeclarationsStore ?: mutableMapOf<String, Pair<DataType, FunctionDeclarationNode>>().also { extensionFunctionDeclarationsStore = it }
    private var extensionPropertiesStore: MutableMap<String, ExtensionProperty>? = null
    protected val extensionProperties: MutableMap<String, ExtensionProperty> get() = extensionPropertiesStore ?: mutableMapOf<String, ExtensionProperty>().also { extensionPropertiesStore = it }
    private var classDeclarationsStore: MutableMap<String, ClassDefinition>? = null
    private val classDeclarations: MutableMap<String, ClassDefinition> get() = classDeclarationsStore ?: mutableMapOf<String, ClassDefinition>().also { classDeclarationsStore = it }
    private var typeAliasStore: MutableMap<String, DataType>? = null
    private val typeAlias: MutableMap<String, DataType> get() = typeAliasStore ?: mutableMapOf<String, DataType>().also { typeAliasStore = it }
    private var typeAliasResolutionStore: MutableMap<String, DataType>? = null
    private val typeAliasResolution: MutableMap<String, DataType> get() = typeAliasResolutionStore ?: mutableMapOf<String, DataType>().also { typeAliasResolutionStore = it }

    internal lateinit var rootScope: SymbolTable
    // Only used on the root scope: built-in classes are process-wide singletons,
    // so per-interpreter type caches must not be stored on their definitions.
    private var concreteGenericObjectTypesStore: MutableMap<ClassDefinition, MutableList<ObjectType>>? = null
    val AnyType get() = AnyType()
    lateinit var IntType: PrimitiveType
        private set
    lateinit var LongType: PrimitiveType
        private set
    lateinit var DoubleType: PrimitiveType
        private set
    lateinit var BooleanType: PrimitiveType
        private set
    lateinit var StringType: PrimitiveType
        private set
    lateinit var CharType: PrimitiveType
        private set
    lateinit var ByteType: PrimitiveType
        private set
    lateinit var NullableIntType: PrimitiveType
        private set
    lateinit var NullableLongType: PrimitiveType
        private set
    lateinit var NullableDoubleType: PrimitiveType
        private set
    lateinit var NullableBooleanType: PrimitiveType
        private set
    lateinit var NullableStringType: PrimitiveType
        private set
    lateinit var NullableCharType: PrimitiveType
        private set
    lateinit var NullableByteType: PrimitiveType
        private set

    protected fun initPrimitiveTypes() {
        fun getPrimitiveClass(typeName: PrimitiveTypeName, isNullable: Boolean): ClassDefinition {
            return rootScope.findClass("${typeName.name}${if (isNullable) "?" else ""}", isThisScopeOnly = true)?.first
                ?: throw RuntimeException("Cannot find class ${typeName.name}")
        }

        fun getPrimitiveType(typeName: PrimitiveTypeName, isNullable: Boolean) : PrimitiveType {
            val nonNullableClass = getPrimitiveClass(typeName, isNullable = false)
            val nullableClass = getPrimitiveClass(typeName, isNullable = true)
            return PrimitiveType(
                typeName = typeName,
                isNullable = isNullable,
                nonNullableClass = nonNullableClass,
                nullableClass = nullableClass,
                superTypes = rootScope.resolveObjectType(
                    clazz = if (isNullable) nullableClass else nonNullableClass,
                    typeArguments = null,
                    isNullable = isNullable,
                ).superTypes
            )
        }

        if (scopeLevel == 0) {
            IntType = getPrimitiveType(PrimitiveTypeName.Int, isNullable = false)
            LongType = getPrimitiveType(PrimitiveTypeName.Long, isNullable = false)
            DoubleType = getPrimitiveType(PrimitiveTypeName.Double, isNullable = false)
            BooleanType = getPrimitiveType(PrimitiveTypeName.Boolean, isNullable = false)
            StringType = getPrimitiveType(PrimitiveTypeName.String, isNullable = false)
            CharType = getPrimitiveType(PrimitiveTypeName.Char, isNullable = false)
            ByteType = getPrimitiveType(PrimitiveTypeName.Byte, isNullable = false)
            NullableIntType = getPrimitiveType(PrimitiveTypeName.Int, isNullable = true)
            NullableLongType = getPrimitiveType(PrimitiveTypeName.Long, isNullable = true)
            NullableDoubleType = getPrimitiveType(PrimitiveTypeName.Double, isNullable = true)
            NullableBooleanType = getPrimitiveType(PrimitiveTypeName.Boolean, isNullable = true)
            NullableStringType = getPrimitiveType(PrimitiveTypeName.String, isNullable = true)
            NullableCharType = getPrimitiveType(PrimitiveTypeName.Char, isNullable = true)
            NullableByteType = getPrimitiveType(PrimitiveTypeName.Byte, isNullable = true)
        } else {
            IntType = rootScope.IntType
            LongType = rootScope.LongType
            DoubleType = rootScope.DoubleType
            BooleanType = rootScope.BooleanType
            StringType = rootScope.StringType
            CharType = rootScope.CharType
            ByteType = rootScope.ByteType
            NullableIntType = rootScope.NullableIntType
            NullableLongType = rootScope.NullableLongType
            NullableDoubleType = rootScope.NullableDoubleType
            NullableBooleanType = rootScope.NullableBooleanType
            NullableStringType = rootScope.NullableStringType
            NullableCharType = rootScope.NullableCharType
            NullableByteType = rootScope.NullableByteType
        }
    }

    init {
        if (parentScope != null || scopeLevel == 0) {
            rootScope = findScope(0)

            if (isInitOnCreate && scopeLevel > 1) { // user scopes
                init()
            }
        }
    }

    open fun init() {
        initPrimitiveTypes()
    }

    fun declareProperty(position: SourcePosition, name: String, type: TypeNode, isMutable: Boolean) {
        if (hasProperty(name = name, true)) {
            throw DuplicateIdentifierException(position = position, name = name, classifier = IdentifierClassifier.Property)
        }

        log.d { "declareProperty($position, $name, ${type.descriptiveName()}, $isMutable)" }
        propertyDeclarations[name] = typeNodeToPropertyType(type = type, isMutable = isMutable)
            ?: throw RuntimeException("Unknown type ${type.name}")
    }

    // Synthetic runtime bindings already have a resolved type. Re-resolving a
    // TypeNode here rebuilds the complete generic/class hierarchy on every call.
    fun declareProperty(position: SourcePosition, name: String, type: DataType, isMutable: Boolean) {
        if (hasProperty(name = name, true)) {
            throw DuplicateIdentifierException(position, name, IdentifierClassifier.Property)
        }
        propertyDeclarations[name] = PropertyType(type, isMutable)
    }

    open fun findTypeAlias(name: String): Pair<DataType, SymbolTable>? {
        return typeAliasStore?.get(name)?.let { it to this } ?: parentScope?.findTypeAlias(name)
    }

    fun declareTypeAlias(position: SourcePosition, name: String, typeUpperBound: TypeNode?, referenceSymbolTable: SymbolTable = this) {
        if (typeAlias.containsKey(name) || typeAlias.containsKey("$name?")) {
            throw DuplicateIdentifierException(position, name, IdentifierClassifier.TypeAlias)
        }
        val typeUpperBound = typeUpperBound ?: TypeNode(SourcePosition.NONE, "Any", null, true)
        val nullableUpperBound = typeUpperBound.copy(isNullable = true)
        // A simple bound that does not refer to the declared name itself cannot
        // produce a recursive (repeated) type; skip the visit caches then.
        val isSimpleBound = typeUpperBound.name != name
        typeAlias[name] = referenceSymbolTable.resolveSimpleTypeNode(typeUpperBound).takeIf { isSimpleBound }
            ?: SymbolTableTypeVisitCache(name).let { cache ->
                referenceSymbolTable.typeNodeToDataType(typeUpperBound, visitCache = cache)!!
                    .also { result -> cache.postVisit(name, result) }
            }
        typeAlias["$name?"] = referenceSymbolTable.resolveSimpleTypeNode(nullableUpperBound).takeIf { isSimpleBound }
            ?: SymbolTableTypeVisitCache("$name?").let { cache ->
                referenceSymbolTable.typeNodeToDataType(nullableUpperBound, visitCache = cache)!!
                    .also { result -> cache.postVisit("$name?", result) }
            }
    }

    fun declareTypeAliasResolution(position: SourcePosition, name: String, type: TypeNode, referenceSymbolTable: SymbolTable = this) {
        if (findTypeAlias(name) == null || findTypeAlias("$name?") == null) {
            throw RuntimeException("Type alias $name not found")
        }
        if (typeAliasResolution.containsKey(name) || typeAliasResolution.containsKey("$name?")) {
            throw DuplicateIdentifierException(position, name, IdentifierClassifier.TypeResolution)
        }
        log.d { "declareTypeAliasResolution1($position, $name, ${type.descriptiveName()})" }
        typeAliasResolution[name] = referenceSymbolTable.assertToDataType(type)
        typeAliasResolution["$name?"] = referenceSymbolTable.assertToDataType(type.copy(isNullable = true))
    }

    fun declareTypeAliasResolution(position: SourcePosition, name: String, type: DataType) {
        if (findTypeAlias(name) == null || findTypeAlias("$name?") == null) {
            throw RuntimeException("Type alias $name not found")
        }
        if (typeAliasResolution.containsKey(name) || typeAliasResolution.containsKey("$name?")) {
            throw DuplicateIdentifierException(position, name, IdentifierClassifier.TypeResolution)
        }
        log.d { "declareTypeAliasResolution2($position, $name, ${type.descriptiveName})" }
        typeAliasResolution[name] = type
        typeAliasResolution["$name?"] = type.copyOf(isNullable = true)
    }

    fun findTypeAliasResolution(name: String): DataType? {
        return typeAliasResolutionStore?.get(name) ?: parentScope?.findTypeAliasResolution(name)
    }

    /**
     * Allocation-free resolution of an unparameterized type name for the common
     * runtime case (parameter/return/property types). Returns null whenever the
     * general algorithm is required; the caller then falls back to it, so the
     * results and error behaviour are the same.
     */
    private fun resolveSimpleTypeNode(type: TypeNode): DataType? {
        if (type.arguments != null || type is FunctionTypeNode || type.name == "*" || type.name == "<Repeated>") return null
        val aliasName = if (type.isNullable) "${type.name}?" else type.name
        val alias = findTypeAlias(aliasName)
        if (alias != null) {
            return findTypeAliasResolution(aliasName) ?: TypeParameterType(type.name, type.isNullable, alias.first)
        }
        type.toPrimitiveDataType(rootScope)?.let { return it }
        val clazz = findClass(type.name)?.first ?: return null
        if (clazz.typeParameters.isNotEmpty()) return null
        return resolveObjectType(clazz, null, type.isNullable)
    }

    fun assertToDataType(type: TypeNode, visitCache: SymbolTableTypeVisitCache? = null): DataType {
        if (visitCache == null) resolveSimpleTypeNode(type)?.let { return it }
        val visitCache = visitCache ?: SymbolTableTypeVisitCache()
        val isCacheCreator = visitCache.isEmpty

        return typeNodeToDataType(type, visitCache)
            ?.also {
                if (isCacheCreator) {
                    visitCache.throwErrorIfThereIsUnprocessedRepeatedType()
                }
            }
            ?: throw RuntimeException("Cannot resolve type ${type.descriptiveName()}")
    }

    fun typeNodeToDataType(type: TypeNode, visitCache: SymbolTableTypeVisitCache? = null): DataType? {
        if (visitCache == null) resolveSimpleTypeNode(type)?.let { return it }
        val isTopLevel = visitCache == null || visitCache.isEmpty
        val visitCache = visitCache ?: SymbolTableTypeVisitCache()
        if (type.name == "*") {
            return StarType // TODO: additional validations of use of type *?
        }

        if (type.name == "<Repeated>") {
//            return assertToDataType(type.arguments!!.first(), visitCache)
            return RepeatedType(type.arguments!!.first().name, type.arguments!!.first().name.endsWith("?"))
        }

        if (visitCache.isVisited(type)) {
            return RepeatedType(type.descriptiveName(), type.isNullable).also {
                visitCache.postVisit(type, it)
            }
        }

        val alias = findTypeAlias("${type.name}${if (type.isNullable) "?" else ""}")
        if (alias != null) {
            return (findTypeAliasResolution("${type.name}${if (type.isNullable) "?" else ""}")
                ?: TypeParameterType(type.name, type.isNullable, alias.first)).also {
                visitCache.postVisit(type, it)
            }
        }
        if (type is FunctionTypeNode) {
            return FunctionType(
                arguments = type.parameterTypes?.map { typeNodeToDataType(it) ?: UnresolvedType } ?: listOf(UnresolvedType),
                returnType = type.returnType?.let { typeNodeToDataType(it) } ?: UnresolvedType,
                isNullable = type.isNullable,
                receiverType = type.receiverType?.let { typeNodeToDataType(it) ?: UnresolvedType },
            )
        }
        type.toPrimitiveDataType(rootScope)?.let { return it }

        val clazz = findClass(type.name)?.first ?: return null
        val concreteArguments = if (isTopLevel) type.arguments?.let { concreteArguments(it) } else null
        if (concreteArguments != null) {
            cachedConcreteGenericObjectType(clazz, concreteArguments, type.isNullable)?.let { cached ->
                return cached.also { visitCache.postVisit(type, it) }
            }
        }
        // validate type arguments
        // TODO optimize so that we don't have to validate every time
        if (clazz.typeParameters.size != (type.arguments?.size ?: 0)) {
            throw RuntimeException("Number of type arguments (${type.arguments?.size ?: 0}) does not match with number of type parameters ${clazz.typeParameters.size} of class ${clazz.fullQualifiedName}")
        }
        val typeArgumentMap = clazz.typeParameters.withIndex().associate { it.value.name to type.arguments!![it.index] }
        type.arguments?.forEachIndexed { index, it ->
            if (it.name == TypeNode.IGNORE.name) {
                return@forEachIndexed
            }

            // TODO refactor this repeated logic
            val upperBound = clazz.typeParameters[index].typeUpperBound?.resolveGenericParameterTypeArguments(typeArgumentMap) ?: TypeNode(SourcePosition.NONE, "Any", null, true)
            if (!(typeNodeToDataType(upperBound, visitCache.copy()) ?: return null).isAssignableFrom(typeNodeToDataType(it, visitCache.copy()) ?: return null)) {
                throw RuntimeException("Type argument ${it.descriptiveName()} is out of bound (${upperBound.descriptiveName()})")
            }
        }

        val inputType = type
        val type = resolveObjectType(clazz, type.arguments, type.isNullable, visitCache = visitCache)
        if (type!!.clazz != clazz) {
            throw RuntimeException("genericResolver.genericResolutions is wrong")
        }

        if (concreteArguments != null) storeConcreteGenericObjectType(clazz, concreteArguments, type)
        return type.also { visitCache.postVisit(inputType, it) }
//        return ObjectType(
//            clazz = clazz,
//            arguments = type.arguments?.map { assertToDataType(it) } ?: emptyList(),
//            isNullable = type.isNullable
//        )
    }

    fun resolveObjectType(clazz: ClassDefinition, typeArguments: List<TypeNode>?, isNullable: Boolean, upToIndex: Int = -1, visitCache: SymbolTableTypeVisitCache? = null): ObjectType {
        // A hierarchy without type parameters requires no substitution tables.
        // Resolve directly; keep the generic/recursive-bound path unchanged.
        fun isNonGeneric(type: ClassDefinition): Boolean = type.typeParameters.isEmpty() &&
            (type.superClass?.let { isNonGeneric(it) } ?: true) && type.superInterfaces.all { isNonGeneric(it) }
        if (typeArguments.isNullOrEmpty() && isNonGeneric(clazz)) {
            return plainObjectType(clazz, isNullable)
        }
        if (visitCache == null && !typeArguments.isNullOrEmpty() && typeArguments.size == clazz.typeParameters.size) {
            concreteGenericObjectType(clazz, typeArguments, isNullable)?.let { return it }
        }
        val visitCache = visitCache ?: SymbolTableTypeVisitCache()
        val genericResolver = ClassMemberResolver.create(this, clazz, typeArguments ?: emptyList())!!
//        var superType: ObjectType? = null
//        genericResolver.genericResolutions.forEachIndexed { index, resolutions ->
//            if (upToIndex >= 0 && index > upToIndex) return superType
//            val clazz = resolutions.first
//            superType = ObjectType(
//                clazz = clazz,
//                arguments = clazz.typeParameters.map { tp ->
//                    val argument = resolutions.second[tp.name]!!
//                    assertToDataType(argument)
//                },
//                isNullable = isNullable,
//                superType = superType
//            )
//        }
//        return superType

//        val visitedTypes = mutableSetOf<String>()

        fun resolve(type: ClassDefinition, visitCache: SymbolTableTypeVisitCache): ObjectType {
            val resolution = genericResolver.genericResolutionsByTypeName[type.fullQualifiedName]!!
            visitCache.preVisit(type)
//            log.v { "resolve visit ${type.name}" }
//            log.v { "resolve visited = ${visitedTypes}" }
            return ObjectType(
                clazz = type,
                arguments = type.typeParameters.map { tp ->
                    val argument = resolution[tp.name]!!
                    assertToDataType(argument, visitCache.copy())
                },
                isNullable = isNullable,
                superTypes = (listOfNotNull(type.superClass) + type.superInterfaces)
                    .flatMap {
                        if (visitCache.isVisited(it)) {
                            return@flatMap emptyList()
                        }
                        log.v { "resolve ${it.fullQualifiedName} from ${type.fullQualifiedName}" }
                        val superType = resolve(it, visitCache.copy())
                        log.v { "superType ${superType.descriptiveName} with super types ${superType.superTypes}" }
                        listOf(superType) + superType.superTypes
                     }
                    .groupBy { it.name }
                    .mapValues {
                        it.value.indices.forEach { i ->
                            if (i > 0) {
                                if (it.value[i].arguments != it.value[i - 1].arguments) {
                                    throw RuntimeException("Type arguments of repeated type ${it.key} are not consistent -- ${it.value[i].arguments} VS ${it.value[i - 1].arguments}")
                                }
                            }
                        }
                        it.value.first()
                    }
                    .values.toList(),
            ).also {
                visitCache.postVisit(type, it)
            }
        }

        val isCacheCreator = visitCache.isEmpty

        return resolve(clazz, visitCache).also {
            if (isCacheCreator) {
                visitCache.throwErrorIfThereIsUnprocessedRepeatedType()
            }
        }
    }

    /**
     * A non-generic class type depends only on its immutable class hierarchy.
     * Share one instance per class and nullability instead of rebuilding the
     * complete supertype list for every call, parameter and instance. The
     * entry is revalidated by identity so a changed hierarchy is never reused.
     */
    private fun plainObjectType(type: ClassDefinition, isNullable: Boolean): ObjectType {
        val cached = type.plainObjectTypeCache(isNullable)
        if (cached != null && cached.superClass === type.superClass && cached.superInterfaces === type.superInterfaces &&
            cached.parents.all { (parentClass, parentType) -> plainObjectType(parentClass, isNullable) === parentType }
        ) {
            return cached.type
        }
        val parentClasses = listOfNotNull(type.superClass) + type.superInterfaces
        val parents = parentClasses.map { plainObjectType(it, isNullable) }
        val result = ObjectType(type, emptyList(), isNullable,
            parents.flatMap { listOf(it) + it.superTypes }.distinctBy { it.name })
        type.storePlainObjectTypeCache(isNullable, PlainObjectTypeCacheEntry(type.superClass, type.superInterfaces, parentClasses.zip(parents), result))
        return result
    }

    /**
     * Generic types whose arguments resolve to concrete types (no type
     * parameters), e.g. `List<Invader>`, do not depend on the calling scope.
     * They are cached per class and compared by class identity, so runtime
     * lists and iterators do not rebuild their generic hierarchy each time.
     */
    private fun concreteGenericObjectType(clazz: ClassDefinition, typeArguments: List<TypeNode>, isNullable: Boolean): ObjectType? {
        val arguments = concreteArguments(typeArguments) ?: return null
        cachedConcreteGenericObjectType(clazz, arguments, isNullable)?.let { return it }
        return resolveObjectType(clazz, typeArguments, isNullable, visitCache = SymbolTableTypeVisitCache())
            .also { storeConcreteGenericObjectType(clazz, arguments, it) }
    }

    private fun concreteArguments(typeArguments: List<TypeNode>): List<DataType>? = typeArguments.map { argument ->
        (typeNodeToDataType(argument) ?: return null).takeIf { it.isConcreteType() } ?: return null
    }

    private fun cachedConcreteGenericObjectType(clazz: ClassDefinition, arguments: List<DataType>, isNullable: Boolean): ObjectType? =
        rootScope.concreteGenericObjectTypesStore?.get(clazz)?.firstOrNull { cached ->
            cached.isNullable == isNullable && cached.arguments.size == arguments.size &&
                cached.arguments.indices.all { cached.arguments[it].isSameConcreteType(arguments[it]) }
        }

    private fun storeConcreteGenericObjectType(clazz: ClassDefinition, arguments: List<DataType>, result: ObjectType) {
        if (result.clazz === clazz && result.arguments.size == arguments.size &&
            result.arguments.indices.all { result.arguments[it].isSameConcreteType(arguments[it]) } &&
            cachedConcreteGenericObjectType(clazz, arguments, result.isNullable) == null
        ) {
            val root = rootScope
            val byClass = root.concreteGenericObjectTypesStore ?: mutableMapOf<ClassDefinition, MutableList<ObjectType>>().also { root.concreteGenericObjectTypesStore = it }
            byClass.getOrPut(clazz) { mutableListOf() } += result
        }
    }

    private fun DataType.isConcreteType(): Boolean = when (this) {
        is ObjectType -> arguments.all { it.isConcreteType() }
        else -> false
    }

    private fun DataType.isSameConcreteType(other: DataType): Boolean =
        this is ObjectType && other is ObjectType && clazz === other.clazz && isNullable == other.isNullable &&
            arguments.size == other.arguments.size && arguments.indices.all { arguments[it].isSameConcreteType(other.arguments[it]) }

    fun typeNodeToPropertyType(type: TypeNode, isMutable: Boolean): PropertyType? {
        val dataType = typeNodeToDataType(type) ?: return null
        return PropertyType(type = dataType, isMutable = isMutable)
    }

    fun undeclareProperty(name: String) {
        if (!hasProperty(name = name, true)) {
            throw RuntimeException("No such property `$name`")
        }
        propertyDeclarationsStore?.remove(name)
        propertyValuesStore?.remove(name)
    }

    fun undeclarePropertyByDeclaredName(declaredName: String) {
        undeclareProperty(findTransformedNameByDeclaredName(declaredName))
    }

    /** Analysis-only REPL boundary. Already analyzed ASTs keep their stable IDs. */
    internal fun retireAnalyzedProperty(name: String) {
        val transformed = transformedSymbolsByDeclaredName[IdentifierClassifier.Property to name]
        undeclareProperty(name)
        if (transformed != null) unregisterTransformedSymbol(IdentifierClassifier.Property, transformed, name)
        propertyOwners.remove(name)
    }

    /**
     * Only use in SemanticAnalyzer
     */
    fun declarePropertyOwner(name: String, owner: String, extensionPropertyRef: String? = null) {
        log.d { "declarePropertyOwner($name, $owner, $extensionPropertyRef)" }
        propertyOwners[name] = PropertyOwnerInfo(ownerRefName = owner, extensionPropertyRef = extensionPropertyRef)
    }

    /**
     * Only use in SemanticAnalyzer
     */
    fun declareFunctionOwner(name: String, function: FunctionDeclarationNode, owner: String) {
        functionOwners[functionNameTransform(name, function)] = owner
    }

    /**
     * Only use in SemanticAnalyzer
     *
     * @param name use transformed name
     */
    fun findPropertyOwner(name: String): PropertyOwnerInfo? {
        if (propertyOwnersStore?.containsKey(name) == true) {
            return propertyOwnersStore!![name]
        } else {
            return parentScope?.findPropertyOwner(name)
        }
    }

    /**
     * Only use in SemanticAnalyzer
     */
    fun findFunctionOwner(name: String): String? {
        if (functionOwnersStore?.containsKey(name) == true) {
            return functionOwnersStore!![name]
        } else {
            return parentScope?.findFunctionOwner(name)
        }
    }

    /** Declare an immutable binding and initialize it with a single lookup per table. */
    internal fun declareInitializedProperty(position: SourcePosition, name: String, type: DataType, value: RuntimeValue) {
        if (propertyDeclarations.put(name, PropertyType(type, false)) != null) {
            throw DuplicateIdentifierException(position, name, IdentifierClassifier.Property)
        }
        propertyValues[name] = RuntimeValueHolder(type, false, value)
    }

    fun assign(name: String, value: RuntimeValue): Boolean {
        val type = propertyDeclarationsStore?.get(name)
        if (type != null) {
//            if (!type.isMutable && propertyValues.containsKey(name)) {
//                throw RuntimeException("val cannot be reassigned")
//            }
            if (!type.type.isCastableFrom(value.type()) && type.type != value.type()) {
                throw RuntimeException("Expected type ${type.type.descriptiveName} but actual type is ${value.type().descriptiveName}")
            }
            propertyValues.getOrPut(name) { RuntimeValueHolder(type.type, type.isMutable, null) }.assign(value = value)
            return true
        } else if (parentScope?.assign(name, value) == true) {
            return true
        } else {
            throw RuntimeException("The variable `$name` has not been declared")
        }
    }

    fun hasAssignedInThisScope(name: String): Boolean {
        return propertyValuesStore?.get(name) != null
    }

    fun getPropertyTypeOrNull(name: String, isThisScopeOnly: Boolean = false): Pair<PropertyType, SymbolTable>? {
        return (propertyDeclarationsStore?.get(name)?.let { it to this }
            ?: Unit.takeIf { !isThisScopeOnly }?.let { parentScope?.getPropertyTypeOrNull(name) })
            ?.let { result ->
                if (result.first.type is TypeParameterType) {
                    findTypeAliasResolution(result.first.type.name)?.let {
                        return@let PropertyType(it, result.first.isMutable) to result.second
                    }
                }
                result
            }
    }

    fun getPropertyType(name: String, isThisScopeOnly: Boolean = false): Pair<PropertyType, SymbolTable> {
        return getPropertyTypeOrNull(name = name, isThisScopeOnly = isThisScopeOnly)
            ?: throw RuntimeException("The variable `$name` has not been declared")
    }

    fun read(name: String, isThisScopeOnly: Boolean = false): RuntimeValue {
        return propertyValuesStore?.get(name)?.read()
            ?: Unit.takeIf { !isThisScopeOnly }?.let { parentScope?.read(name) }
            ?: throw RuntimeException("The variable `$name` has not been declared")
    }

    fun putPropertyHolder(name: String, isMutable: Boolean, holder: RuntimeValueAccessor) {
        if (propertyValuesStore?.containsKey(name) == true) {
            throw RuntimeException("Property `$name` has already been defined")
        }
        propertyDeclarations[name] = PropertyType(holder.type, isMutable)
        propertyValues[name] = holder
    }

    fun getPropertyHolder(name: String, isThisScopeOnly: Boolean = false): RuntimeValueAccessor {
        return propertyValuesStore?.get(name)
            ?: Unit.takeIf { !isThisScopeOnly }?.let { parentScope?.getPropertyHolder(name) }
            ?: throw RuntimeException("The variable `$name` has not been declared")
    }

    fun hasProperty(name: String, isThisScopeOnly: Boolean = false): Boolean {
        val thisScopeResult = propertyDeclarationsStore?.containsKey(name) == true
        if (isThisScopeOnly) {
            return thisScopeResult
        }
        return thisScopeResult || (parentScope?.hasProperty(name) ?: false)
    }

    fun declareFunction(position: SourcePosition, name: String, node: FunctionDeclarationNode): String {
        val functionSignature = functionNameTransform(name = name, function = node)
        if (functionDeclarations.containsKey(functionSignature)) {
            throw DuplicateIdentifierException(position = position, name = name, classifier = IdentifierClassifier.Function)
        }
//        log.v(Exception()) { "Register $functionSignature at $scopeLevel" }
        functionDeclarations[functionSignature] = node
        return functionSignature
    }

    fun findFunction(name: String, isThisScopeOnly: Boolean = false): Pair<FunctionDeclarationNode, SymbolTable>? {
        return functionDeclarationsStore?.get(name)?.let { it  to this }
            ?: Unit.takeIf { !isThisScopeOnly }?.let { parentScope?.findFunction(name) }
    }

    fun declareExtensionFunction(position: SourcePosition, name: String, node: FunctionDeclarationNode, receiverType: DataType? = null): String {
        val functionSignature = functionNameTransform(name = name, function = node)
        if (extensionFunctionDeclarations.containsKey(functionSignature)) {
            throw DuplicateIdentifierException(position = position, name = name, classifier = IdentifierClassifier.Function)
        }
        log.v { "declareExtensionFunction($position, $name, ${node.receiver?.let { "$it." } ?: ""}${node.name})" }
        val receiverType = receiverType ?: run {
            val dedicatedSymbolTable = if ((node.typeParameters + node.extraTypeParameters).isNotEmpty()) {
                createTempSymbolTable().also { symbolTable ->
                    (node.typeParameters + node.extraTypeParameters).forEach {
                        symbolTable.declareTypeAlias(it.position, it.name, it.typeUpperBound)
                    }
                }
            } else {
                this
            }
            dedicatedSymbolTable.assertToDataType(
                node.receiverType ?: throw RuntimeException("Extension function `$name` has no receiver")
            )
        }
        extensionFunctionDeclarations[functionSignature] = receiverType to node
        return functionSignature
    }

    fun findExtensionFunction(transformedName: String, isThisScopeOnly: Boolean = false): FunctionDeclarationNode? {
        return findExtensionFunctionWithReceiver(transformedName, isThisScopeOnly)?.let { it.second }
    }

    fun findExtensionFunctionWithReceiver(transformedName: String, isThisScopeOnly: Boolean = false): Pair<DataType, FunctionDeclarationNode>? {
        return extensionFunctionDeclarationsStore?.get(transformedName)
            ?: Unit.takeIf { !isThisScopeOnly }?.let { parentScope?.findExtensionFunctionWithReceiver(transformedName) }
    }

    fun findExtensionFunctionsByDeclaredName(receiver: TypeNode, declaredName: String, isThisScopeOnly: Boolean = false): Collection<FunctionDeclarationNode> {
        return (extensionFunctionDeclarationsStore ?: emptyMap()).filter { it.value.first.name == receiver.name && it.value.second.name == declaredName }.values.map { it.second } + // TODO handle generics
            (Unit.takeIf { !isThisScopeOnly }?.let { parentScope?.findExtensionFunctionsByDeclaredName(receiver, declaredName, isThisScopeOnly) } ?: emptyList())
    }

    fun declareExtensionProperty(position: SourcePosition, transformedName: String, extensionProperty: ExtensionProperty) {
        if (extensionProperties.containsKey(transformedName)) {
            throw DuplicateIdentifierException(position = position, name = transformedName, classifier = IdentifierClassifier.Property)
        }
        if (extensionProperty.typeNode == null) {
            Parser(Lexer(position.filename, extensionProperty.type)).type().also { type ->
                extensionProperty.typeNode = type
            }
        }
        if (extensionProperty.receiverType == null) {
            extensionProperty.receiverType = extensionProperty.receiver.toTypeNode("")
        }
        val receiverType = extensionProperty.receiverType!!
        val receiverClass = findClass(receiverType.name)?.first ?: throw RuntimeException("Class `${receiverType.name}` not found")
        if (receiverClass.typeParameters.size != (receiverType.arguments?.size ?: 0)) {
            throw RuntimeException("Number of type parameters of class `${receiverType.name}` mismatch")
        }
        val extensionTypeParameters = extensionProperty.typeParameters.toTypeParameterNodes()
        if (receiverClass.typeParameters.isNotEmpty()) {
            val tempSymbolTable = createTempSymbolTable()
            extensionTypeParameters.forEach {
                tempSymbolTable.declareTypeAlias(it.position, it.name, it.typeUpperBound)
            }
            receiverClass.typeParameters.forEachIndexed { index, tp ->
                if (!tempSymbolTable.assertToDataType(tp.typeUpperBoundOrAny()).isAssignableFrom(
                        tempSymbolTable.assertToDataType(
                            receiverType.arguments!![index]
                                .resolveGenericParameterTypeToUpperBound(extensionTypeParameters)
                        )
                )) {
                    throw RuntimeException("Provided type parameter `${tp.name}` of the class `${receiverType.name}` is out of bound (Upper bound: `${tp.typeUpperBoundOrAny().descriptiveName()}`)")
                }
            }
        }
        if (receiverClass.findMemberPropertyTransformedName(extensionProperty.declaredName) != null) {
            throw DuplicateIdentifierException(position = position, name = extensionProperty.declaredName, classifier = IdentifierClassifier.Property)
        }
        val resolvedReceiverType = extensionProperty.receiverType!!.resolveGenericParameterTypeToUpperBound(extensionTypeParameters)
        if (extensionProperties.any {
            val existingResolvedReceiverType = it.value.receiverType!!.resolveGenericParameterTypeToUpperBound(it.value.typeParameters.toTypeParameterNodes())
            existingResolvedReceiverType.name == resolvedReceiverType.name &&
            existingResolvedReceiverType.arguments?.withIndex()?.all {
                it.value.name == resolvedReceiverType.arguments!![it.index].name &&
                it.value.isNullable == resolvedReceiverType.arguments!![it.index].isNullable
            } != false &&
            it.value.declaredName == extensionProperty.declaredName
        }) {
            throw DuplicateIdentifierException(position = position, name = extensionProperty.declaredName, classifier = IdentifierClassifier.Property)
        }
        extensionProperties[transformedName] = extensionProperty
    }

    fun findExtensionProperty(name: String, isThisScopeOnly: Boolean = false): ExtensionProperty? {
        return extensionPropertiesStore?.get(name)
            ?: Unit.takeIf { !isThisScopeOnly }?.let { parentScope?.findExtensionProperty(name) }
    }

    /**
     * @param resolvedReceiver resolved means there is no generic type parameter
     */
    fun findExtensionPropertyByDeclaration(resolvedReceiver: TypeNode, declaredName: String, isThisScopeOnly: Boolean = false): Pair<String, ExtensionProperty>? {
        return (extensionPropertiesStore ?: emptyMap()).asSequence()
            .filter {
                it.value.receiverType!!.name == resolvedReceiver.name &&
                        (!resolvedReceiver.isNullable || it.value.receiverType!!.isNullable) &&
                        it.value.declaredName == declaredName
            }
            // Here assumes at most 3 same-name extension properties declared: exact type or Any? or Any. exact type one has higher precedence
            .let {
                it.firstOrNull { it.value.receiverType!!.descriptiveName() == resolvedReceiver.descriptiveName() }
                    ?: it.firstOrNull()
            }
            ?.toPair()
            ?: Unit.takeIf { !isThisScopeOnly }?.let { parentScope?.findExtensionPropertyByDeclaration(resolvedReceiver, declaredName, isThisScopeOnly) }
    }

    /**
     * @param resolvedReceiver resolved means there is no generic type parameter
     */
    fun findExtensionPropertyByReceiver(resolvedReceiver: TypeNode, isThisScopeOnly: Boolean = false): List<Pair<String, ExtensionProperty>> {
        return (extensionPropertiesStore ?: emptyMap())
            .asSequence()
            .filter { it.value.receiverType!!.name == resolvedReceiver.name && (resolvedReceiver.isNullable || !it.value.receiverType!!.isNullable) }
            .map { it.toPair() }
            .groupBy { it.second.declaredName }
            // Here assumes at most 3 same-name extension properties declared: exact type or Any? or Any. exact type one has higher precedence
            .mapValues { it.value.firstOrNull { it.second.receiverType!!.descriptiveName() == resolvedReceiver.descriptiveName() } ?: it.value.first() }
            .map { it.value }
            .toList() +
            (Unit.takeIf { !isThisScopeOnly }?.let { parentScope?.findExtensionPropertyByReceiver(resolvedReceiver, isThisScopeOnly) }
                ?: emptyList())
    }

    fun findTransformedNameByDeclaredName(declaredName: String): String
        = propertyValues.keys.firstOrNull { it.substring(0 ..< it.lastIndexOf('/')) == declaredName }!!

    fun findPropertyByDeclaredName(declaredName: String): RuntimeValue? {
        return findTransformedNameByDeclaredName(declaredName)
            .let { transformedName -> propertyValues[transformedName]?.read() }
    }

    fun declareClass(position: SourcePosition, classDefinition: ClassDefinition) {
        if (findClass(classDefinition.fullQualifiedName) != null) {
            throw DuplicateIdentifierException(position = position, name = classDefinition.fullQualifiedName, classifier = IdentifierClassifier.Class)
        }
        classDeclarations[classDefinition.fullQualifiedName] = classDefinition
    }

    fun findClass(fullQualifiedName: String, isThisScopeOnly: Boolean = false): Pair<ClassDefinition, SymbolTable>? {
        val classDefinition = classDeclarationsStore?.get(fullQualifiedName)
        return if (classDefinition != null) {
            classDefinition to this
        } else if (!isThisScopeOnly) {
            parentScope?.findClass(fullQualifiedName)
        } else {
            null
        }
    }

    open fun functionNameTransform(name: String, function: FunctionDeclarationNode): String {
        return name
    }

    // this is expensive
    fun findFunctionOrExtensionFunctionIncludingSuperclassesByDeclaredName(receiver: TypeNode, declaredName: String): Collection<FunctionDeclarationNode> {
        val clazz = findClass(receiver.name)!!.first
        clazz.findMemberFunctionsByDeclaredName(declaredName).values
            .also {
                if (it.isNotEmpty()) {
                    return it
                }
            }

        var type: DataType = assertToDataType(receiver)
//        while (type != null) {
        (listOf(type) + ((type as? ObjectType)?.superTypes ?: emptyList())).forEach { type ->
            findExtensionFunctionsByDeclaredName(type.toTypeNode(), declaredName).also {
                if (it.isNotEmpty()) {
                    return it
                }
            }
//            type = (type as? ObjectType)?.superType
        }

        throw RuntimeException("Function $declaredName for receiver ${receiver.descriptiveName()} not found")
    }

    private fun isReverseTransformNeeded(identifierClassifier: IdentifierClassifier): Boolean =
        when (identifierClassifier) {
            IdentifierClassifier.Property, IdentifierClassifier.Class, IdentifierClassifier.TypeAlias -> true
            IdentifierClassifier.Function, IdentifierClassifier.TypeResolution -> false
        }

    internal fun registerTransformedSymbol(position: SourcePosition, identifierClassifier: IdentifierClassifier, transformedName: String, originalName: String) {
        val key = identifierClassifier to transformedName
        if (transformedSymbols.containsKey(key) || (isReverseTransformNeeded(identifierClassifier) && transformedSymbolsByDeclaredName.containsKey(identifierClassifier to originalName))) {
            throw DuplicateIdentifierException(position, transformedName, identifierClassifier)
        }
        transformedSymbols[key] = originalName
        if (isReverseTransformNeeded(identifierClassifier)) {
            transformedSymbolsByDeclaredName[identifierClassifier to originalName] = transformedName
        }
    }

    internal fun unregisterTransformedSymbol(identifierClassifier: IdentifierClassifier, transformedName: String, originalName: String): Boolean {
        val key = identifierClassifier to transformedName
        return if (transformedSymbolsStore?.containsKey(key) == true) {
            transformedSymbolsStore!!.remove(key)
            if (isReverseTransformNeeded(identifierClassifier)) {
                transformedSymbolsByDeclaredName.remove(identifierClassifier to originalName).also {
                    if (it == null) {
                        throw RuntimeException("$identifierClassifier orig $originalName not found")
                    }
                }
            }
            true
        } else if (parentScope?.unregisterTransformedSymbol(identifierClassifier, transformedName, originalName) == true) {
            true
        } else {
            throw RuntimeException("$identifierClassifier $transformedName not found")
        }
    }

    fun findTransformedSymbol(identifierClassifier: IdentifierClassifier, transformedName: String): Pair<String, SymbolTable>? {
        return findTransformedSymbol(identifierClassifier to transformedName)
    }

    private fun findTransformedSymbol(key: Pair<IdentifierClassifier, String>): Pair<String, SymbolTable>? {
        return transformedSymbolsStore?.get(key)?.let { it to this }
            ?: parentScope?.findTransformedSymbol(key)
    }

    fun listTypeAliasInThisScope(): List<TypeParameterNode> {
        return (typeAliasStore ?: emptyMap()).map {
            TypeParameterNode(SourcePosition.NONE, it.key, it.value.toTypeNode())
        }
    }

    fun listTypeAliasInAllScopes(): List<TypeParameterNode> {
        return listTypeAliasInThisScope() + (parentScope?.listTypeAliasInAllScopes() ?: emptyList())
    }

    fun listTypeAliasResolutionInThisScope(): Map<String, DataType> {
        return typeAliasResolutionStore ?: emptyMap()
    }

    fun findScope(level: Int): SymbolTable {
        if (level > scopeLevel) {
            throw RuntimeException("Cannot find scope with level $level")
        }
        var scope: SymbolTable? = this
        while (scope != null && scope.scopeLevel != level) {
            scope = scope.parentScope
        }
        if (scope != null) {
            return scope
        } else {
            throw RuntimeException("Cannot find scope with level $level")
        }
    }

    fun mergeFrom(position: SourcePosition, other: SymbolTable) { // this is only involved in runtime
        log.d { "Merge from other SymbolTable" }
        other.returnTargetsStore?.let { returnTargets.putAll(it) }
        other.propertyValuesStore?.forEach {
            putPropertyHolder(it.key, false /* TODO review */, it.value)
        }
        (other.functionDeclarationsStore ?: emptyMap()).forEach {
            declareFunction(position, it.key, it.value)
        }
        (other.classDeclarationsStore ?: emptyMap()).forEach {
            declareClass(position, it.value)
        }
        (other.typeAliasStore ?: emptyMap())
            .filterKeys { !it.endsWith('?') }
            .forEach {
                // TODO handle conflicts with existing scope, e.g. generic functions
                declareTypeAlias(position, it.key, it.value.toTypeNode())
            }
        (other.typeAliasResolutionStore ?: emptyMap())
            .filterKeys { !it.endsWith('?') }
            .forEach {
                // TODO handle conflicts with existing scope, e.g. generic functions
                declareTypeAliasResolution(position, it.key, it.value.toTypeNode())
            }
        (other.extensionFunctionDeclarationsStore ?: emptyMap()).forEach {
            declareExtensionFunction(position, it.key, it.value.second)
        }
//        this.transformedSymbols += other.transformedSymbols
    }

    fun mergeDeclarationsFrom(position: SourcePosition, other: SymbolTable, typeAliasResolution: Map<String, TypeNode>) {
        log.d { "Merge declarations from other SymbolTable" }
        (other.typeAliasStore ?: emptyMap())
            .filterKeys { !it.endsWith('?') }
            .forEach {
                // TODO handle conflicts with existing scope, e.g. generic functions
                declareTypeAlias(position, it.key, it.value.toTypeNode())
                typeAliasResolution[it.key]?.let { resolution ->
                    declareTypeAliasResolution(position, it.key, resolution)
                }
            }
        other.propertyDeclarationsStore?.forEach {
            declareProperty(position, it.key, it.value.type.toTypeNode(), it.value.isMutable)
        }
        (other.extensionFunctionDeclarationsStore ?: emptyMap()).forEach {
            declareExtensionFunction(position, it.key, it.value.second)
        }
        (other.extensionPropertiesStore ?: emptyMap()).forEach {
            declareExtensionProperty(position, it.key, it.value)
        }
        (other.functionDeclarationsStore ?: emptyMap()).forEach {
            declareFunction(position, it.key, it.value)
        }
        (other.classDeclarationsStore ?: emptyMap()).forEach {
            declareClass(position, it.value)
        }
        (other.propertyOwnersStore ?: emptyMap()).forEach {
            declarePropertyOwner(it.key, it.value.ownerRefName, it.value.extensionPropertyRef)
        }
        other.transformedSymbolsStore?.forEach {
            registerTransformedSymbol(SourcePosition.NONE, it.key.first, it.key.second, it.value)
        }
    }

    /**
     * The returned new symbol table is not added to the Call Stack.
     */
    private fun createTempSymbolTable(): SymbolTable {
        return SymbolTable(
            scopeLevel = scopeLevel + 1,
            scopeName = "<temp>",
            scopeType = ScopeType.ExtraWrap,
            parentScope = this
        )
    }

    fun printSymbolTableStack() {
        log.d {
            buildString {
                var table: SymbolTable? = this@SymbolTable
                while (table != null) {
                    if (isNotEmpty()) {
                        append(" --> ")
                    }
                    append("[l=${table.scopeLevel}, name=${table.scopeName}, type=${table.scopeType}]")
                    table = table.parentScope
                }
            }
        }
    }

    override fun toString(): String {
        return "scopeLevel = $scopeLevel\n" +
                "functionDeclarations = $functionDeclarations\n" +
                "propertyDeclarations = $propertyDeclarations\n" +
                "propertyValues = $propertyValues"
    }

}
