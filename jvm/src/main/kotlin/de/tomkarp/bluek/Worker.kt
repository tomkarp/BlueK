package de.tomkarp.bluek

import java.io.File
import java.net.URLClassLoader
import java.util.UUID

private class Ctx(private val objects: MutableMap<String, Any>) : RuntimeContext {
    override fun objectById(id: String): Any? = objects[id]
}

private lateinit var controlOut: java.io.PrintStream
private fun emit(kind: String, display: String, id: String? = null) {
    val extra = id?.let { ",\"objectId\":\"$it\"" } ?: ""
    controlOut.println("{\"kind\":\"$kind\",\"display\":\"${display.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")}\"$extra}")
    controlOut.flush()
}

fun main() {
    controlOut = System.out
    var loader: URLClassLoader? = null
    var projectPath = ""
    val objects = mutableMapOf<String, Any>()
    val names = mutableMapOf<String, String>()
    val ctx = Ctx(objects)
    val controlIn = System.`in`
    val inputPipe = java.io.PipedInputStream()
    val inputWriter = java.io.PipedOutputStream(inputPipe)
    System.setIn(inputPipe)
    val actionLock = Any()
    fun process(line: String) {
        try {
            when {
                line.contains("\"op\":\"input\"") -> {
                    inputWriter.write((value(line, "text") + "\n").toByteArray(Charsets.UTF_8)); inputWriter.flush()
                    emit("unit", "input sent")
                }
                line.contains("\"op\":\"load\"") -> {
                    projectPath = value(line, "path")
                    loader = URLClassLoader(arrayOf(File(projectPath).toURI().toURL()), Worker::class.java.classLoader)
                    objects.clear(); names.clear(); emit("unit", "loaded")
                }
                line.contains("\"op\":\"create\"") -> {
                    val className = value(line, "className")
                    val args = value(line, "args").split('|').filter { it.isNotEmpty() }.map(::parse)
                    val ctor = Class.forName(className, true, loader).declaredConstructors.first { it.parameterCount == args.size }
                    val obj = withUserOutput { ctor.newInstance(*args.toTypedArray()) }; val id = UUID.randomUUID().toString()
                    objects[id] = obj; value(line, "name").takeIf { it.isNotEmpty() }?.let { names[it] = id }
                    emit("object", obj.javaClass.simpleName, id)
                }
                line.contains("\"op\":\"invoke\"") -> {
                    val obj = objects[value(line, "objectId")]!!; val name = value(line, "name")
                    val args = value(line, "args").split('|').filter { it.isNotEmpty() }.map(::parse)
                    val method = obj.javaClass.methods.filter { it.name == name && it.parameterCount == args.size }.first()
                    val value = withUserOutput { method.invoke(obj, *args.toTypedArray()) }
                    result(value)
                }
                line.contains("\"op\":\"inspect\"") -> {
                    val obj = objects[value(line, "objectId")]!!
                    val fields = obj.javaClass.declaredFields.filter { !it.isSynthetic }.joinToString(", ") { f -> f.isAccessible = true; "${f.name}=${f.get(obj)}" }
                    emit("scalar", fields)
                }
                line.contains("\"op\":\"eval\"") -> {
                    val code = value(line, "code"); val mode = value(line, "mode")
                    val bindings = names.entries.joinToString("\n") { "val ${it.key} = ctx.objectById(\"${it.value}\") as ${objects[it.value]!!.javaClass.name}" }
                    val expression = if (mode == "expression") "return@run $code" else "$code\nreturn@run Unit"
                    val dir = createTempDir(prefix = "bluek-snippet-"); val src = File(dir, "Snippet.kt")
                    src.writeText("import de.tomkarp.bluek.RuntimeContext\nclass Snippet { fun execute(ctx: RuntimeContext): Any? = run { $bindings\n$expression } }")
                    val jar = File(dir, "snippet.jar"); val compiler = ProcessBuilder("kotlinc", src.absolutePath, "-classpath", "${projectPath}:${File(Worker::class.java.protectionDomain.codeSource.location.toURI())}", "-d", jar.absolutePath).redirectErrorStream(true).start()
                    if (compiler.waitFor() != 0) { emit("error", compiler.inputStream.bufferedReader().readText()); return }
                    val child = URLClassLoader(arrayOf(jar.toURI().toURL()), loader); val snippet = child.loadClass("Snippet").getDeclaredConstructor().newInstance()
                    val userOut = System.out
                    try { System.setOut(System.err); result(snippet.javaClass.getMethod("execute", RuntimeContext::class.java).invoke(snippet, ctx)) }
                    finally { System.setOut(userOut) }
                }
                else -> emit("error", "Unsupported worker operation")
            }
        } catch (e: Throwable) { emit("error", e.cause?.message ?: e.message ?: "runtime error") }
    }
    controlIn.bufferedReader().forEachLine { line ->
        if (line.contains("\"op\":\"input\"")) process(line)
        else Thread { synchronized(actionLock) { process(line) } }.start()
    }
}

private fun value(line: String, key: String): String = Regex("\\\"$key\\\":\\\"((?:\\\\.|[^\"])*)\\\"").find(line)?.groupValues?.get(1)?.replace("\\\"", "\"") ?: ""
private fun parse(s: String): Any? = when { s == "null" -> null; s.toIntOrNull() != null -> s.toInt(); s.toLongOrNull() != null -> s.toLong(); s == "true" || s == "false" -> s.toBoolean(); else -> s.removePrefix("\"").removeSuffix("\"") }
private fun result(v: Any?) { when { v == null -> emit("null", "null"); v is Number || v is String || v is Boolean -> emit("scalar", v.toString()); else -> emit("object", v.javaClass.simpleName, UUID.randomUUID().toString()) } }
private fun <T> withUserOutput(block: () -> T): T { val previous = System.out; return try { System.setOut(System.err); block() } finally { System.setOut(previous) } }
private object Worker
