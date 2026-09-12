import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.KotliteInterpreter
import com.sunnychung.lib.multiplatform.kotlite.Parser
import com.sunnychung.lib.multiplatform.kotlite.SemanticAnalyzer
import com.sunnychung.lib.multiplatform.kotlite.extension.fullClassName
import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer
import com.sunnychung.lib.multiplatform.kotlite.model.ClassDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionCallNode
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.ExecutionEnvironment
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.IntValue
import com.sunnychung.lib.multiplatform.kotlite.model.NullValue
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.ScriptNode
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.StringValue
import com.sunnychung.lib.multiplatform.kotlite.model.UnitValue
import com.sunnychung.lib.multiplatform.kotlite.model.TypeNode
import com.sunnychung.lib.multiplatform.kotlite.model.VariableReferenceNode
import com.sunnychung.lib.multiplatform.kotlite.model.NavigationNode
import com.sunnychung.lib.multiplatform.kotlite.stdlib.AllStdLibModules
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport

/**
 * One browser-worker session. Kotlite has no public REPL, so BlueK keeps one
 * Interpreter alive and analyzes each new snippet against its current symbol
 * table. Only declarations are evaluated during project loading; top-level
 * initializers run only when the user actually submits them.
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
class KotliteSession {
    private val output = StringBuilder()
    private var environment = ExecutionEnvironment()
    private lateinit var interpreter: Interpreter
    private val handles = linkedMapOf<String, RuntimeValue>()
    private val bindingNames = linkedMapOf<String, String>()
    private val propertyNames = linkedMapOf<String, MutableList<String>>()
    private val computedPropertyNames = linkedMapOf<String, MutableSet<String>>()
    private var nextHandle = 1
    private var analysisSource = ""
    private var analyzedScript: ScriptNode? = null
    private var stageSnapshot = ""
    private val pendingSounds = mutableListOf<String>()
    private val keysDown = linkedSetOf<String>()
    private var clickX: Int? = null
    private var clickY: Int? = null

    init {
        resetInterpreter()
    }

    private fun resetInterpreter() {
        environment = ExecutionEnvironment()
        AllStdLibModules { text -> output.append(text) }.modules.forEach(environment::install)
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekStageUpdate",
            returnType = "Unit",
            parameterTypes = listOf(CustomFunctionParameter("snapshot", "String")),
            executable = { _, _, args, _ ->
                stageSnapshot = (args[0] as StringValue).value
                UnitValue
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekPlaySound",
            returnType = "Unit",
            parameterTypes = listOf(CustomFunctionParameter("fileName", "String")),
            executable = { _, _, args, _ ->
                pendingSounds += (args[0] as StringValue).value
                UnitValue
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekIsActorClicked",
            returnType = "Boolean",
            parameterTypes = listOf(CustomFunctionParameter("x", "Int"), CustomFunctionParameter("y", "Int")),
            executable = { interpreter, _, args, _ ->
                val matches = clickX == (args[0] as IntValue).value && clickY == (args[1] as IntValue).value
                if (matches) { clickX = null; clickY = null }
                BooleanValue(matches, interpreter.symbolTable())
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekIsWorldClicked",
            returnType = "Boolean",
            parameterTypes = emptyList(),
            executable = { interpreter, _, _, _ ->
                val matches = clickX != null && clickY != null
                if (matches) { clickX = null; clickY = null }
                BooleanValue(matches, interpreter.symbolTable())
            }
        ))
        environment.registerFunction(CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = null,
            functionName = "bluekIsKeyDown",
            returnType = "Boolean",
            parameterTypes = listOf(CustomFunctionParameter("key", "String")),
            executable = { interpreter, _, args, _ ->
                BooleanValue(keysDown.contains((args[0] as StringValue).value.lowercase()), interpreter.symbolTable())
            }
        ))
        interpreter = KotliteInterpreter("<BlueK>", "", environment)
    }

    private fun parse(filename: String, source: String): ScriptNode =
        Parser(Lexer(filename = filename, code = source)).script()

    private fun unsupportedInput(source: String): String? {
        val call = Regex("\\b(readlnOrNull|readln|readLine)\\s*\\(").find(source) ?: return null
        return "${call.groupValues[1]} is not supported in BlueK's local browser runtime."
    }

    fun load(filename: String, source: String): String = try {
        unsupportedInput(source)?.let { return errorMessage(it) }
        val previous = parse("<BlueK project>", analysisSource)
        val combined = parse("<BlueK project>", analysisSource + "\n" + source)
        SemanticAnalyzer(combined, environment).analyze()
        analyzedScript = combined
        // Definitions are installed once. Evaluating the complete project here
        // would repeat top-level constructors and other side effects.
        interpreter.run {
            combined.nodes.drop(previous.nodes.size)
                .filter { it is ClassDeclarationNode || it is FunctionDeclarationNode || (it is PropertyDeclarationNode && it.initialValue == null) }
                .forEach { it.eval() }
        }
        analysisSource += "\n" + source
        recordPropertyNames()
        result("loaded", UnitValue)
    } catch (error: Throwable) {
        error(error)
    }

    /** Metadata for the GUI, derived from the same AST Kotlite analyzes. */
    fun manifest(): String = try {
        val script = analyzedScript ?: parse("<BlueK project>", analysisSource)
        val classes = script.nodes.filterIsInstance<ClassDeclarationNode>()
        val functions = script.nodes.filterIsInstance<FunctionDeclarationNode>()
        val classJson = classes.joinToString(",", "[", "]") { declaration ->
            val constructors = if (declaration.isInterface) "[]" else {
                val parameters = declaration.primaryConstructor?.parameters.orEmpty().joinToString(",", "[", "]") { parameterJson(it.parameter) }
                "[{\"id\":\"${escape(declaration.name)}.constructor\",\"parameters\":$parameters}]"
            }
            val primaryProperties = declaration.primaryConstructor?.parameters.orEmpty().filter { it.isProperty }.map { parameter ->
                jsonProperty(declaration.name, parameter.parameter.name, parameter.parameter.type, parameter.isMutable, parameter.modifiers.any { it.name == "private" }, false, false)
            }
            val bodyProperties = declaration.declarations.filterIsInstance<PropertyDeclarationNode>().map { property ->
                jsonProperty(declaration.name, property.name, property.type, property.isMutable, property.modifiers.any { it.name == "private" }, property.accessors?.getter != null, property.accessors?.setter != null)
            }
            val properties = (primaryProperties + bodyProperties).distinctBy { it.substringBefore("\",\"name\":") }.joinToString(",", "[", "]")
            val methods = declaration.declarations.filterIsInstance<FunctionDeclarationNode>().mapIndexed { index, function -> jsonFunction(declaration.name, function, index) }.joinToString(",", "[", "]")
            val supers = declaration.superInvocations.orEmpty().mapNotNull(::superName).joinToString(",", "[", "]") { jsonTypeName(it) }
            val kind = if (declaration.isInterface) "interface" else if (declaration.modifiers.any { it.name == "abstract" }) "abstract" else "class"
            val typeParameters = declaration.typeParameters.joinToString(",", "[", "]") { parameter -> "\"${escape(parameter.name)}\"" }
            "{\"id\":\"${escape(declaration.name)}\",\"name\":\"${escape(declaration.name)}\",\"kind\":\"$kind\",\"modifiers\":${declaration.modifiers.joinToString(",", "[", "]") { modifier -> "\"${modifier.name}\"" }},\"typeParameters\":$typeParameters,\"supertypes\":$supers,\"constructors\":$constructors,\"properties\":$properties,\"methods\":$methods}"
        }
        val functionJson = functions.mapIndexed { index, function -> jsonFunction("<top-level>", function, index) }.joinToString(",", "[", "]")
        "{\"version\":1,\"classes\":$classJson,\"functions\":$functionJson}"
    } catch (error: Throwable) {
        "{\"version\":1,\"classes\":[],\"error\":\"${escape(error.message ?: "Could not create Kotlite manifest.")}\"}"
    }

    private fun parameterJson(parameter: com.sunnychung.lib.multiplatform.kotlite.model.FunctionValueParameterNode): String =
        "{\"name\":\"${escape(parameter.name)}\",\"type\":${jsonType(parameter.type)},\"hasDefault\":${parameter.defaultValue != null}}"

    private fun jsonProperty(owner: String, name: String, type: TypeNode, mutable: Boolean, private: Boolean, getter: Boolean, setter: Boolean): String =
        "{\"id\":\"${escape(owner)}.${escape(name)}\",\"name\":\"${escape(name)}\",\"type\":${jsonType(type)},\"mutable\":$mutable,\"visibility\":\"${if (private) "private" else "public"}\",\"getter\":$getter,\"setter\":$setter}"

    private fun visibility(modifiers: Set<*>): String = when {
        modifiers.any { it.toString() == "private" } -> "private"
        modifiers.any { it.toString() == "protected" } -> "protected"
        else -> "public"
    }

    private fun jsonFunction(owner: String, function: FunctionDeclarationNode, index: Int): String =
        "{\"id\":\"${escape(owner)}.${escape(function.name)}.$index\",\"name\":\"${escape(function.name)}\",\"declaringType\":\"${escape(owner)}\",\"parameters\":${function.valueParameters.joinToString(",", "[", "]", transform = ::parameterJson)},\"returnType\":${jsonType(function.returnType)},\"visibility\":\"${visibility(function.modifiers)}\"}"
    private fun jsonType(type: TypeNode): String =
        "{\"classifier\":\"${escape(type.name)}\",\"arguments\":${type.arguments.orEmpty().joinToString(",", "[", "]", transform = ::jsonType)},\"nullable\":${type.isNullable},\"displayName\":\"${escape(type.descriptiveName())}\"}"

    private fun jsonTypeName(name: String): String = jsonType(TypeNode(SourcePosition.NONE, name, null, false))

    private fun superName(node: com.sunnychung.lib.multiplatform.kotlite.model.ASTNode): String? = when (node) {
        is FunctionCallNode -> superName(node.function)
        is TypeNode -> node.name
        is VariableReferenceNode -> node.variableName
        is NavigationNode -> node.member.name
        else -> null
    }

    fun evaluate(filename: String, source: String): String = try {
        unsupportedInput(source)?.let { return errorMessage(it) }
        val previous = parse("<BlueK project>", analysisSource)
        val combined = parse("<BlueK project>", analysisSource + "\n" + source)
        SemanticAnalyzer(combined, environment).analyze()
        analyzedScript = combined
        val value = interpreter.run {
            combined.nodes.drop(previous.nodes.size).fold(UnitValue as RuntimeValue) { _, node ->
                (node.eval() as? RuntimeValue) ?: UnitValue
            }
        }
        analysisSource += "\n" + source
        recordPropertyNames()
        result("value", value)
    } catch (error: Throwable) {
        error(error)
    }

    private fun recordPropertyNames() {
        val declarations = analyzedScript?.nodes?.filterIsInstance<ClassDeclarationNode>().orEmpty()
        val byName = declarations.associateBy { it.name }
        fun record(declaration: ClassDeclarationNode, visiting: MutableSet<String>) {
            if (!visiting.add(declaration.name)) return
            declaration.superInvocations.orEmpty().mapNotNull(::superName).mapNotNull(byName::get).forEach { record(it, visiting) }
            val names = propertyNames.getOrPut(declaration.name) { mutableListOf() }
            declaration.primaryConstructor?.parameters.orEmpty().filter { it.isProperty }.forEach { parameter ->
                if (parameter.parameter.name !in names) names += parameter.parameter.name
            }
            declaration.declarations.filterIsInstance<PropertyDeclarationNode>().forEach { property ->
                if (property.name !in names) names += property.name
                // A custom setter does not make a property computed: its
                // default getter still reads the backing field. Only an
                // explicitly declared getter must stay unevaluated during
                // inspection.
                if (property.accessors?.getter != null) computedPropertyNames.getOrPut(declaration.name) { linkedSetOf() } += property.name
            }
            declaration.superInvocations.orEmpty().mapNotNull(::superName).mapNotNull(byName::get).forEach { parent ->
                propertyNames[parent.name].orEmpty().forEach { inherited ->
                    if (inherited !in names) names += inherited
                }
                computedPropertyNames[parent.name].orEmpty().forEach { computed ->
                    computedPropertyNames.getOrPut(declaration.name) { linkedSetOf() } += computed
                }
            }
            visiting.remove(declaration.name)
        }
        declarations.forEach { record(it, linkedSetOf()) }
    }

    fun create(className: String, argumentsSource: String, requestedName: String): String {
        val handleName = "__bluek_handle_${nextHandle++}"
        val expression = "val $handleName = $className($argumentsSource)"
        val evaluated = evaluate("<BlueK constructor>", expression)
        if (evaluated.startsWith("{\"kind\":\"error\"")) return evaluated
        val value = interpreter.symbolTable().findPropertyByDeclaredName(handleName)
            ?: return errorMessage("Constructor did not create an object.")
        val id = "object-${nextHandle++}"
        handles[id] = value
        bindingNames[id] = handleName
        if (requestedName.matches(Regex("[A-Za-z_]\\w*"))) {
            val alias = "val $requestedName = $handleName"
            val aliasResult = evaluate("<BlueK object binding>", alias)
            if (aliasResult.startsWith("{\"kind\":\"error\"")) return aliasResult
        }
        return result("object", value, id, requestedName)
    }

    fun invoke(objectId: String, methodName: String, argumentsSource: String): String {
        val value = handles[objectId] ?: return errorMessage("Object handle is no longer available.")
        val binding = bindingNames[objectId]
            ?: return errorMessage("Object handle is no longer available.")
        return evaluate("<BlueK method call>", "$binding.$methodName($argumentsSource)")
    }

    fun inspect(objectId: String): String {
        val value = handles[objectId] ?: return errorMessage("Object handle is no longer available.")
        if (value !is ClassInstance) return result("value", value)
        // Kotlite deliberately keeps its complete member map internal, so the
        // names are collected from the source declarations while loading the
        // project. Computed properties are reported without reading them: a
        // getter may contain arbitrary student code and must not run during
        // inspection.
        val fields = propertyNames[value.type().name].orEmpty().joinToString(",", "[", "]") { name ->
            if (name in computedPropertyNames[value.type().name].orEmpty()) {
                "{\"name\":\"${escape(name)}\",\"value\":\"<computed>\"}"
            } else {
                val member = value.readBackingPropertyByDeclaredName(name)
                val display = member?.convertToString() ?: "<uninitialized>"
                "{\"name\":\"${escape(name)}\",\"value\":\"${escape(display)}\"}"
            }
        }
        return "{\"kind\":\"inspect\",\"objectId\":\"${escape(objectId)}\",\"className\":\"${escape(value.type().name)}\",\"fields\":$fields}"
    }

    fun remove(objectId: String): String {
        handles.remove(objectId)
        bindingNames.remove(objectId)
        return result("value", UnitValue)
    }

    fun reset(): String {
        handles.clear()
        bindingNames.clear()
        analysisSource = ""
        analyzedScript = null
        propertyNames.clear()
        computedPropertyNames.clear()
        nextHandle = 1
        stageSnapshot = ""
        pendingSounds.clear()
        keysDown.clear()
        clickX = null
        clickY = null
        resetInterpreter()
        output.clear()
        return result("reset", UnitValue)
    }

    fun takeOutput(): String {
        val text = output.toString()
        output.clear()
        return text
    }

    fun takeStage(): String {
        val snapshot = if (stageSnapshot.isNotEmpty() && pendingSounds.isNotEmpty()) {
            val sounds = pendingSounds.joinToString(",", "[", "]") { "\"${escape(it)}\"" }
            stageSnapshot.removeSuffix("}}") + ",\"sounds\":$sounds}}"
        } else stageSnapshot
        stageSnapshot = ""
        pendingSounds.clear()
        return snapshot
    }

    fun setKey(key: String, pressed: Boolean): String {
        if (pressed) keysDown += key.lowercase() else keysDown -= key.lowercase()
        return result("value", UnitValue)
    }

    fun setClick(x: Int, y: Int): String {
        clickX = x
        clickY = y
        return result("value", UnitValue)
    }

    private fun result(kind: String, value: RuntimeValue, objectId: String? = null, name: String? = null): String {
        val display = if (value === UnitValue) "Unit" else if (value === NullValue) "null" else value.convertToString()
        val actualKind = if (value === UnitValue) "unit" else if (value === NullValue) "null" else if (value is ClassInstance) "object" else "scalar"
        return "{\"kind\":\"$actualKind\",\"display\":\"${escape(display)}\"" +
            (objectId?.let { ",\"objectId\":\"${escape(it)}\",\"className\":\"${escape(value.type().name)}\"" } ?: "") +
            (name?.let { ",\"name\":\"${escape(it)}\"" } ?: "") + "}"
    }

    private fun error(error: Throwable): String = errorMessage("${error.fullClassName}: ${error.message ?: "Kotlite evaluation failed."}")
    private fun errorMessage(message: String): String = "{\"kind\":\"error\",\"display\":\"${escape(message)}\"}"
    private fun escape(value: String): String = value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")
}

@OptIn(ExperimentalJsExport::class)
@JsExport
fun bluekCreateKotliteSession(): KotliteSession = KotliteSession()
