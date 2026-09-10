import org.gradle.api.file.DuplicatesStrategy

plugins {
    kotlin("jvm") version "2.2.21"
    application
}
group = "de.tomkarp.bluek"
version = "0.1.0"
kotlin { jvmToolchain(21) }
application { mainClass.set("de.tomkarp.bluek.WorkerKt") }

tasks.jar {
    manifest { attributes["Main-Class"] = "de.tomkarp.bluek.WorkerKt" }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    from(configurations.runtimeClasspath.get().map { if (it.isDirectory) it else zipTree(it) })
}
