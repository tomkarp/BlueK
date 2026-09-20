/**
 * Minimal BluePlay example.
 * In BlueJ: right-click 'Main' -> main() to load the world, then press Run.
 * The Reset button in the window runs this main() again.
 */
fun main() {
    val world = MyWorld()
    world.addObject(Figure(), 100, 200)
    showWorld(world)
}
