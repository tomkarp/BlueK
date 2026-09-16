import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

suspend fun awaitRuntimeCheckpoint() = suspendCoroutine<Unit> { continuation ->
    runtimeCheckpointResume { continuation.resume(Unit) }
}

suspend fun awaitRuntimeSleep(millis: Long) = suspendCoroutine<Unit> { continuation ->
    runtimeSleepResume(millis) { continuation.resume(Unit) }
}

expect fun runtimeCheckpointResume(resume: () -> Unit)
expect fun runtimeSleepResume(millis: Long, resume: () -> Unit)
