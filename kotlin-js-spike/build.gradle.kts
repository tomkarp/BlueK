plugins {
    kotlin("multiplatform") version "2.2.21"
}

kotlin {
    js(IR) {
        browser {
            webpackTask {
                output.library = "BlueKProject"
                output.libraryTarget = "commonjs2"
            }
        }
        binaries.library()
    }

    sourceSets {
        val commonMain by getting
        val jsMain by getting
    }
}
