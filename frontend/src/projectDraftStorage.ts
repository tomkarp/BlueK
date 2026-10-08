import { parseProject, type SavedProject } from "./projectFormat";

export const DRAFT_PREFIX = "bluek.project-draft.v1.";
export const TAB_DRAFT_KEY = "bluek.tab-draft.v1";
const LEGACY_KEY = "bluek.current-project.v1";

export type ProjectDraftSummary = {
  id: string;
  name: string;
  updatedAt: number;
  fileCount: number;
};
type ProjectDraft = { id: string; updatedAt: number; project: SavedProject };
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
  sessionAvailable = true;

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

  list(): ProjectDraftSummary[] {
    const result: ProjectDraftSummary[] = [];
    try {
      const storage = this.host.local();
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(DRAFT_PREFIX)) continue;
        try {
          const draft = this.read(key.slice(DRAFT_PREFIX.length));
          if (draft)
            result.push({
              id: draft.id,
              name: draft.project.projectName || "Untitled project",
              updatedAt: draft.updatedAt,
              fileCount: draft.project.files.length,
            });
        } catch {
          /* One corrupt draft must not hide the others. */
        }
      }
    } catch {
      /* Storage is optional. */
    }
    return result.sort(
      (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
    );
  }

  delete(id: string): void {
    this.host.local().removeItem(DRAFT_PREFIX + id);
    // Keep lastSaved: displaying/closing an unchanged open project must not
    // recreate a deleted copy. A subsequent edit can autosave it again.
  }

  deleteAll(): void {
    const storage = this.host.local();
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(DRAFT_PREFIX) || key === LEGACY_KEY) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
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
    // exclusively; a second document forks. Without Web Locks, fork on restore
    // as well so independent tabs can never write to the same stored project.
    this.id = id;
    if (!(await this.acquire(id))) {
      this.id = this.host.newId();
      await this.acquire(this.id);
    }
    try {
      this.host.session().setItem(TAB_DRAFT_KEY, this.id);
      this.sessionAvailable = true;
    } catch {
      this.sessionAvailable = false;
    }
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
    try {
      const id = this.host.session().getItem(TAB_DRAFT_KEY);
      if (id) return await this.open(id);
    } catch {
      /* Missing or invalid draft: start normally. */
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

  save(project: SavedProject): void {
    if (!this.id) return;
    // Parsing returns a stable field order, shared with read()/open(). The
    // workspace's export field order must not turn a reload into an edit.
    const source = JSON.stringify(parseProject(project));
    if (source === this.lastSaved) return;
    const storage = this.host.local();
    // Simply opening an empty IDE does not create a Recent work entry.
    if (
      !project.files.length &&
      !project.resources?.length &&
      !project.readme &&
      !project.projectName &&
      !project.library &&
      !storage.getItem(DRAFT_PREFIX + this.id)
    )
      return;
    storage.setItem(
      DRAFT_PREFIX + this.id,
      JSON.stringify({ id: this.id, updatedAt: this.host.now(), project }),
    );
    this.lastSaved = source;
  }

  release(): void {
    this.releaseLock?.();
    this.releaseLock = undefined;
  }
}
