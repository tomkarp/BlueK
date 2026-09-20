plugins {
    kotlin("multiplatform") version "2.2.21"
}

group = "de.tomkarp.bluek"
version = "0.1.0"

kotlin {
    js(IR) {
        browser()
        binaries.executable()
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation("io.github.sunny-chung:kotlite-interpreter:1.1.2")
                implementation("io.github.sunny-chung:kotlite-stdlib:1.1.0")
            }
        }
    }
}

tasks.matching { it.name == "jsBrowserProductionWebpack" }.configureEach {
    doLast {
        copy {
            from(layout.buildDirectory.dir("kotlin-webpack/js/productionExecutable"))
            include("**/*.js")
            into(rootProject.projectDir.resolve("../frontend/public/kotlite"))
        }
    }
}
