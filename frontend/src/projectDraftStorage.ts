import { parseProject, type SavedProject } from "./projectFormat";

export const DRAFT_PREFIX = "bluek.project-draft.v1.";
export const TAB_DRAFT_KEY = "bluek.tab-draft.v1";
const LEGACY_KEY = "bluek.current-project.v1";

type ProjectDraft = { id: string; updatedAt: number; project: SavedProject };

/**
 * Why the draft of this tab could not be stored. Sizes are characters of the
 * stored JSON, which browsers count against a Local Storage quota of about
 * five million per site.
 */
export type DraftSaveFailure =
  | { reason: "quota"; projectChars: number }
  | { reason: "blocked" }
  | { reason: "unknown"; detail: string };

const QUOTA_ERRORS = ["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"];
type DraftStorageHost = {
  local: () => Storage;
  session: () => Storage;
  locks: () => LockManager | undefined;
  newId: () => string;
  now: () => number;
};

// Storage I/O and document-lifetime ownership only; the project stays in ProjectWorkspace.
export class ProjectDraftStorage {
  private id = "";
  private lastSaved = "";
  private releaseLock: (() => void) | undefined;
  private lockCompletion: Promise<unknown> = Promise.resolve();

  get activeId(): string {
    return this.id;
  }

  constructor(private readonly host: DraftStorageHost) {}

  private read(id: string): ProjectDraft | null {
    const value = this.host.local().getItem(DRAFT_PREFIX + id);
    if (!value) return null;
    const record = JSON.parse(value);
    if (record.id !== id || !Number.isFinite(record.updatedAt))
      throw new Error("Invalid saved project.");
    return {
      id,
      updatedAt: record.updatedAt,
      project: parseProject(record.project),
    };
  }

  private entries(): ProjectDraft[] {
    const result: ProjectDraft[] = [];
    try {
      const storage = this.host.local();
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(DRAFT_PREFIX)) continue;
        try {
          const draft = this.read(key.slice(DRAFT_PREFIX.length));
          if (draft && this.hasProjectData(draft.project)) result.push(draft);
        } catch {
          /* One corrupt recovery copy must not hide the others. */
        }
      }
    } catch {
      /* Storage is optional. */
    }
    return result.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  }

  private hasProjectData(project: SavedProject): boolean {
    return Boolean(
      project.files.length ||
        project.resources?.length ||
        project.readme?.trim() ||
        project.projectName?.trim() ||
        project.library,
    );
  }

  private setSessionId(id: string): void {
    try {
      this.host.session().setItem(TAB_DRAFT_KEY, id);
    } catch {
      /* Local storage can still recover the latest copy after a crash. */
    }
  }

  private async discardOtherCopies(keepId: string): Promise<void> {
    const storage = this.host.local();
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(DRAFT_PREFIX) && key !== DRAFT_PREFIX + keepId)
        keys.push(key);
    }
    for (const key of keys) {
      const id = key.slice(DRAFT_PREFIX.length);
      if (this.host.locks()) {
        if (!(await this.acquire(id))) continue;
        storage.removeItem(key);
        this.release();
      }
    }
  }

  migrateLegacy(): void {
    try {
      const storage = this.host.local();
      const legacy = storage.getItem(LEGACY_KEY);
      if (!legacy) return;
      const project = parseProject(JSON.parse(legacy));
      // A fixed migration key also makes simultaneous first starts idempotent.
      const id = "legacy-autosave";
      if (!storage.getItem(DRAFT_PREFIX + id))
        storage.setItem(
          DRAFT_PREFIX + id,
          JSON.stringify({ id, updatedAt: this.host.now(), project }),
        );
      storage.removeItem(LEGACY_KEY);
    } catch {
      /* Preserve the old autosave if validation or writing fails. */
    }
  }

  private async acquire(id: string): Promise<boolean> {
    const locks = this.host.locks();
    if (!locks) return false;
    return new Promise<boolean>((resolve) => {
      this.lockCompletion = locks
        .request(DRAFT_PREFIX + id, { ifAvailable: true }, async (lock) => {
          if (!lock) {
            resolve(false);
            return;
          }
          await new Promise<void>((release) => {
            this.releaseLock = release;
            resolve(true);
          });
        })
        .catch(() => resolve(false));
    });
  }

  private async select(id: string): Promise<void> {
    this.release();
    await this.lockCompletion;
    this.lastSaved = "";
    // Duplicated tabs inherit sessionStorage. A live document owns its draft
    // exclusively; a second document forks. Reuse the tab ID without Web Locks
    // so a reload still finds this tab's recovery copy.
    this.id = id;
    if (this.host.locks() && !(await this.acquire(id))) {
      this.id = this.host.newId();
      await this.acquire(this.id);
    }
    this.setSessionId(this.id);
  }

  async start(): Promise<void> {
    await this.select(this.host.newId());
  }

  async resumeTab(): Promise<void> {
    let id: string | null = null;
    try {
      id = this.host.session().getItem(TAB_DRAFT_KEY);
    } catch {
      /* Optional storage. */
    }
    await this.select(id || this.host.newId());
  }

  async reclaim(): Promise<void> {
    if (!this.id) return;
    const id = this.id;
    const lastSaved = this.lastSaved;
    await this.select(id);
    // Returning from the back/forward cache does not change the project. Keep
    // its fingerprint unless another live tab forced us to fork the draft.
    if (this.id === id) this.lastSaved = lastSaved;
  }

  async restore(): Promise<SavedProject | null> {
    let tabId: string | null = null;
    try {
      tabId = this.host.session().getItem(TAB_DRAFT_KEY);
    } catch {
      /* Session storage is optional. */
    }
    if (tabId) {
      try {
        return await this.open(tabId);
      } catch {
        /* Missing or invalid active-tab copy: try crash recovery below. */
      }
    }

    const candidates = this.entries();
    if (candidates.length) {
      const locks = this.host.locks();
      let anotherTabIsActive = false;
      if (locks) {
        for (const candidate of candidates) {
          if (await this.acquire(candidate.id)) this.release();
          else anotherTabIsActive = true;
        }
      }

      // A new tab should not silently take over a live tab's project. When
      // Web Locks are unavailable, the most recent copy wins by design.
      if (!anotherTabIsActive) {
        const latest = candidates[0];
        if (locks) await this.discardOtherCopies(latest.id);
        const locked = locks ? await this.acquire(latest.id) : false;
        if (!locks || locked) {
          this.id = latest.id;
          this.setSessionId(this.id);
          this.lastSaved = JSON.stringify(parseProject(latest.project));
          return latest.project;
        }
      }
    }
    await this.start();
    return null;
  }

  async open(id: string): Promise<SavedProject> {
    const draft = this.read(id);
    if (!draft) throw new Error("This saved project is no longer available.");
    await this.select(id);
    // A fork gets persisted even if no source is edited after restoring.
    if (this.id === id) this.lastSaved = JSON.stringify(draft.project);
    return draft.project;
  }

  /** Classifies an error thrown by [save]; storage that cannot be measured counts as empty. */
  failure(error: unknown, project: SavedProject): DraftSaveFailure {
    const name = error instanceof Error || error instanceof DOMException ? error.name : "";
    if (QUOTA_ERRORS.includes(name)) {
      return { reason: "quota", projectChars: JSON.stringify(project).length };
    }
    if (name === "SecurityError") return { reason: "blocked" };
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { reason: "unknown", detail };
  }

  save(project: SavedProject): void {
    if (!this.id) return;
    // Parsing returns a stable field order, shared with read()/open(). The
    // workspace's export field order must not turn a reload into an edit.
    const source = JSON.stringify(parseProject(project));
    const storage = this.host.local();
    if (!this.hasProjectData(project)) {
      this.clearActive();
      return;
    }
    if (source === this.lastSaved && storage.getItem(DRAFT_PREFIX + this.id)) return;
    storage.setItem(
      DRAFT_PREFIX + this.id,
      JSON.stringify({ id: this.id, updatedAt: this.host.now(), project }),
    );
    this.lastSaved = source;
    this.setSessionId(this.id);
  }

  clearActive(): void {
    if (!this.id) return;
    this.host.local().removeItem(DRAFT_PREFIX + this.id);
    this.lastSaved = "";
    try {
      if (this.host.session().getItem(TAB_DRAFT_KEY) === this.id)
        this.host.session().removeItem(TAB_DRAFT_KEY);
    } catch {
      /* Recovery storage is optional. */
    }
  }

  release(): void {
    this.releaseLock?.();
    this.releaseLock = undefined;
  }
}
