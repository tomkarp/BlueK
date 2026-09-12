plugins {
    kotlin("multiplatform")
    id("com.google.devtools.ksp")
}

kotlin {
    js(IR) {
        browser()
        binaries.library()
    }

    sourceSets {
        val commonMain by getting
    }
}

dependencies {
    add("kspJs", project(":processor"))
}
