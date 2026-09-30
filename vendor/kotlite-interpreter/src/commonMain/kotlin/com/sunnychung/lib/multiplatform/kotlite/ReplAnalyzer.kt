package com.sunnychung.lib.multiplatform.kotlite

import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer
import com.sunnychung.lib.multiplatform.kotlite.model.*

/**
 * Analysis entry point for incremental hosts. Every analysis runs on a fresh
 * AST; original source positions identify new nodes, regardless of order.
 *
 * Classes may reference each other in any order: `SemanticAnalyzer` declares
 * all classes of the script before it analyzes any declaration. Top-level
 * functions and properties may be used before their position within the same
 * source unit; [unitStarts] are the source offsets where the host appended a
 * new unit (e.g. each Codepad input), so a unit never depends on a later one.
 *
 * The returned script lists the class declarations first (supertypes before
 * subtypes), then the top-level function declarations, then all other nodes
 * in source order. A host that evaluates the new nodes in this order has
 * declared every class and function before code runs that uses it, while
 * property initializers keep their source order. Only an enum class with
 * non-literal entry arguments keeps its place, because its entries are
 * created when it is declared.
 */
object ReplAnalyzer {
    fun analyze(filename: String, source: String, environment: ExecutionEnvironment, retiredProperties: Map<Int, List<String>> = emptyMap(), unitStarts: List<Int> = emptyList()): ScriptNode {
        val script = Parser(Lexer(filename, source)).script()
        fun nodeIndexAt(offset: Int) = script.nodes.indexOfFirst { it.position.index >= offset }
            .let { if (it < 0) script.nodes.size else it }
        // Retire a name at its historical boundary, not before analyzing
        // the initializer of an older alias. Never delete source: symbol
        // numbering must remain identical to the persistent interpreter.
        val retireBeforeNode = linkedMapOf<Int, MutableList<String>>()
        retiredProperties.entries.sortedBy { it.key }.forEach { (offset, names) ->
            retireBeforeNode.getOrPut(nodeIndexAt(offset)) { mutableListOf() }.addAll(names)
        }
        SemanticAnalyzer(script, environment, retireBeforeNode, unitStarts.map { nodeIndexAt(it) }.toSet()).analyze()
        return script.copy(nodes = evaluationOrder(script.nodes))
    }

    private fun evaluationOrder(nodes: List<ASTNode>): List<ASTNode> {
        // Declaring an enum class creates its entries. Arguments other than
        // literals may read top-level properties, so such an enum keeps its place.
        val classes = nodes.filterIsInstance<ClassDeclarationNode>()
            .filter { ClassModifier.enum !in it.modifiers || it.enumEntries.all { entry -> entry.arguments.all { isLiteral(it.value) } } }
        val byName = classes.groupBy { it.name }.mapValues { it.value.first() }
        val ordered = mutableListOf<ClassDeclarationNode>()
        val placed = mutableSetOf<SourcePosition>()
        fun place(node: ClassDeclarationNode) {
            if (!placed.add(node.position)) return
            node.superInvocations.orEmpty().mapNotNull { superName(it) }.mapNotNull { byName[it] }.forEach { place(it) }
            ordered += node
        }
        classes.forEach { place(it) }
        // Declaring a function only registers it; its body runs when it is called.
        val functions = nodes.filterIsInstance<FunctionDeclarationNode>()
        return ordered + functions + nodes.filterNot { (it is ClassDeclarationNode && it.position in placed) || it is FunctionDeclarationNode }
    }

    private fun isLiteral(node: ASTNode): Boolean = when (node) {
        is IntegerNode, is LongNode, is DoubleNode, is BooleanNode, is CharNode, is NullNode, is StringLiteralNode -> true
        is StringNode -> node.nodes.all { it is StringLiteralNode }
        is UnaryOpNode -> node.operator == "-" && node.node?.let { isLiteral(it) } == true
        else -> false
    }

    private fun superName(node: ASTNode): String? = when (node) {
        is FunctionCallNode -> superName(node.function)
        is TypeNode -> node.name
        is VariableReferenceNode -> node.variableName
        else -> null
    }
}
