package com.sunnychung.lib.multiplatform.kotlite

import com.sunnychung.lib.multiplatform.kotlite.error.EvaluateNullPointerException
import com.sunnychung.lib.multiplatform.kotlite.error.EvaluateRuntimeException
import com.sunnychung.lib.multiplatform.kotlite.error.EvaluateTypeCastException
import com.sunnychung.lib.multiplatform.kotlite.error.InterpreterStateException
import com.sunnychung.lib.multiplatform.kotlite.error.controlflow.NormalBreakException
import com.sunnychung.lib.multiplatform.kotlite.error.controlflow.NormalContinueException
import com.sunnychung.lib.multiplatform.kotlite.error.controlflow.NormalReturnException
import com.sunnychung.lib.multiplatform.kotlite.extension.emptyToNull
import com.sunnychung.lib.multiplatform.kotlite.extension.fullClassName
import com.sunnychung.lib.multiplatform.kotlite.extension.isValidIntegerLiteralAssignToByte
import com.sunnychung.lib.multiplatform.kotlite.extension.resolveGenericParameterTypeArguments
import com.sunnychung.lib.multiplatform.kotlite.extension.resolveGenericParameterTypeToUpperBound
import com.sunnychung.lib.multiplatform.kotlite.model.DestructuringDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.ASTNode
import com.sunnychung.lib.multiplatform.kotlite.model.AbandonedNativeCall
import com.sunnychung.lib.multiplatform.kotlite.model.ArgumentValues
import com.sunnychung.lib.multiplatform.kotlite.model.SymbolMap
import com.sunnychung.lib.multiplatform.kotlite.model.acceptsRuntimeType
import com.sunnychung.lib.multiplatform.kotlite.model.AsOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.AssignmentNode
import com.sunnychung.lib.multiplatform.kotlite.model.BinaryOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.BlockNode
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanNode
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.BreakNode
import com.sunnychung.lib.multiplatform.kotlite.model.ByteValue
import com.sunnychung.lib.multiplatform.kotlite.model.CallStack
import com.sunnychung.lib.multiplatform.kotlite.model.CallableNode
import com.sunnychung.lib.multiplatform.kotlite.model.CallableType
import com.sunnychung.lib.multiplatform.kotlite.model.CatchNode
import com.sunnychung.lib.multiplatform.kotlite.model.CharNode
import com.sunnychung.lib.multiplatform.kotlite.model.CharValue
import com.sunnychung.lib.multiplatform.kotlite.model.ClassSecondaryConstructorNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
import com.sunnychung.lib.multiplatform.kotlite.model.OBJECT_REF_PREFIX
import com.sunnychung.lib.multiplatform.kotlite.model.ENUM_REF_PREFIX
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstanceInitializerNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassMemberReferenceNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassModifier
import com.sunnychung.lib.multiplatform.kotlite.model.ClassParameterNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassPrimaryConstructorNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassTypeNode
import com.sunnychung.lib.multiplatform.kotlite.model.ComparableRuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.ContinueNode
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.DataType
import com.sunnychung.lib.multiplatform.kotlite.model.DoWhileNode
import com.sunnychung.lib.multiplatform.kotlite.model.DoubleNode
import com.sunnychung.lib.multiplatform.kotlite.model.DoubleValue
import com.sunnychung.lib.multiplatform.kotlite.model.ElvisOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.EnumEntryNode
import com.sunnychung.lib.multiplatform.kotlite.model.ExceptionValue
import com.sunnychung.lib.multiplatform.kotlite.model.ExecutionEnvironment
import com.sunnychung.lib.multiplatform.kotlite.model.ExtensionProperty
import com.sunnychung.lib.multiplatform.kotlite.model.ForNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallArgumentNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallResult
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionType
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionTypeNode
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionValueParameterModifier
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionValueParameterNode
import com.sunnychung.lib.multiplatform.kotlite.model.IfNode
import com.sunnychung.lib.multiplatform.kotlite.model.IndexOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.InfixFunctionCallNode
import com.sunnychung.lib.multiplatform.kotlite.model.IntValue
import com.sunnychung.lib.multiplatform.kotlite.model.IntegerNode
import com.sunnychung.lib.multiplatform.kotlite.model.LabelNode
import com.sunnychung.lib.multiplatform.kotlite.model.LambdaLiteralNode
import com.sunnychung.lib.multiplatform.kotlite.model.LambdaValue
import com.sunnychung.lib.multiplatform.kotlite.model.ListValue
import com.sunnychung.lib.multiplatform.kotlite.model.LongNode
import com.sunnychung.lib.multiplatform.kotlite.model.LongValue
import com.sunnychung.lib.multiplatform.kotlite.model.NavigationNode
import com.sunnychung.lib.multiplatform.kotlite.model.NullNode
import com.sunnychung.lib.multiplatform.kotlite.model.NullValue
import com.sunnychung.lib.multiplatform.kotlite.model.NumberValue
import com.sunnychung.lib.multiplatform.kotlite.model.NothingType
import com.sunnychung.lib.multiplatform.kotlite.model.ObjectType
import com.sunnychung.lib.multiplatform.kotlite.model.PairValue
import com.sunnychung.lib.multiplatform.kotlite.model.PrimitiveTypeName
import com.sunnychung.lib.multiplatform.kotlite.model.PrimitiveValue
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyAccessorsNode
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.ReplayableNativeCall
import com.sunnychung.lib.multiplatform.kotlite.model.ReturnNode
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValueAccessor
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyModifier
import com.sunnychung.lib.multiplatform.kotlite.model.ScopeType
import com.sunnychung.lib.multiplatform.kotlite.model.ScriptNode
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.SpecialFunction
import com.sunnychung.lib.multiplatform.kotlite.model.StandardExceptionValue
import com.sunnychung.lib.multiplatform.kotlite.model.StringLiteralNode
import com.sunnychung.lib.multiplatform.kotlite.model.StringNode
import com.sunnychung.lib.multiplatform.kotlite.model.StringValue
import com.sunnychung.lib.multiplatform.kotlite.model.SuspendedCallback
import com.sunnychung.lib.multiplatform.kotlite.model.SymbolTable
import com.sunnychung.lib.multiplatform.kotlite.model.ThrowNode
import com.sunnychung.lib.multiplatform.kotlite.model.ThrowableValue
import com.sunnychung.lib.multiplatform.kotlite.model.TryNode
import com.sunnychung.lib.multiplatform.kotlite.model.TypeNode
import com.sunnychung.lib.multiplatform.kotlite.model.TypeParameterNode
import com.sunnychung.lib.multiplatform.kotlite.model.UnaryOpNode
import com.sunnychung.lib.multiplatform.kotlite.model.UnitType
import com.sunnychung.lib.multiplatform.kotlite.model.UnitValue
import com.sunnychung.lib.multiplatform.kotlite.model.ValueNode
import com.sunnychung.lib.multiplatform.kotlite.model.ValueParameterDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.VariableReferenceNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhenConditionNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhenEntryNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhenNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhenSubjectNode
import com.sunnychung.lib.multiplatform.kotlite.model.WhileNode
import com.sunnychung.lib.multiplatform.kotlite.util.ClassMemberResolver
import kotlin.coroutines.startCoroutine

open class Interpreter(val rootNode: ASTNode, val executionEnvironment: ExecutionEnvironment) {

    /**
     * Optional host scheduler for long-running loops. [isDue] is asked on every
     * loop iteration and must be cheap; only when it answers true does the
     * interpreter suspend in [yield], so that the host can process its events.
     */
    class CheckpointHook(val isDue: () -> Boolean, val yield: suspend () -> Unit)

    /** Used by interactive runtimes; see [CheckpointHook]. */
    var checkpointHook: CheckpointHook? = null

    /** Synchronous callbacks ([runImmediately]) currently on the stack. */
    private var synchronousCallbacks = 0

    /** Those of [synchronousCallbacks] that cannot be resumed by a replay. */
    private var nonResumableCallbacks = 0

    /** Replayable library code that is currently executing synchronously. */
    private var activeReplayableCall: ReplayableNativeCall? = null

    /**
     * Whether execution may suspend here. Hosts check this before suspending
     * (input, sleep): a callback of `toString`, `equals`, `compareTo` or of a
     * non-replayable library function must return synchronously.
     */
    val canSuspend: Boolean
        get() = nonResumableCallbacks == 0

    /**
     * A loop inside a synchronous callback never yields. Yielding there would
     * abandon (and later replay) the surrounding library call every few
     * iterations, or fail if it cannot be replayed.
     */
    suspend fun checkpoint() {
        val hook = checkpointHook ?: return
        if (synchronousCallbacks == 0 && hook.isDue()) hook.yield()
    }

    /**
     * Most nested calls (functions, accessors, lambdas, constructors) before
     * interpreted code gets a `StackOverflowError`, like a thread stack on the JVM.
     */
    var maxCallDepth = DEFAULT_MAX_CALL_DEPTH

    /**
     * Optional host hook that suspends and resumes on an empty host stack.
     * Every interpreted call takes many host stack frames; without this hook a
     * browser runs out of stack after roughly a hundred nested calls.
     */
    var stackResetHook: (suspend () -> Unit)? = null

    private var callDepth = 0

    /** [callDepth] at the bottom of the current host stack. */
    private var hostStackBase = 0

    private suspend fun enterCall(position: SourcePosition) {
        if (callDepth >= maxCallDepth) {
            throwStackOverflow(position)
        }
        // Like a checkpoint, a synchronous callback must finish on its own host stack.
        if (callDepth - hostStackBase >= CALLS_PER_STACK_RESET && synchronousCallbacks == 0) {
            stackResetHook?.let { reset ->
                reset()
                hostStackBase = callDepth
            }
        }
        callDepth += 1
    }

    private fun leaveCall() {
        callDepth -= 1
        // Resumed callers continue on the fresh host stack.
        if (callDepth < hostStackBase) hostStackBase = callDepth
    }

    /** Local and top-level `lateinit var`s by their transformed names (RT-88). */
    private val lateinitRefNames = mutableSetOf<String>()

    private fun throwStackOverflow(position: SourcePosition): Nothing {
        val fullStacktrace = callStack.getStacktrace(position)
        val stacktrace = if (fullStacktrace.size <= STACK_TRACE_LIMIT) fullStacktrace else {
            fullStacktrace.take(STACK_TRACE_LIMIT) + "... ${fullStacktrace.size - STACK_TRACE_LIMIT} more"
        }
        val error = StandardExceptionValue(
            currentScope = symbolTable(),
            message = StandardExceptionValue.stackOverflowMessage(maxCallDepth),
            cause = null,
            stacktrace = stacktrace,
            thisClazz = symbolTable().findClass("StackOverflowError")!!.first,
        )
        throw EvaluateRuntimeException(stacktrace = stacktrace, error = error)
    }

    internal val callStack = CallStack()

    /** How stack trace lines name frames and positions, see [CallStack.frameFormatter] (RT-71). */
    var stackFrameFormatter: (name: String?, position: SourcePosition?) -> String?
        get() = callStack.frameFormatter
        set(value) { callStack.frameFormatter = value }

    // The statement the innermost running function has reached: the line of its stack trace frame
    // when host code (`10 / 0`, a native function) throws there.
    private var statementPosition: SourcePosition? = null

    // The stack trace of the last host exception, taken where it passed the first frame: interpreted
    // code sees the exception only in a `catch`, when its frames are gone (RT-71).
    private var hostExceptionTrace: Pair<Throwable, List<String>>? = null

    private fun recordHostException(e: Throwable, position: SourcePosition?) {
        if (e is EvaluateRuntimeException || e is com.sunnychung.lib.multiplatform.kotlite.error.controlflow.NormalControlFlowException ||
            e is InterpreterStateException || e is kotlin.coroutines.cancellation.CancellationException) return
        if (hostExceptionTrace?.first === e) return
        hostExceptionTrace = e to callStack.getStacktrace(position)
    }
    internal val globalScope = callStack.currentSymbolTable()

    init {
        val classes = mutableListOf<ClassDefinition>()
        executionEnvironment.getBuiltinClasses(globalScope).forEach {
            it.attachToInterpreter(this) // make "ObjectType" resolvable
            callStack.provideBuiltinClass(it)
            classes += it
        }
        callStack.builtinScope().init()
        executionEnvironment.getGlobalProperties(globalScope).forEach {
            it.attachToInterpreter(this)
            globalScope.putPropertyHolder(it.transformedName!!, it.isMutable, it.accessor)
        }
        executionEnvironment.getBuiltinFunctions(globalScope).forEach {
            callStack.provideBuiltinFunction(it)
        }
        executionEnvironment.getExtensionProperties(globalScope).forEach {
            callStack.provideBuiltinExtensionProperty(it)
        }
        globalScope.init()
        classes.forEach { // do this again after registering functions again to make the post-resolution logic works
            it.attachToInterpreter(this)
        }
    }

    fun symbolTable() = callStack.currentSymbolTable()

    suspend fun ASTNode.eval(): Any {
        return when (this) {
            is AssignmentNode -> this.eval()
            is BinaryOpNode -> this.eval()
            is IntegerNode -> this.eval()
            is LongNode -> this.eval()
            is DoubleNode -> this.eval()
            is BooleanNode -> this.eval()
            is NullNode -> this.eval()
            is PropertyDeclarationNode -> this.eval()
            is ScriptNode -> this.eval()
            is TypeNode -> throw UnsupportedOperationException()
            is UnaryOpNode -> this.eval()
            is VariableReferenceNode -> this.eval()
            is FunctionDeclarationNode -> this.eval()
            is FunctionValueParameterNode -> throw UnsupportedOperationException()
            is FunctionCallArgumentNode -> throw UnsupportedOperationException()
            is FunctionCallNode -> this.eval()
            is BlockNode -> this.eval()
            is ReturnNode -> this.eval()
            is IfNode -> this.eval()
            is WhileNode -> this.eval()
            is DoWhileNode -> this.eval()
            is BreakNode -> this.eval()
            is ContinueNode -> this.eval()
            is ClassDeclarationNode -> this.eval()
            is ClassInstanceInitializerNode -> TODO()
            is ClassParameterNode -> TODO()
            is ClassPrimaryConstructorNode -> TODO()
            is ClassMemberReferenceNode -> TODO()
            is NavigationNode -> this.eval()
            is PropertyAccessorsNode -> TODO()
            is ValueNode -> this.eval()
            is StringLiteralNode -> this.eval()
            is StringNode -> this.eval()
            is LambdaLiteralNode -> this.eval()
            is CharNode -> this.eval()
            is AsOpNode -> this.eval()
            is TypeParameterNode -> TODO()
            is IndexOpNode -> this.eval()
            is InfixFunctionCallNode -> this.eval()
            is ElvisOpNode -> this.eval()
            is ThrowNode -> this.eval()
            is CatchNode -> TODO()
            is TryNode -> this.eval()
            is WhenConditionNode -> TODO()
            is WhenEntryNode -> TODO()
            is WhenNode -> this.eval()
            is WhenSubjectNode -> TODO()
            is LabelNode -> TODO()
            is EnumEntryNode -> TODO()
            is ForNode -> this.eval()
            is DestructuringDeclarationNode -> throw IllegalStateException("Statement lists flatten destructuring declarations")
            is ValueParameterDeclarationNode -> TODO()
        }
    }

    suspend fun ScriptNode.eval() {
        nodes.forEach { it.eval() }
    }

    fun <T : RuntimeValue, R: RuntimeValue> castType(a: Any, calculation: (T) -> R): R
        = calculation(a as T)

    fun <T : RuntimeValue, R: RuntimeValue> castType(a: Any, b: Any, calculation: (T, T) -> R): R
        = calculation(a as T, b as T)

    suspend fun BinaryOpNode.eval(): RuntimeValue {
        if (hasFunctionCall == true) {
            val result = call!!.eval()
            return when (operator) {
                ">" -> BooleanValue((result as IntValue).value > 0)
                ">=" -> BooleanValue((result as IntValue).value >= 0)
                "<" -> BooleanValue((result as IntValue).value < 0)
                "<=" -> BooleanValue((result as IntValue).value <= 0)
                else -> result
            }
        }

        return when (operator) { // TODO overflow
            "+" -> {
                val r1 = node1.eval() as RuntimeValue
                val r2 = node2.eval() as RuntimeValue
                if (r1 is StringValue || r1 is NullValue || r2 is StringValue || r2 is NullValue) {
                    StringValue(r1.convertToString() + r2.convertToString())
                } else if (r1 is CharValue && r2 is IntValue) {
                    CharValue(r1.value + r2.value)
                } else {
                    castType<NumberValue<*>, NumberValue<*>>(r1, r2) { a, b -> a + b }
                }
            }
            "-" -> {
                val r1 = node1.eval() as RuntimeValue
                val r2 = node2.eval() as RuntimeValue
                if (r1 is CharValue && r2 is CharValue) {
                    IntValue(r1.value - r2.value)
                } else {
                    castType<NumberValue<*>, NumberValue<*>>(r1, r2) { a, b -> a - b }
                }
            }
            "*" -> castType<NumberValue<*>, NumberValue<*>>(node1.eval(), node2.eval()) { a, b -> a * b }
            "/" -> castType<NumberValue<*>, NumberValue<*>>(node1.eval(), node2.eval()) { a, b -> a / b }
            "%" -> castType<NumberValue<*>, NumberValue<*>>(node1.eval(), node2.eval()) { a, b -> a % b }

            "<" -> {
//                val r1 = node1.eval() as RuntimeValue
//                val r2 = node2.eval() as RuntimeValue
//                val r1 = node1.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>>
//                val r2 = node2.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>>
//                BooleanValue(r1 < r2)
                BooleanValue(node1.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>, Comparable<Comparable<*>>> < node2.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>, Comparable<Comparable<*>>>)
//                if (r1 is )
//                castType<NumberValue<*>, BooleanValue>(node1.eval(), node2.eval()) { a, b -> BooleanValue(a < b) }
            }
            "<=" -> BooleanValue(node1.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>, Comparable<Comparable<*>>> <= node2.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>, Comparable<Comparable<*>>>)
            ">" -> BooleanValue(node1.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>, Comparable<Comparable<*>>> > node2.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>, Comparable<Comparable<*>>>)
            ">=" -> BooleanValue(node1.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>, Comparable<Comparable<*>>> >= node2.eval() as ComparableRuntimeValue<Comparable<Comparable<*>>, Comparable<Comparable<*>>>)
            "==" -> {
                val r1 = node1.eval() as RuntimeValue
                val r2 = node2.eval() as RuntimeValue
//                if (r1 is NullValue || r2 is NullValue) {
//                    return BooleanValue(r1 == r2)
//                }
                if (r1 is NumberValue<*> && r2 is NumberValue<*>) {
                    return castType<NumberValue<*>, BooleanValue>(r1, r2) { a, b -> BooleanValue(a == b) }
                }
                if (r1 is ClassInstance) {
                    r1.clazz!!.getSpecialFunction(SpecialFunction.Name.Equals)?.let { func ->
                        log.d { "equals($r1, $r2)" }
                        return func.call(interpreter = this@Interpreter, subject = r1, arguments = listOf(r2))
                    }
                }
                return BooleanValue(r1 == r2)
            }
            "!=" -> {
                val r1 = node1.eval() as RuntimeValue
                val r2 = node2.eval() as RuntimeValue
//                if (r1 is NullValue || r2 is NullValue) {
//                    return BooleanValue(r1 != r2)
//                }
                if (r1 is NumberValue<*> && r2 is NumberValue<*>) {
                    return castType<NumberValue<*>, BooleanValue>(r1, r2) { a, b -> BooleanValue(a != b) }
                }
                if (r1 is ClassInstance) {
                    r1.clazz!!.getSpecialFunction(SpecialFunction.Name.Equals)?.let { func ->
                        log.d { "!equals($r1, $r2)" }
                        return (func.call(interpreter = this@Interpreter, subject = r1, arguments = listOf(r2)) as BooleanValue)
                            .let { BooleanValue(!it.value) }
                    }
                }
                return BooleanValue(r1 != r2)
            }
            "===", "!==" -> {
                val r1 = node1.eval() as RuntimeValue
                val r2 = node2.eval() as RuntimeValue
                BooleanValue(if (operator == "===") r1 === r2 else r1 !== r2)
            }

            "||" -> {
                val a = node1.eval() as BooleanValue
                if (a.value) BooleanValue(true) else node2.eval() as BooleanValue
            }
            "&&" -> {
                val a = node1.eval() as BooleanValue
                if (!a.value) BooleanValue(false) else node2.eval() as BooleanValue
            }

            else -> throw UnsupportedOperationException()
        }
    }

    suspend fun UnaryOpNode.eval(): RuntimeValue {
        if (operator == "pre++" || operator == "pre--" || operator == "post++" || operator == "post--") {
            return evalIncrement()
        }
        val result = node!!.eval()
        if (operator == "!!") {
            if (result === NullValue) {
                throw EvaluateNullPointerException(callStack.currentSymbolTable(), callStack.getStacktrace(position))
            }
            return result as RuntimeValue
        }
        return when (result) {
            is NumberValue<*> -> when (operator) {
                "+" -> IntValue(0) + result
                "-" -> IntValue(0) - result
                "pre++" -> {
                    val newValue = result + IntValue(1)
                    node!!.write(newValue)
                    newValue
                }
                "pre--" -> {
                    val newValue = result - IntValue(1)
                    node!!.write(newValue)
                    newValue
                }
                "post++" -> {
                    val newValue = result + IntValue(1)
                    node!!.write(newValue)
                    result
                }
                "post--" -> {
                    val newValue = result - IntValue(1)
                    node!!.write(newValue)
                    result
                }
                else -> throw UnsupportedOperationException()
            }

            is BooleanValue -> {
                when (operator) {
                    "!" -> BooleanValue(!result.value)
                    else -> throw UnsupportedOperationException()
                }
            }
            else -> TODO()
        }
    }

    /** `x++`, `--a[i]`, `liste[0].punkte++`: the target is evaluated once (RT-97). */
    private suspend fun UnaryOpNode.evalIncrement(): RuntimeValue {
        val target = node!!.evalTarget()
        val result = node!!.readTarget(target)
        if (result !is NumberValue<*>) throw UnsupportedOperationException("`$operator` needs a number")
        val newValue = if (operator.endsWith("++")) result + IntValue(1) else result - IntValue(1)
        node!!.writeTarget(target, assignFunctionCall, newValue)
        return if (operator.startsWith("pre")) newValue else result
    }

    /**
     * The receiver and index values of an assignment target (`a[i]`, `objekt.wert`), evaluated
     * once and before the right side like in Kotlin. Before, `a[f()] += 1` called `f()` twice,
     * `a[i]++` and `liste[0].punkte += 1` failed (RT-97).
     */
    private class EvaluatedTarget(val receiver: RuntimeValue, val indices: List<RuntimeValue>)

    private suspend fun ASTNode.evalTarget(): EvaluatedTarget? = when {
        this is IndexOpNode -> EvaluatedTarget(subject.eval() as RuntimeValue, arguments.map { it.eval() as RuntimeValue })
        this is NavigationNode && operator == "." -> EvaluatedTarget(subject.eval() as RuntimeValue, emptyList())
        else -> null
    }

    private suspend fun ASTNode.readTarget(target: EvaluatedTarget?): RuntimeValue = when {
        target == null -> eval() as RuntimeValue
        this is IndexOpNode -> call!!.eval(replaceArguments = ArgumentValues(target.indices.toTypedArray()), replaceSubject = target.receiver)
        this is NavigationNode -> evalOn(target.receiver)
        else -> eval() as RuntimeValue
    }

    private suspend fun ASTNode.writeTarget(target: EvaluatedTarget?, setCall: FunctionCallNode?, value: RuntimeValue) {
        when {
            target == null -> write(value)
            this is IndexOpNode -> (setCall ?: throw RuntimeException("Operator function `set` not found"))
                .eval(replaceArguments = ArgumentValues((target.indices + value).toTypedArray()), replaceSubject = target.receiver)
            this is NavigationNode -> writeOn(target.receiver, value)
            else -> write(value)
        }
    }

    suspend fun PropertyDeclarationNode.eval() {
        val symbolTable = callStack.currentSymbolTable()
        val name = transformedRefName!!
        if (PropertyModifier.lateinit in modifiers) lateinitRefNames += name
        if (initialValue != null) {
            var value = initialValue.eval()
            symbolTable.declareProperty(position, name, type, isMutable)
            if (isValidIntegerLiteralAssignToByte(initialValue, symbolTable().assertToDataType(type))) {
                value = ByteValue((value as IntValue).value.toByte(), symbolTable())
            }
            symbolTable.assign(name, value as RuntimeValue)
        } else {
            symbolTable.declareProperty(position, name, type, isMutable)
        }
    }

    protected suspend fun ASTNode.write(value: RuntimeValue) {
        when (this) {
            is VariableReferenceNode -> {
                if (this.ownerRef != null) {
                    ownerAccess().write(value)
                } else {
                    accessTopLevelProperty(this) { callStack.currentSymbolTable().assign(it, value) }
                }
            }

            is NavigationNode -> writeOn(this.subject.eval() as RuntimeValue, value)

            else -> throw UnsupportedOperationException()
        }
    }

    /** Assigns the member of an already evaluated [subjectValue]. */
    protected suspend fun NavigationNode.writeOn(subjectValue: RuntimeValue, value: RuntimeValue) {
        val subject = resolveSuperKeyword(subjectValue)

        if (transformedRefName != null) { // extension property
            val extensionProperty = symbolTable().findExtensionProperty(transformedRefName!!) ?: throw RuntimeException("Extension property `$transformedRefName` not found")
            val typeArgumentsMap = extensionProperty.typeArgumentsMap(subject.type())
            (extensionProperty.setter ?: throw RuntimeException("Setter not found"))(
                this@Interpreter,
                subject,
                value,
                typeArgumentsMap,
            )
            return
        }

        val obj = subject as ClassInstance
        // before type resolution is implemented in SemanticAnalyzer, reflect from clazz as a slower alternative
        if (!callStack.isInsideClassCode() && obj.clazz!!.isPrivateMemberProperty(this.member.name)) {
            throw RuntimeException("Private property `${this.member.name}` cannot be accessed here")
        }
        obj.assign(this@Interpreter, memberSlotIn(obj), value)
    }

    fun NavigationNode.resolveSuperKeyword(subjectValue: RuntimeValue): RuntimeValue {
        // a hack to resolve the "super" keyword. See documentation
        return if (subject is VariableReferenceNode && subject.variableName == "super" && (subjectValue as ClassInstance).parentInstance != null) {
            var instance: ClassInstance? = subjectValue as ClassInstance
            val typeOfSuper = subject.type!!
            while (instance != null && instance.clazz!!.fullQualifiedName != typeOfSuper.name) {
                instance = instance.parentInstance
            }
            instance!!
        } else {
            subjectValue
        }
    }

    suspend fun AssignmentNode.eval() {
        if (subject is NavigationNode && subject.operator == "?.") {
            throw UnsupportedOperationException("?: on left side of assignment is not supported")
        }

        wholeFunctionCall?.let { func ->
            // `ziel += x` through `plusAssign`: the target first, then the argument
            val receiver = subject.eval() as RuntimeValue
            val result = value.eval() as RuntimeValue
            func.eval(replaceArguments = ArgumentValues.of(0, result), replaceSubject = receiver)
            return
        }

        val target = subject.evalTarget()
        val finalResult = if (operator == "=") {
            val result = value.eval() as RuntimeValue
            if (subject.declaredType() isPrimitiveTypeOf PrimitiveTypeName.Byte && result !is ByteValue) {
                if (isValidIntegerLiteralAssignToByte(value, subject.declaredType())) {
                    ByteValue((result as IntValue).value.toByte(), symbolTable())
                } else {
                    throw RuntimeException("The integer value cannot be assigned to a Byte due to out of range")
                }
            } else {
                result
            }
        } else {
            val existing = subject.readTarget(target)
            val result = value.eval() as RuntimeValue
            preAssignFunctionCall?.let { func ->
                subject.writeTarget(target, assignFunctionCall, func.eval(replaceArguments = ArgumentValues.of(0, result), replaceSubject = existing))
                return
            }
            when (operator) {
                "+=" -> {
                    if (subject.declaredType() isPrimitiveTypeOf PrimitiveTypeName.String) {
                        StringValue(existing.convertToString() + result.convertToString())
                    }  else {
                        (existing as NumberValue<*>) + result as NumberValue<*>
                    }
                }
                "-=" -> (existing as NumberValue<*>) - result as NumberValue<*>
                "*=" -> (existing as NumberValue<*>) * result as NumberValue<*>
                "/=" -> (existing as NumberValue<*>) / result as NumberValue<*>
                "%=" -> (existing as NumberValue<*>) % result as NumberValue<*>
                else -> throw UnsupportedOperationException()
            }
        }
        subject.writeTarget(target, assignFunctionCall, finalResult)
    }

    suspend fun VariableReferenceNode.eval(): RuntimeValue {
        // usual variable -> transformedRefName
        // class constructor -> variableName? TODO
        (transformedRefName ?: variableName).let { name ->
            if (name.startsWith(OBJECT_REF_PREFIX)) return objectInstance(name.removePrefix(OBJECT_REF_PREFIX))
            if (name.startsWith(ENUM_REF_PREFIX)) {
                val (className, entry) = name.removePrefix(ENUM_REF_PREFIX).let { it.substringBeforeLast('/') to it.substringAfterLast('/') }
                return symbolTable().findClass(className)?.first?.enumValues?.get(entry)
                    ?: throw RuntimeException("Enum entry `$entry` of `$className` is not created yet")
            }
        }
        if (ownerRef != null) {
            return ownerAccess().eval()
        }
        if (type is ClassTypeNode) {
            val companionClassName = "${(type as ClassTypeNode).clazz.name}.Companion"
            val companion = symbolTable().findClass(companionClassName)!!.first
            if (companion.isObjectDeclaration) return objectInstance(companionClassName)
            return ClassInstance(
                symbolTable(),
                companionClassName,
                companion,
                emptyList(),
            )
        }
        return try {
            accessTopLevelProperty(this) { callStack.currentSymbolTable().read(it) }
        } catch (e: UninitializedPropertyAccessException) {
            // Kotlin's message for a local or top-level `lateinit var` read too early (RT-88)
            if ((transformedRefName ?: variableName) in lateinitRefNames) {
                throw UninitializedPropertyAccessException("lateinit property $variableName has not been initialized")
            }
            throw e
        }
    }

    /**
     * The single instance of the object declaration or companion object [className] (RT-67). Like in
     * Kotlin it is created on first use; code that its initialization runs already gets it.
     */
    private suspend fun ASTNode.objectInstance(className: String): ClassInstance {
        val clazz = symbolTable().findClass(className)?.first ?: throw RuntimeException("Object `$className` not found")
        clazz.objectInstance?.let { return it }
        val creation = FunctionCallNode(
            function = VariableReferenceNode(position, className),
            arguments = emptyList(),
            declaredTypeArguments = emptyList(),
            position = position,
        )
        return try {
            creation.evalCreateClassInstance(clazz, emptyList())
        } catch (e: Throwable) {
            // Like a failed class initialization: the next use tries again.
            clazz.objectInstance = null
            throw e
        }
    }

    /** A member reference through an implicit owner (e.g. `y` for `this.y`), built once per node. */
    private fun VariableReferenceNode.ownerAccess(): NavigationNode = ownerAccess ?: NavigationNode(
        position = position,
        subject = VariableReferenceNode(position = position, variableName = ownerRef!!.ownerRefName),
        operator = ".",
        member = ClassMemberReferenceNode(
            position = position,
            name = variableName,
            transformedRefName = transformedRefName
        ),
        memberType = NavigationNode.MemberType.Extension,
        transformedRefName = ownerRef!!.extensionPropertyRef,
    ).also { ownerAccess = it }

    /** Where the accessed member property of [obj] is stored, resolved once per class at this node. */
    private fun NavigationNode.memberSlotIn(obj: ClassInstance): ClassInstance.MemberSlot {
        val clazz = obj.clazz!!
        if (resolvedClass === clazz) return resolvedMemberSlot!!
        val name = clazz.findMemberPropertyTransformedName(member.name)!!
        return (obj.memberSlot(name) ?: throw RuntimeException("Property $name is not defined in class ${clazz.fullQualifiedName}")).also {
            resolvedClass = clazz
            resolvedMemberSlot = it
        }
    }

    /**
     * Top-level properties are initialized in source order. Code that runs
     * before one is initialized (e.g. a function called by an earlier
     * initializer) gets a clear error instead of an unknown runtime name.
     */
    private inline fun <T> accessTopLevelProperty(node: VariableReferenceNode, access: (String) -> T): T {
        val name = node.transformedRefName ?: node.variableName
        return try {
            access(name)
        } catch (e: RuntimeException) {
            if (node.isTopLevelProperty && !globalScope.hasProperty(name)) {
                throw InterpreterStateException("`${node.variableName}` is used before it is initialized. Top-level properties are initialized in the order in which they are written, and this code ran before `${node.variableName}` was initialized.")
            }
            throw e
        }
    }

    suspend fun FunctionDeclarationNode.eval() {
        if (receiver == null) {
            callStack.currentSymbolTable().declareFunction(position, transformedRefName!!, this)
        } else {
            globalScope.declareExtensionFunction(position, transformedRefName!!, this)
        }
    }

    /** [replaceSubject] is the receiver of a `.` call when it was already evaluated (RT-97). */
    suspend fun FunctionCallNode.eval(replaceArguments: Map<Int, RuntimeValue> = emptyMap(), replaceSubject: RuntimeValue? = null): RuntimeValue {
        resolvedInvoke?.let { return it.eval(replaceArguments, replaceSubject) }
        // TODO move to semantic analyzer
        when (function) {
            is VariableReferenceNode, is TypeNode -> {
                val directName = when (function) {
                    is VariableReferenceNode -> function.variableName
                    is TypeNode -> function.name
                    else -> throw UnsupportedOperationException()
                }

                if (function is VariableReferenceNode && function.ownerRef != null) {
                    val ownerCall = ownerCall ?: this.copy(
                        function = NavigationNode(
                            position = position,
                            subject = VariableReferenceNode(
                                position = position,
                                variableName = this.function.ownerRef!!.ownerRefName
                            ),
                            operator = ".",
                            member = ClassMemberReferenceNode(position = position, name = directName),
                            memberType = NavigationNode.MemberType.Extension,
                            transformedRefName = this.function.ownerRef!!.extensionPropertyRef,
                        )
                    ).also { ownerCall = it }
                    return ownerCall.eval(replaceArguments)
                }

                when (callableType) {
                    CallableType.Function -> {
                        val functionNode = callStack.currentSymbolTable().findFunction(functionRefName!!)?.first
                        if (functionNode != null) {
                            return evalFunctionCall(functionNode, replaceArguments = replaceArguments)
                        }
                    }
                    CallableType.ClassMemberFunction -> {
                        val instance = callStack.currentSymbolTable().read("this") as? ClassInstance
                            ?: throw RuntimeException("Implicit receiver `this` is not available")
                        val functionNode = instance.clazz!!.findMemberFunctionByTransformedName(functionRefName!!)
                            ?: throw RuntimeException("Function `$directName` not found on implicit receiver")
                        return evalClassMemberAnyFunctionCall(instance, functionNode, replaceArguments = replaceArguments)
                    }
                    CallableType.Constructor -> {
                        val classDefinition = callStack.currentSymbolTable().findClass(functionRefName!!)?.first
                        if (classDefinition != null) {
                            return evalCreateClassInstance(classDefinition, typeArguments, replaceArguments = replaceArguments)
                        }
                    }
                    CallableType.Property -> {
                        val variable = callStack.currentSymbolTable().read(functionRefName!!)
                        if (variable is LambdaValue) {
                            return evalFunctionCall(variable.value, extraSymbols = variable.symbolRefs, replaceArguments = replaceArguments)
                        }
                    }
                    else -> {}
                }
                throw RuntimeException("Function `$directName` not found")
            }

            is NavigationNode -> {
                val subject = replaceSubject ?: function.subject.eval()
                if (subject === NullValue) {
                    if (function.operator == "?.") {
                        return NullValue // TODO not always true for extension functions
                    } else {
                        // extension methods of nullable types are allowed to be called
                    }
                }
                when (callableType) {
                    // `objekt.f()` for a property of a function type (RT-75)
                    CallableType.Property -> {
                        val instance = subject as? ClassInstance
                            ?: throw EvaluateNullPointerException(callStack.currentSymbolTable(), callStack.getStacktrace(position))
                        val value = instance.read(this@Interpreter, function.memberSlotIn(instance))
                        if (value is LambdaValue) {
                            return evalFunctionCall(value.value, extraSymbols = value.symbolRefs, replaceArguments = replaceArguments)
                        }
                        throw EvaluateNullPointerException(callStack.currentSymbolTable(), callStack.getStacktrace(position))
                    }
                    CallableType.ClassMemberFunction -> {
                        if (subject === NullValue) {
                            throw EvaluateNullPointerException(callStack.currentSymbolTable(), callStack.getStacktrace(position))
                        }
                        (subject as? ClassInstance)
                            ?.let { function.resolveSuperKeyword(it) as? ClassInstance }
                            ?.let { instance ->
                                val function = instance.clazz!!.findMemberFunctionByTransformedName(functionRefName!!)
                                if (function != null) {
                                    val subject = if (isSpecialFunction == true) {
                                        instance
                                    } else {
                                        subject
                                    }
                                    return evalClassMemberAnyFunctionCall(
                                        subject = subject,
                                        function = function,
                                        replaceArguments = replaceArguments,
                                    )
                                }
                            }
                        (subject as? PrimitiveValue)
                            ?.clazz
                            ?.findMemberFunctionByTransformedName(functionRefName!!)
                            ?.let { function ->
                                return evalClassMemberAnyFunctionCall(subject, function, replaceArguments = replaceArguments)
                            }
                    }
                    CallableType.ExtensionFunction -> {
                        // A long-lived host session may analyze several scripts
                        // against the same execution environment. The analyzer
                        // refreshes generated names for builtin extensions on
                        // every pass, while the call stack still contains the
                        // previously registered names. Resolve by the declared
                        // receiver/name as a safe fallback; this preserves the
                        // analyzed function node and fixes incremental calls
                        // such as list[0], count(), and add().
                        val runtimeSubject = subject as RuntimeValue
                        val receiverTypes = buildList {
                            add(runtimeSubject.type().toTypeNode())
                            (runtimeSubject.type() as? ObjectType)?.superTypes?.forEach { add(it.toTypeNode()) }
                        }
                        val function = callStack.currentSymbolTable().findExtensionFunction(functionRefName!!)
                            ?: receiverTypes.asSequence()
                                .flatMap { receiverType ->
                                    callStack.currentSymbolTable()
                                        .findExtensionFunctionsByDeclaredName(receiverType, this.function.member.name)
                                        .asSequence()
                                }
                                .firstOrNull()
                            ?: throw RuntimeException("Analysed function $functionRefName not found")
                        if (subject === NullValue
                            && !function.receiver!!.resolveGenericParameterTypeToUpperBound(function.extraTypeParameters + function.typeParameters, isResolveRootOnly = true).isNullable
                        ) {
                            throw EvaluateNullPointerException(callStack.currentSymbolTable(), callStack.getStacktrace(position))
                        }

                        (subject as? ClassInstance)
                            ?.let { this.function.resolveSuperKeyword(it) as? ClassInstance }
                            ?.let { instance ->
                                val subject = if (isSpecialFunction == true) {
                                    instance
                                } else {
                                    subject
                                }
                                return evalClassMemberAnyFunctionCall(
                                    subject = subject,
                                    function = function,
                                    replaceArguments = replaceArguments,
                                )
                            }

                        return evalClassMemberAnyFunctionCall(subject as RuntimeValue, function, replaceArguments = replaceArguments)
                    }
                    else -> {}
                }
                throw RuntimeException("Class Function `${function.member.name}` not found")
            }

            else -> {
                val variable = function.eval() as? RuntimeValue
                if (variable is LambdaValue) {
                    return evalFunctionCall(variable.value, extraSymbols = variable.symbolRefs, replaceArguments = replaceArguments)
                } else {
                    throw RuntimeException("${variable?.type()} is not callable")
                }
            }
        }
    }

    suspend fun FunctionCallNode.evalFunctionCall(functionNode: CallableNode, extraSymbols: SymbolTable? = null, replaceArguments: Map<Int, RuntimeValue> = emptyMap()): RuntimeValue {
        return evalFunctionCall(this, functionNode, emptyMap(), emptyList(), extraSymbols, replaceArguments).result
    }

    suspend fun evalFunctionCall(
        callNode: FunctionCallNode,
        functionNode: CallableNode,
        extraScopeParameters: Map<String, RuntimeValue>,
        extraTypeResolutions: List<TypeParameterNode>,
        extraSymbols: SymbolTable? = null,
        replaceArguments: Map<Int, RuntimeValue> = emptyMap(),
        subject: RuntimeValue? = null,
        extraScopePropertyHolders: Map<String, RuntimeValueAccessor> = emptyMap(),
    ): FunctionCallResult {
        // TODO optimize to remove most loops
        val isVararg =
            functionNode.valueParameters.firstOrNull()?.modifiers?.contains(FunctionValueParameterModifier.vararg)
                ?: false
        val callArguments = if (isVararg) {
            callNode.arguments.map { a -> a.value.eval() as RuntimeValue? }.toTypedArray()
        } else {
            val callArguments = arrayOfNulls<RuntimeValue>(functionNode.valueParameters.size)
            callNode.arguments.forEachIndexed { i, a ->
                val value = replaceArguments[i] ?: a.value.eval() as RuntimeValue
                val index = if (a.name != null) {
                    functionNode.valueParameters.indexOfFirst { it.name == a.name }
                } else if (i == callNode.arguments.lastIndex && value is LambdaValue) {
                    functionNode.valueParameters.lastIndex
                } else {
                    a.index
                }
                if (index < 0) throw RuntimeException("Named argument `${a.name}` could not be found.")
                callArguments[index] = value
            }
            callArguments
        }

        // `replaceArguments` is indexed by argument here; the mapped `callArguments` already contain
        // them, by parameter. Passing them on would put a trailing lambda on the wrong parameter
        // (`joinToString(",") { … }`, RT-90). A vararg list keeps the argument indexes.
        return evalFunctionCall(callArguments, callNode.typeArguments.toTypedArray(), callNode.position, functionNode, extraScopeParameters, extraTypeResolutions, extraSymbols, if (isVararg) replaceArguments else emptyMap(), subject, extraScopePropertyHolders)
    }

    /**
     * A member resolver for a subject type. Resolvers for concrete type
     * arguments (e.g. `Iterator<Invader>`) are scope-independent and cached on
     * the type instance; this avoids rebuilding the generic hierarchy for every
     * `hasNext()`/`next()` of a loop. Types involving type parameters are
     * resolved per call as before.
     */
    private fun memberResolverFor(subjectType: ObjectType): ClassMemberResolver? {
        subjectType.memberResolverCache?.let { return it }
        val resolver = ClassMemberResolver.create(symbolTable(), subjectType.clazz, subjectType.arguments.map { it.toTypeNode() })
        if (resolver != null && subjectType.arguments.all { it.isConcreteForMemberResolution() }) {
            subjectType.memberResolverCache = resolver
        }
        return resolver
    }

    private fun DataType.isConcreteForMemberResolution(): Boolean = when (this) {
        is ObjectType -> arguments.all { it.isConcreteForMemberResolution() }
        is UnitType, is NothingType -> true
        else -> false
    }

    /** `Karte.wert` for a member function, as in Kotlin with its declaring class (RT-71). */
    private fun frameName(function: CallableNode, subject: RuntimeValue?): String {
        val name = function.name ?: return "<lambda>"
        if (subject !is ClassInstance || function !is FunctionDeclarationNode || function.receiver != null) return name
        val owner = function.transformedRefName
            ?.let { subject.clazz?.findMemberFunctionWithEnclosingTypeNameByTransformedName(it)?.second }
            ?: subject.clazz?.fullQualifiedName
        return owner?.let { "$it.$name" } ?: name
    }

    suspend fun evalFunctionCall(
        arguments: Array<RuntimeValue?>,
        typeArguments: Array<TypeNode>,
        callPosition: SourcePosition,
        functionNode: CallableNode,
        extraScopeParameters: Map<String, RuntimeValue>,
        extraTypeResolutions: List<TypeParameterNode>,
        extraSymbols: SymbolTable? = null,
        replaceArguments: Map<Int, RuntimeValue> = emptyMap(),
        subject: RuntimeValue? = null,
        extraScopePropertyHolders: Map<String, RuntimeValueAccessor> = emptyMap()
    ): FunctionCallResult {
        val isVararg = functionNode.valueParameters.firstOrNull()?.modifiers?.contains(FunctionValueParameterModifier.vararg) ?: false
        if (!isVararg && arguments.size != functionNode.valueParameters.size) {
            throw RuntimeException("Arguments size not match. Optional arguments should be specified as null.")
        }

        if (!isVararg) {
            arguments.forEachIndexed { index, it ->
                val parameterNode = functionNode.valueParameters[index]
                if (replaceArguments[index] == null && it == null && parameterNode.defaultValue == null) {
                    throw RuntimeException("Missing parameter `${parameterNode.name} in function call ${functionNode.name}`")
                }
            }
        }

        val classResolver = (functionNode as? FunctionDeclarationNode)
            ?.takeIf { it.transformedRefName != null }
            ?.let { function ->
                val subjectType = subject?.type() as? ObjectType
                // No class type substitutions are needed for a non-generic
                // hierarchy. Function type parameters are still resolved below.
                subjectType?.takeIf { it.arguments.isNotEmpty() || it.superTypes.any { parent -> parent.arguments.isNotEmpty() } }?.let { subjectType ->
                    memberResolverFor(subjectType)
                }
            }
        val resolvedFunction = (functionNode as? FunctionDeclarationNode)
            ?.takeIf { it.transformedRefName != null }
            ?.let { function ->
                classResolver?.findMemberFunctionWithTypeByTransformedName(function.transformedRefName!!)
            }

        val classTypeResolutions = classResolver?.let { resolver ->
            resolvedFunction?.enclosingTypeName?.let { typeName ->
                resolver.genericResolutionsByTypeName[typeName]!!.map {
                    TypeParameterNode(it.value.position, it.key, it.value)
                }
            }
        } ?: emptyList()
        // Most calls involve no type parameters at all; skip building empty tables.
        val typeParametersReplacedWithArguments: Map<String, TypeNode> =
            if (extraTypeResolutions.isEmpty() && classTypeResolutions.isEmpty() && functionNode.typeParameters.isEmpty()) emptyMap()
            else (
                extraTypeResolutions + // add `extraTypeResolutions` at first because class type arguments have a lower precedence
                classTypeResolutions +
                functionNode.typeParameters.mapIndexed { index, tp ->
                    TypeParameterNode(tp.position, tp.name, typeArguments[index])
                }
            )
            .associateTo(SymbolMap()) { it.name to it.typeUpperBound!! }

        // resolve type arguments to DataType first, so that
        // class with same name of function type parameter name is resolved before function type parameter declarations
        val typeArgumentsInDataType: Map<String, DataType> =
            if (typeParametersReplacedWithArguments.isEmpty()) emptyMap()
            else typeParametersReplacedWithArguments.mapValuesTo(SymbolMap()) { symbolTable().assertToDataType(it.value) }

        val scopeType = if (functionNode is FunctionDeclarationNode) ScopeType.Function else ScopeType.Closure

        val capturedTypeResolutions = extraSymbols?.listTypeAliasResolutionInThisScope() ?: emptyMap()
        val returnType = callStack.currentSymbolTable().assertToDataType(
            // 2nd resolution is needed, because the generic type may not be relevant to the class itself.
            // see test case GenericFunctionAndExtensionFunctionWithGenericClassTest#unrelatedTypeParameter()
            type = (resolvedFunction?.resolvedReturnType ?: functionNode.returnType).let { declared ->
                if (typeParametersReplacedWithArguments.isEmpty() && capturedTypeResolutions.isEmpty()) declared
                else declared.resolveGenericParameterTypeArguments(
                    typeParametersReplacedWithArguments + // typeParametersReplacedWithArguments has higher precedence
                    capturedTypeResolutions.mapValues { it.value.toTypeNode() }
                )
            },
        )

        if (functionNode is CustomFunctionDeclarationNode && !functionNode.needsCallScope && extraSymbols == null &&
            extraScopeParameters.isEmpty() && extraScopePropertyHolders.isEmpty() && arguments.all { it != null }
        ) {
            return evalNativeFunctionCall(functionNode, arguments, typeArgumentsInDataType, callPosition, scopeType, returnType, subject)
        }

        enterCall(callPosition)
        val callerStatementPosition = statementPosition
        callStack.push(
            functionFullQualifiedName = functionNode.name,
            isFunctionCall = true,
            scopeType = scopeType,
            callPosition = callPosition,
            frameName = frameName(functionNode, subject),
            isNative = functionNode is CustomFunctionDeclarationNode,
        )
        val returnTarget = Any()
        try {
            val symbolTable = callStack.currentSymbolTable()
            extraSymbols?.let{
                symbolTable.mergeFrom(callPosition, it)
            }
            symbolTable.putReturnTarget(functionNode.returnTargetId, returnTarget)
            extraScopeParameters.forEach {
                symbolTable.declareProperty(callPosition, it.key, it.value.type(), false)
                symbolTable.assign(it.key, it.value)
            }
            extraScopePropertyHolders.forEach { (name, holder) ->
                symbolTable.putPropertyHolder(name, true, holder)
            }
            functionNode.typeParameters.forEach {
                symbolTable.declareTypeAlias(callPosition, it.name, it.typeUpperBound)
            }
            typeParametersReplacedWithArguments.forEach {
                if (symbolTable.findTypeAlias(it.key) == null) {
                    symbolTable.declareTypeAlias(callPosition, it.key, it.value) // TODO declare the original upper bound
                }
                symbolTable.declareTypeAliasResolution(callPosition, it.key, typeArgumentsInDataType[it.key]!!)
            }
            val valueParametersWithGenericsResolved = resolvedFunction?.resolvedValueParameterTypes
                ?: functionNode.valueParameters
            val varargListValueArgument = if (isVararg) {
                ListValue(arguments.filterNotNull().toList(), symbolTable().assertToDataType(functionNode.valueParameters.first().type), symbolTable())
            } else null
            functionNode.valueParameters.forEachIndexed { index, it ->
                if (!isVararg && !(functionNode is LambdaLiteralNode && it.name == "_")) {
                    val argumentType = valueParametersWithGenericsResolved[index].type
                    symbolTable.declareProperty(callPosition, it.transformedRefName!!, argumentType, false)
                    symbolTable.assign(
                        name = it.transformedRefName!!,
                        value = replaceArguments[index] ?: arguments[index] ?: (evaluateNode(it.defaultValue!!) as RuntimeValue)
                            .also { arguments[index] = it }
                    )
                } else if (isVararg) {
                    val argumentType = varargListValueArgument!!.type()
                    symbolTable.declareProperty(callPosition, it.transformedRefName!!, argumentType, false)
                    symbolTable.assign(
                        name = it.transformedRefName!!,
                        value = varargListValueArgument,
                    )
                }
                if (!isVararg && (it.type as? FunctionTypeNode)?.receiverType != null) {
                    val type = it.type as FunctionTypeNode

                    fun findTypeParameters(typeNode: TypeNode, result: MutableSet<String>) {
                        result += typeNode.name
                        typeNode.arguments?.forEach {
                            findTypeParameters(it, result)
                        }
                    }
                    val allPossibleTypeParameters = mutableSetOf<String>()
                    (setOfNotNull(type.receiverType, type.returnType) + (type.parameterTypes ?: emptyList()))
                        .forEach { findTypeParameters(it, allPossibleTypeParameters) }

                    symbolTable.declareExtensionFunction(
                        position = it.position,
                        name = type.extensionFunctionRefName!!,
                        node = object : FunctionDeclarationNode(
                            position = it.position,
                            name = "",
                            extraTypeParameters = functionNode.typeParameters.filter {
                                it.name in allPossibleTypeParameters
                            },
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
                        ) {
                            override suspend fun execute(
                                interpreter: Interpreter,
                                receiver: RuntimeValue?,
                                lambdaArguments: List<RuntimeValue>,
                                typeArguments: Map<String, DataType>
                            ): RuntimeValue {
                                return ((replaceArguments[index] ?: arguments[index]) as? LambdaValue)
                                    ?.executeSuspended(lambdaArguments.toTypedArray())
                                    ?: NullValue
                            }
                        }
                    )
                }
            }

            val arguments = if (isVararg) {
                arrayOf(varargListValueArgument)
            } else {
                arguments
            }

            // execute function
            val returnValue = try {
                @Suppress("UNCHECKED_CAST")
                val result = functionNode.execute(this, subject, arguments.asList() as List<RuntimeValue>, typeArgumentsInDataType)
                if (returnType is UnitType) {
                    UnitValue
                } else {
                    result
                }
            } catch (r: NormalReturnException) {
                if (r.target != null && r.target !== returnTarget) throw r
                if (r.target != null) {
                    // Exact lexical invocation matched (also through recursive inline calls).
                } else if (r.returnToLabel.isEmpty()) {
                    if (functionNode.labelName != null) {
                        throw RuntimeException("Returning to a non-function callable")
                    }
                } else {
                    if (functionNode.labelName == null) {
                        throw RuntimeException("Returning to a non-lambda callable")
                    } else if (functionNode.labelName != r.returnToLabel) {
                        throw RuntimeException("Returning to a lambda with mismatching label")
                    }
                }

                r.value
            }

            log.v { "Fun Return $returnValue; symbolTable = $symbolTable" }
            // A Unit result of a Unit function needs no runtime type check.
            if (!(returnValue === UnitValue && returnType is UnitType) && !returnType.acceptsRuntimeType(returnValue.type())) {
                throw RuntimeException("Return value's type ${returnValue.type().descriptiveName} cannot be casted to ${returnType.descriptiveName} in function `${functionNode.name}` at ${functionNode.position}")
            }

            return FunctionCallResult(returnValue, symbolTable)
        } catch (e: Throwable) {
            recordHostException(e, statementPosition)
            throw e
        } finally {
            statementPosition = callerStatementPosition
            callStack.pop(scopeType)
            leaveCall()
        }
    }

    /**
     * A native call without parameter, type-alias and receiver bindings: the
     * native reads them from the call itself. The frame remains for the call
     * depth and for stack traces.
     */
    private suspend fun evalNativeFunctionCall(
        functionNode: CustomFunctionDeclarationNode,
        arguments: Array<RuntimeValue?>,
        typeArguments: Map<String, DataType>,
        callPosition: SourcePosition,
        scopeType: ScopeType,
        returnType: DataType,
        subject: RuntimeValue?,
    ): FunctionCallResult {
        enterCall(callPosition)
        callStack.push(functionFullQualifiedName = functionNode.name, isFunctionCall = true, scopeType = scopeType, callPosition = callPosition, frameName = frameName(functionNode, subject), isNative = true)
        try {
            @Suppress("UNCHECKED_CAST")
            val result = functionNode.execute(this, subject, arguments.asList() as List<RuntimeValue>, typeArguments)
            val returnValue = if (returnType is UnitType) UnitValue else result
            if (!(returnValue === UnitValue && returnType is UnitType) && !returnType.acceptsRuntimeType(returnValue.type())) {
                throw RuntimeException("Return value's type ${returnValue.type().descriptiveName} cannot be casted to ${returnType.descriptiveName} in function `${functionNode.name}` at ${functionNode.position}")
            }
            return FunctionCallResult(returnValue, callStack.currentSymbolTable())
        } catch (e: Throwable) {
            // inside the native function: no position of its own
            recordHostException(e, null)
            throw e
        } finally {
            callStack.pop(scopeType)
            leaveCall()
        }
    }

    suspend fun FunctionCallNode.evalCreateClassInstance(clazz: ClassDefinition, typeArguments: List<TypeNode>, replaceArguments: Map<Int, RuntimeValue> = emptyMap()): ClassInstance {
        enterCall(position)
        callStack.push(functionFullQualifiedName = "class", scopeType = ScopeType.ClassInitializer, callPosition = this.position, frameName = "${clazz.name}.<init>")
        try {
            // TODO generalize duplicated code
            val secondary = secondaryConstructorIndex?.let { clazz.secondaryConstructors[it] }
            if (secondary != null) {
                val values = arrayOfNulls<RuntimeValue>(secondary.valueParameters.size)
                arguments.forEach { argument ->
                    val index = argument.name?.let { name -> secondary.valueParameters.indexOfFirst { it.name == name } } ?: argument.index
                    values[index] = replaceArguments[index] ?: argument.value.eval() as RuntimeValue
                }
                val delegation = secondary.delegationCall
                val instance = if (delegation != null) {
                    // Like Kotlin: `: this(...)` creates the object first, with the parameters in scope;
                    // the body of this constructor runs afterwards (RT-83).
                    val typeArgumentByName = clazz.typeParameters.mapIndexed { index, tp -> tp.name to typeArguments[index] }.toMap()
                    callStack.push(functionFullQualifiedName = null, scopeType = ScopeType.FunctionParameters, callPosition = position)
                    try {
                        val symbolTable = callStack.currentSymbolTable()
                        secondary.valueParameters.forEachIndexed { index, parameter ->
                            val value = values[index] ?: (evaluateNode(parameter.defaultValue!!) as RuntimeValue)
                            values[index] = value
                            symbolTable.declareProperty(parameter.position, parameter.transformedRefName!!, parameter.type.resolveGenericParameterTypeArguments(typeArgumentByName), false)
                            symbolTable.assign(parameter.transformedRefName!!, value)
                        }
                        delegation.evalCreateClassInstance(clazz, typeArguments)
                    } finally {
                        callStack.pop(ScopeType.FunctionParameters)
                    }
                } else {
                    clazz.construct(this@Interpreter, emptyArray(),
                        typeArguments.map { symbolTable().assertToDataType(it) }.toTypedArray(), position)
                }
                evalClassMemberAnyFunctionCall(position, instance, secondary, values, typeArguments.toTypedArray())
                return instance
            }
            val parameters = clazz.primaryConstructor?.parameters ?: emptyList()
            val callArguments = arrayOfNulls<RuntimeValue>(parameters.size)
            arguments.forEach { a ->
                val index = if (a.name != null) {
                    parameters.indexOfFirst { it.parameter.name == a.name }
                } else {
                    a.index
                }
                if (index < 0) throw RuntimeException("Named argument `${a.name}` could not be found.")
                callArguments[index] = replaceArguments[index] ?: a.value.eval() as RuntimeValue
            }
            callArguments.forEachIndexed { index, it ->
                val parameterNode = parameters[index].parameter
                if (it == null && parameterNode.defaultValue == null) {
                    throw RuntimeException("Missing parameter `${parameterNode.name} in constructor call of ${clazz.fullQualifiedName}`")
                }
            }

            val typeArgumentByName = clazz.typeParameters.mapIndexed { index, tp ->
                tp.name to typeArguments[index]
            }.toMap()

            val symbolTable = callStack.currentSymbolTable()
            clazz.primaryConstructor?.parameters?.forEachIndexed { index, it ->
                // no need to use transformedRefName as duplicated declarations are not possible here
                val value = callArguments[index] ?: (evaluateNode(it.parameter.defaultValue!!) as RuntimeValue)
                symbolTable.declareProperty(it.position, it.parameter.transformedRefName!!, it.parameter.type.resolveGenericParameterTypeArguments(typeArgumentByName), false)
                symbolTable.assign(it.parameter.transformedRefName!!, value)
                callArguments[index] = value
            }

            return clazz.construct(this@Interpreter, callArguments as Array<RuntimeValue>, typeArguments.map { symbolTable().assertToDataType(it) }.toTypedArray(), position)
        } finally {
            callStack.pop(ScopeType.ClassInitializer)
            leaveCall()
        }
    }

    suspend fun constructClassInstance(callArguments: Array<RuntimeValue>, callPosition: SourcePosition, typeArguments: Array<DataType>, clazz: ClassDefinition): ClassInstance {
        val parentInstance = clazz.superClassInvocation?.let { superClassInvocation ->
            callStack.push("super", ScopeType.Class, SourcePosition("TODO", 1, 1)) // TODO filename
            typeArguments.forEachIndexed { index, dataType ->
                val typeParameter = clazz.typeParameters[index]
                symbolTable().declareTypeAlias(typeParameter.position, typeParameter.name, typeParameter.typeUpperBound)
                symbolTable().declareTypeAliasResolution(typeParameter.position, typeParameter.name, dataType)
            }
            try {
                superClassInvocation.eval() as ClassInstance?
            } finally {
                callStack.pop(ScopeType.Class)
            }
        }

        val symbolTable = callStack.currentSymbolTable()
        val instance = ClassInstance(symbolTable, clazz.fullQualifiedName, clazz, typeArguments.toList(), parentInstance = parentInstance)
        if (clazz.isObjectDeclaration) clazz.objectInstance = instance
        if (clazz.isInner) instance.outerInstance = callArguments[0] as ClassInstance
        val properties = clazz.primaryConstructor?.parameters?.filter { it.isProperty }?.map { it.parameter.transformedRefName!! }?.toMutableSet() ?: mutableSetOf()

        val nonPropertyArguments = mutableMapOf<String, Pair<ClassParameterNode, RuntimeValue>>()
        clazz.primaryConstructor?.parameters?.forEachIndexed { index, it ->
            val value = callArguments[index]
            if (it.isProperty) {
                instance.assign(name = it.parameter.transformedRefName!!, value = value)
//                    instance.memberPropertyValues[it.parameter.transformedRefName!!] = value
            } else {
                nonPropertyArguments[it.parameter.transformedRefName!!] = Pair(it, value)
            }
        }

        // move nonPropertyArguments from outer scope into inner scope
        nonPropertyArguments.keys.forEach {
            symbolTable.undeclareProperty(it)
        }
//            clazz.primaryConstructor?.parameters?.forEach {
//                symbolTable.undeclareProperty(it.parameter.transformedRefName!!)
//            }

        // variable "this" is available after primary constructor. Register
        // the receiver for every class in the hierarchy as well: inherited
        // properties are transformed to names such as "this/Person" while a
        // subclass instance is being initialized.
        val instanceType = TypeNode(callPosition, instance.clazz!!.fullQualifiedName, typeArguments.map { it.toTypeNode() }.emptyToNull(), false)
        symbolTable.declareProperty(callPosition, "this", instanceType, false)
        symbolTable.assign("this", instance)
        var receiverClass: ClassDefinition? = instance.clazz
        while (receiverClass != null) {
            val receiverName = "this/${receiverClass.fullQualifiedName}"
            symbolTable.declareProperty(callPosition, receiverName, instanceType, false)
            symbolTable.assign(receiverName, instance)
            receiverClass = receiverClass.superClass
        }
        symbolTable.bindOuterReceivers(callPosition, instance)

//            instance.memberPropertyValues.forEach {
//                symbolTable.putPropertyHolder(instance.clazz!!.memberPropertyNameToTransformedName[it.key]!!, it.value)
//            }

        if (instance.clazz?.superClass != null) {
            // a hack to resolve the "super" keyword. See documentation
            symbolTable.declareProperty(
                callPosition,
                "super",
                TypeNode(SourcePosition.NONE, instance.clazz!!.fullQualifiedName, typeArguments.map { it.toTypeNode() }.emptyToNull(), false),
                false
            )
            symbolTable.assign("super", instance)
        }

        val typeParametersAndArguments = clazz.typeParameters.mapIndexed { index, tp ->
            TypeParameterNode(tp.position, tp.name, typeArguments[index].toTypeNode())
        }
        val typeArgumentByName = typeParametersAndArguments.associate {
            it.name to it.typeUpperBound!!
        }

        clazz!!.orderedInitializersAndPropertyDeclarations.forEach {
            callStack.push(
                functionFullQualifiedName = "init-property",
                scopeType = ScopeType.ClassInitializer,
                callPosition = callPosition
            )
            try {
                val innerSymbolTable = callStack.currentSymbolTable()
                // Property initializers see the type arguments, like `init` blocks: `mutableListOf<T>()` (RT-93).
                typeParametersAndArguments.forEachIndexed { index, typeParameter ->
                    innerSymbolTable.declareTypeAlias(typeParameter.position, typeParameter.name, clazz.typeParameters[index].typeUpperBound)
                    innerSymbolTable.declareTypeAliasResolution(typeParameter.position, typeParameter.name, typeArguments[index])
                }
                nonPropertyArguments.forEach {
                    innerSymbolTable.declareProperty(callPosition, it.value.first.transformedRefNameInBody!!, it.value.first.parameter.type.resolveGenericParameterTypeArguments(typeArgumentByName), false)
                    innerSymbolTable.assign(it.value.first.transformedRefNameInBody!!, it.value.second)
                }
                when (it) {
                    is PropertyDeclarationNode -> {
                        properties += it.transformedRefName!!
                        val value = it.initialValue?.eval() as RuntimeValue?
                        value?.let { value ->
                            if (it.accessors != null) instance.assignBacking(it.name, this@Interpreter, value)
                            else instance.assign(name = it.transformedRefName!!, value = value)
                        }
                    }

                    is ClassInstanceInitializerNode -> {
                        val init = FunctionDeclarationNode(
                            position = it.position,
                            name = "init",
                            declaredReturnType = TypeNode(it.position, "Unit", null, false),
                            valueParameters = emptyList(),
                            body = it.block
                        )
                        evalFunctionCall(
                            callNode = FunctionCallNode(
                                function = init, /* not used */
                                arguments = emptyList(),
                                declaredTypeArguments = emptyList(),
                                position = callPosition,
                            ),
                            functionNode = init,
                            extraScopeParameters = emptyMap(),
                            extraTypeResolutions = typeParametersAndArguments /* type arguments */,
                        )
                    }

                    else -> Unit
                }
            } finally {
                callStack.pop(ScopeType.ClassInitializer)
            }
        }
        return instance
    }

//    fun FunctionCallNode.evalClassMemberFunctionCall(subject: ClassInstance, member: ClassMemberReferenceNode): RuntimeValue {
//        val function = subject.clazz!!.memberFunctions[member.name] ?: throw EvaluateRuntimeException("Member function `${member.name}` not found")
//        return evalClassMemberAnyFunctionCall(subject, function)
//    }

    suspend fun FunctionCallNode.evalClassMemberAnyFunctionCall(subject: RuntimeValue, function: FunctionDeclarationNode, replaceArguments: Map<Int, RuntimeValue> = emptyMap(), extraScopePropertyHolders: Map<String, RuntimeValueAccessor> = emptyMap()): RuntimeValue {
        // Like Kotlin, evaluate arguments in the caller's scope, before `this`
        // becomes the subject: in `karten.add(neueKarte())` the implicit receiver
        // of neueKarte() is the caller, not the list. Lambdas too, so that their
        // `this` is the caller's (`liste.map { this.f(it) }`, RT-90). Named and
        // vararg arguments keep the original path (different index mapping).
        val isVararg = function.valueParameters.firstOrNull()?.modifiers?.contains(FunctionValueParameterModifier.vararg) == true
        val replaceArguments = if (replaceArguments.isEmpty() && arguments.isNotEmpty() && !isVararg && arguments.none { it.name != null }) {
            val values = arrayOfNulls<RuntimeValue>(arguments.size)
            for (index in arguments.indices) values[index] = arguments[index].value.eval() as RuntimeValue
            ArgumentValues(values)
        } else replaceArguments
        return evalClassMemberAnyFunctionCall(position, subject, function.receiver, function) { typeResolutions ->
            evalFunctionCall(
                // Only the arguments, type arguments and position of the call node are used.
                callNode = this,
                functionNode = function,
                extraScopeParameters = emptyMap(),
                extraScopePropertyHolders = extraScopePropertyHolders,
                extraTypeResolutions = typeResolutions /* type arguments */,
                replaceArguments = replaceArguments,
                subject = subject,
            )
        }
    }

    suspend fun evalClassMemberAnyFunctionCall(position: SourcePosition, subject: RuntimeValue, function: CallableNode, arguments: Array<RuntimeValue?>, typeArguments: Array<TypeNode> = emptyArray(), extraScopePropertyHolders: Map<String, RuntimeValueAccessor> = emptyMap()): RuntimeValue {
        return evalClassMemberAnyFunctionCall(position, subject, subject.type().toTypeNode(), function) { typeResolutions ->
            evalFunctionCall(
                arguments = arguments,
                typeArguments = typeArguments,
                callPosition = position,
                functionNode = function,
                extraScopeParameters = emptyMap(),
                extraScopePropertyHolders = extraScopePropertyHolders,
                extraTypeResolutions = typeResolutions,
                subject = subject,
            )
        }
    }

    private suspend fun evalClassMemberAnyFunctionCall(position: SourcePosition, subject: RuntimeValue, receiverType: TypeNode?, function: CallableNode, callOperation: suspend (typeResolutions: List<TypeParameterNode>) -> FunctionCallResult): RuntimeValue {
        // A native member gets its receiver as an argument; `this` bindings are for interpreted code only.
        if (function is CustomFunctionDeclarationNode && !function.needsCallScope) {
            return callOperation(instanceGenericTypeResolutions(subject)).result
        }
        callStack.push(functionFullQualifiedName = "class", scopeType = ScopeType.ClassMemberFunction, callPosition = position)
        try {
            val symbolTable = callStack.currentSymbolTable()
            // This scope is fresh, so a `this/<type>` binding exists here exactly
            // when it was bound here; no separate name set is needed.
            val subjectType = subject.type()
            // "super" is a hack to resolve the keyword. See documentation
            val isObject = subject is ClassInstance
            symbolTable.bindReceiver(position, subject, subjectType,
                if (subjectType is ObjectType) subjectType.clazz.receiverNames(isObject)
                else if (isObject) arrayOf("this/${subjectType.name}", "this", "super")
                else arrayOf("this/${subjectType.name}", "this"))
            if (subject is ClassInstance) symbolTable.bindOuterReceivers(position, subject)
            if (receiverType != null) {
                val receiverIdentifier = receiverType.resolveGenericParameterTypeToUpperBound(function.typeParameters).descriptiveName()
                val receiverPropertyName = "this/$receiverIdentifier"
                if (!symbolTable.hasProperty(receiverPropertyName, true)) {
                    symbolTable.declareInitializedProperty(position, receiverPropertyName, subjectType, subject)
                }
            }
            // Transformed-name tables are read by the semantic analyzer only;
            // runtime scopes need just the bindings.

//            // TODO optimize to only copy needed members
//            if (subject is ClassInstance) {
//                subject.memberPropertyValues.forEach {
//                    symbolTable.putPropertyHolder(subject.clazz!!.memberPropertyNameToTransformedName[it.key]!!, it.value)
//                }
//            }

            val result = callOperation(instanceGenericTypeResolutions(subject))

            return result.result
        } finally {
            callStack.pop(ScopeType.ClassMemberFunction)
        }
    }

    /**
     * In code of an inner class, the members of the outer object are reached through its
     * `this/<Outer>` names (RT-92), also through several levels of inner classes. Names the
     * object itself has, e.g. a common superclass, stay its own.
     */
    private fun SymbolTable.bindOuterReceivers(position: SourcePosition, instance: ClassInstance) {
        var outer = instance.outerInstance ?: return
        while (true) {
            for (name in outer.clazz!!.receiverNames(true)) {
                if (name.startsWith("this/") && !hasProperty(name, true)) declareInitializedProperty(position, name, outer.type(), outer)
            }
            outer = outer.outerInstance ?: return
        }
    }

    /**
     * The subject's class type arguments, e.g. `T` = `Invader` for a `List<Invader>`; for an
     * inner class also those of its outer objects (RT-92).
     */
    private fun instanceGenericTypeResolutions(subject: RuntimeValue): List<TypeParameterNode> {
        if (subject !is ClassInstance) return emptyList()
        fun own(instance: ClassInstance) = if (instance.typeArguments.isEmpty()) emptyList() else
            instance.clazz!!.typeParameters.mapIndexed { index, it ->
                TypeParameterNode(it.position, it.name, instance.typeArguments[index].toTypeNode())
            }
        val outer = subject.outerInstance ?: return own(subject)
        return instanceGenericTypeResolutions(outer).filter { o -> subject.clazz!!.typeParameters.none { it.name == o.name } } + own(subject)
    }

    suspend fun BlockNode.eval(): RuntimeValue {
        if (!declaresNames) {
            var value: RuntimeValue = UnitValue
            for (statement in statements) {
                statementPosition = statement.position
                value = statement.eval() as? RuntimeValue ?: UnitValue
            }
            return value
        }
        // additional scope because new variables can be declared in blocks of `if`, `while`, etc.
        // also, function parameters can be shadowed
        callStack.push(functionFullQualifiedName = null, scopeType = type, callPosition = position)
        val result = try {
            var value: RuntimeValue = UnitValue
            for (statement in statements) {
                statementPosition = statement.position
                value = statement.eval() as? RuntimeValue ?: UnitValue
            }
            value
        } finally {
            callStack.pop(type)
        }
        return result
    }

    suspend fun ReturnNode.eval() {
        val value = (value?.eval() ?: UnitValue) as RuntimeValue
        throw NormalReturnException(returnToAddress = returnToAddress, returnToLabel = returnToLabel, value = value,
            target = if (returnToAddress.isEmpty()) null else symbolTable().findReturnTarget(returnToAddress)
                ?: throw InterpreterStateException("Return target is no longer active: $returnToAddress"))
    }

    suspend fun BreakNode.eval() {
        throw NormalBreakException(returnToLabel)
    }

    suspend fun ContinueNode.eval() {
        throw NormalContinueException(returnToLabel)
    }

    /** Whether a `break`/`continue` with [jumpLabel] belongs to the loop labeled [loopLabel] (RT-85). */
    private fun isOwnJump(jumpLabel: String, loopLabel: String?) = jumpLabel.isEmpty() || jumpLabel == loopLabel

    suspend fun IfNode.eval(): RuntimeValue {
        val conditionalValue = condition.eval() as BooleanValue
        return if (conditionalValue.value) {
            trueBlock?.eval() ?: UnitValue
        } else {
            falseBlock?.eval() ?: UnitValue
        }
    }

    suspend fun WhileNode.eval() {
//        if (conditionalValue.value) {
//            if (body == null || body.statements.isEmpty()) {
//                throw NotPermittedOperationException("Infinite loop is not allowed")
//            }
//        }
        // TODO detect infinite loop
        try {
            while ((condition.eval() as BooleanValue).value) {
                checkpoint()
                try {
                    body?.eval()
                } catch (e: NormalContinueException) {
                    if (!isOwnJump(e.label, label)) throw e
                }
            }
        } catch (e: NormalBreakException) {
            if (!isOwnJump(e.label, label)) throw e
        }
    }

    suspend fun DoWhileNode.eval() {
        try {
            do {
                checkpoint()
                try {
                    body?.eval()
                } catch (e: NormalContinueException) {
                    if (!isOwnJump(e.label, label)) throw e
                }
            } while ((condition.eval() as BooleanValue).value)
        } catch (e: NormalBreakException) {
            if (!isOwnJump(e.label, label)) throw e
        }
    }

    suspend fun ClassDeclarationNode.eval() {
        val declarationScope = callStack.currentSymbolTable()
        val classType = TypeNode(
            position = position,
            name = fullQualifiedName,
            arguments = typeParameters.map { TypeNode(it.position, it.name, null, false) }.emptyToNull(),
            isNullable = false,
        )

        val interfaceInvocations: List<TypeNode>
        val superClassInvocation: FunctionCallNode?
        if (isInterface) {
            superInvocations?.firstOrNull { it is FunctionCallNode }
                ?.let {
                    throw RuntimeException("Interface cannot inherit a class")
                }
            interfaceInvocations = superInvocations?.filterIsInstance<TypeNode>() ?: emptyList()
            superClassInvocation = null
        } else {
            val superClassInvocations = superInvocations?.filterIsInstance<FunctionCallNode>()
            if ((superClassInvocations?.size ?: 0) > 1) {
                throw RuntimeException("A class can only inherit at most one other class")
            }
            interfaceInvocations = superInvocations?.filterIsInstance<TypeNode>() ?: emptyList()
            superClassInvocation = superClassInvocations?.firstOrNull()
        }

        val superClass = (superClassInvocation?.function as? TypeNode)
            ?.let { declarationScope.findClass(it.name) ?: throw RuntimeException("Super class `${it.name}` not found") }
            ?.first

        val clazz: ClassDefinition
        callStack.push(fullQualifiedName, ScopeType.Class, position)
        try {
            typeParameters.forEach {
                callStack.currentSymbolTable().declareTypeAlias(position, it.name, it.typeUpperBound)
            }

            declarationScope.declareClass(position, ClassDefinition(
                currentScope = callStack.currentSymbolTable(),
                name = name,
                modifiers = modifiers,
                isInterface = isInterface,
                fullQualifiedName = fullQualifiedName,
                typeParameters = typeParameters,
                isInstanceCreationAllowed = true,
                primaryConstructor = primaryConstructor,
                rawMemberProperties = emptyList(),
                memberFunctions = declarations
                    .filterIsInstance<FunctionDeclarationNode>()
                    .filterNot { it is ClassSecondaryConstructorNode }
                    .filter { it.receiver == null },
//                    .associateBy { it.transformedRefName!! },
                orderedInitializersAndPropertyDeclarations = declarations
                    .filter { it is ClassInstanceInitializerNode || it is PropertyDeclarationNode },
                declarations = declarations,
                superClassInvocation = superClassInvocation,
                superClass = superClass,
                superInterfaceTypes = interfaceInvocations,
                superInterfaces = interfaceInvocations.map {
                    val clazz = symbolTable().findClass(it.name)?.first
                        ?: throw RuntimeException("Interface ${it.name} cannot be found")
                    if (!clazz.isInterface) {
                        throw RuntimeException("${it.name} is not an interface")
                    }
                    clazz
                },
                isObjectDeclaration = isObject,
            ).also {
                clazz = it
                // Property types may name classes declared later (e.g. two
                // classes referencing each other), so resolve them on first use.
                it.deferProperties((primaryConstructor?.parameters
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
                        )
                    } ?: emptyList()) +
                        declarations.filterIsInstance<PropertyDeclarationNode>())
                it.attachToInterpreter(this@Interpreter)
            })
            // register extension functions in global scope
            declarations
                .filterIsInstance<FunctionDeclarationNode>()
                .filter { it.receiver != null }
                .forEach { globalScope.declareExtensionFunction(it.position, it.transformedRefName!!, it) }
        } finally {
            callStack.pop(ScopeType.Class)
        }

        // companion object: the declared one, else an implicit one (e.g. for enum `valueOf`);
        // an object has none
        companionObject?.let { it.eval(); return }
        if (isObject) return
        callStack.currentSymbolTable().declareClass(position, ClassDefinition(
            currentScope = callStack.currentSymbolTable(),
            name = "$name.Companion",
            fullQualifiedName = "$fullQualifiedName.Companion",
            modifiers = emptySet(),
            typeParameters = emptyList(),
            isInstanceCreationAllowed = false,
            orderedInitializersAndPropertyDeclarations = emptyList(),
            declarations = emptyList(),
            rawMemberProperties = emptyList(),
            memberFunctions = buildList {
                if (ClassModifier.enum in modifiers) {
                    add(CustomFunctionDeclarationNode(
                        CustomFunctionDefinition(
                            position = position,
                            receiverType = "$fullQualifiedName.Companion",
                            functionName = "valueOf",
                            returnType = classType.descriptiveName(),
                            parameterTypes = listOf(CustomFunctionParameter("value", "String")),
                            executable = { interpreter, receiver, args, typeArgs ->
                                val value: String = (args[0] as StringValue).value
                                clazz.enumValues[value]
                                    ?: throwEvalRuntimeException(
                                        position,
                                        "Enum value '$value' not found in class $name"
                                    )
                            }
                        ),
                        transformedRefName = executionEnvironment.findGeneratedMapping(
                            type = ExecutionEnvironment.SymbolType.Function,
                            receiverType = "$fullQualifiedName.Companion",
                            name = "valueOf",
                        ).transformedName,
                    ))
                    // like Kotlin's `values()`, but a List: BlueK has no arrays (RT-78)
                    add(CustomFunctionDeclarationNode(
                        CustomFunctionDefinition(
                            position = position,
                            receiverType = "$fullQualifiedName.Companion",
                            functionName = "values",
                            returnType = "List<${classType.descriptiveName()}>",
                            parameterTypes = emptyList(),
                            executable = { interpreter, _, _, _ ->
                                ListValue(clazz.enumValues.values.toList() as List<RuntimeValue>, interpreter.symbolTable().assertToDataType(classType), interpreter.symbolTable())
                            }
                        ),
                        transformedRefName = executionEnvironment.findGeneratedMapping(
                            type = ExecutionEnvironment.SymbolType.Function,
                            receiverType = "$fullQualifiedName.Companion",
                            name = "values",
                        ).transformedName,
                    ))
                }
            },
            primaryConstructor = null
        ).also { it.attachToInterpreter(this@Interpreter) })

        // creating enum values
        if (ClassModifier.enum in modifiers) {
            clazz.enumValues = enumEntries.withIndex().associate { (ordinal, entry) ->
                val instance = entry.call!!.eval() as ClassInstance
                instance.enumName = entry.name
                instance.enumOrdinal = ordinal
                entry.name to instance
            }
            // `name` and `ordinal` of every entry, like Kotlin's `Enum` (RT-78)
            listOf(
                Triple("name", "String") { value: ClassInstance -> StringValue(value.enumName!!, symbolTable()) as RuntimeValue },
                Triple("ordinal", "Int") { value: ClassInstance -> IntValue(value.enumOrdinal, symbolTable()) as RuntimeValue },
            ).forEach { (propertyName, propertyType, read) ->
                ExtensionProperty(
                    declaredName = propertyName,
                    receiver = fullQualifiedName,
                    type = propertyType,
                    getter = { _, receiver, _ -> read((receiver as ClassInstance).wholeInstance()) },
                ).also {
                    val transformedName = executionEnvironment.findGeneratedMapping(
                        type = ExecutionEnvironment.SymbolType.ExtensionProperty,
                        receiverType = fullQualifiedName,
                        name = propertyName,
                    ).transformedName
                    it.transformedName = transformedName
                    symbolTable().declareExtensionProperty(position, transformedName, it)
                }
            }

            ExtensionProperty(
                declaredName = "entries",
                receiver = "$fullQualifiedName.Companion",
                type = "List<${classType.descriptiveName()}>",
                getter = { interpreter, _, _ ->
                    ListValue(clazz.enumValues.values.toList() as List<RuntimeValue>, interpreter.symbolTable().assertToDataType(classType), interpreter.symbolTable())
                }
            ).also {
                val transformedName = executionEnvironment.findGeneratedMapping(
                    type = ExecutionEnvironment.SymbolType.ExtensionProperty,
                    receiverType = "$fullQualifiedName.Companion",
                    name = "entries",
                ).transformedName
                it.transformedName = transformedName
                symbolTable().declareExtensionProperty(position, transformedName, it)
            }
        }
    }

    suspend fun NavigationNode.eval(): RuntimeValue = evalOn(subject.eval() as RuntimeValue)

    /** Reads the member of an already evaluated [subjectValue]. */
    suspend fun NavigationNode.evalOn(subjectValue: RuntimeValue): RuntimeValue {
        val obj = subjectValue
            .let { resolveSuperKeyword(it) }
//        return obj.memberPropertyValues[member.transformedRefName!!]!!

        if (memberType == NavigationNode.MemberType.Extension && transformedRefName != null) {
            val extensionProperty = symbolTable().findExtensionProperty(transformedRefName!!)
                ?: throw RuntimeException("Extension property `${member.name}` on receiver `${obj.type().nameWithNullable}` could not be found")

            if (obj === NullValue && !extensionProperty.receiverType!!.isNullable) {
                if (operator == ".") {
                    throw EvaluateNullPointerException(callStack.currentSymbolTable(), callStack.getStacktrace(position))
                } else if (operator == "?.") {
                    return obj
                }
            }

            val typeArgumentsMap = extensionProperty.typeArgumentsMap(obj.type())

            extensionProperty.getter?.let { getter ->
                return getter(this@Interpreter, obj, typeArgumentsMap)
            }
        }
        if (memberType == NavigationNode.MemberType.Enum) {
            val originalClassName = (obj as ClassInstance).clazz!!.fullQualifiedName.removeSuffix(".Companion")
            val enumClazz = symbolTable().findClass(originalClassName)?.first
                ?: throw RuntimeException("Cannot find class $originalClassName")
            if (ClassModifier.enum !in enumClazz.modifiers) {
                throw RuntimeException("Class `$originalClassName` is not an enum class")
            }
            return enumClazz.enumValues[member.name]
                ?: throw RuntimeException("No such enum `${member.name}` in class `$originalClassName`")
        }

        if (obj === NullValue) {
            if (operator == "?.") {
                return NullValue
            }
            throw EvaluateNullPointerException(callStack.currentSymbolTable(), callStack.getStacktrace(position))
        }
        obj as? ClassInstance ?: throw RuntimeException("Cannot access member `${member.name}` for type `${obj.type().nameWithNullable}`")
        if (!callStack.isInsideClassCode() && obj.clazz!!.isPrivateMemberProperty(member.name)) {
            throw RuntimeException("Private property `${member.name}` cannot be accessed here")
        }
        // before type resolution is implemented in SemanticAnalyzer, reflect from clazz as a slower alternative
        val value = try {
            obj.read(this@Interpreter, memberSlotIn(obj))
        } catch (e: UninitializedPropertyAccessException) {
            // like Kotlin for a `lateinit var` (RT-81)
            throw UninitializedPropertyAccessException(
                if (obj.clazz!!.isLateinitMemberProperty(member.name)) "lateinit property ${member.name} has not been initialized"
                else "Property ${member.name} has not been initialized"
            )
        }
        return when (val r = value) {
            is RuntimeValue -> r
            /*is FunctionDeclarationNode -> {
                FunctionCallNode(
                    function = r,
                    arguments = emptyList(),
                    position = SourcePosition(1, 1)
                ).evalClassMemberAnyFunctionCall(obj, r)
            } // TODO remove */
            else -> throw UnsupportedOperationException()
        }
    }

    suspend fun IndexOpNode.eval(): RuntimeValue {
        if (hasFunctionCall == true) {
            return call!!.eval()
        } else {
            return subject.eval() as RuntimeValue
        }
    }

    suspend fun AsOpNode.eval(): RuntimeValue {
        val value = expression.eval() as RuntimeValue
        val targetType = symbolTable().typeNodeToDataType(type) ?: throw RuntimeException("Unknown type `${type.descriptiveName()}`")
        return if (targetType.acceptsRuntimeType(value.type())) {
            value
        } else if (isNullable) {
            NullValue
        } else {
            throw EvaluateTypeCastException(symbolTable(), callStack.getStacktrace(position), value.type().descriptiveName, targetType.descriptiveName)
        }
    }

    suspend fun LambdaLiteralNode.eval(): RuntimeValue {
        val refs = this.accessedRefs!!
        val currentSymbolTable = callStack.currentSymbolTable()
        val runtimeRefs = SymbolTable(Int.MAX_VALUE, "lambda-symbol-ref", ScopeType.Closure, currentSymbolTable.rootScope)
        refs.returnTargets.forEach { id ->
            runtimeRefs.putReturnTarget(id, currentSymbolTable.findReturnTarget(id)
                ?: throw InterpreterStateException("Missing lexical return target: $id"))
        }
        refs.properties.forEach {
            // an object instance is no variable to capture
            if (it.startsWith(OBJECT_REF_PREFIX)) return@forEach
            runtimeRefs.putPropertyHolder(it, false /* TODO review */, currentSymbolTable.getPropertyHolder(it))
        }
        // Like Kotlin, `this` in a lambda without receiver is the `this` where it is written, also
        // for a nested lambda that uses it (`map { x -> listOf(1).map { this.f(x) } }`, RT-90).
        if (receiverType == null && "this" !in refs.properties) {
            // No exception for a lambda without `this`: it would be costly and could swallow a host stack overflow.
            currentSymbolTable.findPropertyHolder("this")?.let { runtimeRefs.putPropertyHolder("this", false, it) }
        }
        refs.functions.forEach {
            runtimeRefs.declareFunction(position, it, currentSymbolTable.findFunction(it)!!.first)
        }
        refs.extensionFunctions.forEach {
            val extensionFunction = currentSymbolTable.findExtensionFunctionWithReceiver(it)!!
            runtimeRefs.declareExtensionFunction(position, it, extensionFunction.second, extensionFunction.first)
        }
        refs.classes.forEach {
            runtimeRefs.declareClass(position, currentSymbolTable.findClass(it)!!.first)
        }
        refs.typeAlias.forEach {
//            runtimeRefs.declareTypeAlias(it, currentSymbolTable.findTypeAlias(it)!!.first.toTypeNode(), currentSymbolTable)
            val resolution = currentSymbolTable.findTypeAliasResolution(it)!!.toTypeNode()
            runtimeRefs.declareTypeAlias(position, it, currentSymbolTable.findTypeAlias(it)!!.first.toTypeNode(), currentSymbolTable)
            runtimeRefs.declareTypeAliasResolution(position, it, resolution, currentSymbolTable)
        }

//        fun processTypeParameter(dataType: DataType) {
//            when (dataType) {
//                is TypeParameterType -> {
//                    runtimeRefs.declareTypeAlias(dataType.name, dataType.upperBound.toTypeNode())
//                }
//                is FunctionType -> {
//                    dataType.arguments.forEach { processTypeParameter(it) }
//                    processTypeParameter(dataType.returnType)
//                }
//                is ObjectType -> {
//                    dataType.arguments.forEach { processTypeParameter(it) }
//                }
//                else -> {}
//            }
//        }
        val lambdaType = callStack.currentSymbolTable().typeNodeToDataType(type!!) as FunctionType
//        processTypeParameter(lambdaType)

        return LambdaValue(this, lambdaType, runtimeRefs, this@Interpreter)
    }

    suspend fun InfixFunctionCallNode.eval(): RuntimeValue {
        call?.eval()?.let {
            if (functionName == "!in") {
                return BooleanValue((it as BooleanValue).value.not())
            }
            return it
        }

        val n1 = node1.eval() as RuntimeValue
        return when (functionName) {
            "to" -> {
                val n2 = node2.eval() as RuntimeValue
                PairValue(n1 to n2, n1.type(), n2.type(), symbolTable())
            }
            "is", "!is" -> {
                val type = symbolTable().assertToDataType(node2 as TypeNode)
                val isType = type.acceptsRuntimeType(n1.type())
                BooleanValue(if (functionName == "is") isType else !isType)
            }
            else -> throw RuntimeException("Unknown infix function `$functionName`")
        }
    }

    suspend fun ElvisOpNode.eval(): RuntimeValue {
        val result = primaryNode.eval() as RuntimeValue
        if (result != NullValue) {
            return result
        }
        return fallbackNode.eval() as RuntimeValue
    }

    suspend fun ThrowNode.eval(): RuntimeValue {
        var initialResult = value.eval() as RuntimeValue
        var result: RuntimeValue? = initialResult
        while (result !is ThrowableValue && result is ClassInstance) {
            result = result.parentInstance
        }
        if (result !is ThrowableValue) {
            throw EvaluateTypeCastException(
                currentScope = symbolTable(),
                stacktrace = callStack.getStacktrace(position),
                valueType = initialResult.type().descriptiveName,
                targetType = "Throwable",
            )
        }
        // The thrown object's own `Throwable` part, not a copy: `catch` gets the object itself
        // (`wholeInstance()`) with the fields of a student exception class.
        throw EvaluateRuntimeException(stacktrace = callStack.getStacktrace(position), error = result)
    }

    fun throwEvalRuntimeException(position: SourcePosition, message: String): Nothing {
        val stacktrace = callStack.getStacktrace(position)
        val error = ExceptionValue(
            currentScope = symbolTable(),
            message = message,
            cause = null,
            stacktrace = stacktrace,
            // Provided-class templates are not initialized. Use the definition
            // attached to this interpreter so catch can inspect its runtime type.
            thisClazz = symbolTable().findClass("Exception")!!.first,
        )
        throw EvaluateRuntimeException(stacktrace = stacktrace, error = error)
    }

    suspend fun TryNode.eval(): RuntimeValue {
        try {
            return mainBlock.eval() as RuntimeValue
        } catch (e: EvaluateRuntimeException) {
            val thrown = e.error.wholeInstance()
            for (catch in catchBlocks) {
                if (symbolTable().assertToDataType(catch.catchType).isAssignableFrom(thrown.type())) {
                    return catch.eval(thrown)
                }
            }
            throw e
        } catch (e: com.sunnychung.lib.multiplatform.kotlite.error.controlflow.NormalControlFlowException) {
            throw e
        } catch (e: InterpreterStateException) {
            throw e
        } catch (e: Throwable) {
            // Thrown by host code, e.g. `NumberFormatException` from the stdlib's `"x".toInt()`.
            if (catchBlocks.isEmpty()) throw e
            val error = e.toValue()
            for (catch in catchBlocks) {
                if (symbolTable().assertToDataType(catch.catchType).isAssignableFrom(error.type())) {
                    return catch.eval(error)
                }
            }
            throw e
        } finally {
            finallyBlock?.eval()
        }
    }

    /**
     * A host exception as seen by interpreted code: a standard Kotlin exception gets its Kotlite class, so that
     * `catch (e: NumberFormatException)` and `catch (e: Exception)` match; anything else is a plain `Throwable`.
     */
    private fun Throwable.hostStacktrace(): List<String> = hostExceptionTrace?.takeIf { it.first === this }?.second ?: emptyList()

    /** Stack trace of an exception that left the program, as `printStackTrace()` shows it; empty if unknown. */
    fun stacktraceOf(e: Throwable): List<String> = (e as? EvaluateRuntimeException)?.error?.stacktrace ?: e.hostStacktrace()

    fun Throwable.toValue(): ThrowableValue {
        val cause = cause?.toValue()
        val standardClass = StandardExceptionValue.classNameOf(this)?.let { symbolTable().findClass(it)?.first }
        return if (standardClass != null) {
            StandardExceptionValue(symbolTable(), message, cause, hostStacktrace(), standardClass)
        } else {
            ThrowableValue(symbolTable(), message, cause, hostStacktrace(), fullClassName, symbolTable().findClass("Throwable")!!.first)
        }
    }

    suspend fun CatchNode.eval(value: ClassInstance): RuntimeValue {
        callStack.push("<catch>", ScopeType.Catch, position)
        return try {
            valueTransformedRefName?.let { valueTransformedRefName ->
                symbolTable().declareProperty(
                    position = position,
                    name = valueTransformedRefName,
                    type = catchType,
                    isMutable = false,
                )
                symbolTable().assign(name = valueTransformedRefName, value = value)
            }
            block.eval()
        } finally {
            callStack.pop(ScopeType.Catch)
        }
    }

    suspend fun WhenNode.eval(): RuntimeValue {
        callStack.push("<when>", ScopeType.WhenOuter, position)
        try {
            val subjectValue = subject?.value?.eval() as? RuntimeValue ?: UnitValue
            if (subject?.hasValueDeclaration() == true) {
                subject.valueTransformedRefName?.let { valueTransformedRefName ->
                    symbolTable().declareProperty(
                        position = position,
                        name = valueTransformedRefName,
                        type = subject.type!!,
                        isMutable = false,
                    )
                    symbolTable().assign(name = valueTransformedRefName, value = subjectValue)
                }
            }
            entries.forEach { entry ->
                if (entry.conditions.isEmpty() || entry.conditions.any {
                        when (it.testType) {
                            WhenConditionNode.TestType.TypeTest -> {
                                val type = symbolTable().assertToDataType(it.expression as TypeNode)
                                type.isAssignableFrom(subjectValue.type())
                                    .let { result -> if (it.isNegateResult) !result else result }
                            }
                            WhenConditionNode.TestType.RangeTest -> {
                                (it.call!!.eval(replaceArguments = ArgumentValues.of(0, subjectValue)) as BooleanValue).value
                                    .let { result -> if (it.isNegateResult) !result else result }
                            }
                            else -> {
                                val evalExprResult = it.expression.eval()
                                if (subject == null) {
                                    (evalExprResult as BooleanValue).value
                                } else {
                                    evalExprResult == subjectValue
                                }
                            }
                        }
                    }
                ) {
                    return entry.body.eval()
                }
            }
            // A `when` statement without `else` does nothing if no entry matches.
            if (!isExhaustive) return UnitValue
            throw RuntimeException("No match for `when` expression at $position")
        } finally {
            callStack.pop(ScopeType.WhenOuter)
        }
    }

    suspend fun ForNode.eval(): RuntimeValue {
        val subjectValue = subject.eval() as RuntimeValue
        callStack.push("<for>", ScopeType.For, position)

        fun FunctionCallNode.enrichIterableCall(receiverType: DataType): FunctionCallNode {
            val functionName = (function as NavigationNode).member.name
            val actualFunction = symbolTable().findFunctionOrExtensionFunctionIncludingSuperclassesByDeclaredName(
                receiverType.toTypeNode(), functionName
            ).single()
            val functionReceiverType = actualFunction.receiver!!
            val functionTypeParameters = actualFunction.typeParameters
            val inferredTypeArguments: List<TypeNode>

            if (functionTypeParameters.isNotEmpty()) {
                var type: DataType? = receiverType
                if (type != null && type.name != functionReceiverType.name) {
                    type = (type as? ObjectType)?.findSuperType(functionReceiverType.name)
                }
                if (type == null && type !is ObjectType) {
                    throw RuntimeException("Enrich fail -- Receiver type of `$functionName` ${functionReceiverType.descriptiveName()} is not found")
                }
                val functionReceiverClazzTypeParameters = (type as ObjectType).clazz.typeParameters
                val functionReceiverClazzTypeArguments = (type as ObjectType).arguments
                val functionReceiverClazzTypeArgumentsMap = functionReceiverClazzTypeParameters.mapIndexed { i, tp ->
                    tp.name to functionReceiverClazzTypeArguments[i]
                }.toMap()
                inferredTypeArguments = functionTypeParameters.map {
                    functionReceiverClazzTypeArgumentsMap[it.name]!!.toTypeNode()
                }
            } else {
                inferredTypeArguments = emptyList()
            }

            return copy(
                functionRefName = actualFunction.transformedRefName,
                inferredTypeArguments = inferredTypeArguments,
            )
        }

        try {
            symbolTable().declareProperty(subject.position, "#subject", subjectValue.type(), false)
            symbolTable().assign("#subject", subjectValue)

            // TODO move the call lookups to Semantic Analyzer. Currently impossible because runtime class type member always has higher priority than compile-time type
            // The lookups depend only on the runtime types; they are kept for the next run of this loop.
            fun call(subjectName: String, functionName: String) = FunctionCallNode(
                function = NavigationNode(
                    position = position,
                    subject = VariableReferenceNode(position, subjectName),
                    operator = ".",
                    member = ClassMemberReferenceNode(position, functionName)
                ),
                arguments = emptyList(),
                declaredTypeArguments = emptyList(),
                position = position,
                callableType = CallableType.ExtensionFunction,
            )
            val subjectType = subjectValue.type()
            if (iteratorCallFor !== subjectType) {
                iteratorCall = call("#subject", "iterator").enrichIterableCall(subjectType)
                iteratorCallFor = subjectType
            }
            val iteratorValue = iteratorCall!!.eval()
            symbolTable().declareProperty(subject.position, "#iterator", iteratorValue.type(), false)
            symbolTable().assign("#iterator", iteratorValue)
            val iteratorType = iteratorValue.type()
            if (iterationCallsFor !== iteratorType) {
                hasNextCall = call("#iterator", "hasNext").enrichIterableCall(iteratorType)
                nextCall = call("#iterator", "next").enrichIterableCall(iteratorType)
                iterationCallsFor = iteratorType
            }
            val hasNextCall = hasNextCall!!
            val nextCall = nextCall!!
            // Every iteration declares the variables in this same scope: resolve their types once.
            val variableTypes = variables.map {
                symbolTable().typeNodeToPropertyType(it.type, false)?.type ?: throw RuntimeException("Unknown type ${it.type.name}")
            }

            // `break` and `continue` end the loop or this iteration, as in `while` (RT-55).
            try {
                while ((hasNextCall.eval() as BooleanValue).value) {
                    checkpoint()
                    val nextValue = nextCall.eval()

                    variables.forEachIndexed { index, it ->
                        symbolTable().declareProperty(
                            position = position,
                            name = it.transformedRefName!!,
                            type = variableTypes[index],
                            isMutable = false,
                        )
                        symbolTable().assign(name = it.transformedRefName!!, value = nextValue)
                    }

                    try {
                        body.eval()
                    } catch (e: NormalContinueException) {
                        if (!isOwnJump(e.label, label)) throw e
                    }

                    variables.forEach {
                        symbolTable().undeclareProperty(it.transformedRefName!!)
                    }
                }
            } catch (e: NormalBreakException) {
                if (!isOwnJump(e.label, label)) throw e
            }
        } finally {
            callStack.pop(ScopeType.For)
        }
        return UnitValue
    }

    suspend fun StringNode.eval(): StringValue {
        val value = buildString {
            for (node in nodes) append((node.eval() as RuntimeValue).convertToString())
        }
        return StringValue(value)
    }

    suspend fun StringLiteralNode.eval() = StringValue(content)

    suspend fun IntegerNode.eval() = IntValue(value)
    suspend fun LongNode.eval() = LongValue(value)
    suspend fun DoubleNode.eval() = DoubleValue(value)
    suspend fun BooleanNode.eval() = BooleanValue(value)
    suspend fun CharNode.eval() = CharValue(value)
    suspend fun NullNode.eval() = NullValue
    suspend fun ValueNode.eval() = value

    fun StringValue(value: String) = StringValue(value, symbolTable())
    fun IntValue(value: Int) = IntValue(value, symbolTable())
    fun LongValue(value: Long) = LongValue(value, symbolTable())
    fun DoubleValue(value: Double) = DoubleValue(value, symbolTable())
    fun BooleanValue(value: Boolean) = BooleanValue(value, symbolTable())
    fun CharValue(value: Char) = CharValue(value, symbolTable())

    fun ASTNode.declaredType(): DataType = when (this) {
        is NavigationNode -> this.declaredType()
        is VariableReferenceNode -> this.declaredType()
        is IndexOpNode -> this.declaredType()
        else -> throw UnsupportedOperationException()
    }


    fun NavigationNode.declaredType(): DataType {
        return callStack.currentSymbolTable().typeNodeToPropertyType(type!!, false)!!.type
    }

    fun VariableReferenceNode.declaredType(): DataType {
        return callStack.currentSymbolTable().typeNodeToPropertyType(type!!, false)!!.type
    }

    fun IndexOpNode.declaredType(): DataType {
        return callStack.currentSymbolTable().assertToDataType(call!!.returnType!!)
    }

    suspend fun evalSuspended(): RuntimeValue {
        log.d { "=== Interpreter eval() ===" }
        return rootNode.eval() as? RuntimeValue ?: UnitValue
    }

    /** Synchronous compatibility boundary for legacy host callers. */
    fun eval(): RuntimeValue = runImmediately { evalSuspended() }

    /**
     * Runs interpreted code for a synchronous caller: legacy host APIs and the
     * callbacks of library code (lambdas, `toString`, `equals`, `compareTo`).
     *
     * Inside replayable library code ([callReplayable]) a callback may suspend:
     * the library code is abandoned, and replayed once the callback completed.
     * Anywhere else a suspension fails; hosts avoid it by checking [canSuspend].
     */
    fun <T> runImmediately(block: suspend () -> T): T {
        val replayable = activeReplayableCall
        if (replayable != null) {
            if (replayable.hasRecordedOutcome()) {
                @Suppress("UNCHECKED_CAST")
                return replayable.replayOutcome() as T
            }
            // Library code that swallowed the unwinding must not run further callbacks.
            if (replayable.suspendedCallback != null) throw AbandonedNativeCall()
        }
        var completed: Result<T>? = null
        var suspendedCallback: SuspendedCallback? = null
        activeReplayableCall = null
        synchronousCallbacks += 1
        if (replayable == null) nonResumableCallbacks += 1
        try {
            block.startCoroutine(object : kotlin.coroutines.Continuation<T> {
                override val context: kotlin.coroutines.CoroutineContext = kotlin.coroutines.EmptyCoroutineContext
                override fun resumeWith(result: Result<T>) {
                    val suspended = suspendedCallback
                    if (suspended == null) completed = result else suspended.complete(result)
                }
            })
        } finally {
            synchronousCallbacks -= 1
            if (replayable == null) nonResumableCallbacks -= 1
            activeReplayableCall = replayable
        }
        completed?.let { result ->
            replayable?.record(result)
            return result.getOrThrow()
        }
        if (replayable == null) throw InterpreterStateException("Execution suspended at a synchronous compatibility boundary")
        replayable.abandon(SuspendedCallback().also { suspendedCallback = it })
    }

    /**
     * Runs synchronous library code whose callbacks may suspend. The code must
     * be deterministic and free of side effects of its own until it returns
     * (see [CustomFunctionDefinition.isReplayable]): after a suspended callback
     * completes, it runs again from the start with the recorded callback
     * outcomes.
     */
    internal suspend fun <T> callReplayable(block: () -> T): T {
        val call = ReplayableNativeCall()
        while (true) {
            val enclosing = activeReplayableCall
            activeReplayableCall = call
            call.beginAttempt()
            val outcome = try {
                Result.success(block())
            } catch (error: Throwable) {
                Result.failure(error)
            } finally {
                activeReplayableCall = enclosing
            }
            val suspended = call.suspendedCallback ?: return outcome.getOrThrow()
            call.record(suspended.await())
        }
    }

    suspend fun evaluateNode(node: ASTNode): Any = node.eval()

    companion object {
        /**
         * Python's default limit. Each call searches its callers' scopes, so the
         * time grows with the square of the depth: endless recursion must fail fast.
         */
        const val DEFAULT_MAX_CALL_DEPTH = 1_000

        /** Well below the roughly one hundred calls a browser worker stack holds. */
        private const val CALLS_PER_STACK_RESET = 32

        private const val STACK_TRACE_LIMIT = 64
    }
}
