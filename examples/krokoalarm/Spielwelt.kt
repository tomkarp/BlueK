class Spielwelt : World(800, 500, 1) {
    private var punkte = 0

    init {
        val hintergrund = Image(width, height)
        hintergrund.setColor(180, 155, 105)
        hintergrund.fill()
        hintergrund.setColor(100, 180, 215)
        hintergrund.fillRect(40, 40, width - 80, height - 80)
        background = hintergrund

        addObject(Ente(), (200..600).random(), (200..400).random())
        addObject(Ente(), (200..600).random(), (200..400).random())
        addObject(Ente(), (200..600).random(), (200..400).random())
        addObject(Ente(), (200..600).random(), (200..400).random())

        addObject(Krokodil(), 100, 180)
        addObject(Krokodil(), 100, 320)
    }

    override fun act() {
        punkte += 1
        showText("Punkte: $punkte", 20, 20)
        showText("↑/↓: Tempo    ←/→: Lenkung", 270, 20)

        val enten = getObjects<Ente>()
        for (ente in enten) {
            if (isKeyDown("up")) {
                ente.geschwindigkeit += 1
            }
            if (isKeyDown("down")) {
                ente.geschwindigkeit -= 1
            }
            if (isKeyDown("left")) {
                ente.lenkung -= 1
            }
            if (isKeyDown("right")) {
                ente.lenkung += 1
            }
        }

        if (enten.isNotEmpty()) {
            showText(
                "Tempo: ${enten[0].geschwindigkeit}    Lenkung: ${enten[0].lenkung}",
                545,
                20
            )
        }

        for (ente in enten) {
            if (!ente.imSicherenBereich) {
                showText("Eine Ente ist am Ufer in Gefahr!", 240, 250)
                stop()
            }
        }
    }
}
