class Counter(var value: Int = 0) {
    fun increment() { value++ }
    fun add(amount: Int) { value += amount }
    fun current(): Int = value
}
