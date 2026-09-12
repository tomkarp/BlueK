open class Actor {
    var x = 0
    var y = 0
    var rotation = 0
    var image: Image? = null
    var worldWidth = 0
    var worldHeight = 0
    var worldCellSize = 1
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
    fun intersects(other: Actor): Boolean {
        val firstImage = image
        val secondImage = other.image
        val firstWidth = firstImage?.width ?: 30
        val firstHeight = firstImage?.height ?: 30
        val secondWidth = secondImage?.width ?: 30
        val secondHeight = secondImage?.height ?: 30
        val firstCenterX = x * worldCellSize + worldCellSize / 2
        val firstCenterY = y * worldCellSize + worldCellSize / 2
        val secondCenterX = other.x * other.worldCellSize + other.worldCellSize / 2
        val secondCenterY = other.y * other.worldCellSize + other.worldCellSize / 2
        return (firstCenterX - secondCenterX) * 2 < firstWidth + secondWidth &&
            (firstCenterY - secondCenterY) * 2 < firstHeight + secondHeight &&
            (secondCenterX - firstCenterX) * 2 < firstWidth + secondWidth &&
            (secondCenterY - firstCenterY) * 2 < firstHeight + secondHeight
    }
    fun isTouching(other: Actor): Boolean = intersects(other)
    open fun act() {}
    fun move(distance: Int) {
        setLocation(x + bluekMoveDeltaX(rotation, distance), y + bluekMoveDeltaY(rotation, distance))
    }
    fun turn(degrees: Int) { rotation += degrees }
    val isAtEdge: Boolean get() = worldWidth > 0 && worldHeight > 0 && (x <= 0 || y <= 0 || x >= worldWidth - 1 || y >= worldHeight - 1)
    val isClicked: Boolean get() = bluekIsActorClicked(x, y)
}
