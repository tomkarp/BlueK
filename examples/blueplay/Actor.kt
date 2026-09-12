open class Actor {
    var x = 0
    var y = 0
    var rotation = 0
    var image: Image? = null
    var worldWidth = 0
    var worldHeight = 0
    fun setImage(path: String) { image = Image(path) }
    fun setImage(newImage: Image) { image = newImage }
    fun getImage(): Image? = image
    fun getX(): Int = x
    fun getY(): Int = y
    fun setLocation(newX: Int, newY: Int) {
        x = if (worldWidth > 0) {
            if (newX < 0) 0 else if (newX >= worldWidth) worldWidth - 1 else newX
        } else newX
        y = if (worldHeight > 0) {
            if (newY < 0) 0 else if (newY >= worldHeight) worldHeight - 1 else newY
        } else newY
    }
    fun getRotation(): Int = rotation
    fun setRotation(degrees: Int) { rotation = degrees }
    fun turnTowards(targetX: Int, targetY: Int) { rotation = bluekHeading(x, y, targetX, targetY) }
    fun distanceTo(other: Actor): Int = bluekDistance(x, y, other.x, other.y)
    fun intersects(other: Actor): Boolean = x == other.x && y == other.y
    fun isTouching(other: Actor): Boolean = intersects(other)
    open fun act() {}
    fun move(distance: Int) {
        val normalized = ((rotation % 360) + 360) % 360
        if (normalized == 90) setLocation(x, y + distance)
        else if (normalized == 180) setLocation(x - distance, y)
        else if (normalized == 270) setLocation(x, y - distance)
        else setLocation(x + distance, y)
    }
    fun turn(degrees: Int) { rotation += degrees }
    val isAtEdge: Boolean get() = worldWidth > 0 && worldHeight > 0 && (x <= 0 || y <= 0 || x >= worldWidth - 1 || y >= worldHeight - 1)
    val isClicked: Boolean get() = bluekIsActorClicked(x, y)
}
