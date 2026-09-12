package de.tomkarp.bluek.jsample

interface Named {
    val name: String
}

open class Person(
    override val name: String,
) : Named {
    var age: Int = 0

    fun greet(text: String): String = "$text, $name"
}

data class Student(
    override val name: String,
    val id: Int,
) : Person(name)
