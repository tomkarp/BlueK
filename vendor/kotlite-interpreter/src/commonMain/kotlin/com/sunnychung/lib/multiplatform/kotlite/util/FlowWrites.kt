package com.sunnychung.lib.multiplatform.kotlite.util

import com.sunnychung.lib.multiplatform.kotlite.model.*

/** Writes to surrounding bindings before resolution, respecting lexical shadowing. */
internal object FlowWrites {
    fun names(nodes: List<ASTNode>): Set<String> {
        val result = mutableSetOf<String>()
        fun scan(node: ASTNode?, hidden: Set<String>) {
            when (node) {
                null -> Unit
                is BlockNode -> {
                    var local = hidden
                    node.statements.forEach {
                        scan(it, local)
                        if (it is PropertyDeclarationNode) local = local + it.name
                    }
                }
                is PropertyDeclarationNode -> scan(node.initialValue, hidden)
                is AssignmentNode -> {
                    (node.subject as? VariableReferenceNode)?.variableName?.takeUnless { it in hidden }?.let(result::add)
                    scan(node.subject, hidden); scan(node.value, hidden)
                }
                is UnaryOpNode -> {
                    if (node.operator in setOf("++", "--")) (node.node as? VariableReferenceNode)?.variableName?.takeUnless { it in hidden }?.let(result::add)
                    scan(node.node, hidden)
                }
                is LambdaLiteralNode -> scan(node.body, hidden + node.valueParameters.map { it.name })
                is FunctionDeclarationNode -> scan(node.body, hidden + node.valueParameters.map { it.name })
                is ClassDeclarationNode -> Unit // separate receiver/bindings
                is IfNode -> { scan(node.condition, hidden); scan(node.trueBlock, hidden); scan(node.falseBlock, hidden) }
                is WhileNode -> { scan(node.condition, hidden); scan(node.body, hidden) }
                is DoWhileNode -> { scan(node.body, hidden); scan(node.condition, hidden) }
                is ForNode -> { scan(node.subject, hidden); scan(node.body, hidden + node.variables.map { it.name }) }
                is TryNode -> { scan(node.mainBlock, hidden); node.catchBlocks.forEach { scan(it.block, hidden + it.valueName) }; scan(node.finallyBlock, hidden) }
                is WhenNode -> { scan(node.subject?.value, hidden); node.entries.forEach { entry -> entry.conditions.forEach { scan(it.expression, hidden) }; scan(entry.body, hidden) } }
                is FunctionCallNode -> { scan(node.function, hidden); node.arguments.forEach { scan(it.value, hidden) } }
                is NavigationNode -> scan(node.subject, hidden)
                is IndexOpNode -> { scan(node.subject, hidden); node.arguments.forEach { scan(it, hidden) } }
                is BinaryOpNode -> { scan(node.node1, hidden); scan(node.node2, hidden) }
                is InfixFunctionCallNode -> { scan(node.node1, hidden); scan(node.node2, hidden) }
                is ElvisOpNode -> { scan(node.primaryNode, hidden); scan(node.fallbackNode, hidden) }
                is AsOpNode -> scan(node.expression, hidden)
                is StringNode -> node.nodes.forEach { scan(it, hidden) }
                is ReturnNode -> scan(node.value, hidden)
                is ThrowNode -> scan(node.value, hidden)
                else -> Unit
            }
        }
        // These are siblings at the current point; subsequent declarations shadow only later nodes.
        var hidden = emptySet<String>()
        nodes.forEach { scan(it, hidden); if (it is PropertyDeclarationNode) hidden = hidden + it.name }
        return result
    }
}
