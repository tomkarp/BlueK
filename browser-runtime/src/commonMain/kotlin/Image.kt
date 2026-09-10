class Image {
    var width: Int
        private set
    var height: Int
        private set
    internal var fileName: String? = null
    internal var backgroundColor: String? = null
    private var colorValue = "rgb(0, 0, 0)"
    internal val drawOperations = mutableListOf<String>()
    constructor(width: Int, height: Int) { this.width = width.coerceAtLeast(1); this.height = height.coerceAtLeast(1) }
    constructor(fileName: String) { this.fileName = fileName; width = 30; height = 30 }
    constructor(other: Image) { width = other.width; height = other.height; fileName = other.fileName; backgroundColor = other.backgroundColor; colorValue = other.colorValue; drawOperations.addAll(other.drawOperations) }
    fun setColor(r: Int, g: Int, b: Int) { colorValue = "rgb(${r.coerceIn(0, 255)}, ${g.coerceIn(0, 255)}, ${b.coerceIn(0, 255)})" }
    fun fill() { backgroundColor = colorValue; drawOperations.add("fill|$colorValue") }
    fun fillRect(x: Int, y: Int, w: Int, h: Int) { backgroundColor = colorValue; drawOperations.add("fillRect|$x|$y|$w|$h|$colorValue") }
    fun drawRect(x: Int, y: Int, w: Int, h: Int) { drawOperations.add("drawRect|$x|$y|$w|$h|$colorValue") }
    fun fillOval(x: Int, y: Int, w: Int, h: Int) { drawOperations.add("fillOval|$x|$y|$w|$h|$colorValue") }
    fun drawOval(x: Int, y: Int, w: Int, h: Int) { drawOperations.add("drawOval|$x|$y|$w|$h|$colorValue") }
    fun drawLine(x1: Int, y1: Int, x2: Int, y2: Int) { drawOperations.add("drawLine|$x1|$y1|$x2|$y2|$colorValue") }
    fun drawString(text: String, x: Int, y: Int) { drawOperations.add("drawString|$x|$y|${text.replace("|", " ")}|$colorValue") }
    fun drawImage(image: Image, x: Int, y: Int) {}
    fun clear() { backgroundColor = null; drawOperations.clear() }
    fun scale(width: Int, height: Int) { this.width = width.coerceAtLeast(1); this.height = height.coerceAtLeast(1) }
    fun setTransparency(value: Int) {}
}
