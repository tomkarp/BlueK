package de.tomkarp.bluek.spike

import com.google.devtools.ksp.processing.CodeGenerator
import com.google.devtools.ksp.processing.Dependencies
import com.google.devtools.ksp.processing.KSPLogger
import com.google.devtools.ksp.processing.Resolver
import com.google.devtools.ksp.processing.SymbolProcessor
import com.google.devtools.ksp.processing.SymbolProcessorEnvironment
import com.google.devtools.ksp.processing.SymbolProcessorProvider
import com.google.devtools.ksp.symbol.KSAnnotated
import com.google.devtools.ksp.symbol.KSClassDeclaration
import com.google.devtools.ksp.symbol.KSDeclaration
import com.google.devtools.ksp.symbol.KSFunctionDeclaration
import com.google.devtools.ksp.symbol.KSPropertyDeclaration
import com.google.devtools.ksp.symbol.KSValueParameter
import com.google.devtools.ksp.symbol.Modifier

class BlueKSymbolProcessorProvider : SymbolProcessorProvider {
    override fun create(environment: SymbolProcessorEnvironment): SymbolProcessor =
        BlueKSymbolProcessor(environment.codeGenerator, environment.logger)
}

private class BlueKSymbolProcessor(
    private val codeGenerator: CodeGenerator,
    private val logger: KSPLogger,
) : SymbolProcessor {
    private var generated = false

    override fun process(resolver: Resolver): List<KSAnnotated> {
        if (generated) return emptyList()
        generated = true

        val classes = resolver.getAllFiles()
            .flatMap { file -> file.declarations }
            .filterIsInstance<KSClassDeclaration>()
            .filter { declaration -> declaration.packageName.asString() != "kotlin" }
            .sortedBy { it.qualifiedName?.asString() }

        val manifest = buildString {
            append("{\"version\":1,\"classes\":[")
            classes.forEachIndexed { index, declaration ->
                if (index > 0) append(',')
                appendClass(declaration)
            }
            append("]}")
        }

        codeGenerator.createNewFile(
            dependencies = Dependencies(aggregating = true),
            packageName = "de.tomkarp.bluek.generated",
            fileName = "bluek-symbol-manifest",
            extensionName = "json",
        ).bufferedWriter().use { it.write(manifest) }

        logger.info("BlueK generated a manifest")
        return emptyList()
    }

    private fun StringBuilder.appendClass(declaration: KSClassDeclaration) {
        val kind = when (declaration.classKind.name.lowercase()) {
            "interface" -> "interface"
            "enum_class" -> "enum"
            "object" -> "object"
            "annotation_class" -> "annotation"
            else -> "class"
        }
        append("{\"name\":")
        appendJson(declaration.simpleName.asString())
        append(",\"qualifiedName\":")
        appendJson(declaration.qualifiedName?.asString() ?: declaration.simpleName.asString())
        append(",\"kind\":")
        appendJson(kind)
        append(",\"modifiers\":[")
        declaration.modifiers.sortedBy { it.name }.forEachIndexed { index, modifier ->
            if (index > 0) append(',')
            appendJson(modifier.name.lowercase())
        }
        append("],\"supertypes\":[")
        declaration.superTypes.forEachIndexed { index, typeReference ->
            if (index > 0) append(',')
            appendJson(typeReference.resolve().declaration.qualifiedName?.asString() ?: typeReference.toString())
        }
        append("],\"properties\":[")
        declaration.getAllProperties()
            .filter { it.isPublic() }
            .sortedBy { it.simpleName.asString() }
            .forEachIndexed { index, property ->
                if (index > 0) append(',')
                appendProperty(property)
            }
        append("],\"methods\":[")
        declaration.getAllFunctions()
            .filter { it.isPublic() && it.simpleName.asString() != "<init>" }
            .sortedWith(compareBy({ it.simpleName.asString() }, { it.parameters.size }))
            .forEachIndexed { index, function ->
                if (index > 0) append(',')
                appendFunction(function)
            }
        append("],\"constructors\":[")
        declaration.primaryConstructor?.let {
            append("{\"parameters\":[")
            appendParameters(it.parameters)
            append("]}")
        }
        append("]}")
    }

    private fun StringBuilder.appendProperty(property: KSPropertyDeclaration) {
        append("{\"name\":")
        appendJson(property.simpleName.asString())
        append(",\"mutable\":")
        append(property.isMutable)
        append(",\"type\":")
        appendJson(property.type.resolve().declaration.qualifiedName?.asString() ?: property.type.toString())
        append(",\"getter\":")
        append(property.getter != null)
        append(",\"setter\":")
        append(property.setter != null)
        append(",\"declaringType\":")
        appendJson(property.parentDeclaration?.qualifiedName?.asString() ?: "")
        append('}')
    }

    private fun StringBuilder.appendFunction(function: KSFunctionDeclaration) {
        append("{\"name\":")
        appendJson(function.simpleName.asString())
        append(",\"parameters\":[")
        function.parameters.forEachIndexed { index, parameter ->
            if (index > 0) append(',')
            appendParameter(parameter)
        }
        append("],\"returnType\":")
        appendJson(function.returnType?.resolve()?.declaration?.qualifiedName?.asString() ?: "kotlin.Unit")
        append(",\"declaringType\":")
        appendJson(function.parentDeclaration?.qualifiedName?.asString() ?: "")
        append(",\"generated\":")
        append(function.origin.name != "KOTLIN")
        append('}')
    }

    private fun StringBuilder.appendParameters(parameters: List<KSValueParameter>) {
        parameters.forEachIndexed { index, parameter ->
            if (index > 0) append(',')
            appendParameter(parameter)
        }
    }

    private fun StringBuilder.appendParameter(parameter: KSValueParameter) {
        append("{\"name\":")
        appendJson(parameter.name?.asString() ?: "parameter")
        append(",\"type\":")
        appendJson(parameter.type.resolve().declaration.qualifiedName?.asString() ?: parameter.type.toString())
        append('}')
    }

    private fun KSDeclaration.isPublic(): Boolean =
        Modifier.PRIVATE !in modifiers && Modifier.PROTECTED !in modifiers && Modifier.INTERNAL !in modifiers

    private fun StringBuilder.appendJson(value: String) {
        append('"')
        value.forEach { char ->
            when (char) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> append(char)
            }
        }
        append('"')
    }
}
