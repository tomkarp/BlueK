private external fun setTimeout(handler: () -> Unit, timeout: Int): Int

/**
 * Longest stretch of interpreted loops before the worker processes key, click,
 * input and stop commands. A time budget instead of a fixed iteration count:
 * a short loop finishes without leaving the worker's current task.
 */
private const val SLICE_MILLIS = 10.0

/** The clock is read on every n-th checkpoint only. */
private const val CHECKPOINTS_PER_CLOCK_READ = 64

private var checkpointsUntilClockRead = CHECKPOINTS_PER_CLOCK_READ
private var sliceEnd = 0.0

private fun now(): Double = js("performance.now()") as Double

actual fun restartRuntimeSlice() {
    sliceEnd = now() + SLICE_MILLIS
    checkpointsUntilClockRead = CHECKPOINTS_PER_CLOCK_READ
}

actual fun runtimeCheckpointDue(): Boolean {
    if (--checkpointsUntilClockRead > 0) return false
    checkpointsUntilClockRead = CHECKPOINTS_PER_CLOCK_READ
    return now() >= sliceEnd
}

actual fun runtimeCheckpointResume(resume: () -> Unit) {
    postTask {
        restartRuntimeSlice()
        resume()
    }
}

/**
 * Runs [task] as a new event-loop task. Nested timers are delayed by at least
 * 4 ms in browsers; a message channel (or Node's setImmediate) is not.
 */
private val postTask: (() -> Unit) -> Unit = createTaskPoster()

private fun createTaskPoster(): (() -> Unit) -> Unit {
    if (js("typeof setImmediate === 'function'") as Boolean) {
        val setImmediate: dynamic = js("setImmediate")
        return { task -> setImmediate(task) }
    }
    if (js("typeof MessageChannel === 'function'") as Boolean) {
        val tasks = ArrayDeque<() -> Unit>()
        val channel: dynamic = js("new MessageChannel()")
        channel.port1.onmessage = { _: dynamic -> tasks.removeFirst()() }
        return { task ->
            tasks.addLast(task)
            channel.port2.postMessage(null)
        }
    }
    return { task -> setTimeout(task, 0) }
}

// A microtask runs once the current host stack is empty, without the delay of a timer.
actual fun runtimeStackResume(resume: () -> Unit) {
    kotlin.js.Promise.resolve(Unit).then { resume() }
}

actual fun runtimeSleepResume(millis: Long, resume: () -> Unit) {
    val chunk = millis.coerceAtMost(Int.MAX_VALUE.toLong())
    setTimeout({
        if (millis > chunk) runtimeSleepResume(millis - chunk, resume)
        else {
            restartRuntimeSlice()
            resume()
        }
    }, chunk.toInt())
}
