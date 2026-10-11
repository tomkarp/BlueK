import type { SavedProject } from "./projectFormat";
import { parseExportedProgram, type ExportedProgram } from "./programExport";

type ShareResponse = { code: string; expiresAt: string };

function apiUrl(path: string) {
  return new URL(path, window.location.origin).toString();
}

export async function saveProjectToServer(
  project: SavedProject,
): Promise<ShareResponse> {
  const response = await fetch(apiUrl("/api/projects"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(project),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error || "Project could not be saved on the server.");
  return body as ShareResponse;
}

/** Why the share service cannot open a code; the client words each reason. */
export type ShareCodeProblem = "invalid" | "missing" | "blocked" | "project";

export class ShareCodeError extends Error {
  constructor(
    readonly problem: ShareCodeProblem,
    message: string,
  ) {
    super(message);
  }
}

const problems: Record<number, ShareCodeProblem> = {
  400: "invalid",
  403: "blocked",
  404: "missing",
  409: "project",
};

async function loadShared(
  kind: "projects" | "programs",
  code: string,
): Promise<Record<string, unknown>> {
  const failed =
    kind === "programs"
      ? "Program could not be loaded from the server."
      : "Project could not be loaded from the server.";
  const response = await fetch(
    apiUrl(`/api/${kind}/${encodeURIComponent(code)}`),
    { cache: "no-store" },
  ).catch(() => {
    throw new Error(failed);
  });
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body;
  // Server texts are English fallbacks; known reasons use translatable texts.
  const problem = problems[response.status];
  if (!problem) throw new Error(body.error || failed);
  throw new ShareCodeError(
    problem,
    {
      invalid: "This link does not contain a valid three-word code.",
      missing:
        kind === "programs"
          ? "Program not found or expired."
          : "Project not found or expired.",
      blocked: "This program does not allow opening in BlueK.",
      project:
        "This code belongs to an editable BlueK project, not to a runnable program.",
    }[problem],
  );
}

/** /bluek/<code> opens a saved project or, if allowed, a runnable export's project. */
export async function loadEditableProjectFromServer(
  code: string,
): Promise<SavedProject> {
  return (await loadShared("projects", code)).project as SavedProject;
}

export async function saveProgramToServer(
  program: ExportedProgram,
): Promise<ShareResponse> {
  const response = await fetch(apiUrl("/api/programs"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(program),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error || "Program could not be saved on the server.");
  return body as ShareResponse;
}

export async function loadProgramFromServer(
  code: string,
): Promise<ExportedProgram> {
  return parseExportedProgram((await loadShared("programs", code)).program);
}
