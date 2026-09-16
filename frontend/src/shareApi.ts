import type { SavedProject } from "./projectFormat";

type ShareResponse = { code: string; expiresAt: string };

function apiUrl(path: string) {
  return new URL(path, window.location.origin).toString();
}

export async function saveProjectToServer(project: SavedProject): Promise<ShareResponse> {
  const response = await fetch(apiUrl("/api/projects"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(project),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Project could not be saved on the server.");
  return body as ShareResponse;
}

export async function loadProjectFromServer(code: string): Promise<SavedProject> {
  const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(code)}`), { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Project could not be loaded from the server.");
  return body.project as SavedProject;
}
