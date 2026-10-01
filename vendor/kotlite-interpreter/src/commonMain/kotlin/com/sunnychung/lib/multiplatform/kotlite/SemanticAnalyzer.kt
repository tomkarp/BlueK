package com.sunnychung.lib.multiplatform.kotlite

import com.sunnychung.lib.multiplatform.kotlite.error.CannotInferTypeException
import com.sunnychung.lib.multiplatform.kotlite.error.IdentifierClassifier
import com.sunnychung.lib.multiplatform.kotlite.error.SemanticException
import com.sunnychung.lib.multiplatform.kotlite.error.TypeMismatchException
import com.sunnychung.lib.multiplatform.kotlite.extension.emptyToNull
import com.sunnychung.lib.multiplatform.kotlite.extension.isValidIntegerLiteralAssignToByte
import com.sunnychung.lib.multiplatform.kotlite.extension.resolveGenericParameterType
import com.sunnychung.lib.multiplatform.kotlite.extension.resolveGenericParameterTypeArguments
import com.sunnychung.lib.multiplatform.kotlite.extension.resolveGenericParameterTypeToUpperBound
import com.sunnychung.lib.multiplatform.kotlite.extension.unboxRepeatedType
import com.sunnychung.lib.multiplatform.kotlite.extension.unboxTypeParameterType
import com.sunnychung.lib.multiplatform.kotlite.model.ASTNode
import com.sunnychung.lib.multiplatform.kotlite.model.AnyType
import com.sunnychung.lib.multiplatform.kotlite.model.CallableNode
import com.sunnychung.lib.multiplatform.kotlite.model.AsOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.AssignmentNode
import com.sunnychung.lib.multiplatform.kotlite.model.BinaryOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.BlockNode
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanNode
import com.sunnychung.lib.multiplatform.kotlite.model.BreakNode
import com.sunnychung.lib.multiplatform.kotlite.model.CallableType
import com.sunnychung.lib.multiplatform.kotlite.model.CatchNode
import com.sunnychung.lib.multiplatform.kotlite.model.CharNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassSecondaryConstructorNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstanceInitializerNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassMemberReferenceNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassModifier
import com.sunnychung.lib.multiplatform.kotlite.model.ClassParameterNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassPrimaryConstructorNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassTypeNode
import com.sunnychung.lib.multiplatform.kotlite.model.ContinueNode
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.DataType
import com.sunnychung.lib.multiplatform.kotlite.model.DoWhileNode
import com.sunnychung.lib.multiplatform.kotlite.model.DoubleNode
import com.sunnychung.lib.multiplatform.kotlite.model.ElvisOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.EnumEntryNode
import com.sunnychung.lib.multiplatform.kotlite.model.ExecutionEnvironment
import com.sunnychung.lib.multiplatform.kotlite.model.extraTypeParameters
import com.sunnychung.lib.multiplatform.kotlite.model.ExtensionProperty
import com.sunnychung.lib.multiplatform.kotlite.model.ForNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionBodyFormat
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallArgumentInfo
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallArgumentNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionModifier
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionType
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionTypeNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionValueParameterModifier
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionValueParameterNode
import com.sunnychung.lib.multiplatform.kotlite.model.GlobalProperty
import com.sunnychung.lib.multiplatform.kotlite.model.IfNode
import com.sunnychung.lib.multiplatform.kotlite.model.IndexOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.InfixFunctionCallNode
import com.sunnychung.lib.multiplatform.kotlite.model.IntegerNode
import com.sunnychung.lib.multiplatform.kotlite.model.LabelNode
import com.sunnychung.lib.multiplatform.kotlite.model.LambdaLiteralNode
import com.sunnychung.lib.multiplatform.kotlite.model.LongNode
import com.sunnychung.lib.multiplatform.kotlite.model.NavigationNode
import com.sunnychung.lib.multiplatform.kotlite.model.NothingType
import com.sunnychung.lib.multiplatform.kotlite.model.NullNode
import com.sunnychung.lib.multiplatform.kotlite.model.ObjectType
import com.sunnychung.lib.multiplatform.kotlite.model.PrimitiveTypeName
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyAccessorsNode
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyModifier
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyOwnerInfo
import com.sunnychung.lib.multiplatform.kotlite.model.RepeatedType
import com.sunnychung.lib.multiplatform.kotlite.model.ReturnNode
import com.sunnychung.lib.multiplatform.kotlite.model.ScopeType
import com.sunnychung.lib.multiplatform.kotlite.model.ScopeType.Companion.isLoop
import com.sunnychung.lib.multiplatform.kotlite.model.ScriptNode
import com.sunnychung.lib.multiplatform.kotlite.model.SearchFunctionModifier
import com.sunnychung.lib.multiplatform.kotlite.model.SemanticAnalyzerSymbolTable
import com.sunnychung.lib.multiplatform.kotlite.model.SemanticDummyRuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.StringLiteralNode
import com.sunnychung.lib.multiplatform.kotlite.model.StringNode
import com.sunnychung.lib.multiplatform.kotlite.model.SymbolReferenceSet
import com.sunnychung.lib.multiplatform.kotlite.model.SymbolTable
import com.sunnychung.lib.multiplatform.kotlite.model.SymbolTableTypeVisitCache
import com.sunnychung.lib.multiplatform.kotlite.model.ThrowNode
import com.sunnychung.lib.multiplatform.kotlite.model.TryNode
import com.sunnychung.lib.multiplatform.kotlite.model.TypeNode
import com.sunnychung.lib.multiplatform.kotlite.model.TypeParameterNode
import com.sunnychung.lib.multiplatform.kotlite.model.TypeParameterType
import com.sunnychung.lib.multiplatform.kotlite.model.UnaryOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.UnitType
import com.sunnychung.lib.multiplatform.kotlite.model.ValueNode
import com.sunnychung.lib.multiplatform.kotlite.model.ValueParameterDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.VariableReferenceNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhenConditionNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhenEntryNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhenNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhenSubjectNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhileNode
import com.sunnychung.lib.multiplatform.kotlite.model.isNonNullIntegralType
import com.sunnychung.lib.multiplatform.kotlite.model.isNonNullNumberType
import com.sunnychung.lib.multiplatform.kotlite.model.isNonNullNumberTypeOrByte
import com.sunnychung.lib.multiplatform.kotlite.model.typeUpperBoundOrAny
import com.sunnychung.lib.multiplatform.kotlite.util.ClassMemberResolver
import com.sunnychung.lib.multiplatform.kotlite.util.ClassSemanticAnalyzer
import com.sunnychung.lib.multiplatform.kotlite.util.FunctionAndTypes

/**
 * @param unitStarts indices of the script nodes that start a new source unit.
 * A REPL host appends every accepted input as a unit; code may use top-level
 * functions and properties declared later in its own unit, never in a later one.
 */
open class SemanticAnalyzer(val rootNode: ASTNode, val executionEnvironment: ExecutionEnvironment, private val retiredProperties: Map<Int, List<String>> = emptyMap(), private val unitStarts: Set<Int> = emptySet()) {
    val builtinSymbolTable = SemanticAnalyzerSymbolTable(scopeLevel = 0, scopeName = ":builtin", scopeType = ScopeType.Script, parentScope = null)
    val symbolTable = SemanticAnalyzerSymbolTable(scopeLevel = 1, scopeName = ":global", scopeType = ScopeType.Script, parentScope = builtinSymbolTable)
    var currentScope = builtinSymbolTable
    var functionDefIndex = 0
    var variableDefIndex = 0
    val symbolRecorders = mutableListOf<SymbolReferenceSet>()
    /**
     * Smart casts. A condition narrows the type of a variable in the code that only runs when the
     * condition held (or did not hold). Narrowings are keyed by the variable's transformed name, so
     * a shadowing declaration is not affected. They exist for the analysis only: the interpreter
     * reads members from the actual value, exactly as after an explicit `as`.
     */
    private class SmartCastFact(val key: String, val type: TypeNode, val isMutable: Boolean)
    private class SmartCast(val type: TypeNode, val isMutable: Boolean, val assignmentVersion: Int)
    private class SmartCastSubject(val key: String, val type: TypeNode, val isStableForTypeTest: Boolean, val isMutable: Boolean)

    private val smartCasts = mutableMapOf<String, SmartCast>()

    /** Counts assignments per variable; a narrowing made before the latest assignment is void. */
    private val assignmentVersions = mutableMapOf<String, Int>()
    private val activeReifiedTypeParameters = mutableMapOf<String, Boolean>()
    private data class CallableContext(val node: CallableNode, val returnType: DataType?)
    private data class InlineParameter(val owner: CallableNode, val crossinline: Boolean)
    private val callableContexts = mutableListOf<CallableContext>()
    private val inlineParameters = mutableMapOf<String, InlineParameter>()
    private val permittedInlineReferences = mutableSetOf<VariableReferenceNode>()

    // Top-level classes declared before any declaration is analyzed (see
    // `declareClassesAhead`), keyed by the position of their declaration.
    private class DeclaredClass(
        val node: ClassDeclarationNode,
        val definition: ClassDefinition,
        val companion: ClassDefinition,
        // type parameter, superclass and class scope of `visitClassBody`
        val scopes: List<SemanticAnalyzerSymbolTable>,
    ) {
        var state = ClassAnalysisState.Declared
    }
    private enum class ClassAnalysisState { Declared, AnalyzingSupertypes, Analyzing, Analyzed }
    private val declaredClasses = mutableMapOf<SourcePosition, DeclaredClass>()
    private val cyclicClasses = mutableSetOf<SourcePosition>()

    // Top-level functions and properties not analyzed yet, by declared name and
    // with their node index (see `analyzeTopLevelAhead`).
    private val pendingTopLevel = mutableMapOf<String, MutableList<IndexedValue<ASTNode>>>()
    private val startedTopLevel = mutableSetOf<Int>()
    private val topLevelIndexByPosition = mutableMapOf<SourcePosition, Int>()
    private var unitOfIndex = IntArray(0)
    private var currentUnit = 0
    // Index of the top-level property or statement whose own code is analyzed
    // (null in functions and classes), and the index of every analyzed
    // top-level property by transformed name, to keep initialization order.
    private var topLevelCodeIndex: Int? = null
    private val topLevelPropertyIndex = mutableMapOf<String, Int>()
    // Top-level properties whose initializer is being analyzed.
    private val initializingTopLevel = mutableListOf<String>()

    private fun checkInlineInvocation(symbol: String?, position: SourcePosition) {
        val parameter = inlineParameters[symbol] ?: return
        val ownerIndex = callableContexts.indexOfLast { it.node === parameter.owner }
        if (!parameter.crossinline && callableContexts.drop(ownerIndex + 1).any {
                (it.node as? LambdaLiteralNode)?.permitsNonLocalReturn != true
            }) {
            throw SemanticException(position, "Inline parameter cannot be invoked in an escaping context; use crossinline")
        }
    }

    // a cache of common types for optimization. not a must to use them
    val typeRegistry = listOf(
        TypeNode(SourcePosition.NONE, "Any", null, false),
        TypeNode(SourcePosition.NONE, "Int", null, false),
        TypeNode(SourcePosition.NONE, "Long", null, false),
        TypeNode(SourcePosition.NONE, "Double", null, false),
        TypeNode(SourcePosition.NONE, "Boolean", null, false),
        TypeNode(SourcePosition.NONE, "String", null, false),
        TypeNode(SourcePosition.NONE, "Char", null, false),
        TypeNode(SourcePosition.NONE, "Unit", null, false),
        TypeNode(SourcePosition.NONE, "Throwable", null, false),
    )
        .flatMap {
            listOf(
                it.name to it,
                "${it.name}?" to it.copy(isNullable = true),
            )
        }
        .let { it + listOf(
            "Null" to TypeNode(SourcePosition.NONE, "Nothing", null, true),
            "Nothing" to TypeNode(SourcePosition.NONE, "Nothing", null, false),
        ) }
        .toMap()

    val supportedOperatorFunctionNames = setOf(
        "get",
        "set",
        "hasNext",
        "next",
        "iterator",
        "plus",
        "minus",
        "times",
        "div",
        "rem",
        "plusAssign",
        "minusAssign",
        "timesAssign",
        "divAssign",
        "remAssign",
        "compareTo",
        "contains",
        "rangeTo",
        "rangeUntil",
    )

    fun ExtensionProperty.generateTransformedName() {
        this.transformedName = "EP//${this.receiver}/${this.declaredName}/${++functionDefIndex}"
    }

    fun GlobalProperty.generateTransformedName() {
        // the format needs to be friendly to `SymbolTable.findTransformedNameByDeclaredName`
        this.transformedName = "${this.declaredName}/-${++functionDefIndex}"
    }

    init {
        val classes = mutableListOf<ClassDefinition>()
        executionEnvironment.getBuiltinClasses(builtinSymbolTable).forEach {
            builtinSymbolTable.declareClass(SourcePosition.BUILTIN, it)
            it.attachToSemanticAnalyzer(this, isReady = false) // make "ObjectType" resolvable
            classes += it
        }
        builtinSymbolTable.init()

        executionEnvironment.getGlobalProperties(builtinSymbolTable).forEach {
            it.attachToSemanticAnalyzer(this)
            builtinSymbolTable.putPropertyHolder(it.declaredName, it.isMutable, it.accessor)
        }

        executionEnvironment.getExtensionProperties(builtinSymbolTable).forEach {
            it.generateTransformedName()
            builtinSymbolTable.declareExtensionProperty(SourcePosition.BUILTIN, it.transformedName!!, it)
        }
        val libFunctions = executionEnvironment.getBuiltinFunctions(builtinSymbolTable)
        libFunctions.forEach {
            // Re-analysis must consume the same name counters as the first pass.
            // Otherwise retained global-function names shift extension overload
            // identities, which still refer to the first pass in a live runtime.
            it.transformedRefName = null
            log.d { "Install lib function ${it.receiver?.let { "$it." } ?: ""}${it.name}" }
            it.visit()
        }
        classes.forEach { // do this again after registering functions to make the post-resolution logic works
            it.attachToSemanticAnalyzer(this, isReady = true)
        }

        symbolTable.init()
        symbolTable.beforeFunctionLookup = { analyzeTopLevelAhead(it) }

        currentScope = symbolTable
    }

    fun TypeNode.toNullable() = if (isNullable) {
        this
    } else {
        typeRegistry["$name?"] ?: this.copy(isNullable = true)
    }

    fun DataType.toTypeNode(): TypeNode =
        if (this is NothingType) {
            typeRegistry["Null"]!!
        } else if (this !is ObjectType && this !is FunctionType && this !is TypeParameterType) {
            typeRegistry["$name${if (isNullable) "?" else ""}"]!!
        } else if (this is FunctionType) {
            FunctionTypeNode(
                position = SourcePosition.NONE,
                parameterTypes = arguments.map { it.toTypeNode() },
                returnType = returnType.toTypeNode(),
                isNullable = isNullable,
            )
        } else if (this is ObjectType) {
            TypeNode(SourcePosition.NONE, name, arguments.map { it.toTypeNode() }.emptyToNull(), isNullable)
        } else {
            TypeNode(SourcePosition.NONE, name, null, isNullable)
        }

    fun TypeNode.toDataType(): DataType {
        return try {
            currentScope.assertToDataType(this)
        } catch (e: SemanticException) {
            throw e
        } catch (e: RuntimeException) {
//            e.printStackTrace()
            throw SemanticException(position, e.message ?: e.toString(), e)
        }
    }

    fun TypeNode.unboxClassTypeAsCompanion() = if (this is ClassTypeNode) {
        TypeNode(position, "${this.clazz.name}.Companion", this.clazz.arguments, false)
    } else {
        this
    }

    fun DataType.resolveTypeParameterAsUpperBound(): DataType {
        var subjectType = this
        while (subjectType is TypeParameterType) {
            if (subjectType == subjectType.upperBound) {
                throw RuntimeException("subjectType upper bound is itself")
            }
            subjectType = subjectType.upperBound
        }
        return subjectType
    }

    protected fun isLocalAndNotCurrentScope(scopeLevel: Int): Boolean {
        return scopeLevel > 1 && scopeLevel <= (symbolRecorders.lastOrNull()?.scopeLevel ?: currentScope.scopeLevel)
    }

    fun temporarilySwitchToScopeAndRun(scope: SemanticAnalyzerSymbolTable, executable: () -> Unit) {
        val oldScope = currentScope
        currentScope = scope
        try {
            executable()
        } finally {
            currentScope = oldScope
        }
    }

    fun operatorToFunctionName(operator: String) = when (operator) {
        "+" -> "plus"
        "-" -> "minus"
        "*" -> "times"
        "/" -> "div"
        "%" -> "rem"
        "+=" -> "plusAssign"
        "-=" -> "minusAssign"
        "*=" -> "timesAssign"
        "/=" -> "divAssign"
        "%=" -> "remAssign"
        "<", ">", "<=", ">=" -> "compareTo"
        ".." -> "rangeTo"
        "..<" -> "rangeUntil"
        else -> null
    }

    data class Modifier(
        /**
         * This would skip visiting lambdas.
         */
        val isSkipGenerics: Boolean = false,
    )

    private fun nullCheckedVariable(node: ASTNode, operator: String): VariableReferenceNode? {
        if (node !is BinaryOpNode || node.operator != operator) return null
        return when {
            node.node1 is VariableReferenceNode && node.node2 is NullNode -> node.node1 as VariableReferenceNode
            node.node2 is VariableReferenceNode && node.node1 is NullNode -> node.node2 as VariableReferenceNode
            else -> null
        }
    }

    /** Whether control never continues after the last statement, so facts of the other branch hold afterwards. */
    private fun blockNeverCompletes(block: BlockNode?): Boolean {
        return when (val last = block?.statements?.lastOrNull()) {
            is ReturnNode, is ThrowNode, is BreakNode, is ContinueNode -> true
            is FunctionCallNode -> last.type().name == "Nothing"
            else -> false
        }
    }

    private fun smartCastKey(variable: VariableReferenceNode): String? {
        variable.transformedRefName?.let { return it }
        val name = variable.variableName
        if (name == "this" || name == "super" || !currentScope.hasProperty(name)) return null
        var scope: SymbolTable = currentScope
        while (!scope.hasProperty(name, isThisScopeOnly = true)) {
            scope = scope.parentScope ?: return null
        }
        return scope.transformedSymbolsByDeclaredName[IdentifierClassifier.Property to name]
    }

    private fun activeSmartCast(key: String?): SmartCast? {
        if (key == null) return null
        return smartCasts[key]?.takeIf { it.assignmentVersion == (assignmentVersions[key] ?: 0) }
    }

    private fun addSmartCasts(facts: List<SmartCastFact>) {
        facts.forEach {
            smartCasts[it.key] = SmartCast(it.type, it.isMutable, assignmentVersions[it.key] ?: 0)
        }
    }

    private inline fun <T> withSmartCasts(facts: List<SmartCastFact>, block: () -> T): T {
        if (facts.isEmpty()) return block()
        val saved = smartCasts.toMap()
        addSmartCasts(facts)
        try {
            return block()
        } finally {
            smartCasts.clear()
            smartCasts.putAll(saved)
        }
    }

    /** Narrowings made inside [block] (e.g. by `if (x == null) return`) end with it. */
    private inline fun <T> scopedSmartCasts(block: () -> T): T {
        val saved = smartCasts.toMap()
        try {
            return block()
        } finally {
            smartCasts.clear()
            smartCasts.putAll(saved)
        }
    }

    /**
     * A property is stable for a type test unless it is a `var`, has a custom getter, or is open,
     * like in Kotlin. Locals and parameters are always stable; a `var` local is voided by assignment.
     * Null checks stay more lenient and narrow every variable.
     */
    private fun isStableForTypeTest(variable: VariableReferenceNode): Boolean {
        val (propertyType, ownerScope) = currentScope.getPropertyTypeOrNull(variable.variableName) ?: return false
        val owner = variable.ownerRef
        if (owner != null) {
            if (owner.extensionPropertyRef != null || propertyType.isMutable) return false
            val clazz = currentScope.findClass(owner.ownerRefName.removePrefix("this/"))?.first ?: return false
            return !isOverridableOrComputedProperty(clazz, variable.variableName)
        }
        return ownerScope.scopeType != ScopeType.Script || !propertyType.isMutable
    }

    private fun isOverridableOrComputedProperty(clazz: ClassDefinition, name: String): Boolean {
        var current: ClassDefinition? = clazz
        while (current != null) {
            current.declarations.firstOrNull { it is PropertyDeclarationNode && it.name == name }?.let {
                it as PropertyDeclarationNode
                return it.accessors != null || PropertyModifier.open in it.modifiers
            }
            current.primaryConstructor?.parameters?.firstOrNull { it.isProperty && it.parameter.name == name }?.let {
                return PropertyModifier.open in it.modifiers || PropertyModifier.override in it.modifiers
            }
            current = current.superClass
        }
        return false
    }

    private fun smartCastSubject(node: ASTNode?): SmartCastSubject? {
        if (node is WhenSubjectNode) {
            val binding = node.valueTransformedRefName
            if (node.hasValueDeclaration() && binding != null) {
                return node.type?.let { SmartCastSubject(binding, it, isStableForTypeTest = true, isMutable = false) }
            }
            return smartCastSubject(node.value)
        }
        val variable = node as? VariableReferenceNode ?: return null
        val key = smartCastKey(variable) ?: return null
        val isMutable = currentScope.getPropertyTypeOrNull(variable.variableName)?.first?.isMutable == true
        return SmartCastSubject(key, variable.type(), isStableForTypeTest(variable), isMutable)
    }

    private fun nonNullFact(subject: SmartCastSubject?): SmartCastFact? {
        if (subject == null || !subject.type.isNullable) return null
        return SmartCastFact(subject.key, subject.type.copy(isNullable = false), subject.isMutable)
    }

    /**
     * `x is T` narrows `x` to `T` if that is a subtype of `x`'s type. A type parameter, a type alias or an
     * unrelated type (Kotlin would intersect them) leave the type unchanged.
     */
    private fun typeTestFact(subject: SmartCastSubject?, tested: ASTNode?): SmartCastFact? {
        if (subject == null || !subject.isStableForTypeTest || tested !is TypeNode || tested is FunctionTypeNode) return null
        if (subject.type is FunctionTypeNode || subject.type is ClassTypeNode) return null
        if (currentScope.findTypeAlias(tested.name) != null) return null
        val currentType = subject.type.toDataType()
        val testedType = tested.toDataType()
        if (currentType is TypeParameterType || !currentType.copyOf(true).isAssignableFrom(testedType.copyOf(false))) return null
        val narrowed = testedType.copyOf(currentType.isNullable && testedType.isNullable)
        if (narrowed == currentType) return null
        return SmartCastFact(subject.key, narrowed.toTypeNode(), subject.isMutable)
    }

    /** Narrowings that hold in the code that runs only if [node] evaluated to `true`. */
    private fun smartCastsWhenTrue(node: ASTNode): List<SmartCastFact> {
        return when {
            node is BinaryOpNode && node.operator == "&&" -> {
                val first = smartCastsWhenTrue(node.node1)
                first + withSmartCasts(first) { smartCastsWhenTrue(node.node2) }
            }
            node is BinaryOpNode && node.operator == "!=" ->
                listOfNotNull(nonNullFact(smartCastSubject(nullCheckedVariable(node, "!="))))
            node is InfixFunctionCallNode && node.functionName == "is" ->
                listOfNotNull(typeTestFact(smartCastSubject(node.node1), node.node2))
            node is UnaryOpNode && node.operator == "!" -> smartCastsWhenFalse(node.node!!)
            else -> emptyList()
        }
    }

    /** Narrowings that hold in the code that runs only if [node] evaluated to `false`. */
    private fun smartCastsWhenFalse(node: ASTNode): List<SmartCastFact> {
        return when {
            node is BinaryOpNode && node.operator == "||" -> {
                val first = smartCastsWhenFalse(node.node1)
                first + withSmartCasts(first) { smartCastsWhenFalse(node.node2) }
            }
            node is BinaryOpNode && node.operator == "==" ->
                listOfNotNull(nonNullFact(smartCastSubject(nullCheckedVariable(node, "=="))))
            node is InfixFunctionCallNode && node.functionName == "!is" ->
                listOfNotNull(typeTestFact(smartCastSubject(node.node1), node.node2))
            node is UnaryOpNode && node.operator == "!" -> smartCastsWhenTrue(node.node!!)
            else -> emptyList()
        }
    }

    /** Narrowings of a `when` subject after one condition of an entry matched (or did not match). */
    private fun whenConditionSmartCasts(condition: WhenConditionNode, subject: ASTNode?, isConditionTrue: Boolean): List<SmartCastFact> {
        if (subject == null) {
            return if (isConditionTrue) smartCastsWhenTrue(condition.expression) else smartCastsWhenFalse(condition.expression)
        }
        return when (condition.testType) {
            // `is T` matched, or `!is T` did not match
            WhenConditionNode.TestType.TypeTest ->
                if (isConditionTrue != condition.isNegateResult) {
                    listOfNotNull(typeTestFact(smartCastSubject(subject), condition.expression))
                } else emptyList()
            // `null ->` did not match
            WhenConditionNode.TestType.Regular ->
                if (!isConditionTrue && !condition.isNegateResult && condition.expression is NullNode) {
                    listOfNotNull(nonNullFact(smartCastSubject(subject)))
                } else emptyList()
            WhenConditionNode.TestType.RangeTest -> emptyList()
        }
    }

    fun ASTNode.visit(modifier: Modifier = Modifier()) {
        when (this) {
            is AssignmentNode -> this.visit(modifier = modifier)
            is BinaryOpNode -> this.visit(modifier = modifier)
            is FunctionDeclarationNode -> this.visit(modifier = modifier)
            is FunctionValueParameterNode -> TODO() //this.visit(modifier = modifier)
            is IntegerNode -> {}
            is LongNode -> {}
            is DoubleNode -> {}
            is BooleanNode -> {}
            is NullNode -> {}
            is PropertyDeclarationNode -> this.visit(modifier = modifier)
            is ScriptNode -> this.visit(modifier = modifier)
            is TypeNode -> this.visit(modifier = modifier)
            is TypeParameterNode -> TODO()
            is UnaryOpNode -> this.visit(modifier = modifier)
            is VariableReferenceNode -> this.visit(modifier = modifier)
            is FunctionCallArgumentNode -> this.visit(modifier = modifier)
            is FunctionCallNode -> this.visit(modifier = modifier)
            is BlockNode -> this.visit(modifier = modifier)
            is ReturnNode -> this.visit(modifier = modifier)
            is BreakNode -> this.visit(modifier = modifier)
            is ContinueNode -> this.visit(modifier = modifier)
            is IfNode -> this.visit(modifier = modifier)
            is WhileNode -> this.visit(modifier = modifier)
            is DoWhileNode -> this.visit(modifier = modifier)
            is ClassDeclarationNode -> this.visit(modifier = modifier)
            is ClassInstanceInitializerNode -> this.visit(modifier = modifier)
            is ClassMemberReferenceNode -> { /* TODO */ }
            is ClassParameterNode -> this.visit(modifier = modifier)
            is ClassPrimaryConstructorNode -> this.visit(modifier = modifier)
            is NavigationNode -> this.visit(modifier = modifier)
            is IndexOpNode -> this.visit(modifier = modifier)
            is PropertyAccessorsNode -> TODO()
            is ValueNode -> {}
            is StringLiteralNode -> {}
            is StringNode -> this.visit(modifier = modifier)
            is LambdaLiteralNode -> this.visit(modifier = modifier)
            is CharNode -> {}
            is AsOpNode -> this.visit(modifier = modifier)
            is InfixFunctionCallNode -> this.visit(modifier = modifier)
            is ElvisOpNode -> this.visit(modifier = modifier)
            is ThrowNode -> this.visit(modifier = modifier)
            is CatchNode -> this.visit(modifier = modifier)
            is TryNode -> this.visit(modifier = modifier)
            is WhenConditionNode -> this.visit(modifier = modifier)
            is WhenEntryNode -> this.visit(modifier = modifier)
            is WhenNode -> this.visit(modifier = modifier)
            is WhenSubjectNode -> this.visit(modifier = modifier)
            is LabelNode -> TODO()
            is EnumEntryNode -> this.visit(modifier = modifier)
            is ForNode -> this.visit(modifier = modifier)
            is ValueParameterDeclarationNode -> this.visit(modifier = modifier)
        }
    }

    fun checkPropertyReadAccess(accessNode: ASTNode, name: String): Int {
        if (!currentScope.hasProperty(name)) {
            throw SemanticException(accessNode.position, "Property `$name` is not declared")
        }
        var scope: SymbolTable = currentScope
        while (!scope.hasProperty(name, isThisScopeOnly = true)) {
            scope = scope.parentScope!!
        }
        return scope.scopeLevel
    }

    fun currentClassName(): String? {
        var scope: SymbolTable? = currentScope
        while (scope != null) {
            if (scope.scopeType == ScopeType.Class) return scope.scopeName
            scope = scope.parentScope
        }
        return null
    }

    fun checkPropertyReadAccessAndGetScopeLevelAndTransformedName(accessNode: ASTNode, name: String): Pair<Int, String> {
        if (!currentScope.hasProperty(name)) {
            throw SemanticException(accessNode.position, "Property `$name` is not declared")
        }
        var scope: SymbolTable = currentScope
        while (!scope.hasProperty(name, isThisScopeOnly = true)) {
            scope = scope.parentScope!!
        }
        return scope.scopeLevel to
                (scope.transformedSymbolsByDeclaredName[IdentifierClassifier.Property to name]
                    ?: throw SemanticException(
                        accessNode.position,
                        "Transformed symbol of property `$name` cannot be found"
                    )
                )
    }

    /**
     * This method is stateful and modifies data.
     */
    /** The property whose accessor is being analyzed; see [noteSelfCallingAccessor]. */
    private var accessorUnderAnalysis: AccessorUnderAnalysis? = null

    private class AccessorUnderAnalysis(val property: PropertyDeclarationNode, val isSetter: Boolean, val outerScopeLevel: Int)

    private inline fun visitAccessor(property: PropertyDeclarationNode, isSetter: Boolean, visit: () -> Unit) {
        val enclosing = accessorUnderAnalysis
        accessorUnderAnalysis = AccessorUnderAnalysis(property, isSetter, currentScope.scopeLevel)
        try {
            visit()
        } finally {
            accessorUnderAnalysis = enclosing
        }
    }

    /**
     * A setter that assigns its own property, or a getter that reads it, calls
     * itself until the stack overflows. Kotlin compiles it (IntelliJ warns), so
     * this only records the place for a warning. [scopeLevel] is where the name
     * was found: the accessor's own scopes lie above [AccessorUnderAnalysis.outerScopeLevel].
     */
    private fun noteSelfCallingAccessor(position: SourcePosition, name: String, isWrite: Boolean, scopeLevel: Int?) {
        val accessor = accessorUnderAnalysis ?: return
        if (accessor.isSetter != isWrite || name != accessor.property.name) return
        if (scopeLevel != null && scopeLevel > accessor.outerScopeLevel) return
        if (isWrite) {
            accessor.property.selfCallingSetter = accessor.property.selfCallingSetter ?: position
        } else {
            accessor.property.selfCallingGetter = accessor.property.selfCallingGetter ?: position
        }
    }

    fun checkPropertyWriteAccess(accessNode: ASTNode, name: String): Int {
        if (!currentScope.hasProperty(name)) {
            throw SemanticException(accessNode.position, "Property `$name` is not declared")
        }
        var scope: SymbolTable = currentScope
        while (!scope.hasProperty(name, isThisScopeOnly = true)) {
            scope = scope.parentScope!!
        }

        val propertyType = scope.getPropertyType(name).first
        if (!propertyType.isMutable && scope.hasAssignedInThisScope(name)) {
            throw SemanticException(accessNode.position, "val `$name` cannot be reassigned")
        }
        scope.assign(name, SemanticDummyRuntimeValue(propertyType.type))

        return scope.scopeLevel
    }

    fun findExtensionFunction(receiverType: DataType, functionName: String): FunctionDeclarationNode? {
//        return if (receiverType is ObjectType) {
//            val clazz = receiverType.clazz
//            currentScope.findExtensionFunction("${clazz.fullQualifiedName}/${functionName}")
//        } else {
//            currentScope.findExtensionFunction("${receiverType.name}/${functionName}")
//        }
        return currentScope.findExtensionFunctions(receiverType, functionName).firstOrNull()?.first
    }

    fun ScriptNode.visit(modifier: Modifier = Modifier()) {
        smartCasts.clear()
        var unit = 0
        unitOfIndex = IntArray(nodes.size)
        nodes.forEachIndexed { index, node ->
            if (index > 0 && index in unitStarts) ++unit
            unitOfIndex[index] = unit
            topLevelIndexByPosition[node.position] = index
        }
        declareClassesAhead(nodes.filterIsInstance<ClassDeclarationNode>())
        declareTopLevelAhead(nodes)
        nodes.forEachIndexed { index, node ->
            retiredProperties[index].orEmpty().forEach { currentScope.retireAnalyzedProperty(it) }
            val declared = (node as? ClassDeclarationNode)?.let { declaredClasses[it.position] }
            if (declared != null) {
                analyzeDeclaredClass(declared, isOnDemand = false)
            } else if (startTopLevel(index, node)) {
                visitTopLevel(index, node, modifier)
            }
        }
        retiredProperties[nodes.size].orEmpty().forEach { currentScope.retireAnalyzedProperty(it) }
    }

    private fun topLevelName(node: ASTNode): String? = when (node) {
        is FunctionDeclarationNode -> node.name
        is PropertyDeclarationNode -> node.name
        else -> null
    }

    /**
     * Top-level functions (also extension functions) and properties may be
     * used before their position, like in Kotlin: `fun main() { hilfe() }`
     * before `fun hilfe()`, or a class using `val maximum` of a later file.
     * They are analyzed in source order, or earlier on demand when code of
     * the same source unit first looks up their name (`analyzeTopLevelAhead`).
     * Nothing is declared ahead, so declarations analyzed before get the same
     * transformed names whatever follows; the persistent REPL relies on that.
     */
    private fun declareTopLevelAhead(nodes: List<ASTNode>) {
        nodes.forEachIndexed { index, node ->
            val name = topLevelName(node) ?: return@forEachIndexed
            pendingTopLevel.getOrPut(name) { mutableListOf() } += IndexedValue(index, node)
        }
    }

    /** Marks the top-level node at [index] as analyzed; false if it already is. */
    private fun startTopLevel(index: Int, node: ASTNode): Boolean {
        if (!startedTopLevel.add(index)) return false
        val name = topLevelName(node) ?: return true
        pendingTopLevel[name]?.let { pending ->
            pending.removeAll { it.index == index }
            if (pending.isEmpty()) pendingTopLevel.remove(name)
        }
        return true
    }

    /**
     * Analyzes the pending top-level declarations named [name] of the current
     * source unit, in source order, so that a lookup sees all of them (also
     * every overload). Declarations of a later unit stay invisible.
     */
    private fun analyzeTopLevelAhead(name: String) {
        val pending = pendingTopLevel[name]?.filter { unitOfIndex[it.index] == currentUnit } ?: return
        pending.forEach { (index, node) ->
            if (startTopLevel(index, node)) analyzeAtTopLevel(index) { visitTopLevel(index, node, Modifier()) }
        }
    }

    private fun visitTopLevel(index: Int, node: ASTNode, modifier: Modifier) {
        currentUnit = unitOfIndex[index]
        topLevelCodeIndex = if (node is FunctionDeclarationNode || node is ClassDeclarationNode) null else index
        if (node is PropertyDeclarationNode) initializingTopLevel += node.name
        try {
            node.visit(modifier = modifier)
        } finally {
            topLevelCodeIndex = null
            if (node is PropertyDeclarationNode) initializingTopLevel.removeLast()
        }
        if (node is PropertyDeclarationNode) topLevelPropertyIndex[node.transformedRefName!!] = index
    }

    /**
     * Top-level properties are initialized in source order at runtime. Code
     * that runs while they are initialized (their initializers and top-level
     * statements, but not functions, lambdas or classes) must not read a later one.
     */
    private fun checkInitializedBeforeUse(node: ASTNode, name: String, transformedName: String) {
        val codeIndex = topLevelCodeIndex ?: return
        if (callableContexts.isNotEmpty()) return
        val declaredAt = topLevelPropertyIndex[transformedName] ?: return
        if (declaredAt > codeIndex) {
            throw SemanticException(node.position, "`$name` is initialized after this code in file order. Top-level properties are initialized in the order in which they are written, so declare `$name` before it is used here.")
        }
    }

    /**
     * Analyzes a top-level declaration in the script scope, also in the middle
     * of another declaration (on demand), which gets its state back afterwards.
     */
    private fun analyzeAtTopLevel(index: Int, analyze: () -> Unit) {
        val previousScope = currentScope
        val previousUnit = currentUnit
        val previousTopLevelCodeIndex = topLevelCodeIndex
        val previousSmartCasts = smartCasts.toMap()
        val previousReified = activeReifiedTypeParameters.toMap()
        val previousCallableContexts = callableContexts.toList()
        val previousInlineParameters = inlineParameters.toMap()
        val previousSymbolRecorders = symbolRecorders.toList()
        val previousAccessor = accessorUnderAnalysis
        accessorUnderAnalysis = null
        smartCasts.clear()
        activeReifiedTypeParameters.clear()
        callableContexts.clear()
        inlineParameters.clear()
        symbolRecorders.clear()
        currentScope = symbolTable
        currentUnit = unitOfIndex[index]
        topLevelCodeIndex = null
        try {
            analyze()
        } finally {
            currentScope = previousScope
            currentUnit = previousUnit
            topLevelCodeIndex = previousTopLevelCodeIndex
            smartCasts.clear()
            smartCasts.putAll(previousSmartCasts)
            activeReifiedTypeParameters.clear()
            activeReifiedTypeParameters += previousReified
            callableContexts.clear()
            callableContexts += previousCallableContexts
            inlineParameters.clear()
            inlineParameters += previousInlineParameters
            symbolRecorders.clear()
            symbolRecorders += previousSymbolRecorders
            accessorUnderAnalysis = previousAccessor
        }
    }

    private fun superTypeName(node: ASTNode): String? = when (node) {
        is FunctionCallNode -> superTypeName(node.function)
        is TypeNode -> node.name
        else -> null
    }

    /**
     * Declares every top-level class of the script before any declaration is
     * analyzed, like Kotlin: classes may name each other in any order, also in
     * a cycle (`class Hund { var herrchen: Mensch? }`, `class Mensch { var hund:
     * Hund? }`). A declared class is the same `ClassDefinition` its analysis
     * completes later, so types resolved earlier stay identical. Declaring uses
     * no symbol counters: names of declarations analyzed before a class stay
     * the same whatever follows, which the persistent REPL relies on.
     *
     * A class is analyzed at its position or, if earlier code needs its
     * members, on demand (`ClassDefinition.pendingAnalysis`), after its
     * supertypes. Members of a class whose analysis is still in progress are
     * those analyzed so far; in particular an expression-bodied function
     * without a declared return type has no type before its own analysis.
     */
    private fun declareClassesAhead(classes: List<ClassDeclarationNode>) {
        // Only the first declaration of a name: duplicates are reported by the ordinary analysis.
        val byName = classes.groupBy { it.name }.mapValues { it.value.first() }
        val declaring = mutableListOf<SourcePosition>()
        fun declare(node: ClassDeclarationNode) {
            if (node.position in declaredClasses) return
            if (symbolTable.findClass(node.fullQualifiedName) != null) return // e.g. a built-in class
            if (node.position in declaring) {
                // Reached again through its own supertypes: every class on the way is in the cycle.
                cyclicClasses += declaring.subList(declaring.indexOf(node.position), declaring.size)
                return
            }
            declaring += node.position
            // Supertypes first: they determine the type hierarchy of this class.
            node.superInvocations.orEmpty().mapNotNull { superTypeName(it) }.mapNotNull { byName[it] }.forEach { declare(it) }

            val name = node.name
            val fullQualifiedClassName = node.fullQualifiedName
            val typeParameters = node.typeParameters
            if (ClassModifier.abstract in node.modifiers) {
                node.inferredModifiers += ClassModifier.open
            }
            if (node.isInterface) {
                node.inferredModifiers += ClassModifier.open
                node.inferredModifiers += ClassModifier.abstract
            }
            val classType = TypeNode(
                position = node.position,
                name = fullQualifiedClassName,
                arguments = typeParameters.map { TypeNode(it.position, it.name, null, false) }.emptyToNull(),
                isNullable = false,
            )
            symbolTable.declareClass(node.position, nullableClassDefinition(node).also { it.attachToSemanticAnalyzer(this@SemanticAnalyzer) })
            val companion = companionClassDefinition(node, classType)
            symbolTable.declareClass(node.position, companion)

            val superClassInvocation = if (node.isInterface) null else node.superInvocations?.filterIsInstance<FunctionCallNode>()?.firstOrNull()
            val superClass = (superClassInvocation?.function as? TypeNode)?.let { symbolTable.findClass(it.name)?.first }
            val interfaceTypes = node.superInvocations?.filterIsInstance<TypeNode>() ?: emptyList()
            val typeParameterScope = SemanticAnalyzerSymbolTable(symbolTable.scopeLevel + 1, name, ScopeType.Class, parentScope = symbolTable)
            val superClassScope = SemanticAnalyzerSymbolTable(symbolTable.scopeLevel + 2, name, ScopeType.Class, parentScope = typeParameterScope)
            val classScope = SemanticAnalyzerSymbolTable(symbolTable.scopeLevel + 3, name, ScopeType.Class, parentScope = superClassScope)
            val definition = ClassDefinition(
                currentScope = classScope,
                name = name,
                fullQualifiedName = fullQualifiedClassName,
                isInterface = node.isInterface,
                modifiers = node.modifiers,
                typeParameters = typeParameters,
                isInstanceCreationAllowed = !node.isInterface,
                primaryConstructor = node.primaryConstructor,
                // Constructor properties are added by the analysis, after their parameters.
                rawMemberProperties = emptyList(),
                memberFunctions = node.declarations.filterIsInstance<FunctionDeclarationNode>().filterNot { it is ClassSecondaryConstructorNode },
                orderedInitializersAndPropertyDeclarations = node.declarations
                    .filter { it is ClassInstanceInitializerNode || it is PropertyDeclarationNode },
                declarations = node.declarations,
                superClassInvocation = superClassInvocation,
                superClass = superClass,
                superInterfaceTypes = interfaceTypes,
                superInterfaces = interfaceTypes.mapNotNull { symbolTable.findClass(it.name)?.first },
            )
            // The hierarchy is needed to resolve (generic) types before the analysis.
            if (superClass != null) definition.superClassInvocation = superClassInvocation
            definition.isDeclaredAhead = true
            symbolTable.declareClass(node.position, definition)
            declaring.removeLast()
            val declared = DeclaredClass(node, definition, companion, listOf(typeParameterScope, superClassScope, classScope))
            declaredClasses[node.position] = declared
            val analyze = { analyzeDeclaredClass(declared, isOnDemand = true) }
            definition.pendingAnalysis = analyze
            companion.pendingAnalysis = analyze
        }
        classes.forEach { if (byName[it.name] === it) declare(it) }
    }

    private fun analyzeDeclaredClass(declared: DeclaredClass, isOnDemand: Boolean) {
        when (declared.state) {
            ClassAnalysisState.Declared -> {
                declared.state = ClassAnalysisState.AnalyzingSupertypes
                declared.node.superInvocations.orEmpty()
                    .mapNotNull { superTypeName(it) }
                    .mapNotNull { name -> symbolTable.findClass(name)?.first }
                    .mapNotNull { definition -> declaredClasses.values.firstOrNull { it.definition === definition } }
                    .forEach { analyzeDeclaredClass(it, isOnDemand = false) }
                // A supertype may have needed the members of this class already.
                if (declared.state != ClassAnalysisState.AnalyzingSupertypes) return
            }
            // Its members are needed while its supertypes are analyzed.
            ClassAnalysisState.AnalyzingSupertypes -> if (!isOnDemand) return
            ClassAnalysisState.Analyzing, ClassAnalysisState.Analyzed -> return
        }
        declared.state = ClassAnalysisState.Analyzing
        declared.definition.pendingAnalysis = null
        declared.companion.pendingAnalysis = null
        // An on-demand analysis interrupts another declaration: analyze the
        // class at top level and give the interrupted one its state back.
        analyzeAtTopLevel(topLevelIndexByPosition.getValue(declared.node.position)) { declared.node.visit() }
        declared.state = ClassAnalysisState.Analyzed
    }

    fun TypeNode.visit(modifier: Modifier = Modifier()) {
        try {
            currentScope.typeNodeToDataType(this)
        } catch (e: RuntimeException) {
            throw SemanticException(position, e.message ?: e.toString() ?: "")
        }
            ?: throw SemanticException(position, "Unknown type `${this.descriptiveName()}`")

        // A lambda is evaluated later, after the generic call scope has been
        // left. Keep referenced type aliases (including reified parameters)
        // in its closure so a concrete call-site type is not replaced by the
        // parameter's upper bound at runtime.
        if (symbolRecorders.isNotEmpty() && currentScope.findTypeAlias(name) != null) {
            symbolRecorders.last().typeAlias += name
        }
    }

    fun UnaryOpNode.visit(modifier: Modifier = Modifier()) {
        node!!.visit(modifier = modifier)
        if (operator in setOf("pre++", "pre--", "post++", "post--") && node is VariableReferenceNode) {
            checkPropertyWriteAccess(this, (node as VariableReferenceNode).variableName)
        }
    }

    fun BinaryOpNode.visit(modifier: Modifier = Modifier()) {
        if (hasFunctionCall != null) {
            return
        }

        node1.visit(modifier = modifier)
        val smartCastsInNode2 = when (operator) {
            "&&" -> smartCastsWhenTrue(node1)
            "||" -> smartCastsWhenFalse(node1)
            else -> emptyList()
        }
        withSmartCasts(smartCastsInNode2) { node2.visit(modifier = modifier) }
        val functionName = if (operator in setOf("+", "-", "*", "/", "%", "<", ">", "<=", ">=", "..", "..<")) {
            operatorToFunctionName(operator)
        } else null
        val node1Type = node1.type(ResolveTypeModifier(isSkipGenerics = true)).toDataType()
        val node2Type = node2.type(ResolveTypeModifier(isSkipGenerics = true)).toDataType()
        if (functionName != null && currentScope.findMatchingCallables(
                currentSymbolTable = currentScope,
                originalName = functionName,
                receiverType = node1Type,
                arguments = listOf(FunctionCallArgumentInfo(name = null, type = node2Type)),
                modifierFilter = SearchFunctionModifier.OperatorFunctionOnly,
            ).isNotEmpty()
        ) {
            call = FunctionCallNode(
                function = NavigationNode(position, node1, ".", ClassMemberReferenceNode(position, functionName)),
                arguments = listOf(FunctionCallArgumentNode(position = node2.position, index = 0, value = node2)),
                declaredTypeArguments = emptyList(),
                position = position,
                modifierFilter = SearchFunctionModifier.OperatorFunctionOnly,
            ).also { it.visit(modifier = modifier) }
            hasFunctionCall = true
        } else {
            hasFunctionCall = false
        }
        type()
    }

    /**
     * Quoted from Kotlin official documentation:
     *
     * For the assignment operations, for example a += b, the compiler performs the following steps:
     *
     *     If the function from the right column is available:
     *
     *         If the corresponding binary function (that means plus() for plusAssign()) is available too, a is a mutable variable, and the return type of plus is a subtype of the type of a, report an error (ambiguity).
     *
     *         Make sure its return type is Unit, and report an error otherwise.
     *
     *         Generate code for a.plusAssign(b).
     *
     *     Otherwise, try to generate code for a = a + b (this includes a type check: the type of a + b must be a subtype of a).
     */
    fun AssignmentNode.visit(modifier: Modifier = Modifier()) {
        visitAssignment(modifier)
        // an assignment voids what was known about the variable's type; the value was analysed before
        (subject as? VariableReferenceNode)?.let { smartCastKey(it) }?.let {
            assignmentVersions[it] = (assignmentVersions[it] ?: 0) + 1
        }
    }

    private fun AssignmentNode.visitAssignment(modifier: Modifier) {
        if (subject !is VariableReferenceNode && subject !is NavigationNode && subject !is IndexOpNode) {
            throw SemanticException(position, "$subject cannot be assigned")
        }

        fun visitSubject(isRead: Boolean, isWrite: Boolean) {
            when (subject) {
                is VariableReferenceNode -> {
                    if (isRead) {
                        subject.visit(modifier = modifier)
                    }
                    if (isWrite) {
                        val variableName = subject.variableName
                        val l = checkPropertyWriteAccess(this, variableName)
                        noteSelfCallingAccessor(subject.position, variableName, isWrite = true, scopeLevel = l)
                        if (transformedRefName == null) {
                            transformedRefName = "$variableName/$l"
                        }
                    }
                }
                is NavigationNode -> {
                    if (isWrite) {
                        subject.visit(modifier = modifier, isCheckWriteAccess = true)
                    }
                }
                is IndexOpNode -> {
                    subject.visit(modifier = modifier, isWriteOnly = isWrite && operator == "=")
                    if (isWrite) {
                        assignFunctionCall = FunctionCallNode(
                            /**
                             * e.g. `x[0] = v`, subject == x[0], subject.subject == x
                             */
                            function = NavigationNode(
                                position,
                                subject.subject,
                                ".",
                                ClassMemberReferenceNode(position, "set")
                            ),
                            arguments = subject.arguments.mapIndexed { index, it ->
                                FunctionCallArgumentNode(position = it.position, index = index, value = it)
                            } + listOf(
                                FunctionCallArgumentNode(
                                    position = value.position,
                                    index = subject.arguments.size,
                                    value = value
                                )
                            ),
                            declaredTypeArguments = emptyList(),
                            position = position,
                            modifierFilter = SearchFunctionModifier.OperatorFunctionOnly,
                        )
                        assignFunctionCall!!.visit(modifier)
                    }
                }
                else -> throw SemanticException(position, "$subject cannot be assigned")
            }
        }
        if (operator == "=") {
            visitSubject(isRead = true, isWrite = true)
        } else {
            visitSubject(isRead = true, isWrite = false)
        }
        // The target of `x = ...` has the declared type, not a smart-cast one.
        val subjectRawType = if (operator == "=" && subject is VariableReferenceNode) {
            scopedSmartCasts {
                smartCastKey(subject)?.let { smartCasts.remove(it) }
                subject.type()
            }
        } else {
            subject.type()
        }
        val subjectType = subjectRawType.toDataType()

        if (operator == "=" && subjectRawType is FunctionTypeNode && value is LambdaLiteralNode) {
            value.parameterTypesUpperBound = subjectRawType.parameterTypes
            value.returnTypeUpperBound = subjectRawType.returnType
            value.receiverType = subjectRawType.receiverType
        }

        value.visit(modifier = modifier)
        val valueType = value.type().toDataType()

        val preAssignOperator = operator.removeSuffix("=")
        val preAssignFunctionName = operatorToFunctionName(preAssignOperator)
        val operatorFunctionName = operatorToFunctionName(operator)
        var isPreAssignFunctionAvailable = false

        val subjectTypeWithErasedGenerics = (subjectType as? ObjectType)?.asTypeWithErasedTypeParameters(currentScope) ?: subjectType

        if (operator in setOf("+=", "-=", "*=", "/=", "%=")) {
            isPreAssignFunctionAvailable = currentScope.findMatchingCallables(
                currentSymbolTable = currentScope,
                originalName = preAssignFunctionName!!,
                receiverType = subjectTypeWithErasedGenerics,
                arguments = listOf(FunctionCallArgumentInfo(name = null, type = valueType)),
                modifierFilter = SearchFunctionModifier(
                    typeFilter = SearchFunctionModifier.Type.OperatorFunctionOnly,
                    returnType = subjectTypeWithErasedGenerics
                ),
            ).isNotEmpty()

            if (currentScope.findMatchingCallables(
                    currentSymbolTable = currentScope,
                    originalName = operatorFunctionName!!,
                    receiverType = subjectTypeWithErasedGenerics,
                    arguments = listOf(FunctionCallArgumentInfo(name = null, type = valueType)),
                    modifierFilter = SearchFunctionModifier(
                        typeFilter = SearchFunctionModifier.Type.OperatorFunctionOnly,
                        returnType = UnitType()
                    ),
                ).isNotEmpty()
            ) {
                if (isPreAssignFunctionAvailable) {
                    // TODO check for whether `subject` is mutable before throwing exception
                    throw SemanticException(position, "Both `$operatorFunctionName` and `$preAssignFunctionName` operator functions are available. The call is ambiguous.")
                }
                wholeFunctionCall = FunctionCallNode(
                    function = NavigationNode(position, subject, ".", ClassMemberReferenceNode(position, operatorFunctionName)),
                    arguments = listOf(FunctionCallArgumentNode(position = value.position, index = 0, value = value)),
                    declaredTypeArguments = emptyList(),
                    position = position,
                    modifierFilter = SearchFunctionModifier(
                        typeFilter = SearchFunctionModifier.Type.OperatorFunctionOnly,
                        returnType = UnitType()
                    ),
                ).also { it.visit(modifier = modifier) }
                return // the subject can be immutable
            }
        }

        // check for subject is mutable
        if (operator != "=") {
            visitSubject(isRead = false, isWrite = true)
        }

        if (operator in setOf("+=", "-=", "*=", "/=", "%=")) {
            if (isPreAssignFunctionAvailable) {
                preAssignFunctionCall = FunctionCallNode(
                    function = NavigationNode(position, subject, ".", ClassMemberReferenceNode(position, preAssignFunctionName!!)),
                    arguments = listOf(FunctionCallArgumentNode(position = value.position, index = 0, value = value)),
                    declaredTypeArguments = emptyList(),
                    position = position,
                    modifierFilter = SearchFunctionModifier.OperatorFunctionOnly,
                ).also { it.visit(modifier = modifier) }
                return
            }

            if (operator == "+=" && subjectType isPrimitiveTypeOf PrimitiveTypeName.String) {
                return // string can concat anything
            }
            if (!subjectType.isNonNullNumberType()) {
                throw SemanticException(position, "Missing `$operatorFunctionName` or `$preAssignFunctionName` operator function for type ${subjectType.descriptiveName}")
            }
            if (!valueType.isNonNullNumberType()) {
                throw TypeMismatchException(position, "non-null number type", valueType.nameWithNullable)
            }
            if (subjectType isPrimitiveTypeOf PrimitiveTypeName.Double) {
                return // ok
            }
            if (subjectType isPrimitiveTypeOf PrimitiveTypeName.Long && valueType.isNonNullIntegralType()) {
                return // ok
            }
        }

        if (subjectType isPrimitiveTypeOf PrimitiveTypeName.Byte && value is IntegerNode) {
            if (value.value in Byte.MIN_VALUE .. Byte.MAX_VALUE) {
                return // ok to assign Int to Byte if it is within acceptable range of bytes
            }
        }

        if (!subjectType.isAssignableFrom(valueType)) {
            throw TypeMismatchException(position, subjectType.nameWithNullable, valueType.nameWithNullable)
        }
    }

    fun evaluateAndRegisterReturnType(node: ASTNode) {
        fun setOfAllTypeNodes(type: TypeNode): Set<TypeNode> {
            return mutableSetOf(type) + (type.arguments?.flatMap { setOfAllTypeNodes(it) } ?: emptyList())
        }

        val type = node.type()
        if (symbolRecorders.isNotEmpty()) {
            val symbols = symbolRecorders.last()
            val typesToResolve = setOfAllTypeNodes(type)
            typesToResolve.forEach {
                val find = currentScope.findClass(it.name)
                if (find != null && isLocalAndNotCurrentScope(find.second.scopeLevel)) {
                    symbols.classes += find.first.fullQualifiedName
                } else {
                    val find = currentScope.findTypeAlias(it.name)
                    if (find != null && isLocalAndNotCurrentScope(find.second.scopeLevel)) {
                        symbols.typeAlias += it.name
                    }
                }
            }
        }
    }

    fun PropertyDeclarationNode.visit(modifier: Modifier = Modifier(), isVisitInitialValue: Boolean = true, isClassProperty: Boolean = false, scopeLevel: Int = currentScope.scopeLevel, isVisitAccessors: Boolean = true) {
        if (declaredModifiers.contains(PropertyModifier.override)) {
            inferredModifiers += PropertyModifier.open
        }
        if (isVisitInitialValue) {
            if (declaredType is FunctionTypeNode && initialValue is LambdaLiteralNode) {
                initialValue.parameterTypesUpperBound = declaredType.parameterTypes
                initialValue.returnTypeUpperBound = declaredType.returnType
                initialValue.receiverType = declaredType.receiverType
            }
            if (declaredType != null && initialValue is FunctionCallNode) initialValue.expectedReturnType = declaredType
            initialValue?.visit(modifier = modifier)
        }
        if (currentScope.hasProperty(name = name, isThisScopeOnly = true)) {
            throw SemanticException(position, "Property `$name` has already been declared")
        }
        if (!isClassProperty && accessors != null) {
            throw SemanticException(position, "Only class member properties can define custom accessors")
        }
//        if (isMutable && accessors != null) {
//            throw SemanticException("`var` with custom accessors is not supported")
//        }
//        if (accessors?.setter != null) {
//            throw SemanticException("Custom setter is currently not supported")
//        }
        if (isVisitInitialValue && isVisitAccessors && accessors != null) {
            accessors.getter?.let { getter -> visitAccessor(this, isSetter = false) { getter.visit(modifier = modifier, isPropertyAccessor = true, propertyAccessorType = accessors.type) } }
            accessors.setter?.let { setter -> visitAccessor(this, isSetter = true) { setter.visit(modifier = modifier, isPropertyAccessor = true, propertyAccessorType = accessors.type) } }
        }
        if (initialValue != null) {
            val valueType = initialValue.type().toDataType()
            if (declaredType == null) {
                inferredType = initialValue.type()
            }
            val subjectType = type.toDataType()
            if (isValidIntegerLiteralAssignToByte(initialValue, subjectType)) {
                // ok
            } else if (!subjectType.isAssignableFrom(valueType) && subjectType != valueType) {
                throw TypeMismatchException(position, subjectType.descriptiveName, valueType.descriptiveName)
            }
        } else if (declaredType == null) {
            throw SemanticException(position, "Type cannot be inferred for property `$name`")
        }
        currentScope.declareProperty(position = position, name = name, type = type, isMutable = isMutable)
        if (initialValue != null && accessors == null) {
            currentScope.assign(name, SemanticDummyRuntimeValue(currentScope.getPropertyType(name).first.type))
        }
//        transformedRefName = "$name/${scopeLevel}"
        transformedRefName = "$name/${++variableDefIndex}"
        currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, transformedRefName!!, name)

        evaluateAndRegisterReturnType(this)
    }

    private fun isDeclaredBelowScript(name: String): Boolean {
        var scope: SymbolTable? = currentScope
        while (scope != null && scope !== symbolTable) {
            if (scope.hasProperty(name, isThisScopeOnly = true)) return true
            scope = scope.parentScope
        }
        return false
    }

    fun VariableReferenceNode.visit(modifier: Modifier = Modifier()) {
        // A top-level property later in this unit, unless a local or member shadows it.
        if (variableName in pendingTopLevel && !isDeclaredBelowScript(variableName)) {
            analyzeTopLevelAhead(variableName)
        }
        if (!currentScope.hasProperty(variableName)) {
            if (currentScope.findClass(variableName) != null) {
                return
            }
            if (variableName in initializingTopLevel) {
                throw SemanticException(position, "`$variableName` is used before it is initialized: the initializer of `$variableName` needs its value, directly or through a function.")
            }
        }
        val (l, transformedName) = checkPropertyReadAccessAndGetScopeLevelAndTransformedName(this, variableName)
        noteSelfCallingAccessor(position, variableName, isWrite = false, scopeLevel = l)
        if (l == symbolTable.scopeLevel) {
            checkInitializedBeforeUse(this, variableName, transformedName)
            isTopLevelProperty = true
        }
        if (variableName != "this" && variableName != "super" && transformedRefName == null) {
            transformedRefName = transformedName
            currentScope.findPropertyOwner(transformedRefName!!)?.let {
                ownerRef = it
            }
            // A REPL may retire a global name. Closures keep its holder, just
            // like local captures, instead of looking it up in a future scope.
            if (symbolRecorders.isNotEmpty() && (l == 1 || isLocalAndNotCurrentScope(l))) {
                val symbols = symbolRecorders.last()
                symbols.properties += ownerRef?.ownerRefName ?: transformedRefName!!
            }
        } else if (variableName == "this" || variableName == "super") {
            if (symbolRecorders.isNotEmpty() && isLocalAndNotCurrentScope(l)) {
                val symbols = symbolRecorders.last()
                symbols.properties += variableName
            }
        }

        if (!modifier.isSkipGenerics && transformedRefName in inlineParameters && this !in permittedInlineReferences) {
            throw SemanticException(position, "Inline parameter cannot be used as a value; use noinline")
        }
        evaluateAndRegisterReturnType(this)
    }

    fun pushScope(scopeName: String, scopeType: ScopeType, returnType: DataType? = null, overrideScopeLevel: Int = currentScope.scopeLevel + 1) {
        currentScope = SemanticAnalyzerSymbolTable(
            scopeLevel = overrideScopeLevel,
            scopeName = scopeName,
            scopeType = scopeType,
            returnType = returnType,
            parentScope = currentScope
        )
    }

    fun pushScope(scope: SemanticAnalyzerSymbolTable) {
        scope.parentScope = currentScope
        currentScope = scope
    }

    fun popScope() {
        currentScope = currentScope.parentScope!! as SemanticAnalyzerSymbolTable
    }

    fun FunctionDeclarationNode.visit(modifier: Modifier = Modifier(), isClassMemberFunction: Boolean = false, isPropertyAccessor: Boolean = false, propertyAccessorType: TypeNode? = null) {
        val previousScope = currentScope
        var additionalScopeCount = 0
        var variantsOfThis = mutableListOf<FunctionDeclarationNode>()

        if (FunctionModifier.nullaware in modifiers) {
            throw UnsupportedOperationException("The modifier `nullaware` is not for runtime use")
        }
        if (typeParameters.any { it.isReified } && FunctionModifier.inline !in modifiers) {
            throw SemanticException(position, "Only inline functions can declare reified type parameters")
        }

        if (FunctionModifier.inline in modifiers &&
            (FunctionModifier.open in modifiers || FunctionModifier.override in declaredModifiers || FunctionModifier.abstract in modifiers)) {
            throw SemanticException(position, "Inline functions cannot be virtual or overridden")
        }
        valueParameters.forEach { parameter ->
            val modes = parameter.modifiers.intersect(setOf(FunctionValueParameterModifier.noinline, FunctionValueParameterModifier.crossinline))
            if (modes.isNotEmpty() && (FunctionModifier.inline !in modifiers || parameter.type !is FunctionTypeNode || modes.size > 1)) {
                throw SemanticException(parameter.position, "noinline/crossinline require a function parameter of an inline function and cannot be combined")
            }
            if (FunctionModifier.inline in modifiers && parameter.type is FunctionTypeNode && parameter.type.isNullable && FunctionValueParameterModifier.noinline !in parameter.modifiers) {
                throw SemanticException(parameter.position, "Nullable inline parameters must be noinline")
            }
        }

        val isVararg = valueParameters.isNotEmpty() &&
            valueParameters.first().modifiers.contains(FunctionValueParameterModifier.vararg)

        if (isVararg && valueParameters.size > 1) {
            throw SemanticException(valueParameters[1].position, "Only exactly one function parameter is supported if there is a vararg parameter")
        }
        if (!isVararg && valueParameters.size > 1) {
            (1..< valueParameters.size).forEach { i ->
                if (valueParameters[i].modifiers.contains(FunctionValueParameterModifier.vararg)) {
                    throw SemanticException(valueParameters[i].position, "Only exactly one function parameter is supported if there is a vararg parameter")
                }
            }
        }
        if (isVararg && valueParameters.first().defaultValue != null) {
            throw SemanticException(valueParameters.first().defaultValue!!.position, "Vararg value argument with a default value is not supported")
        }
        this.isVararg = isVararg

        if (FunctionModifier.override in declaredModifiers || FunctionModifier.abstract in declaredModifiers) {
            inferredModifiers += FunctionModifier.open
        }

        if (modifiers.contains(FunctionModifier.operator)) {
            if (!isClassMemberFunction && receiver == null) {
                throw SemanticException(position, "Operator functions are only allowed as a class member or as an extension function")
            }
            if (name !in supportedOperatorFunctionNames) {
                throw SemanticException(position, "`$name` is not a supported operator function name. Supported names are: ${supportedOperatorFunctionNames.joinToString(", ")}")
            }
            when (name) {
                "compareTo" -> {
                    if (valueParameters.size != 1) {
                        throw SemanticException(position, "Operator function `$name` must have exactly one value parameter")
                    }
                    if (returnType != typeRegistry["Int"]) {
                        throw SemanticException(position, "Operator function `$name` must return Int")
                    }
                }
                "contains" -> {
                    if (returnType != typeRegistry["Boolean"]) {
                        throw SemanticException(position, "Operator function `$name` must return Boolean")
                    }
                }
            }
        }
        if (FunctionModifier.infix in modifiers) {
            if (isVararg) {
                throw SemanticException(position, "Infix function cannot accept variable number of arguments")
            }
            if (valueParameters.size != 1) {
                throw SemanticException(position, "Infix function must have a single value parameter")
            }
            if (!isClassMemberFunction && receiver == null) {
                throw SemanticException(position, "Infix function must be member functions or extension functions")
            }
            if (valueParameters.first().defaultValue != null) {
                throw SemanticException(position, "Infix function cannot contain a value parameter with default value")
            }
        }

        pushScope(
            scopeName = name,
            scopeType = ScopeType.ExtraWrap,
        )
        ++additionalScopeCount

        if (isPropertyAccessor) {
            currentScope.declareProperty(position, "field", propertyAccessorType!!, true)
            currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, "field", "field")
        }

        (typeParameters + extraTypeParameters).forEach {
            currentScope.declareTypeAlias(position, it.name, it.typeUpperBound)
        }

        pushScope(
            scopeName = name,
            scopeType = ScopeType.Function,
            returnType = declaredReturnType?.resolveGenericParameterType(typeParameters)?.toDataType()
                ?: typeRegistry["Any?"]!!.toDataType(),
        )
        ++additionalScopeCount

        val visitValueParameters = {
            valueParameters.forEach {
                it.visit(modifier = modifier, functionDeclarationNode = this, isDeclareProperty = !isVararg)
                if ((it.type as? FunctionTypeNode)?.receiverType != null) {
                    val type = it.type as FunctionTypeNode
                    currentScope.declareExtensionFunction(
                        position = position,
                        name = "${receiver?.descriptiveName() ?: "-"}/$name/${(it.type as FunctionTypeNode).receiverType!!.descriptiveName()}/${it.name}",
                        node = FunctionDeclarationNode(
                            position = it.position,
                            name = it.name,
                            receiver = type.receiverType,
                            declaredReturnType = type.returnType,
                            valueParameters = (type.parameterTypes ?: emptyList()).map {
                                FunctionValueParameterNode(
                                    position = it.position,
                                    name = "",
                                    declaredType = it,
                                    defaultValue = null,
                                    modifiers = emptySet(),
                                )
                            },
                            body = null,
                            transformedRefName = "${receiver?.descriptiveName() ?: "-"}/$name/${(it.type as FunctionTypeNode).receiverType!!.descriptiveName()}/${it.name}/${++functionDefIndex}"
                        )//.also { it.visit(modifier = modifier) }
                            .also { type.extensionFunctionRefName = it.transformedRefName }
                    )
                }
            }
            if (isVararg) {
                with(valueParameters.single()) {
                    if ((type as? FunctionTypeNode)?.receiverType != null) {
                        throw SemanticException(position, "vararg parameter cannot be a function type with a receiver")
                    }
                    val type = this@visit.resolveGenericParameterType(this).let {
                        TypeNode(position, "List", listOf(it), false)
                    }
                    currentScope.declareProperty(position = position, name = name, type = type, isMutable = false)
                    currentScope.assign(
                        name,
                        SemanticDummyRuntimeValue(currentScope.typeNodeToPropertyType(type, false)!!.type)
                    )
                    generateTransformedName()
                    currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, transformedRefName!!, name)
                }
            }
        }

        if (receiver == null) {
            visitValueParameters()

            previousScope.declareFunction(position, name, this)
            if (transformedRefName == null) { // class declaration can assign transformedRefName
                transformedRefName = "$name/${++functionDefIndex}"
            }
            previousScope.registerTransformedSymbol(position, IdentifierClassifier.Function, transformedRefName!!, name)
        } else {
            copyReceiverIntoCurrentScope(
                position = position,
                receiver = receiver,
                typeParameters = typeParameters + extraTypeParameters,
            )

            pushScope("$name(valueParameters)", ScopeType.FunctionParameters)
            ++additionalScopeCount

            // overwrite receiver's type parameters with same name
            typeParameters.forEach {
                currentScope.declareTypeAlias(position, it.name, it.typeUpperBound)
                currentScope.declareTypeAliasResolution(
                    position,
                    it.name,
                    TypeParameterType(
                        name = it.name,
                        isNullable = false,
                        upperBound = previousScope.typeNodeToDataType(it.typeUpperBoundOrAny())
                            ?: currentScope.assertToDataType(it.typeUpperBoundOrAny()),
                    )
                )
            }

            visitValueParameters()

            // 1. setting `transformedRefName` must be before `this.copy()`.
            // 2. `transformedRefName` should be identical among these extension functions, because
            //    only one implementation would be registered in Interpreter.
            transformedRefName = "${receiver.descriptiveName()}/$name/${++functionDefIndex}"
            previousScope.declareExtensionFunction(position, "${receiver.name}/$name", this.copy(receiver = receiver.copy(isNullable = false)).also { variantsOfThis += it })

            if (receiver.isNullable) {
                previousScope.declareExtensionFunction(position, "${receiver.name}?/$name", this)
//                transformedRefName = "${typeNode.name}?/$name/${++functionDefIndex}"

//                previousScope.declareExtensionFunction("Nothing/$name", this.copy(receiver = typeRegistry["Null"]).also { variantsOfThis += it })
//                transformedRefName = "Nothing/$name/${++functionDefIndex}"
            }
        }

        val outerSmartCasts = smartCasts.toMap()
        smartCasts.clear()
        if (body != null) {
            body.returnTypeUpperBound = declaredReturnType
            val previousReified = activeReifiedTypeParameters.toMap()
            typeParameters.forEach { activeReifiedTypeParameters[it.name] = it.isReified }
            callableContexts += CallableContext(this, (declaredReturnType ?: inferredReturnType)?.resolveGenericParameterType(typeParameters)?.toDataType())
            val addedInlineParameters = valueParameters.filter {
                FunctionModifier.inline in modifiers && it.type is FunctionTypeNode && FunctionValueParameterModifier.noinline !in it.modifiers
            }
            addedInlineParameters.forEach { inlineParameters[it.transformedRefName!!] = InlineParameter(this, FunctionValueParameterModifier.crossinline in it.modifiers) }
            try {
                body.visit(modifier = modifier)
            } finally {
                addedInlineParameters.forEach { inlineParameters.remove(it.transformedRefName) }
                callableContexts.removeLast()
                activeReifiedTypeParameters.clear()
                activeReifiedTypeParameters.putAll(previousReified)
            }

            // TODO check for return statement

            val valueType = body.type().toDataType()
            if (declaredReturnType == null && body.format == FunctionBodyFormat.Expression) {
                inferredReturnType = body.type()
                variantsOfThis.forEach { it.inferredReturnType = inferredReturnType }
            } else {
                val subjectType = returnType.resolveGenericParameterType(typeParameters).toDataType()
                if (subjectType !is UnitType && valueType !is NothingType && !subjectType.isAssignableFrom(valueType)) {
                    throw TypeMismatchException(position, subjectType.nameWithNullable, valueType.nameWithNullable)
                }
            }
        }
        smartCasts.clear()
        smartCasts.putAll(outerSmartCasts)

        while (additionalScopeCount-- > 0) {
            popScope()
        }

        evaluateAndRegisterReturnType(this)
    }

    private fun copyReceiverIntoCurrentScope(position: SourcePosition, receiver: TypeNode, typeParameters: List<TypeParameterNode>) {
        val resolvedReceiver = receiver.resolveGenericParameterTypeToUpperBound(typeParameters, isResolveRootOnly = true)
        val typeNode = resolvedReceiver.let {
            currentScope.findTypeAlias(it.nameWithNullable)?.first?.toTypeNode() ?: it
        }
        currentScope.declareProperty(position = position, name = "this", type = receiver, isMutable = false)
        currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, "this", "this")
        val clazz = currentScope.findClass(typeNode.name)?.first
            ?: throw SemanticException(position, "Class `${typeNode.descriptiveName()}` not found")
        val receiverIdentifier = typeNode.resolveGenericParameterTypeToUpperBound(typeParameters).descriptiveName()
        if (clazz.superClass != null) {
            val superClassTypeResolutions = ClassMemberResolver.create(currentScope, clazz, typeNode.arguments)!!
                .let {
                    it.genericResolutionsByTypeName[clazz.fullQualifiedName]!!
                }
            val superClassType = TypeNode(
                SourcePosition.NONE,
                clazz.superClass!!.fullQualifiedName,
                clazz.superClass!!.typeParameters.map { tp -> superClassTypeResolutions[tp.name]!! }.emptyToNull(),
                isNullable = false,
            )
            currentScope.declareProperty(position = position, name = "super", type = superClassType, isMutable = false)
            currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, "super", "super")
        }
        if (!typeNode.isNullable) {
            clazz.typeParameters.forEachIndexed { index, it ->
                currentScope.declareTypeAlias(position, it.name, it.typeUpperBound)
                if ((typeNode.arguments?.get(index) ?: throw SemanticException(
                        position,
                        "Missing receiver type argument $index"
                    )).name != "*"
                ) {
                    currentScope.declareTypeAliasResolution(position, it.name, typeNode.arguments!![index])
                }
            }
            clazz.getAllMemberProperties().forEach {
                currentScope.declareProperty(
                    position = position,
                    name = it.key,
                    type = it.value.type.toTypeNode(),
                    isMutable = it.value.isMutable
                )
                val transformedName = clazz.findMemberPropertyTransformedName(it.key)
                    ?: throw SemanticException(position, "Cannot find transformed property of `${it.key}`")
                currentScope.registerTransformedSymbol(
                    position = position,
                    identifierClassifier = IdentifierClassifier.Property,
                    transformedName = transformedName,
                    originalName = it.key,
                )
                currentScope.declarePropertyOwner(
                    name = transformedName, // "${it.key}/${currentScope.scopeLevel}",
                    owner = "this/$receiverIdentifier", //"this/${receiver.descriptiveName()}",
                )
            }
            clazz.getAllMemberFunctions().forEach {
                currentScope.declareFunction(position = position, name = it.key, node = it.value)
                currentScope.declareFunctionOwner(
                    name = it.key,
                    function = it.value,
                    owner = "this" /*"this/${receiver.descriptiveName()}"*/
                )
            }
        }
        currentScope.findExtensionPropertyByReceiver(typeNode.resolveGenericParameterTypeToUpperBound(clazz.typeParameters))
            .forEach {
                currentScope.declareProperty(
                    position = position,
                    name = it.second.declaredName,
                    type = it.second.typeNode!!,
                    isMutable = it.second.setter != null
                )
                currentScope.registerTransformedSymbol(
                    position = position,
                    identifierClassifier = IdentifierClassifier.Property,
                    transformedName = it.second.transformedName!!,
                    originalName = it.second.declaredName,
                )
                currentScope.declarePropertyOwner(
                    name = it.second.transformedName!!, //"${it.second.declaredName}/${currentScope.scopeLevel}",
                    owner = "this/$receiverIdentifier",
                    extensionPropertyRef = it.first,
                )
            }
    }

    private fun FunctionCallNode.describeArgumentTypes(): String = arguments.joinToString(", ") { argument ->
        runCatching { argument.type(ResolveTypeModifier(isSkipGenerics = true)).descriptiveName() }.getOrDefault("?")
    }

    fun FunctionCallNode.visit(modifier: Modifier = Modifier(), isSkipConstructionSecurityCheck: Boolean = false, isSuperClassInvocation: Boolean = false) {
        // Function values have no class member table. Route explicit invoke through
        // the same resolution and inline-escape checks as the ordinary f(...) form.
        val navigation = function as? NavigationNode
        if (navigation?.operator == "." && navigation.member.name == "invoke" && navigation.subject is VariableReferenceNode) {
            navigation.subject.visit(modifier.copy(isSkipGenerics = true))
            if (navigation.subject.type() is FunctionTypeNode) {
                val direct = copy(function = navigation.subject, resolvedInvoke = null)
                direct.visit(modifier, isSkipConstructionSecurityCheck, isSuperClassInvocation)
                resolvedInvoke = direct
                returnType = direct.returnType
                return
            }
        }
        arguments.forEachIndexed { i, _ ->
            arguments.forEachIndexed { j, _ ->
                if (i < j && arguments[i].name != null && arguments[j].name != null && arguments[i].name == arguments[j].name) {
                    throw SemanticException(arguments[j].position, "Duplicated argument ${arguments[i].name}")
                }
            }
        }

        if (modifierFilter == null) {
            modifierFilter = SearchFunctionModifier.NoRestriction
        }

        pushScope("func", ScopeType.Function)

        // visit argument must before evaluating type
        arguments.forEach {
            it.visit(modifier = modifier.copy(isSkipGenerics = true))
        }

        class FunctionInfo(val valueParameters: List<Any>, val typeParameters: List<TypeParameterNode>, val receiverType: TypeNode?, val returnType: TypeNode)

        var resolvedDeclaration: FunctionDeclarationNode? = null
        var extraTypeResolutions = emptyMap<String, TypeNode>()

        val functionArgumentAndReturnTypeDeclarations = when (function) {
            is VariableReferenceNode /* f(x) or constructor */, is TypeNode /* Superclass constructor */ -> {
                val functionName = when (function) {
                    is VariableReferenceNode -> function.variableName
                    is TypeNode -> function.name
                    else -> throw UnsupportedOperationException()
                }
                val resolutions = currentScope.findMatchingCallables(
                    currentSymbolTable = currentScope,
                    originalName = functionName,
                    receiverType = null,
                    arguments = arguments.map { FunctionCallArgumentInfo(it.name, it.type(ResolveTypeModifier(isSkipGenerics = true)).toDataType()) },
                    modifierFilter = if (function is TypeNode) SearchFunctionModifier.ConstructorOnly else modifierFilter!!,
                )
                if (resolutions.size > 1) {
                    throw SemanticException(position, "Ambiguous function call for `${functionName}`. ${resolutions.size} candidates match:\n${resolutions.joinToString("") { "- ${it.toDisplayableSignature()}\n" }}")
                }
                val resolution = resolutions.firstOrNull()
                    ?: throw SemanticException(position, "No matching function or constructor `${functionName}` found for the argument types (${describeArgumentTypes()})")
                if (function is VariableReferenceNode) {
                    function.ownerRef = resolution.owner?.let { PropertyOwnerInfo(it) }
                }
                functionRefName = resolution.transformedName
                callableType = resolution.type
                secondaryConstructorIndex = resolution.secondaryConstructorIndex
                resolvedDeclaration = resolution.definition as? FunctionDeclarationNode
                if (resolution.type == CallableType.Property) checkInlineInvocation(resolution.transformedName, position)
                if (resolution.type == CallableType.Property && resolution.scope === symbolTable) {
                    checkInitializedBeforeUse(function, functionName, resolution.transformedName)
                }

                if (callableType == CallableType.Constructor) {
                    val clazz = resolution.definition as ClassDefinition
                    if (!isSkipConstructionSecurityCheck) {
                        if ((isSuperClassInvocation && !clazz.isInstanceCreationAllowed) || (!isSuperClassInvocation && !clazz.isInstanceCreationByUserAllowed())) {
                            throw SemanticException(
                                position,
                                "Instances of class ${clazz.fullQualifiedName} cannot be created directly via constructor"
                            )
                        }
                    }
                }

                if (symbolRecorders.isNotEmpty() && isLocalAndNotCurrentScope(resolution.scope.scopeLevel)) {
                    val symbols = symbolRecorders.last()
                    when (resolution.type) {
                        CallableType.Property -> { symbols.properties += resolution.owner ?: resolution.transformedName }
                        CallableType.Function -> {
                            if (resolution.owner == null) {
                                symbols.functions += resolution.transformedName
                            } else {
                                symbols.properties += resolution.owner
                            }
                        }

                        CallableType.Constructor -> {
                            symbols.classes += (resolution.definition as ClassDefinition).fullQualifiedName
                        }

                        CallableType.ExtensionFunction -> {}
                        CallableType.ClassMemberFunction -> {}
                    }
                }

                FunctionInfo(
                    valueParameters = resolution.arguments,
                    typeParameters = resolution.typeParameters,
                    receiverType = null,
                    returnType = resolution.returnType.let {
                        if (callableType == CallableType.Constructor) {
                            TypeNode(SourcePosition.NONE, it.name, resolution.typeParameters.map {
                                TypeNode(SourcePosition.NONE, it.name, null, false)
                            }.emptyToNull(), false)
                        } else {
                            it
                        }
                    }
                )
            }

            is NavigationNode -> {
                /*val receiverType =*/ function.visit(modifier = modifier, IdentifierClassifier.Function)
//                val lookupReceiverTypes = listOf(receiverType)
                val receiverType = function.subject.type().unboxClassTypeAsCompanion().toDataType()
                val lookupReceiverTypes = if (!receiverType.isNullable || function.operator == ".") {
                    listOf(receiverType)
                } else { // operator == "?." && receiverType.isNullable
                    listOf(
                        function.subject.type().copy(isNullable = false).toDataType(),
                        function.subject.type().copy(isNullable = true).toDataType(),
                    )
                }

                // `?.` calls on the non-null receiver, which also accepts every
                // callable of the nullable type; the search for it already keeps
                // only the most specific one (member of `Int` over `Any?.toString()`).
                // The nullable type is a fallback, like in NavigationNode.visitMember.
                // Merging both searches made such pairs ambiguous.
                val resolutions = lookupReceiverTypes.firstNotNullOfOrNull {
                    currentScope.findMatchingCallables(
                        currentSymbolTable = currentScope,
                        originalName = function.member.name,
                        receiverType = it,
                        arguments = arguments.map { FunctionCallArgumentInfo(it.name, it.type(ResolveTypeModifier(isSkipGenerics = true)).toDataType()) },
                        modifierFilter = modifierFilter!!,
                    ).takeIf { it.isNotEmpty() }
                } ?: emptyList()
                if (resolutions.size > 1) {
                    throw SemanticException(position, "Ambiguous function call for `${function.member.name}`. ${resolutions.size} candidates match:\n${resolutions.joinToString("") { "- ${it.toDisplayableSignature()}\n" }}")
                }
                val resolution = resolutions.firstOrNull()
                    ?: throw SemanticException(position, "No matching function `${function.member.name}` found for type ${receiverType.nameWithNullable} and the argument types (${describeArgumentTypes()})")

                if (function.subject is VariableReferenceNode && function.subject.variableName == "super") {
                    if (resolution.definition is FunctionDeclarationNode && FunctionModifier.abstract in resolution.definition.modifiers) {
                        throw SemanticException(function.member.position, "Cannot direct access abstract members")
                    }
                }

                functionRefName = resolution.transformedName
                callableType = resolution.type
                secondaryConstructorIndex = resolution.secondaryConstructorIndex
                isSpecialFunction = resolution.isSpecialFunction

                /**
                 * Return type must be nullable if:
                 * - Callable returns nullable type
                 * - receiver is nullable and operator is "?."
                 */

                val returnType = resolution.returnType.let {
                    var r = if (receiverType.isNullable && function.operator == "?.") {
                        it.copy(isNullable = true)
                    } else {
                        it
                    }
                    val subjectType = function.subject.type().toDataType()
                    log.v { "functionRefName=$functionRefName; subjectType=${subjectType::class.simpleName} ${subjectType.descriptiveName}; receiverType = ${receiverType.descriptiveName}" }
                    if (subjectType is ObjectType) {
                        // use the subject value to resolve type parameters of the subject type
                        val classTypeParameters = subjectType.clazz.typeParameters
//                        log.v {
//                            "functionRefName=$functionRefName; subjectType=${subjectType.descriptiveName}; subjectType.clazz.typeParameters=${
//                                subjectType.clazz.typeParameters.joinToString(
//                                    ","
//                                ) { it.name }
//                            }; subjectType.arguments=${subjectType.arguments.joinToString(",") { it.descriptiveName }}; before r=${r.descriptiveName()}"
//                        }
                        // Extension-function type parameters are independent of
                        // the receiver class' type parameters. In particular,
                        // `Iterable<S>.filterIsInstance<T>()` must not let a
                        // receiver such as `List<Entity>` resolve its `T`
                        // through `List<T>` before the call-site argument is
                        // applied. Class members still need the class mapping.
                        val namedTypeArguments = if (resolution.type == CallableType.ExtensionFunction) {
                            mutableMapOf()
                        } else {
                            classTypeParameters.mapIndexed { index, it ->
                                it.name to subjectType.arguments[index].toTypeNode()
                            }.toMap().toMutableMap()
                        }

                        // the subject value itself can be a type argument as well. it has a higher priority. try to resolve it.
                        fun resolve(typeParameterName: String, declaredReceiverType: TypeNode, actualReceiverType: TypeNode) {
                            if (typeParameterName == declaredReceiverType.name) {
                                namedTypeArguments[typeParameterName] = if (declaredReceiverType.isNullable && actualReceiverType.isNullable) {
                                    actualReceiverType.copy(isNullable = false)
                                } else {
                                    actualReceiverType
                                }
                                return
                            }
                            if (declaredReceiverType.arguments?.size == actualReceiverType.arguments?.size) {
                                declaredReceiverType.arguments?.forEachIndexed { index, it ->
                                    resolve(typeParameterName, it, actualReceiverType.arguments!![index])
                                }
                            }
                        }
                        val subjectTypeNode = subjectType.toTypeNode()
                        (resolution.typeParameters + resolution.extraTypeParameters).forEach {
                            if (it.name == resolution.receiverType?.name) {
                                namedTypeArguments[it.name] = subjectTypeNode.let {
                                    if (resolution.receiverType.isNullable || function.operator == "?.") {
                                        it.copy(isNullable = false)
                                    } else {
                                        it
                                    }
                                }
                            }
                            resolution.receiverType?.let { declaredReceiverType ->
                                resolve(it.name, declaredReceiverType, subjectTypeNode)
                            }
                        }

                        if (namedTypeArguments.isNotEmpty()) {
                            extraTypeResolutions = namedTypeArguments
                            r = it.resolveGenericParameterTypeArguments(namedTypeArguments).let {
                                // TODO refactor this duplicate code
                                // to make sure the return type of this expression is nullable if it should
                                if (receiverType.isNullable && function.operator == "?.") {
                                    it.copy(isNullable = true)
                                } else {
                                    it
                                }
                            }
                        }
                        log.v { "functionRefName=$functionRefName; r=${r.descriptiveName()}" }
                    }
                    r
                }

                if (symbolRecorders.isNotEmpty() && isLocalAndNotCurrentScope(resolution.scope.scopeLevel)) {
                    val symbols = symbolRecorders.last()
                    when (resolution.type) {
                        CallableType.Function, CallableType.Property, CallableType.Constructor, CallableType.ClassMemberFunction -> {}

                        CallableType.ExtensionFunction -> {
                            symbols.extensionFunctions += resolution.transformedName
                        }
                    }
                }

                resolvedDeclaration = resolution.definition as? FunctionDeclarationNode
                FunctionInfo(
                    valueParameters = resolution.arguments,
                    typeParameters = resolution.typeParameters,
                    receiverType = resolution.receiverType,
                    returnType = returnType
                )
            }

            else -> { // including `{ ... }()`, `f!!()`, etc.
                function.visit(modifier = modifier)
                val type = function.type()
                if (type is FunctionTypeNode) { // function's return type is FunctionTypeNode
                    if (!type.isNullable) {
                        FunctionInfo(
                            valueParameters = type.parameterTypes!!,
                            typeParameters = emptyList(),
                            receiverType = null,
                            returnType = type.returnType!!
                        )
                    } else {
                        throw SemanticException(position, "${type.descriptiveName()} is not callable")
                    }
                } else {
                    throw SemanticException(position, "${type.descriptiveName()} is not callable")
                }
            }
        }

        // Validate call arguments against declared arguments
        // Check for missing mandatory arguments, extra arguments, duplicated arguments and mismatch data types
//        if (arguments.size > functionArgumentDeclarations.size) {
//            throw SemanticException("Too much arguments. At most ${functionArgumentDeclarations.size} are accepted.")
//        }

        val isVararg = (functionArgumentAndReturnTypeDeclarations.valueParameters.firstOrNull() as? FunctionValueParameterNode)?.let {
            it.modifiers.contains(FunctionValueParameterModifier.vararg)
        } ?: false

        if (declaredTypeArguments.isNotEmpty() && functionArgumentAndReturnTypeDeclarations.typeParameters.size != declaredTypeArguments.size) {
            throw SemanticException(position, "Number of type arguments does not match with number of type parameters of the matched callable")
        }

        declaredTypeArguments.forEach {
            it.visit(modifier = modifier)
        }

        fun findErasedTypeParameter(type: TypeNode): String? {
            if (currentScope.findTypeAlias(type.name) != null && activeReifiedTypeParameters[type.name] != true) {
                return type.name
            }
            // Nested arguments are erased even inside a reified classifier (List<T>).
            return if (type.name == "Nothing") "Nothing" else null
        }
        functionArgumentAndReturnTypeDeclarations.typeParameters
            .zip(declaredTypeArguments)
            .firstOrNull { (parameter, argument) -> parameter.isReified && findErasedTypeParameter(argument) != null }
            ?.let { (_, argument) ->
                val erased = findErasedTypeParameter(argument)!!
                throw SemanticException(
                    argument.position,
                    "Cannot pass erased type parameter `$erased` to reified type parameter",
                )
            }

        functionArgumentAndReturnTypeDeclarations.typeParameters.forEach {
            currentScope.declareTypeAlias(it.position, it.name, it.typeUpperBound)
        }

        var typeArgumentByName = functionArgumentAndReturnTypeDeclarations.typeParameters
            .let { typeParameters ->
                if (typeArguments.isNotEmpty()) {
                    typeParameters.mapIndexed { index, tp ->
                        tp.name to typeArguments[index]
                    }.toMap()
                } else {
                    emptyMap()
                }
            }

        class ArgumentInfo(val type: DataType, val isOptional: Boolean, val name: String?)
        fun evaluateArguments() = functionArgumentAndReturnTypeDeclarations.valueParameters.map {
            when (it) {
                is DataType -> ArgumentInfo(it, false, null)
                is TypeNode -> ArgumentInfo(it.toDataType(), false, null)
                is FunctionValueParameterNode -> ArgumentInfo(
                    type = if (typeArgumentByName.isEmpty()) {
                        it.type.resolveGenericParameterTypeToUpperBound(
                            functionArgumentAndReturnTypeDeclarations.typeParameters +
                                extraTypeResolutions.map { TypeParameterNode(it.value.position, it.key, it.value) }
                        ) // note the order
                            .toDataType()
                    } else {
                        it.type.resolveGenericParameterTypeArguments(extraTypeResolutions + typeArgumentByName).toDataType() // note the order
                    },
                    isOptional = it.defaultValue != null,
                    name = it.name
                )
                else -> throw UnsupportedOperationException("Unknown internal class ${it::class.simpleName}")
            }
        }
        var argumentInfos = evaluateArguments()
//        val mandatoryArgumentIndexes = argumentInfos.indices.filter { !argumentInfos[it].isOptional }
//
        // callArgumentMappedIndexes[index of `arguments`] = index of matched argument
        val callArgumentMappedIndexes = arguments.mapIndexed { i, a ->
            if (isVararg) {
                0
            } else if (a.name == null) {
                if (i == arguments.lastIndex && a.type(ResolveTypeModifier(isSkipGenerics = true)) is FunctionTypeNode) {
                    argumentInfos.lastIndex
                } else {
                    i
                }
            } else {
                argumentInfos.indexOfFirst { it.name == a.name }.also {
                    if (it < 0) throw SemanticException(a.position, "Argument ${a.name} not found")
                }
            }
        }
//        if (callArgumentMappedIndexes.distinct().size < callArgumentMappedIndexes.size) {
//            throw SemanticException("There are duplicated arguments")
//        }
//        val missingIndexes = mandatoryArgumentIndexes.filter { i -> callArgumentMappedIndexes.none { it == i } }
//        if (missingIndexes.isNotEmpty()) {
//            throw SemanticException("Missing mandatory arguments for index $missingIndexes")
//        }

        val typeParameters = functionArgumentAndReturnTypeDeclarations.typeParameters
        val tpUpperBounds = typeParameters.associate { it.name to (it.typeUpperBound?.toDataType() ?: AnyType(isNullable = true)) }
        var tpResolutions = mutableMapOf<String, TypeNode>()
        fun inferTypeArgumentsFromOtherArguments(isSkipGenerics: Boolean) {
            if (declaredTypeArguments.isEmpty() && functionArgumentAndReturnTypeDeclarations.typeParameters.isNotEmpty()) {
                // infer type arguments from value arguments

                fun inferNestedTypeArgument(resolvedArgumentTypeName: String) {
                    if (tpUpperBounds[resolvedArgumentTypeName] !is ObjectType) return

                    var t: DataType? = currentScope.assertToDataType(tpResolutions[resolvedArgumentTypeName]!!)
//                    while (t is ObjectType && t.name != tpUpperBounds[resolvedArgumentTypeName]!!.name) {
//                        t = t.superType
//                    }
                    if (t is ObjectType && t.name != tpUpperBounds[resolvedArgumentTypeName]!!.name) {
                        t = t.findSuperType(tpUpperBounds[resolvedArgumentTypeName]!!.name)
                    }
                    if (t == null) {
                        return
                    }
                    (tpUpperBounds[resolvedArgumentTypeName] as? ObjectType)?.arguments?.forEachIndexed { i, it ->
                        if (tpUpperBounds.containsKey(it.name)) {
                            val argument = (t as ObjectType).arguments[i]
                            if (argument is RepeatedType && argument.actualType == null) {
                                return@forEachIndexed
                            }
                            val resolvedArgumentType = argument.toTypeNode()
                            tpResolutions[it.name] = superTypeOf(tpResolutions[it.name] ?: resolvedArgumentType, resolvedArgumentType)
                        }
                    }
                }

                fun inferTypeArgumentFromOtherArgument(parameterType: TypeNode, argumentType: TypeNode) {
                    if (tpUpperBounds.containsKey(parameterType.name)) {
                        val argumentType = if (parameterType.isNullable && argumentType.isNullable) {
                            argumentType.copy(isNullable = false)
                        } else {
                            argumentType
                        }
                        tpResolutions[parameterType.name] =
                            superTypeOf(tpResolutions.getOrElse(parameterType.name) { argumentType }, argumentType)
                        inferNestedTypeArgument(parameterType.name)
                    } /*else if (parameterType.arguments?.any { tpUpperBounds.containsKey(it.name) } == true) {
                        parameterType.arguments.withIndex().filter { tpUpperBounds.containsKey(it.value.name) }
                            .forEach {
                                val tp = it.value.name
                                val argType = (argumentType.arguments ?: return@forEach)[it.index]
                                tpResolutions[tp] = superTypeOf(tpResolutions.getOrElse(tp) { argType }, argType)
                                inferNestedTypeArgument(tp)
                            }
                    }*/
                    parameterType.arguments?.withIndex()
                        ?.forEach {
                            inferTypeArgumentFromOtherArgument(it.value, (argumentType.arguments ?: return@forEach)[it.index])
                        }
                }

                arguments.forEachIndexed { i, callArg ->
                    val parameterType =
                        functionArgumentAndReturnTypeDeclarations.valueParameters[callArgumentMappedIndexes[i]].let { vp ->
                            when (vp) {
                                is DataType -> vp.toTypeNode()
                                is TypeNode -> vp
                                is FunctionValueParameterNode -> vp.type
                                else -> throw UnsupportedOperationException("Unknown internal class ${vp::class.simpleName}")
                            }
                        }
                    val argumentType = callArg.type(ResolveTypeModifier(isSkipGenerics = isSkipGenerics))
                    inferTypeArgumentFromOtherArgument(parameterType = parameterType, argumentType = argumentType)
                }
                if (functionArgumentAndReturnTypeDeclarations.receiverType != null) {
                    val parameterType = functionArgumentAndReturnTypeDeclarations.receiverType
                    val argumentType =
                        (function as NavigationNode).subject.type(ResolveTypeModifier(isSkipGenerics = isSkipGenerics))
                            .let {
                                if (function.operator == "?.") {
                                    it.copy(isNullable = false)
                                } else {
                                    it
                                }
                            }

                    var type = argumentType.toDataType() as? ObjectType
                    if (functionArgumentAndReturnTypeDeclarations.receiverType.name !in tpUpperBounds) { // not the case of `fun <T> T.f()`
                        if (type != null && type.name != parameterType.name) {
                            type = type.findSuperType(parameterType.name)
                        }
                    }

                    if (type != null) {
                        inferTypeArgumentFromOtherArgument(parameterType = parameterType, argumentType = type.toTypeNode())
                    }
                }
                // check at this point would miss generic lambda resolution
//            if (tpResolutions.size != tpUpperBounds.size) {
//                val missing = tpUpperBounds.map { it.key }.toSet() - tpResolutions.map { it.key }.toSet()
//                throw CannotInferTypeException("type: ${missing.joinToString(", ")}")
//            }
//            if (tpUpperBounds.any {
//                    !it.value.isAssignableFrom(tpResolutions[it.key]!!.toDataType())
//                }) throw SemanticException("Given value arguments are out of bound of type parameters")

                inferredTypeArguments = functionArgumentAndReturnTypeDeclarations.typeParameters.map { tp ->
                    tpResolutions[tp.name]
                }
                typeArgumentByName = tpResolutions
            }
        }
        inferTypeArgumentsFromOtherArguments(isSkipGenerics = true)
        argumentInfos = evaluateArguments() // update upper bounds of generic lambda

//        if (typeArguments.size != functionArgumentAndReturnTypeDeclarations.typeParameters.size) {
//            throw SemanticException("Number of type arguments does not match with number of type parameters of the matched callable")
//        }

        arguments.forEachIndexed { i, callArgument ->
            val functionArgumentType = argumentInfos[callArgumentMappedIndexes[i]].type
            if (callArgument.value is LambdaLiteralNode && functionArgumentType is FunctionType) {
                if (callArgument.value.valueParameters.size != functionArgumentType.arguments.size && !(callArgument.value.valueParameters.isEmpty() && functionArgumentType.arguments.size == 1)) {
                    throw SemanticException(callArgument.position, "Lambda argument count is different from function parameter declaration.")
                }
                callArgument.value.parameterTypesUpperBound = functionArgumentType.arguments.map {
                    it.toTypeNode()
                }
                callArgument.value.returnTypeUpperBound = functionArgumentType.returnType.toTypeNode()
                callArgument.value.receiverType = functionArgumentType.receiverType?.toTypeNode()
                val parameter = functionArgumentAndReturnTypeDeclarations.valueParameters[callArgumentMappedIndexes[i]] as? FunctionValueParameterNode
                callArgument.value.permitsNonLocalReturn = resolvedDeclaration?.modifiers?.contains(FunctionModifier.inline) == true &&
                    parameter != null && FunctionValueParameterModifier.noinline !in parameter.modifiers && FunctionValueParameterModifier.crossinline !in parameter.modifiers
                callArgument.value.implicitLabel = when (val called = function) {
                    is VariableReferenceNode -> called.variableName
                    is NavigationNode -> (called.member as? ClassMemberReferenceNode)?.name
                    else -> null
                }
            }
        }

        // revisit to resolve generic lambda type parameters
        // visit argument must before evaluating type
        arguments.forEachIndexed { i, argument ->
            val reference = argument.value as? VariableReferenceNode
            val symbol = reference?.let { if (currentScope.hasProperty(it.variableName)) checkPropertyReadAccessAndGetScopeLevelAndTransformedName(it, it.variableName).second else null }
            val source = inlineParameters[symbol]
            if (source != null) {
                val parameter = functionArgumentAndReturnTypeDeclarations.valueParameters[callArgumentMappedIndexes[i]] as? FunctionValueParameterNode
                if (resolvedDeclaration?.modifiers?.contains(FunctionModifier.inline) != true || parameter == null ||
                    FunctionValueParameterModifier.noinline in parameter.modifiers ||
                    (!source.crossinline && FunctionValueParameterModifier.crossinline in parameter.modifiers)) {
                    throw SemanticException(argument.position, "Inline parameter cannot escape into this argument; use noinline/crossinline")
                }
                checkInlineInvocation(symbol, argument.position)
                permittedInlineReferences += reference!!
            }
            try { argument.visit(modifier = modifier.copy(isSkipGenerics = false)) }
            finally { if (reference != null) permittedInlineReferences.remove(reference) }
        }

        // use resolved type parameters in generic lambda arguments to resolve function type parameters
        inferTypeArgumentsFromOtherArguments(isSkipGenerics = false)
        argumentInfos = evaluateArguments()

        // check for mismatch generic parameters
        arguments.forEachIndexed { i, callArgument ->
            val functionArgumentType = argumentInfos[callArgumentMappedIndexes[i]].type
            if (!functionArgumentType.isConvertibleFrom(callArgument.type().toDataType())) {
                throw SemanticException(callArgument.position, "Call argument's type ${callArgument.type().descriptiveName()} cannot be mapped to type ${argumentInfos[callArgumentMappedIndexes[i]].type.descriptiveName}")
            }
        }

        // Like Kotlin, infer the remaining type arguments from the expected type,
        // e.g. `val karten: MutableList<Karte> = mutableListOf()`.
        val expectedType = expectedReturnType
        if (typeArguments.size != typeParameters.size && expectedType != null && declaredTypeArguments.isEmpty()) {
            val resolved = (inferredTypeArguments ?: typeParameters.map { null }).toMutableList()
            fun unify(declared: TypeNode, target: TypeNode) {
                val index = typeParameters.indexOfFirst { it.name == declared.name }
                if (index >= 0 && declared.arguments.isNullOrEmpty()) {
                    if (resolved[index] == null) resolved[index] = target.copy(isNullable = target.isNullable && !declared.isNullable)
                    return
                }
                val declaredArguments = declared.arguments ?: return
                val targetArguments = target.arguments ?: return
                if (declaredArguments.size == targetArguments.size) declaredArguments.indices.forEach { unify(declaredArguments[it], targetArguments[it]) }
            }
            unify(functionArgumentAndReturnTypeDeclarations.returnType, expectedType)
            inferredTypeArguments = resolved
            if (resolved.all { it != null }) {
                typeArgumentByName = typeParameters.indices.associate { typeParameters[it].name to resolved[it]!! }
            }
        }
        if (typeArguments.size != typeParameters.size) {
            val missing = (typeParameters.indices - (inferredTypeArguments?.withIndex()?.filter { it.value != null }?.map { it.index }?.toSet() ?: emptySet())).map { typeParameters[it].name }
            throw CannotInferTypeException(position, "type: ${missing.joinToString(", ")}")
        }
        functionArgumentAndReturnTypeDeclarations.typeParameters.zip(typeArguments).forEach { (parameter, argument) ->
            if (parameter.isReified && findErasedTypeParameter(argument) != null) {
                throw SemanticException(argument.position, "Cannot pass erased type parameter `${argument.name}` to reified type parameter")
            }
        }
        tpResolutions = typeArguments.mapIndexed { index, t ->
            typeParameters[index].name to t
        }.toMap().toMutableMap()
        tpUpperBounds.forEach {
            if (!it.value.isConvertibleFrom(tpResolutions[it.key]!!.toDataType())) {
                throw SemanticException(position, "Provided value arguments type ${tpResolutions[it.key]!!.toDataType().descriptiveName} are out of upper bound ${it.value.descriptiveName} of type parameter ${it.key}")
            }
        }
        log.v { "$functionRefName tpResolutions = ${tpResolutions.entries.joinToString(", ") { "${it.key} = ${it.value.descriptiveName()}" }}" }


        returnType = functionArgumentAndReturnTypeDeclarations.returnType!!.let { returnType ->
            if (callableType == CallableType.Constructor &&
                declaredTypeArguments.isEmpty() &&
                typeArgumentByName.any { it.key == returnType.name && returnType.arguments?.any { a -> a.name == it.key } == true }
                ) {
                /** not supported until {@link TypeInferenceTest#functionWithClassNameIsSameAsTypeParameterNameNested} is fixed */
                throw CannotInferTypeException(position, "type: " + typeArgumentByName.filter { it.key == returnType.name && returnType.arguments?.any { a -> a.name == it.key } == true }.keys.first())
            }

            if (callableType != CallableType.Constructor || declaredTypeArguments.isEmpty()) {
                returnType.resolveGenericParameterTypeArguments(typeArgumentByName)
            } else {
                /**
                 * not resolving generic parameters in order to support this case:
                 * ```
                 *   class T<T>
                 *   val o: T<T<T<Int>>> = T<T<T<Int>>>()
                 * ```
                 */
                TypeNode(returnType.position, returnType.name, typeArguments.emptyToNull(), false)
            }
        }

        log.d { "Function call $functionRefName returns ${returnType!!.descriptiveName()}" }

        popScope()

        // record types if there is any enclosing lambda
        evaluateAndRegisterReturnType(this)
    }

    fun FunctionValueParameterNode.generateTransformedName() {
        if (transformedRefName != null) return
        transformedRefName = "$name/${++variableDefIndex}" //"$name/${currentScope.scopeLevel}"
    }

    fun FunctionValueParameterNode.visit(modifier: Modifier = Modifier(), functionDeclarationNode: FunctionDeclarationNode?, isDeclareProperty: Boolean = true, overrideTransformedName: String? = null) {
        if (defaultValue is LambdaLiteralNode && type is FunctionTypeNode) {
            defaultValue.parameterTypesUpperBound = (type as FunctionTypeNode).parameterTypes
        }
        defaultValue?.visit(modifier = modifier)
        if (currentScope.hasProperty(name = name, isThisScopeOnly = true)) {
            throw SemanticException(position, "Property `$name` has already been declared")
        }
        if (defaultValue != null) {
            val valueType = defaultValue.type().toDataType()
            val subjectType = type.toDataType()
            if (!subjectType.isAssignableFrom(valueType)) {
                throw TypeMismatchException(position, subjectType.nameWithNullable, valueType.nameWithNullable)
            }
        }
        if (declaredType == null && inferredType == null) {
            throw SemanticException(position, "Cannot infer lambda parameter type")
        }
        if (isDeclareProperty) {
            val type = functionDeclarationNode?.resolveGenericParameterType(this) ?: type
            currentScope.declareProperty(position = position, name = name, type = type, isMutable = false)
            currentScope.assign(
                name,
                SemanticDummyRuntimeValue(currentScope.typeNodeToPropertyType(type, false)!!.type)
            )
            if (overrideTransformedName == null) {
                generateTransformedName()
            } else {
                transformedRefName = overrideTransformedName
            }
            currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, transformedRefName!!, name)
        }
    }

    fun FunctionCallArgumentNode.visit(modifier: Modifier = Modifier()) {
        value.visit(modifier = modifier)
    }

    fun BlockNode.visit(modifier: Modifier = Modifier()) {
        pushScope(
            scopeName = "<block>",
            scopeType = if (type == ScopeType.Function) ScopeType.FunctionBlock else type,
        )

        scopedSmartCasts {
            statements.forEachIndexed { i, it ->
                if (returnTypeUpperBound is FunctionTypeNode && i == statements.lastIndex && it is LambdaLiteralNode) {
                    val returnTypeUpperBound = returnTypeUpperBound as FunctionTypeNode
                    it.parameterTypesUpperBound = returnTypeUpperBound.parameterTypes
                    it.returnTypeUpperBound = returnTypeUpperBound.returnType
                }
                it.visit(modifier = modifier)
            }

            returnType = type()
        }

        popScope()
    }

    fun ReturnNode.visit(modifier: Modifier = Modifier()) {
        val target = callableContexts.asReversed().firstOrNull { context ->
            val lambda = context.node as? LambdaLiteralNode
            if (returnToLabel.isNotEmpty() && lambda?.labelName == returnToLabel) return@firstOrNull true
            if (lambda == null) {
                if (returnToLabel.isNotEmpty()) throw SemanticException(position, "Return label `$returnToLabel` not found")
                return@firstOrNull true
            }
            if (!lambda.permitsNonLocalReturn) {
                throw SemanticException(position, "Non-local return is only allowed through inline lambda parameters (not noinline/crossinline)")
            }
            false
        } ?: throw SemanticException(position, "`return` statement should be within a function")
        returnToAddress = target.node.returnTargetId
        isNonLocal = target !== callableContexts.last()
        if (target !== callableContexts.last() && symbolRecorders.isNotEmpty()) {
            symbolRecorders.last().returnTargets += returnToAddress
        }
        val declaredReturnType = target.returnType
        if (declaredReturnType is FunctionType && value is LambdaLiteralNode) {
            value.parameterTypesUpperBound = declaredReturnType.arguments.map { it.toTypeNode() }
            value.returnTypeUpperBound = declaredReturnType.returnType.toTypeNode()
        }

        value?.visit(modifier = modifier)
        val valueType = value?.type()?.toDataType() ?: UnitType()
        if (declaredReturnType != null && valueType !is NothingType && !declaredReturnType.isAssignableFrom(valueType)) {
            throw TypeMismatchException(position, declaredReturnType.descriptiveName, valueType.descriptiveName)
        }
    }

    fun checkBreakOrContinueScope(statement: ASTNode) {
        var s: SymbolTable = currentScope
        while (!s.scopeType.isLoop()) {
            if (s.scopeType in setOf(ScopeType.Script, ScopeType.Function) || s.parentScope == null) {
                throw SemanticException(statement.position, "`break` statement should be within a loop")
            }
            s = s.parentScope!!
        }
    }

    fun BreakNode.visit(modifier: Modifier = Modifier()) {
        checkBreakOrContinueScope(this)
    }

    fun ContinueNode.visit(modifier: Modifier = Modifier()) {
        checkBreakOrContinueScope(this)
    }

    fun IfNode.visit(modifier: Modifier = Modifier()) {
        condition.visit(modifier = modifier)
        val whenTrue = smartCastsWhenTrue(condition)
        val whenFalse = smartCastsWhenFalse(condition)
        withSmartCasts(whenTrue) { trueBlock?.visit(modifier = modifier) }
        withSmartCasts(whenFalse) { falseBlock?.visit(modifier = modifier) }

        // After `if (value == null) return ...`, Kotlin smart-casts value
        // for the remainder of the surrounding block (see BlockNode.visit).
        val trueBlockNeverCompletes = blockNeverCompletes(trueBlock)
        val falseBlockNeverCompletes = blockNeverCompletes(falseBlock)
        if (trueBlockNeverCompletes && !falseBlockNeverCompletes) addSmartCasts(whenFalse)
        if (falseBlockNeverCompletes && !trueBlockNeverCompletes) addSmartCasts(whenTrue)
    }

    fun WhileNode.visit(modifier: Modifier = Modifier()) {
        condition.visit(modifier = modifier)
        withSmartCasts(smartCastsWhenTrue(condition)) { body?.visit(modifier = modifier) }
    }

    fun DoWhileNode.visit(modifier: Modifier = Modifier()) {
        condition.visit(modifier = modifier)
        body?.visit(modifier = modifier)
    }

    fun NavigationNode.visit(modifier: Modifier = Modifier(), lookupType: IdentifierClassifier = IdentifierClassifier.Property, isCheckWriteAccess: Boolean = false): DataType {
        if (lookupType == IdentifierClassifier.Property && (subject as? VariableReferenceNode)?.variableName == "this") {
            noteSelfCallingAccessor(member.position, member.name, isWrite = isCheckWriteAccess, scopeLevel = null)
        }
        val found = visitMember(modifier, lookupType, isCheckWriteAccess)
        // `.` on a nullable receiver finds a member of the non-null type only
        // as a last resort (see visitMember): Kotlin rejects that as unsafe
        // instead of calling the member unknown.
        val receiverType = subject.type().unboxClassTypeAsCompanion().toDataType()
        if (operator == "." && receiverType.isNullable && !found.isNullable) {
            if (isForLoopIterator) {
                throw SemanticException(position, "Non-nullable value required to call 'iterator()' method in a for-loop.")
            }
            throw SemanticException(position, "Only safe (?.) or non-null asserted (!!.) calls are allowed on a nullable receiver of type '${subject.type().unboxClassTypeAsCompanion().descriptiveName()}'.")
        }
        return found
    }

    private fun NavigationNode.visitMember(modifier: Modifier, lookupType: IdentifierClassifier, isCheckWriteAccess: Boolean): DataType {
        subject.visit(modifier = modifier)

        member.visit(modifier = modifier)

        // find member
        val subjectType = subject.type().unboxClassTypeAsCompanion().toDataType()
        log.v { "NavigationNode pos=${position} member=${member.name} subjectType = ${subjectType.descriptiveName} ${subjectType.nameWithNullable} ${subjectType.isNullable}" }
        val subjectTypesToSearch = if (operator == "?." && subjectType.isNullable) {
            listOf(subjectType.copyOf(isNullable = false), subjectType)
        } else if (subjectType.isNullable) {
            listOf(subjectType, subjectType.copyOf(isNullable = false))
        } else {
            listOf(subjectType)
        }

        val memberName = member.name

        for (subjectType in subjectTypesToSearch) {
            val clazz = subjectType.resolveTypeParameterAsUpperBound().nameWithNullable
                .let {
                    currentScope.findClass(it)
                        ?: throw RuntimeException("Cannot find class `$it`")
                }
                .first
            if (lookupType == IdentifierClassifier.Property) {
                clazz.findMemberPropertyWithoutAccessor(memberName)?.let { property ->
                    if (clazz.isPrivateMemberProperty(memberName) && currentClassName() != clazz.findMemberPropertyOwnerName(memberName)) {
                        throw SemanticException(position, "Private property `$memberName` cannot be accessed here")
                    }
                    if (isCheckWriteAccess && !property.isMutable) {
                        throw SemanticException(position, "val `$memberName` cannot be reassigned")
                    }
                    memberType = NavigationNode.MemberType.Direct
                    return subjectType
                }
                clazz.findMemberPropertyCustomAccessor(memberName)?.let { accessor ->
                    if (clazz.isPrivateMemberProperty(memberName) && currentClassName() != clazz.findMemberPropertyOwnerName(memberName)) {
                        throw SemanticException(position, "Private property `$memberName` cannot be accessed here")
                    }
                    if (isCheckWriteAccess && clazz.findMemberProperty(memberName)?.isMutable == false) {
                        throw SemanticException(position, "val `$memberName` cannot be reassigned")
                    }
                    if (isCheckWriteAccess) {
                        if (accessor.setterIsPrivate && currentClassName() != clazz.findMemberPropertyOwnerName(memberName)) {
                            throw SemanticException(position, "Private setter for `$memberName` cannot be accessed here")
                        }
                        if (accessor.setter == null && accessor.getter == null) {
                            throw SemanticException(position, "Setter for `$memberName` is not declared")
                        }
                    } else if (accessor.getter == null && accessor.setter == null) {
                        throw SemanticException(position, "Getter for `$memberName` is not declared")
                    }
                    memberType = NavigationNode.MemberType.Direct
                    return subjectType
                }
                if (clazz.fullQualifiedName.endsWith(".Companion") && !subjectType.isNullable) {
                    val originalClassName = clazz.fullQualifiedName.removeSuffix(".Companion")
                    val originalClass = currentScope.findClass(originalClassName)?.first
                        ?: throw RuntimeException("Cannot find class $originalClassName")

                    if (ClassModifier.enum in originalClass.modifiers && originalClass.enumValues.containsKey(memberName)) {
                        memberType = NavigationNode.MemberType.Enum
                        return subjectType
                    }
                }
                val resolvedSubjectType = subjectType.toTypeNode()
//                .let {
//                    if (subject is ClassInstance) {
//                        it.resolveGenericParameterTypeArguments(subject.typeArgumentByName.mapValues { it.value.toTypeNode() })
//                    } else {
//                        it
//                    }
//                }
                currentScope.findExtensionPropertyByDeclarationIncludingSuperClasses(resolvedSubjectType, memberName)
                    ?.let {
                        if (isCheckWriteAccess && it.second.setter == null) {
                            throw SemanticException(position, "Setter for `$memberName` is not declared")
                        } else if (!isCheckWriteAccess && it.second.getter == null) {
                            throw SemanticException(position, "Getter for `$memberName` is not declared")
                        }
                        transformedRefName = it.first
                        memberType = NavigationNode.MemberType.Extension
                        return subjectType
                    }
            } else {
                val functions = clazz.findMemberFunctionsWithEnclosingTypeNameByDeclaredName(memberName)
                if (functions.isNotEmpty()) {
                    // A private member function is only callable from code of its own class.
                    if (functions.values.all { (function, owner) -> FunctionModifier.private in function.modifiers && owner != currentClassName() }) {
                        throw SemanticException(position, "Private function `$memberName` cannot be accessed here")
                    }
                    memberType = NavigationNode.MemberType.Direct
                    return subjectType
                }
                if (currentScope.findExtensionFunctionsIncludingSuperClasses(subjectType, memberName).isNotEmpty()) {
                    memberType = NavigationNode.MemberType.Extension
                    return subjectType
                }
            }
        }
        throw SemanticException(position, "Type `${subjectType.descriptiveName}` has no member `$memberName`")
    }

    fun IndexOpNode.visit(modifier: Modifier = Modifier(), isWriteOnly: Boolean = false) {
        if (hasFunctionCall != null) {
            return
        }
        if (isWriteOnly) {
            subject.visit(modifier)
            arguments.forEach {
                visit(modifier)
                type()
            }
            hasFunctionCall = false
        } else {
            hasFunctionCall = true
            call = FunctionCallNode(
                function = NavigationNode(position, subject, ".", ClassMemberReferenceNode(position, "get")),
                arguments = arguments.mapIndexed { index, it -> FunctionCallArgumentNode(it.position, index = index, value = it) },
                declaredTypeArguments = emptyList(),
                position = position,
                modifierFilter = SearchFunctionModifier.OperatorFunctionOnly,
            )
            call!!.visit(modifier)
        }
    }

    fun ClassDeclarationNode.visit(modifier: Modifier = Modifier()) {
        val previousReified = activeReifiedTypeParameters.toMap()
        typeParameters.forEach { activeReifiedTypeParameters[it.name] = false }
        try { visitClassBody(modifier) } finally {
            activeReifiedTypeParameters.clear()
            activeReifiedTypeParameters.putAll(previousReified)
        }
    }

    private fun nullableClassDefinition(node: ClassDeclarationNode) = ClassDefinition(
        currentScope = currentScope,
        name = "${node.name}?",
        fullQualifiedName = "${node.fullQualifiedName}?",
        isInterface = node.isInterface,
        modifiers = emptySet(),
        typeParameters = node.typeParameters,
        isInstanceCreationAllowed = false,
        orderedInitializersAndPropertyDeclarations = emptyList(),
        declarations = emptyList(),
        rawMemberProperties = emptyList(),
        memberFunctions = emptyList(),
        primaryConstructor = null,
    )

    private fun companionClassDefinition(node: ClassDeclarationNode, classType: TypeNode) = ClassDefinition(
        currentScope = currentScope,
        name = "${node.name}.Companion",
        fullQualifiedName = "${node.fullQualifiedName}.Companion",
        modifiers = emptySet(),
        typeParameters = emptyList(),
        isInstanceCreationAllowed = false,
        orderedInitializersAndPropertyDeclarations = emptyList(),
        declarations = emptyList(),
        rawMemberProperties = emptyList(),
        memberFunctions = buildList {
            if (ClassModifier.enum in node.modifiers) {
                add(CustomFunctionDeclarationNode(CustomFunctionDefinition(
                    position = node.position,
                    receiverType = "${node.fullQualifiedName}.Companion",
                    functionName = "valueOf",
                    returnType = classType.descriptiveName(),
                    parameterTypes = listOf(CustomFunctionParameter("value", "String")),
                    executable = { interpreter, receiver, args, typeArgs ->
                        throw NotImplementedError()
                    }
                )))
            }
        },
        primaryConstructor = null,
    )

    private fun ClassDeclarationNode.visitClassBody(modifier: Modifier) {
        if (typeParameters.any { it.isReified }) throw SemanticException(position, "Class type parameters cannot be reified")
        if (position in cyclicClasses) {
            throw SemanticException(superInvocations?.firstOrNull()?.position ?: position, "There is a cycle in the inheritance hierarchy of `$name`")
        }
        val fullQualifiedClassName = fullQualifiedName
        val classType = TypeNode(
            position = position,
            name = fullQualifiedClassName,
            arguments = typeParameters.map { TypeNode(it.position, it.name, null, false) }.emptyToNull(),
            isNullable = false,
        )

        val declarationScope = currentScope

        if (ClassModifier.enum in modifiers) {
            if (ClassModifier.open in modifiers) {
                throw SemanticException(position, "An enum class cannot be applied with an 'open' modifier")
            }
            if (!superInvocations.isNullOrEmpty()) {
                throw SemanticException(position, "Enum class cannot inherit classes or interfaces")
            }
        }
        if (ClassModifier.abstract in modifiers) {
            inferredModifiers += ClassModifier.open
        }
        if (isInterface) {
            val unsupportedModifiers = modifiers - setOf(ClassModifier.abstract, ClassModifier.open)
            if (unsupportedModifiers.isNotEmpty()) {
                throw SemanticException(position, "Modifiers ${unsupportedModifiers.joinToString(", ")} are not applicable to interfaces")
            }
            inferredModifiers += ClassModifier.open
            inferredModifiers += ClassModifier.abstract
        }

        val declared = declaredClasses[position]?.takeIf { it.node === this }
        if (declared == null) {
            declarationScope.declareClass(position, nullableClassDefinition(this).also { it.attachToSemanticAnalyzer(this@SemanticAnalyzer) })
            declarationScope.declareClass(position, companionClassDefinition(this, classType).also { it.attachToSemanticAnalyzer(this@SemanticAnalyzer) })
        } else {
            declared.companion.attachToSemanticAnalyzer(this@SemanticAnalyzer)
        }
        // A class declared ahead reuses the scopes its definition was created with.
        fun pushClassScope(index: Int) {
            if (declared != null) pushScope(declared.scopes[index]) else pushScope(name, ScopeType.Class)
        }

        if (ClassModifier.enum in modifiers) {
            ExtensionProperty(
                declaredName = "entries",
                receiver = "$fullQualifiedClassName.Companion",
                type = "List<${classType.descriptiveName()}>",
                getter = { _, _, _ -> throw NotImplementedError() }
            ).also {
                it.generateTransformedName()
                symbolTable.declareExtensionProperty(position, it.transformedName!!, it)
                executionEnvironment.registerGeneratedMapping(
                    type = ExecutionEnvironment.SymbolType.ExtensionProperty,
                    receiverType = it.receiver,
                    name = it.declaredName,
                    transformedName = it.transformedName!!,
                )
            }
        }

        pushClassScope(0)
        // copy this class's type parameter to superclass scope, so that
        // generic types in superclass can be resolved when it returns to this class.
        // declared type parameters here will be overwritten in this class's scope
        typeParameters.forEach {
            currentScope.declareTypeAlias(it.position, it.name, it.typeUpperBound)
        }

        val interfaceInvocations: List<TypeNode>
        val superClassInvocation: FunctionCallNode?
        if (isInterface) {
            superInvocations?.firstOrNull { it is FunctionCallNode }
                ?.let {
                    throw SemanticException(it.position, "Interface cannot inherit a class")
                }
            interfaceInvocations = superInvocations?.filterIsInstance<TypeNode>() ?: emptyList()
            superClassInvocation = null
        } else {
            val superClassInvocations = superInvocations?.filterIsInstance<FunctionCallNode>()
            if ((superClassInvocations?.size ?: 0) > 1) {
                throw SemanticException(superClassInvocations!![1].position, "A class can only inherit at most one other class")
            }
            interfaceInvocations = superInvocations?.filterIsInstance<TypeNode>() ?: emptyList()
            superClassInvocation = superClassInvocations?.firstOrNull()
        }

        pushClassScope(1)
        val superClassScope = currentScope
        val superClass = (superClassInvocation?.function as? TypeNode)
            ?.let { declarationScope.findClass(it.name) ?: throw RuntimeException("Super class `${it.name}` not found") }
            ?.first
            ?.also { if (it.isInterface) throw SemanticException(superClassInvocation!!.position, "Interface cannot be constructed") }
        if (superClass != null && ClassModifier.open !in superClass.modifiers) {
            throw SemanticException(superClassInvocation!!.position, "A class can only extend from an open class")
        }
        val superInterfaces = interfaceInvocations.map {
            val clazz = currentScope.findClass(it.name)?.first
                ?: throw SemanticException(it.position, "Interface ${it.name} cannot be found")
            if (!clazz.isInterface) {
                throw SemanticException(it.position, "${it.name} is not an interface")
            }
            clazz
        }
        val superClassProperties = superClass?.getAllMemberProperties()

        fun checkForOverriddenProperties(property: PropertyDeclarationNode) {
            if (superClassProperties?.containsKey(property.name) == true) {
                if (PropertyModifier.override !in property.modifiers) {
                    throw SemanticException(property.position, "A property cannot override anything without the `override` modifier")
                }
                if (superClass.findDeclarations { _, it ->
                    it is PropertyDeclarationNode && it.name == property.name
                }.any { PropertyModifier.open !in (it as PropertyDeclarationNode).modifiers }) {
                    throw SemanticException(property.position, "A property can only override another property marked as `open`")
                }
            } else {
                if (PropertyModifier.override in property.modifiers) {
                    throw SemanticException(property.position, "Property `${property.name}` overrides nothing")
                }
            }
        }

        pushClassScope(2)
        run {
            var numExtraSuperScopes = 0

            typeParameters.forEach {
                currentScope.declareTypeAlias(it.position, it.name, it.typeUpperBound)
            }
            primaryConstructor?.visit(modifier = modifier)
            superClassInvocation?.visit(modifier = modifier, isSuperClassInvocation = true)

            val currentClassScope = currentScope

            if (superClassInvocation != null) {
                popScope()

                val type = superClassInvocation.type()
                val superClassMemberResolver = ClassMemberResolver.create(superClassScope, superClass!!, type.arguments ?: emptyList())
                superClassMemberResolver?.forEachSuperClassesFromRoot { index, clazz, typeResolutions, typeUpperBounds ->
                    pushScope(clazz.fullQualifiedName, ScopeType.Class)
                    ++numExtraSuperScopes
                    clazz.currentScope?.let { currentScope.mergeDeclarationsFrom(position, it, typeResolutions) }
                    log.d { "scope [$index]. ${clazz.fullQualifiedName}" }
                    currentScope.printSymbolTableStack()
                }

                // "push" `currentClassScope` to the top
                pushScope(currentClassScope)
            }

            if (isInterface) {
                if (primaryConstructor != null) {
                    throw SemanticException(primaryConstructor.position, "Interface cannot have a constructor")
                }
                declarations.forEach {
                    when (it) {
                        is FunctionDeclarationNode -> if (it.body != null) {
                            throw SemanticException(it.position, "Concrete functions in interfaces are not supported")
                        } else {
                            it.inferredModifiers += FunctionModifier.abstract
                            it.inferredModifiers += FunctionModifier.open
                        }
                        is PropertyDeclarationNode -> throw SemanticException(it.position, "Properties in interfaces are not supported")
                        else -> throw SemanticException(it.position, "Declarations other than abstract functions in interfaces are not supported")
                    }
                }
            }

            val nonPropertyArguments = primaryConstructor?.parameters
                ?.filter { !it.isProperty }
            primaryConstructor?.parameters?.forEach {
                currentScope.undeclareProperty(it.parameter.name)
                currentScope.unregisterTransformedSymbol(IdentifierClassifier.Property, it.parameter.transformedRefName!!, it.parameter.name)
            }
            primaryConstructor?.parameters
                ?.filter { it.isProperty }
                ?.forEach {
                    val p = it.parameter
                    currentScope.declareProperty(position = p.position, name = p.name, type = p.type, isMutable = it.isMutable)
                    currentScope.registerTransformedSymbol(
                        position = p.position,
                        identifierClassifier = IdentifierClassifier.Property,
                        transformedName = p.transformedRefName!!,
                        originalName = p.name
                    )
                    currentScope.assign(p.name, SemanticDummyRuntimeValue(currentScope.getPropertyType(p.name).first.type))
                }

            val constructorProperties = primaryConstructor?.parameters
                ?.filter { it.isProperty }
                ?.map {
                    val p = it.parameter
                    PropertyDeclarationNode(
                        position = p.position,
                        name = p.name,
                        declaredModifiers = it.modifiers,
                        typeParameters = emptyList(),
                        receiver = classType,
                        declaredType = p.type,
                        isMutable = it.isMutable,
                        initialValue = p.defaultValue,
                        transformedRefName = p.transformedRefName,
                    ).also { checkForOverriddenProperties(it) }
                } ?: emptyList() /* intentionally exclude non-constructor property declarations, in order to allow inferring types */
            val classDefinition = if (declared != null) {
                if (declared.definition.superClass !== superClass) {
                    throw RuntimeException("Declared superclass of `$fullQualifiedName` changed during analysis")
                }
                declared.definition.also { definition ->
                    constructorProperties.forEach { definition.addProperty(currentScope, it) }
                }
            } else {
                ClassDefinition(
                    currentScope = currentScope!!,
                    name = name,
                    fullQualifiedName = fullQualifiedName,
                    isInterface = isInterface,
                    modifiers = modifiers,
                    typeParameters = typeParameters,
                    isInstanceCreationAllowed = !isInterface,
                    primaryConstructor = primaryConstructor,
                    rawMemberProperties = constructorProperties,
                    memberFunctions = declarations
                        .filterIsInstance<FunctionDeclarationNode>().filterNot { it is ClassSecondaryConstructorNode },
                    orderedInitializersAndPropertyDeclarations = declarations
                        .filter { it is ClassInstanceInitializerNode || it is PropertyDeclarationNode },
                    declarations = declarations,
                    superClassInvocation = superClassInvocation,
                    superClass = superClass,
                    superInterfaceTypes = interfaceInvocations,
                    superInterfaces = superInterfaces,
                ).also { declarationScope.declareClass(position, it) }
            }
            classDefinition.attachToSemanticAnalyzer(this@SemanticAnalyzer)

            // define an empty class for ClassMemberResolver's use to resolve functions from superclasses and
            // interfaces, not to resolve members from current class
            val emptyClassDefinition = classDefinition.copyAsEmptyClass()
            val classMemberResolver = ClassMemberResolver.create(currentScope, emptyClassDefinition, null)

            // typeParameters.map { it.typeUpperBound ?: TypeNode("Any", null, true) }.emptyToNull()
            val pseudoTypeArguments = typeParameters.map { TypeNode(it.position, it.name, null, false) }.emptyToNull()
            currentScope.declareProperty(position, "this", TypeNode(SourcePosition.NONE, name, pseudoTypeArguments, false), false)
//            currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, "this", "this")
            currentScope.declareProperty(position, "this/${fullQualifiedClassName}", TypeNode(SourcePosition.NONE, name, pseudoTypeArguments, false), false)
            currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, "this/${fullQualifiedClassName}", "this")

            classDefinition.superClassInvocation?.let { superClassInvocation ->
                currentScope.declareProperty(position, "super", superClassInvocation.type(), false)
                currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, "super", "super")
            }

            primaryConstructor?.parameters
                ?.filter { it.isProperty }
                ?.map { it.parameter }
                ?.forEach { currentScope.declarePropertyOwner(it.transformedRefName!!, "this/$fullQualifiedClassName") }
            // Like Kotlin: a property needs a value unless an init block assigns it
            // (the latter is checked at runtime) or a getter computes it.
            if (declarations.none { it is ClassInstanceInitializerNode }) {
                declarations.filterIsInstance<PropertyDeclarationNode>()
                    .firstOrNull { it.initialValue == null && it.accessors?.getter == null }
                    ?.let { throw SemanticException(it.position, "Property `${it.name}` must be initialized") }
            }
            declarations.filter { it is ClassInstanceInitializerNode || it is PropertyDeclarationNode }
                .forEach {
                    pushScope("init-property", ScopeType.ClassInitializer)
                    nonPropertyArguments?.forEach {
                        val parameterForClassBody = it.parameter.copy()
                        parameterForClassBody.visit(modifier = modifier, null /* TODO support generic class */, overrideTransformedName = it.parameter.transformedRefName)
                        it.transformedRefNameInBody = parameterForClassBody.transformedRefName
                    }
                    pushScope("init-property-inner", ScopeType.ClassInitializer)
                    if (it is PropertyDeclarationNode) {
                        // Accessors are analyzed with the class members below, not
                        // where constructor parameters are visible.
                        it.visit(modifier = modifier, isClassProperty = true, isVisitAccessors = false)
                    } else {
                        it.visit(modifier = modifier)
                    }
                    popScope()
                    popScope()
                    if (it is PropertyDeclarationNode) {
                        it.visit(modifier = modifier, isVisitInitialValue = false, isClassProperty = true)
                        checkForOverriddenProperties(it)
                        currentScope.declarePropertyOwner(it.transformedRefName!!, "this/$fullQualifiedClassName")
                        classDefinition.addProperty(currentScope, it)
                    }
                }

            declarations.filterIsInstance<FunctionDeclarationNode>()
                .forEach {
//                    it.transformedRefName = "${it.name}/${++functionDefIndex}"
//                    if (it.transformedRefName == null) {
//                        it.transformedRefName = it.toSignature(currentScope)
//                    }
                    currentScope.declareFunctionOwner(it.name, it, "this/$fullQualifiedClassName")
                }

            // Like member functions, accessors may use every property and
            // function of the class, including those declared further below.
            declarations.filterIsInstance<PropertyDeclarationNode>().forEach { property ->
                property.accessors?.let { accessors ->
                    // Each accessor declares its own `get`/`set`; keep them apart.
                    pushScope("property-accessor", ScopeType.ClassInitializer)
                    accessors.getter?.let { getter -> visitAccessor(property, isSetter = false) { getter.visit(modifier = modifier, isPropertyAccessor = true, propertyAccessorType = accessors.type) } }
                    popScope()
                    pushScope("property-accessor", ScopeType.ClassInitializer)
                    accessors.setter?.let { setter -> visitAccessor(property, isSetter = true) { setter.visit(modifier = modifier, isPropertyAccessor = true, propertyAccessorType = accessors.type) } }
                    popScope()
                }
            }

            declarations.filterIsInstance<FunctionDeclarationNode>()
                .forEach { thisFunc ->
                    // TODO these are duplicating with ClassSemanticAnalyzer and ClassDefinition. Refactor these
                    val superClassFunctions = classMemberResolver?.findMemberFunctionsAndExactTypesByDeclaredName(thisFunc.name) ?: emptyMap()
                    val identicalSuperClassFunctions: Collection<FunctionAndTypes> = superClassFunctions.filter {
                        it.value.resolvedValueParameterTypes.size == thisFunc.valueParameters.size
                            && it.value.resolvedValueParameterTypes.withIndex().all {
                                it.value.type == thisFunc.valueParameters[it.index].type
                            }
                    }.values

                    thisFunc.visit(modifier = modifier, isClassMemberFunction = true)

                    // check type after type inference
                    identicalSuperClassFunctions.forEach { superFunc ->
                        if (currentScope.assertToDataType(thisFunc.returnType) != currentScope.assertToDataType(superFunc.resolvedReturnType)) {
                            throw SemanticException(thisFunc.position, "Return type of function `${thisFunc.name}` `${thisFunc.returnType.descriptiveName()}` is not the same as the overridden one `${superFunc.resolvedReturnType.descriptiveName()}`")
                        }
                    }
                }

            ClassSemanticAnalyzer(symbolTable = currentScope, position = position, classDefinition = classDefinition)
                .check()

            // enum
            val knownEnumNames = mutableSetOf<String>()
            enumEntries.forEach {
                if (knownEnumNames.contains(it.name)) {
                    throw SemanticException(it.position, "Enum entry `${it.name}` for class `${classDefinition.fullQualifiedName}` is duplicated")
                }
                it.visit(modifier = modifier, classDefinition.fullQualifiedName)
                knownEnumNames += it.name
            }
            classDefinition.enumValues = enumEntries.associate {
                it.name to ClassInstance(currentScope, classDefinition.fullQualifiedName, classDefinition, emptyList())
            }

            (1..numExtraSuperScopes).forEach { popScope() }
        }
        popScope()
        popScope()
        popScope()

        if (currentScope !== declarationScope) {
            throw RuntimeException("Original scope is not restored")
        }
    }

    fun ClassPrimaryConstructorNode.visit(modifier: Modifier = Modifier()) {
        parameters.forEach { it.visit(modifier = modifier) }
    }

    fun ClassParameterNode.visit(modifier: Modifier = Modifier()) {
        parameter.visit(modifier = modifier, null /* TODO generic class */)
    }

    fun ClassInstanceInitializerNode.visit(modifier: Modifier = Modifier()) {
        block.visit(modifier = modifier)
    }

    fun ClassMemberReferenceNode.visit(modifier: Modifier = Modifier()) {
        // TODO check for write access
        // check for existence and return error
        try {
            val l = checkPropertyReadAccess(this, name)
            if (transformedRefName == null) {
                transformedRefName = "$name/$l"
            }
        } catch (_: SemanticException) {}
    }

    fun StringNode.visit(modifier: Modifier = Modifier()) {
        nodes.forEach { it.visit(modifier = modifier) }
    }

    fun LambdaLiteralNode.visit(modifier: Modifier = Modifier()) {
        if (modifier.isSkipGenerics) return
        // A lambda may run after a `var` was reassigned, so only stable variables stay narrowed inside it.
        scopedSmartCasts {
            smartCasts.values.removeAll { it.isMutable }
            visitLambda(modifier)
        }
    }

    private fun LambdaLiteralNode.visitLambda(modifier: Modifier) {
//        val type = type() as FunctionTypeNode

        symbolRecorders += SymbolReferenceSet(scopeLevel = currentScope.scopeLevel)
        pushScope(
            scopeName = labelName?.let { "$it@" } ?: "<lambda>",
            scopeType = ScopeType.Closure,
            returnType = returnTypeUpperBound?.toDataType() //type.returnType.toDataType(),
        )

        if (parameterTypesUpperBound != null) {
            if (valueParameters.size != parameterTypesUpperBound!!.size) {
                throw SemanticException(position, "Lambda argument count is different from function parameter declaration.")
            }
            valueParameters.forEachIndexed { i, lambdaParameterNode ->
                if (lambdaParameterNode.declaredType == null) {
                    lambdaParameterNode.inferredType = parameterTypesUpperBound!![i]
                }
            }
        }

        if (receiverType != null) {
            copyReceiverIntoCurrentScope(position = position, receiver = receiverType!!, typeParameters = emptyList())
        }

        valueParameters.forEach {
            if (it.name != "_") {
                it.visit(modifier = modifier, null)
            }
        }
        // TODO provide receiver to scope if exists

        body.returnTypeUpperBound = returnTypeUpperBound
        callableContexts += CallableContext(this, returnTypeUpperBound?.toDataType() ?: AnyType(true))
        try { body.visit(modifier = modifier) } finally { callableContexts.removeLast() }

        if (returnTypeUpperBound?.name != "Unit" && body.type().name != "Nothing" && returnTypeUpperBound?.toDataType()?.isConvertibleFrom(body.type().toDataType()) == false) {
            throw SemanticException(position, "Lambda return type ${body.type().descriptiveName()} cannot be converted to ${returnTypeUpperBound!!.descriptiveName()}")
        }

        popScope()
        this.accessedRefs = symbolRecorders.removeLast()
        if (symbolRecorders.isNotEmpty()) {
            val symbols = symbolRecorders.last()
            symbols.properties += this.accessedRefs!!.properties
                .filter {
                    currentScope.findTransformedSymbol(IdentifierClassifier.Property, it)?.second?.scopeLevel?.let {
                        isLocalAndNotCurrentScope(it)
                    } ?: false
                }
            symbols.functions += this.accessedRefs!!.functions
                .filter {
                    currentScope.findTransformedSymbol(IdentifierClassifier.Function, it)?.second?.scopeLevel?.let {
                        isLocalAndNotCurrentScope(it)
                    } ?: false
                }
            symbols.extensionFunctions += this.accessedRefs!!.extensionFunctions
                .filter {
                    currentScope.findTransformedSymbol(IdentifierClassifier.Function, it)?.second?.scopeLevel?.let {
                        isLocalAndNotCurrentScope(it)
                    } ?: false
                }
            symbols.returnTargets += this.accessedRefs!!.returnTargets.filter { it != callableContexts.lastOrNull()?.node?.returnTargetId }
            symbols.classes += this.accessedRefs!!.classes
            symbols.typeAlias += this.accessedRefs!!.typeAlias
        }
        type()
    }

    fun AsOpNode.visit(modifier: Modifier = Modifier()) {
        this.expression.visit(modifier = modifier)
        this.type.visit(modifier = modifier)
    }

    fun assertInOperatorCall(modifier: Modifier = Modifier(), position: SourcePosition, subject: ASTNode, iterable: ASTNode): FunctionCallNode {
        val type1 = subject.type().toDataType()
        val type2 = iterable.type().toDataType()

        if (currentScope.findMatchingCallables(
                currentSymbolTable = currentScope,
                originalName = "contains",
                receiverType = type2,
                arguments = listOf(FunctionCallArgumentInfo(name = null, type = type1)),
                modifierFilter = SearchFunctionModifier.OperatorFunctionOnly,
            ).isNotEmpty()
        ) {
            return FunctionCallNode(
                function = NavigationNode(position, iterable, ".", ClassMemberReferenceNode(position, "contains")),
                arguments = listOf(FunctionCallArgumentNode(position = subject.position, index = 0, value = subject)),
                declaredTypeArguments = emptyList(),
                position = position,
                modifierFilter = SearchFunctionModifier.OperatorFunctionOnly,
            ).also { it.visit(modifier = modifier) }
        } else {
            throw SemanticException(position, "Operator function `contains` for type ${type2.descriptiveName} not found.")
        }
    }

    fun InfixFunctionCallNode.visit(modifier: Modifier = Modifier()) {
        this.node1.visit(modifier = modifier)
        this.node2.visit(modifier = modifier)

        when (functionName) {
            in setOf("to") -> {}
            in setOf("is", "!is") -> {
                val testedType = node2 as? TypeNode
                    ?: throw SemanticException(node2.position, "Type test requires a type")
                if (testedType.arguments.orEmpty().any { it.name != "*" }) {
                    val target = testedType.toDataType() as? ObjectType
                    val source = node1.type().toDataType() as? ObjectType
                    val known = if (target != null && source != null) {
                        val corresponding = if (source.name == target.name) source else source.findSuperType(target.name)
                        corresponding != null && target.copyOf(true).isAssignableFrom(corresponding)
                    } else false
                    if (!known) throw SemanticException(testedType.position, "Cannot check for instance of erased type `${testedType.descriptiveName()}`; use star projections")
                }
                if (currentScope.findTypeAlias(testedType.name) != null && activeReifiedTypeParameters[testedType.name] != true) {
                    throw SemanticException(testedType.position, "Cannot check for instance of erased type parameter `${testedType.name}`; make it reified")
                }
            }
            in setOf("in", "!in") -> {
                call = assertInOperatorCall(modifier = modifier, position = position, subject = node1, iterable = node2)
            }
            else -> {
                val type1 = node1.type().toDataType()
                val type2 = node2.type().toDataType()

                if (currentScope.findMatchingCallables(
                        currentSymbolTable = currentScope,
                        originalName = functionName,
                        receiverType = type1,
                        arguments = listOf(FunctionCallArgumentInfo(name = null, type = type2)),
                        modifierFilter = SearchFunctionModifier.InfixFunctionOnly,
                    ).isNotEmpty()
                ) {
                    call = FunctionCallNode(
                        function = NavigationNode(position, node1, ".", ClassMemberReferenceNode(position, functionName)),
                        arguments = listOf(FunctionCallArgumentNode(position = node2.position, index = 0, value = node2)),
                        declaredTypeArguments = emptyList(),
                        position = position,
                        modifierFilter = SearchFunctionModifier.InfixFunctionOnly,
                    ).also { it.visit(modifier = modifier) }
                } else {
                    throw SemanticException(position, "Infix function `$functionName` for type ${type1.descriptiveName} not found.")
                }
            }
        }

        type()
    }

    fun ElvisOpNode.visit(modifier: Modifier = Modifier()) {
        this.primaryNode.visit(modifier = modifier)
        this.fallbackNode.visit(modifier = modifier)

        type()
    }

    fun ThrowNode.visit(modifier: Modifier = Modifier()) {
        this.value.visit(modifier = modifier)
        val type = this.value.type()
        if (!typeRegistry["Throwable"]!!.toDataType().isAssignableFrom(type.toDataType())) {
            throw SemanticException(value.position, "Expression type ${type.descriptiveName()} is not a throwable value")
        }
    }

    fun CatchNode.visit(modifier: Modifier = Modifier()) {
        if (!typeRegistry["Throwable"]!!.toDataType().isAssignableFrom(catchType.toDataType())) {
            throw SemanticException(catchType.position, "${catchType.descriptiveName()} is not a throwable value")
        }

        pushScope(
            scopeName = "<catch>",
            scopeType = ScopeType.ExtraWrap,
            returnType = null,
        )

        if (valueName != "_") {
            currentScope.declareProperty(position = position, name = valueName, type = catchType, isMutable = false)
            currentScope.assign(
                name = valueName,
                value = SemanticDummyRuntimeValue(currentScope.typeNodeToPropertyType(catchType, false)!!.type)
            )
            valueTransformedRefName = "$valueName/${currentScope.scopeLevel}"
            currentScope.registerTransformedSymbol(
                position = position,
                identifierClassifier = IdentifierClassifier.Property,
                transformedName = valueTransformedRefName!!,
                originalName = valueName
            )
        }

        this.block.visit(modifier = modifier)
        type()

        popScope()
    }

    fun TryNode.visit(modifier: Modifier = Modifier()) {
        mainBlock.visit(modifier = modifier)
        catchBlocks.forEach { it.visit(modifier = modifier) }
        finallyBlock?.visit(modifier = modifier)

        type()
    }

    fun WhenSubjectNode.visit(modifier: Modifier = Modifier()) {
        value.visit(modifier = modifier)
        val valueType = value.type()
        if (declaredType != null && !declaredType.toDataType().isAssignableFrom(valueType.toDataType())) {
            throw TypeMismatchException(declaredType.position, declaredType.descriptiveName(), valueType.descriptiveName())
        }
        type = declaredType ?: valueType

        if (hasValueDeclaration()) {
            currentScope.declareProperty(position = position, name = valueName!!, type = type!!, isMutable = false)
            currentScope.assign(
                name = valueName,
                value = SemanticDummyRuntimeValue(currentScope.typeNodeToPropertyType(type!!, false)!!.type)
            )
            valueTransformedRefName = "$valueName/${currentScope.scopeLevel}"
            currentScope.registerTransformedSymbol(
                position = position,
                identifierClassifier = IdentifierClassifier.Property,
                transformedName = valueTransformedRefName!!,
                originalName = valueName
            )
        }
    }

    fun WhenConditionNode.visit(modifier: Modifier = Modifier(), subject: ASTNode?) {
        expression.visit(modifier = modifier)
        val expressionType = expression.type()
        val isWithoutSubject = subject == null

        if (isWithoutSubject) {
            if (testType != WhenConditionNode.TestType.Regular) {
                throw SemanticException(expression.position, "Only boolean expression is allowed in a `when` expression without subject")
            }
            if (!typeRegistry["Boolean"]!!.toDataType().isAssignableFrom(expressionType.toDataType())) {
                throw SemanticException(expression.position, "Only boolean expression is allowed in a `when` expression without subject")
            }
        }

        if (testType == WhenConditionNode.TestType.TypeTest && expression !is TypeNode) {
            throw SemanticException(expression.position, "`is` must be followed by a type")
        }

        if (testType == WhenConditionNode.TestType.RangeTest) {
            call = assertInOperatorCall(
                modifier = modifier,
                position = position,
                subject = subject!!,
                iterable = expression
            )
        }

        type = expressionType
    }

    /**
     * @param smartCastsFromEarlierEntries what is known because the entries before this one did not match
     * @return what is known after this entry did not match
     */
    private fun WhenEntryNode.visit(modifier: Modifier = Modifier(), subject: ASTNode?, smartCastsFromEarlierEntries: List<SmartCastFact> = emptyList()): List<SmartCastFact> {
        if (subject == null && conditions.size > 1) {
            throw SemanticException(position, "Use '||' instead of commas in when-condition for 'when' without argument")
        }
        return withSmartCasts(smartCastsFromEarlierEntries) {
            conditions.forEach { it.visit(modifier = modifier, subject = subject) }

            val smartCastsInBody = conditions.singleOrNull()?.let { whenConditionSmartCasts(it, subject, isConditionTrue = true) }.orEmpty()
            withSmartCasts(smartCastsInBody) {
                body.visit(modifier = modifier)
                bodyType = body.type()
            }
            conditions.flatMap { whenConditionSmartCasts(it, subject, isConditionTrue = false) }
        }
    }

    fun WhenNode.visit(modifier: Modifier = Modifier()) {
        pushScope(
            scopeName = "<when>",
            scopeType = ScopeType.WhenOuter,
            returnType = null,
        )

        subject?.visit(modifier = modifier)

        val numOfElse = entries.count { it.isElseCondition() }
        if (numOfElse < 1) {
            throw SemanticException(position, "Currently, `when` expression must be used with an `else` branch")
        }
        if (numOfElse > 1) {
            throw SemanticException(position, "`when` expression can only contain one `else` branch")
        }
        val elseIndex = entries.indexOfFirst { it.isElseCondition() }
        if (elseIndex != entries.lastIndex) {
            throw SemanticException(entries[elseIndex].position, "`else` branch must be the last branch of a `when` expression")
        }

        var smartCastsFromEarlierEntries = emptyList<SmartCastFact>()
        entries.forEach {
            smartCastsFromEarlierEntries += it.visit(modifier = modifier, subject = subject, smartCastsFromEarlierEntries = smartCastsFromEarlierEntries)
        }

        // there is at least 1 else branch, so there is at least 1 branch
        type = superTypeOf(*entries.map { it.bodyType }.toTypedArray())

        popScope()
    }

    fun EnumEntryNode.visit(modifier: Modifier = Modifier(), className: String = "") {
        if (className.isEmpty()) throw RuntimeException("Missing className")
        call = FunctionCallNode(
            function = VariableReferenceNode(SourcePosition.NONE, className),
            arguments = arguments,
            declaredTypeArguments = emptyList(),
            position = position,
            isSuperclassConstruction = false,
        ).also { it.visit(modifier = modifier, isSkipConstructionSecurityCheck = true) }
    }

    private fun forLoopSubjectPosition(node: ASTNode): SourcePosition = when (node) {
        // Calls/navigation store the '(' / '.' position, not the receiver's start.
        is FunctionCallNode -> forLoopSubjectPosition(node.function)
        is NavigationNode -> forLoopSubjectPosition(node.subject)
        else -> node.position
    }

    fun ForNode.visit(modifier: Modifier = Modifier()) {
        subject.visit(modifier = modifier)
        val subjectType = subject.type().toDataType()
        val subjectPosition = forLoopSubjectPosition(subject)

        pushScope(
            scopeName = "<for>",
            scopeType = ScopeType.For,
            returnType = null,
        )

        currentScope.declareProperty(subject.position, "#subject", subjectType.toTypeNode(), false)
        currentScope.registerTransformedSymbol(subject.position, IdentifierClassifier.Property, "#subject", "#subject")
        currentScope.assign("#subject", SemanticDummyRuntimeValue(subjectType))

        val call = FunctionCallNode(
            function = NavigationNode(
                subjectPosition,
                VariableReferenceNode(subjectPosition, "#subject"),
                ".",
                ClassMemberReferenceNode(subjectPosition, "iterator")
            ).also { it.isForLoopIterator = true },
            arguments = emptyList(),
            declaredTypeArguments = emptyList(),
            position = position,
            callableType = CallableType.ExtensionFunction,
        )
        call.visit(modifier = modifier)

        val returnType = call.returnType!!.toDataType()
        val iteratorType = TypeNode(SourcePosition.NONE, "Iterator", listOf(TypeNode(SourcePosition.NONE, "*", null, false)), false).toDataType()
        if (!iteratorType.isAssignableFrom(returnType)) {
            throw SemanticException(subject.position, "Expression in a for-loop is required to have an `iterator()` method with a return type of Iterator<T>")
        }

        val iteratingType = (returnType as ObjectType).arguments.first()

        variables.forEach { it.visit(modifier = modifier, iteratingType = iteratingType) } // TODO don't hardcode one iterating type
        body.visit(modifier = modifier)
        popScope()
    }

    fun ValueParameterDeclarationNode.visit(modifier: Modifier = Modifier(), iteratingType: DataType) {
        if (declaredType != null) {
            if (!declaredType.toDataType().isAssignableFrom(iteratingType)) {
                throw TypeMismatchException(position, iteratingType.descriptiveName, declaredType.descriptiveName())
            }
        } else {
            inferredType = iteratingType.toTypeNode()
        }

        currentScope.declareProperty(position = position, name = name, type = type, isMutable = false)
        currentScope.assign(
            name = name,
            value = SemanticDummyRuntimeValue(currentScope.typeNodeToPropertyType(type, false)!!.type)
        )
        transformedRefName = "$name/${currentScope.scopeLevel}"
        currentScope.registerTransformedSymbol(
            position = position,
            identifierClassifier = IdentifierClassifier.Property,
            transformedName = transformedRefName!!,
            originalName = name
        )
    }

    fun analyze() = rootNode.visit()

    ////////////////////////////////////

    data class ResolveTypeModifier(val isSkipGenerics: Boolean = false)

    fun ASTNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier())
        = when (this) {
            is AsOpNode -> this.type.copy(this.type.isNullable || this.isNullable)
            is AssignmentNode -> typeRegistry["Unit"]!!
            is BinaryOpNode -> this.type(modifier = modifier)
            is UnaryOpNode -> this.type(modifier = modifier)
            is BlockNode -> this.type(modifier = modifier)
            is BreakNode -> typeRegistry["Unit"]!!
            is ClassDeclarationNode -> typeRegistry["Unit"]!!
            is ClassInstanceInitializerNode -> TODO()
            is ClassMemberReferenceNode -> TODO()
            is ClassParameterNode -> TODO()
            is ClassPrimaryConstructorNode -> TODO()
            is ContinueNode -> typeRegistry["Unit"]!!
            is FunctionCallArgumentNode -> this.type(modifier = modifier)
            is FunctionCallNode -> this.type(modifier = modifier)
            is FunctionDeclarationNode -> typeRegistry["Unit"]!!
            is FunctionValueParameterNode -> type
            is IfNode -> this.type(modifier = modifier)
            is IndexOpNode -> this.type(modifier = modifier)
            is NavigationNode -> this.type(modifier = modifier)
            is PropertyAccessorsNode -> this.type
            is PropertyDeclarationNode -> typeRegistry["Unit"]!!
            is ReturnNode -> this.type(modifier = modifier)
            is ScriptNode -> TODO()
            is TypeNode -> this
            is TypeParameterNode -> TODO()
            is ValueNode -> TODO()
            is VariableReferenceNode -> this.type(modifier = modifier)
            is WhileNode -> if (condition is BooleanNode && condition.value) typeRegistry["Nothing"]!! else typeRegistry["Unit"]!!
            is DoWhileNode -> if (condition is BooleanNode && condition.value) typeRegistry["Nothing"]!! else typeRegistry["Unit"]!!

            is IntegerNode -> typeRegistry["Int"]!!
            is LongNode -> typeRegistry["Long"]!!
            is DoubleNode -> typeRegistry["Double"]!!
            is BooleanNode -> typeRegistry["Boolean"]!!
            NullNode -> typeRegistry["Null"]!!
            is StringLiteralNode -> TODO()
            is StringNode -> typeRegistry["String"]!!
            is LambdaLiteralNode -> this.type(modifier = modifier)
            is CharNode -> typeRegistry["Char"]!!
            is InfixFunctionCallNode -> this.type(modifier = modifier)
            is ElvisOpNode -> this.type(modifier = modifier)
            is ThrowNode -> typeRegistry["Nothing"]!!
            is CatchNode -> this.type(modifier = modifier)
            is TryNode -> this.type(modifier = modifier)
            is WhenConditionNode -> TODO()
            is WhenEntryNode -> TODO()
            is WhenNode -> type!!
            is WhenSubjectNode -> this.type(modifier = modifier)
            is LabelNode -> TODO()
            is EnumEntryNode -> TODO()
            is ForNode -> typeRegistry["Unit"]!!
            is ValueParameterDeclarationNode -> TODO()
    }

    fun BinaryOpNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        type?.let { return it }

        val ot1 = node1.type(modifier = modifier).toDataType()
        val ot2 = node2.type(modifier = modifier).toDataType()
        val t1 = ot1.unboxTypeParameterType().unboxRepeatedType(currentScope)
        val t2 = ot2.unboxTypeParameterType().unboxRepeatedType(currentScope)

        fun throwError(): Nothing = throw SemanticException(
            position,
            "Types ${ot1.descriptiveName} and ${ot2.descriptiveName} cannot be applied with operator `$operator`"
        )

        return when (operator) {
                "+", "-", "*", "/", "%" -> {
                    call?.type(modifier = modifier)?.also {
                        type = it
                        return it
                    }
                    if (t1 isPrimitiveTypeOf PrimitiveTypeName.String || t1 is NothingType || t2 isPrimitiveTypeOf PrimitiveTypeName.String || t2 is NothingType) {
                        typeRegistry["String"]!!
                    } else if ((t1.`is`(PrimitiveTypeName.Double, isNullable = false) && t2.isNonNullNumberType())
                        || (t2.`is`(PrimitiveTypeName.Double, isNullable = false) && t2.isNonNullNumberType())
                    ) {
                        typeRegistry["Double"]!!
                    } else if ((t1.`is`(PrimitiveTypeName.Long, isNullable = false) && t2.isNonNullIntegralType())
                        || (t2.`is`(PrimitiveTypeName.Long, isNullable = false) && t2.isNonNullIntegralType())
                    ) {
                        typeRegistry["Long"]!!
                    } else if (t1.`is`(PrimitiveTypeName.Int, isNullable = false)
                        && t2.`is`(PrimitiveTypeName.Int, isNullable = false)
                    ) {
                        typeRegistry["Int"]!!
                    } else if (operator == "+" && t1 isPrimitiveTypeOf PrimitiveTypeName.Char && t2 isPrimitiveTypeOf PrimitiveTypeName.Int) {
                        typeRegistry["Char"]!!
                    } else if (operator == "-" && t1 isPrimitiveTypeOf PrimitiveTypeName.Char && t2 isPrimitiveTypeOf PrimitiveTypeName.Char) {
                        typeRegistry["Int"]!!
                    } else {
                        throwError()
                    }
                }

                "<", "<=", ">", ">=" -> {
                    if (
                        hasFunctionCall == true
                        || (t1.isNonNullNumberTypeOrByte() && t2.isNonNullNumberTypeOrByte())
                        || (t1 isPrimitiveTypeOf PrimitiveTypeName.String && t2 isPrimitiveTypeOf PrimitiveTypeName.String)
                        || (t1 isPrimitiveTypeOf PrimitiveTypeName.Char && t2 isPrimitiveTypeOf PrimitiveTypeName.Char)
                    ) {
                        typeRegistry["Boolean"]!!
                    } else if (!t1.isNullable && t1 is ObjectType) {
                        val comparableType = if (t1.name == "Comparable") {
                            t1
                        } else {
                            t1.findSuperType("Comparable") ?: throwError()
                        }
                        val comparableOtherType = comparableType.arguments.first().unboxRepeatedType(currentScope)
                        if (
                            comparableOtherType.isAssignableFrom(ot2)
                            || comparableOtherType.isAssignableFrom(t2)
                        ) {
                            typeRegistry["Boolean"]!!
                        } else {
                            throwError()
                        }
                    } else {
                        throwError()
                    }
                }

                "||", "&&" -> {
                    if (t1 isPrimitiveTypeOf PrimitiveTypeName.Boolean && t2 isPrimitiveTypeOf PrimitiveTypeName.Boolean) {
                        typeRegistry["Boolean"]!!
                    } else {
                        throwError()
                    }
                }

                "==", "!=", "===", "!==" -> {
                    if (
                        (t1 isPrimitiveTypeOf PrimitiveTypeName.Byte && !(t2 isPrimitiveTypeOf PrimitiveTypeName.Byte))
                        || (!(t1 isPrimitiveTypeOf PrimitiveTypeName.Byte) && t2 isPrimitiveTypeOf PrimitiveTypeName.Byte)
                    ) {
                        throwError()
                    }
                    typeRegistry["Boolean"]!!
                }

                "..", "..<" -> {
                    call?.type(modifier = modifier)?.also {
                        type = it
                        return it
                    }
                    throwError()
                }

                else -> throwError()
            }.also {
                type = it
            }
    }

    fun UnaryOpNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        type?.let { return it }
        return if (operator == "!!") {
            node!!.type(modifier = modifier).copy(isNullable = false)
        } else {
            node!!.type(modifier = modifier).let {
                if (it.name == "Byte" && operator in setOf("+", "-")) {
                    TypeNode(it.position, "Int", it.arguments, it.isNullable)
                } else {
                    it
                }
            }
        }.also { type = it }
    }

    // e.g. `name()`, where name is a VariableReferenceNode
    fun VariableReferenceNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()) = type ?: (
            // A value in the current scope shadows functions and class names in
            // expression position, just as it does in Kotlin. This matters for
            // common parameter names such as `min` and `max`, which are also
            // available as standard-library functions.
            currentScope.getPropertyTypeOrNull(variableName)?.first?.type?.toTypeNode()
                ?: currentScope.findFunctionsByOriginalName(variableName).firstOrNull()?.let { FunctionTypeNode(position = it.first.position, parameterTypes = null, returnType = null, isNullable = false) }
                ?: currentScope.findClass(variableName)?.let { ClassTypeNode(TypeNode(position, variableName, null, false)) }
                ?: error("Unable to resolve variable `$variableName`")
            ).let { resolvedType ->
                activeSmartCast(smartCastKey(this))?.type ?: resolvedType
            }.also { if (activeSmartCast(smartCastKey(this)) == null) type = it }

    fun IndexOpNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        return call!!.type(modifier = modifier)
    }

    fun NavigationNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier(), lookupType: IdentifierClassifier = IdentifierClassifier.Property): TypeNode {
        type?.let { return it }
        val subjectType = when(val type = subject.type(modifier = modifier)) {
            is FunctionTypeNode -> type.returnType
            is ClassTypeNode -> type.unboxClassTypeAsCompanion()
            else -> type
        } ?: return typeRegistry["Any"]!!
        var isNullCastNeeded: Boolean = false
        val clazz = currentScope.findClass(
            subjectType.toDataType().resolveTypeParameterAsUpperBound()
                .let {
                    if (operator == "?." && subjectType.isNullable) {
                        isNullCastNeeded = true
                        it.copyOf(isNullable = false)
                    } else {
                        it
                    }
                }
                .nameWithNullable
        )?.first
            ?: throw SemanticException(position, "Unknown type `${subjectType.name}`")
        val memberName = member.name

        fun resolve(): TypeNode {
            fun TypeNode.resolveMemberType(): TypeNode {
                if (subjectType.arguments.isNullOrEmpty()) { // within class declaration
                    return this
                }
                return this.resolveGenericParameterTypeArguments(clazz.typeParameters.mapIndexed { index, it ->
                    it.name to subjectType.arguments!![index]
                }.toMap())
                // TODO find alias by class name
                // TODO resolve nested type parameters
//            val typeParameterType = currentScope.findTypeAlias(this.name) ?: return this
//            val typeParameterIndex = clazz.typeParameters.indexOfFirst { it.name == this.name }
//            if (typeParameterIndex < 0) throw RuntimeException("Cannot find type parameter $name")
//            val subjectArguments = subjectType.arguments ?: return this //throw RuntimeException("Missing type arguments")
//            return subjectArguments[typeParameterIndex]
            }

            val resolver = ClassMemberResolver.create(currentScope, clazz, subjectType.arguments)
            if (lookupType == IdentifierClassifier.Property) {
                /**
                 * As of Kotlin 1.9, resolution order is Companion Property > Enum Entry
                 */
                resolver?.findMemberPropertyCustomAccessorWithType(memberName)?.let {
                    return it.second
                }
                resolver?.findMemberPropertyWithoutAccessorWithType(memberName)?.let {
                    return it.second
                }
                if (clazz.fullQualifiedName.endsWith(".Companion") && !subjectType.isNullable) {
                    val originalClassName = clazz.fullQualifiedName.removeSuffix(".Companion")
                    val originalClass = currentScope.findClass(originalClassName)?.first
                        ?: throw RuntimeException("Cannot find class $originalClassName")

                    if (ClassModifier.enum in originalClass.modifiers && originalClass.enumValues.containsKey(memberName)) {
                        return TypeNode(
                            position = SourcePosition.NONE,
                            name = originalClass.fullQualifiedName,
                            arguments = null,
                            isNullable = false,
                        )
                    }
                }
                transformedRefName?.let {
                    currentScope.findExtensionProperty(it)
                }?.let {
                    return it.typeNode!!.resolveMemberType()
                }
            } else {
                resolver?.findMemberFunctionWithTypeByTransformedName(memberName)?.let {
                    return FunctionTypeNode(
                        position = it.function.position,
                        parameterTypes = emptyList(),
                        returnType = it.resolvedReturnType,
                        isNullable = false
                    )
                }
                findExtensionFunction(subjectType.toDataType(), memberName)?.let {
                    return FunctionTypeNode(
                        position = it.position,
                        parameterTypes = emptyList(),
                        returnType = it.returnType,
                        isNullable = false
                    ).resolveMemberType()
                }
            }
            throw SemanticException(position, "Could not find member `$memberName` for type ${clazz.fullQualifiedName}")
        }

        return resolve().let {
            val r = if (isNullCastNeeded) {
                it.copy(isNullable = true)
            } else {
                it
            }
            type = r
            r
        }
    }

    fun FunctionCallArgumentNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        return this.value.type(modifier = modifier)
    }

    fun FunctionCallNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        returnType?.let { return it }
        val functionType = when (function) {
            is NavigationNode -> {
                function.type(modifier = modifier, lookupType = IdentifierClassifier.Function)
            }
            else -> function.type(modifier = modifier)
        }.also {
            if (it is ClassTypeNode) {
                return it.clazz // return directly out to the enclosed function
            }
        }
        if (functionType !is FunctionTypeNode) {
            throw SemanticException(position, "Cannot invoke non-function expression")
        }
        return functionType.returnType!!
    }

    fun ReturnNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        return if (isNonLocal) typeRegistry["Nothing"]!! else value?.type(modifier = modifier) ?: typeRegistry["Unit"]!!
    }

    fun IfNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        type?.let { return it }
        return superTypeOf(trueBlock?.type(modifier = modifier), falseBlock?.type(modifier = modifier))
            .also { type = it }
    }

    fun BlockNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        returnType?.let { return it }
        return (statements.lastOrNull()?.type(modifier = modifier) ?: typeRegistry["Unit"]!!)
            .also { returnType = it }
    }

    fun LambdaLiteralNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        if (modifier.isSkipGenerics) return FunctionTypeNode(position = position, parameterTypes = null, returnType = null, isNullable = false)
        type?.let { return it }
        return FunctionTypeNode(position = position, parameterTypes = valueParameters.map { it.type(modifier = modifier) }, returnType = if (returnTypeUpperBound != null && returnTypeUpperBound?.name == "Unit") returnTypeUpperBound else body.type(), isNullable = false)
            .also { type = it }
    }

    fun InfixFunctionCallNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        type?.let { return it }
        call?.let { it.type(modifier = modifier) }?.let {
            type = it
            return it
        }
        return when (functionName) {
            "to" -> TypeNode(SourcePosition.NONE, "Pair", arguments = listOf(node1.type(modifier), node2.type(modifier)), isNullable = false)
            "is", "!is" -> typeRegistry["Boolean"]!!
            else -> throw UnsupportedOperationException("Infix function `$functionName` not found")
        }.also { type = it }
    }

    fun ElvisOpNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        type?.let { return it }
        val type1 = primaryNode.type(modifier = modifier).copy(isNullable = false)
        val type2 = fallbackNode.type(modifier = modifier)
        return if (type1.name == "Nothing") {
            type2
        } else {
            superTypeOf(type1.copy(isNullable = false), type2)
        }.also { type = it }
    }

    fun CatchNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        type?.let { return it }
        type = block.type(modifier = modifier)
        return type!!
    }

    fun TryNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        type?.let { return it }
        var type = mainBlock.type(modifier = modifier)
        catchBlocks.forEach {
            type = superTypeOf(type, it.type(modifier = modifier))
        }
        this.type = type
        return type
    }

    fun WhenSubjectNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        type?.let { return it }
        return value.type(modifier = modifier).also { type = it }
    }

    fun superTypeOf(vararg types: TypeNode?): TypeNode {
        val types = types.filterNotNull()
            .map { it.unboxRepeatedType() }
        if (types.isEmpty()) throw IllegalArgumentException("superTypeOf input cannot be empty")

        fun superTypeTree(type: DataType): List<DataType> {
            val types = mutableListOf(type)
            if (type !is ObjectType) return types
//            var type: ObjectType = type
//            while (type.superType != null) {
//                type = type.superType!!
//                types += type
//            }
//            return types
            return types + type.superTypes
        }

        fun superTypeOf(type1: TypeNode, type2: TypeNode, visitCache: SymbolTableTypeVisitCache): TypeNode {
            if (type1 == type2) return type1
            if (type1.name == type2.name && (type1.isNullable || type2.isNullable)) {
                return type1.toNullable()
            }
            if (type1.name == "Nothing" && type2.name != type1.name) {
                return if (type1.isNullable) {
                    type2.toNullable()
                } else {
                    type2
                }
            }
            if (type2.name == "Nothing" && type2.name != type1.name) {
                return if (type2.isNullable) {
                    type1.toNullable()
                } else {
                    type1
                }
            }
            if (visitCache.isVisited(type1) || visitCache.isVisited(type2)) {
                return TypeNode(SourcePosition.NONE, "*", null, false)
            }
            visitCache.preVisit(type1)
            visitCache.preVisit(type2)

            val typeTree1 = superTypeTree(currentScope.assertToDataType(type1))
            val typeTree2 = superTypeTree(currentScope.assertToDataType(type2))
            val isNullable = type1.isNullable || type2.isNullable
            run {
                typeTree1.forEach { superType1 ->
                    typeTree2.forEach { superType2 ->
                        if (superType1.name == superType2.name && superType1.name != "Any") {
                            if (superType1 is ObjectType && superType2 is ObjectType) {
                                if (superType1.arguments.size != superType2.arguments.size) {
                                    return@run
                                }
                                return TypeNode(
                                    position = SourcePosition.NONE,
                                    name = superType1.name,
                                    arguments = superType1.arguments.mapIndexed { index, it ->
                                        superTypeOf(it.toTypeNode(), superType2.arguments[index].toTypeNode(), visitCache)
                                    }.emptyToNull(),
                                    isNullable = isNullable,
                                )
                            } else if (superType1 is FunctionType && superType2 is FunctionType) {
                                if (superType1.arguments.size != superType2.arguments.size) {
                                    return@run
                                }
                                return FunctionTypeNode(
                                    position = SourcePosition.NONE,
                                    parameterTypes = superType1.arguments.mapIndexed { index, it ->
                                        superTypeOf(it.toTypeNode(), superType2.arguments[index].toTypeNode(), visitCache)
                                    },
                                    returnType = superTypeOf(superType1.returnType.toTypeNode(), superType2.returnType.toTypeNode()),
                                    isNullable = isNullable,
                                )
                            } else if (superType1 == superType2) {
                                // types that are not objects nor functions have no type arguments
                                return TypeNode(SourcePosition.NONE, superType1.name, null, isNullable = isNullable)
                            }
                            return@run
                        }
                    }
                }
            }

            return typeRegistry["Any${if (type1.isNullable || type2.isNullable) "?" else ""}"]!!
        }

        val visitCache = SymbolTableTypeVisitCache()
        var type = types.first()
        types.drop(1)
            .forEach { type = superTypeOf(type, it, visitCache) }
        return type
    }
}
