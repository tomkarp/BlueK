// Browser-only BluePlay bridge. The visible world is rendered by BlueK.
var currentWorld: World?
fun activeWorld(): World = currentWorld as World
fun isKeyDown(key: String): Boolean = bluekIsKeyDown(key)
fun showWorld(world: World) { currentWorld = world; world.show() }
fun show() { showWorld(activeWorld()) }
fun start() { activeWorld().running = true; activeWorld().show() }
fun stop() { activeWorld().running = false; activeWorld().show() }
fun step() { activeWorld().tick(); activeWorld().show() }
fun setSpeed(value: Int) { activeWorld().speed = if (value < 1) 1 else if (value > 100) 100 else value; activeWorld().show() }
fun getSpeed(): Int = activeWorld().speed
fun playSound(fileName: String) { println("BluePlay sound: $fileName") }
