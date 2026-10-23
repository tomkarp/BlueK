import {
  apiRequest,
  apiErrorText,
  ApiError,
  checkServerProject,
} from "../apiClient";
import type { SavedProject } from "../projectFormat";
import type { Language } from "../i18n/Language.svelte";
type User = { id: string; username: string };
type CloudProject = {
  id: string;
  name: string;
  updatedAt: number;
  revision: number;
};
interface CloudHost {
  language: () => Pick<Language, "t">;
  project: () => {
    projectPayload: () => SavedProject;
    projectName: string;
    loadProject: (payload: unknown, message?: string) => Promise<boolean | void>;
    ensureProjectName: () => boolean;
    readonly documentVersion: number;
    exportProject: () => void;
  };
}
/** Cloud state is separate from editor and runtime ownership. No startup request
 * or unsuccessful cloud response can replace the local project/draft. */
export class CloudWorkspace {
  constructor(private readonly host: CloudHost) {}
  open = $state(false);
  private intent: "account" | "open" | "save" = "account";
  busy = $state(false);
  user: User | null = $state(null);
  projects: CloudProject[] = $state.raw([]);
  error = $state("");
  notice = $state("");
  private binding: {
    id: string;
    revision: number;
    documentVersion: number;
  } | null = $state(null);
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
  refresh = (includeProjects = false) =>
    this.run(async () => {
      const { user } = await apiRequest<{ user: User | null }>("/api/account");
      if (this.user?.id !== user?.id) this.binding = null;
      this.user = user;
      this.projects = [];
      if (user && includeProjects) await this.list();
    });
  show = (intent: "account" | "open" | "save" = "account") => {
    this.intent = intent;
    this.open = true;
    return this.refresh(intent === "open");
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
      if (this.intent !== "account") this.open = false;
      if (this.intent === "open") await this.list();
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
      this.notice = this.text("ui.cloud.renamed");
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
}
