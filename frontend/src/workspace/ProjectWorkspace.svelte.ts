import { projectTemplate } from "../projectTemplates";
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

interface ProjectWorkspaceHost {
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
  private AUTOSAVE_KEY = "bluek.current-project.v1";
  private defaultCardPosition = (index: number): CardPosition => ({
    x: 80 + (index % 4) * 280,
    y: 40 + Math.floor(index / 4) * 160,
  });
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
    "class" | "interface" | "open" | "abstract" | "data" | "functions" =
    $state("class");
  inheritanceMode = $state(false);
  inheritanceSelection = $state("");
  showInheritance = $state(true);
  bluePlayApiFile: ProjectFile | null = $state(null);
  readme = $state("");
  projectName = $state("");
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
  autosaveReady = $state(false);
  inheritanceEdges: InheritanceEdge[] = $state([]);
  cardLayers: Record<string, number> = $state({});
  nextCardLayer = $state(100);
  displayCardPositions: CardPosition[] = $derived.by(() => {
    return this.displayFiles.map((file, index) =>
      this.cardPosition(file, index),
    );
  });
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
    return this.cardPositions[file.id] || this.defaultCardPosition(index);
  };
  cardLayer = (file: ProjectFile, index: number) => {
    return this.cardLayers[file.id] ?? index + 1;
  };
  bringCardToFront = (file: ProjectFile) => {
    this.nextCardLayer = Math.max(
      this.nextCardLayer + 1,
      this.displayFiles.length + 1,
    );
    this.cardLayers = { ...this.cardLayers, [file.id]: this.nextCardLayer };
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
    try {
      window.localStorage.setItem(
        this.AUTOSAVE_KEY,
        JSON.stringify(this.projectPayload()),
      );
    } catch {
      // Storage can be unavailable or full; the editor remains usable.
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
  confirmNewClass = () => {
    const name = this.newClassName.trim();
    if (
      !/^[A-Za-z_]\w*$/.test(name) ||
      this.files.some((file) => file.fileName === `${name}.kt`)
    ) {
      this.host.ui().error =
        "Bitte einen eindeutigen gültigen Kotlin-Namen angeben.";
      return;
    }
    if (this.newClassType === "functions") {
      this.newFile("functions", name);
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
    if (!file) return;
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
        : file,
    );
    this.host.session().sourceEdited();
  };
  deleteFile = (file: ProjectFile) => {
    this.files = this.files.filter((item) => item.id !== file.id);
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
    const entered = window.prompt("What should your project be called?", "");
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
    const copied = await copyLink(this.shareLinkDialog.url);
    if (copied)
      this.shareLinkDialog = { ...this.shareLinkDialog, copied: true };
  };
  loadProject = async (payload: unknown, message = "Project loaded.") => {
    const imported = projectModelFromPayload(
      payload,
      (index) => `project-${Date.now()}-${index}`,
    );
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
        "Das aktuelle Projekt enthält Daten. Möchtest du es wirklich ersetzen?",
      )
    )
      return;
    this.newProjectOpen = false;
    await this.host.session().stopForProjectReplacement();
    if (choice === "empty") {
      this.files = [];
      this.library = undefined;
      this.resources = [];
      this.cardPositions = {};
      this.readme = "";
      this.projectName = "";
      this.closeReadme();
      this.selected = 0;
      this.host.editor().resetWindows();
      this.host.session().markUncompiled();
      this.host.ui().status = "New project";
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
          if (linkOpensReadme) this.openReadme();
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
          window.history.replaceState(window.history.state, "", window.location.pathname);
          if (linkOpensReadme) this.openReadme();
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
    const initializeProject = async () => {
      const hasExplicitProject = Boolean(
        window.location.pathname.match(/^\/load\//) ||
        new URLSearchParams(window.location.hash.slice(1)).get("bluek") ||
        new URLSearchParams(window.location.search).get("example") ===
          "blueplay",
      );
      if (!hasExplicitProject) {
        try {
          const saved = window.localStorage.getItem(this.AUTOSAVE_KEY);
          if (saved) {
            await this.loadProject(
              JSON.parse(saved),
              "Local project restored.",
            );
            this.autosaveReady = true;
            return;
          }
        } catch {
          // Ignore an invalid or unavailable autosave and start normally.
        }
      }
      await loadExample();
      this.autosaveReady = true;
    };
    await initializeProject();
  };
  connect = () => {
    $effect(() => {
      if (!this.readme.trim()) this.shareWithReadme = false;
    });
    $effect(() => {
      const payload = this.projectPayload();
      const ready = this.autosaveReady;
      if (ready) {
        try {
          window.localStorage.setItem(
            this.AUTOSAVE_KEY,
            JSON.stringify(payload),
          );
        } catch {}
      }
    });
    $effect(() => {
      void this.files;
      void this.cardPositions;
      void this.showInheritance;
      untrack(() => window.setTimeout(this.refreshInheritanceEdges, 0));
    });
    const timer = window.setInterval(this.refreshInheritanceEdges, 250);
    this.refreshInheritanceEdges();
    return () => window.clearInterval(timer);
  };
  selectFile = (id: string) => {
    this.selected = this.files.findIndex((file) => file.id === id);
  };
}
