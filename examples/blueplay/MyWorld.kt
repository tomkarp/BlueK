/**
 * A minimal world. It places a figure when it is created.
 */
class MyWorld : World(600, 400, 1) {

    init {
        val backgroundImage = Image(width, height)
        backgroundImage.setColor(235, 242, 250)
        backgroundImage.fill()
        background = backgroundImage
        addObject(Figure(), 100, 200)
    }
}
