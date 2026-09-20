package com.sunnychung.lib.multiplatform.kotlite.model

/** Passive identity traversal for REPL hosts. Never runs getters, equals or iterators from student code. */
fun reachableRuntimeValues(roots: List<RuntimeValue>): List<RuntimeValue> {
    val visited = mutableListOf<RuntimeValue>()
    val pending = roots.toMutableList()
    while (pending.isNotEmpty()) {
        val value = pending.removeAt(pending.lastIndex)
        if (visited.any { it === value }) continue
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
    }
    return visited
}
