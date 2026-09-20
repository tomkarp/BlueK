/**
 * A simple figure that slowly walks to the right.
 */
class Figure : Actor() {

    init {
        setImage("figure.png")
    }

    override fun act() {
        // An inherited method can be called like ordinary Kotlin code.
        move(1)
    }
}
