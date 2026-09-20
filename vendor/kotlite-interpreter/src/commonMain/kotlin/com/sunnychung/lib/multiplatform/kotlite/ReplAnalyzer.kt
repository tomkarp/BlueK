package com.sunnychung.lib.multiplatform.kotlite

import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer
import com.sunnychung.lib.multiplatform.kotlite.model.*

/**
 * Analysis entry point for incremental hosts. All retries are analysis-only on
 * fresh ASTs; original source positions identify new nodes, regardless of order.
 *
 * TODO: replace the upstream sequential declaration pass with a two-pass symbol
 * declaration pass. Until then the forward-reference compatibility policy lives
 * here, not in an application adapter or UI.
 */
object ReplAnalyzer {
    private val missingClassPatterns = listOf(
        Regex("No matching function (?:or constructor )?`([^`]+)`"),
        Regex("Unknown type `?([A-Za-z_][A-Za-z0-9_]*)"),
        // e.g. a nullable member type `var image: Image?`
        Regex("Cannot resolve type `?([A-Za-z_][A-Za-z0-9_]*)"),
        Regex("Super class `([^`]+)` not found"),
    )
    private val errorPosition = Regex(""":(\d+):(\d+)\]$""")

    fun analyze(filename: String, source: String, environment: ExecutionEnvironment, retiredProperties: Map<Int, List<String>> = emptyMap()): ScriptNode {
        // A forward-referenced class is moved directly before the top-level
        // declaration that needs it (identified by its original source index),
        // so everything that class itself depends on still precedes it.
        val moves = mutableListOf<Pair<String, Int?>>()
        while (true) {
            val parsed = Parser(Lexer(filename, source)).script()
            var nodes = parsed.nodes
            moves.forEach { (name, anchorIndex) ->
                val declaration = nodes.filterIsInstance<ClassDeclarationNode>().first { it.name == name }
                val rest = nodes.filterNot { it === declaration }
                val at = anchorIndex?.let { index -> rest.indexOfFirst { it.position.index == index } }?.takeIf { it >= 0 } ?: 0
                nodes = rest.subList(0, at) + declaration + rest.subList(at, rest.size)
            }
            val script = ScriptNode(parsed.position, nodes)
            val moved = moves.map { it.first }.toSet()
            try {
                // Retire a name at its historical boundary, not before analyzing
                // the initializer of an older alias. Never delete source: symbol
                // numbering must remain identical to the persistent interpreter.
                val retireBeforeNode = linkedMapOf<Int, MutableList<String>>()
                retiredProperties.entries.sortedBy { it.key }.forEach { (offset, names) ->
                    val index = script.nodes.indexOfFirst { node ->
                        node.position.index >= offset && !(node is ClassDeclarationNode && node.name in moved)
                    }.let { if (it < 0) script.nodes.size else it }
                    retireBeforeNode.getOrPut(index) { mutableListOf() }.addAll(names)
                }
                SemanticAnalyzer(script, environment, retireBeforeNode).analyze()
                return script
            } catch (error: Throwable) {
                val message = error.message.orEmpty()
                val name = missingClassPatterns.firstNotNullOfOrNull { it.find(message)?.groupValues?.get(1) }
                val declarations = nodes.filterIsInstance<ClassDeclarationNode>()
                val declaration = declarations.firstOrNull { it.name == name } ?: throw error
                val dependent = dependentNode(nodes, message, declaration.name)
                // Moving must place the class earlier; otherwise the error is genuine.
                val dependentAt = dependent?.let { nodes.indexOf(it) } ?: 0
                if (dependent === declaration || nodes.indexOf(declaration) < dependentAt || moves.size > declarations.size * 2) throw error
                moves += declaration.name to dependent?.position?.index
            }
        }
    }

    /** The top-level node whose analysis failed because `missing` was not yet declared. */
    private fun dependentNode(nodes: List<ASTNode>, message: String, missing: String): ASTNode? {
        errorPosition.find(message)?.let { match ->
            val line = match.groupValues[1].toInt()
            val col = match.groupValues[2].toInt()
            // Top-level nodes do not nest: the enclosing one starts last before the error.
            return nodes.filter { it.position.lineNum < line || (it.position.lineNum == line && it.position.col <= col) }
                .maxWithOrNull(compareBy<ASTNode>({ it.position.lineNum }, { it.position.col }))
        }
        return nodes.firstOrNull { node ->
            node is ClassDeclarationNode && node.superInvocations.orEmpty().any { superName(it) == missing }
        }
    }

    private fun superName(node: ASTNode): String? = when (node) {
        is FunctionCallNode -> superName(node.function)
        is TypeNode -> node.name
        is VariableReferenceNode -> node.variableName
        else -> null
    }
}
