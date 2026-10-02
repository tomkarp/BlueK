import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

suspend fun awaitRuntimeCheckpoint() = suspendCoroutine<Unit> { continuation ->
    runtimeCheckpointResume { continuation.resume(Unit) }
}

suspend fun awaitRuntimeSleep(millis: Long) = suspendCoroutine<Unit> { continuation ->
    runtimeSleepResume(millis) { continuation.resume(Unit) }
}

/** Continues deep recursion on an empty host stack; see `Interpreter.stackResetHook`. */
suspend fun awaitRuntimeStackReset() = suspendCoroutine<Unit> { continuation ->
    runtimeStackResume { continuation.resume(Unit) }
}

/**
 * Starts a new time slice for interpreted loops. Called whenever execution
 * (re)starts after the worker was able to process its events.
 */
expect fun restartRuntimeSlice()

/** Whether a loop should yield to the worker's events now; cheap enough for every iteration. */
expect fun runtimeCheckpointDue(): Boolean

expect fun runtimeCheckpointResume(resume: () -> Unit)
expect fun runtimeStackResume(resume: () -> Unit)
expect fun runtimeSleepResume(millis: Long, resume: () -> Unit)
