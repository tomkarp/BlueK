class Image(val path: String = "") {
    private var drawingColor = "rgb(0,0,0)"
    private var drawingOperations = mutableListOf<String>()
    private var imageWidth = 30
    private var imageHeight = 30
    var transparency = 255
        set(value) { field = if (value < 0) 0 else if (value > 255) 255 else value }

    val width: Int get() = imageWidth
    val height: Int get() = imageHeight

    fun setTransparency(value: Int) { transparency = value }
    fun scale(newWidth: Int, newHeight: Int) {
        imageWidth = if (newWidth < 1) 1 else newWidth
        imageHeight = if (newHeight < 1) 1 else newHeight
    }
    fun setColor(red: Int, green: Int, blue: Int) {
        drawingColor = "rgb($red,$green,$blue)"
    }
    fun fill() { drawingOperations = mutableListOf("fill|$drawingColor") }
    fun fillRect(x: Int, y: Int, width: Int, height: Int) {
        drawingOperations.add("fillRect|$x|$y|$width|$height|$drawingColor")
    }
    fun drawRect(x: Int, y: Int, width: Int, height: Int) {
        drawingOperations.add("drawRect|$x|$y|$width|$height|$drawingColor")
    }
    fun fillOval(x: Int, y: Int, width: Int, height: Int) {
        drawingOperations.add("fillOval|$x|$y|$width|$height|$drawingColor")
    }
    fun drawOval(x: Int, y: Int, width: Int, height: Int) {
        drawingOperations.add("drawOval|$x|$y|$width|$height|$drawingColor")
    }
    fun drawLine(x1: Int, y1: Int, x2: Int, y2: Int) {
        drawingOperations.add("drawLine|$x1|$y1|$x2|$y2|$drawingColor")
    }
    fun drawString(text: String, x: Int, y: Int) {
        var encoded = ""
        var index = 0
        while (index < text.length) {
            val character = text.substring(index, index + 1)
            encoded += if (character == "\\") "\\\\" else if (character == "|") "\\p" else if (character == "\n") "\\n" else character
            index += 1
        }
        drawingOperations.add("drawString|$encoded|$x|$y|$drawingColor")
    }
    fun drawImage(image: Image, x: Int, y: Int) {
        val nested = "{\"operations\":${image.drawingJson()},\"width\":${image.width},\"height\":${image.height}}"
        var encoded = ""
        var index = 0
        while (index < nested.length) {
            val character = nested.substring(index, index + 1)
            encoded += if (character == "\\") "\\\\" else if (character == "\"") "\\\"" else if (character == "\n") "\\n" else character
            index += 1
        }
        drawingOperations.add("drawImage|__bluek:$encoded|$x|$y|${image.width}|${image.height}")
    }
    fun clear() { drawingOperations.clear() }

    fun drawingJson(): String {
        var json = "["
        var index = 0
        while (index < drawingOperations.size) {
            if (index > 0) json += ","
            val operation = drawingOperations[index]
            var escaped = ""
            var characterIndex = 0
            while (characterIndex < operation.length) {
                val character = operation.substring(characterIndex, characterIndex + 1)
                escaped += if (character == "\\") "\\\\" else if (character == "\"") "\\\"" else if (character == "\n") "\\n" else character
                characterIndex += 1
            }
            json += "\"$escaped\""
            index += 1
        }
        return "$json]"
    }
}
