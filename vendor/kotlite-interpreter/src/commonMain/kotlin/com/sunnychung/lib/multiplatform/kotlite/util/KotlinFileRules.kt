package com.sunnychung.lib.multiplatform.kotlite.util

import com.sunnychung.lib.multiplatform.kotlite.model.*

/** Ordinary .kt files differ from the REPL's synthetic, externally populated bindings. */
object KotlinFileRules {
    fun initializationError(script: ScriptNode): Pair<SourcePosition, String>? =
        script.nodes.filterIsInstance<PropertyDeclarationNode>().firstOrNull {
            it.initialValue == null && it.accessors?.getter == null && PropertyModifier.lateinit !in it.modifiers
        }?.let { it.position to "Property `${it.name}` must be initialized." }
}
