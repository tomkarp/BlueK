import type { CompileResult, ProjectFile, RuntimeCommand, RuntimeSnapshot, RuntimeValue } from "../../runtime-contract/src/index";

export type CodepadClient = {
  getSnapshot(): RuntimeSnapshot;
  compile(files: ProjectFile[], revision: number): Promise<CompileResult>;
  execute(command: RuntimeCommand): Promise<RuntimeValue>;
};

export type CompileFlowResult = {
  ok: boolean;
  generationId: string;
  diagnostics: CompileResult["diagnostics"];
  error?: string;
};

export async function compileProject(
  client: CodepadClient,
  files: ProjectFile[],
  revision: number,
): Promise<CompileFlowResult> {
  try {
    const result = await client.compile(files, revision);
    return {
      ok: result.diagnostics.length === 0,
      generationId: result.generationId,
      diagnostics: result.diagnostics,
    };
  } catch (reason) {
    return {
      ok: false,
      generationId: "",
      diagnostics: [],
      error: reason instanceof Error ? reason.message : String(reason),
    };
  }
}

export type CodepadFlowResult =
  | { kind: "compile-error"; compile: CompileFlowResult }
  | { kind: "stale"; generationId: string }
  | { kind: "response"; generationId: string; response: RuntimeValue }
  | { kind: "error"; generationId: string; error: string };

export async function executeCodepad(
  client: CodepadClient,
  files: ProjectFile[],
  revision: number,
  code: string,
): Promise<CodepadFlowResult> {
  let generationId = client.getSnapshot().generationId;
  if (client.getSnapshot().phase === "uncompiled") {
    const compile = await compileProject(client, files, revision);
    if (!compile.ok) return { kind: "compile-error", compile };
    generationId = compile.generationId;
  }
  try {
    const response = await client.execute({ op: "eval", code });
    if (client.getSnapshot().generationId !== generationId)
      return { kind: "stale", generationId };
    return { kind: "response", generationId, response };
  } catch (reason) {
    if (client.getSnapshot().generationId !== generationId)
      return { kind: "stale", generationId };
    return {
      kind: "error",
      generationId,
      error: reason instanceof Error ? reason.message : String(reason),
    };
  }
}
