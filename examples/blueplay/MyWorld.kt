/**
 * A minimal world. It places a figure when it is created.
 */
class MyWorld : World(600, 400, 1) {
    var initialized = false

    init {
        initialized = true
    }
}
