package de.tomkarp.bluek

import java.io.File
import java.net.URLClassLoader
import java.util.UUID

private class Ctx(private val objects: MutableMap<String, Any>) : RuntimeContext {
    override fun objectById(id: String): Any? = objects[id]
}

private fun emit(kind: String, display: String, id: String? = null) {
    val extra = id?.let { ",\"objectId\":\"$it\"" } ?: ""
    println("{\"kind\":\"$kind\",\"display\":\"${display.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")}\"$extra}")
    System.out.flush()
}

fun main() {
    var loader: URLClassLoader? = null
    var projectPath = ""
    val objects = mutableMapOf<String, Any>()
    val names = mutableMapOf<String, String>()
    val ctx = Ctx(objects)
    System.`in`.bufferedReader().forEachLine { line ->
        try {
            when {
                line.contains("\"op\":\"load\"") -> {
                    projectPath = value(line, "path")
                    loader = URLClassLoader(arrayOf(File(projectPath).toURI().toURL()), Worker::class.java.classLoader)
                    objects.clear(); names.clear(); emit("unit", "loaded")
                }
                line.contains("\"op\":\"create\"") -> {
                    val className = value(line, "className")
                    val args = value(line, "args").split('|').filter { it.isNotEmpty() }.map(::parse)
                    val ctor = Class.forName(className, true, loader).declaredConstructors.first { it.parameterCount == args.size }
                    val obj = ctor.newInstance(*args.toTypedArray()); val id = UUID.randomUUID().toString()
                    objects[id] = obj; value(line, "name").takeIf { it.isNotEmpty() }?.let { names[it] = id }
                    emit("object", obj.javaClass.simpleName, id)
                }
                line.contains("\"op\":\"invoke\"") -> {
                    val obj = objects[value(line, "objectId")]!!; val name = value(line, "name")
                    val args = value(line, "args").split('|').filter { it.isNotEmpty() }.map(::parse)
                    val method = obj.javaClass.methods.filter { it.name == name && it.parameterCount == args.size }.first()
                    result(method.invoke(obj, *args.toTypedArray()))
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
                    if (compiler.waitFor() != 0) { emit("error", compiler.inputStream.bufferedReader().readText()); return@forEachLine }
                    val child = URLClassLoader(arrayOf(jar.toURI().toURL()), loader); val snippet = child.loadClass("Snippet").getDeclaredConstructor().newInstance()
                    result(snippet.javaClass.getMethod("execute", RuntimeContext::class.java).invoke(snippet, ctx))
                }
                else -> emit("error", "Unsupported worker operation")
            }
        } catch (e: Throwable) { emit("error", e.cause?.message ?: e.message ?: "runtime error") }
    }
}

private fun value(line: String, key: String): String = Regex("\\\"$key\\\":\\\"((?:\\\\.|[^\"])*)\\\"").find(line)?.groupValues?.get(1)?.replace("\\\"", "\"") ?: ""
private fun parse(s: String): Any? = when { s == "null" -> null; s.toIntOrNull() != null -> s.toInt(); s.toLongOrNull() != null -> s.toLong(); s == "true" || s == "false" -> s.toBoolean(); else -> s.removePrefix("\"").removeSuffix("\"") }
private fun result(v: Any?) { when { v == null -> emit("null", "null"); v is Number || v is String || v is Boolean -> emit("scalar", v.toString()); else -> emit("object", v.javaClass.simpleName, UUID.randomUUID().toString()) } }
private object Worker
