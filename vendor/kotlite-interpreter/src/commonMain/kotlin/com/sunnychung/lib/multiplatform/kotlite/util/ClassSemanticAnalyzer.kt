package com.sunnychung.lib.multiplatform.kotlite.util

import com.sunnychung.lib.multiplatform.kotlite.error.SemanticException
import com.sunnychung.lib.multiplatform.kotlite.model.*
import com.sunnychung.lib.multiplatform.kotlite.extension.resolveGenericParameterTypeToUpperBound

/** Validate effective inherited declarations after every member has been analyzed. */
class ClassSemanticAnalyzer(val symbolTable: SemanticAnalyzerSymbolTable, val position: SourcePosition, val classDefinition: ClassDefinition) {
    fun check() {
        data class Member(val owner: ClassDefinition, val function: FunctionDeclarationNode, val signature: String)
        val resolver = ClassMemberResolver.create(symbolTable, classDefinition, null)!!
        val members = mutableListOf<Member>()
        val seen = mutableSetOf<String>()
        fun visit(clazz: ClassDefinition) {
            if (!seen.add(clazz.fullQualifiedName)) return
            clazz.getMemberFunctionsDeclaredInThisClass().values.forEach { function ->
                if (clazz === classDefinition || FunctionModifier.private !in function.modifiers) {
                    val resolved = resolver.resolveTypes(function, clazz.fullQualifiedName)
                    val parameters = resolved.resolvedValueParameterTypes.joinToString(",") {
                        it.type.resolveGenericParameterTypeToUpperBound(function.typeParameters).descriptiveName()
                    }
                    members += Member(clazz, function, "${function.receiver?.descriptiveName() ?: ""}/${function.name}($parameters)")
                }
            }
            (listOfNotNull(clazz.superClass) + clazz.superInterfaces).forEach { visit(it) }
        }
        visit(classDefinition)
        var hasAbstract = false
        for (group in members.groupBy { it.signature }.values) {
            val effective = group.filter { a -> group.none { b -> a.owner !== b.owner && b.owner.inheritsFrom(a.owner) } }
            val classMember = effective.firstOrNull { !it.owner.isInterface }
            fun Member.isAbstract() = FunctionModifier.abstract in function.modifiers || function.body == null
            if (classMember != null && !classMember.isAbstract() && effective.filter { it.owner.isInterface }.all { it.isAbstract() }) continue
            if (classMember?.isAbstract() == true) { hasAbstract = true; continue }
            if (effective.size > 1 && effective.any { !it.isAbstract() }) {
                val function = effective.first().function.name
                val kind = if (classMember == null) "interface methods" else "implementations"
                throw SemanticException(position, "Class '${classDefinition.fullQualifiedName}' must override '$function' because it inherits multiple $kind for it.")
            }
            if (effective.any { it.isAbstract() }) hasAbstract = true
        }
        if (hasAbstract && ClassModifier.abstract !in classDefinition.modifiers) {
            throw SemanticException(position, "Class ${classDefinition.fullQualifiedName} must be marked as abstract, because it contains an abstract member")
        }
    }
}
