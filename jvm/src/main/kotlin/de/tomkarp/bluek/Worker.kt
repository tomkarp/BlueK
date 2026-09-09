package de.tomkarp.bluek

import java.io.File
import java.net.URLClassLoader
import java.util.UUID

private class Ctx(private val objects: MutableMap<String, Any>) : RuntimeContext {
    override fun objectById(id: String): Any? = objects[id]
}

private lateinit var controlOut: java.io.PrintStream
private val activeRequestId = ThreadLocal.withInitial { "" }
private fun emit(kind: String, display: String, id: String? = null, output: String = "") {
    val extra = id?.let { ",\"objectId\":\"$it\"" } ?: ""
    val out = if (output.isEmpty()) "" else ",\"output\":\"${output.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")}\""
    val request = if (activeRequestId.get().isEmpty()) "" else ",\"requestId\":\"${activeRequestId.get()}\""
    controlOut.println("{\"kind\":\"$kind\",\"display\":\"${display.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")}\"$extra$out$request}")
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
                line.contains("\"op\":\"load\"") -> {
                    projectPath = value(line, "path")
                    loader = URLClassLoader(arrayOf(File(projectPath).toURI().toURL()), Worker::class.java.classLoader)
                    objects.clear(); names.clear(); bindingTypes.clear(); emit("unit", "loaded")
                }
                line.contains("\"op\":\"create\"") -> {
                    val className = value(line, "className")
                    val args = argumentValues(line).map(::parse)
                    val ctor = Class.forName(className, true, loader).declaredConstructors.first { it.parameterCount == args.size }
                    val created = withUserOutput { ctor.newInstance(*args.toTypedArray()) }; val id = UUID.randomUUID().toString()
                    objects[id] = created.value; value(line, "name").takeIf { it.isNotEmpty() }?.let { name -> names[name] = id; val typeArgs = argumentValues(line, "typeArguments"); bindingTypes[name] = if (typeArgs.isEmpty()) className else "$className<${typeArgs.joinToString(", ")}>" }
                    emit("object", created.value.javaClass.simpleName, id, created.output)
                }
                line.contains("\"op\":\"invoke\"") -> {
                    val objectId = value(line, "objectId"); val objectName = names.entries.firstOrNull { it.value == objectId }?.key ?: error("Object is not named on the bench")
                    val methodName = value(line, "name"); val args = argumentValues(line).joinToString(", "); val bindings = names.entries.joinToString("\n") { "val ${it.key} = ctx.objectById(\"${it.value}\") as ${bindingTypes[it.key] ?: objects[it.value]!!.javaClass.name}" }
                    val dir = createTempDir(prefix = "bluek-invoke-"); val src = File(dir, "Snippet.kt")
                    src.writeText("import de.tomkarp.bluek.RuntimeContext\nclass Snippet { fun execute(ctx: RuntimeContext): Any? = run { $bindings\nreturn@run $objectName.$methodName($args) } }")
                    val jar = File(dir, "snippet.jar"); val compiler = ProcessBuilder("kotlinc", src.absolutePath, "-classpath", "${projectPath}:${File(Worker::class.java.protectionDomain.codeSource.location.toURI())}", "-d", jar.absolutePath).redirectErrorStream(true).start()
                    if (compiler.waitFor() != 0) { emit("error", compiler.inputStream.bufferedReader().readText()); return }
                    val child = URLClassLoader(arrayOf(jar.toURI().toURL()), loader); val snippet = child.loadClass("Snippet").getDeclaredConstructor().newInstance()
                    val invoked = withUserOutput { snippet.javaClass.getMethod("execute", RuntimeContext::class.java).invoke(snippet, ctx) }
                    result(invoked.value, invoked.output)
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
                    val evaluated = withUserOutput { snippet.javaClass.getMethod("execute", RuntimeContext::class.java).invoke(snippet, ctx) }
                    result(evaluated.value, evaluated.output)
                }
                else -> emit("error", "Unsupported worker operation")
            }
        } catch (e: Throwable) { emit("error", e.cause?.message ?: e.message ?: "runtime error") } finally { activeRequestId.remove() }
    }
    controlIn.bufferedReader().forEachLine { line ->
        if (line.contains("\"op\":\"input\"")) process(line)
        else Thread { synchronized(actionLock) { process(line) } }.start()
    }
}

private fun decodeJsonString(raw: String): String { val result = StringBuilder(); var escaped = false; for (char in raw) { if (escaped) { result.append(when (char) { 'n' -> '\n'; 'r' -> '\r'; 't' -> '\t'; else -> char }); escaped = false } else if (char == '\\') escaped = true else result.append(char) }; if (escaped) result.append('\\'); return result.toString() }
private fun value(line: String, key: String): String = Regex("\\\"$key\\\":\\\"((?:\\\\.|[^\"])*)\\\"").find(line)?.groupValues?.get(1)?.let(::decodeJsonString) ?: ""
private fun argumentValues(line: String, key: String = "args"): List<String> { val encoded = value(line, key).trim(); if (!encoded.startsWith("[")) return encoded.split('|').filter(String::isNotEmpty); val body = encoded.removePrefix("[").removeSuffix("]"); val values = mutableListOf<String>(); Regex("\"((?:\\\\.|[^\"\\\\])*)\"").findAll(body).forEach { values.add(decodeJsonString(it.groupValues[1])) }; while (values.lastOrNull() == "") values.removeLast(); return values }
private fun parse(s: String): Any? = when { s == "null" -> null; s.toIntOrNull() != null -> s.toInt(); s.toLongOrNull() != null -> s.toLong(); s == "true" || s == "false" -> s.toBoolean(); else -> s.removePrefix("\"").removeSuffix("\"") }
private fun result(v: Any?, output: String = "") { when { v == null -> emit("null", "null", output = output); v === Unit -> emit("unit", "Unit", output = output); v is Number || v is String || v is Boolean -> emit("scalar", v.toString(), output = output); else -> emit("object", v.javaClass.simpleName, UUID.randomUUID().toString(), output) } }
private data class Captured<T>(val value: T, val output: String)
private fun <T> withUserOutput(block: () -> T): Captured<T> {
    val previous = System.out
    val buffer = java.io.ByteArrayOutputStream()
    return try { System.setOut(java.io.PrintStream(buffer, true, Charsets.UTF_8)); Captured(block(), buffer.toString(Charsets.UTF_8)) }
    finally { System.setOut(previous) }
}
private object Worker
