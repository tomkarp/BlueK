package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.extension.IdentitySet

/** Values found by [reachableRuntimeValues]; membership means identity, never `equals`. */
class ReachableRuntimeValues internal constructor(val values: List<RuntimeValue>, private val identities: IdentitySet<RuntimeValue>) {
    operator fun contains(value: RuntimeValue): Boolean = value in identities
}

/**
 * Passive identity traversal for REPL hosts. Never runs getters, equals or iterators from student code.
 * [hostRetained] names values that a host keeps alive for a value outside its fields (e.g. a game engine's
 * actors of a world), like [DelegatedValue.retainedRuntimeValues] for host wrappers.
 */
fun reachableRuntimeValues(
    roots: List<RuntimeValue>,
    hostRetained: (RuntimeValue) -> Collection<RuntimeValue> = { emptyList() },
): ReachableRuntimeValues {
    val identities = IdentitySet<RuntimeValue>()
    val visited = mutableListOf<RuntimeValue>()
    val pending = roots.toMutableList()
    while (pending.isNotEmpty()) {
        val value = pending.removeAt(pending.lastIndex)
        if (!identities.add(value)) continue
        visited += value
        fun backing(accessor: RuntimeValueAccessor) {
            runCatching { accessor.read() }.getOrNull()?.let { pending += it }
        }
        if (value is ClassInstance) value.getAllMemberProperties().values.forEach(::backing)
        if (value is LambdaValue) value.symbolRefs.propertyValues.values.forEach(::backing)
        if (value is DelegatedValue<*>) {
            pending.addAll(value.retainedRuntimeValues)
            fun item(item: Any?) { if (item is RuntimeValue) pending += item }
            when (val contents = value.value) {
                is Collection<*> -> contents.forEach(::item)
                is Map<*, *> -> contents.forEach { (key, entry) -> item(key); item(entry) }
                is Pair<*, *> -> { item(contents.first); item(contents.second) }
                is Array<*> -> contents.forEach(::item)
            }
        }
        pending.addAll(hostRetained(value))
    }
    return ReachableRuntimeValues(visited, identities)
}
