import { format, init, ktfmtVersion } from "@scalar/kotlin-fmt";
import artifactUrl from "@scalar/kotlin-fmt/wasm?url";

type FormatRequest = { id: number; source: string };
type FormatResponse =
  | { id: number; formatted: string; ktfmtVersion: string }
  | { id: number; error: string };

let ready: Promise<void> | undefined;

async function initializeFormatter() {
  const bytes = new Uint8Array(await (await fetch(artifactUrl)).arrayBuffer());
  const isWasm = bytes[0] === 0 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d;
  const browserInit = init as unknown as (options: {
    bytes: ArrayBufferView;
    encoding: "none" | "brotli";
  }) => Promise<void>;
  await browserInit({ bytes, encoding: isWasm ? "none" : "brotli" });
}

self.onmessage = (event: MessageEvent<FormatRequest>) => {
  const { id, source } = event.data;
  ready ??= initializeFormatter();
  ready
    .then(() => format(source, {
      style: "kotlinlang",
      removeUnusedImports: false,
      preserveLambdaBreaks: true,
    }))
    .then((formatted) => {
      self.postMessage({ id, formatted, ktfmtVersion } satisfies FormatResponse);
    })
    .catch((error: unknown) => {
      ready = undefined;
      self.postMessage({
        id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies FormatResponse);
    });
};
