package com.sunnychung.lib.multiplatform.kotlite.model

import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * One invocation of synchronous library code whose callbacks may suspend
 * (see [CustomFunctionDefinition.isReplayable] and `Interpreter.callReplayable`).
 *
 * Every callback outcome is recorded in call order. When a callback suspends,
 * the library code is abandoned; once the callback has completed, the library
 * code runs again and receives the recorded outcomes instead of executing the
 * callbacks a second time. Interpreted code therefore runs exactly once.
 */
internal class ReplayableNativeCall {
    private val outcomes = mutableListOf<Any?>()
    private var position = 0

    /** Set while the current attempt is being abandoned. */
    var suspendedCallback: SuspendedCallback? = null
        private set

    fun beginAttempt() {
        position = 0
        suspendedCallback = null
    }

    fun hasRecordedOutcome() = position < outcomes.size

    fun replayOutcome(): Any? {
        val outcome = outcomes[position++]
        if (outcome is FailedCallback) throw outcome.error
        return outcome
    }

    fun record(outcome: Result<Any?>) {
        outcomes += outcome.fold({ it }, { FailedCallback(it) })
        position += 1
    }

    fun abandon(callback: SuspendedCallback): Nothing {
        suspendedCallback = callback
        throw AbandonedNativeCall()
    }

    private class FailedCallback(val error: Throwable)
}

/** Completion of a callback that suspended after its library code was abandoned. */
internal class SuspendedCallback {
    private var outcome: Result<Any?>? = null
    private var waiter: Continuation<Result<Any?>>? = null

    fun complete(result: Result<Any?>) {
        val continuation = waiter
        if (continuation == null) {
            outcome = result
        } else {
            waiter = null
            continuation.resume(result)
        }
    }

    suspend fun await(): Result<Any?> = outcome ?: suspendCoroutine { waiter = it }
}

/**
 * Unwinds abandoned library code. It extends [Throwable] directly so that
 * library code catching `Exception` does not intercept it.
 */
internal class AbandonedNativeCall : Throwable("A library callback suspended; the library call is replayed after it completes.")
