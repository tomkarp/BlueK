class Krokodil : Actor() {
    private var geschwindigkeit = 1
    private var schritte = 0

    init {
        image = Image("crocodile.png")
    }

    override fun act() {
        schritte += 1
        if (schritte % 100 == 0 && geschwindigkeit < 6) {
            geschwindigkeit += 1
        }

        if ((1..10).random() == 1) {
            turn((-60..60).random())
        }

        move(geschwindigkeit)

        if (isAtEdge) {
            turn(180)
        }

        for (ente in world.getObjects<Ente>()) {
            if (intersects(ente)) {
                world.showText("Ein Krokodil hat eine Ente gefangen!", 270, 250)
                stop()
            }
        }
    }
}
