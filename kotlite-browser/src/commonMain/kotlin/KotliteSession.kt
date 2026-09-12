import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.KotliteInterpreter
import com.sunnychung.lib.multiplatform.kotlite.Parser
import com.sunnychung.lib.multiplatform.kotlite.SemanticAnalyzer
import com.sunnychung.lib.multiplatform.kotlite.extension.fullClassName
import com.sunnychung.lib.multiplatform.kotlite.lexer.Lexer
import com.sunnychung.lib.multiplatform.kotlite.model.ClassDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.ClassInstance
import com.sunnychung.lib.multiplatform.kotlite.model.BooleanValue
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.ExecutionEnvironment
import com.sunnychung.lib.multiplatform.kotlite.model.FunctionDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.NullValue
import com.sunnychung.lib.multiplatform.kotlite.model.PropertyDeclarationNode
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.ScriptNode
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.StringValue
import com.sunnychung.lib.multiplatform.kotlite.model.UnitValue
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
    private var nextHandle = 1
    private var analysisSource = ""
    private var stageSnapshot = ""
    private val keysDown = linkedSetOf<String>()

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

    fun load(filename: String, source: String): String = try {
        val previous = parse("<BlueK project>", analysisSource)
        val combined = parse("<BlueK project>", analysisSource + "\n" + source)
        SemanticAnalyzer(combined, environment).analyze()
        // Definitions are installed once. Evaluating the complete project here
        // would repeat top-level constructors and other side effects.
        interpreter.run {
            combined.nodes.drop(previous.nodes.size)
                .filter { it is ClassDeclarationNode || it is FunctionDeclarationNode || (it is PropertyDeclarationNode && it.initialValue == null) }
                .forEach { it.eval() }
        }
        analysisSource += "\n" + source
        recordPropertyNames(source)
        result("loaded", UnitValue)
    } catch (error: Throwable) {
        error(error)
    }

    fun evaluate(filename: String, source: String): String = try {
        val previous = parse("<BlueK project>", analysisSource)
        val combined = parse("<BlueK project>", analysisSource + "\n" + source)
        SemanticAnalyzer(combined, environment).analyze()
        val value = interpreter.run {
            combined.nodes.drop(previous.nodes.size).fold(UnitValue as RuntimeValue) { _, node ->
                (node.eval() as? RuntimeValue) ?: UnitValue
            }
        }
        analysisSource += "\n" + source
        result("value", value)
    } catch (error: Throwable) {
        error(error)
    }

    private fun recordPropertyNames(source: String) {
        Regex("""(?:class|object)\s+([A-Za-z_]\w*)[^\{]*\{([\s\S]*)\}""").findAll(source).forEach { match ->
            val names = propertyNames.getOrPut(match.groupValues[1]) { mutableListOf() }
            Regex("""\b(?:val|var)\s+([A-Za-z_]\w*)""").findAll(match.groupValues[2]).forEach {
                if (it.groupValues[1] !in names) names += it.groupValues[1]
            }
        }
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
        // Reading a declared slot is safe: it does not call arbitrary methods
        // or computed getters. Kotlite deliberately keeps its complete member
        // map internal, so the names are collected from the source declarations
        // while loading the project.
        val fields = propertyNames[value.type().name].orEmpty().joinToString(",", "[", "]") { name ->
            val member = value.findPropertyByDeclaredName(name)
            "{\"name\":\"${escape(name)}\",\"value\":\"${escape(member.convertToString())}\"}"
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
        propertyNames.clear()
        nextHandle = 1
        stageSnapshot = ""
        keysDown.clear()
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
        val snapshot = stageSnapshot
        stageSnapshot = ""
        return snapshot
    }

    fun setKey(key: String, pressed: Boolean): String {
        if (pressed) keysDown += key.lowercase() else keysDown -= key.lowercase()
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
