import { createLocalRuntimeWorker } from "./localRuntimeWorkerFactory";
import type { ManifestProperty, ProjectFile, SymbolManifest } from "../../runtime-contract/src/index";

export type FileClassification = { kind: "class" | "functions" | "mixed" | "unknown"; className?: string; classNameFrom?: number };
export type ClassReferenceEdit = { fileName: string; from: number; to: number };
export type CompletionAnalysis = {
  kind: "member" | "constructor" | "implicitMember" | "topLevel";
  prefix: string;
  from: number;
  to: number;
  className: string;
  type: string;
  accessibleProperties?: string[];
  accessibleMethods?: string[];
  topLevelProperties?: ManifestProperty[];
  manifest: SymbolManifest;
};

/** Syntax analysis uses Kotlite in a separate worker and never changes runtime state. */
export class ProjectSourceAnalysis {
  private worker = createLocalRuntimeWorker();
  private nextId = 1;
  private pending = new Map<number, { kind: "classify"; resolve: (value: FileClassification[]) => void; reject: (error: Error) => void } | { kind: "references"; resolve: (value: ClassReferenceEdit[]) => void; reject: (error: Error) => void } | { kind: "completion"; resolve: (value: CompletionAnalysis | null) => void; reject: (error: Error) => void }>();
  constructor() {
    this.worker.onmessage = event => {
      const pending = this.pending.get(event.data.id);
      if (!pending) return;
      this.pending.delete(event.data.id);
      if (event.data.transportError) pending.reject(new Error(event.data.transportError));
      else if (pending.kind === "classify") pending.resolve(event.data.files);
      else if (pending.kind === "completion") pending.resolve(event.data.completion?.kind === "unresolved" ? null : event.data.completion);
      else if (event.data.error) pending.reject(new Error(event.data.error));
      else pending.resolve(event.data.references);
    };
    this.worker.onerror = event => {
      for (const pending of this.pending.values()) pending.reject(new Error(event.message));
      this.pending.clear();
    };
  }
  classify(files: readonly ProjectFile[]): Promise<FileClassification[]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { kind: "classify", resolve, reject });
      this.worker.postMessage({ id, op: "classifyFiles", files: files.map(({ fileName, source }) => ({ fileName, source })) });
    });
  }
  classReferences(files: readonly ProjectFile[], className: string, withBluePlay: boolean): Promise<ClassReferenceEdit[]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { kind: "references", resolve, reject });
      this.worker.postMessage({ id, op: "classReferences", files: files.map(({ fileName, source }) => ({ fileName, source })), className, withBluePlay });
    });
  }
  completion(files: readonly ProjectFile[], activeFile: string, cursor: number, withBluePlay: boolean): Promise<CompletionAnalysis | null> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { kind: "completion", resolve, reject });
      this.worker.postMessage({ id, op: "completionQuery", files: files.map(({ fileName, source }) => ({ fileName, source })), activeFile, cursor, withBluePlay });
    });
  }
  close() {
    this.worker.terminate();
    for (const pending of this.pending.values()) pending.reject(new Error("Source analysis closed."));
    this.pending.clear();
  }
}
