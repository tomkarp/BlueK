class Person(var name: String) {
    fun greet(): String = "Hello, $name!"
    fun rename(newName: String) { name = newName }
}
