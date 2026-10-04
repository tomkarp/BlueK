package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.error.InterpreterStateException
import com.sunnychung.lib.multiplatform.kotlite.extension.isHostStackOverflow
import kotlin.coroutines.cancellation.CancellationException

/**
 * The difference between Exception and Throwable is that, Throwable includes exceptions thrown outside the interpreter
 * scope.
 */
open class ThrowableValue(
    currentScope: SymbolTable,
    val message: String?,
    val cause: ThrowableValue?,
    val stacktrace: List<String>,
    val externalExceptionClassName: String? = null,
    thisClazz: ClassDefinition? = null,
    parentInstance: ClassInstance? = null,
) : ClassInstance(
    currentScope = currentScope,
    fullClassName = (thisClazz ?: clazz).fullQualifiedName,
    // The registered copy, attached to the interpreter like the one `DelegatedValue` uses: the static
    // definition knows no members (`toString()` failed) and no supertypes (`cause` rejected a subclass).
    clazz = currentScope.findClass((thisClazz ?: clazz).fullQualifiedName)?.first ?: thisClazz ?: clazz,
    typeArguments = emptyList(),
    parentInstance = parentInstance,
) {
    companion object {
        val clazz = ProvidedClassDefinition(
            position = SourcePosition.BUILTIN,
            fullQualifiedName = "Throwable",
            typeParameters = emptyList(),
            isInstanceCreationAllowed = true,
            primaryConstructorParameters = listOf(
                CustomFunctionParameter("message", "String?", "null"),
                CustomFunctionParameter("cause", "Throwable?", "null"),
            ),
            constructInstance = { interpreter, callArguments, callPosition ->
                val message = (callArguments[0] as? StringValue)?.value
                val cause = (callArguments[1] as? ClassInstance)?.throwablePart()
                ThrowableValue(interpreter.symbolTable(), message, cause, interpreter.callStack.getStacktrace())
            },
            modifiers = setOf(ClassModifier.open),
        )

        val properties = listOf(
            ExtensionProperty(
                declaredName = "message",
                typeParameters = emptyList(),
                receiver = "Throwable",
                type = "String?",
                getter = { interpreter, receiver, typeArgs ->
                    receiver.throwable().message?.let { StringValue(it, interpreter.symbolTable()) } ?: NullValue
                },
            ),
            ExtensionProperty(
                declaredName = "cause",
                typeParameters = emptyList(),
                receiver = "Throwable",
                type = "Throwable?",
                getter = { interpreter, receiver, typeArgs ->
                    receiver.throwable().cause?.wholeInstance() ?: NullValue
                },
            ),
            ExtensionProperty(
                declaredName = "name",
                typeParameters = emptyList(),
                receiver = "Throwable",
                type = "String",
                getter = { interpreter, receiver, typeArgs ->
                    val value = receiver.throwable()
                    StringValue(value.externalExceptionClassName ?: (receiver as ClassInstance).type().name, interpreter.symbolTable())
                },
            ),
        )

        val functions = listOf(
            CustomFunctionDefinition(
                position = SourcePosition.BUILTIN,
                receiverType = "Throwable",
                functionName = "stackTraceToString",
                returnType = "String",
                parameterTypes = emptyList(),
                executable = { interpreter, receiver, args, typeArgs ->
                    // Like Kotlin: the text `printStackTrace()` writes, `MyEx: x` and one `at` line per frame (RT-71).
                    val text = (receiver as ClassInstance).convertToString(isCallCustomFunction = false) + "\n" +
                        receiver.throwable().stacktrace.joinToString("") { "    at $it\n" }
                    StringValue(text, interpreter.symbolTable())
                },
            ),
        )

        // An object of a student subclass (`class MyEx : Exception()`) keeps its state in its `Throwable` part.
        private fun RuntimeValue?.throwable(): ThrowableValue = (this as ClassInstance).throwablePart()!!
    }
}

/**
 * The difference between Exception and Throwable is that, Throwable includes exceptions thrown outside the interpreter
 * scope.
 */
open class ExceptionValue(
    currentScope: SymbolTable,
    message: String?,
    cause: ThrowableValue? = null,
    stacktrace: List<String>,
    thisClazz: ClassDefinition? = null,
    parentInstance: ClassInstance? = null,
) : ThrowableValue(
    currentScope = currentScope,
    message = message,
    cause = cause,
    stacktrace = stacktrace,
    thisClazz = thisClazz ?: clazz,
    parentInstance = null,
) {
    companion object {
        val clazz = ProvidedClassDefinition(
            position = SourcePosition.BUILTIN,
            fullQualifiedName = "Exception",
            typeParameters = emptyList(),
            isInstanceCreationAllowed = true,
            primaryConstructorParameters = listOf(
                CustomFunctionParameter("message", "String?", "null"),
                CustomFunctionParameter("cause", "Throwable?", "null"),
            ),
            constructInstance = { interpreter, callArguments, callPosition ->
                val message = (callArguments[0] as? StringValue)?.value
                val cause = (callArguments[1] as? ClassInstance)?.throwablePart()
                ExceptionValue(interpreter.symbolTable(), message, cause, interpreter.callStack.getStacktrace())
            },
            superClassInvocationString = "Throwable(message, cause)",
//            superClass = ThrowableValue.clazz,
            modifiers = setOf(ClassModifier.open),
        )
    }
}

class NullPointerExceptionValue(
    currentScope: SymbolTable,
    // `null!!` has no message, as in Kotlin (RT-61); the text "null" used to show as `NullPointerException: null`.
    message: String? = null,
    cause: ThrowableValue? = null,
    stacktrace: List<String>,
) : ExceptionValue(
    currentScope = currentScope,
    message = message,
    cause = cause,
    stacktrace = stacktrace,
    thisClazz = clazz,
    parentInstance = null,
) {
    companion object {
        val clazz = ProvidedClassDefinition(
            position = SourcePosition.BUILTIN,
            fullQualifiedName = "NullPointerException",
            typeParameters = emptyList(),
            isInstanceCreationAllowed = true,
            primaryConstructorParameters = listOf(
                CustomFunctionParameter("message", "String?", "null"),
                CustomFunctionParameter("cause", "Throwable?", "null"),
            ),
            constructInstance = { interpreter, callArguments, callPosition ->
                val message = (callArguments[0] as? StringValue)?.value
                val cause = (callArguments[1] as? ClassInstance)?.throwablePart()
                NullPointerExceptionValue(interpreter.symbolTable(), message, cause, interpreter.callStack.getStacktrace())
            },
            superClassInvocationString = "Exception(message, cause)",
//            superClass = ExceptionValue.clazz,
        )
    }
}

class TypeCastExceptionValue(
    currentScope: SymbolTable,
    val valueType: String,
    val targetType: String,
    stacktrace: List<String>,
) : ExceptionValue(
    currentScope = currentScope,
    message = "`$valueType` cannot be casted to type `$targetType`",
    cause = null,
    stacktrace = stacktrace,
    thisClazz = clazz,
    parentInstance = null,
) {
    companion object {
        val clazz = ProvidedClassDefinition(
            position = SourcePosition.BUILTIN,
            fullQualifiedName = "TypeCastException",
            typeParameters = emptyList(),
            isInstanceCreationAllowed = true,
            primaryConstructorParameters = listOf(
                CustomFunctionParameter("valueType", "String", null),
                CustomFunctionParameter("targetType", "String", null),
            ),
            constructInstance = { interpreter, callArguments, callPosition ->
                val valueType = (callArguments[0] as StringValue).value
                val targetType = (callArguments[1] as StringValue).value
                TypeCastExceptionValue(interpreter.symbolTable(), valueType, targetType, interpreter.callStack.getStacktrace())
            },
            superClassInvocationString = "Exception()",
//            superClass = ExceptionValue.clazz,
        )
    }
}

/** Standard library throwables without extra state, e.g. `IllegalArgumentException` or `StackOverflowError`. */
class StandardExceptionValue(
    currentScope: SymbolTable,
    message: String?,
    cause: ThrowableValue?,
    stacktrace: List<String>,
    thisClazz: ClassDefinition,
) : ExceptionValue(
    currentScope = currentScope,
    message = message,
    cause = cause,
    stacktrace = stacktrace,
    thisClazz = thisClazz,
    parentInstance = null,
) {
    companion object {
        private fun definition(name: String, superClass: String): ProvidedClassDefinition {
            lateinit var clazz: ProvidedClassDefinition
            clazz = ProvidedClassDefinition(
                position = SourcePosition.BUILTIN,
                fullQualifiedName = name,
                typeParameters = emptyList(),
                isInstanceCreationAllowed = true,
                primaryConstructorParameters = listOf(
                    CustomFunctionParameter("message", "String?", "null"),
                    CustomFunctionParameter("cause", "Throwable?", "null"),
                ),
                constructInstance = { interpreter, callArguments, _ ->
                    val message = (callArguments[0] as? StringValue)?.value
                    val cause = (callArguments[1] as? ClassInstance)?.throwablePart()
                    StandardExceptionValue(interpreter.symbolTable(), message, cause, interpreter.callStack.getStacktrace(), clazz)
                },
                superClassInvocationString = "$superClass(message, cause)",
                modifiers = setOf(ClassModifier.open),
            )
            return clazz
        }

        // Ordered so that every superclass is registered before its subclasses.
        val classes: List<ProvidedClassDefinition> = listOf(
            definition("IllegalArgumentException", "Exception"),
            definition("IllegalStateException", "Exception"),
            definition("NumberFormatException", "IllegalArgumentException"),
            definition("ArithmeticException", "Exception"),
            definition("IndexOutOfBoundsException", "Exception"),
            definition("NoSuchElementException", "Exception"),
            definition("UnsupportedOperationException", "Exception"),
            definition("UninitializedPropertyAccessException", "Exception"),
            // Not exceptions: `catch (e: Exception)` does not handle them.
            definition("Error", "Throwable"),
            definition("StackOverflowError", "Error"),
        )

        /** Kotlin leaves the message empty; BlueK names the usual cause instead. */
        fun stackOverflowMessage(maxCallDepth: Int?): String =
            (if (maxCallDepth != null) "More than $maxCallDepth nested calls" else "Too many nested calls") +
                ". Does a function or property accessor call itself endlessly?"

        /**
         * The class of [classes] for an exception thrown by host code, e.g. by a native stdlib function, or null.
         * `UnsupportedOperationException` is left out: the interpreter throws it for its own unsupported paths.
         */
        fun classNameOf(error: Throwable): String? = when {
            error is InterpreterStateException || error is CancellationException -> null
            error.isHostStackOverflow -> "StackOverflowError"
            error is NumberFormatException -> "NumberFormatException"
            error is IllegalArgumentException -> "IllegalArgumentException"
            error is IllegalStateException -> "IllegalStateException"
            error is ArithmeticException -> "ArithmeticException"
            error is IndexOutOfBoundsException -> "IndexOutOfBoundsException"
            error is NoSuchElementException -> "NoSuchElementException"
            error is UninitializedPropertyAccessException -> "UninitializedPropertyAccessException"
            else -> null
        }
    }
}
