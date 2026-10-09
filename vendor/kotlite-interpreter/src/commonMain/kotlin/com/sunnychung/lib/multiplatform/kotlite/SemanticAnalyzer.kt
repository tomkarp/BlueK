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
import com.sunnychung.lib.multiplatform.kotlite.model.DestructuringDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.Variance
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
import com.sunnychung.lib.multiplatform.kotlite.model.OBJECT_REF_PREFIX
import com.sunnychung.lib.multiplatform.kotlite.model.ENUM_REF_PREFIX
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyOwnerInfo
import com.sunnychung.lib.multiplatform.kotlite.model.RepeatedType
import com.sunnychung.lib.multiplatform.kotlite.model.PROVISIONAL_TYPE_PREFIX
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

    /** The narrowings active at the end of the block visited last, for joining the branches of an `if` (RT-99). */
    private var blockEndSmartCasts: Map<String, SmartCastFact> = emptyMap()
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
        // the implicit `<Class>.Companion` of a class without `companion object` (null for objects)
        val companion: ClassDefinition?,
        // type parameter, superclass and class scope of `visitClassBody`
        val scopes: List<SemanticAnalyzerSymbolTable>,
        // around `scopes`: the members of the declared `companion object`, see `provideCompanionMembers`
        val companionScope: SemanticAnalyzerSymbolTable?,
    ) {
        var state = ClassAnalysisState.Declared
        var companionDeclared: DeclaredClass? = null
        // For an inner class: the members of its outer objects, outermost first (RT-92).
        var outerScopes: List<SemanticAnalyzerSymbolTable> = emptyList()
        var areCompanionMembersProvided = false
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

    /** The name (or `name.property`, RT-99) compared with `null` by [node]. */
    private fun nullCheckedVariable(node: ASTNode, operator: String): ASTNode? {
        if (node !is BinaryOpNode || node.operator != operator) return null
        fun isCheckable(it: ASTNode) = it is VariableReferenceNode || it is NavigationNode
        return when {
            isCheckable(node.node1) && node.node2 is NullNode -> node.node1
            isCheckable(node.node2) && node.node1 is NullNode -> node.node2
            else -> null
        }
    }

    /**
     * Gives the calls that produce the value of [node] the expected [type], also
     * through the branches of `if`/`when` and the last statement of a block, so
     * that their type arguments can be inferred from it as in Kotlin (RT-107).
     */
    private fun propagateExpectedType(node: ASTNode?, type: TypeNode) {
        when (node) {
            is FunctionCallNode -> if (node.expectedReturnType == null) node.expectedReturnType = type
            is IfNode -> { propagateExpectedType(node.trueBlock, type); propagateExpectedType(node.falseBlock, type) }
            is WhenNode -> node.entries.forEach { propagateExpectedType(it.body, type) }
            is BlockNode -> propagateExpectedType(node.statements.lastOrNull(), type)
            else -> {}
        }
    }

    /** A type without type parameters still to be inferred, and more specific than `Any`/`Unit` (RT-100). */
    private fun isConcreteType(type: TypeNode): Boolean {
        if (type is FunctionTypeNode || type.name in setOf("Any", "Unit", "Nothing", "*")) return false
        fun concrete(t: TypeNode): Boolean = t !is FunctionTypeNode && currentScope.findTypeAlias(t.name) == null &&
            (t.arguments ?: emptyList()).all { it.name == "*" || concrete(it) }
        return concrete(type)
    }

    /** Whether [node] (`return`, `throw`, `break`, `continue`, a call of type `Nothing`) never completes. */
    private fun neverCompletes(node: ASTNode?): Boolean = when (node) {
        is ReturnNode, is ThrowNode, is BreakNode, is ContinueNode -> true
        is FunctionCallNode -> node.type().name == "Nothing"
        else -> false
    }

    /**
     * Narrowings that hold after [statement] completed normally (RT-99): `x ?: return`, `x!!`,
     * `x as T`, `requireNotNull(x)`, `checkNotNull(x)`, `require(…)`, `check(…)` (Kotlin's
     * contracts), and a non-null value assigned to or declared for a nullable local variable.
     */
    private fun smartCastsAfter(statement: ASTNode): List<SmartCastFact> = when (statement) {
        is PropertyDeclarationNode -> smartCastsAfterExpression(statement.initialValue) + listOfNotNull(
            statement.initialValue?.let { nonNullValueFact(statement.transformedRefName, statement.declaredType, statement.isMutable, it) })
        is AssignmentNode -> smartCastsAfterExpression(statement.value) +
            listOfNotNull((statement.subject as? VariableReferenceNode)?.takeIf { statement.operator == "=" }
                ?.let { subject -> smartCastSubject(subject)?.let { nonNullValueFact(it.key, it.type, it.isMutable, statement.value) } })
        else -> smartCastsAfterExpression(statement)
    }

    private fun smartCastsAfterExpression(node: ASTNode?): List<SmartCastFact> {
        if (node == null) return emptyList()
        if (node is ElvisOpNode && neverCompletes(node.fallbackNode)) return listOfNotNull(nonNullFact(smartCastSubject(node.primaryNode)))
        if (node is UnaryOpNode && node.operator == "!!") return listOfNotNull(nonNullFact(smartCastSubject(node.node)))
        if (node is AsOpNode && !node.isNullable) return listOfNotNull(typeTestFact(smartCastSubject(node.expression), node.type))
        val call = node as? FunctionCallNode ?: return emptyList()
        val argument = call.arguments.firstOrNull()?.value ?: return emptyList()
        return when ((call.function as? VariableReferenceNode)?.variableName) {
            "requireNotNull", "checkNotNull", "assertNotNull" -> listOfNotNull(nonNullFact(smartCastSubject(argument)))
            "require", "check", "assertTrue" -> smartCastsWhenTrue(argument)
            "assertFalse" -> smartCastsWhenFalse(argument)
            else -> emptyList()
        }
    }

    /** `s = "abc"` or `var s: String? = "abc"`: the nullable variable [key] holds a non-null value. */
    private fun nonNullValueFact(key: String?, declaredType: TypeNode?, isMutable: Boolean, value: ASTNode): SmartCastFact? {
        if (key == null || declaredType == null || !declaredType.isNullable) return null
        val valueType = value.type()
        if (valueType.isNullable || valueType.name == "Nothing") return null
        return SmartCastFact(key, declaredType.copy(isNullable = false), isMutable)
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
        if (node is NavigationNode) {
            val key = propertySmartCastKey(node) ?: return null
            return SmartCastSubject(key, node.type(), isStableForTypeTest = true, isMutable = false)
        }
        val variable = node as? VariableReferenceNode ?: return null
        val key = smartCastKey(variable) ?: return null
        val isMutable = currentScope.getPropertyTypeOrNull(variable.variableName)?.first?.isMutable == true
        return SmartCastSubject(key, variable.type(), isStableForTypeTest(variable), isMutable)
    }

    /**
     * The key of `name.property` when Kotlin can smart-cast it (RT-99): `name` is a local
     * variable or parameter, the property a `val` without custom getter that is not open.
     * An assignment to `name` voids it (see AssignmentNode.visit).
     */
    private fun propertySmartCastKey(node: NavigationNode): String? {
        if (node.operator != ".") return null
        val variable = node.subject as? VariableReferenceNode ?: return null
        val rootKey = smartCastKey(variable) ?: return null
        val subjectType = variable.type().takeIf { !it.isNullable && it !is FunctionTypeNode && it !is ClassTypeNode } ?: return null
        val clazz = currentScope.findClass(subjectType.name)?.first ?: return null
        val property = clazz.findMemberPropertyWithoutAccessor(node.member.name) ?: return null
        if (property.isMutable || isOverridableOrComputedProperty(clazz, node.member.name)) return null
        return "$rootKey.${node.member.name}"
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
            else -> listOfNotNull(nonNullFact(smartCastSubject(nullOrEmptyCheckedVariable(node))))
        }
    }

    /**
     * The receiver of `x.isNullOrEmpty()` or `x.isNullOrBlank()`: Kotlin's contracts make `x`
     * non-null when the call returns `false` (RT-98).
     */
    private fun nullOrEmptyCheckedVariable(node: ASTNode): ASTNode? {
        val call = node as? FunctionCallNode ?: return null
        val navigation = call.function as? NavigationNode ?: return null
        if (navigation.operator != "." || call.arguments.isNotEmpty()) return null
        if (navigation.member.name != "isNullOrEmpty" && navigation.member.name != "isNullOrBlank") return null
        return navigation.subject
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
            is DestructuringDeclarationNode -> throw IllegalStateException("Statement lists flatten destructuring declarations")
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

    /** Like Kotlin, a class and its companion object share their private members (RT-67). */
    private fun canAccessPrivateMembersOf(ownerName: String?): Boolean {
        val current = currentClassName() ?: return false
        return current == ownerName || current == "$ownerName.Companion" || "$current.Companion" == ownerName
    }

    /** `protected` (RT-80): code of the declaring class, of its subclasses and of their companions. */
    private fun canAccessProtectedMembersOf(ownerName: String?): Boolean {
        if (canAccessPrivateMembersOf(ownerName)) return true
        val current = currentClassName()?.removeSuffix(".Companion") ?: return false
        var clazz = currentScope.findClass(current)?.first
        while (clazz != null) {
            if (clazz.fullQualifiedName == ownerName) return true
            clazz = clazz.superClass
        }
        return false
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
            // A declared companion object is a class of its own (declared below); an object has none.
            val companion = if (node.isObject || node.companionObject != null) null else companionClassDefinition(node, classType)
            companion?.let { symbolTable.declareClass(node.position, it) }

            val superClassInvocation = if (node.isInterface) null else node.superInvocations?.filterIsInstance<FunctionCallNode>()?.firstOrNull()
            val superClass = (superClassInvocation?.function as? TypeNode)?.let { symbolTable.findClass(it.name)?.first }
            val interfaceTypes = node.superInvocations?.filterIsInstance<TypeNode>() ?: emptyList()
            val companionScope = node.companionObject?.let {
                SemanticAnalyzerSymbolTable(symbolTable.scopeLevel + 1, it.name, ScopeType.ExtraWrap, parentScope = symbolTable)
            }
            val level = symbolTable.scopeLevel + if (companionScope != null) 1 else 0
            val typeParameterScope = SemanticAnalyzerSymbolTable(level + 1, name, ScopeType.Class, parentScope = companionScope ?: symbolTable)
            val superClassScope = SemanticAnalyzerSymbolTable(level + 2, name, ScopeType.Class, parentScope = typeParameterScope)
            val classScope = SemanticAnalyzerSymbolTable(level + 3, name, ScopeType.Class, parentScope = superClassScope)
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
                isObjectDeclaration = node.isObject,
            )
            // The hierarchy is needed to resolve (generic) types before the analysis.
            if (superClass != null) definition.superClassInvocation = superClassInvocation
            definition.isDeclaredAhead = true
            symbolTable.declareClass(node.position, definition)
            declaring.removeLast()
            val declared = DeclaredClass(node, definition, companion, listOf(typeParameterScope, superClassScope, classScope), companionScope)
            declaredClasses[node.position] = declared
            // An inner class reaches the members of its outer object by their plain names (RT-92).
            if (node.isInner) byName[node.outerClassName]?.let { outerNode ->
                declare(outerNode)
                val outer = declaredClasses[outerNode.position] ?: return@let
                val scope = SemanticAnalyzerSymbolTable(symbolTable.scopeLevel + 1, "outer ${outerNode.name}", ScopeType.ExtraWrap, parentScope = symbolTable)
                // The type parameters of the outer class, by their bounds.
                outerNode.typeParameters.forEach { scope.declareTypeAlias(it.position, it.name, it.typeUpperBound) }
                val provide = { memberName: String ->
                    // The outer class's own members and those it inherits.
                    outer.scopes.reversed().forEach { scope.declareObjectMemberFrom(it, "this/${outerNode.fullQualifiedName}", memberName) }
                }
                scope.beforeFunctionLookup = provide
                scope.beforePropertyLookup = provide
                declared.outerScopes = outer.outerScopes + scope
            }
            val analyze = { analyzeDeclaredClass(declared, isOnDemand = true) }
            definition.pendingAnalysis = analyze
            companion?.pendingAnalysis = analyze
            node.companionObject?.let { companionNode ->
                topLevelIndexByPosition[companionNode.position] = topLevelIndexByPosition.getValue(node.position)
                declare(companionNode)
                val companionDeclared = declaredClasses.getValue(companionNode.position)
                declared.companionDeclared = companionDeclared
                // Its class starts first, so the companion sees the members of the class it uses.
                companionDeclared.definition.pendingAnalysis = {
                    analyzeDeclaredClass(declared, isOnDemand = true)
                    analyzeDeclaredClass(companionDeclared, isOnDemand = true)
                }
                val provide = { name: String -> provideCompanionMembers(declared, name) }
                companionScope!!.beforeFunctionLookup = provide
                companionScope.beforePropertyLookup = provide
            }
        }
        classes.forEach { if (byName[it.name] === it) declare(it) }
    }

    /**
     * Inside a class, the members of its `companion object` are used by their plain names, like in
     * Kotlin: after the class's own members and before top-level declarations (RT-67). The companion
     * is analyzed when its class first uses such a name, or after its class, so that it can use the
     * members of the class analyzed so far.
     */
    private fun provideCompanionMembers(declared: DeclaredClass, name: String) {
        if (declared.areCompanionMembersProvided) return
        val companion = declared.companionDeclared ?: return
        val isMember = companion.node.declarations.any {
            (it is PropertyDeclarationNode && it.name == name) || (it is FunctionDeclarationNode && it.name == name)
        }
        if (!isMember) return
        analyzeDeclaredClass(companion, isOnDemand = true)
        // Not yet when the companion itself (through its class) asks for one of its members.
        if (companion.state != ClassAnalysisState.Analyzed) return
        declared.areCompanionMembersProvided = true
        declared.companionScope!!.declareObjectMembersFrom(companion.scopes[2], OBJECT_REF_PREFIX + companion.node.fullQualifiedName)
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
        declared.companion?.pendingAnalysis = null
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
        // `a[i]++` writes through the `set` operator of the receiver (RT-97); the new value
        // replaces the last argument at runtime.
        val indexed = node as? IndexOpNode
        if (operator in setOf("pre++", "pre--", "post++", "post--") && indexed != null) {
            assignFunctionCall = FunctionCallNode(
                function = NavigationNode(position, indexed.subject, ".", ClassMemberReferenceNode(position, "set")),
                arguments = indexed.arguments.mapIndexed { index, it ->
                    FunctionCallArgumentNode(position = it.position, index = index, value = it)
                } + FunctionCallArgumentNode(position = indexed.position, index = indexed.arguments.size, value = indexed),
                declaredTypeArguments = emptyList(),
                position = position,
                modifierFilter = SearchFunctionModifier.OperatorFunctionOnly,
            ).also { it.visit(modifier) }
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
            smartCasts.keys.removeAll { key -> key.startsWith("$it.") } // `name.property` (RT-99)
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
                    // `+=` reads first: the receiver (`liste[0]` in `liste[0].punkte += 1`) must be
                    // analyzed before its type is asked for (RT-97)
                    if (isRead && !isWrite) {
                        subject.visit(modifier = modifier)
                    }
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

        // `liste = mutableListOf(1, 2)` takes its type arguments from the variable (RT-107).
        if (operator == "=" && subjectRawType !is FunctionTypeNode) propagateExpectedType(value, subjectRawType)
        value.visit(modifier = modifier)
        requireWhenValue(value)
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
        if (declaredModifiers.contains(PropertyModifier.override) || declaredModifiers.contains(PropertyModifier.abstract)) {
            inferredModifiers += PropertyModifier.open
        }
        if (PropertyModifier.abstract in modifiers && (initialValue != null || accessors != null)) {
            throw SemanticException(position, "An abstract property cannot have an initializer or accessors")
        }
        // `lateinit var` (RT-81, also local and top-level since RT-88): Kotlin's rules
        if (PropertyModifier.lateinit in modifiers) {
            val lateinitType = declaredType
            when {
                !isMutable -> throw SemanticException(position, "'lateinit' modifier is allowed only on mutable properties")
                initialValue != null -> throw SemanticException(position, "'lateinit' modifier is not allowed on properties with initializer")
                accessors != null -> throw SemanticException(position, "'lateinit' modifier is not allowed on properties with a custom getter or setter")
                lateinitType == null || lateinitType.isNullable -> throw SemanticException(position, "'lateinit' modifier is not allowed on properties of nullable types")
                lateinitType.name in setOf("Int", "Long", "Double", "Float", "Boolean", "Char", "Byte") ->
                    throw SemanticException(position, "'lateinit' modifier is not allowed on properties of primitive types")
            }
        }
        if (isVisitInitialValue) {
            if (declaredType is FunctionTypeNode && initialValue is LambdaLiteralNode) {
                initialValue.parameterTypesUpperBound = declaredType.parameterTypes
                initialValue.returnTypeUpperBound = declaredType.returnType
                initialValue.receiverType = declaredType.receiverType
            }
            if (declaredType != null) propagateExpectedType(initialValue, declaredType)
            initialValue?.visit(modifier = modifier)
            requireWhenValue(initialValue)
            if (PropertyModifier.const in modifiers) checkConstProperty(this, isClassProperty)
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
        if (PropertyModifier.const in modifiers) constProperties += transformedRefName!!

        evaluateAndRegisterReturnType(this)
    }

    // Transformed names of `const val` properties, whose values may form another constant.
    private val constProperties = mutableSetOf<String>()

    /** `const val` (RT-67): like Kotlin, a top-level or object property with a constant primitive or String value. */
    private fun checkConstProperty(property: PropertyDeclarationNode, isClassProperty: Boolean) {
        val position = property.position
        if (!isClassProperty && currentScope !== symbolTable) throw SemanticException(position, "Modifier 'const' is not applicable to local variables")
        if (property.isMutable) throw SemanticException(position, "Modifier 'const' is not applicable to 'var'")
        if (property.accessors != null) throw SemanticException(position, "Const 'val' should not have a getter")
        val initialValue = property.initialValue ?: throw SemanticException(position, "Const 'val' must be initialized")
        val type = property.declaredType ?: initialValue.type()
        if (type.isNullable || type.name !in setOf("Int", "Long", "Double", "Float", "Byte", "Char", "Boolean", "String")) {
            throw SemanticException(position, "Const 'val' has type '${type.descriptiveName()}'. Only primitives and String are allowed")
        }
        fun isConstant(node: ASTNode?): Boolean = when (node) {
            is IntegerNode, is LongNode, is DoubleNode, is BooleanNode, is CharNode, is StringLiteralNode -> true
            is StringNode -> node.nodes.all { isConstant(it) }
            is UnaryOpNode -> isConstant(node.node)
            is BinaryOpNode -> isConstant(node.node1) && isConstant(node.node2)
            is VariableReferenceNode -> node.transformedRefName in constProperties
            // e.g. `Karte.MAX`; whether the member is `const` is not checked
            is NavigationNode -> node.operator == "."
            else -> false
        }
        if (!isConstant(initialValue)) throw SemanticException(initialValue.position, "Const 'val' initializer should be a constant value")
    }

    private fun isDeclaredBelowScript(name: String): Boolean {
        var scope: SymbolTable? = currentScope
        while (scope != null && scope !== symbolTable) {
            if (scope.hasProperty(name, isThisScopeOnly = true)) return true
            scope = scope.parentScope
        }
        return false
    }

    /** Lets enclosing scopes declare [name] before it is looked up, see [SemanticAnalyzerSymbolTable.beforePropertyLookup]. */
    private fun runBeforePropertyLookup(name: String) {
        var scope: SymbolTable? = currentScope
        while (scope != null) {
            (scope as? SemanticAnalyzerSymbolTable)?.beforePropertyLookup?.invoke(name)
            scope = scope.parentScope
        }
    }

    fun VariableReferenceNode.visit(modifier: Modifier = Modifier()) {
        runBeforePropertyLookup(variableName)
        // A top-level property later in this unit, unless a local or member shadows it.
        if (variableName in pendingTopLevel && !isDeclaredBelowScript(variableName)) {
            analyzeTopLevelAhead(variableName)
        }
        if (!currentScope.hasProperty(variableName)) {
            // Inside an enum class, its entries are named without the class (RT-78).
            currentClassName()?.let { currentScope.findClass(it)?.first }
                ?.takeIf { ClassModifier.enum in it.modifiers }
                ?.takeIf { clazz -> declaredClasses.values.any { it.definition === clazz && it.node.enumEntries.any { entry -> entry.name == variableName } } }
                ?.let { clazz ->
                    transformedRefName = "$ENUM_REF_PREFIX${clazz.fullQualifiedName}/$variableName"
                    type = TypeNode(position, clazz.fullQualifiedName, null, false)
                    return
                }
            currentScope.findClass(variableName)?.let { (clazz, _) ->
                // The name of an object is its single instance (RT-67).
                if (clazz.isObjectDeclaration) {
                    transformedRefName = OBJECT_REF_PREFIX + clazz.fullQualifiedName
                    type = TypeNode(position, clazz.fullQualifiedName, null, false)
                } else {
                    // A class name alone stands for its companion object.
                    type()
                }
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

        // `constructor(x: Int) : this(x, 0)`: the delegation sees the parameters (RT-83).
        // Like a superclass call it may target an abstract class's own constructor.
        (this as? ClassSecondaryConstructorNode)?.let { constructor ->
            val delegation = constructor.delegationCall ?: return@let
            delegation.visit(modifier = modifier, isSkipConstructionSecurityCheck = true)
            // The constructors of a cycle are analyzed in order, so the last one closes it here.
            val siblings = constructor.siblingConstructors
            val seen = mutableSetOf<Int>()
            var next = delegation.secondaryConstructorIndex
            while (next != null && seen.add(next)) {
                if (siblings[next] === constructor) {
                    throw SemanticException(constructor.position, "There's a cycle in the delegation calls chain")
                }
                next = siblings[next].delegationCall?.secondaryConstructorIndex
            }
        }

        val outerSmartCasts = smartCasts.toMap()
        smartCasts.clear()
        if (body != null) {
            body.returnTypeUpperBound = declaredReturnType
            // `fun leer(): List<Int> = emptyList()` takes its type arguments from the return type (RT-93).
            if (body.format == FunctionBodyFormat.Expression && declaredReturnType != null) {
                body.statements.singleOrNull()?.let { propagateExpectedType(it, declaredReturnType) }
            }
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
                // An override got the overridden return type up front (ClassDefinition); like Kotlin,
                // its body may only narrow it: `override fun toString() = 5` is an error (RT-57).
                inferredReturnType?.let { overridden ->
                    val overriddenType = overridden.resolveGenericParameterType(typeParameters).toDataType()
                    if (valueType !is NothingType && !overriddenType.isAssignableFrom(valueType)) {
                        throw TypeMismatchException(position, overriddenType.nameWithNullable, valueType.nameWithNullable)
                    }
                }
                inferredReturnType = body.type()
                variantsOfThis.forEach { it.inferredReturnType = inferredReturnType }
            } else {
                val subjectType = returnType.resolveGenericParameterType(typeParameters).toDataType()
                if (subjectType !is UnitType && valueType !is NothingType && !subjectType.isAssignableFrom(valueType)) {
                    throw TypeMismatchException(position, subjectType.descriptiveName, valueType.descriptiveName)
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
            // The superclass's own type parameters, e.g. `T` of `List` for `IntArray : List<Int>` (RT-96).
            val superClassTypeResolutions = ClassMemberResolver.create(currentScope, clazz, typeNode.arguments)!!
                .let {
                    it.genericResolutionsByTypeName[clazz.superClass!!.fullQualifiedName]!!
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
        // Extension properties of the receiver and of its supertypes, the closest first: `size` is
        // declared for `List`, and `mutableListOf(1).run { size }` must find it as well (RT-63). Of a
        // supertype only properties whose type needs none of their type parameters (`size: Int`),
        // which are not declared in this scope.
        val receiverForExtensions = typeNode.resolveGenericParameterTypeToUpperBound(clazz.typeParameters)
        val declaredExtensionProperties = mutableSetOf<String>()
        clazz.selfAndSuperTypeNames()
            .flatMap { name ->
                if (name == receiverForExtensions.name) {
                    currentScope.findExtensionPropertyByReceiver(receiverForExtensions)
                } else {
                    currentScope.findExtensionPropertyByReceiver(TypeNode(position, name, null, receiverForExtensions.isNullable))
                        .filter { property -> !property.second.typeNode!!.mentionsAny(property.second.typeParameters.map { it.name }.toSet()) }
                }
            }
            .filter { declaredExtensionProperties.add(it.second.declaredName) }
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

    private fun TypeNode.mentionsAny(names: Set<String>): Boolean =
        name in names || arguments.orEmpty().any { it.mentionsAny(names) }

    /** This class and its superclasses and interfaces, breadth-first (closest first). */
    private fun ClassDefinition.selfAndSuperTypeNames(): List<String> {
        val names = mutableListOf<String>()
        val queue = ArrayDeque(listOf(this))
        while (queue.isNotEmpty()) {
            val clazz = queue.removeFirst()
            if (clazz.fullQualifiedName in names) continue
            names += clazz.fullQualifiedName
            clazz.superClass?.let { queue += it }
            queue += clazz.superInterfaces
        }
        return names
    }

    /**
     * Like Kotlin, an unqualified `f(...)` also finds extension functions of the implicit receiver
     * (`liste.apply { add(1) }`, `gruss()` for `fun Hund.gruss()` inside `Hund`), RT-63. It is tried
     * only when no other callable matches, so every call that resolved before resolves the same.
     * The call is analyzed again as `this.f(...)`, which the interpreter runs via `resolvedInvoke`.
     */
    private fun FunctionCallNode.visitThroughImplicitReceiver(functionName: String, modifier: Modifier): FunctionCallNode? {
        if (function !is VariableReferenceNode || !currentScope.hasProperty("this")) return null
        val viaReceiver = copy(
            function = NavigationNode(
                position = function.position,
                subject = VariableReferenceNode(function.position, "this"),
                operator = ".",
                member = ClassMemberReferenceNode(function.position, functionName),
            ),
            resolvedInvoke = null,
        )
        val scope = currentScope
        return try {
            viaReceiver.visit(modifier)
            viaReceiver
        } catch (_: SemanticException) {
            currentScope = scope // the failed attempt may leave its call scope open
            null
        }
    }

    /**
     * `objekt.f(…)` for a property `f` of a function type, e.g. `val f: (Int) -> String`, which is
     * no member function (RT-75): reads the property and calls its value. Arguments are checked
     * against the function type. False if [navigation] does not name such a property.
     */
    private fun FunctionCallNode.visitFunctionValueCall(navigation: NavigationNode): Boolean {
        // The subject is analyzed already, by the failed lookup of a member function.
        if (navigation.member.name == "invoke") return false
        val subjectType = runCatching { navigation.subject.type().unboxClassTypeAsCompanion() }.getOrNull() ?: return false
        val clazz = runCatching {
            currentScope.findClass(subjectType.toDataType().resolveTypeParameterAsUpperBound().copyOf(isNullable = false).nameWithNullable)?.first
        }.getOrNull() ?: return false
        if (clazz.findMemberFunctionsWithEnclosingTypeNameByDeclaredName(navigation.member.name).isNotEmpty()) return false
        if (clazz.findMemberPropertyWithoutAccessor(navigation.member.name) == null && clazz.findMemberPropertyCustomAccessor(navigation.member.name) == null) return false
        val functionType = runCatching { navigation.type() }.getOrNull() as? FunctionTypeNode
        // nullable only through `?.` on a nullable subject
        val isNullable = functionType?.isNullable == true && !(navigation.operator == "?." && subjectType.isNullable)
        if (functionType == null || functionType.receiverType != null || isNullable) {
            navigation.type = null
            return false
        }
        navigation.visit(Modifier(), IdentifierClassifier.Property)
        val parameterTypes = functionType.parameterTypes.orEmpty()
        arguments.firstOrNull { it.name != null }?.let {
            throw SemanticException(it.position, "Named arguments are not allowed for function types")
        }
        if (arguments.size != parameterTypes.size) {
            throw SemanticException(position, "`${navigation.member.name}` expects ${parameterTypes.size} argument(s), but ${arguments.size} were given")
        }
        arguments.forEachIndexed { index, argument ->
            val expected = parameterTypes[index].toDataType()
            val actual = argument.type(ResolveTypeModifier(isSkipGenerics = true)).toDataType()
            if (!expected.isAssignableFrom(actual)) throw TypeMismatchException(argument.position, expected.nameWithNullable, actual.nameWithNullable)
        }
        callableType = CallableType.Property
        val result: TypeNode = functionType.returnType ?: typeRegistry["Unit"]!!
        returnType = if (navigation.operator == "?." && subjectType.isNullable) result.copy(isNullable = true) else result
        return true
    }

    private fun FunctionCallNode.describeArgumentTypes(): String = arguments.joinToString(", ") { argument ->
        runCatching { argument.type(ResolveTypeModifier(isSkipGenerics = true)).descriptiveName() }.getOrDefault("?")
    }

    fun FunctionCallNode.visit(modifier: Modifier = Modifier(), isSkipConstructionSecurityCheck: Boolean = false, isSuperClassInvocation: Boolean = false) {
        // Function values have no class member table. Route explicit invoke through
        // the same resolution and inline-escape checks as the ordinary f(...) form.
        val navigation = function as? NavigationNode
        val isInvokeOnValue = navigation?.operator == "." && navigation.member.name == "invoke" && when (val value = navigation.subject) {
            is VariableReferenceNode -> {
                value.visit(modifier.copy(isSkipGenerics = true))
                value.type() is FunctionTypeNode
            }
            // `objekt.f.invoke()` for a property of a function type (RT-75); only for a plain
            // name as subject, which may be analyzed twice
            is NavigationNode -> value.subject is VariableReferenceNode && run {
                value.subject.visit(modifier.copy(isSkipGenerics = true))
                (runCatching { value.type() }.getOrNull() is FunctionTypeNode).also { if (!it) value.type = null }
            }
            else -> false
        }
        if (navigation != null && isInvokeOnValue) {
            run {
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

        // Argument types for choosing the callable. With `isWidened`, the type arguments of
        // a generic call without explicit ones stay open, because its inference then
        // follows the parameter type as in Kotlin: `g(mutableListOf(1, 2))` for a
        // `MutableList<Any>` parameter (RT-107). Only used when nothing matched otherwise.
        fun argumentInfos(isWidened: Boolean) = arguments.map {
            val type = it.type(ResolveTypeModifier(isSkipGenerics = true))
            val call = it.value as? FunctionCallNode
            val open = isWidened && call != null && call.declaredTypeArguments.isEmpty() &&
                !call.inferredTypeArguments.isNullOrEmpty() && !type.arguments.isNullOrEmpty()
            val matched = if (open) TypeNode(type.position, type.name, type.arguments!!.map { TypeNode.createRepeatedTypeNode("${PROVISIONAL_TYPE_PREFIX}argument>") }, type.isNullable) else type
            FunctionCallArgumentInfo(it.name, matched.toDataType())
        }

        var resolvedDeclaration: FunctionDeclarationNode? = null
        var extraTypeResolutions = emptyMap<String, TypeNode>()

        val functionArgumentAndReturnTypeDeclarations = when (function) {
            is VariableReferenceNode /* f(x) or constructor */, is TypeNode /* Superclass constructor */ -> {
                val functionName = when (function) {
                    is VariableReferenceNode -> function.variableName
                    is TypeNode -> function.name
                    else -> throw UnsupportedOperationException()
                }
                fun search(isWidened: Boolean) = currentScope.findMatchingCallables(
                    currentSymbolTable = currentScope,
                    originalName = functionName,
                    receiverType = null,
                    arguments = argumentInfos(isWidened),
                    modifierFilter = if (function is TypeNode) SearchFunctionModifier.ConstructorOnly else modifierFilter!!,
                )
                val resolutions = search(isWidened = false).ifEmpty { search(isWidened = true) }
                if (resolutions.size > 1) {
                    throw SemanticException(position, "Ambiguous function call for `${functionName}`. ${resolutions.size} candidates match:\n${resolutions.joinToString("") { "- ${it.toDisplayableSignature()}\n" }}")
                }
                val resolution = resolutions.firstOrNull() ?: run {
                    visitThroughImplicitReceiver(functionName, modifier)?.let { viaReceiver ->
                        resolvedInvoke = viaReceiver
                        returnType = viaReceiver.returnType
                        popScope()
                        evaluateAndRegisterReturnType(this)
                        return
                    }
                    throw SemanticException(position, "No matching function or constructor `${functionName}` found for the argument types (${describeArgumentTypes()})")
                }
                if (function is VariableReferenceNode) {
                    // A method found through the implicit `this` has no owner yet. Inside a lambda that a
                    // library function runs, `this` would be that function's receiver (`map { f() }`), so
                    // it is called through `this/<Class>` like the members of the class scope (RT-69).
                    val implicitOwner = if (resolution.owner == null && resolution.type == CallableType.ClassMemberFunction) {
                        currentClassName()?.let { "this/" + (currentScope.findClass(it)?.first?.fullQualifiedName ?: it) }
                    } else null
                    function.ownerRef = (resolution.owner ?: implicitOwner)?.let { PropertyOwnerInfo(it) }
                    if (implicitOwner != null && symbolRecorders.isNotEmpty()) symbolRecorders.last().properties += implicitOwner
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
                        if (clazz.isObjectDeclaration) {
                            throw SemanticException(position, "`${clazz.name}` is an object: it has exactly one instance, which you use by its name `${clazz.name}`, without a constructor call")
                        }
                        // Only its entries create enum objects (RT-78).
                        if (ClassModifier.enum in clazz.modifiers && !isSuperClassInvocation) {
                            throw SemanticException(position, "Enum types cannot be instantiated: use an entry such as `${clazz.name}.${declaredClasses.values.firstOrNull { it.definition === clazz }?.node?.enumEntries?.firstOrNull()?.name ?: "…"}`")
                        }
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
                // `compareBy { it.a }.thenBy { it.n }` as argument: the receiver call gets its expected
                // type from this call's expected type once this call is resolved (RT-100)
                val chainedReceiver = (function.subject as? FunctionCallNode)
                    ?.takeIf { expectedReturnType != null && !modifier.isSkipGenerics && it.expectedReturnType == null }
                try {
                    /*val receiverType =*/ function.visit(modifier = if (chainedReceiver != null) modifier.copy(isSkipGenerics = true) else modifier, IdentifierClassifier.Function)
                } catch (e: SemanticException) {
                    if (!visitFunctionValueCall(function)) throw e
                    popScope()
                    evaluateAndRegisterReturnType(this)
                    return
                }
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
                fun search(isWidened: Boolean) = lookupReceiverTypes.firstNotNullOfOrNull {
                    currentScope.findMatchingCallables(
                        currentSymbolTable = currentScope,
                        originalName = function.member.name,
                        receiverType = it,
                        arguments = argumentInfos(isWidened),
                        modifierFilter = modifierFilter!!,
                    ).takeIf { it.isNotEmpty() }
                } ?: emptyList()
                val resolutions = search(isWidened = false).ifEmpty { search(isWidened = true) }
                if (resolutions.size > 1) {
                    throw SemanticException(position, "Ambiguous function call for `${function.member.name}`. ${resolutions.size} candidates match:\n${resolutions.joinToString("") { "- ${it.toDisplayableSignature()}\n" }}")
                }
                val resolution = resolutions.firstOrNull()
                    ?: throw SemanticException(position, "No matching function `${function.member.name}` found for type ${receiverType.nameWithNullable} and the argument types (${describeArgumentTypes()})")
                fun isProvisional(type: TypeNode?): Boolean = type != null &&
                    (type.name == "<Repeated>" && type.arguments?.firstOrNull()?.name?.startsWith(PROVISIONAL_TYPE_PREFIX) == true ||
                        type.arguments.orEmpty().any { isProvisional(it) })
                // Only a receiver that stayed provisional is analyzed again; others are complete.
                if (chainedReceiver != null && isProvisional(chainedReceiver.returnType)) {
                    val names = (resolution.typeParameters + resolution.extraTypeParameters).map { it.name }.toSet()
                    val found = mutableMapOf<String, TypeNode>()
                    fun unify(declared: TypeNode, target: TypeNode) {
                        if (declared.name in names && declared.arguments.isNullOrEmpty()) { found.getOrPut(declared.name) { target }; return }
                        val declaredArguments = declared.arguments ?: return
                        val targetArguments = target.arguments ?: return
                        if (declared.name == target.name && declaredArguments.size == targetArguments.size) declaredArguments.indices.forEach { unify(declaredArguments[it], targetArguments[it]) }
                    }
                    unify(resolution.returnType, expectedReturnType!!)
                    val expectedReceiver = resolution.receiverType?.resolveGenericParameterTypeArguments(found)
                    if (expectedReceiver != null && isConcreteType(expectedReceiver)) chainedReceiver.expectedReturnType = expectedReceiver
                    chainedReceiver.visit(modifier = modifier)
                }

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
                    // `Box.f()` calls the companion object of the generic class `Box` (RT-67)
                    val subjectType = function.subject.type().unboxClassTypeAsCompanion().toDataType()
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
                            val nested = (argumentType.arguments ?: return@forEach)[it.index]
                            // a placeholder for a type not analyzed yet tells nothing (RT-100)
                            if (nested.name == "<Repeated>") return@forEach
                            inferTypeArgumentFromOtherArgument(it.value, nested)
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
                    // the provisional type of a call not analyzed yet tells nothing (RT-100)
                    fun isProvisional(type: TypeNode): Boolean = type.name == "<Repeated>" || type.arguments.orEmpty().any { isProvisional(it) }
                    if (callArg.value is FunctionCallNode && isProvisional(argumentType)) return@forEachIndexed
                    inferTypeArgumentFromOtherArgument(parameterType = parameterType, argumentType = argumentType)
                }
                if (functionArgumentAndReturnTypeDeclarations.receiverType != null) {
                    val parameterType = functionArgumentAndReturnTypeDeclarations.receiverType
                    val argumentType =
                        (function as NavigationNode).subject.type(ResolveTypeModifier(isSkipGenerics = isSkipGenerics))
                            .unboxClassTypeAsCompanion()
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
                        // An invariant receiver argument fixes its type parameter, so that
                        // arguments cannot widen it: `mutableListOf(1).add("x")` stays an
                        // error instead of becoming a MutableList<Comparable<*>> (RT-106).
                        parameterType.arguments?.forEachIndexed { index, argument ->
                            if (argument.name !in tpUpperBounds || !argument.arguments.isNullOrEmpty()) return@forEachIndexed
                            if (type.clazz.typeParameters.getOrNull(index)?.variance != Variance.Invariant) return@forEachIndexed
                            val exact = type.arguments.getOrNull(index) ?: return@forEachIndexed
                            if (exact is RepeatedType && exact.actualType == null) return@forEachIndexed
                            tpResolutions[argument.name] = exact.toTypeNode()
                        }
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
        // Type arguments only the expected type determines are known before lambda arguments are
        // analyzed, so that `val c: Comparator<P> = compareBy { it.alter }` gives `it` its type
        // (RT-95). A call nested in an argument is analyzed without an expected type.
        expectedReturnType?.let { expected ->
            if (declaredTypeArguments.isNotEmpty() || typeParameters.isEmpty()) return@let
            fun unifyEarly(declared: TypeNode, target: TypeNode) {
                if (typeParameters.any { it.name == declared.name } && declared.arguments.isNullOrEmpty()) {
                    // a placeholder of a lambda not analyzed yet does not count as inferred (RT-100)
                    if (tpResolutions[declared.name].let { it == null || it.name == "<Repeated>" }) {
                        tpResolutions[declared.name] = target.copy(isNullable = target.isNullable && !declared.isNullable)
                    }
                    return
                }
                val declaredArguments = declared.arguments ?: return
                val targetArguments = target.arguments ?: return
                if (declared.name == target.name && declaredArguments.size == targetArguments.size) declaredArguments.indices.forEach { unifyEarly(declaredArguments[it], targetArguments[it]) }
            }
            unifyEarly(functionArgumentAndReturnTypeDeclarations.returnType, expected)
            if (tpResolutions.isNotEmpty()) {
                inferredTypeArguments = typeParameters.map { tpResolutions[it.name] }
                typeArgumentByName = tpResolutions
            }
        }
        argumentInfos = evaluateArguments() // update upper bounds of generic lambda

        // In the first pass of an enclosing call, a type parameter only that call determines
        // (`sortedWith(compareBy { it.alter })`, `sortedWith(reverseOrder())`) is still open. The
        // call answers a provisional type that matches any overload, and analyzes its lambdas in
        // the second pass, when the enclosing call passes the expected type (RT-100).
        if (modifier.isSkipGenerics && declaredTypeArguments.isEmpty()) {
            val open = typeParameters.map { it.name }.filter { tpResolutions[it].let { t -> t == null || t.name == "<Repeated>" } }.toSet()
            fun mentionsOpen(type: TypeNode?): Boolean = type != null && (type.name in open ||
                type.arguments.orEmpty().any { mentionsOpen(it) } ||
                (type is FunctionTypeNode && (type.parameterTypes.orEmpty().any { mentionsOpen(it) } || mentionsOpen(type.receiverType))))
            val lambdaParameterTypes = arguments.indices.filter { arguments[it].value is LambdaLiteralNode }.map { i ->
                ((functionArgumentAndReturnTypeDeclarations.valueParameters[callArgumentMappedIndexes[i]] as? FunctionValueParameterNode)?.type as? FunctionTypeNode)
            }
            val dependsOnOpen = lambdaParameterTypes.isEmpty() ||
                lambdaParameterTypes.any { it == null || it.parameterTypes.orEmpty().any { p -> mentionsOpen(p) } || mentionsOpen(it.receiverType) }
            if (open.isNotEmpty() && dependsOnOpen) {
                returnType = functionArgumentAndReturnTypeDeclarations.returnType.resolveGenericParameterTypeArguments(
                    tpResolutions.filterKeys { it !in extraTypeResolutions && it !in open } + open.associateWith { TypeNode.createRepeatedTypeNode("$PROVISIONAL_TYPE_PREFIX$it>") }
                )
                popScope()
                return
            }
        }

//        if (typeArguments.size != functionArgumentAndReturnTypeDeclarations.typeParameters.size) {
//            throw SemanticException("Number of type arguments does not match with number of type parameters of the matched callable")
//        }

        arguments.forEachIndexed { i, callArgument ->
            val functionArgumentType = argumentInfos[callArgumentMappedIndexes[i]].type
            if (callArgument.value is LambdaLiteralNode && functionArgumentType is FunctionType) {
                // a function reference takes its parameters from the expected type (RT-89)
                if (callArgument.value.referenceName == null && callArgument.value.valueParameters.size != functionArgumentType.arguments.size && !(callArgument.value.valueParameters.isEmpty() && functionArgumentType.arguments.size == 1)) {
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

        // A call as argument gets the parameter type as expected type before its second pass,
        // e.g. `Comparator<Person>` for `compareBy { it.alter }` in `personen.sortedWith(…)` (RT-100).
        arguments.forEachIndexed { i, argument ->
            val nested = argument.value as? FunctionCallNode ?: return@forEachIndexed
            if (nested.expectedReturnType != null) return@forEachIndexed
            val expected = argumentInfos[callArgumentMappedIndexes[i]].type.toTypeNode()
            if (isConcreteType(expected)) nested.expectedReturnType = expected
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
        // An inferred type argument that fits into the expected one is widened to it,
        // as the expected type also constrains Kotlin's inference:
        // `val m: MutableList<Any> = mutableListOf(1, 2)` (RT-107).
        if (expectedType != null && declaredTypeArguments.isEmpty()) {
            val resolved = (inferredTypeArguments ?: typeParameters.map { null }).toMutableList()
            val ownTypeParameters = typeParameters.map { it.name }.toSet()
            fun open(type: TypeNode): Boolean = type is FunctionTypeNode || type.name in ownTypeParameters ||
                type.name.startsWith("<") || type.arguments.orEmpty().any { open(it) }
            fun widens(current: TypeNode, expected: TypeNode): Boolean = !open(current) && !open(expected) &&
                try {
                    currentScope.assertToDataType(expected).isConvertibleFrom(currentScope.assertToDataType(current))
                } catch (_: Exception) {
                    false
                }
            fun unify(declared: TypeNode, target: TypeNode) {
                val index = typeParameters.indexOfFirst { it.name == declared.name }
                if (index >= 0 && declared.arguments.isNullOrEmpty()) {
                    val expectedArgument = target.copy(isNullable = target.isNullable && !declared.isNullable)
                    val current = resolved[index]
                    if (current == null) resolved[index] = expectedArgument
                    else if (current != expectedArgument && widens(current, expectedArgument)) resolved[index] = expectedArgument
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
                // Type parameters resolved through the receiver are replaced already; replacing them
                // again would also replace a caller's type parameter of the same name, e.g. `T` in
                // `List<List<T>>[0]`, which is a `List<T>` (RT-93).
                returnType.resolveGenericParameterTypeArguments(typeArgumentByName.filterKeys { it !in extraTypeResolutions })
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
        requireWhenValue(value)
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
                addSmartCasts(smartCastsAfter(it))
            }
            if (format == FunctionBodyFormat.Expression) requireWhenValue(statements.singleOrNull())

            returnType = type()
            blockEndSmartCasts = smartCasts.keys.mapNotNull { key -> activeSmartCast(key)?.let { key to SmartCastFact(key, it.type, it.isMutable) } }.toMap()
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

        // `return emptyList()` takes its type arguments from the declared return type (RT-93).
        if (declaredReturnType != null && declaredReturnType !is UnitType) propagateExpectedType(value, declaredReturnType.toTypeNode())
        value?.visit(modifier = modifier)
        requireWhenValue(value)
        val valueType = value?.type()?.toDataType() ?: UnitType()
        if (declaredReturnType != null && valueType !is NothingType && !declaredReturnType.isAssignableFrom(valueType)) {
            throw TypeMismatchException(position, declaredReturnType.descriptiveName, valueType.descriptiveName)
        }
    }

    /** Labels of the loops being analyzed, innermost last; null for a loop without label (RT-85). */
    private val loopLabels = mutableListOf<String?>()

    private inline fun <T> inLoop(label: String?, visit: () -> T): T {
        loopLabels += label
        loopBreaks += false
        try {
            return visit()
        } finally {
            loopLabels.removeLast()
            lastLoopHadBreak = loopBreaks.removeLast()
        }
    }

    /** Whether a `break` leaves the loop being visited, per entry of [loopLabels]. */
    private val loopBreaks = mutableListOf<Boolean>()

    /** Whether the loop visited last contains a `break` that leaves it. */
    private var lastLoopHadBreak = false

    fun checkBreakOrContinueScope(statement: ASTNode, label: String = "") {
        if (label.isNotEmpty() && label !in loopLabels) {
            throw SemanticException(statement.position, "There is no loop with the label `$label`")
        }
        var s: SymbolTable = currentScope
        while (!s.scopeType.isLoop()) {
            if (s.scopeType in setOf(ScopeType.Script, ScopeType.Function) || s.parentScope == null) {
                throw SemanticException(statement.position, "`break` statement should be within a loop")
            }
            s = s.parentScope!!
        }
    }

    fun BreakNode.visit(modifier: Modifier = Modifier()) {
        checkBreakOrContinueScope(this, returnToLabel)
        val target = if (returnToLabel.isEmpty()) loopBreaks.lastIndex else loopLabels.lastIndexOf(returnToLabel)
        if (target >= 0) loopBreaks[target] = true
    }

    fun ContinueNode.visit(modifier: Modifier = Modifier()) {
        checkBreakOrContinueScope(this, returnToLabel)
    }

    fun IfNode.visit(modifier: Modifier = Modifier()) {
        condition.visit(modifier = modifier)
        val whenTrue = smartCastsWhenTrue(condition)
        val whenFalse = smartCastsWhenFalse(condition)
        val trueEnd = withSmartCasts(whenTrue) { trueBlock?.visit(modifier = modifier); if (trueBlock != null) blockEndSmartCasts else null }
        val falseEnd = withSmartCasts(whenFalse) { falseBlock?.visit(modifier = modifier); if (falseBlock != null) blockEndSmartCasts else null }

        // After `if (value == null) return ...`, Kotlin smart-casts value
        // for the remainder of the surrounding block (see BlockNode.visit).
        val trueBlockNeverCompletes = blockNeverCompletes(trueBlock)
        val falseBlockNeverCompletes = blockNeverCompletes(falseBlock)
        // The narrowings at the end of a branch, not of its condition: the branch may assign (RT-99).
        val trueFacts = trueEnd ?: whenTrue.associateBy { it.key }
        val falseFacts = falseEnd ?: whenFalse.associateBy { it.key }
        if (trueBlockNeverCompletes && !falseBlockNeverCompletes) addSmartCasts(falseFacts.values.toList())
        if (falseBlockNeverCompletes && !trueBlockNeverCompletes) addSmartCasts(trueFacts.values.toList())
        // A narrowing that holds at the end of both branches holds afterwards, e.g. after
        // `if (s == null) s = "neu"` (RT-99).
        if (!trueBlockNeverCompletes && !falseBlockNeverCompletes) {
            addSmartCasts(trueFacts.values.filter { fact ->
                val other = falseFacts[fact.key]
                other != null && !fact.type.isNullable && !other.type.isNullable && fact.type.descriptiveName() == other.type.descriptiveName()
            })
        }
    }

    fun WhileNode.visit(modifier: Modifier = Modifier()) {
        condition.visit(modifier = modifier)
        inLoop(label) { withSmartCasts(smartCastsWhenTrue(condition)) { body?.visit(modifier = modifier) } }
        // Left without `break`, the condition was false: `while (zahl == null) { zahl = … }` (RT-99)
        if (!lastLoopHadBreak) addSmartCasts(smartCastsWhenFalse(condition))
    }

    fun DoWhileNode.visit(modifier: Modifier = Modifier()) {
        condition.visit(modifier = modifier)
        inLoop(label) { body?.visit(modifier = modifier) }
        if (!lastLoopHadBreak) addSmartCasts(smartCastsWhenFalse(condition))
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
                    if (clazz.isPrivateMemberProperty(memberName) && !canAccessPrivateMembersOf(clazz.findMemberPropertyOwnerName(memberName))) {
                        throw SemanticException(position, "Private property `$memberName` cannot be accessed here")
                    }
                    if (clazz.isProtectedMemberProperty(memberName) && !canAccessProtectedMembersOf(clazz.findMemberPropertyOwnerName(memberName))) {
                        throw SemanticException(position, "Protected property `$memberName` cannot be accessed here")
                    }
                    if (isCheckWriteAccess && !property.isMutable) {
                        throw SemanticException(position, "val `$memberName` cannot be reassigned")
                    }
                    memberType = NavigationNode.MemberType.Direct
                    return subjectType
                }
                clazz.findMemberPropertyCustomAccessor(memberName)?.let { accessor ->
                    if (clazz.isPrivateMemberProperty(memberName) && !canAccessPrivateMembersOf(clazz.findMemberPropertyOwnerName(memberName))) {
                        throw SemanticException(position, "Private property `$memberName` cannot be accessed here")
                    }
                    if (clazz.isProtectedMemberProperty(memberName) && !canAccessProtectedMembersOf(clazz.findMemberPropertyOwnerName(memberName))) {
                        throw SemanticException(position, "Protected property `$memberName` cannot be accessed here")
                    }
                    if (isCheckWriteAccess && clazz.findMemberProperty(memberName)?.isMutable == false) {
                        throw SemanticException(position, "val `$memberName` cannot be reassigned")
                    }
                    if (isCheckWriteAccess) {
                        if (accessor.setterIsPrivate && !canAccessPrivateMembersOf(clazz.findMemberPropertyOwnerName(memberName))) {
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
                    if (functions.values.all { (function, owner) -> FunctionModifier.private in function.modifiers && !canAccessPrivateMembersOf(owner) }) {
                        throw SemanticException(position, "Private function `$memberName` cannot be accessed here")
                    }
                    if (functions.values.all { (function, owner) -> FunctionModifier.protected in function.modifiers && !canAccessProtectedMembersOf(owner) }) {
                        throw SemanticException(position, "Protected function `$memberName` cannot be accessed here")
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
                add(CustomFunctionDeclarationNode(CustomFunctionDefinition(
                    position = node.position,
                    receiverType = "${node.fullQualifiedName}.Companion",
                    functionName = "values",
                    returnType = "List<${classType.descriptiveName()}>",
                    parameterTypes = emptyList(),
                    executable = { _, _, _, _ -> throw NotImplementedError() }
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
            // Like Kotlin, an enum class may implement interfaces (it is `Comparable`, RT-84), but not extend a class.
            superInvocations?.firstOrNull { it is FunctionCallNode }?.let {
                throw SemanticException(it.position, "Enum class cannot inherit from classes")
            }
        }
        if (ClassModifier.abstract in modifiers) {
            inferredModifiers += ClassModifier.open
        }
        if (isInterface) {
            val unsupportedModifiers = modifiers - setOf(ClassModifier.abstract, ClassModifier.open, ClassModifier.sealed)
            if (unsupportedModifiers.isNotEmpty()) {
                throw SemanticException(position, "Modifiers ${unsupportedModifiers.joinToString(", ")} are not applicable to interfaces")
            }
            inferredModifiers += ClassModifier.open
            inferredModifiers += ClassModifier.abstract
        }

        val declared = declaredClasses[position]?.takeIf { it.node === this }
        if (declared == null) {
            // Objects keep their single instance in their class definition, which a local declaration recreates.
            if (isObject) throw SemanticException(position, "An object can only be declared at the top level of a file")
            companionObject?.let { throw SemanticException(it.position, "A companion object is only allowed in a class declared at the top level of a file") }
            nestedClasses.firstOrNull()?.let { throw SemanticException(it.position, "A nested class is only allowed in a class declared at the top level of a file") }
            declarationScope.declareClass(position, nullableClassDefinition(this).also { it.attachToSemanticAnalyzer(this@SemanticAnalyzer) })
            declarationScope.declareClass(position, companionClassDefinition(this, classType).also { it.attachToSemanticAnalyzer(this@SemanticAnalyzer) })
        } else {
            declared.companion?.attachToSemanticAnalyzer(this@SemanticAnalyzer)
        }
        if (!isObject) {
            declarations.firstOrNull { it is PropertyDeclarationNode && PropertyModifier.const in it.modifiers }?.let {
                throw SemanticException(it.position, "Const 'val' are only allowed on top level, in objects or in companion objects")
            }
        }
        // A class declared ahead reuses the scopes its definition was created with.
        fun pushClassScope(index: Int) {
            if (declared != null) pushScope(declared.scopes[index]) else pushScope(name, ScopeType.Class)
        }

        if (ClassModifier.enum in modifiers) {
            listOf(
                Triple("entries", "$fullQualifiedClassName.Companion", "List<${classType.descriptiveName()}>"),
                // RT-78
                Triple("name", fullQualifiedClassName, "String"),
                Triple("ordinal", fullQualifiedClassName, "Int"),
            ).forEach { (propertyName, receiver, type) ->
                ExtensionProperty(
                    declaredName = propertyName,
                    receiver = receiver,
                    type = type,
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
        }

        // Plain names reach the companion members of this class and then of its superclasses (RT-67).
        val companionScopes = buildList {
            var superClass = declared?.definition?.superClass
            while (superClass != null) {
                declaredClasses.values.firstOrNull { it.definition === superClass }?.companionScope?.let { add(0, it) }
                superClass = superClass.superClass
            }
            declared?.companionScope?.let { add(it) }
        }
        val outerScopes = declared?.outerScopes.orEmpty()
        outerScopes.forEach { pushScope(it) }
        companionScopes.forEach { pushScope(it) }
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
        // The properties of the interfaces of this class and its superclasses (RT-79).
        val interfaceProperties = buildSet {
            val pending = ArrayDeque(superInterfaces + generateSequence(superClass) { it.superClass }.flatMap { it.superInterfaces })
            while (pending.isNotEmpty()) {
                val superInterface = pending.removeFirst()
                superInterface.declarations.filterIsInstance<PropertyDeclarationNode>().forEach { add(it.name) }
                pending += superInterface.superInterfaces
            }
        }

        fun checkForOverriddenProperties(property: PropertyDeclarationNode) {
            if (superClassProperties?.containsKey(property.name) != true && property.name in interfaceProperties) {
                if (PropertyModifier.override !in property.modifiers) {
                    throw SemanticException(property.position, "A property cannot override anything without the `override` modifier")
                }
            } else if (superClassProperties?.containsKey(property.name) == true) {
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
            // A default argument may use the companion (`= START`), whose code may use the constructor
            // properties: they get their declared types before (RT-67), their names below.
            if (declared?.companionDeclared != null) {
                primaryConstructor?.parameters?.filter { it.isProperty }?.forEach {
                    declared.definition.addProperty(currentScope, PropertyDeclarationNode(
                        position = it.parameter.position,
                        name = it.parameter.name,
                        declaredModifiers = it.modifiers,
                        typeParameters = emptyList(),
                        receiver = classType,
                        declaredType = it.parameter.declaredType,
                        isMutable = it.isMutable,
                        initialValue = null,
                    ))
                }
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
                        // A function with a body is a default implementation (RT-79).
                        is FunctionDeclarationNode -> {
                            if (it.body == null) it.inferredModifiers += FunctionModifier.abstract
                            it.inferredModifiers += FunctionModifier.open
                        }
                        // an abstract property, which implementing classes override (RT-79)
                        is PropertyDeclarationNode -> {
                            if (it.initialValue != null) throw SemanticException(it.position, "Property initializers are not allowed in interfaces")
                            if (it.accessors != null) throw SemanticException(it.position, "Properties with accessors in interfaces are not supported in BlueK")
                            it.inferredModifiers += PropertyModifier.abstract
                            it.inferredModifiers += PropertyModifier.open
                        }
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
            // `name` and `ordinal` of an enum entry also without `this.` in its class (RT-78)
            if (ClassModifier.enum in modifiers) {
                currentScope.findExtensionPropertyByReceiver(TypeNode(position, fullQualifiedClassName, null, false))
                    .filter { it.second.declaredName in setOf("name", "ordinal") && !currentScope.hasProperty(it.second.declaredName, isThisScopeOnly = true) }
                    .forEach {
                        currentScope.declareProperty(position, it.second.declaredName, it.second.typeNode!!, false)
                        currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, it.second.transformedName!!, it.second.declaredName)
                        currentScope.declarePropertyOwner(it.second.transformedName!!, "this/$fullQualifiedClassName", extensionPropertyRef = it.first)
                    }
            }

            classDefinition.superClassInvocation?.let { superClassInvocation ->
                currentScope.declareProperty(position, "super", superClassInvocation.type(), false)
                currentScope.registerTransformedSymbol(position, IdentifierClassifier.Property, "super", "super")
            }

            primaryConstructor?.parameters
                ?.filter { it.isProperty }
                ?.map { it.parameter }
                ?.forEach { currentScope.declarePropertyOwner(it.transformedRefName!!, "this/$fullQualifiedClassName") }
            declarations.filterIsInstance<FunctionDeclarationNode>()
                .forEach { currentScope.declareFunctionOwner(it.name, it, "this/$fullQualifiedClassName") }
            // A member function without return type is analyzed as soon as other code needs its type,
            // like in Kotlin `fun a() = b(); fun b() = 1` (RT-68); the loop below then skips it.
            val analyzedFunctions = mutableSetOf<FunctionDeclarationNode>()
            val failedFunctions = mutableMapOf<FunctionDeclarationNode, Throwable>()
            val memberScope = currentScope
            declared?.let { topLevelIndexByPosition[it.node.position] }?.let { classIndex ->
                declarations.filterIsInstance<FunctionDeclarationNode>()
                    .filter { it.declaredReturnType == null && it.inferredReturnType == null && it.body != null }
                    .forEach { function ->
                        function.returnTypeInference = {
                            if (analyzedFunctions.add(function)) analyzeAtTopLevel(classIndex) {
                                currentScope = memberScope
                                typeParameters.forEach { activeReifiedTypeParameters[it.name] = false }
                                try {
                                    function.isInferringReturnType = true
                                    function.visit(modifier = modifier, isClassMemberFunction = true)
                                } catch (e: Throwable) {
                                    // reported again in its turn, even if the code that needed it catches it
                                    failedFunctions[function] = e
                                    throw e
                                } finally {
                                    function.isInferringReturnType = false
                                }
                            }
                        }
                    }
            }

            // Like Kotlin: a property needs a value unless an init block assigns it
            // (the latter is checked at runtime) or a getter computes it.
            if (declarations.none { it is ClassInstanceInitializerNode }) {
                declarations.filterIsInstance<PropertyDeclarationNode>()
                    .firstOrNull { it.initialValue == null && it.accessors?.getter == null && PropertyModifier.abstract !in it.modifiers && PropertyModifier.lateinit !in it.modifiers }
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

                    thisFunc.returnTypeInference = null
                    failedFunctions[thisFunc]?.let { throw it }
                    if (analyzedFunctions.add(thisFunc)) {
                        thisFunc.isInferringReturnType = true
                        try {
                            thisFunc.visit(modifier = modifier, isClassMemberFunction = true)
                        } finally {
                            thisFunc.isInferringReturnType = false
                        }
                    }

                    // check type after type inference: like Kotlin, an override may return a subtype
                    // (`override fun nachwuchs(): Hund` for `open fun nachwuchs(): Tier`, RT-76)
                    identicalSuperClassFunctions.forEach { superFunc ->
                        val overriddenType = currentScope.assertToDataType(superFunc.resolvedReturnType)
                        if (!overriddenType.isAssignableFrom(currentScope.assertToDataType(thisFunc.returnType))) {
                            throw SemanticException(thisFunc.position, "Return type `${thisFunc.returnType.descriptiveName()}` of function `${thisFunc.name}` is not a subtype of the overridden return type `${superFunc.resolvedReturnType.descriptiveName()}`")
                        }
                    }
                }

            // A concrete class implements every abstract property of its supertypes, also as a
            // constructor property (`class Hund(override val laut: String) : Tier()`, RT-79).
            if (!isInterface && ClassModifier.abstract !in modifiers) {
                val implemented = mutableSetOf<String>()
                val missing = mutableListOf<String>()
                val interfaces = ArrayDeque<ClassDefinition>()
                var current: ClassDefinition? = classDefinition
                while (current != null) {
                    current.primaryConstructor?.parameters?.filter { it.isProperty }?.forEach { implemented += it.parameter.name }
                    current.declarations.filterIsInstance<PropertyDeclarationNode>().forEach {
                        if (PropertyModifier.abstract in it.modifiers) {
                            if (it.name !in implemented) missing += it.name
                        } else {
                            implemented += it.name
                        }
                    }
                    interfaces += current.superInterfaces
                    current = current.superClass
                }
                while (interfaces.isNotEmpty()) {
                    val superInterface = interfaces.removeFirst()
                    superInterface.declarations.filterIsInstance<PropertyDeclarationNode>().forEach { if (it.name !in implemented) missing += it.name }
                    interfaces += superInterface.superInterfaces
                }
                missing.firstOrNull()?.let {
                    throw SemanticException(position, "Class `$name` is not abstract and does not implement the abstract property `$it`")
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
        companionScopes.forEach { _ -> popScope() }
        outerScopes.forEach { _ -> popScope() }

        if (currentScope !== declarationScope) {
            throw RuntimeException("Original scope is not restored")
        }
        declared?.companionDeclared?.let { analyzeDeclaredClass(it, isOnDemand = true) }
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

    /**
     * The parameters and the call of a function reference (RT-89). The parameter types come from
     * the expected function type, or, for `::f` without one, from the only function `f`.
     * `Typ::f` passes the first parameter as receiver (`String::length`, `Karte::wert`),
     * `objekt::f` calls `f` on that object.
     */
    private fun LambdaLiteralNode.buildFunctionReference() {
        val name = referenceName!!
        val receiver = referenceReceiver
        val shown = "${receiver ?: ""}::$name"
        val types = parameterTypesUpperBound ?: run {
            if (receiver != null) throw SemanticException(position, "`$shown` needs an expected function type here, e.g. as the argument of `map`")
            val functions = currentScope.findFunctionsByOriginalName(name)
            val function = functions.singleOrNull()?.first
                ?: throw SemanticException(position, if (functions.isEmpty()) "`$shown`: there is no function `$name`" else "`$shown` is ambiguous here: give the variable a function type")
            function.valueParameters.map { it.type }
        }
        val parameters = types.mapIndexed { index, type -> FunctionValueParameterNode(position, "__ref$index", type, null, emptySet()) }
        referenceParameters = parameters
        fun argument(index: Int, parameter: FunctionValueParameterNode) =
            FunctionCallArgumentNode(position = position, index = index, value = VariableReferenceNode(position, parameter.name))
        val isTypeReceiver = receiver != null && !currentScope.hasProperty(receiver) && currentScope.findClass(receiver) != null
        val call: ASTNode = when {
            receiver == null -> FunctionCallNode(VariableReferenceNode(position, name), parameters.mapIndexed(::argument), emptyList(), position)
            isTypeReceiver -> {
                if (parameters.isEmpty()) throw SemanticException(position, "`$shown` needs the object as its first parameter")
                val subject = VariableReferenceNode(position, parameters.first().name)
                val member = NavigationNode(position, subject, ".", ClassMemberReferenceNode(position, name))
                val receiverType = currentScope.assertToDataType(types.first())
                val hasFunction = currentScope.findMatchingCallables(currentScope, name, receiverType, emptyList(), SearchFunctionModifier.NoRestriction).isNotEmpty()
                if (parameters.size == 1 && !hasFunction) member
                else FunctionCallNode(member, parameters.drop(1).mapIndexed { index, parameter -> argument(index, parameter) }, emptyList(), position)
            }
            else -> FunctionCallNode(
                NavigationNode(position, VariableReferenceNode(position, receiver), ".", ClassMemberReferenceNode(position, name)),
                parameters.mapIndexed(::argument), emptyList(), position,
            )
        }
        (body.statements as MutableList<ASTNode>)[0] = call
    }

    private fun LambdaLiteralNode.visitLambda(modifier: Modifier) {
//        val type = type() as FunctionTypeNode

        symbolRecorders += SymbolReferenceSet(scopeLevel = currentScope.scopeLevel)
        pushScope(
            scopeName = labelName?.let { "$it@" } ?: "<lambda>",
            scopeType = ScopeType.Closure,
            returnType = returnTypeUpperBound?.toDataType() //type.returnType.toDataType(),
        )

        if (referenceName != null) buildFunctionReference()

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
        // `getOrPut(k) { mutableListOf() }`: the lambda's result takes its type arguments from the
        // expected return type, like a declaration (RT-100)
        val resultCall = body.statements.lastOrNull() as? FunctionCallNode
        val expectedResult = returnTypeUpperBound
        if (resultCall != null && resultCall.expectedReturnType == null && expectedResult != null && isConcreteType(expectedResult)) {
            resultCall.expectedReturnType = expectedResult
        }
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
        // `karten[name] ?: emptyList()`: the fallback may take its type arguments from the primary side (RT-93).
        val fallback = fallbackNode
        if (fallback is FunctionCallNode && fallback.expectedReturnType == null) {
            primaryNode.type().takeIf { it.name != "Nothing" }?.let { fallback.expectedReturnType = it.copy(isNullable = false) }
        }
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
        if (numOfElse > 1) {
            throw SemanticException(position, "`when` expression can only contain one `else` branch")
        }
        val elseIndex = entries.indexOfFirst { it.isElseCondition() }
        if (numOfElse == 1 && elseIndex != entries.lastIndex) {
            throw SemanticException(entries[elseIndex].position, "`else` branch must be the last branch of a `when` expression")
        }

        var smartCastsFromEarlierEntries = emptyList<SmartCastFact>()
        entries.forEach {
            smartCastsFromEarlierEntries += it.visit(modifier = modifier, subject = subject, smartCastsFromEarlierEntries = smartCastsFromEarlierEntries)
        }

        // Like Kotlin, `else` is only needed when the value is used and the entries do not cover every
        // value (see requireWhenValue). Otherwise the `when` is a statement whose value is `Unit`.
        isExhaustive = numOfElse == 1 || coversAllSubjectValues()
        type = if (isExhaustive && entries.isNotEmpty()) {
            superTypeOf(*entries.map { it.bodyType }.toTypedArray())
        } else {
            typeRegistry["Unit"]!!
        }

        popScope()
    }

    /** All entries of an enum, or `true` and `false`; and `null` for a nullable subject. */
    private fun WhenNode.coversAllSubjectValues(): Boolean {
        val subjectType = subject?.type ?: return false
        val values = entries.flatMap { it.conditions }
            .filter { it.testType == WhenConditionNode.TestType.Regular && !it.isNegateResult }
            .map { it.expression }
        if (subjectType.isNullable && values.none { it is NullNode }) return false
        if (subjectType.name == "Boolean") {
            return values.any { it is BooleanNode && it.value } && values.any { it is BooleanNode && !it.value }
        }
        val subjectClass = currentScope.findClass(subjectType.name)?.first ?: return false
        if (ClassModifier.sealed in subjectClass.modifiers) return coversSealedClass(subjectClass)
        val enumClass = subjectClass.takeIf { ClassModifier.enum in it.modifiers } ?: return false
        // Inside its own class the entries are not created yet: take them from the declaration.
        val entries = declaredClasses.values.firstOrNull { it.definition === enumClass }?.node?.enumEntries?.map { it.name }
            ?: enumClass.enumValues.keys.toList()
        if (entries.isEmpty()) return false
        val covered = values.mapNotNull { value ->
            when (value) {
                is NavigationNode -> value
                    .takeIf { it.memberType == NavigationNode.MemberType.Enum && (it.subject as? VariableReferenceNode)?.variableName == enumClass.fullQualifiedName }
                    ?.member?.name
                // an entry named without its class inside the enum class (RT-78)
                is VariableReferenceNode -> value.transformedRefName
                    ?.takeIf { it.startsWith("$ENUM_REF_PREFIX${enumClass.fullQualifiedName}/") }
                    ?.substringAfterLast('/')
                else -> null
            }
        }.toSet()
        return covered.containsAll(entries)
    }

    /**
     * Whether the entries cover every subclass of a sealed class or interface (RT-86): `is X` for
     * it or a supertype, the object itself for an `object` subclass, or all subclasses of a sealed one.
     */
    private fun WhenNode.coversSealedClass(sealed: ClassDefinition): Boolean {
        val conditions = entries.flatMap { it.conditions }.filter { !it.isNegateResult }
        val testedTypes = conditions.filter { it.testType == WhenConditionNode.TestType.TypeTest }
            .mapNotNull { (it.expression as? TypeNode)?.let { type -> currentScope.findClass(type.name)?.first?.fullQualifiedName } }
        val objects = conditions.filter { it.testType == WhenConditionNode.TestType.Regular }
            .mapNotNull { (it.expression as? VariableReferenceNode)?.transformedRefName?.takeIf { name -> name.startsWith(OBJECT_REF_PREFIX) }?.removePrefix(OBJECT_REF_PREFIX) }
        fun ClassDefinition.isSameOrSubtypeOf(name: String): Boolean =
            fullQualifiedName == name || superClass?.isSameOrSubtypeOf(name) == true || superInterfaces.any { it.isSameOrSubtypeOf(name) }
        fun ClassDefinition.directSubclasses() = declaredClasses.values.map { it.definition }.filter { candidate ->
            candidate.superClass?.fullQualifiedName == fullQualifiedName || candidate.superInterfaces.any { it.fullQualifiedName == fullQualifiedName }
        }
        fun covers(clazz: ClassDefinition, seen: Set<String>): Boolean {
            if (testedTypes.any { clazz.isSameOrSubtypeOf(it) }) return true
            if (clazz.isObjectDeclaration && clazz.fullQualifiedName in objects) return true
            if (ClassModifier.sealed !in clazz.modifiers || clazz.fullQualifiedName in seen) return false
            val subclasses = clazz.directSubclasses()
            return subclasses.isNotEmpty() && subclasses.all { covers(it, seen + clazz.fullQualifiedName) }
        }
        return covers(sealed, emptySet())
    }

    /** Kotlin rejects a `when` without `else` whose value is used, unless it covers every value. */
    private fun requireWhenValue(node: ASTNode?) {
        if (node is WhenNode && !node.isExhaustive) {
            throw SemanticException(node.position, "'when' expression must be exhaustive. Add an 'else' branch.")
        }
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
        inLoop(label) { body.visit(modifier = modifier) }
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
            is DestructuringDeclarationNode -> throw IllegalStateException("Statement lists flatten destructuring declarations")
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
                ?: currentScope.findClass(variableName)?.let { (clazz, _) ->
                    if (clazz.isObjectDeclaration) TypeNode(position, clazz.fullQualifiedName, null, false)
                    else ClassTypeNode(TypeNode(position, variableName, null, false))
                }
                ?: error("Unable to resolve variable `$variableName`")
            ).let { resolvedType ->
                activeSmartCast(smartCastKey(this))?.type ?: resolvedType
            }.also { if (activeSmartCast(smartCastKey(this)) == null) type = it }

    fun IndexOpNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier()): TypeNode {
        return call!!.type(modifier = modifier)
    }

    fun NavigationNode.type(modifier: ResolveTypeModifier = ResolveTypeModifier(), lookupType: IdentifierClassifier = IdentifierClassifier.Property): TypeNode {
        type?.let { return it }
        if (lookupType == IdentifierClassifier.Property && smartCasts.isNotEmpty()) {
            propertySmartCastKey(this)?.let { activeSmartCast(it) }?.let { return it.type.also { type = it } }
        }
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
        } else if (neverCompletes(fallbackNode)) {
            // `x ?: return 0` is of the type of `x`: the `return` is of type `Nothing` (RT-99)
            type1
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
                                // Like Kotlin's least upper bound: equal arguments stay,
                                // covariant ones (`List<out T>`) take their common supertype
                                // and others become a star projection, so `listOf(1, true)`
                                // is a `List<Comparable<*>>` instead of a mismatch.
                                return TypeNode(
                                    position = SourcePosition.NONE,
                                    name = superType1.name,
                                    arguments = superType1.arguments.mapIndexed { index, it ->
                                        val other = superType2.arguments[index]
                                        when {
                                            // RepeatedType's equals ignores which type it stands for
                                            it == other && it.descriptiveName == other.descriptiveName -> it.toTypeNode()
                                            superType1.clazz.typeParameters.getOrNull(index)?.variance == Variance.Covariant ->
                                                superTypeOf(it.toTypeNode(), other.toTypeNode(), visitCache)
                                            else -> TypeNode(SourcePosition.NONE, "*", null, false)
                                        }
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
