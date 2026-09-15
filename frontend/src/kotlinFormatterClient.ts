type FormatResponse =
  | { id: number; formatted: string; ktfmtVersion: string }
  | { id: number; error: string };

type Pending = {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
};

export class KotlinFormatterClient {
  private readonly worker: Worker;
  private nextId = 0;
  private pending = new Map<number, Pending>();

  constructor() {
    this.worker = new Worker(
      new URL("./kotlinFormatterWorker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (event: MessageEvent<FormatResponse>) => {
      const response = event.data;
      const request = this.pending.get(response.id);
      if (!request) return;
      this.pending.delete(response.id);
      if ("error" in response) request.reject(new Error(response.error));
      else request.resolve(response.formatted);
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || "Kotlin-Formatierung fehlgeschlagen.");
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    };
  }

  format(source: string): Promise<string> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, source });
    });
  }

  dispose() {
    this.worker.terminate();
    const error = new Error("Kotlin-Formatierung abgebrochen.");
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }
}
