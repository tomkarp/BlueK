private external fun setTimeout(handler: () -> Unit, timeout: Int): Int

actual fun runtimeCheckpointResume(resume: () -> Unit) {
    setTimeout(resume, 0)
}

actual fun runtimeSleepResume(millis: Long, resume: () -> Unit) {
    val chunk = millis.coerceAtMost(Int.MAX_VALUE.toLong())
    setTimeout({
        if (millis > chunk) runtimeSleepResume(millis - chunk, resume) else resume()
    }, chunk.toInt())
}
