import {
  apiErrorText,
  ApiError,
  checkServerProject,
} from "../apiClient";
import { legacyContent } from "../legacyContentLinks";
import { englishText } from "../i18n/catalog";
import { projectTemplate } from "../projectTemplates";
import {
  ProjectDraftStorage,
  DRAFT_PREFIX,
  type DraftSaveFailure,
  type ProjectDraftSummary,
} from "../projectDraftStorage";
import { untrack } from "svelte";
import type { CardPosition, InheritanceEdge } from "../uiTypes";

import {
  createDiagramInteraction,
  measureInheritanceEdges,
} from "../classDiagramInteraction";

import {
  decodeBlueKLink as decodeProjectLink,
  sourceSuperclass,
  addSuperclass,
} from "../uiParity";

import { bluePlayLibraryNames, bluePlayLibraryFiles } from "../bluePlayCards";
import { mainFiles } from "../mainEntries";

import {
  createProjectPayload,
  parseProject,
  projectModelFromPayload,
} from "../projectFormat";
import { exportFileName } from "../programExport";
import {
  downloadFile,
  droppedDirectoryEntries,
  copyLink,
  saveShortProjectLink,
  readSharedProject,
  readProjectFile,
} from "../projectBrowserIO";
import { htmlExport } from "../htmlExport";
import {
  blueJProjectFromEntries,
  blueJProjects,
  entriesFromZip,
  type BlueJProjectChoice,
  type ImportEntry,
} from "../blueJImport";
import { blueJExportLimits, blueJProjectZip } from "../blueJExport";

import { withStandardResources } from "../standardImages";
import {
  isMediaResource,
  readMediaFile,
  renamedMediaPath,
  type MediaKind,
  type MediaProblem,
  type RenameProblem,
} from "../projectMedia";
import {
  loadEditableProjectFromServer,
  saveProgramToServer,
  ShareCodeError,
} from "../shareApi";
import { shareRoute } from "../shareRoutes";
import type { ProjectSourceAnalysis } from "../projectSourceAnalysis";
import { receiveProjectHandoff } from "../projectHandoff";
import { programForLink, shortProgramLink } from "../programLinks";

import type {
  ProjectFile,
  ProjectLibrary,
  ProjectResource,
} from "../../../runtime-contract/src/index";
type Resource = ProjectResource;
type MessageKey = import("../i18n/Language.svelte").MessageKey;

const MEDIA_PROBLEM_TEXT: Record<
  MediaKind,
  Record<MediaProblem, MessageKey>
> = {
  sound: {
    format: "ui.media.soundFormatUnsupported",
    size: "ui.media.soundTooLarge",
    dimensions: "ui.media.soundUnreadable",
    unreadable: "ui.media.soundUnreadable",
  },
  image: {
    format: "ui.media.imageFormatUnsupported",
    size: "ui.media.imageTooLarge",
    dimensions: "ui.media.imageTooManyPixels",
    unreadable: "ui.media.imageUnreadable",
  },
};
const RENAME_TEXT: Record<
  MediaKind,
  {
    prompt: MessageKey;
    removeConfirm: MessageKey;
    problems: Record<RenameProblem, MessageKey>;
  }
> = {
  sound: {
    prompt: "ui.media.renameSoundPrompt",
    removeConfirm: "ui.media.removeSoundConfirm",
    problems: {
      empty: "ui.media.soundNameEmpty",
      invalid: "ui.media.soundNameInvalid",
      extension: "ui.media.soundNameExtension",
      taken: "ui.media.soundNameTaken",
    },
  },
  image: {
    prompt: "ui.media.renameImagePrompt",
    removeConfirm: "ui.media.removeImageConfirm",
    problems: {
      empty: "ui.media.imageNameEmpty",
      invalid: "ui.media.imageNameInvalid",
      extension: "ui.media.imageNameExtension",
      taken: "ui.media.imageNameTaken",
    },
  },
};

import type { ObjectWorkspace } from "./ObjectWorkspace.svelte";
import type { ExecutionWorkspace } from "./ExecutionWorkspace.svelte";
import type { WorkspaceUi } from "./WorkspaceUi.svelte";
import type { EditorWorkspace } from "./EditorWorkspace.svelte";
import type { TestWorkspace } from "./TestWorkspace.svelte";

interface ProjectWorkspaceHost {
  sourceAnalysis: () => ProjectSourceAnalysis;
  language?: () => Pick<import("../i18n/Language.svelte").Language, "t">;
  tests: () => Pick<TestWorkspace, "loadDefaultFixture">;
  objects: () => Pick<ObjectWorkspace, "dismissMenu">;
  session: () => Readonly<
    Pick<
      ExecutionWorkspace,
      | "markUncompiled"
      | "sourceEdited"
      | "stopForProjectReplacement"
      | "runtime"
      | "mainDialog"
      | "compile"
      | "requestExport"
    >
  >;
  ui: () => Pick<WorkspaceUi, "error" | "status">;
  editor: () => Pick<
    EditorWorkspace,
    "openEditor" | "removeFile" | "resetWindows"
  >;
}

export class ProjectWorkspace {
  constructor(private readonly host: ProjectWorkspaceHost) {}
  private pendingClassRenames = new Map<string, { oldName: string; baseline: ProjectFile[] }>();
  private classRenameResolution: Promise<void> | null = null;
  private knownClassifications = new Map<string, import("../projectSourceAnalysis").FileClassification>();
  private classRenameBaselineCandidates = new Map<string, { className: string; files: ProjectFile[] }>();
  /** Remembers that a file name was derived from its class, even while a collision blocks renaming. */
  private classFileNamesFollowClass = new Set<string>();
  private text = (
    key: import("../i18n/Language.svelte").MessageKey,
    values: (string | number)[] = [],
  ) => this.host.language?.().t(key, values) ?? englishText(key, values);
  private drafts = new ProjectDraftStorage({
    local: () => window.localStorage,
    session: () => window.sessionStorage,
    locks: () => window.navigator.locks,
    newId: () => crypto.randomUUID(),
    now: () => Date.now(),
  });
  recentProjects: ProjectDraftSummary[] = $state.raw([]);
  savedProjectsNotice = $state(false);
  /** Project replacements invalidate cloud associations; source edits keep them. */
  documentVersion = $state(0);
  /** Fingerprint of the latest project explicitly exported or saved to an account. */
  private savedPayloadFingerprint = $state("");
  /** Why the opened link could not be loaded; cleared when a project loads. */
  linkProblem: { message: string; expired: boolean } | null = $state(null);
  handoffPending = $state(false);
  private disconnectHandoff: () => void = () => {};
  /** What the last BlueJ export could not carry over; stays until closed or the next BlueJ export. */
  blueJExportNotice = $state("");
  blueJImportChoice = $state.raw<{
    entries: ImportEntry[];
    projects: BlueJProjectChoice[];
    name: string;
  } | null>(null);
  /** Why the browser draft is not stored; `session` means it cannot be restored after a reload. */
  autosaveWarning: DraftSaveFailure | { reason: "session" } | null =
    $state(null);
  /** The reason of a warning the user closed; it stays closed until the reason changes. */
  autosaveWarningDismissed = $state("");
  dismissAutosaveWarning = () => {
    this.autosaveWarningDismissed = this.autosaveWarning?.reason ?? "";
  };
  refreshRecentProjects = () => {
    // The current tab restores itself automatically. Only show other-tab or
    // earlier-session drafts here, where they can actually be recovered.
    this.recentProjects = this.drafts
      .list()
      .filter((project) => project.id !== this.drafts.activeId);
    if (!this.recentProjects.length) this.savedProjectsNotice = false;
  };
  deleteRecentProject = (id: string) => {
    const draft = this.recentProjects.find((project) => project.id === id);
    if (
      !draft ||
      !window.confirm(
        this.text("ui.transfer.delete0FromThisBrowserSSavedProjects", [
          draft.name,
        ]),
      )
    )
      return;
    try {
      this.drafts.delete(id);
      this.refreshRecentProjects();
      this.host.ui().status = "Saved project deleted";
    } catch {
      this.host.ui().error =
        "Could not delete the saved project from this browser.";
    }
  };
  deleteAllRecentProjects = () => {
    if (
      !window.confirm(
        this.text("ui.transfer.deleteAllSavedProjectsFromThisBrowser"),
      )
    )
      return;
    try {
      this.drafts.deleteAll();
      this.host.ui().status = "All saved projects deleted";
    } catch {
      this.host.ui().error =
        "Could not delete all saved projects from this browser.";
    } finally {
      this.refreshRecentProjects();
    }
  };
  openRecentProject = async (id: string) => {
    if (
      id !== this.drafts.activeId &&
      !this.confirmProjectReplacement()
    )
      return;
    this.saveAutosave();
    const ready = this.autosaveReady;
    this.autosaveReady = false;
    try {
      const payload = await this.drafts.open(id);
      await this.loadProject(payload, "Saved project restored.", false);
      this.toolbarDialog = null;
      this.savedProjectsNotice = false;
    } catch (reason) {
      this.host.ui().error =
        reason instanceof Error ? reason.message : String(reason);
    } finally {
      this.autosaveReady = ready;
      this.saveAutosave();
      this.refreshRecentProjects();
    }
  };
  private defaultCardPosition = (index: number): CardPosition => ({
    x: 80 + (index % 4) * 280,
    y: 40 + Math.floor(index / 4) * 160,
  });
  private testClassSource = (name: string) =>
    `import kotlin.test.*\n\nclass ${name} {\n    // Add @Test methods here, or choose Record Test from the class menu.\n}\n`;
  files: ProjectFile[] = $state.raw([]);
  library: ProjectLibrary | undefined = $state.raw(undefined);
  resources: Resource[] = $state.raw([]);
  selected = $state(0);
  cardPositions: Record<string, CardPosition> = $state({});
  newProjectOpen = $state(false);
  projectInfo: "template" | "example" | null = $state(null);
  newClassOpen = $state(false);
  newClassName = $state("");
  newClassType:
    | "class"
    | "interface"
    | "open"
    | "abstract"
    | "data"
    | "test"
    | "functions" = $state("class");
  inheritanceMode = $state(false);
  inheritanceSelection = $state("");
  showInheritance = $state(true);
  showTestClasses = $state(true);
  bluePlayApiFile: ProjectFile | null = $state(null);
  readme = $state("");
  projectName = $state("");
  defaultTestClass = $state("");
  setDefaultTestClass = (name: string) => {
    this.defaultTestClass = name;
  };
  readmeOpen = $state(false);
  readmeHelp = $state(false);
  imageLibraryOpen = $state(false);
  soundLibraryOpen = $state(false);
  /** Why the last add or rename in the Images/Audio dialog failed. */
  mediaErrors: Record<MediaKind, string> = $state({ sound: "", image: "" });
  shareNotice = $state("");
  shareLinkDialog: import("../uiTypes").ShareLinkDialog | null = $state(null);
  toolbarDialog: "open" | "save" | "share" | null = $state(null);
  shareCodeInput = $state("");
  shareCodeError = $state("");
  shareWithReadme = $state(false);
  shareWithState = $state(false);
  programAllowDownload = $state(true);
  programAllowBlueK = $state(true);
  programShowProjectName = $state(true);
  programAutoRun = $state(true);
  programShowControls = $state(true);
  programShowSpeed = $state(true);
  programOptions = () => ({
    allowDownload: this.programAllowDownload,
    allowBlueK: this.programAllowBlueK,
    showProjectName: this.programShowProjectName,
    ...(this.library?.id === "blueplay"
      ? {
          autoRun: this.programAutoRun,
          showControls: !this.programAutoRun || this.programShowControls,
          showSpeed: this.programShowSpeed,
        }
      : {}),
  });
  canShareState = $derived.by(
    () =>
      Boolean(this.defaultTestClass) &&
      this.files.some(
        (file) => file.fileName === `${this.defaultTestClass}.kt`,
      ),
  );
  autosaveReady = $state(false);
  inheritanceEdges: InheritanceEdge[] = $state([]);
  cardLayers: Record<string, number> = $state({});
  nextCardLayer = $state(100);
  displayCardPositions: CardPosition[] = $derived.by(() => {
    return this.displayFiles.map((file, index) =>
      this.cardPosition(file, index),
    );
  });
  displayCardLayers: number[] = $derived.by(() =>
    this.displayFiles.map((file, index) => this.cardLayer(file, index)),
  );
  htmlExporting = $state(false);
  displayFiles = $derived.by(() => {
    return this.library?.id === "blueplay"
      ? [...bluePlayLibraryFiles, ...this.orderedBluePlayFiles(this.files)]
      : this.files;
  });
  currentFile = $derived.by(() => {
    return this.files[this.selected];
  });
  soundResources = $derived(this.resources.filter(isMediaResource("sound")));
  imageResources = $derived(this.resources.filter(isMediaResource("image")));
  runtimeResources = $derived.by(() => {
    return withStandardResources(this.resources);
  });
  orderedBluePlayFiles = (projectFiles: ProjectFile[]) => {
    const rank = (file: ProjectFile) => {
      if (file.fileName === "Main.kt") return 0;
      const parent = sourceSuperclass(file.source);
      if (parent === "World") return 1;
      if (parent === "Actor") return 2;
      return 3;
    };
    return [...projectFiles].sort((a, b) => rank(a) - rank(b));
  };
  /** Freeze the current layout before a source/name change changes card order. */
  private preserveLayoutForReordering = (nextFiles: ProjectFile[]) => {
    if (this.library?.id !== "blueplay") return;
    const before = this.displayFiles;
    const after = [...bluePlayLibraryFiles, ...this.orderedBluePlayFiles(nextFiles)];
    if (before.length === after.length && before.every((file, index) => file.id === after[index].id)) return;
    this.cardPositions = {
      ...this.cardPositions,
      ...Object.fromEntries(before.flatMap((file, index) => file.testTarget ? [] : [[file.id, this.cardPosition(file, index)]])),
    };
  };
  isBluePlayLibraryFile = (file: ProjectFile) => {
    return (
      this.library?.id === "blueplay" &&
      bluePlayLibraryNames.includes(file.fileName)
    );
  };
  cardPosition = (file: ProjectFile, index: number) => {
    if (file.testTarget) {
      const targetIndex = this.displayFiles.findIndex(
        (candidate) => candidate.fileName === file.testTarget,
      );
      const target = this.displayFiles[targetIndex];
      if (target && !target.testTarget) {
        const targetPosition =
          this.cardPositions[target.id] ||
          this.defaultCardPosition(targetIndex);
        return {
          x: targetPosition.x + 30,
          y: Math.max(0, targetPosition.y - 30),
        };
      }
    }
    return this.cardPositions[file.id] || this.defaultCardPosition(index);
  };
  /** Independent cards have concrete positions; attached tests follow their target. */
  ensureCardPositions = () => {
    let next = this.cardPositions;
    this.displayFiles.forEach((file, index) => {
      if (file.testTarget) {
        if (next[file.id]) {
          if (next === this.cardPositions) next = { ...next };
          delete next[file.id];
        }
        return;
      }
      const position = this.cardPosition(file, index);
      const existing = next[file.id];
      if (existing && existing.x === position.x && existing.y === position.y) return;
      if (next === this.cardPositions) next = { ...next };
      next[file.id] = position;
    });
    if (next !== this.cardPositions) this.cardPositions = next;
  };
  cardLayer = (file: ProjectFile, index: number) => {
    if (file.testTarget) {
      const targetIndex = this.displayFiles.findIndex(
        (candidate) => candidate.fileName === file.testTarget,
      );
      const target = this.displayFiles[targetIndex];
      if (target && !target.testTarget)
        return (this.cardLayers[target.id] ?? targetIndex + 1) - 1;
    }
    return this.cardLayers[file.id] ?? index + 1;
  };
  bringCardToFront = (file: ProjectFile) => {
    const target = file.testTarget
      ? this.displayFiles.find(
          (candidate) => candidate.fileName === file.testTarget,
        )
      : file;
    if (!target) return;
    this.nextCardLayer = Math.max(
      this.nextCardLayer + 1,
      this.displayFiles.length + 1,
    );
    this.cardLayers = { ...this.cardLayers, [target.id]: this.nextCardLayer };
  };
  openBluePlayApi = (file: ProjectFile) => {
    this.bluePlayApiFile = file;
    this.host.objects().dismissMenu();
  };
  projectPayload = () => {
    const positions = Object.fromEntries(this.displayFiles.map((file, index) => [file.id, this.cardPosition(file, index)]));
    return createProjectPayload(
      this.files,
      this.resources,
      positions,
      this.library,
      this.library?.id === "blueplay" ? bluePlayLibraryFiles : [],
      this.readme,
      this.projectName,
      this.defaultTestClass,
    );
  };
  hasUnsavedChanges = $derived(
    JSON.stringify(this.projectPayload()) !== this.savedPayloadFingerprint,
  );
  markProjectSaved = () => {
    this.savedPayloadFingerprint = JSON.stringify(this.projectPayload());
  };
  setProjectName = (name: string) => {
    this.projectName = name;
  };
  commitProjectName = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    this.projectName = this.projectName.trim();
    (event.currentTarget as HTMLInputElement).blur();
  };
  openReadme = () => {
    this.readmeOpen = true;
    this.readmeHelp = false;
    this.host.objects().dismissMenu();
  };
  closeReadme = () => {
    this.readmeOpen = false;
    this.readmeHelp = false;
  };
  saveAutosave = () => {
    if (!this.autosaveReady) return;
    this.persistDraft(this.projectPayload());
  };
  private hasProjectData = () =>
    Boolean(
      this.files.length ||
        this.resources.length ||
        this.readme.trim() ||
        this.projectName.trim() ||
        this.library,
    );
  private confirmProjectReplacement = () =>
    !this.hasProjectData() ||
    window.confirm(this.text("ui.transfer.replaceCurrentProjectBeforeLoading"));
  private persistDraft = (
    payload: ReturnType<ProjectWorkspace["projectPayload"]>,
  ) => {
    try {
      this.drafts.save(payload);
      this.autosaveWarning = this.drafts.sessionAvailable
        ? null
        : { reason: "session" };
    } catch (error) {
      this.autosaveWarning = this.drafts.failure(error, payload);
    }
    if (!this.autosaveWarning) this.autosaveWarningDismissed = "";
  };
  refreshInheritanceEdges = () => {
    const next = measureInheritanceEdges(
      this.displayFiles,
      this.cardLayer,
      this.showInheritance,
    );
    if (JSON.stringify(next) !== JSON.stringify(this.inheritanceEdges))
      this.inheritanceEdges = next;
  };
  toggleInheritance = () => {
    this.showInheritance = !this.showInheritance;
    if (this.showInheritance)
      window.setTimeout(this.refreshInheritanceEdges, 50);
  };
  toggleTestClasses = () => {
    this.showTestClasses = !this.showTestClasses;
  };
  newFile = (kind: "class" | "functions", name: string) => {
    const source =
      kind === "functions"
        ? "// Add top-level Kotlin functions here\n"
        : `class ${name} {\n}\n`;
    const file: ProjectFile = {
      id: `svelte-${Date.now()}-${this.files.length}`,
      fileName: `${name}.kt`,
      kind,
      source,
      revision: 1,
    };
    this.files = [...this.files, file];
    this.selected = this.files.length - 1;
    this.host.session().markUncompiled();
  };
  addTestClass = (target: ProjectFile, name: string): ProjectFile => {
    if (this.files.some((file) => file.testTarget === target.fileName))
      throw new Error(
        "This class already has an attached test class. Use New File to create an independent test class.",
      );
    if (
      !/^[A-Za-z_]\w*$/.test(name) ||
      this.files.some((file) => file.fileName === `${name}.kt`)
    )
      throw new Error("Choose a unique Kotlin class name.");
    const file: ProjectFile = {
      id: crypto.randomUUID(),
      fileName: `${name}.kt`,
      kind: "class",
      revision: 1,
      testTarget: target.fileName,
      isTestClass: true,
      source: this.testClassSource(name),
    };
    this.files = [...this.files, file];
    this.selected = this.files.length - 1;
    this.host.session().markUncompiled();
    return file;
  };
  addIndependentTestClass = (
    name: string,
    source = this.testClassSource(name),
  ): ProjectFile => {
    if (
      !/^[A-Za-z_]\w*$/.test(name) ||
      this.files.some((file) => file.fileName === `${name}.kt`)
    )
      throw new Error("Choose a unique Kotlin class name.");
    const file: ProjectFile = {
      id: crypto.randomUUID(),
      fileName: `${name}.kt`,
      kind: "class",
      revision: 1,
      isTestClass: true,
      source,
    };
    this.files = [...this.files, file];
    this.selected = this.files.length - 1;
    this.host.session().markUncompiled();
    return file;
  };
  applyGeneratedSource = (id: string, source: string) => {
    this.updateSource(id, source);
  };
  confirmNewClass = () => {
    const name = this.newClassName.trim();
    if (
      !/^[A-Za-z_]\w*$/.test(name) ||
      this.files.some((file) => file.fileName === `${name}.kt`)
    ) {
      this.host.ui().error = "Choose a unique valid Kotlin name.";
      return;
    }
    if (this.newClassType === "functions") {
      this.newFile("functions", name);
      this.newClassOpen = false;
      this.host.ui().error = "";
      return;
    }
    if (this.newClassType === "test") {
      this.addIndependentTestClass(name);
      this.newClassOpen = false;
      this.host.ui().error = "";
      return;
    }
    const sources = {
      class: `class ${name} {\n}\n`,
      interface: `interface ${name} {\n}\n`,
      open: `open class ${name} {\n}\n`,
      abstract: `abstract class ${name} {\n}\n`,
      data: `data class ${name}(val value: Any?)\n`,
    };
    const source = sources[this.newClassType];
    const file: ProjectFile = {
      id: `svelte-${Date.now()}-${this.files.length}`,
      fileName: `${name}.kt`,
      kind: "class",
      source,
      revision: 1,
    };
    this.files = [...this.files, file];
    this.selected = this.files.length - 1;
    this.newClassOpen = false;
    this.host.ui().error = "";
    this.host.session().markUncompiled();
  };
  addFile = (kind: "class" | "functions" = "class") => {
    const base = kind === "functions" ? "Functions" : "NewClass";
    let number = this.files.length + 1,
      name = `${base}${number}`;
    while (this.files.some((file) => file.fileName === `${name}.kt`))
      name = `${base}${++number}`;
    this.newFile(kind, name);
  };
  updateSource = (fileId: string, value: string) => {
    if (!this.currentFile) return;
    const file = this.files.find((item) => item.id === fileId);
    if (!file || file.source === value) return;
    const known = this.knownClassifications.get(fileId);
    if (file.kind === "class" && !this.pendingClassRenames.has(fileId) &&
        !this.classRenameBaselineCandidates.has(fileId))
      this.classRenameBaselineCandidates.set(fileId, {
        className: known?.kind === "class" ? known.className || "" : "",
        files: this.files.map(item => ({ ...item })),
      });
    const updatedFiles = this.files.map((file) =>
      file.id === fileId
        ? {
            ...file,
            source: value,
            revision: file.revision + 1,
          }
        : file,
    );
    this.files = updatedFiles;
    this.host.session().sourceEdited();
  };
  resolvePendingClassRenames = (): Promise<void> => {
    if (this.classRenameResolution) return this.classRenameResolution;
    const resolution = this.resolvePendingClassRenamesNow();
    this.classRenameResolution = resolution;
    void resolution.then(
      () => { if (this.classRenameResolution === resolution) this.classRenameResolution = null; },
      () => { if (this.classRenameResolution === resolution) this.classRenameResolution = null; },
    );
    return resolution;
  };
  private resolvePendingClassRenamesNow = async () => {
    if (this.classRenameBaselineCandidates.size) {
      const snapshot = this.files.map(item => ({ ...item }));
      const classifications = await this.host.sourceAnalysis().classify(snapshot);
      for (let index = 0; index < snapshot.length; index++) {
        const current = snapshot[index];
        const candidate = this.classRenameBaselineCandidates.get(current.id);
        const result = classifications[index];
        if (!candidate || result?.kind !== "class" || !result.className ||
            this.files.find(item => item.id === current.id)?.source !== current.source) continue;
        let oldName = candidate.className;
        if (!oldName) {
          const baselineFile = candidate.files.find(item => item.id === current.id);
          if (baselineFile) {
            const [baselineClass] = await this.host.sourceAnalysis().classify([baselineFile]);
            oldName = baselineClass?.kind === "class" ? baselineClass.className || "" : "";
          }
        }
        if (oldName && oldName !== result.className)
          this.pendingClassRenames.set(current.id, { oldName, baseline: candidate.files });
      }
      this.applyClassifications(snapshot, classifications);
    }
    for (const [fileId, pending] of [...this.pendingClassRenames]) {
      const file = this.files.find(item => item.id === fileId);
      if (!file) { this.pendingClassRenames.delete(fileId); continue; }
      this.pendingClassRenames.delete(fileId);
      const [classification] = await this.host.sourceAnalysis().classify([file]);
      if (this.files.find(item => item.id === fileId)?.source !== file.source) {
        if (!this.pendingClassRenames.has(fileId)) this.pendingClassRenames.set(fileId, pending);
        continue;
      }
      const newName = classification?.kind === "class" ? classification.className : undefined;
      if (!newName) continue;
      if (newName === pending.oldName) continue;
      if (!window.confirm(this.text("ui.files.renameClassReferencesConfirm", [pending.oldName, newName]))) continue;
      try {
        const references = await this.host.sourceAnalysis().classReferences(pending.baseline, pending.oldName, this.library?.id === "blueplay");
        const editsByName = new Map<string, import("../projectSourceAnalysis").ClassReferenceEdit[]>();
        for (const edit of references) editsByName.set(edit.fileName, [...(editsByName.get(edit.fileName) || []), edit]);
        const baselineById = new Map(pending.baseline.map(item => [item.id, item]));
        const classIndex = pending.baseline.findIndex(item => item.id === fileId);
        const classifications = await this.host.sourceAnalysis().classify(pending.baseline);
        const declarationFrom = classifications[classIndex]?.className === pending.oldName
          ? classifications[classIndex]?.classNameFrom : undefined;
        let changed = false;
        const updated = this.files.map(current => {
          const baseline = baselineById.get(current.id);
          const edits = baseline && editsByName.get(baseline.fileName);
          if (!baseline || !edits?.length) return current;
          let adjusted = edits;
          if (current.id === fileId) {
            if (declarationFrom === undefined) return current;
            const expected = `${baseline.source.slice(0, declarationFrom)}${newName}${baseline.source.slice(declarationFrom + pending.oldName.length)}`;
            if (current.source !== expected) return current;
            const delta = newName.length - pending.oldName.length;
            adjusted = edits.map(edit => edit.from >= declarationFrom + pending.oldName.length
              ? { ...edit, from: edit.from + delta, to: edit.to + delta } : edit);
          } else if (baseline.source !== current.source) return current;
          let source = current.source;
          for (const edit of [...adjusted].sort((a, b) => b.from - a.from))
            source = `${source.slice(0, edit.from)}${newName}${source.slice(edit.to)}`;
          changed = true;
          return { ...current, source, revision: current.revision + 1 };
        });
        if (changed) {
          this.files = updated;
          this.host.session().sourceEdited();
        }
      } catch (error) {
        this.host.ui().error = error instanceof Error ? error.message : String(error);
      }
    }
  };
  applyClassifications = (files: readonly ProjectFile[], results: readonly import("../projectSourceAnalysis").FileClassification[]) => {
    const byId = new Map(files.map((file, index) => [file.id, { file, result: results[index] }]));
    let changed = false;
    const next = this.files.map(file => {
      const entry = byId.get(file.id);
      if (!entry || entry.file.source !== file.source || entry.file.fileName !== file.fileName) return file;
      const kind = entry.result?.kind;
      if (kind !== "class" && kind !== "functions") return file;
      const previous = this.knownClassifications.get(file.id);
      const className = kind === "class" ? entry.result?.className : undefined;
      if (kind === "class" && className && previous?.kind === "class" && previous.className &&
          className !== previous.className && !this.pendingClassRenames.has(file.id)) {
        const baseline = this.classRenameBaselineCandidates.get(file.id);
        if (baseline?.className === previous.className)
          this.pendingClassRenames.set(file.id, { oldName: previous.className, baseline: baseline.files });
      }
      if (kind === "class" && className && previous?.kind === "class" &&
          className === previous.className && !this.pendingClassRenames.has(file.id))
        this.classRenameBaselineCandidates.set(file.id, { className, files: this.files.map(item => ({ ...item })) });
      else this.classRenameBaselineCandidates.delete(file.id);
      this.knownClassifications.set(file.id, entry.result!);
      if (kind === "functions") {
        this.knownClassifications.delete(file.id);
        this.pendingClassRenames.delete(file.id);
        this.classFileNamesFollowClass.delete(file.id);
      }
      const kindChanged = kind !== file.kind;
      // A file created for top-level functions has no declaration name to
      // follow while the user edits. Once parsing identifies a class, adopt
      // that class name just as we do for an in-place class rename.
      const fileStem = file.fileName.replace(/\.kt$/, "");
      if (className && (this.classFileNamesFollowClass.has(file.id) || file.kind === "functions" ||
          (previous?.kind === "class" && previous.className === fileStem) ||
          (!previous && fileStem === className)))
        this.classFileNamesFollowClass.add(file.id);
      const shouldRenameFile = Boolean(className) && this.classFileNamesFollowClass.has(file.id);
      const fileName = shouldRenameFile && className &&
        !this.files.some(item => item.id !== file.id && item.fileName === `${className}.kt`)
        ? `${className}.kt` : file.fileName;
      if (!kindChanged && fileName === file.fileName) return file;
      changed = true;
      return { ...file, fileName, kind };
    });
    if (changed) {
      const renamed = new Map<string, string>();
      for (const file of this.files) {
        const replacement = next.find(item => item.id === file.id);
        if (replacement && replacement.fileName !== file.fileName)
          renamed.set(file.fileName, replacement.fileName);
      }
      const updated = next.map(file => {
        const previousTarget = [...renamed].find(([oldName]) => file.testTarget === oldName);
        return previousTarget ? { ...file, testTarget: previousTarget[1] } : file;
      });
      this.preserveLayoutForReordering(updated);
      this.files = updated;
      for (const [oldName, newName] of renamed) {
        if (this.defaultTestClass === oldName.replace(/\.kt$/, ""))
          this.defaultTestClass = newName.replace(/\.kt$/, "");
      }
    }
  };
  deleteFile = (file: ProjectFile) => {
    if (
      !window.confirm(
        this.text("ui.objects.deleteFileConfirm", [file.fileName]),
      )
    )
      return;
    const attached = this.files.filter(
      (item) => item.testTarget === file.fileName,
    );
    for (const item of attached)
      this.cardPositions = {
        ...this.cardPositions,
        [item.id]: this.cardPosition(item, this.displayFiles.indexOf(item)),
      };
    this.files = this.files
      .filter((item) => item.id !== file.id)
      .map((item) =>
        item.testTarget === file.fileName
          ? { ...item, testTarget: undefined, isTestClass: true }
          : item,
      );
    if (this.defaultTestClass === file.fileName.replace(/\.kt$/, ""))
      this.defaultTestClass = "";
    this.selected = Math.max(0, Math.min(this.selected, this.files.length - 1));
    this.host.objects().dismissMenu();
    this.host.editor().removeFile(file.id);
    this.host.session().markUncompiled();
  };
  renameFunctionsFile = (file: ProjectFile) => {
    if (file.kind !== "functions") return;
    this.host.objects().dismissMenu();
    const value = window.prompt(this.text("ui.files.renameFilePrompt"), file.fileName.replace(/\.kt$/, ""));
    if (value === null) return;
    const name = value.trim().replace(/\.kt$/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || this.files.some(item => item.id !== file.id && item.fileName === `${name}.kt`)) {
      this.host.ui().error = this.text("ui.files.renameFileInvalid");
      return;
    }
    const renamed = `${name}.kt`;
    if (renamed === file.fileName) return;
    const updatedFiles = this.files.map(item => item.id === file.id ? { ...item, fileName: renamed } :
      item.testTarget === file.fileName ? { ...item, testTarget: renamed } : item);
    this.preserveLayoutForReordering(updatedFiles);
    this.files = updatedFiles;
    this.host.session().sourceEdited();
  };
  renameClassFile = async (file: ProjectFile) => {
    if (file.kind !== "class" || file.testTarget || this.isBluePlayLibraryFile(file)) return;
    this.host.objects().dismissMenu();
    const [classification] = await this.host.sourceAnalysis().classify([file]);
    if (classification?.kind !== "class" || !classification.className || classification.classNameFrom === undefined) {
      this.host.ui().error = this.text("ui.files.renameClassFailed");
      return;
    }
    const oldName = classification.className;
    const classNameFrom = classification.classNameFrom;
    const value = window.prompt(this.text("ui.files.renameClassPrompt"), oldName);
    if (value === null) return;
    const newName = value.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newName) || this.files.some(item => item.id !== file.id && item.fileName === `${newName}.kt`)) {
      this.host.ui().error = this.text("ui.files.renameFileInvalid");
      return;
    }
    if (newName === oldName) return;
    const renameReferences = window.confirm(this.text("ui.files.renameClassReferencesConfirm", [oldName, newName]));
    let edits: import("../projectSourceAnalysis").ClassReferenceEdit[] = [];
    if (renameReferences) {
      try {
        edits = await this.host.sourceAnalysis().classReferences(this.files, oldName, this.library?.id === "blueplay");
      } catch (error) {
        this.host.ui().error = error instanceof Error ? error.message : String(error);
        return;
      }
    }
    const updatedFileName = `${newName}.kt`;
    const editsByFile = new Map<string, typeof edits>();
    for (const edit of edits) editsByFile.set(edit.fileName, [...(editsByFile.get(edit.fileName) || []), edit]);
    const updatedFiles = this.files.map(item => {
      let source = item.source;
      if (item.id === file.id || editsByFile.has(item.fileName)) {
        const replacements = [...(editsByFile.get(item.fileName) || [])];
        if (item.id === file.id) replacements.push({ fileName: item.fileName, from: classNameFrom, to: classNameFrom + oldName.length });
        for (const edit of replacements.sort((a, b) => b.from - a.from))
          source = `${source.slice(0, edit.from)}${newName}${source.slice(edit.to)}`;
      }
      return {
        ...item,
        ...(item.id === file.id ? { fileName: updatedFileName, kind: "class" as const } : {}),
        ...(item.id === file.id || editsByFile.has(item.fileName) ? { source, revision: item.revision + 1 } : {}),
        ...(item.testTarget === file.fileName ? { testTarget: updatedFileName } : {}),
      };
    });
    this.preserveLayoutForReordering(updatedFiles);
    this.files = updatedFiles;
    this.classFileNamesFollowClass.add(file.id);
    // This rename already handled its references (or the user explicitly
    // declined). Keep the syntax baseline aligned so the next analysis does
    // not treat the same declaration change as a second, editor-originated
    // rename and ask again on focus loss.
    this.knownClassifications.set(file.id, { ...classification, className: newName });
    this.classRenameBaselineCandidates.delete(file.id);
    this.pendingClassRenames.delete(file.id);
    if (this.defaultTestClass === oldName) this.defaultTestClass = newName;
    this.host.session().sourceEdited();
    this.host.ui().error = "";
  };
  duplicateFile = (file: ProjectFile) => {
    const stem = file.fileName.replace(/\.kt$/, "");
    let number = 2,
      name = `${stem}${number}`;
    while (this.files.some((item) => item.fileName === `${name}.kt`))
      name = `${stem}${++number}`;
    const duplicate = {
      ...file,
      testTarget: undefined,
      isTestClass: file.isTestClass || Boolean(file.testTarget) || undefined,
      id: `svelte-${Date.now()}`,
      fileName: `${name}.kt`,
      revision: 1,
    };
    this.files = [...this.files, duplicate];
    this.selected = this.files.length - 1;
    this.host.editor().openEditor(duplicate);
    this.host.session().markUncompiled();
  };
  selectCard = (file: ProjectFile, index: number) => {
    this.bringCardToFront(file);
    if (!this.inheritanceMode) {
      if (!this.isBluePlayLibraryFile(file))
        this.selected = this.files.findIndex((item) => item.id === file.id);
      return;
    }
    if (file.kind !== "class") return;
    if (!this.inheritanceSelection) {
      if (this.isBluePlayLibraryFile(file)) return;
      this.inheritanceSelection = file.id;
      this.host.ui().status = "Select superclass";
      return;
    }
    const child = this.files.find(
      (item) => item.id === this.inheritanceSelection,
    );
    if (child && child.id !== file.id) {
      if (sourceSuperclass(child.source))
        this.host.ui().status = "The selected class already has a superclass.";
      else {
        const source = addSuperclass(
          child.source,
          file.fileName.replace(/\.kt$/, ""),
        );
        this.files = this.files.map((item) =>
          item.id === child.id
            ? { ...item, source, revision: item.revision + 1 }
            : item,
        );
        this.host.session().markUncompiled();
      }
    }
    this.inheritanceMode = false;
    this.inheritanceSelection = "";
  };
  ensureProjectName = () => {
    if (this.projectName.trim()) return true;
    const entered = window.prompt(
      this.text("ui.transfer.whatShouldYourProjectBeCalled"),
      "",
    );
    if (entered === null) return false;
    const name = entered.trim();
    if (!name) {
      window.alert(this.text("ui.transfer.projectNameRequired"));
      return false;
    }
    this.projectName = name;
    return true;
  };
  exportProject = () => {
    if (!this.ensureProjectName()) return;
    const payload = this.projectPayload();
    downloadFile(
      JSON.stringify(payload, null, 2),
      "application/json",
      exportFileName(this.projectName, ".bluek.json"),
    );
    this.markProjectSaved();
    this.host.ui().status = "Project exported";
  };
  /** A ZIP for BlueJ, with the cards where the class diagram shows them. */
  exportBlueJProject = () => {
    if (!this.ensureProjectName()) return;
    const cardPositions = Object.fromEntries(
      this.displayFiles.map((file, index) => [
        file.fileName,
        this.displayCardPositions[index],
      ]),
    );
    const folderName = exportFileName(this.projectName, "");
    const payload = { ...this.projectPayload(), cardPositions,
      files: this.files.map(({ fileName, path, source, kind, testTarget, isTestClass }) => ({ fileName, path, source, kind, testTarget, isTestClass })) };
    downloadFile(
      blueJProjectZip(payload, folderName),
      "application/zip",
      `${folderName}.zip`,
    );
    this.host.ui().status = "Project exported";
    // Only projects that have something BlueJ cannot take over get a note.
    const { testClasses, mp3Sounds } = blueJExportLimits(payload);
    this.blueJExportNotice = [
      ...(testClasses.length
        ? [
            this.text("ui.transfer.blueJExportLeavesOutTestClasses", [
              testClasses.join(", "),
            ]),
          ]
        : []),
      ...(mp3Sounds.length
        ? [this.text("ui.transfer.blueJDoesNotPlayMp3", [mp3Sounds.join(", ")])]
        : []),
    ].join(" ");
  };
  exportHtml = () => this.exportProgram("export");
  shareShortProgram = () => this.exportProgram("shareShortProgram");
  exportProgram = async (action: "export" | "shareShortProgram") => {
    if (
      !this.files.length ||
      this.htmlExporting ||
      this.host.session().mainDialog
    )
      return;
    if (!this.ensureProjectName()) return;
    if (action === "shareShortProgram") {
      try {
        checkServerProject(this.projectPayload(), true);
      } catch (error) {
        this.showExportNotice(apiErrorText(error, this.text));
        return;
      }
    }
    if (
      this.host.session().runtime.phase === "uncompiled" ||
      this.host.session().runtime.phase === "compiling"
    ) {
      if (!(await this.host.session().compile())) return;
    }
    const snapshot = this.host.session().runtime;
    const entries = mainFiles(snapshot.classes);
    if (!entries.length) {
      this.host.ui().status = "Export failed";
      this.showExportNotice(
        action === "export"
          ? "Export as HTML needs a file with a parameterless main()."
          : this.text("ui.transfer.programNeedsMain"),
      );
      return;
    }
    if (entries.length > 1) {
      this.host.session().requestExport(snapshot.generationId, action);
      return;
    }
    if (action === "export")
      await this.writeHtmlExport(entries[0], snapshot.generationId);
    else await this.writeProgramLink(entries[0], snapshot.generationId);
  };
  showExportNotice = (text: string) => {
    this.shareNotice = text;
    window.setTimeout(() => {
      if (this.shareNotice === text) this.shareNotice = "";
    }, 5000);
  };
  writeHtmlExport = async (mainFile: string, generationId: string) => {
    // Sources edited since the compile would not match the chosen entry point.
    if (generationId !== this.host.session().runtime.generationId) return;
    this.htmlExporting = true;
    this.host.ui().status = "Exporting HTML…";
    try {
      const html = await htmlExport(
        this.projectPayload(),
        mainFile,
        import.meta.env.BASE_URL,
        window.location.href,
        this.programOptions(),
      );
      if (generationId !== this.host.session().runtime.generationId) return;
      downloadFile(
        html,
        "text/html",
        exportFileName(this.projectName, ".html"),
      );
      this.host.ui().status = "HTML exported";
    } catch (reason) {
      this.host.ui().status = "Export failed";
      this.showExportNotice(
        reason instanceof Error ? reason.message : String(reason),
      );
    } finally {
      this.htmlExporting = false;
    }
  };
  writeProgramLink = async (mainFile: string, generationId: string) => {
    if (
      generationId !== this.host.session().runtime.generationId ||
      this.htmlExporting
    )
      return;
    this.htmlExporting = true;
    try {
      const program = programForLink(
        this.projectPayload(),
        mainFile,
        import.meta.env.BASE_URL,
        window.location.href,
        this.programOptions(),
      );
      const saved = await saveProgramToServer(program);
      const url = shortProgramLink(
        saved.code,
        import.meta.env.BASE_URL,
        window.location.href,
      );
      if (generationId !== this.host.session().runtime.generationId) return;
      const copied = await copyLink(
        url,
        this.text("ui.transfer.copyThisProgramLink"),
      );
      this.shareLinkDialog = {
        url,
        code: saved.code,
        copied,
        program: true,
        expiresInDays: saved.expiresInDays,
      };
      this.showExportNotice(
        this.text(
          copied
            ? "ui.transfer.programLinkCopied"
            : "ui.transfer.programLinkReady",
        ),
      );
    } catch (reason) {
      this.showExportNotice(apiErrorText(reason, this.text));
    } finally {
      this.htmlExporting = false;
    }
  };
  saveShortProject = async () => {
    try {
      this.shareLinkDialog = await saveShortProjectLink(
        this.projectPayload(),
        this.shareWithReadme,
        this.shareWithState && this.canShareState,
        this.text("ui.transfer.copyThisProjectLink"),
      );
      if (this.shareLinkDialog.copied)
        this.host.ui().status = "Short project link copied";
    } catch (reason) {
      this.shareNotice = apiErrorText(reason, this.text);
      window.setTimeout(() => (this.shareNotice = ""), 5000);
    }
  };
  loadSharedProjectFromCode = async () => {
    const before = JSON.stringify(this.projectPayload());
    const version = this.documentVersion;
    const code = this.shareCodeInput;
    try {
      const payload = await readSharedProject(code);
      if (
        version !== this.documentVersion ||
        before !== JSON.stringify(this.projectPayload())
      )
        throw new ApiError("conflict");
      await this.loadProject(
        payload,
        "Shared BlueK project loaded. Compile the project.",
      );
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
      this.shareCodeInput = "";
      this.shareCodeError = "";
      this.toolbarDialog = null;
    } catch (reason) {
      this.shareCodeError = apiErrorText(reason, this.text);
    }
  };
  copySharedLink = async () => {
    if (!this.shareLinkDialog) return;
    const copied = await copyLink(
      this.shareLinkDialog.url,
      this.text("ui.transfer.copyThisProjectLink"),
    );
    if (copied)
      this.shareLinkDialog = { ...this.shareLinkDialog, copied: true };
  };
  loadProject = async (
    payload: unknown,
    message = "Project loaded.",
    confirmReplacement = true,
  ): Promise<boolean> => {
    const imported = projectModelFromPayload(
      payload,
      (index) => `project-${Date.now()}-${index}`,
    );
    if (confirmReplacement && !this.confirmProjectReplacement()) return false;
    this.saveAutosave();
    this.documentVersion++;
    this.savedProjectsNotice = false;
    this.linkProblem = null;
    const librarySourceFiles = new Set([
      "World.kt",
      "Actor.kt",
      "Image.kt",
      "BluePlayFunctions.kt",
      "BluePlayHelpers.kt",
    ]);
    this.files =
      imported.library?.id === "blueplay"
        ? imported.files.filter(
            (file) => !librarySourceFiles.has(file.fileName),
          )
        : imported.files;
    this.library = imported.library;
    this.resources = imported.resources;
    this.cardPositions = imported.cardPositions;
    this.readme = imported.readme;
    this.projectName = imported.projectName ?? "";
    this.defaultTestClass =
      imported.defaultTestClass &&
      this.files.some(
        (file) => file.fileName === `${imported.defaultTestClass}.kt`,
      )
        ? imported.defaultTestClass
        : "";
    this.markProjectSaved();
    this.closeReadme();
    this.selected = 0;
    this.host.editor().resetWindows();
    this.host.session().markUncompiled();
    this.host.ui().status = message;
    return true;
  };
  importProject = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    await this.openProjectFile(file);
  };
  openProjectFile = async (file: File) => {
    try {
      if (!/\.(json|zip)$/i.test(file.name)) {
        this.host.ui().status =
          "Choose a BlueK .json file, a BlueJ .zip file or a project directory.";
        return;
      }
      if (/\.zip$/i.test(file.name)) {
        await this.openProjectEntries(
          entriesFromZip(new Uint8Array(await file.arrayBuffer())),
          file.name,
        );
        return;
      }
      await this.loadProject(
        await readProjectFile(file),
        `Loaded ${file.name}`,
      );
    } catch (reason) {
      this.host.ui().status = "Project error";
      this.host.ui().error =
        reason instanceof Error ? reason.message : String(reason);
    }
  };
  openProjectEntries = async (entries: ImportEntry[], name: string) => {
    try {
      const projects = blueJProjects(entries);
      if (projects.length > 1) {
        this.blueJImportChoice = { entries, projects, name };
        return;
      }
      await this.loadProject(
        blueJProjectFromEntries(entries),
        `Loaded ${name}`,
      );
    } catch (reason) {
      this.host.ui().status = "Project error";
      this.host.ui().error =
        reason instanceof Error ? reason.message : String(reason);
    }
  };
  chooseBlueJProject = async (root: string) => {
    const choice = this.blueJImportChoice;
    if (!choice) return;
    try {
      const loaded = await this.loadProject(
        blueJProjectFromEntries(choice.entries, root),
        `Loaded ${choice.name}: ${root}`,
      );
      if (loaded) this.blueJImportChoice = null;
    } catch (reason) {
      this.host.ui().status = "Project error";
      this.host.ui().error =
        reason instanceof Error ? reason.message : String(reason);
    }
  };
  openProjectDrop = async (event: DragEvent) => {
    event.preventDefault();
    const entry = event.dataTransfer?.items?.[0]?.webkitGetAsEntry?.();
    if (entry?.isDirectory) {
      await this.openProjectEntries(
        await droppedDirectoryEntries(entry as FileSystemDirectoryEntry),
        entry.name,
      );
      this.toolbarDialog = null;
      return;
    }
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.openProjectFile(file);
    this.toolbarDialog = null;
  };
  importKotlin = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const imported = await Promise.all(
      Array.from(input.files || [])
        .filter((file) => /\.kt$/i.test(file.name))
        .map(async (file) => {
          const source = await file.text();
          return {
            id: `import-${Date.now()}-${file.name}`,
            fileName: file.name,
            kind: "unknown",
            source,
            revision: 1,
          } as ProjectFile;
        }),
    );
    input.value = "";
    if (imported.length) {
      this.files = [
        ...this.files.filter(
          (file) => !imported.some((item) => item.fileName === file.fileName),
        ),
        ...imported,
      ];
      this.selected = this.files.length - imported.length;
      this.host.session().markUncompiled();
    }
  };
  /** Adds chosen files as resources of `kind`; a file with the same name is replaced. */
  addMedia = async (kind: MediaKind, chosen: File[]) => {
    this.mediaErrors[kind] = "";
    const added: Resource[] = [];
    const problems: string[] = [];
    for (const file of chosen) {
      const result = await readMediaFile(kind, file);
      if (typeof result !== "string") added.push(result);
      else
        problems.push(this.text(MEDIA_PROBLEM_TEXT[kind][result], [file.name]));
    }
    this.mediaErrors[kind] = problems.join(" ");
    if (!added.length) return;
    this.resources = [
      ...this.resources.filter(
        (item) => !added.some((value) => value.path === item.path),
      ),
      ...added,
    ];
    this.host.session().markUncompiled();
  };
  /** Renames a project image or sound in place; the source keeps the old name. */
  renameMedia = (kind: MediaKind, path: string) => {
    const current = path.split("/").at(-1)!;
    const entered = window.prompt(
      this.text(RENAME_TEXT[kind].prompt, [current]),
      current,
    );
    if (entered === null) return;
    const next = renamedMediaPath(
      kind,
      path,
      entered,
      this.resources.filter(isMediaResource(kind)).map((item) => item.path),
    );
    if (next in RENAME_TEXT[kind].problems) {
      this.mediaErrors[kind] = this.text(
        RENAME_TEXT[kind].problems[next as RenameProblem],
        [entered.trim(), `.${current.split(".").at(-1)}`],
      );
      return;
    }
    this.mediaErrors[kind] = "";
    if (next === path) return;
    this.resources = this.resources.map((item) =>
      item.path === path ? { ...item, path: next } : item,
    );
    this.host.session().markUncompiled();
  };
  removeMedia = (kind: MediaKind, path: string) => {
    if (
      !window.confirm(
        this.text(RENAME_TEXT[kind].removeConfirm, [path.split("/").at(-1)!]),
      )
    )
      return;
    this.resources = this.resources.filter((item) => item.path !== path);
    this.host.session().markUncompiled();
  };
  chooseTemplate = async (choice: string) => {
    if (!this.confirmProjectReplacement()) return;
    await this.host.session().stopForProjectReplacement();
    if (choice === "empty") {
      await this.loadProject(
        { format: "bluek-project", version: 1, files: [] },
        "New project",
        false,
      );
      this.newProjectOpen = false;
      return;
    }
    try {
      const payload = parseProject(await projectTemplate(choice));
      if (choice === "empty-blueplay")
        payload.files = payload.files.filter(
          (file) => file.fileName !== "Main.kt",
        );
      await this.loadProject(payload, "Project template loaded.", false);
    } catch {
      this.host.ui().status = "Project error";
      this.host.ui().error = "Could not load project template.";
    } finally {
      this.newProjectOpen = false;
    }
  };
  diagram = createDiagramInteraction({
    files: () => this.displayFiles,
    position: this.cardPosition,
    raise: this.bringCardToFront,
    move: (id, position) => {
      this.cardPositions = { ...this.cardPositions, [id]: position };
    },
  });
  beginCardDrag = this.diagram.beginCardDrag;
  moveCard = this.diagram.moveCard;
  endCardDrag = this.diagram.endCardDrag;
  initialize = async (): Promise<void> => {
    this.markProjectSaved();
    const handoffRequested = new URLSearchParams(window.location.search).has(
      "import",
    );
    const route = shareRoute(import.meta.env.BASE_URL, window.location.href);
    const linkOpensReadme =
      (new URLSearchParams(window.location.hash.slice(1)).get("readme") ??
        new URLSearchParams(window.location.search).get("readme")) === "1";
    const linkLoadsState =
      (new URLSearchParams(window.location.hash.slice(1)).get("state") ??
        new URLSearchParams(window.location.search).get("state")) === "1";
    const applyLinkOptions = async () => {
      if (linkLoadsState) await this.host.tests().loadDefaultFixture();
      if (linkOpensReadme) this.openReadme();
    };
    type LinkProblem = NonNullable<ProjectWorkspace["linkProblem"]>;
    const linkProblem = (reason: unknown, fallback: string): LinkProblem => {
      this.host.ui().status = "Project error";
      return {
        message: reason ? apiErrorText(reason, this.text) : fallback,
        expired:
          reason instanceof ShareCodeError && reason.problem === "expired",
      };
    };
    const openShared = async (
      load: () => Promise<unknown>,
      fallback: string,
      cleanUrl: string,
    ): Promise<LinkProblem | null> => {
      const before = JSON.stringify(this.projectPayload());
      const version = this.documentVersion;
      try {
        const payload = await load();
        if (
          version !== this.documentVersion ||
          before !== JSON.stringify(this.projectPayload())
        )
          throw new ApiError("conflict");
        const loaded = await this.loadProject(
          payload,
          "Shared BlueK project loaded. Compile the project.",
        );
        if (!loaded) return null;
      } catch (reason) {
        return linkProblem(reason, fallback);
      } finally {
        // A failed link is reported once; reloading starts normally.
        window.history.replaceState(window.history.state, "", cleanUrl);
      }
      await applyLinkOptions();
      return null;
    };
    const openLinkedProject = async (): Promise<LinkProblem | null> => {
      // Legacy /load/ cleanup is tracked in https://github.com/tomkarp/BlueK/issues/26.
      if (route && route.kind !== "run")
        return openShared(
          () => loadEditableProjectFromServer(route.code),
          "Could not load the shared BlueK project.",
          route.basePath,
        );
      const shared = legacyContent(
        new URLSearchParams(window.location.hash.slice(1)),
        "bluek",
      );
      if (shared)
        return openShared(
          () =>
            decodeProjectLink(shared).catch(() => {
              throw new Error("Invalid BlueK project link.");
            }),
          "Could not load the BlueK project link.",
          window.location.pathname,
        );
      if (
        new URLSearchParams(window.location.search).get("example") !==
        "blueplay"
      )
        return null;
      try {
        const loaded = await this.loadProject(
          await projectTemplate("blueplay"),
          "BluePlay example loaded.",
        );
        if (!loaded) return null;
        return null;
      } catch {
        return linkProblem(null, "Could not load the BluePlay example.");
      }
    };
    const restoreTab = async () => {
      const saved = await this.drafts.restore();
      if (saved)
        await this.loadProject(saved, "Local project restored.", false);
      else {
        this.refreshRecentProjects();
        this.savedProjectsNotice = this.recentProjects.length > 0;
      }
    };
    this.drafts.migrateLegacy();
    const hasExplicitProject = Boolean(
      route ||
      legacyContent(
        new URLSearchParams(window.location.hash.slice(1)),
        "bluek",
      ) ||
      new URLSearchParams(window.location.search).get("example") === "blueplay",
    );
    // Restore and enable local drafts before any optional server request.
    // A delayed/failed link cannot replace edits made while it is loading.
    await restoreTab();
    this.autosaveReady = true;
    this.saveAutosave();
    if (handoffRequested) {
      const before = JSON.stringify(this.projectPayload());
      const version = this.documentVersion;
      this.disconnectHandoff = receiveProjectHandoff({
        waiting: (waiting) => {
          this.handoffPending = waiting;
        },
        failed: (problem) => {
          this.linkProblem = {
            message: this.text(`ui.handoff.${problem}`),
            expired: false,
          };
        },
        load: async (payload) => {
          if (
            version !== this.documentVersion ||
            before !== JSON.stringify(this.projectPayload())
          )
            return "changed";
          return (await this.loadProject(payload)) ? "loaded" : "cancelled";
        },
        loaded: () => this.showExportNotice(this.text("ui.handoff.loaded")),
      });
      return;
    }
    if (hasExplicitProject) {
      const problem = await openLinkedProject();
      if (problem) this.linkProblem = problem;
    }
  };
  connect = () => {
    $effect(() => {
      void this.displayFiles;
      void this.cardPositions;
      untrack(this.ensureCardPositions);
    });
    $effect(() => {
      if (!this.readme.trim()) this.shareWithReadme = false;
      if (!this.canShareState) this.shareWithState = false;
    });
    $effect(() => {
      const payload = this.projectPayload();
      if (this.autosaveReady) untrack(() => this.persistDraft(payload));
    });
    $effect(() => {
      if (this.toolbarDialog === "open") untrack(this.refreshRecentProjects);
    });
    $effect(() => {
      void this.files;
      void this.cardPositions;
      void this.showInheritance;
      untrack(() => window.setTimeout(this.refreshInheritanceEdges, 0));
    });
    const timer = window.setInterval(this.refreshInheritanceEdges, 250);
    this.refreshInheritanceEdges();
    const pagehide = () => {
      this.saveAutosave();
      this.drafts.release();
    };
    const beforeunload = (event: BeforeUnloadEvent) => {
      if (!this.hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        this.autosaveReady = false;
        void this.drafts.reclaim().then(() => {
          this.autosaveReady = true;
          this.saveAutosave();
        });
      }
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(DRAFT_PREFIX))
        this.refreshRecentProjects();
    };
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("beforeunload", beforeunload);
    window.addEventListener("pageshow", pageshow);
    window.addEventListener("storage", storageChanged);
    return () => {
      this.disconnectHandoff();
      pagehide();
      window.clearInterval(timer);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("beforeunload", beforeunload);
      window.removeEventListener("pageshow", pageshow);
      window.removeEventListener("storage", storageChanged);
    };
  };
  selectFile = (id: string) => {
    this.selected = this.files.findIndex((file) => file.id === id);
  };
}
