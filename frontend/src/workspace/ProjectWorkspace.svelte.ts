import { englishText } from "../i18n/catalog";
import { projectTemplate } from "../projectTemplates";
import {
  ProjectDraftStorage,
  DRAFT_PREFIX,
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
  sourceDeclarationName,
} from "../uiParity";

import {
  bluePlayFrameworkNames,
  bluePlayFrameworkFiles,
} from "../bluePlayCards";
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
  copyFullProjectLink,
  saveShortProjectLink,
  readSharedProject,
  readProjectFile,
} from "../projectBrowserIO";
import { htmlExport } from "../htmlExport";
import { blueJProjectFromEntries, type ImportEntry } from "../blueJImport";

import { standardImages, withStandardImages } from "../standardImages";
import { loadProjectFromServer } from "../shareApi";

import type {
  ProjectFile,
  ProjectLibrary,
  ProjectResource,
} from "../../../runtime-contract/src/index";
type Resource = ProjectResource;

import type { ObjectWorkspace } from "./ObjectWorkspace.svelte";
import type { ExecutionWorkspace } from "./ExecutionWorkspace.svelte";
import type { WorkspaceUi } from "./WorkspaceUi.svelte";
import type { EditorWorkspace } from "./EditorWorkspace.svelte";
import type { TestWorkspace } from "./TestWorkspace.svelte";

interface ProjectWorkspaceHost {
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
  autosaveWarning = $state("");
  refreshRecentProjects = () => {
    this.recentProjects = this.drafts.list();
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
    this.saveAutosave();
    const ready = this.autosaveReady;
    this.autosaveReady = false;
    try {
      const payload = await this.drafts.open(id);
      await this.loadProject(payload, "Saved project restored.");
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
  mediaNotice = $state("");
  shareNotice = $state("");
  shareLinkDialog: { url: string; code: string; copied: boolean } | null =
    $state(null);
  toolbarDialog: "open" | "save" | null = $state(null);
  shareCodeInput = $state("");
  shareCodeError = $state("");
  shareWithReadme = $state(false);
  shareWithState = $state(false);
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
      ? [...bluePlayFrameworkFiles, ...this.orderedBluePlayFiles(this.files)]
      : this.files;
  });
  currentFile = $derived.by(() => {
    return this.files[this.selected];
  });
  runtimeResources = $derived.by(() => {
    return withStandardImages(this.resources, standardImages);
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
  isBluePlayFrameworkFile = (file: ProjectFile) => {
    return (
      this.library?.id === "blueplay" &&
      bluePlayFrameworkNames.includes(file.fileName)
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
    return createProjectPayload(
      this.files,
      this.resources,
      this.cardPositions,
      this.library,
      this.library?.id === "blueplay" ? bluePlayFrameworkFiles : [],
      this.readme,
      this.projectName,
      this.defaultTestClass,
    );
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
  private persistDraft = (
    payload: ReturnType<ProjectWorkspace["projectPayload"]>,
  ) => {
    try {
      this.drafts.save(payload);
      this.autosaveWarning = this.drafts.sessionAvailable
        ? ""
        : "Automatic project recovery is unavailable. Use Save / Export to keep your work.";
    } catch {
      this.autosaveWarning =
        "Your changes could not be saved in this browser. Use Save / Export to keep your work.";
    }
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
    const oldName = sourceDeclarationName(file.source);
    const newName = sourceDeclarationName(value);
    const fileStem = file.fileName.replace(/\.kt$/, "");
    const renamedFileName =
      file.kind === "class" &&
      newName &&
      newName !== oldName &&
      (oldName === fileStem || !oldName) &&
      !this.files.some(
        (item) => item.id !== file.id && item.fileName === `${newName}.kt`,
      )
        ? `${newName}.kt`
        : file.fileName;
    this.files = this.files.map((file) =>
      file.id === fileId
        ? {
            ...file,
            fileName: renamedFileName,
            source: value,
            revision: file.revision + 1,
          }
        : file.testTarget ===
            this.files.find((item) => item.id === fileId)?.fileName
          ? { ...file, testTarget: renamedFileName }
          : file,
    );
    if (this.defaultTestClass === fileStem)
      this.defaultTestClass = renamedFileName.replace(/\.kt$/, "");
    this.host.session().sourceEdited();
  };
  deleteFile = (file: ProjectFile) => {
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
      if (!this.isBluePlayFrameworkFile(file))
        this.selected = this.files.findIndex((item) => item.id === file.id);
      return;
    }
    if (file.kind !== "class") return;
    if (!this.inheritanceSelection) {
      if (this.isBluePlayFrameworkFile(file)) return;
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
    this.projectName = entered.trim();
    return true;
  };
  exportProject = () => {
    if (!this.ensureProjectName()) return;
    downloadFile(
      JSON.stringify(this.projectPayload(), null, 2),
      "application/json",
      exportFileName(this.projectName, ".bluek.json"),
    );
    this.host.ui().status = "Project exported";
  };
  exportHtml = async () => {
    if (
      !this.files.length ||
      this.htmlExporting ||
      this.host.session().mainDialog
    )
      return;
    if (!this.ensureProjectName()) return;
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
        "Export as HTML needs a file with a parameterless main().",
      );
      return;
    }
    if (entries.length > 1) {
      this.host.session().requestExport(snapshot.generationId);
      return;
    }
    await this.writeHtmlExport(entries[0], snapshot.generationId);
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
      );
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
  shareProject = async () => {
    const copied = await copyFullProjectLink(
      this.projectPayload(),
      this.shareWithReadme,
      this.shareWithState && this.canShareState,
      this.text("ui.transfer.copyThisProjectLink"),
    );
    if (copied) this.host.ui().status = "Project link copied";
    this.shareNotice = copied
      ? "Project link copied to clipboard."
      : "Project link ready to copy.";
    window.setTimeout(() => (this.shareNotice = ""), copied ? 3000 : 4000);
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
      this.shareNotice =
        reason instanceof Error
          ? reason.message
          : "Project could not be saved on the server.";
      window.setTimeout(() => (this.shareNotice = ""), 5000);
    }
  };
  loadSharedProjectFromCode = async () => {
    try {
      await this.loadProject(
        await readSharedProject(this.shareCodeInput),
        "Shared BlueK project loaded. Compile the project.",
      );
      window.history.replaceState(window.history.state, "", "/");
      this.shareCodeInput = "";
      this.shareCodeError = "";
      this.toolbarDialog = null;
    } catch (reason) {
      this.shareCodeError =
        reason instanceof Error
          ? reason.message
          : "Project could not be loaded.";
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
  loadProject = async (payload: unknown, message = "Project loaded.") => {
    const imported = projectModelFromPayload(
      payload,
      (index) => `project-${Date.now()}-${index}`,
    );
    this.saveAutosave();
    this.savedProjectsNotice = false;
    const frameworkFiles = new Set([
      "World.kt",
      "Actor.kt",
      "Image.kt",
      "BluePlayFunctions.kt",
      "BluePlayHelpers.kt",
    ]);
    this.files =
      imported.library?.id === "blueplay"
        ? imported.files.filter((file) => !frameworkFiles.has(file.fileName))
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
    this.closeReadme();
    this.selected = 0;
    this.host.editor().resetWindows();
    this.host.session().markUncompiled();
    this.host.ui().status = message;
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
            kind: /\bclass\s+\w+|\binterface\s+\w+|\bobject\s+\w+/.test(source)
              ? "class"
              : "functions",
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
  importMedia = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const imported = await Promise.all(
      Array.from(input.files || []).map(
        (file) =>
          new Promise<Resource>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                path: `${file.type.startsWith("audio/") ? "sounds" : "images"}/${file.name}`,
                data: String(reader.result),
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );
    input.value = "";
    this.resources = [
      ...this.resources.filter(
        (item) => !imported.some((value) => value.path === item.path),
      ),
      ...imported,
    ];
    this.host.session().markUncompiled();
  };
  chooseTemplate = async (choice: string) => {
    if (
      (this.files.length || this.resources.length) &&
      !window.confirm(
        this.text("ui.transfer.theCurrentProjectContainsDataReplaceIt"),
      )
    )
      return;
    await this.host.session().stopForProjectReplacement();
    if (choice === "empty") {
      await this.loadProject(
        { format: "bluek-project", version: 1, files: [] },
        "New project",
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
      await this.loadProject(payload, "Project template loaded.");
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
    const loadExample = async () => {
      const serverMatch = window.location.pathname.match(
        /^\/load\/((?:[a-z]{4,6}-){2,3}[a-z]{4,6})\/?$/,
      );
      if (serverMatch) {
        try {
          await this.loadProject(
            await loadProjectFromServer(serverMatch[1]),
            "Shared BlueK project loaded. Compile the project.",
          );
          window.history.replaceState(window.history.state, "", "/");
          await applyLinkOptions();
        } catch (reason) {
          this.host.ui().status = "Project error";
          this.host.ui().error =
            reason instanceof Error
              ? reason.message
              : "Could not load the shared BlueK project.";
        }
        return;
      }
      const shared = new URLSearchParams(window.location.hash.slice(1)).get(
        "bluek",
      );
      if (shared) {
        try {
          await this.loadProject(
            await decodeProjectLink(shared),
            "Shared BlueK project loaded. Compile the project.",
          );
          window.history.replaceState(
            window.history.state,
            "",
            window.location.pathname,
          );
          await applyLinkOptions();
        } catch (reason) {
          this.host.ui().status = "Project error";
          this.host.ui().error =
            reason instanceof Error
              ? reason.message
              : "Could not load the BlueK project link.";
        }
        return;
      }
      if (
        new URLSearchParams(window.location.search).get("example") !==
        "blueplay"
      )
        return;
      try {
        await this.loadProject(
          await projectTemplate("blueplay"),
          "BluePlay example loaded.",
        );
      } catch {
        this.host.ui().status = "Project error";
        this.host.ui().error = "Could not load the BluePlay example.";
      }
    };
    this.drafts.migrateLegacy();
    const hasExplicitProject = Boolean(
      window.location.pathname.match(/^\/load\//) ||
      new URLSearchParams(window.location.hash.slice(1)).get("bluek") ||
      new URLSearchParams(window.location.search).get("example") === "blueplay",
    );
    if (!hasExplicitProject) {
      const saved = await this.drafts.restore();
      if (saved) await this.loadProject(saved, "Local project restored.");
      else {
        this.refreshRecentProjects();
        this.savedProjectsNotice = this.recentProjects.length > 0;
      }
    } else {
      await this.drafts.resumeTab();
      await loadExample();
    }
    this.autosaveReady = true;
    this.saveAutosave();
  };
  connect = () => {
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
    const linkNavigation = () => {
      // Opening the same origin's full project link can be a hash-only
      // navigation. Reload explicitly so it runs the normal import path.
      if (new URLSearchParams(window.location.hash.slice(1)).has("bluek")) {
        this.saveAutosave();
        window.location.reload();
      }
    };
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", pageshow);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("hashchange", linkNavigation);
    return () => {
      pagehide();
      window.clearInterval(timer);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("hashchange", linkNavigation);
    };
  };
  selectFile = (id: string) => {
    this.selected = this.files.findIndex((file) => file.id === id);
  };
}
