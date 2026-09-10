package de.tomkarp.bluek.spike

import kotlin.js.JsExport

open class Person(var name: String) {
    open fun greeting(): String = "Hello, $name!"
}

class Student(name: String) : Person(name) {
    override fun greeting(): String = "Student: ${super.greeting()}"
}

class Box<T>(var value: T)

@JsExport
class IdentityRuntime {
    private val objects = mutableMapOf<String, Any>()

    fun createPerson(id: String, name: String): Person = Student(name).also { objects[id] = it }

    fun rename(id: String, name: String): String {
        val person = objects[id] as? Person ?: error("unknown object: $id")
        person.name = name
        return person.greeting()
    }

    fun sameObject(id: String, other: Person): Boolean = objects[id] === other

    fun isStudent(id: String): Boolean = objects[id] is Student

    fun stringBox(value: String): Box<String> = Box(value)
}
