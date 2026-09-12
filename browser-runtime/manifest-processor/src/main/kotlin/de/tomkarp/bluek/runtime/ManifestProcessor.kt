package de.tomkarp.bluek.runtime

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
import com.google.devtools.ksp.symbol.KSType
import com.google.devtools.ksp.symbol.KSTypeArgument
import com.google.devtools.ksp.symbol.Modifier

class ManifestProcessorProvider : SymbolProcessorProvider {
    override fun create(environment: SymbolProcessorEnvironment): SymbolProcessor =
        ManifestProcessor(environment.codeGenerator, environment.logger)
}

private class ManifestProcessor(
    private val codeGenerator: CodeGenerator,
    private val logger: KSPLogger,
) : SymbolProcessor {
    private var generated = false

    override fun process(resolver: Resolver): List<KSAnnotated> {
        if (generated) return emptyList()
        generated = true

        val classes = resolver.getAllFiles()
            .flatMap { file -> file.declarations.filterIsInstance<KSClassDeclaration>().flatMap(::nestedClasses) }
            .filter { it.packageName.asString() != "kotlin" }
            .filter { it.qualifiedName?.asString()?.startsWith("de.tomkarp.bluek.runtime") != true }
            .sortedBy { it.qualifiedName?.asString() }
        val functionOwners = resolver.getAllFiles()
            .mapNotNull { file ->
                val functions = file.declarations.filterIsInstance<KSFunctionDeclaration>().filter { it.isPublic() }.toList()
                val owner = file.fileName.removeSuffix(".kt")
                if (functions.isEmpty() || owner.startsWith("BlueKApi") || owner.startsWith("BlueKInput")) null else owner to functions
            }
            .sortedBy { it.first }

        val manifest = buildString {
            append("{\"version\":1,\"classes\":[")
            var index = 0
            classes.forEach { declaration ->
                if (index > 0) append(',')
                appendClass(declaration)
                index++
            }
            functionOwners.forEach { (owner, functions) ->
                if (index > 0) append(',')
                appendFunctionOwner(owner, functions)
                index++
            }
            append("]}")
        }

        codeGenerator.createNewFile(
            Dependencies(aggregating = true),
            "de.tomkarp.bluek.generated",
            "bluek-symbol-manifest",
            "json",
        ).bufferedWriter().use { it.write(manifest) }
        logger.info("BlueK generated a Kotlin symbol manifest")
        return emptyList()
    }

    private fun StringBuilder.appendClass(declaration: KSClassDeclaration) {
        val kind = when {
            Modifier.ABSTRACT in declaration.modifiers -> "abstract"
            declaration.classKind.name.lowercase() == "interface" -> "interface"
            declaration.classKind.name.lowercase() == "enum_class" -> "enum"
            declaration.classKind.name.lowercase() == "object" -> "object"
            declaration.classKind.name.lowercase() == "annotation_class" -> "annotation"
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
        declaration.superTypes.forEachIndexed { index, supertype ->
            if (index > 0) append(',')
            appendType(supertype)
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

    private fun StringBuilder.appendFunctionOwner(owner: String, functions: List<KSFunctionDeclaration>) {
        append("{\"name\":")
        appendJson(owner)
        append(",\"qualifiedName\":")
        appendJson(owner)
        append(",\"kind\":\"functions\",\"modifiers\":[],\"supertypes\":[],\"properties\":[],\"methods\":[")
        functions.sortedWith(compareBy({ it.simpleName.asString() }, { it.parameters.size })).forEachIndexed { index, function ->
            if (index > 0) append(',')
            appendFunction(function, owner)
        }
        append("],\"constructors\":[]}")
    }

    private fun StringBuilder.appendProperty(property: KSPropertyDeclaration) {
        append("{\"name\":")
        appendJson(property.simpleName.asString())
        append(",\"mutable\":")
        append(property.isMutable)
        append(",\"type\":")
        appendType(property.type)
        append(",\"getter\":")
        append(property.getter != null)
        append(",\"setter\":")
        append(property.setter != null)
        append(",\"declaringType\":")
        appendJson(property.parentDeclaration?.qualifiedName?.asString() ?: "")
        append('}')
    }

    private fun StringBuilder.appendFunction(function: KSFunctionDeclaration, owner: String? = null) {
        append("{\"name\":")
        appendJson(function.simpleName.asString())
        append(",\"typeParameters\":[")
        function.typeParameters.forEachIndexed { index, parameter ->
            if (index > 0) append(',')
            appendJson(parameter.name.asString())
        }
        append(']')
        append(",\"parameters\":[")
        function.parameters.forEachIndexed { index, parameter ->
            if (index > 0) append(',')
            appendParameter(parameter)
        }
        append("],\"returnType\":")
        appendType(function.returnType)
        append(",\"declaringType\":")
        appendJson(owner ?: function.parentDeclaration?.qualifiedName?.asString() ?: "")
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
        append(",\"hasDefault\":")
        append(parameter.hasDefault)
        append(",\"type\":")
        appendType(parameter.type)
        append('}')
    }

    private fun StringBuilder.appendType(reference: com.google.devtools.ksp.symbol.KSTypeReference?) {
        if (reference == null) {
            appendTypeValue("kotlin.Unit", false, emptyList(), null)
            return
        }
        val type = reference.resolve()
        appendTypeValue(
            type.declaration.qualifiedName?.asString() ?: type.declaration.simpleName.asString(),
            type.nullability.name == "NULLABLE",
            type.arguments,
            type,
        )
    }

    private fun StringBuilder.appendTypeValue(classifier: String, nullable: Boolean, arguments: List<KSTypeArgument>, type: KSType?, projection: String? = null) {
        append("{\"classifier\":")
        appendJson(classifier)
        append(",\"arguments\":[")
        arguments.forEachIndexed { index, argument ->
            if (index > 0) append(',')
            appendTypeArgument(argument)
        }
        append("],\"nullable\":")
        append(nullable)
        append(",\"displayName\":")
        appendJson(type?.let(::displayName) ?: classifier + if (nullable) "?" else "")
        if (projection != null) {
            append(",\"projection\":")
            appendJson(projection)
        }
        append('}')
    }

    private fun StringBuilder.appendTypeArgument(argument: KSTypeArgument) {
        val variance = argument.variance.name
        if (variance == "STAR") {
            append("{\"classifier\":\"*\",\"arguments\":[],\"nullable\":false,\"displayName\":\"*\",\"projection\":\"star\"}")
            return
        }
        val type = argument.type?.resolve()
        if (type == null) {
            appendTypeValue("kotlin.Any", true, emptyList(), null)
            return
        }
        val projection = when (variance) {
            "COVARIANT" -> "out"
            "CONTRAVARIANT" -> "in"
            else -> null
        }
        appendTypeValue(
            type.declaration.qualifiedName?.asString() ?: type.declaration.simpleName.asString(),
            type.nullability.name == "NULLABLE",
            type.arguments,
            type,
            projection,
        )
    }

    private fun displayName(type: KSType): String {
        val classifier = type.declaration.qualifiedName?.asString() ?: type.declaration.simpleName.asString()
        val arguments = type.arguments.joinToString(", ") { argument ->
            when (argument.variance.name) {
                "STAR" -> "*"
                "COVARIANT" -> "out ${argument.type?.resolve()?.let(::displayName) ?: "kotlin.Any?"}"
                "CONTRAVARIANT" -> "in ${argument.type?.resolve()?.let(::displayName) ?: "kotlin.Any?"}"
                else -> argument.type?.resolve()?.let(::displayName) ?: "kotlin.Any?"
            }
        }
        return classifier + (if (arguments.isEmpty()) "" else "<$arguments>") + (if (type.nullability.name == "NULLABLE") "?" else "")
    }

    private fun KSDeclaration.isPublic(): Boolean =
        Modifier.PRIVATE !in modifiers && Modifier.PROTECTED !in modifiers && Modifier.INTERNAL !in modifiers

    private fun nestedClasses(declaration: KSClassDeclaration): Sequence<KSClassDeclaration> =
        sequenceOf(declaration) + declaration.declarations
            .filterIsInstance<KSClassDeclaration>()
            .flatMap(::nestedClasses)

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
