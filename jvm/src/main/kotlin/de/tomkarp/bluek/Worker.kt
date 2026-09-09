package de.tomkarp.bluek

import java.io.ByteArrayOutputStream
import java.io.File
import java.net.URLClassLoader
import java.util.Base64
import java.util.Arrays
import java.util.UUID
import javax.imageio.ImageIO

private class Ctx(private val objects: MutableMap<String, Any>) : RuntimeContext {
    override fun objectById(id: String): Any? = objects[id]
}

private lateinit var controlOut: java.io.PrintStream
private val activeRequestId = ThreadLocal.withInitial { "" }
private val stageImageCache = mutableMapOf<String, String>()
private class LiveOutputStream(private val onFlush: (String) -> Unit) : java.io.OutputStream() {
    private val buffer = ByteArrayOutputStream()
    override fun write(value: Int) { buffer.write(value); if (value == '\n'.code) flush() }
    override fun write(values: ByteArray, offset: Int, length: Int) { buffer.write(values, offset, length); if (values.copyOfRange(offset, offset + length).contains('\n'.code.toByte())) flush() }
    override fun flush() { if (buffer.size() == 0) return; val text = buffer.toString(Charsets.UTF_8); buffer.reset(); onFlush(text) }
}
private fun emit(kind: String, display: String, id: String? = null, output: String = "", stage: String? = null) {
    val extra = id?.let { ",\"objectId\":\"$it\"" } ?: ""
    val out = if (output.isEmpty()) "" else ",\"output\":\"${output.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")}\""
    val request = if (activeRequestId.get().isEmpty()) "" else ",\"requestId\":\"${activeRequestId.get()}\""
    val world = stage?.let { ",\"stage\":$it" } ?: ""
    controlOut.println("{\"kind\":\"$kind\",\"display\":\"${display.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")}\"$extra$out$world$request}")
    controlOut.flush()
}

fun main() {
    controlOut = System.out
    var loader: URLClassLoader? = null
    var projectPath = ""
    val objects = mutableMapOf<String, Any>()
    val names = mutableMapOf<String, String>()
    val bindingTypes = mutableMapOf<String, String>()
    val ctx = Ctx(objects)
    val controlIn = System.`in`
    val inputPipe = java.io.PipedInputStream()
    val inputWriter = java.io.PipedOutputStream(inputPipe)
    System.setIn(inputPipe)
    val actionLock = Any()
    fun process(line: String) {
        activeRequestId.set(value(line, "requestId"))
        try {
            when {
                line.contains("\"op\":\"input\"") -> {
                    inputWriter.write((value(line, "text") + "\n").toByteArray(Charsets.UTF_8)); inputWriter.flush()
                }
                line.contains("\"op\":\"stage\"") -> emit("stage", "", stage = stageSnapshot(objects))
                line.contains("\"op\":\"key\"") -> { loader?.loadClass("BluePlayFunctionsKt")?.getMethod("setKeyState", String::class.java, Boolean::class.javaPrimitiveType)?.invoke(null, value(line, "key"), value(line, "pressed") == "true") }
                line.contains("\"op\":\"click\"") -> { loader?.loadClass("BluePlayFunctionsKt")?.getMethod("setClickPosition", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType)?.invoke(null, value(line, "x").toInt(), value(line, "y").toInt()) }
                line.contains("\"op\":\"load\"") -> {
                    projectPath = value(line, "path")
                    loader = URLClassLoader(arrayOf(File(projectPath).toURI().toURL()), Worker::class.java.classLoader)
                    objects.clear(); names.clear(); bindingTypes.clear(); emit("unit", "loaded")
                }
                line.contains("\"op\":\"create\"") -> {
                    val className = value(line, "className")
                    val args = argumentValues(line).joinToString(", ")
                    val typeArguments = argumentValues(line, "typeArguments").joinToString(", ")
                    val typeSuffix = if (typeArguments.isEmpty()) "" else "<$typeArguments>"
                    val dir = createTempDir(prefix = "bluek-create-"); val src = File(dir, "Factory.kt")
                    src.writeText("class Factory { fun execute(): Any? = $className$typeSuffix($args) }")
                    val jar = File(dir, "factory.jar"); val compiler = ProcessBuilder("kotlinc", src.absolutePath, "-classpath", "${projectPath}:${File(Worker::class.java.protectionDomain.codeSource.location.toURI())}", "-d", jar.absolutePath).redirectInput(ProcessBuilder.Redirect.PIPE).redirectErrorStream(true).start()
                    compiler.outputStream.close()
                    if (!compiler.waitFor(60, java.util.concurrent.TimeUnit.SECONDS)) { compiler.destroyForcibly(); emit("error", "Constructor compilation timed out"); return }
                    if (compiler.exitValue() != 0) { emit("error", compiler.inputStream.bufferedReader().readText()); return }
                    val child = URLClassLoader(arrayOf(jar.toURI().toURL()), loader); val factory = child.loadClass("Factory").getDeclaredConstructor().newInstance()
                    val created = withUserOutput { factory.javaClass.getMethod("execute").invoke(factory) }; val id = UUID.randomUUID().toString()
                    objects[id] = created.value; value(line, "name").takeIf { it.isNotEmpty() }?.let { name -> names[name] = id; val typeArgs = argumentValues(line, "typeArguments"); bindingTypes[name] = if (typeArgs.isEmpty()) className else "$className<${typeArgs.joinToString(", ")}>" }
                    emit("object", created.value.javaClass.simpleName, id, created.output, stageSnapshot(objects))
                }
                line.contains("\"op\":\"invoke\"") -> {
                    val objectId = value(line, "objectId"); val objectName = names.entries.firstOrNull { it.value == objectId }?.key ?: error("Object is not named on the bench")
                    val methodName = value(line, "name"); val args = argumentValues(line).joinToString(", "); val bindings = names.entries.joinToString("\n") { "val ${it.key} = ctx.objectById(\"${it.value}\") as ${bindingTypes[it.key] ?: objects[it.value]!!.javaClass.name}" }
                    val dir = createTempDir(prefix = "bluek-invoke-"); val src = File(dir, "Snippet.kt")
                    src.writeText("import de.tomkarp.bluek.RuntimeContext\nclass Snippet { fun execute(ctx: RuntimeContext): Any? = run { $bindings\nreturn@run $objectName.$methodName($args) } }")
                    val jar = File(dir, "snippet.jar"); val compiler = ProcessBuilder("kotlinc", src.absolutePath, "-classpath", "${projectPath}:${File(Worker::class.java.protectionDomain.codeSource.location.toURI())}", "-d", jar.absolutePath).redirectInput(ProcessBuilder.Redirect.PIPE).redirectErrorStream(true).start()
                    compiler.outputStream.close()
                    if (!compiler.waitFor(60, java.util.concurrent.TimeUnit.SECONDS)) { compiler.destroyForcibly(); emit("error", "Snippet compilation timed out"); return }
                    if (compiler.exitValue() != 0) { emit("error", compiler.inputStream.bufferedReader().readText()); return }
                    val child = URLClassLoader(arrayOf(jar.toURI().toURL()), loader); val snippet = child.loadClass("Snippet").getDeclaredConstructor().newInstance()
                    val invoked = withUserOutput { snippet.javaClass.getMethod("execute", RuntimeContext::class.java).invoke(snippet, ctx) }
                    result(invoked.value, invoked.output, stageSnapshot(objects))
                }
                line.contains("\"op\":\"inspect\"") -> {
                    val obj = objects[value(line, "objectId")]!!
                    val fields = obj.javaClass.declaredFields.filter { !it.isSynthetic }.joinToString(", ") { f -> f.isAccessible = true; "${f.name}=${f.get(obj)}" }
                    emit("scalar", fields)
                }
                line.contains("\"op\":\"remove\"") -> {
                    val objectId = value(line, "objectId")
                    objects.remove(objectId)
                    names.entries.removeIf { it.value == objectId }
                    emit("unit", "Removed")
                }
                line.contains("\"op\":\"eval\"") -> {
                    val code = value(line, "code"); val mode = value(line, "mode")
                    val bindings = names.entries.joinToString("\n") { "val ${it.key} = ctx.objectById(\"${it.value}\") as ${objects[it.value]!!.javaClass.name}" }
                    val expression = if (mode == "expression") "return@run $code" else "$code\nreturn@run Unit"
                    val dir = createTempDir(prefix = "bluek-snippet-"); val src = File(dir, "Snippet.kt")
                    src.writeText("import de.tomkarp.bluek.RuntimeContext\nclass Snippet { fun execute(ctx: RuntimeContext): Any? = run { $bindings\n$expression } }")
                    val jar = File(dir, "snippet.jar"); val compiler = ProcessBuilder("kotlinc", src.absolutePath, "-classpath", "${projectPath}:${File(Worker::class.java.protectionDomain.codeSource.location.toURI())}", "-d", jar.absolutePath).redirectInput(ProcessBuilder.Redirect.PIPE).redirectErrorStream(true).start()
                    compiler.outputStream.close()
                    if (!compiler.waitFor(60, java.util.concurrent.TimeUnit.SECONDS)) { compiler.destroyForcibly(); emit("error", "Snippet compilation timed out"); return }
                    if (compiler.exitValue() != 0) { emit("error", compiler.inputStream.bufferedReader().readText()); return }
                    val child = URLClassLoader(arrayOf(jar.toURI().toURL()), loader); val snippet = child.loadClass("Snippet").getDeclaredConstructor().newInstance()
                    val evaluated = withUserOutput { snippet.javaClass.getMethod("execute", RuntimeContext::class.java).invoke(snippet, ctx) }
                    result(evaluated.value, evaluated.output, stageSnapshot(objects))
                }
                else -> emit("error", "Unsupported worker operation")
            }
        } catch (e: Throwable) { emit("error", e.cause?.message ?: e.message ?: "runtime error") } finally { activeRequestId.remove() }
    }
    controlIn.bufferedReader().forEachLine { line ->
        if (line.contains("\"op\":\"input\"") || line.contains("\"op\":\"stage\"") || line.contains("\"op\":\"key\"") || line.contains("\"op\":\"click\"")) process(line)
        else Thread { synchronized(actionLock) { process(line) } }.start()
    }
}

private fun decodeJsonString(raw: String): String { val result = StringBuilder(); var escaped = false; for (char in raw) { if (escaped) { result.append(when (char) { 'n' -> '\n'; 'r' -> '\r'; 't' -> '\t'; else -> char }); escaped = false } else if (char == '\\') escaped = true else result.append(char) }; if (escaped) result.append('\\'); return result.toString() }
private fun value(line: String, key: String): String = Regex("\\\"$key\\\":\\\"((?:\\\\.|[^\"])*)\\\"").find(line)?.groupValues?.get(1)?.let(::decodeJsonString) ?: ""
private fun argumentValues(line: String, key: String = "args"): List<String> { val encoded = value(line, key).trim(); if (!encoded.startsWith("[")) return encoded.split('|').filter(String::isNotEmpty); val body = encoded.removePrefix("[").removeSuffix("]"); val values = mutableListOf<String>(); Regex("\"((?:\\\\.|[^\"\\\\])*)\"").findAll(body).forEach { values.add(decodeJsonString(it.groupValues[1])) }; while (values.lastOrNull() == "") values.removeLast(); return values }
private fun parse(s: String): Any? = when { s == "null" -> null; s.toIntOrNull() != null -> s.toInt(); s.toLongOrNull() != null -> s.toLong(); s == "true" || s == "false" -> s.toBoolean(); else -> s.removePrefix("\"").removeSuffix("\"") }
private fun result(v: Any?, output: String = "", stage: String? = null) { when { v == null -> emit("null", "null", output = output, stage = stage); v === Unit -> emit("unit", "Unit", output = output, stage = stage); v is Number || v is String || v is Boolean -> emit("scalar", v.toString(), output = output, stage = stage); else -> emit("object", v.javaClass.simpleName, UUID.randomUUID().toString(), output, stage) } }
private fun stageSnapshot(objects: Map<String, Any>): String? {
    fun findField(type: Class<*>, name: String): java.lang.reflect.Field? { var current: Class<*>? = type; while (current != null) { current.declaredFields.firstOrNull { it.name == name }?.let { return it }; current = current.superclass }; return null }
    fun number(world: Any, name: String): Int? = findField(world.javaClass, name)?.let { field -> field.isAccessible = true; (field.get(world) as? Number)?.toInt() }
    fun jsonText(value: String): String = value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r")
    fun soundsJson(loader: ClassLoader): String {
        return try {
            val sounds = Class.forName("BluePlayFunctionsKt", true, loader).getMethod("soundsOf").invoke(null) as? Iterable<*> ?: emptyList<Any>()
            sounds.filterIsInstance<String>().joinToString(",") { "\"${jsonText(it)}\"" }
        } catch (_: Throwable) { "" }
    }
    fun imageJson(owner: Any, fieldName: String): String {
        val imageField = findField(owner.javaClass, fieldName) ?: return ""
        imageField.isAccessible = true
        val image = imageField.get(owner) ?: return ""
        val awtField = findField(image.javaClass, "awtImage") ?: return ""
        awtField.isAccessible = true
        val awtImage = awtField.get(image) ?: return ""
        val bufferedImage = awtImage as java.awt.image.BufferedImage
        val pixelHash = Arrays.hashCode(bufferedImage.getRGB(0, 0, bufferedImage.width, bufferedImage.height, null, 0, bufferedImage.width))
        val key = "${System.identityHashCode(awtImage)}:${bufferedImage.width}:${bufferedImage.height}:$pixelHash"
        val encoded = synchronized(stageImageCache) {
            stageImageCache[key] ?: run {
                val bytes = ByteArrayOutputStream()
                if (!ImageIO.write(bufferedImage, "png", bytes)) return ""
                Base64.getEncoder().encodeToString(bytes.toByteArray()).also { stageImageCache[key] = it }
            }
        }
        return ",\"image\":\"data:image/png;base64,$encoded\",\"imageWidth\":${bufferedImage.width},\"imageHeight\":${bufferedImage.height}"
    }
    val world = objects.values.firstOrNull { findField(it.javaClass, "actors") != null } ?: return null
    val actorsField = findField(world.javaClass, "actors") ?: return null; actorsField.isAccessible = true
    val actors = (actorsField.get(world) as? Iterable<*>)?.filterNotNull() ?: return null
    val entries = actors.mapNotNull { actor ->
        val x = number(actor, "x") ?: return@mapNotNull null; val y = number(actor, "y") ?: return@mapNotNull null; val rotation = number(actor, "rotation") ?: 0
        "{\"type\":\"${actor.javaClass.simpleName}\",\"x\":$x,\"y\":$y,\"rotation\":$rotation${imageJson(actor, "image")}}"
    }.joinToString(",")
    val width = number(world, "width") ?: 0; val height = number(world, "height") ?: 0; val cellSize = number(world, "cellSize") ?: 1
    val textEntries = try {
        val projectWorld = Class.forName("World", true, world.javaClass.classLoader)
        val texts = Class.forName("BluePlayFunctionsKt", true, world.javaClass.classLoader).getMethod("textsOf", projectWorld).invoke(null, world) as? Iterable<*> ?: emptyList<Any>()
        texts.mapNotNull { item ->
            val values = item as? Triple<*, *, *> ?: return@mapNotNull null
            val x = values.first as? Number ?: return@mapNotNull null; val y = values.second as? Number ?: return@mapNotNull null; val text = values.third as? String ?: return@mapNotNull null
            "{\"x\":${x.toInt()},\"y\":${y.toInt()},\"text\":\"${jsonText(text)}\"}"
        }.joinToString(",")
    } catch (_: Throwable) { "" }
    return "{\"width\":$width,\"height\":$height,\"cellSize\":$cellSize${imageJson(world, "background")},\"objects\":[$entries],\"texts\":[$textEntries],\"sounds\":[${soundsJson(world.javaClass.classLoader)}]}"
}
private data class Captured<T>(val value: T, val output: String)
private fun <T> withUserOutput(block: () -> T): Captured<T> {
    val previous = System.out
    val output = StringBuilder()
    val live = LiveOutputStream { text -> output.append(text); emit("output", "", output = text) }
    return try { System.setOut(java.io.PrintStream(live, true, Charsets.UTF_8)); val value = block(); live.flush(); Captured(value, output.toString()) }
    finally { System.setOut(previous) }
}
private object Worker
