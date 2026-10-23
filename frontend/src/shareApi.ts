import type { SavedProject } from "./projectFormat";
import { parseExportedProgram, type ExportedProgram } from "./programExport";
import { apiRequest, ApiError, publicationProject } from "./apiClient";
type ShareResponse = { code: string; expiresAt: string };
async function publish(path: string, payload: unknown): Promise<ShareResponse> {
  const receipt = await apiRequest<ShareResponse>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (
    typeof receipt.code !== "string" ||
    !/^(?:[a-z0-9]{12}|(?:[a-z]{4,6}-){2,3}[a-z]{4,6})$/.test(receipt.code) ||
    typeof receipt.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(receipt.expiresAt))
  )
    throw new ApiError("network");
  return receipt;
}

export async function saveProjectToServer(
  project: SavedProject,
): Promise<ShareResponse> {
  return publish("/api/projects", publicationProject(project));
}
export type ShareCodeProblem =
  "invalid" | "missing" | "expired" | "blocked" | "moderated" | "project";
export class ShareCodeError extends Error {
  constructor(
    readonly problem: ShareCodeProblem,
    message: string,
  ) {
    super(message);
  }
}
async function loadShared(
  kind: "projects" | "programs",
  code: string,
): Promise<Record<string, unknown>> {
  try {
    return await apiRequest(`/api/${kind}/${encodeURIComponent(code)}`);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const problems: Record<string, [ShareCodeProblem, string]> = {
      "invalid-code": [
        "invalid",
        "This link does not contain a valid project code.",
      ],
      missing: ["missing", "Publication not found."],
      expired: ["expired", "This publication has expired."],
      "publication-blocked": [
        "moderated",
        "This publication was blocked by the operator.",
      ],
      "developer-disabled": [
        "blocked",
        "This program does not allow opening in BlueK.",
      ],
      project: [
        "project",
        "This code belongs to an editable BlueK project, not to a runnable program.",
      ],
    };
    const legacyProblems: Record<number, [ShareCodeProblem, string]> = {
      400: ["invalid", "This link does not contain a valid project code."],
      403: ["blocked", "This program does not allow opening in BlueK."],
      404: [
        "missing",
        kind === "programs"
          ? "Program not found or expired."
          : "Project not found or expired.",
      ],
      409: [
        "project",
        "This code belongs to an editable BlueK project, not to a runnable program.",
      ],
    };
    const problem =
      problems[error.reason] || legacyProblems[Number(error.details.status)];
    if (problem) throw new ShareCodeError(...problem);
    throw error;
  }
}
export async function loadEditableProjectFromServer(
  code: string,
): Promise<SavedProject> {
  return (await loadShared("projects", code)).project as SavedProject;
}
export async function saveProgramToServer(
  program: ExportedProgram,
): Promise<ShareResponse> {
  const project = publicationProject(program.project);
  return publish("/api/programs", { ...program, project });
}
export async function loadProgramFromServer(
  code: string,
): Promise<ExportedProgram> {
  return parseExportedProgram((await loadShared("programs", code)).program);
}
