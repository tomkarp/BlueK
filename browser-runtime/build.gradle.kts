import org.gradle.api.file.DuplicatesStrategy

plugins {
    kotlin("multiplatform") version "2.2.21"
}

val bluekProjectDir = providers.gradleProperty("bluekProjectDir").map { file(it) }
val bluekBridgeDir = providers.gradleProperty("bluekBridgeDir").map { file(it) }

kotlin {
    js(IR) {
        browser()
        binaries.library()
    }

    sourceSets {
        val commonMain by getting {
            kotlin.srcDir(bluekProjectDir)
            kotlin.srcDir(bluekBridgeDir)
        }
    }
}

tasks.matching { it.name == "jsBrowserProductionLibraryDistribution" }.configureEach {
    outputs.upToDateWhen { false }
}
