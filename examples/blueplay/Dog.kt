/**
 * A simple dog that walks to the right.
 */
class Dog : Actor() {

    init {
        image = Image("dog.png")
    }

    override fun act() {
        // An inherited method can be called like ordinary Kotlin code.
        move(1)
    }
}
