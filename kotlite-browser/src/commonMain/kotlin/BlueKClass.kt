import com.sunnychung.lib.multiplatform.kotlite.Interpreter
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.CustomFunctionParameter
import com.sunnychung.lib.multiplatform.kotlite.model.DataType
import com.sunnychung.lib.multiplatform.kotlite.model.ProvidedClassDefinition
import com.sunnychung.lib.multiplatform.kotlite.model.RuntimeValue
import com.sunnychung.lib.multiplatform.kotlite.model.SourcePosition
import com.sunnychung.lib.multiplatform.kotlite.model.UnitValue

/** Host-provided BlueK utilities exposed to student code. */
object BlueKClass {
    fun definition(): ProvidedClassDefinition = ProvidedClassDefinition(
        position = SourcePosition.BUILTIN,
        fullQualifiedName = "BlueK",
        typeParameters = emptyList(),
        isInstanceCreationAllowed = false,
        primaryConstructorParameters = emptyList(),
        constructInstance = { _, _, _ ->
            throw UnsupportedOperationException("BlueK instances are not supported by Kotlite")
        },
    )

    fun beepFunction(beep: () -> Unit): CustomFunctionDefinition = CustomFunctionDefinition(
        position = SourcePosition.BUILTIN,
        receiverType = "BlueK.Companion",
        functionName = "beep",
        returnType = "Unit",
        parameterTypes = emptyList<CustomFunctionParameter>(),
        executable = { _: Interpreter, _: RuntimeValue?, _: List<RuntimeValue>, _: Map<String, DataType> ->
            beep()
            UnitValue
        },
    )
}
