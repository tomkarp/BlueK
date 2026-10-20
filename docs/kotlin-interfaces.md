# Interface behavior and BlueJ onboarding compatibility

The reference compiler for this comparison is Kotlin/JVM 2.2.21 on
Temurin/OpenJDK 21+35-LTS. BlueK uses the vendored Kotlite 1.1.2-bluek.1,
binary stdlib 1.1.0 and Kotlin/JS 2.2.21. The fixtures in
`scripts/interface-cases.mjs` keep classes/interfaces and Main.kt separate.
`test:interfaces` runs analysis and execution through the checked-in browser
bundle; `test:interfaces:kotlin` compiles and runs the same source with kotlinc.

## Contracts

- A stable `x is B` guard retains both the declared type and the newly proven
  type, including when they are independent interfaces. Members and generic
  signatures of both remain available. Further guards can add bounds. Inferred
  local copies, captured stable values, nullable guards and `when` retain these
  facts. Assignment and scope exits still invalidate them.
- Inherited method declarations are compared after resolving their generic
  parameter types. A declaration overrides less-specific ancestors; a shared
  diamond does not create two implementations. Private superclass helpers are
  not inherited candidates; calls to them stay bound to their declaring class
  when a child or interface has a public method with the same name. Unrelated interface defaults,
  a default and an unrelated abstract interface declaration, or competing class
  and interface implementations require an explicit override. A concrete class
  method can implement an abstract interface method; a class's abstract method
  cannot be satisfied by an unrelated interface default.
- `super<ImmediateType>.method()` resolves an immediate class/interface supertype
  and calls its effective implementation directly. The actual object remains
  `this`, so virtual calls inside that implementation reach the actual object's
  overrides. Abstract targets, unrelated/indirect supertypes, nullable qualifiers
  and standalone `super<Type>` values are rejected. Matching redundant type
  arguments are accepted, as by Kotlin (which warns); mismatching ones fail.
  Existing interpreted call-depth and suspension handling applies, including
  calls from simple or escaping lambdas.

These are internal conjunctions used by flow analysis. They do not implement
all Kotlin intersection inference, reified type checks or JVM reflection.

## Teaching materials

The [BlueJ onboarding guide](https://www.bluej.org/doc/kotlin_bluej_onboarding_guide.pdf)
and [materials](https://www.bluej.org/doc/kotlin_bluej_onboarding_materials.zip)
were downloaded on 18 October 2026. The archive contains 38 independent projects
with 97 Kotlin files: 24 complete examples and 14 practice skeletons. Before
these changes, BlueK accepted 34 projects. Kotlin/JVM accepted all 38.

The advanced unit 8 project calls `item.reroute(...)` after checking a Trackable
parameter with `item is Reroutable`. This reproduced the missing interface-bound
smart cast. Page 45's conflict-resolution guidance independently reproduced
accepted ambiguous defaults and rejected `super<Interface>` calls. These are
language issues, independent of BlueJ's project format.

The remaining excluded projects use Swing/AWT/anonymous JPanel expressions
(unit1/demoAdvanced) or `javaClass.simpleName` (both unit7 demos). Those JVM
APIs remain outside BlueK's supported area. All eight onboardingExamples
projects already worked before these changes.

Importing the complete materials ZIP previously selected an arbitrary shallow
project. BlueK now lists independent project paths and opens only the selected
one, with its own files, README and resources. Nested packages inside an existing
project are not offered as independent projects. Single projects open directly.
The choice is also used for dropped directories. Cancel and Escape preserve the
current project and runtime. This is an importer improvement, not Kotlin syntax.

The supplied unit8/demoBasic README describes the six-file advanced version,
although its actual basic sources define only Trackable, Package and Flight.
Those mismatching README instructions also do not work against the JVM basic
project; they are not a BlueK incompatibility.

Detailed dated verification is recorded under RT-120/121/122 and GUI-147 in the
[regression checklist](regression-checklist.md).
