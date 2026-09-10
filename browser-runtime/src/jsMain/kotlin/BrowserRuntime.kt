package de.tomkarp.bluek.browser

import kotlin.js.JsExport
import kotlin.js.ExperimentalJsExport

/** Minimal runtime marker. The generated project bridge owns the actual object registry. */
@OptIn(ExperimentalJsExport::class)
@JsExport
fun bluekRuntimeVersion(): String = "bluek-js-1"
