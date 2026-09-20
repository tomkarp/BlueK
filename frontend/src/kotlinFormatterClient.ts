import { format as formatMain, init as initMain } from "@scalar/kotlin-fmt";
import artifactUrl from "@scalar/kotlin-fmt/wasm?url";

let mainReady: Promise<void> | undefined;

async function initializeMainFormatter() {
  const bytes = new Uint8Array(await (await fetch(artifactUrl)).arrayBuffer());
  const isWasm = bytes[0] === 0 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d;
  const browserInit = initMain as unknown as (options: {
    bytes?: ArrayBufferView;
    url?: string | URL;
    encoding: "none" | "brotli";
  }) => Promise<void>;
  await browserInit(isWasm
    ? { bytes, encoding: "none" }
    : { url: artifactUrl, encoding: "brotli" });
}

function formatMainThread(source: string) {
  mainReady ??= initializeMainFormatter();
  return mainReady.then(() => formatMain(source, {
    style: "kotlinlang",
    removeUnusedImports: false,
    preserveLambdaBreaks: true,
  }));
}

export class KotlinFormatterClient {
  format(source: string): Promise<string> {
    return formatMainThread(source);
  }

  dispose() {
    // The formatter is page-local and has no worker to terminate.
  }
}
