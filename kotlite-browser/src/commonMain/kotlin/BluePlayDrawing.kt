import kotlin.js.JSON

/**
 * Pixel geometry of BluePlay images for collision tests. An image is a
 * resource (with an optional alpha mask) plus the drawing operations recorded
 * by the library's `Image` class. The operations are parsed once per image
 * version instead of once per tested pixel; the results are the same as the
 * canvas renderer's geometry (see blueplay.md, "Kollision und Klicks").
 */
internal class BluePlayResourceMask(val width: Int, val height: Int, private val alphaHex: String) {
    private var decoded: ByteArray? = null

    /** Alpha (0..255) of a source pixel; the hex text is decoded on first use. */
    fun alpha(index: Int): Int {
        val alpha = decoded ?: ByteArray(width * height) { pixel ->
            (alphaHex.substring(pixel * 2, pixel * 2 + 2).toIntOrNull(16) ?: 0).toByte()
        }.also { decoded = it }
        return alpha[index].toInt() and 0xFF
    }
}

/** Resolves a resource path to its mask; null when the image has no prepared pixel data. */
internal typealias BluePlayMasks = (path: String) -> BluePlayResourceMask?

internal class BluePlayDrawing(
    val path: String,
    val width: Int,
    val height: Int,
    val opacity: Double,
    private val operations: Array<DrawOperation>,
) {
    /** Alpha (0..255) at a point in image coordinates, composited like the renderer. */
    fun alphaAt(x: Double, y: Double, masks: BluePlayMasks, depth: Int = 0): Double =
        alphaAt(path, width, height, operations, x, y, masks, depth)

    companion object {
        fun parse(path: String, width: Int, height: Int, opacity: Double, operations: List<String>) =
            BluePlayDrawing(path, width, height, opacity, Array(operations.size) { DrawOperation.parse(operations[it]) })
    }
}

internal class DrawOperation private constructor(
    private val kind: Kind,
    private val n1: Double,
    private val n2: Double,
    private val n3: Double,
    private val n4: Double,
    private val n5: Double,
    private val textLength: Int,
    private val source: String,
) {
    private enum class Kind { Fill, FillRect, DrawRect, FillOval, DrawOval, DrawLine, DrawString, DrawImage, Other }

    // A nested image drawn with drawImage, decoded on first use.
    private var nested: BluePlayDrawing? = null
    private var nestedDecoded = false

    fun alpha(x: Double, y: Double, masks: BluePlayMasks, depth: Int): Double = when (kind) {
        Kind.DrawImage -> {
            val w = n4; val h = n5
            val localX = x - n2; val localY = y - n3
            if (w <= 0 || h <= 0 || localX < 0 || localY < 0 || localX >= w || localY >= h) 0.0
            else if (source.startsWith(NESTED_PREFIX)) {
                nestedDrawing()?.let { drawing ->
                    drawing.alphaAt(localX * drawing.width / w, localY * drawing.height / h, masks, depth + 1) * drawing.opacity
                } ?: 0.0
            } else alphaAt(source, w.toInt(), h.toInt(), emptyArray(), localX, localY, masks, depth + 1)
        }
        else -> if (visible(x, y)) 255.0 else 0.0
    }

    private fun visible(x: Double, y: Double): Boolean = when (kind) {
        Kind.Fill -> true
        Kind.FillRect -> x >= n1 && y >= n2 && x < n1 + n3 && y < n2 + n4
        Kind.DrawRect -> {
            val left = n1; val top = n2; val right = left + n3; val bottom = top + n4
            x >= left - 1 && y >= top - 1 && x <= right + 1 && y <= bottom + 1 &&
                (x <= left + 1 || x >= right - 1 || y <= top + 1 || y >= bottom - 1)
        }
        Kind.FillOval, Kind.DrawOval -> {
            val width = n3; val height = n4
            if (width <= 0 || height <= 0) false else {
                val dx = (x - n1 - width / 2) / (width / 2)
                val dy = (y - n2 - height / 2) / (height / 2)
                val distance = dx * dx + dy * dy
                if (kind == Kind.FillOval) distance <= 1.0 else distance in 0.78..1.22
            }
        }
        Kind.DrawLine -> {
            val x1 = n1; val y1 = n2; val x2 = n3; val y2 = n4
            val lengthSquared = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
            val amount = if (lengthSquared == 0.0) 0.0 else (((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared).coerceIn(0.0, 1.0)
            val nearestX = x1 + amount * (x2 - x1); val nearestY = y1 + amount * (y2 - y1)
            (x - nearestX) * (x - nearestX) + (y - nearestY) * (y - nearestY) <= 2.25
        }
        Kind.DrawString -> x >= n2 && x <= n2 + textLength * 8 && y >= n3 - 12 && y <= n3 + 3
        Kind.DrawImage, Kind.Other -> false
    }

    private fun nestedDrawing(): BluePlayDrawing? {
        if (!nestedDecoded) {
            nestedDecoded = true
            nested = decodeNestedDrawing(source.removePrefix(NESTED_PREFIX))
        }
        return nested
    }

    companion object {
        fun parse(operation: String): DrawOperation {
            val parts = operation.split('|')
            fun number(index: Int): Double = parts.getOrNull(index)?.toDoubleOrNull() ?: 0.0
            val kind = when (parts.firstOrNull()) {
                "fill" -> Kind.Fill
                "fillRect" -> Kind.FillRect
                "drawRect" -> Kind.DrawRect
                "fillOval" -> Kind.FillOval
                "drawOval" -> Kind.DrawOval
                "drawLine" -> Kind.DrawLine
                "drawString" -> Kind.DrawString
                "drawImage" -> Kind.DrawImage
                else -> Kind.Other
            }
            return DrawOperation(kind, number(1), number(2), number(3), number(4), number(5),
                parts.getOrNull(1)?.length ?: 0, if (kind == Kind.DrawImage) parts.getOrNull(1).orEmpty() else "")
        }
    }
}

/** Marks a drawImage source that embeds a snapshot of another Image (see `Image.drawImage`). */
internal const val NESTED_PREFIX = "__bluek:"

private fun alphaAt(path: String, width: Int, height: Int, operations: Array<DrawOperation>, x: Double, y: Double, masks: BluePlayMasks, depth: Int): Double {
    if (x < 0 || y < 0 || x >= width || y >= height || depth > 64) return 0.0
    val mask = if (path.isEmpty()) null else masks(path)
    var alpha = if (mask != null) {
        val sourceX = ((x / width) * mask.width).toInt().coerceIn(0, mask.width - 1)
        val sourceY = ((y / height) * mask.height).toInt().coerceIn(0, mask.height - 1)
        mask.alpha(sourceY * mask.width + sourceX).toDouble()
    } else if (path.isNotEmpty()) 255.0 else 0.0
    for (operation in operations) {
        val next = operation.alpha(x, y, masks, depth)
        alpha = next + alpha * (1.0 - next / 255.0)
        if (alpha >= 255.0) return 255.0
    }
    return alpha
}

/** Inverse of the escaping in `Image.encodedSnapshot()` of the library source. */
private fun decodeNestedDrawing(encoded: String): BluePlayDrawing? = runCatching {
    val decoded = StringBuilder()
    var index = 0
    while (index < encoded.length) {
        val ch = encoded[index++]
        if (ch != '\\' || index >= encoded.length) decoded.append(ch)
        else when (val escaped = encoded[index++]) {
            '\\' -> decoded.append('\\')
            '"' -> decoded.append('"')
            'p' -> decoded.append('|')
            'n' -> decoded.append('\n')
            else -> { decoded.append('\\'); decoded.append(escaped) }
        }
    }
    val parsed = JSON.parse<dynamic>(decoded.toString())
    BluePlayDrawing.parse((parsed.resourcePath as? String).orEmpty(),
        (parsed.width as? Int)?.coerceAtLeast(1) ?: 1,
        (parsed.height as? Int)?.coerceAtLeast(1) ?: 1,
        (parsed.opacity as? Double)?.coerceIn(0.0, 1.0) ?: 1.0,
        (parsed.operations as? Array<String>)?.toList().orEmpty())
}.getOrNull()
