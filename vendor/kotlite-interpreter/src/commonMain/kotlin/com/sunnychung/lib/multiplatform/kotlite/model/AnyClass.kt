package com.sunnychung.lib.multiplatform.kotlite.model

class AnyClass {

    companion object {
        /*
         * `equals()`, `hashCode()` and `toString()` of `Any`, also for hosts whose
         * own `Any?` functions receive an object's `Any` part through `super`.
         * Objects use the whole object (`super.equals()` runs on a part) and never
         * call a student override, which would loop.
         */
        fun anyEquals(receiver: RuntimeValue, other: RuntimeValue): Boolean = when (receiver) {
            // Lists, sets, maps and pairs compare by content, other library values by identity.
            is DelegatedValue<*> -> receiver.anyEquals(other)
            is ClassInstance -> receiver.wholeInstance() === (other as? ClassInstance)?.wholeInstance()
            else -> receiver == other
        }

        fun anyHashCode(receiver: RuntimeValue): Int = when (receiver) {
            is DelegatedValue<*> -> receiver.anyHashCode()
            is ClassInstance -> receiver.wholeInstance().originalHashCode()
            else -> receiver.hashCode()
        }

        fun anyToString(receiver: RuntimeValue): String = when (receiver) {
            is DelegatedValue<*> -> receiver.anyToString()
            is ClassInstance -> receiver.wholeInstance().convertToString(isCallCustomFunction = false)
            else -> receiver.convertToString(isCallCustomFunction = false)
        }

        val memberFunctions = listOf(
            CustomFunctionDefinition(
                position = SourcePosition.BUILTIN,
                receiverType = null,
                functionName = "equals",
                returnType = "Boolean",
                // Intentionally drop "operator" modifier to lessen performance penalty
                // Otherwise, it won't pass LoopTest.
                modifiers = setOf(/*FunctionModifier.operator,*/ FunctionModifier.open),
                parameterTypes = listOf(CustomFunctionParameter(name = "other", type = "Any?")),
                executable = exe@ { interpreter, receiver, args, typeArgs ->
                    BooleanValue(receiver != null && anyEquals(receiver, args[0]), interpreter.symbolTable())
                }
            ),
            CustomFunctionDefinition(
                position = SourcePosition.BUILTIN,
                receiverType = null,
                functionName = "hashCode",
                returnType = "Int",
                modifiers = setOf(FunctionModifier.open),
                parameterTypes = emptyList(),
                executable = exe@ { interpreter, receiver, args, typeArgs ->
                    IntValue(receiver?.let(::anyHashCode) ?: 0, interpreter.symbolTable())
                }
            ),
            CustomFunctionDefinition(
                position = SourcePosition.BUILTIN,
                receiverType = null,
                functionName = "toString",
                returnType = "String",
                modifiers = setOf(FunctionModifier.open),
                parameterTypes = emptyList(),
                executable = exe@ { interpreter, receiver, args, typeArgs ->
                    StringValue(
                        value = receiver?.let(::anyToString) ?: "null",
                        symbolTable = interpreter.symbolTable(),
                    )
                }
            ),
        )

        val clazz: ProvidedClassDefinition = ProvidedClassDefinition(
            fullQualifiedName = "Any",
            typeParameters = emptyList(),
            modifiers = setOf(ClassModifier.open),
            isInstanceCreationAllowed = true,
            primaryConstructorParameters = emptyList(),
            constructInstance = { interpreter, _, _ -> ClassInstance(
                currentScope = interpreter.symbolTable(),
                fullClassName = "Any",
                clazz = interpreter.symbolTable().findClass("Any")!!.first,
                typeArguments = emptyList(),
            ) },
            functions = memberFunctions,
            position = SourcePosition.BUILTIN,
        )
    }
}
