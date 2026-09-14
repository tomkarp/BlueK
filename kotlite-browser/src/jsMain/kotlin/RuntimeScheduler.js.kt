private external fun setTimeout(handler: () -> Unit, timeout: Int): Int

actual fun runtimeCheckpointResume(resume: () -> Unit) {
    setTimeout(resume, 0)
}
