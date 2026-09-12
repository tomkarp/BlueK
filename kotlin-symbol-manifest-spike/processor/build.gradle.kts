plugins {
    kotlin("jvm")
}

dependencies {
    implementation("com.google.devtools.ksp:symbol-processing-api:2.2.21-2.0.4")
}

kotlin {
    jvmToolchain(21)
}
