class Ente : Actor() {
    private val minimaleGeschwindigkeit = 1
    private val maximaleGeschwindigkeit = 4
    private val maximaleLenkung = 5

    var geschwindigkeit = 2
        set(value) {
            if (value < minimaleGeschwindigkeit) {
                field = minimaleGeschwindigkeit
            } else if (value > maximaleGeschwindigkeit) {
                field = maximaleGeschwindigkeit
            } else {
                field = value
            }
        }

    var lenkung = 0
        set(value) {
            if (value < -maximaleLenkung) {
                field = -maximaleLenkung
            } else if (value > maximaleLenkung) {
                field = maximaleLenkung
            } else {
                field = value
            }
        }

    val abstandZumRand: Int
        get() = minOf(
            x,
            world.width - 1 - x,
            y,
            world.height - 1 - y
        )

    val imSicherenBereich: Boolean
        get() = abstandZumRand > 40

    init {
        image = Image("duck.png")
        rotation = (0..359).random()
    }

    override fun act() {
        turn(lenkung)
        turn((-2..2).random())
        move(geschwindigkeit)
    }
}
