package com.sunnychung.lib.multiplatform.kotlite.model

/** The host-provided part of Java's Thread API used by teaching examples. */
object ThreadClass {
    fun definition(): ProvidedClassDefinition {
        return ProvidedClassDefinition(
            position = SourcePosition.BUILTIN,
            fullQualifiedName = "Thread",
            typeParameters = emptyList(),
            isInstanceCreationAllowed = false,
            primaryConstructorParameters = emptyList(),
            constructInstance = { _, _, _ ->
                throw UnsupportedOperationException("Thread instances are not supported by Kotlite")
            },
        )
    }

    // Kotlite does not infer Long for unsuffixed integer literals.
    fun sleepFunctions(sleep: suspend (Long) -> Unit): List<CustomFunctionDefinition> =
        listOf("Int", "Long").map { createSleepFunction(it, sleep) }

    private fun createSleepFunction(
        parameterType: String,
        sleep: suspend (Long) -> Unit,
    ): CustomFunctionDefinition {
        val sleepFunction = CustomFunctionDefinition(
            position = SourcePosition.BUILTIN,
            receiverType = "Thread.Companion",
            functionName = "sleep",
            returnType = "Unit",
            parameterTypes = listOf(CustomFunctionParameter("millis", parameterType)),
            executable = { _, _, _, _ ->
                throw IllegalStateException("Thread.sleep requires asynchronous evaluation")
            },
        )
        sleepFunction.suspendExecutable = { interpreter, _, args, _ ->
            val millis = when (val value = args[0]) {
                is LongValue -> value.value
                is IntValue -> value.value.toLong()
                else -> throw IllegalArgumentException("Thread.sleep expects an integer timeout")
            }
            if (millis < 0) interpreter.throwEvalRuntimeException(SourcePosition.BUILTIN, "timeout value is negative")
            sleep(millis)
            UnitValue
        }
        return sleepFunction
    }
}
