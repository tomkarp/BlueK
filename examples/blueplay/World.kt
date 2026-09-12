fun bluekEscape(value: String): String {
    var escaped = ""
    var index = 0
    while (index < value.length) {
        val character = value.substring(index, index + 1)
        if (character == "\"") escaped += "\\\""
        else if (character == "\\") escaped += "\\\\"
        else if (character == "\n") escaped += "\\n"
        else escaped += character
        index += 1
    }
    return escaped
}

open class World(val width: Int, val height: Int, val cellSize: Int = 1) {
    private val actors = mutableListOf<Actor>()
    private val textX = mutableListOf<Int>()
    private val textY = mutableListOf<Int>()
    private val textValues = mutableListOf<String>()
    var backgroundColor = "rgb(255,255,255)"
    var background = Image("")
    var running = false
    var speed = 50
    fun actorType(actor: Actor): String = "Actor"
    fun render() {
        var objects = "["
        var first = true
        for (current in actors) {
            if (!first) objects += ","
            first = false
            val imagePath = current.image?.path ?: ""
            val imageOperations = current.image?.drawingJson() ?: "[]"
            val imageWidth = current.image?.width ?: 30
            val imageHeight = current.image?.height ?: 30
            val imageOpacity = current.image?.transparency?.toString() ?: "255"
            objects += "{\"type\":\"${actorType(current)}\",\"x\":${current.x},\"y\":${current.y},\"rotation\":${current.rotation},\"imagePath\":\"${bluekEscape(imagePath)}\",\"imageOperations\":$imageOperations,\"imageWidth\":$imageWidth,\"imageHeight\":$imageHeight,\"imageOpacity\":${imageOpacity.toDouble() / 255.0}}"
        }
        objects += "]"
        val backgroundPath = background.path
        var texts = "["
        var textFirst = true
        var textIndex = 0
        while (textIndex < textValues.size) {
            if (!textFirst) texts += ","
            textFirst = false
            texts += "{\"x\":${textX[textIndex]},\"y\":${textY[textIndex]},\"text\":\"${bluekEscape(textValues[textIndex])}\"}"
            textIndex += 1
        }
        texts += "]"
        bluekStageUpdate("{\"stage\":{\"width\":${width},\"height\":${height},\"cellSize\":${cellSize},\"backgroundColor\":\"${bluekEscape(backgroundColor)}\",\"backgroundPath\":\"${bluekEscape(backgroundPath)}\",\"backgroundOperations\":${background.drawingJson()},\"speed\":${speed},\"running\":${running},\"objects\":${objects},\"texts\":${texts}}}")
    }
    fun show() { render() }
    fun getWidth(): Int = width
    fun getHeight(): Int = height
    fun getCellSize(): Int = cellSize
    fun setBackground(fileName: String) { background = Image(fileName); show() }
    fun setBackground(red: Int, green: Int, blue: Int) {
        backgroundColor = "rgb(${red},${green},${blue})"
        background = Image("")
        show()
    }
    fun showText(text: String, x: Int, y: Int) {
        var index = 0
        while (index < textValues.size) {
            if (textX[index] == x && textY[index] == y) {
                if (text.isEmpty()) {
                    textX.removeAt(index)
                    textY.removeAt(index)
                    textValues.removeAt(index)
                } else {
                    textValues[index] = text
                }
                show()
                return
            }
            index += 1
        }
        if (text.isNotEmpty()) {
            textX.add(x)
            textY.add(y)
            textValues.add(text)
        }
        show()
    }
    open fun act() {}
    fun tick() { act(); for (current in actors) current.act() }
    fun addObject(actor: Actor, x: Int, y: Int) {
        if (actors.count { it == actor } == 0) {
            actors.add(actor)
        }
        actor.worldWidth = width
        actor.worldHeight = height
        actor.setLocation(x, y)
        show()
    }
    fun getObjects(): List<Actor> = actors
    fun removeObject(actor: Actor) {
        if (actors.count { it == actor } > 0) {
            actors.remove(actor)
        }
        show()
    }
    fun allObjects(): List<Actor> = actors
    fun getObjectsAt(x: Int, y: Int): List<Actor> = actors.filter { it.x == x && it.y == y }
    val numberOfObjects: Int get() = actors.size
    val isClicked: Boolean get() = bluekIsWorldClicked()
}
