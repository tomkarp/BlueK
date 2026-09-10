package de.tomkarp.bluek.spike

import kotlin.js.JsExport

@JsExport
fun createProbe(): IdentityRuntime = IdentityRuntime()

fun main() {
    val runtime = IdentityRuntime()
    val person = runtime.createPerson("p", "Ada")
    val result = listOf(
        runtime.rename("p", "Grace"),
        "same=${runtime.sameObject("p", person)}",
        "student=${runtime.isStudent("p")}",
        "box=${runtime.stringBox("ok").value}"
    ).joinToString(";")
    println(result)
}
