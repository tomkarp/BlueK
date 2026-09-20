plugins {
    kotlin("multiplatform") version "2.2.21"
}

group = "io.github.sunny-chung"
version = "1.1.2-bluek.1"

kotlin {
    js(IR) {
        browser()
        nodejs()
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation("co.touchlab:kermit:1.0.0")
            }
        }
    }
}
