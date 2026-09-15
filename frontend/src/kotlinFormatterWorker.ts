import { format, init, ktfmtVersion } from "@scalar/kotlin-fmt";

type FormatRequest = { id: number; source: string };
type FormatResponse =
  | { id: number; formatted: string; ktfmtVersion: string }
  | { id: number; error: string };

let ready: Promise<void> | undefined;

self.onmessage = (event: MessageEvent<FormatRequest>) => {
  const { id, source } = event.data;
  ready ??= init();
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
