package com.sunnychung.lib.multiplatform.kotlite.util

import com.sunnychung.lib.multiplatform.kotlite.model.*

/**
 * Normal completion of an analyzed function block, independent of its last
 * expression's value. Summaries retain loop jumps until their target consumes
 * them, and sequence only paths that still reach the next statement.
 *
 * Calls use resolved types (Nothing never completes). Creating a lambda or a
 * local function does not execute its body; inline calls do not imply an
 * exactly-once contract. Exhaustiveness comes from semantic analysis.
 */
internal object ReturnFlow {
    private enum class Kind { Normal, Return, Throw, Break, Continue }
    private data class Exit(val kind: Kind, val label: String = "")
    private val normal = Exit(Kind.Normal)
    private val returns = setOf(Exit(Kind.Return))
    private val throws = setOf(Exit(Kind.Throw))
    private val completes = setOf(normal)

    fun canCompleteNormally(node: ASTNode): Boolean = normal in flow(node)

    /** Evaluate the right side only along normal paths from the left side. */
    private fun then(left: Set<Exit>, right: () -> Set<Exit>): Set<Exit> =
        if (normal in left) (left - normal) + right() else left

    private fun sequence(nodes: List<ASTNode>): Set<Exit> =
        nodes.fold(completes) { previous, node -> then(previous) { flow(node) } }

    private fun flow(node: ASTNode?): Set<Exit> = when (node) {
        null -> completes
        is BlockNode -> sequence(node.statements)
        is ReturnNode -> then(flow(node.value)) { returns }
        is ThrowNode -> then(flow(node.value)) { throws }
        is BreakNode -> setOf(Exit(Kind.Break, node.returnToLabel))
        is ContinueNode -> setOf(Exit(Kind.Continue, node.returnToLabel))
        is FunctionDeclarationNode, is ClassDeclarationNode, is LambdaLiteralNode -> completes
        is PropertyDeclarationNode -> flow(node.initialValue)
        is AssignmentNode -> sequence(listOf(node.subject, node.value))
        is IfNode -> then(flow(node.condition)) { flow(node.trueBlock) + flow(node.falseBlock) }
        is WhenNode -> whenFlow(node)
        is TryNode -> {
            // Any expression in try may throw; each catch is a possible path,
            // even when the main block contains an unconditional return.
            val beforeFinally = flow(node.mainBlock) + node.catchBlocks.flatMap { flow(it.block) }
            val cleanup = flow(node.finallyBlock)
            // Abrupt completion of finally replaces return/throw/loop jumps.
            if (normal in cleanup) beforeFinally + (cleanup - normal) else cleanup
        }
        is WhileNode -> then(flow(node.condition)) {
            loop(flow(node.body), node.label, mayExitOnCondition = !isTrue(node.condition))
        }
        is DoWhileNode -> {
            val body = flow(node.body)
            val outgoing = body.filterNot { it.kind == Kind.Normal || it.isJumpTo(Kind.Continue, node.label) }.toSet()
            val condition = if (normal in body || body.any { it.isJumpTo(Kind.Continue, node.label) }) flow(node.condition) else emptySet()
            loop(outgoing + (condition - normal), node.label, mayExitOnCondition = normal in condition && !isTrue(node.condition))
        }
        is ForNode -> then(flow(node.subject)) { loop(flow(node.body), node.label, mayExitOnCondition = true) }
        is FunctionCallNode -> {
            val receiver = (node.function as? NavigationNode)?.takeIf { it.operator == "?." }
            val invoked = then(sequence(node.arguments.map { it.value })) { valueFlow(node.returnType) }
            // Safe calls may skip their arguments and invocation entirely.
            if (receiver != null) then(flow(receiver.subject)) { completes + invoked }
            else then(flow(node.function)) { invoked }
        }
        is NavigationNode -> then(flow(node.subject)) { valueFlow(node.type) }
        is IndexOpNode -> then(sequence(listOf(node.subject) + node.arguments)) { valueFlow(node.type ?: node.call?.returnType) }
        is BinaryOpNode -> then(flow(node.node1)) {
            val right = flow(node.node2)
            if (node.operator == "&&" || node.operator == "||") completes + right
            else then(right) { valueFlow(node.type ?: node.call?.returnType) }
        }
        is UnaryOpNode -> then(flow(node.node)) { valueFlow(node.type) }
        is InfixFunctionCallNode -> then(sequence(listOf(node.node1, node.node2))) { valueFlow(node.type ?: node.call?.returnType) }
        is AsOpNode -> then(flow(node.expression)) { valueFlow(node.type.copy(isNullable = node.type.isNullable || node.isNullable)) }
        is ElvisOpNode -> then(flow(node.primaryNode)) {
            val primaryType = resolvedType(node.primaryNode)
            val fallback = flow(node.fallbackNode)
            // Nothing? can only be null; otherwise the non-null path can skip fallback.
            if (node.primaryNode is NullNode || primaryType?.name == "Nothing" && primaryType.isNullable) fallback
            else completes + fallback
        }
        is StringNode -> sequence(node.nodes)
        is VariableReferenceNode -> valueFlow(node.type)
        else -> completes
    }

    private fun Exit.isJumpTo(kind: Kind, loopLabel: String?): Boolean =
        this.kind == kind && (label.isEmpty() || label == loopLabel)

    private fun loop(body: Set<Exit>, label: String?, mayExitOnCondition: Boolean): Set<Exit> {
        val breaks = body.any { it.isJumpTo(Kind.Break, label) }
        val outgoing = body.filterNot {
            it.kind == Kind.Normal || it.isJumpTo(Kind.Break, label) || it.isJumpTo(Kind.Continue, label)
        }.toSet()
        return outgoing + if (breaks || mayExitOnCondition) completes else emptySet()
    }

    private fun isTrue(node: ASTNode): Boolean = node is BooleanNode && node.value

    private fun valueFlow(type: TypeNode?): Set<Exit> =
        if (type?.name == "Nothing" && !type.isNullable) throws else completes

    private fun resolvedType(node: ASTNode): TypeNode? = when (node) {
        is VariableReferenceNode -> node.type
        is FunctionCallNode -> node.returnType
        is NavigationNode -> node.type
        is IfNode -> node.type
        is WhenNode -> node.type
        is ElvisOpNode -> node.type
        is TryNode -> node.type
        else -> null
    }

    private fun whenFlow(node: WhenNode): Set<Exit> = then(flow(node.subject?.value)) {
        var unmatched = completes
        var branches = emptySet<Exit>()
        for (entry in node.entries) {
            if (normal !in unmatched) break
            if (entry.isElseCondition()) {
                branches += then(unmatched) { flow(entry.body) }
                unmatched = emptySet()
                break
            }
            // Multiple comma-separated conditions short-circuit like OR.
            var conditions = completes
            var mayMatch = false
            for (condition in entry.conditions) {
                conditions = then(conditions) { flow(condition.expression) }
                if (normal in conditions) mayMatch = true
            }
            branches += conditions - normal
            if (mayMatch) branches += flow(entry.body)
            unmatched = conditions
        }
        branches + (unmatched - normal) + if (!node.isExhaustive && normal in unmatched) completes else emptySet()
    }
}
