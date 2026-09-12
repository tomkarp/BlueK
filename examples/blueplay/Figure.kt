/**
 * A simple figure that slowly walks to the right.
 */
class Figure : Actor() {

    init {
        this.setImage("figure.png")
    }

    override fun act() {
        // Explicit receiver is required by the current Kotlite superclass
        // member lookup for this first browser-only BluePlay example.
        this.move(1)
    }
}
