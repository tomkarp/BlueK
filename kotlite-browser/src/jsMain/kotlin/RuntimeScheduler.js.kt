private external fun setTimeout(handler: () -> Unit, timeout: Int): Int

private const val CHECKPOINTS_PER_YIELD = 128
private var checkpointsSinceYield = 0

actual fun runtimeCheckpointResume(resume: () -> Unit) {
    checkpointsSinceYield += 1
    if (checkpointsSinceYield >= CHECKPOINTS_PER_YIELD) {
        checkpointsSinceYield = 0
        setTimeout(resume, 0)
    } else {
        resume()
    }
}

actual fun runtimeSleepResume(millis: Long, resume: () -> Unit) {
    val chunk = millis.coerceAtMost(Int.MAX_VALUE.toLong())
    setTimeout({
        if (millis > chunk) runtimeSleepResume(millis - chunk, resume) else resume()
    }, chunk.toInt())
}
