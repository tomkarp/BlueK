open class Actor {
    var x = 0
    var y = 0
    var rotation = 0
    var image = Image("")
    var worldWidth = 0
    var worldHeight = 0
    fun setImage(path: String) { image = Image(path) }
    fun setImage(newImage: Image) { image = newImage }
    fun getImage(): Image = image
    fun getX(): Int = x
    fun getY(): Int = y
    fun setLocation(newX: Int, newY: Int) { x = newX; y = newY }
    fun getRotation(): Int = rotation
    fun setRotation(degrees: Int) { rotation = degrees }
    open fun act() {}
    fun move(distance: Int) {
        val normalized = ((rotation % 360) + 360) % 360
        if (normalized == 90) y += distance
        else if (normalized == 180) x -= distance
        else if (normalized == 270) y -= distance
        else x += distance
    }
    fun turn(degrees: Int) { rotation += degrees }
    val isAtEdge: Boolean get() = worldWidth > 0 && worldHeight > 0 && (x <= 0 || y <= 0 || x >= worldWidth - 1 || y >= worldHeight - 1)
    val isClicked: Boolean get() = bluekIsActorClicked(x, y)
}
