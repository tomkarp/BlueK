open class Actor {
    var x = 0
    var y = 0
    var rotation = 0
    var image = Image("")
    fun setImage(path: String) { image = Image(path) }
    open fun act() {}
    fun move(distance: Int) { x += distance }
    fun turn(degrees: Int) { rotation += degrees }
    val isAtEdge: Boolean get() = false
    val isClicked: Boolean get() = bluekIsActorClicked(x, y)
}
