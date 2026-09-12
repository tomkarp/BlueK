import org.gradle.api.file.DuplicatesStrategy

plugins {
    kotlin("multiplatform") version "2.2.21"
    id("com.google.devtools.ksp") version "2.2.21-2.0.4"
}

val bluekProjectDir = providers.gradleProperty("bluekProjectDir").map { file(it) }
val bluekBridgeDir = providers.gradleProperty("bluekBridgeDir").map { file(it) }

kotlin {
    js(IR) {
        browser()
        compilerOptions {
            freeCompilerArgs.add("-main")
            freeCompilerArgs.add("noCall")
        }
        binaries.library()
    }

    sourceSets {
        val commonMain by getting {
            kotlin.srcDir(bluekProjectDir)
            kotlin.srcDir(bluekBridgeDir)
        }
    }
}

dependencies {
    add("kspJs", project(":manifest-processor"))
}

tasks.matching { it.name == "jsBrowserProductionLibraryDistribution" }.configureEach {
    outputs.upToDateWhen { false }
}
