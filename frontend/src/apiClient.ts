import { standardResources } from "./standardImages";
import type { SavedProject } from "./projectFormat";
import type { MessageKey } from "./i18n/catalog";
export const maxProjectBytes = 1024 * 1024;
export class ApiError extends Error {
  constructor(
    readonly reason: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(reason);
  }
}
export function apiUrl(path: string): string {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    window.location.hostname,
  );
  return new URL(
    path,
    import.meta.env.VITE_BLUEK_API_URL ||
      (local ? window.location.origin : "https://api.bluek.online"),
  ).href;
}
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-bluek-request": "1",
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError("network");
  }
  const data = await response.json().catch(() => {
    throw new ApiError("network");
  });
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new ApiError("network");
  if (!response.ok)
    throw new ApiError(data.error || "server", {
      ...data,
      status: response.status,
    });
  return data as T;
}
export function serverProjectSize(project: unknown): number {
  return new TextEncoder().encode(JSON.stringify(project)).byteLength;
}
const standardMedia = new Map(
  standardResources.map((item) => [item.path, item.data]),
);
export function checkServerProject(
  project: SavedProject,
  publishing = false,
): void {
  if (serverProjectSize(project) > maxProjectBytes)
    throw new ApiError("too-large");
  const custom = publishing
    ? project.resources?.filter(
        (item) =>
          project.library?.id !== "blueplay" ||
          standardMedia.get(item.path) !== item.data,
      )
    : [];
  if (custom?.length)
    throw new ApiError("custom-media", {
      resources: custom.map((item) => item.path),
    });
}
export function publicationProject(project: SavedProject): SavedProject {
  checkServerProject(project, true);
  return project.resources?.length ? { ...project, resources: [] } : project;
}
const errors: Record<string, MessageKey> = {
  network: "ui.cloud.network",
  server: "ui.cloud.network",
  busy: "ui.cloud.busy",
  "too-large": "ui.cloud.tooLarge",
  "custom-media": "ui.cloud.customMedia",
  authentication: "ui.cloud.authentication",
  "account-blocked": "ui.cloud.accountBlocked",
  "credentials-format": "ui.cloud.credentialsFormat",
  "username-taken": "ui.cloud.usernameTaken",
  "current-password": "ui.cloud.currentPasswordIncorrect",
  "login-failed": "ui.cloud.loginFailed",
  "login-wait": "ui.cloud.loginWait",
  conflict: "ui.cloud.conflict",
  "private-missing": "ui.cloud.privateMissing",
  "private-name": "ui.cloud.privateName",
  "publication-blocked": "ui.cloud.publicationBlocked",
  expired: "ui.cloud.expired",
};
export function apiErrorText(
  error: unknown,
  t: (key: MessageKey, values?: (string | number)[]) => string,
): string {
  if (!(error instanceof ApiError))
    return error instanceof Error ? error.message : String(error);
  const key = errors[error.reason] || "ui.cloud.invalid";
  const values =
    error.reason === "custom-media"
      ? [
          (Array.isArray(error.details.resources)
            ? error.details.resources
            : []
          ).join(", "),
        ]
      : error.reason === "login-wait"
        ? [Number(error.details.retryAfter || 1)]
        : [];
  return t(key, values);
}
