class Timer {
    var min: Int = 0
        set(value) {
            if (value >= 0) field = value
        }

    var max: Int = 0
        set(value) {
            if (value >= min) field = value
        }

    val zeitspanne: Int
        get() = max - min

    fun starten() {
        val bis = if (max <= min) max else min + (0..(max - min)).random()
        repeat(bis) {
            Thread.sleep(1000)
        }
        println("Timer abgelaufen!")
    }
}
