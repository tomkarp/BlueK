# Tests and saved state

BlueK supports a reduced JetBrains **`kotlin.test`** API. Testing is currently
in **alpha**. Test classes and generated setup code are ordinary Kotlin and
can run outside BlueK with `kotlin-test-junit5` and JUnit Jupiter, including
in IntelliJ. BlueK itself runs them in its browser interpreter, without a JVM.

## Example

`Dog.kt`:

```kotlin
class Dog {
    var age = 0
    fun birthday() { age++ }
}
```

`DogTest.kt`:

```kotlin
import kotlin.test.*

class DogTest {
    val dog: Dog = Dog()

    @Test
    fun `birthday increases age`() {
        dog.birthday()
        assertEquals(1, dog.age)
    }
}
```

Outside BlueK, put production code in `src/main/kotlin`, tests in
`src/test/kotlin`. The portability check uses this `build.gradle.kts`:

```kotlin
plugins { kotlin("jvm") version "2.2.21" }
repositories { mavenCentral() }
dependencies {
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:6.0.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:6.0.0")
}
tasks.test { useJUnitPlatform() }
```

## Creating and running tests

Right-click a class → **Create Test Class**. Its green card sits 30 pixels above
and to the right, behind the production class, and moves with it.
**New File → Test Class** creates a free test class. Both kinds support the same
testing/state features; attachment affects the diagram only.

Write `@Test` methods in the editor or choose **Record Test…**.
The Tests window includes classes without test methods, so their first test
can be recorded there. **Run All Tests**, a test card's **Run Tests**, or an
individual test starts a fresh compile and clears previous interactive objects.
Results distinguish passed, failed and ignored tests, show details and source
navigation, and allow individual reruns. **Stop** also ends input waits and
endless loops; remaining tests are aborted.

## Supported API

| Annotation | Meaning |
| --- | --- |
| `@Test` | Public parameterless instance method returning Unit |
| `@BeforeTest` | Runs before each test on its fresh test-class instance |
| `@AfterTest` | Runs after setup has begun, including setup/test failure; additional errors are reported |
| `@Ignore` | Skips a test method or whole class |

At most one BeforeTest and AfterTest per class. A constructor failure does not
start teardown. Test classes must be ordinary top-level classes without
inheritance/type parameters and with a parameterless constructor. Methods
have a block body or explicitly declare Unit. Nested/parameterized tests,
extensions, BeforeAll/AfterAll and other framework annotations are unsupported.
Annotations accept explicit/wildcard imports, aliases and qualified names.
Top-level state is shared within a run and reloaded between runs.
Backtick method names may contain spaces; JVM-invalid characters are rejected.

Assertions (all messages optional):

```kotlin
assertEquals<T>(expected: T, actual: T, message: String? = null)
assertNotEquals<T>(illegal: T, actual: T, message: String? = null)
assertTrue(actual: Boolean, message: String? = null)
assertFalse(actual: Boolean, message: String? = null)
assertNull(actual: Any?, message: String? = null)
assertNotNull<T>(actual: T?, message: String? = null): T
fail(message: String? = null): Nothing
```

Equality follows generic Kotlin semantics: NaN equals NaN; positive and negative
zero differ. The supported assertion contracts participate in smart casts.
Lambda/tolerance overloads, `assertContentEquals`, `assertFailsWith` and custom
asserters are unavailable. Assertion failures and other exceptions are reported
separately; subsequent tests continue.

## Saved state

Three icon-only buttons at the right of the status line beneath the object
bench provide **Save state**, **Load state** and **Choose default test class**.
The first save asks for a class name, suggesting **StateTest**, then previews
editable Kotlin before **Save & Compile**. The chosen class becomes the
project's default and survives autosave, JSON import/export and project links.
Any test class can be selected, even without Test methods.

**Save State from Object Bench** turns constructors, method calls, explicit
property reads, assignments and supported codepad statements into properties
and setup code. Fields are `val`; no `lateinit` or marker comments are needed.
Simple preparation uses field initializers plus BeforeTest. Interleaved
construction/actions or returned objects use assignments in `init` to retain
chronological order. Preview uses the normal embedded Kotlin editor, including
highlighting, formatting, comments and editor settings.

Saving to an existing class replaces **all class properties and all BeforeTest
methods**, plus any `init` blocks. A warning explains what will be replaced;
there is no warning if none exist. Other methods, including Test methods,
remain. Saving recompiles and clears the bench without opening the editor or
Tests window.

Automatic inspector getter evaluations are excluded. Explicit getter calls
remain. Automatically named results are local variables only if later steps
need them. Objects removed from the bench are not fields: retain a local binding
only if later preparation needs it; otherwise keep just the constructor's
execution, preserving its effects.

**Load State to Object Bench** recompiles, creates the chosen test instance,
runs setup and binds initialized stored fields to the bench. Identity and shared
references survive. Computed properties do not run merely to transfer state.
Loading works after page reload without a manual Compile, and opens neither
the Tests window nor editor. You can then modify the objects and save again.
Manually edited setup code can also be loaded.

Project links may select **Load state**, optionally together with **Open README**.
They load the default class after importing. A regular JSON import or autosave
restore waits for your Load state action. Errors use the ordinary error dialog.

### Limits of saved state

This is **replay of preparation**, not arbitrary graph serialization. Private
changes made through recorded methods are retained when replay is deterministic.
Randomness, time, input and external effects may differ. BluePlay simulation
steps and `main` execution cannot be saved this way.

After a failed runtime call, partial effects can remain; BlueK requires reset
and fresh preparation. Reused names, internal handles and non-reconstructible
bindings are rejected with an explanation. Codepad reference reassignment and
locals shadowing state fields cannot be reproduced as unchanged val fields.
Primitive bench fields (numbers, Boolean, Char) are excluded; String references
are supported. The editable preview is checked by the ordinary compiler path.

## Recording a test

**Record Test…** first loads the class's state onto the bench, then records
constructors, method calls, assignments and codepad steps. A method result's
**Add Assertion** can check equality, null or non-null. Suggested scalar
expectations are editable Kotlin expressions; each result is evaluated once
and retained locally when needed.

**Finish Recording…** previews and adds a Test method.
**Cancel Recording** discards assertion drafts but leaves object changes made
while recording. Editing source or recompiling ends the recording.

Interaction is inspired by the [BlueJ testing tutorial](https://www.bluej.org/tutorial/testing-tutorial.pdf),
with Kotlin annotations and an additional source preview.
Implementation contracts and verification commands:
[testing internals](testing-internals.md).
