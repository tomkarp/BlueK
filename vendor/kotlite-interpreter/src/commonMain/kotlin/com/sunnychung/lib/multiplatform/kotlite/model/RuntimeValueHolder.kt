package com.sunnychung.lib.multiplatform.kotlite.model

import com.sunnychung.lib.multiplatform.kotlite.Interpreter

/**
 * Its main use cases are to allow mutations to member properties of nested class instances and in lambdas.
 */
interface RuntimeValueAccessor {
    val type: DataType

    fun assign(interpreter: Interpreter? = null, value: RuntimeValue)
    fun read(interpreter: Interpreter? = null): RuntimeValue
    suspend fun assignSuspended(interpreter: Interpreter? = null, value: RuntimeValue) = assign(interpreter, value)
    suspend fun readSuspended(interpreter: Interpreter? = null): RuntimeValue = read(interpreter)
}

class RuntimeValueHolder(override val type: DataType, val isMutable: Boolean, value: RuntimeValue? = null) : RuntimeValueAccessor {
    internal var value: RuntimeValue? = null

    init {
        if (value != null) {
            assign(value = value)
        }
    }

    override fun assign(interpreter: Interpreter?, value: RuntimeValue) {
        if (!isMutable && this.value != null) {
            throw RuntimeException("val cannot be reassigned")
        }
        if (!type.isCastableFrom(value.type()) && type != value.type()) {
            throw RuntimeException("Type ${value.type().descriptiveName} cannot be casted to ${type.descriptiveName}")
        }
        this.value = value
    }

    override fun read(interpreter: Interpreter?) = value!!

    override fun toString(): String = value.toString()
}

/**
 * For class members with custom accessors
 */
class RuntimeValueDelegate(override val type: DataType, val reader: (suspend (Interpreter?) -> RuntimeValue)?, val writer: (suspend (Interpreter?, RuntimeValue) -> Unit)?, val backing: RuntimeValueAccessor? = null) : RuntimeValueAccessor {
    override fun assign(interpreter: Interpreter?, value: RuntimeValue) {
        backing?.assign(interpreter, value) ?: throw RuntimeException("Setter requires asynchronous evaluation")
    }

    override fun read(interpreter: Interpreter?): RuntimeValue {
        return backing?.read(interpreter) ?: throw RuntimeException("Getter requires asynchronous evaluation")
    }

    override suspend fun assignSuspended(interpreter: Interpreter?, value: RuntimeValue) {
        writer?.invoke(interpreter, value) ?: backing?.assignSuspended(interpreter, value)
            ?: throw RuntimeException("Property is not writable")
    }

    override suspend fun readSuspended(interpreter: Interpreter?): RuntimeValue {
        return reader?.invoke(interpreter) ?: backing?.readSuspended(interpreter)
            ?: throw RuntimeException("Property is not readable")
    }
}
