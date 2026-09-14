import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

suspend fun awaitRuntimeCheckpoint() = suspendCoroutine<Unit> { continuation ->
    runtimeCheckpointResume { continuation.resume(Unit) }
}

expect fun runtimeCheckpointResume(resume: () -> Unit)
