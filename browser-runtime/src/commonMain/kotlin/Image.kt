class Image {
    var width: Int
        private set
    var height: Int
        private set
    internal var fileName: String? = null
    constructor(width: Int, height: Int) { this.width = width.coerceAtLeast(1); this.height = height.coerceAtLeast(1) }
    constructor(fileName: String) { this.fileName = fileName; width = 30; height = 30 }
    constructor(other: Image) { width = other.width; height = other.height; fileName = other.fileName }
    fun setColor(r: Int, g: Int, b: Int) {}
    fun fill() {}
    fun fillRect(x: Int, y: Int, w: Int, h: Int) {}
    fun drawRect(x: Int, y: Int, w: Int, h: Int) {}
    fun fillOval(x: Int, y: Int, w: Int, h: Int) {}
    fun drawOval(x: Int, y: Int, w: Int, h: Int) {}
    fun drawLine(x1: Int, y1: Int, x2: Int, y2: Int) {}
    fun drawString(text: String, x: Int, y: Int) {}
    fun drawImage(image: Image, x: Int, y: Int) {}
    fun clear() {}
    fun scale(width: Int, height: Int) { this.width = width.coerceAtLeast(1); this.height = height.coerceAtLeast(1) }
    fun setTransparency(value: Int) {}
}
