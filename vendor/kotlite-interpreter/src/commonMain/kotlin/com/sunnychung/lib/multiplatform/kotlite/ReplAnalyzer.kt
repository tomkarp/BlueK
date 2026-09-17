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
    fun analyze(filename: String, source: String, environment: ExecutionEnvironment, retiredProperties: Map<Int, List<String>> = emptyMap()): ScriptNode {
        val moved = mutableListOf<String>()
        while (true) {
            var script = Parser(Lexer(filename, source)).script()
            moved.forEach { name ->
                val declaration = script.nodes.filterIsInstance<ClassDeclarationNode>().first { it.name == name }
                script = ScriptNode(script.position, listOf(declaration) + script.nodes.filterNot { it === declaration })
            }
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
                val name = listOf(
                    Regex("No matching function `([^`]+)`"),
                    Regex("Unknown type `?([A-Za-z_][A-Za-z0-9_]*)"),
                    Regex("Super class `([^`]+)` not found")
                ).firstNotNullOfOrNull { it.find(message)?.groupValues?.get(1) }
                if (name == null || name in moved ||
                    script.nodes.filterIsInstance<ClassDeclarationNode>().none { it.name == name }) throw error
                moved += name
            }
        }
    }
}
