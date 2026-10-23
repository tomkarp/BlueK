import {
  apiRequest,
  apiErrorText,
  ApiError,
  checkServerProject,
} from "../apiClient";
import type { SavedProject } from "../projectFormat";
import type { Language } from "../i18n/Language.svelte";
import { strToU8, zipSync } from "fflate";
type User = { id: string; username: string };
type CloudProject = {
  id: string;
  name: string;
  updatedAt: number;
  revision: number;
};
function safeFilename(value: string) {
  return (
    value
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/[. ]+$/g, "")
      .trim() || "BlueK-Projekt"
  );
}
function downloadFile(filename: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
interface CloudHost {
  language: () => Pick<Language, "t">;
  project: () => {
    projectPayload: () => SavedProject;
    projectName: string;
    loadProject: (
      payload: unknown,
      message?: string,
    ) => Promise<boolean | void>;
    ensureProjectName: () => boolean;
    readonly documentVersion: number;
    exportProject: () => void;
  };
}
/** Cloud state is separate from editor and runtime ownership. Session checks
 * never replace the local project/draft. */
export class CloudWorkspace {
  constructor(private readonly host: CloudHost) {}
  open = $state(false);
  private intent: "account" | "open" | "save" | "manage" = "account";
  busy = $state(false);
  sessionReady = $state(false);
  user: User | null = $state(null);
  projects: CloudProject[] = $state.raw([]);
  error = $state("");
  notice = $state("");
  private binding: {
    id: string;
    revision: number;
    documentVersion: number;
  } | null = $state(null);
  private refreshPromise: Promise<boolean> | null = null;
  get attached() {
    return (
      this.binding?.documentVersion === this.host.project().documentVersion
    );
  }
  get attachedProjectId() {
    return this.attached ? (this.binding?.id ?? null) : null;
  }
  get sizeBytes() {
    return new TextEncoder().encode(
      JSON.stringify(this.host.project().projectPayload()),
    ).byteLength;
  }
  private text = (
    key: import("../i18n/catalog").MessageKey,
    values?: (string | number)[],
  ) => this.host.language().t(key, values);
  private run = async (operation: () => Promise<void>) => {
    if (this.busy) return false;
    this.busy = true;
    this.error = "";
    this.notice = "";
    try {
      await operation();
      return true;
    } catch (error) {
      this.error = apiErrorText(error, this.text);
      if (
        error instanceof ApiError &&
        ["authentication", "account-blocked"].includes(error.reason)
      ) {
        this.user = null;
        this.projects = [];
        this.binding = null;
      }
      return false;
    } finally {
      this.busy = false;
    }
  };
  private list = async () => {
    this.projects = (
      await apiRequest<{ projects: CloudProject[] }>("/api/private-projects")
    ).projects;
  };
  refresh = (includeProjects = false): Promise<boolean> => {
    if (this.refreshPromise) {
      return this.refreshPromise.then(() => {
        if (!includeProjects || !this.user) return true;
        return this.run(async () => this.list());
      });
    }
    let pending: Promise<boolean>;
    pending = this.run(async () => {
      const { user } = await apiRequest<{ user: User | null }>("/api/account");
      if (this.user?.id !== user?.id) this.binding = null;
      this.user = user;
      this.projects = [];
      if (user && includeProjects) await this.list();
    }).finally(() => {
      this.sessionReady = true;
      if (this.refreshPromise === pending) this.refreshPromise = null;
    });
    this.refreshPromise = pending;
    return pending;
  };
  show = (intent: "account" | "open" | "save" | "manage" = "account") => {
    this.intent = intent;
    this.open = true;
    return this.refresh(
      intent === "account" || intent === "open" || intent === "manage",
    );
  };
  authenticate = (register: boolean, username: string, password: string) =>
    this.run(async () => {
      this.user = (
        await apiRequest<{ user: User }>(
          `/api/account/${register ? "register" : "login"}`,
          { method: "POST", body: JSON.stringify({ username, password }) },
        )
      ).user;
      this.binding = null;
      if (this.intent !== "account" && this.intent !== "manage")
        this.open = false;
      if (
        this.intent === "account" ||
        this.intent === "open" ||
        this.intent === "manage"
      )
        await this.list();
    });
  logout = () =>
    this.run(async () => {
      await apiRequest("/api/account/logout", { method: "POST" });
      this.user = null;
      this.projects = [];
      this.binding = null;
    });
  changePassword = (password: string, newPassword: string) =>
    this.run(async () => {
      await apiRequest("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ password, newPassword }),
      });
      this.notice = this.text("ui.cloud.passwordChanged");
    });
  changeUsername = (password: string, newUsername: string) =>
    this.run(async () => {
      const result = await apiRequest<{ user: User }>("/api/account/username", {
        method: "POST",
        body: JSON.stringify({ password, newUsername }),
      });
      this.user = result.user;
      this.notice = this.text("ui.cloud.usernameChanged");
    });
  save = (copy = false) =>
    this.run(async () => {
      const project = this.host.project();
      if (!project.ensureProjectName()) return;
      const payload = project.projectPayload();
      checkServerProject(payload);
      const documentVersion = project.documentVersion;
      const binding = !copy && this.attached ? this.binding : null;
      const result = await apiRequest<{ id: string; revision: number }>(
        `/api/private-projects${binding ? `/${binding.id}` : ""}`,
        {
          method: binding ? "PUT" : "POST",
          headers: binding ? { "if-match": String(binding.revision) } : {},
          body: JSON.stringify(payload),
        },
      );
      if (
        typeof result.id !== "string" ||
        !/^[a-f0-9-]{36}$/.test(result.id) ||
        !Number.isInteger(result.revision) ||
        result.revision < 1
      )
        throw new ApiError("network");
      if (documentVersion === project.documentVersion)
        this.binding = { ...result, documentVersion };
      this.notice = this.text("ui.cloud.saved");
      // A list outage after a confirmed save must not turn that save into a failure.
      try {
        await this.list();
      } catch {
        /* Refresh remains available. */
      }
    });
  rename = (id: string, value: string) =>
    this.run(async () => {
      const project = this.projects.find((item) => item.id === id);
      const name = value.trim();
      if (!project) throw new ApiError("private-missing");
      if (!name || name.length > 120) throw new ApiError("private-name");
      const result = await apiRequest<{
        id: string;
        name: string;
        updatedAt: number;
        revision: number;
      }>(`/api/private-projects/${id}`, {
        method: "PATCH",
        headers: { "if-match": String(project.revision) },
        body: JSON.stringify({ name }),
      });
      if (
        result.id !== id ||
        result.name !== name ||
        !Number.isFinite(result.updatedAt) ||
        !Number.isInteger(result.revision) ||
        result.revision !== project.revision + 1
      )
        throw new ApiError("network");
      this.projects = this.projects.map((item) =>
        item.id === id
          ? {
              ...item,
              name,
              updatedAt: result.updatedAt,
              revision: result.revision,
            }
          : item,
      );
      if (this.binding?.id === id) {
        this.binding = { ...this.binding, revision: result.revision };
        if (this.attached) this.host.project().projectName = name;
      }
    });
  duplicate = (id: string) =>
    this.run(async () => {
      const source = this.projects.find((item) => item.id === id);
      if (!source) throw new ApiError("private-missing");
      const { project } = await apiRequest<{ project: SavedProject }>(
        `/api/private-projects/${id}`,
      );
      checkServerProject(project);
      const suffix = this.text("ui.cloud.copySuffix");
      const baseName = (source.name || project.projectName || "BlueK-Projekt")
        .trim();
      const name = `${baseName.slice(0, 120 - suffix.length - 3)} (${suffix})`;
      const copy = { ...project, projectName: name };
      checkServerProject(copy);
      const result = await apiRequest<{ id: string; revision: number }>(
        "/api/private-projects",
        { method: "POST", body: JSON.stringify(copy) },
      );
      if (
        typeof result.id !== "string" ||
        !/^[a-f0-9-]{36}$/.test(result.id) ||
        result.id === id ||
        result.revision !== 1
      )
        throw new ApiError("network");
      this.projects = [
        {
          id: result.id,
          name,
          updatedAt: Date.now(),
          revision: result.revision,
        },
        ...this.projects,
      ];
    });
  load = (id: string) =>
    this.run(async () => {
      const project = this.host.project();
      const before = JSON.stringify(project.projectPayload());
      const documentVersion = project.documentVersion;
      const result = await apiRequest<{
        project: SavedProject;
        revision: number;
      }>(`/api/private-projects/${id}`);
      if (
        documentVersion !== project.documentVersion ||
        before !== JSON.stringify(project.projectPayload())
      )
        throw new ApiError("conflict");
      if (!(await project.loadProject(result.project))) return;
      this.binding = {
        id,
        revision: result.revision,
        documentVersion: project.documentVersion,
      };
      this.open = false;
    });
  remove = (id: string) => {
    if (!window.confirm(this.text("ui.cloud.deleteConfirm")))
      return Promise.resolve();
    return this.run(async () => {
      await apiRequest(`/api/private-projects/${id}`, { method: "DELETE" });
      if (this.binding?.id === id) this.binding = null;
      await this.list();
    });
  };
  removeMany = (ids: string[]) =>
    this.run(async () => {
      const selected = [...new Set(ids)].filter((id) =>
        this.projects.some((project) => project.id === id),
      );
      const removed: string[] = [];
      let failure: unknown;
      for (const id of selected) {
        try {
          await apiRequest(`/api/private-projects/${id}`, {
            method: "DELETE",
          });
          removed.push(id);
        } catch (error) {
          failure = error;
          break;
        }
      }
      if (this.binding && removed.includes(this.binding.id))
        this.binding = null;
      try {
        await this.list();
      } catch (error) {
        failure ??= error;
      }
      if (failure) throw failure;
      this.notice = this.text(
        removed.length === 1
          ? "ui.cloud.projectDeleted"
          : "ui.cloud.projectsDeleted",
        [removed.length],
      );
    });
  downloadProjectJSON = (id: string) =>
    this.run(async () => {
      const result = await apiRequest<{ project: SavedProject }>(
        `/api/private-projects/${id}`,
      );
      checkServerProject(result.project);
      const name = safeFilename(result.project.projectName || "BlueK-Projekt");
      downloadFile(
        `${name}.bluek.json`,
        JSON.stringify(result.project, null, 2),
        "application/json",
      );
      this.notice = this.text("ui.cloud.projectDownloaded");
    });
  downloadAllProjectsZip = () =>
    this.run(async () => {
      if (!this.projects.length) return;
      const files: Record<string, Uint8Array> = {};
      const usedNames = new Set<string>();
      for (const item of this.projects) {
        const result = await apiRequest<{ project: SavedProject }>(
          `/api/private-projects/${item.id}`,
        );
        checkServerProject(result.project);
        const base = safeFilename(item.name || "BlueK-Projekt");
        let filename = `${base}.bluek.json`;
        let suffix = 2;
        while (usedNames.has(filename.toLocaleLowerCase())) {
          filename = `${base} (${suffix++}).bluek.json`;
        }
        usedNames.add(filename.toLocaleLowerCase());
        files[filename] = strToU8(JSON.stringify(result.project, null, 2));
      }
      downloadFile("BlueK-Projekte.zip", zipSync(files), "application/zip");
      this.notice = this.text("ui.cloud.projectsDownloaded");
    });
}
