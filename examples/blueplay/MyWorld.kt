/**
 * A minimal world. It places a dog when it is created.
 */
class MyWorld : World(600, 400, 1) {
    init {
        addObject(Dog(), 100, 200)
    }
}
