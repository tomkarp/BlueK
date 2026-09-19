<script lang="ts">
  import { afterUpdate, onMount, tick } from "svelte";
  import {
    encodeBlueKLink as encodeProjectLink,
    decodeBlueKLink as decodeProjectLink,
    backgroundDataUrl,
    drawnImageDataUrl,
    runtimeClassName,
    specializeCallable,
    sourceSuperclass,
    addSuperclass,
    cardCenter,
    cardBorderPoint,
    defaultObjectName,
    sourceDeclarationName,
    appendTerminal, terminalParts, codepadResult, codepadError, kotlinCallArguments, missingRequired, missingTypeArgument, codepadIsDisabled,
  } from "./uiParity";
  import { LocalRuntimeClient } from "./localRuntimeClient";
  import { KotlinFormatterClient } from "./kotlinFormatterClient";
  import { InspectorModel, inspectorFieldText, type InspectionView, type InspectorField } from "./inspectorModel";
  import { createProjectPayload, projectModelFromPayload } from "./projectFormat";
  import { prepareRuntimeResources } from "./imageAlpha";
  import { loadProjectFromServer, saveProjectToServer } from "./shareApi";
  import { compileProject, executeCodepad } from "./codepadFlow";
  import { minimalSetup } from "codemirror";
  import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
  import { EditorState, StateEffect } from "@codemirror/state";
  import {
    EditorView,
    drawSelection,
    highlightActiveLine,
    keymap,
    lineNumbers,
  } from "@codemirror/view";
  import {
    defaultKeymap,
    history as historyExtension,
    historyKeymap,
    indentWithTab,
  } from "@codemirror/commands";
  import {
    bracketMatching,
    defaultHighlightStyle,
    indentUnit,
    StreamLanguage,
    syntaxHighlighting,
  } from "@codemirror/language";
  import { searchKeymap } from "@codemirror/search";
  import { kotlin } from "@codemirror/legacy-modes/mode/clike";
  import type {
    Diagnostic,
    InspectedField,
    ProjectFile,
    RuntimeSnapshot,
    RuntimeCommand,
    RuntimeValue,
    ProjectLibrary,
    ProjectResource,
  } from "../../runtime-contract/src/index";
  type Resource = ProjectResource;
  type BenchObject = { objectId: string; className: string; name: string };
  type HistoryEntry = {
    code: string;
    result?: string;
    error?: string;
    objectResult?: boolean;
    objectId?: string;
    className?: string;
  };
  type CardPosition = { x: number; y: number };
  type BluePlayApiDoc = {
    title: string;
    summary: string;
    members: string[];
  };
  const bluePlayFrameworkNames = [
    "BluePlayFunctions.kt",
    "World.kt",
    "Actor.kt",
    "Image.kt",
  ];
  const bluePlayFrameworkFiles: ProjectFile[] = [
    {
      id: "blueplay-framework-BluePlayFunctions.kt",
      fileName: "BluePlayFunctions.kt",
      kind: "functions",
      source: "",
      revision: 1,
    },
    {
      id: "blueplay-framework-World.kt",
      fileName: "World.kt",
      kind: "class",
      source: "open class World(val width: Int, val height: Int, val cellSize: Int = 1)",
      revision: 1,
    },
    {
      id: "blueplay-framework-Actor.kt",
      fileName: "Actor.kt",
      kind: "class",
      source: "open class Actor",
      revision: 1,
    },
    {
      id: "blueplay-framework-Image.kt",
      fileName: "Image.kt",
      kind: "class",
      source: "class Image(val path: String = \"\")",
      revision: 1,
    },
  ];
  const bluePlayApiDocs: Record<string, BluePlayApiDoc> = {
    "BluePlayFunctions.kt": {
      title: "BluePlayFunctions API",
      summary: "Top-level functions for showing, controlling and interacting with a BluePlay world.",
      members: [
        "showWorld(world: World)",
        "show()",
        "start()",
        "stop()",
        "step()",
        "setSpeed(value: Int)",
        "getSpeed(): Int",
        "isKeyDown(key: String): Boolean",
        "playSound(fileName: String)",
      ],
    },
    "World.kt": {
      title: "World API",
      summary: "A two-dimensional world that contains actors, a background and optional text.",
      members: [
        "World(width: Int, height: Int, cellSize: Int = 1)",
        "width: Int",
        "height: Int",
        "cellSize: Int",
        "background: Image",
        "addObject(actor: Actor, x: Int, y: Int)",
        "removeObject(actor: Actor)",
        "getObjects<T>(): List<T>",
        "getObjectsAt(x: Int, y: Int): List<Actor>",
        "numberOfObjects: Int",
        "showText(text: String, x: Int, y: Int)",
        "act()",
      ],
    },
    "Actor.kt": {
      title: "Actor API",
      summary: "The base class for objects that can be placed, drawn and animated in a World.",
      members: [
        "x: Int",
        "y: Int",
        "rotation: Int",
        "image: Image?",
        "setImage(image: Image)",
        "setImage(fileName: String)",
        "move(distance: Int)",
        "turn(degrees: Int)",
        "turnTowards(x: Int, y: Int)",
        "isAtEdge: Boolean",
        "isClicked: Boolean",
        "isTouching(actor: Actor): Boolean",
        "act()",
      ],
    },
    "Image.kt": {
      title: "Image API",
      summary: "An image or drawing surface used for world backgrounds and actor images.",
      members: [
        "Image(width: Int, height: Int)",
        "Image(fileName: String)",
        "width: Int",
        "height: Int",
        "setColor(red: Int, green: Int, blue: Int)",
        "fill()",
        "fillRect(x: Int, y: Int, width: Int, height: Int)",
        "drawRect(x: Int, y: Int, width: Int, height: Int)",
        "drawOval(x: Int, y: Int, width: Int, height: Int)",
        "drawLine(x1: Int, y1: Int, x2: Int, y2: Int)",
        "drawString(text: String, x: Int, y: Int)",
        "drawImage(image: Image, x: Int, y: Int)",
        "clear()",
        "scale(width: Int, height: Int)",
        "setTransparency(value: Int)",
      ],
    },
  };
  type EditorWindowState = {
    id: string;
    fileId: string;
    maximized: boolean;
    position: { left: number; top: number } | null;
    size: { width: number; height: number };
  };
  let client: LocalRuntimeClient;
  let dialogError = "";
  function focusOnMount(node: HTMLElement, enabled = true) {
    const previous = document.activeElement as HTMLElement | null;
    if (enabled) tick().then(() => node.isConnected && node.focus());
    return { destroy() { if (document.activeElement === node) previous?.focus(); } };
  }
  function containClicks(node: HTMLElement) {
    const stop = (event: MouseEvent) => event.stopPropagation();
    node.addEventListener('click', stop);
    return { destroy() { node.removeEventListener('click', stop); } };
  }
  let selectedObjectId = "",
    viewportWidth = 1280;
  $: stageHeight = stage
    ? ((stageMaximized
        ? viewportWidth * 0.9
        : Math.min(viewportWidth * 0.4, 420)) *
        stage.height) /
      Math.max(stage.width, 1)
    : 0;
  $: stageWindowWidth = stage
    ? Math.min(
        Math.max(320, viewportWidth - 24),
        Math.max(600, (stage.width || 1) * (stage.cellSize || 1) + 4),
      )
    : 760;
  afterUpdate(() => {
    drawStageCanvas();
  });
  let runtime: RuntimeSnapshot = {
    generationId: "",
    revision: 0,
    phase: "uncompiled",
    classes: [],
    inspections: {},
    references: [],
    liveObjectIds: [],
    error: null,
    simulation: "inactive",
  };
  let files: ProjectFile[] = [],
    library: ProjectLibrary | undefined,
    resources: Resource[] = [],
    resourceSizes: Record<string, { width: number; height: number }> = {},
    selected = 0,
    cardPositions: Record<string, CardPosition> = {};
  let codepad = "",
    history: HistoryEntry[] = [],
    codepadHistoryIndex = -1,
    terminal = "",
    terminalOpen = false,
    terminalMaximized = false,
    terminalSplit = false,
    terminalSplitWidth = 430,
    terminalPosition: { left: number; top: number } | null = null,
    terminalSize = { width: 780, height: 520 };
  let activeWindow: "terminal" | "editor" | null = null;
  let audioContext: AudioContext | null = null;
  let editorWindows: EditorWindowState[] = [],
    activeEditorId = "",
    editorTabbed = false,
    editorGroup: EditorWindowState | null = null,
    status = "Ready",
    error = "",
    compilerDialog = false,
    compilerDiagnostics: Diagnostic[] = [];
  let activeInspectorId = "";
  let inspected: InspectionView | null = null;
  let inspectorWindows: Array<{
    id: string;
    referenceName: string;
    position: { left: number; top: number };
  }> = [];
  let inspectorModel: InspectorModel;
  let inspectorRevision = 0;
  let inspectorViews: Array<{ id: string; referenceName: string; position: { left: number; top: number }; data: InspectionView }> = [];
  $: {
    // Both runtime fields and independently resolved getters update the derived view.
    void runtime;
    void inspectorRevision;
    inspectorViews = inspectorWindows.map(item => ({
    ...item,
    referenceName: runtime.references.find(reference => reference.name === item.referenceName && reference.objectId === item.id)?.name
      || runtime.references.find(reference => reference.objectId === item.id)?.name || "<object>",
    data: inspectorModel?.view(item.id),
    })).filter((item): item is typeof item & { data: InspectionView } => Boolean(item.data));
  }
  $: inspected = inspectorViews.find(item => item.id === activeInspectorId)?.data || null;
  let menu: {
    x: number;
    y: number;
    file?: ProjectFile;
    object?: BenchObject;
  } | null = null;
  let bench: BenchObject[] = [],
    newProjectOpen = false,
    projectInfo: "template" | "example" | null = null,
    newClassOpen = false,
    newClassName = "",
    newClassType: "class" | "interface" | "open" | "abstract" | "data" | "functions" =
      "class",
    stage: any = null,
    stageCanvas: HTMLCanvasElement | null = null,
    speed = 50,
    inheritanceMode = false,
    inheritanceSelection = "",
    showInheritance = true,
    settingsNotice = false,
    bluePlayApiFile: ProjectFile | null = null,
    editorFontSize = 16,
    filesNotice = false,
    shareNotice = "",
    shareLinkDialog: { url: string; code: string; copied: boolean } | null = null,
    stageWindowOpen = false,
    stageMaximized = false,
    stagePosition: { left: number; top: number } | null = null,
    codepadOpen = true,
    paneSplit = 66,
    benchWidth: number | null = null,
    codepadMenu: { x: number; y: number; text?: string } | null = null;
  const editorFormatters = new Map<string, () => boolean>();
  let formatShortcutLabel = "Ctrl+Shift+I";
  let toolbarDialog: "open" | "save" | null = null;
  let shareCodeInput = "",
    shareCodeError = "";
  const AUTOSAVE_KEY = "bluek.current-project.v1";
  let autosaveReady = false;
  let inheritanceEdges: Array<{
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }> = [];
  let createDialog: {
      className: string;
      constructors: any[];
      constructorIndex: number;
      typeParameters: string[];
      parameters: any[];
    } | null = null,
    createName = "",
    createArgs: string[] = [],
    createTypeArgs: string[] = [];
  let invokeDialog: {
      object?: BenchObject;
      receiver?: string;
      method: any;
    } | null = null,
    invokeArgs: string[] = [],
    invokeTypeArgs: string[] = [],
    resultDialog: {
      method: string;
      value: string;
      objectId?: string;
      className?: string;
    } | null = null,
    objectNamePrompt: RuntimeValue | null = null,
    objectName = "",
    objectNameError = "",
    editingField = "",
    fieldDraft = "",
    fieldError = "";
  $: stageRunning = library?.id === "blueplay"
    ? runtime.simulation === "running" || runtime.simulation === "stopping" || runtime.simulation === "waiting"
    : Boolean(stage?.running);
  let inputElement: HTMLInputElement;
  let cardDrag: { id: string; dx: number; dy: number } | null = null;
  const defaultCardPosition = (index: number): CardPosition => ({
    x: 30 + (index % 3) * 280,
    y: 32 + Math.floor(index / 3) * 170,
  });
  const bluePlayCardPositions: Record<string, CardPosition> = {
    "BluePlayFunctions.kt": { x: 30, y: 32 },
    "Actor.kt": { x: 310, y: 32 },
    "World.kt": { x: 590, y: 32 },
    "Image.kt": { x: 870, y: 32 },
    "Main.kt": { x: 30, y: 202 },
    "Figure.kt": { x: 310, y: 202 },
    "MyWorld.kt": { x: 590, y: 202 },
  };
  let displayFiles: ProjectFile[] = files;
  let displayCardPositions: CardPosition[] = [];
  $: displayFiles = library?.id === "blueplay"
    ? [...bluePlayFrameworkFiles, ...files]
    : files;
  $: {
    cardPositions;
    displayCardPositions = displayFiles.map((file, index) => cardPosition(file, index));
  }
  function isBluePlayFrameworkFile(file: ProjectFile) {
    return library?.id === "blueplay" && bluePlayFrameworkNames.includes(file.fileName);
  }
  function cardPosition(file: ProjectFile, index: number) {
    return cardPositions[file.id] || bluePlayCardPositions[file.fileName] || defaultCardPosition(index);
  }
  function openBluePlayApi(file: ProjectFile) {
    bluePlayApiFile = file;
    menu = null;
  }

  function projectPayload() {
    return createProjectPayload(
      files,
      resources,
      cardPositions,
      library,
      library?.id === "blueplay" ? bluePlayFrameworkFiles : [],
    );
  }
  function saveAutosave() {
    if (!autosaveReady) return;
    try {
      window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectPayload()));
    } catch {
      // Storage can be unavailable or full; the editor remains usable.
    }
  }
  $: if (autosaveReady) {
    files;
    library;
    resources;
    cardPositions;
    saveAutosave();
  }
  function beginCardDrag(event: MouseEvent | PointerEvent, file: ProjectFile) {
    if (event.button !== 0 || ("pointerType" in event && event.pointerType === "touch")) return;
    const canvas = (event.currentTarget as HTMLElement).closest(".canvas");
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const position = cardPosition(file, displayFiles.indexOf(file));
    cardDrag = {
      id: file.id,
      dx: event.clientX - bounds.left - position.x,
      dy: event.clientY - bounds.top - position.y,
    };
    const move = (next: MouseEvent | PointerEvent) => moveCard(next, file);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      endCardDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("mousemove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }
  function moveCard(event: MouseEvent | PointerEvent, file: ProjectFile) {
    if (!cardDrag || cardDrag.id !== file.id) return;
    const canvas = document.querySelector<HTMLElement>(".canvas");
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    cardPositions = {
      ...cardPositions,
      [file.id]: {
        x: Math.max(
          0,
          Math.min(
            bounds.width - 250,
            event.clientX - bounds.left - cardDrag.dx,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            bounds.height - 145,
            event.clientY - bounds.top - cardDrag.dy,
          ),
        ),
      },
    };
  }
  function endCardDrag() {
    cardDrag = null;
  }
  function stageKey(event: KeyboardEvent, pressed: boolean) {
    const key =
      (
        {
          ArrowLeft: "left",
          ArrowRight: "right",
          ArrowUp: "up",
          ArrowDown: "down",
          " ": "space",
        } as Record<string, string>
      )[event.key] || event.key.toLowerCase();
    event.preventDefault();
    client?.sendKey(key, pressed).catch(() => undefined);
  }
  function releaseStageKeys() {
    [
      "left",
      "right",
      "up",
      "down",
      "space",
      "enter",
      "escape",
      "shift",
      "control",
      "tab",
      "backspace",
    ].forEach((key) => client?.sendKey(key, false).catch(() => undefined));
  }
  function stageClick(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    target.focus();
    if (!stage) return;
    event.preventDefault();
    const bounds = target.getBoundingClientRect();
    const worldPixelX = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * (stage.width || 1) * (stage.cellSize || 1);
    const worldPixelY = ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * (stage.height || 1) * (stage.cellSize || 1);
    const x = Math.max(0, Math.min((stage.width || 1) - 1, Math.floor(worldPixelX / Math.max(stage.cellSize || 1, 1))));
    const y = Math.max(0, Math.min((stage.height || 1) - 1, Math.floor(worldPixelY / Math.max(stage.cellSize || 1, 1))));
    const actor = [...(stage.objects || [])].reverse().find((object: any) =>
      actorContainsVisiblePixel(object, worldPixelX, worldPixelY, stage.cellSize || 1),
    );
    client?.sendClick(x, y, actor?.hitId || actor?.objectId).catch(() => undefined);
  }

  function bluePlayAction(action: "step" | "start" | "stop" | "setSpeed") {
    if (!client || library?.id !== "blueplay" || !stage || runtime.phase === "faulted") return;
    if (action === "step" && (stageRunning || !canExecute)) return;
    if (action === "start" && stageRunning) return;
    if (action === "stop" && !stageRunning) return;
    if (action === "setSpeed" && runtime.phase !== "ready" && runtime.phase !== "waitingForInput") return;
    if (library?.id === "blueplay") {
      client.simulation(action, action === "setSpeed" ? Number(speed) : undefined)
        .then((result) => {
          if (result.kind === "error") {
            error = result.display || "BluePlay action failed.";
            status = "BluePlay error";
          } else if (action === "start") status = "Running…";
          else if (action === "stop") status = "Paused";
          else if (action === "step") status = "Ready";
        })
        .catch((reason) => {
          error = reason instanceof Error ? reason.message : String(reason);
          status = "BluePlay error";
        });
      return;
    }
  }
  async function resetGame() {
    if (!canExecute) return;
    await resetRuntime();
    if (library?.id !== "blueplay" && canExecute) await runMain();
  }
  function beginStageDrag(event: PointerEvent) {
    if (
      stageMaximized ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    const stageElement = (event.currentTarget as HTMLElement).closest(".stage-window");
    if (!stageElement) return;
    const bounds = stageElement.getBoundingClientRect();
    const startX = event.clientX,
      startY = event.clientY;
    const move = (next: PointerEvent) => {
      stagePosition = {
        left: Math.max(8, bounds.left + next.clientX - startX),
        top: Math.max(8, bounds.top + next.clientY - startY),
      };
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  }
  function beginPaneResize(event: PointerEvent) {
    const start = event.clientY,
      initial = paneSplit;
    const move = (next: PointerEvent) => {
      paneSplit = Math.max(
        20,
        Math.min(
          82,
          initial +
            ((next.clientY - start) / Math.max(window.innerHeight, 1)) * 100,
        ),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  }
  function beginBenchResize(event: PointerEvent) {
    const benchElement = document.querySelector<HTMLElement>(".lower .bench"),
      measuredWidth = benchElement?.getBoundingClientRect().width;
    const start = event.clientX,
      initial = benchWidth ?? measuredWidth ?? 260;
    const move = (next: PointerEvent) => {
      benchWidth = Math.max(
        120,
        Math.min(window.innerWidth * 0.65, initial + next.clientX - start),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  }
  function refreshInheritanceEdges() {
    const canvas = document.querySelector<HTMLElement>(".canvas");
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".classcard"),
    );
    if (!canvas || !showInheritance) {
      if (inheritanceEdges.length) inheritanceEdges = [];
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const next: typeof inheritanceEdges = [];
    displayFiles.forEach((child, index) => {
      const parent = sourceSuperclass(child.source);
      const parentIndex = displayFiles.findIndex(
        (file) => file.fileName.replace(/\.kt$/, "") === parent,
      );
      if (parentIndex < 0 || !elements[index] || !elements[parentIndex]) return;
      const local = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left - bounds.left + canvas.scrollLeft,
          top: rect.top - bounds.top + canvas.scrollTop,
          width: rect.width,
          height: rect.height,
        };
      };
      const a = local(elements[index]),
        b = local(elements[parentIndex]),
        ac = cardCenter(a),
        bc = cardCenter(b);
      if (ac.x === bc.x && ac.y === bc.y) return;
      const start = cardBorderPoint(a, ac, bc),
        end = cardBorderPoint(b, bc, ac);
      next.push({
        id: child.id,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
      });
    });
    if (JSON.stringify(next) !== JSON.stringify(inheritanceEdges))
      inheritanceEdges = next;
  }
  function toggleInheritance() {
    showInheritance = !showInheritance;
    if (showInheritance) window.setTimeout(refreshInheritanceEdges, 50);
  }
  function copyCodepadText(value: string) {
    navigator.clipboard?.writeText(value).catch(() => undefined);
    codepadMenu = null;
  }

  function codepadResultValue(value: string) {
    const separator = value.lastIndexOf(" : ");
    return separator < 0 ? value : value.slice(0, separator);
  }
  function codepadResultType(value: string) {
    const separator = value.lastIndexOf(" : ");
    return separator < 0 ? "" : value.slice(separator);
  }
  function selectAllCodepadHistory() {
    document.querySelectorAll(".codepad-entry").forEach((entry, index) => {
      const range = document.createRange();
      range.selectNodeContents(entry);
      const selection = window.getSelection();
      if (index === 0) selection?.removeAllRanges();
      selection?.addRange(range);
    });
    codepadMenu = null;
  }
  function codeMirror(
    node: HTMLElement,
    options: { id: string; value: string; fontSize: number; onChange: (value: string) => void },
  ) {
    let current = options;
    const formatter = new KotlinFormatterClient();
    let view: EditorView;
    let formatRequest = 0;
    const formatDocument = () => {
      dialogError = "";
      const request = ++formatRequest;
      const source = view.state.doc.toString();
      void formatter.format(source).then((formatted) => {
        if (request !== formatRequest || formatted === view.state.doc.toString()) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: formatted },
          userEvent: "input.format",
        });
      }).catch((error: unknown) => {
        if (request === formatRequest) {
          const message = error instanceof Error ? error.message : String(error);
          dialogError = message.replaceAll("com.facebook.ktfmt.format.", "");
        }
      });
      return true;
    };
    editorFormatters.set(current.id, formatDocument);
    view = new EditorView({
      state: EditorState.create({
        doc: current.value,
        extensions: [
          minimalSetup,
          lineNumbers(),
          indentUnit.of("    "),
          historyExtension(),
          closeBrackets(),
          bracketMatching(),
          drawSelection(),
          highlightActiveLine(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          StreamLanguage.define(kotlin),
          keymap.of([
            ...defaultKeymap,
            ...closeBracketsKeymap,
            ...historyKeymap,
            ...searchKeymap,
            { key: "Mod-Shift-i", run: formatDocument },
            indentWithTab,
          ]),
          EditorView.theme({
            "&": {
              height: "100%",
              fontSize: "var(--editor-font-size, 16px)",
            },
            ".cm-content, .cm-line, .cm-gutters, .cm-gutterElement": {
              fontSize: "var(--editor-font-size, 16px)",
            },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily: "Menlo, Monaco, Consolas, monospace",
            },
          }),
        ],
      }),
      parent: node,
    });
    const listener = EditorView.updateListener.of((update) => {
      if (update.docChanged) current.onChange(update.state.doc.toString());
    });
    view.dispatch({ effects: StateEffect.appendConfig.of(listener) });
    const formatShortcut = (event: KeyboardEvent) => {
      if ((event.key.toLowerCase() !== "i" && event.code !== "KeyI") ||
          !event.shiftKey || (!event.metaKey && !event.ctrlKey)) return;
      if (!node.contains(document.activeElement)) return;
      event.preventDefault();
      event.stopPropagation();
      formatDocument();
    };
    window.addEventListener("keydown", formatShortcut, true);
    view.focus();
    return {
      update(next: { id: string; value: string; fontSize: number; onChange: (value: string) => void }) {
        const previousId = current.id;
        current = next;
        if (previousId !== next.id) {
          editorFormatters.delete(previousId);
          editorFormatters.set(next.id, formatDocument);
        }
        if (next.value !== view.state.doc.toString())
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: next.value },
          });
        const fontSize = `${next.fontSize}px`;
        view.dom.style.fontSize = fontSize;
        view.dom.querySelector<HTMLElement>(".cm-gutters")?.style.setProperty("font-size", fontSize);
        view.dom.querySelectorAll<HTMLElement>(".cm-gutterElement").forEach((gutter) => {
          gutter.style.fontSize = fontSize;
        });
        const measure = () => view.requestMeasure();
        measure();
        requestAnimationFrame(() => {
          measure();
          requestAnimationFrame(() => {
            const gutters = view.dom.querySelector<HTMLElement>(".cm-gutters");
            if (!gutters) return;
            const lines = [...view.dom.querySelectorAll<HTMLElement>(".cm-line")];
            const numbers = [...gutters.querySelectorAll<HTMLElement>(".cm-lineNumbers .cm-gutterElement")];
            lines.forEach((line, index) => {
              const number = numbers.find((item) => item.textContent?.trim() === String(index + 1));
              if (number) number.style.height = `${line.getBoundingClientRect().height}px`;
            });
          });
        });
      },
      destroy() {
        ++formatRequest;
        editorFormatters.delete(current.id);
        window.removeEventListener("keydown", formatShortcut, true);
        formatter.dispose();
        view.destroy();
      },
    };
  }
  function formatEditor(id: string) {
    editorFormatters.get(id)?.();
  }
  $: currentFile = files[selected];
  $: classes = runtime.classes || [];
  $: canExecute = runtime.phase === "ready" && (runtime.simulation === "inactive" || runtime.simulation === "paused");
  $: inputReady = runtime.phase === "waitingForInput";
  $: programActive = runtime.phase === "running" || runtime.phase === "compiling" || inputReady;
  $: if (terminalOpen && inputReady)
    window.setTimeout(() => inputElement?.focus(), 0);
  $: mainEntries = classes.filter(
    (item) =>
      item.kind === "functions" &&
      item.methods?.some((method) => method.name === "main"),
  );
  $: if (files.length || Object.keys(cardPositions).length || showInheritance)
    window.setTimeout(refreshInheritanceEdges, 0);
  $: if (resources.length) refreshResourceSizes(resources);
  $: if (!resources.length && Object.keys(resourceSizes).length)
    resourceSizes = {};
  $: if (stage && Object.keys(resourceSizes).length) {
    const refreshed = decorateStage(stage);
    if (JSON.stringify(refreshed.objects) !== JSON.stringify(stage.objects))
      stage = refreshed;
  }

  function playBlueKBeep() {
    try {
      audioContext ||= new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch {
      // Audio is optional; a browser audio failure must not fail the program.
    }
  }

  onMount(() => {
    formatShortcutLabel = /Mac/i.test(navigator.platform) ? "Cmd+Shift+I" : "Ctrl+Shift+I";
    client = new LocalRuntimeClient();
    inspectorModel = new InspectorModel(client, () => { inspectorRevision += 1; });
    const unsubscribe = client.subscribe(() => {
      runtime = client.getSnapshot();
      if (runtime.phase === "ready") {
        inspectorWindows.filter((item) => !runtime.liveObjectIds.includes(item.id)).forEach((item) => closeInspector(item.id));
      }
      if (runtime.phase === "waitingForInput" || runtime.phase === "faulted")
        terminalOpen = true;
    });
    const unsubscribeOutput = client.onResponse((value) => {
      if (value.output) {
        terminalOpen = true;
        terminal = appendTerminal(terminal, value.output);
        window.setTimeout(renderTerminal, 0);
      }
      value.effects?.forEach((effect) => {
        if (effect.type === "sound" && effect.name === "beep") playBlueKBeep();
      });
    });
    const unsubscribeStage = client.stageStream((value) => {
      stage = decorateStage(value);
      stageWindowOpen = true;
      speed = Number(value.speed) || speed;
      (value.sounds || []).forEach((sound: string) => {
        const data = resourceData(`sounds/${sound}`);
        if (data) new Audio(data).play().catch(() => undefined);
      });
    });
    const loadExample = async () => {
      const serverMatch = window.location.pathname.match(/^\/load\/((?:[a-z]{4,6}-){2,3}[a-z]{4,6})\/?$/);
      if (serverMatch) {
        try {
          await loadProject(
            await loadProjectFromServer(serverMatch[1]),
            "Shared BlueK project loaded. Compile the project.",
          );
          window.history.replaceState(window.history.state, "", "/");
        } catch (reason) {
          status = "Project error";
          error = reason instanceof Error ? reason.message : "Could not load the shared BlueK project.";
        }
        return;
      }
      const shared = new URLSearchParams(window.location.hash.slice(1)).get(
        "bluek",
      );
      if (shared) {
        try {
          await loadProject(
            await decodeProjectLink(shared),
            "Shared BlueK project loaded. Compile the project.",
          );
          window.history.replaceState(window.history.state, "", "/");
        } catch (reason) {
          status = "Project error";
          error =
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
        await loadProject(
          await (
            await fetch("./examples/blueplay.bluek.json", { cache: "no-store" })
          ).json(),
          "BluePlay example loaded.",
        );
      } catch {
        status = "Project error";
        error = "Could not load the BluePlay example.";
      }
    };
    const initializeProject = async () => {
      const hasExplicitProject = Boolean(
        window.location.pathname.match(/^\/load\//) ||
        new URLSearchParams(window.location.hash.slice(1)).get("bluek") ||
        new URLSearchParams(window.location.search).get("example") === "blueplay",
      );
      if (!hasExplicitProject) {
        try {
          const saved = window.localStorage.getItem(AUTOSAVE_KEY);
          if (saved) {
            await loadProject(JSON.parse(saved), "Local project restored.");
            autosaveReady = true;
            return;
          }
        } catch {
          // Ignore an invalid or unavailable autosave and start normally.
        }
      }
      await loadExample();
      autosaveReady = true;
    };
    initializeProject();
    const edgeTimer = window.setInterval(refreshInheritanceEdges, 250);
    refreshInheritanceEdges();
    return () => {
      window.clearInterval(edgeTimer);
      unsubscribe();
      unsubscribeOutput();
      unsubscribeStage();
      client.invalidate();
    };
  });


  function renderTerminal() {
    tick().then(() => {
      const output = document.querySelector(".terminal-output pre");
      if (output) output.scrollTop = output.scrollHeight;
    });
  }


  function resourceData(path: string | undefined) {
    if (!path) return undefined;
    return resources.find(
      (item) => item.path === path || item.path.endsWith(`/${path}`),
    )?.data;
  }
  async function refreshResourceSizes(list: Resource[]) {
    const entries = await Promise.all(
      list
        .filter((item) => item.path.startsWith("images/"))
        .map(
          (item) =>
            new Promise<[string, { width: number; height: number }] | null>(
              (resolve) => {
                const image = new Image();
                image.onload = () =>
                  resolve([
                    item.path,
                    { width: image.naturalWidth, height: image.naturalHeight },
                  ]);
                image.onerror = () => resolve(null);
                image.src = item.data;
              },
            ),
        ),
    );
    const next = Object.fromEntries(
      entries.filter(
        (entry): entry is [string, { width: number; height: number }] =>
          Boolean(entry),
      ),
    );
    if (JSON.stringify(next) !== JSON.stringify(resourceSizes))
      resourceSizes = next;
  }
  function decorateStage(value: any) {
    return {
      ...value,
      objects: (value.objects || []).map((object: any) => {
        const rawImage = object.image;
        const image = rawImage && typeof rawImage === "object" ? rawImage : {};
        const imagePath = object.imagePath || image.resourcePath;
        const operations = object.imageOperations || image.operations;
        const resource = imagePath
          ? resources.find(
              (item) =>
                item.path === `images/${imagePath}` ||
                item.path.endsWith(`/images/${imagePath}`),
            )
          : undefined;
        const size = resource ? resourceSizes[resource.path] : undefined;
        const width = size?.width || image.width || object.imageWidth || 30,
          height = size?.height || image.height || object.imageHeight || 30;
        return {
          ...object,
          image: {
            ...image,
            resourcePath: imagePath,
            operations,
            width,
            height,
            opacity: object.imageOpacity ?? image.opacity ?? 1,
          },
          imageData:
            object.imageData ||
            (typeof rawImage === "string" ? rawImage : undefined) ||
            resource?.data ||
            drawnImageDataUrl(operations, width, height, resources),
          imagePath,
          imageOperations: operations,
          imageWidth: width,
          imageHeight: height,
          imageOpacity: object.imageOpacity ?? image.opacity ?? 1,
        };
      }),
    };
  }

  function stageStyle(value: any) {
    const width = Math.max(1, (value.width || 1) * (value.cellSize || 1));
    const height = Math.max(1, (value.height || 1) * (value.cellSize || 1));
    return `--bluek-world-width:${width}px;--bluek-world-height:${height}px;aspect-ratio:${width}/${height};background-color:${value.backgroundColor || "#fff"}`;
  }
  const canvasImages = new Map<string, HTMLImageElement>();
  const canvasAlphaMasks = new Map<string, { width: number; height: number; alpha: Uint8ClampedArray }>();
  function canvasImage(data: string) {
    let image = canvasImages.get(data);
    if (!image) {
      image = new Image();
      image.onload = () => drawStageCanvas();
      image.src = data;
      canvasImages.set(data, image);
    }
    return image;
  }
  function canvasAlphaMask(data: string) {
    const cached = canvasAlphaMasks.get(data);
    if (cached) return cached;
    const image = canvasImage(data);
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) return undefined;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return undefined;
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
      for (let source = 3, target = 0; source < rgba.length; source += 4, target += 1)
        alpha[target] = rgba[source];
      const mask = { width: canvas.width, height: canvas.height, alpha };
      canvasAlphaMasks.set(data, mask);
      return mask;
    } catch {
      return undefined;
    }
  }
  function actorContainsVisiblePixel(object: any, worldX: number, worldY: number, cellSize: number) {
    const frame = object.image && typeof object.image === "object" ? object.image : {};
    const width = Math.max(1, Number(object.imageWidth || frame.width || 30));
    const height = Math.max(1, Number(object.imageHeight || frame.height || 30));
    const opacity = Math.max(0, Math.min(1, Number(object.imageOpacity ?? frame.opacity ?? 1)));
    if (opacity * 255 <= 16) return false;
    const centerX = (Number(object.x || 0) + 0.5) * cellSize;
    const centerY = (Number(object.y || 0) + 0.5) * cellSize;
    const radians = (Number(object.rotation || 0) * Math.PI) / 180;
    const cosine = Math.cos(radians), sine = Math.sin(radians);
    const deltaX = worldX - centerX, deltaY = worldY - centerY;
    const localX = cosine * deltaX + sine * deltaY + width / 2;
    const localY = -sine * deltaX + cosine * deltaY + height / 2;
    if (localX < 0 || localY < 0 || localX >= width || localY >= height) return false;
    const imageData = object.imageData || (typeof object.image === "string" ? object.image : undefined);
    if (!imageData) return true;
    const mask = canvasAlphaMask(imageData);
    if (!mask) return false;
    const sourceX = Math.min(mask.width - 1, Math.floor((localX / width) * mask.width));
    const sourceY = Math.min(mask.height - 1, Math.floor((localY / height) * mask.height));
    return mask.alpha[sourceY * mask.width + sourceX] * opacity > 16;
  }
  function canvasDataUrl(value: string | undefined) {
    if (!value) return undefined;
    const match = value.match(/^url\(["']?(.*?)["']?\)$/);
    return match?.[1] || value;
  }
  function drawStageCanvas() {
    const canvas = stageCanvas;
    const value = stage;
    if (!canvas || !value) return;
    const logicalWidth = Math.max(1, (value.width || 1) * (value.cellSize || 1));
    const logicalHeight = Math.max(1, (value.height || 1) * (value.cellSize || 1));
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(logicalWidth * pixelRatio) || canvas.height !== Math.round(logicalHeight * pixelRatio)) {
      canvas.width = Math.round(logicalWidth * pixelRatio);
      canvas.height = Math.round(logicalHeight * pixelRatio);
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, logicalWidth, logicalHeight);
    context.fillStyle = value.backgroundColor || "#fff";
    context.fillRect(0, 0, logicalWidth, logicalHeight);
    const drawImage = (data: string | undefined, x: number, y: number, width: number, height: number, rotation = 0, opacity = 1) => {
      if (!data) return false;
      const image = canvasImage(data);
      if (!image.complete || !image.naturalWidth) return false;
      context.save();
      context.globalAlpha = Math.max(0, Math.min(1, opacity));
      context.translate(x + width / 2, y + height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(image, -width / 2, -height / 2, width, height);
      context.restore();
      return true;
    };
    const backgroundResource = value.backgroundPath ? resourceData(`images/${value.backgroundPath}`) : undefined;
    const backgroundSvg = backgroundDataUrl(
      value.backgroundOperations || [],
      logicalWidth,
      logicalHeight,
      resources,
    );
    drawImage(backgroundResource || canvasDataUrl(backgroundSvg), 0, 0, logicalWidth, logicalHeight);
    (value.objects || []).forEach((object: any) => {
      const frame = object.image && typeof object.image === "object" ? object.image : {};
      const width = Number(object.imageWidth || frame.width || 30);
      const height = Number(object.imageHeight || frame.height || 30);
      const centerX = (Number(object.x || 0) + 0.5) * (value.cellSize || 1);
      const centerY = (Number(object.y || 0) + 0.5) * (value.cellSize || 1);
      const imageData = object.imageData || (typeof object.image === "string" ? object.image : undefined);
      if (!drawImage(imageData, centerX - width / 2, centerY - height / 2, width, height, Number(object.rotation || 0), Number(object.imageOpacity ?? frame.opacity ?? 1))) {
        context.save();
        context.fillStyle = "#f33142";
        context.strokeStyle = "#111";
        context.lineWidth = 2;
        context.fillRect(centerX - width / 2, centerY - height / 2, width, height);
        context.strokeRect(centerX - width / 2, centerY - height / 2, width, height);
        context.fillStyle = "#fff";
        context.font = "bold 14px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(object.className || object.type || "?").slice(0, 1), centerX, centerY);
        context.restore();
      }
    });
    context.save();
    context.font = `${Math.max(12, value.cellSize || 16)}px Arial`;
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    context.strokeStyle = "#000";
    context.lineWidth = 3;
    (value.texts || []).forEach((text: any) => {
      const x = Number(text.x || 0) * (value.cellSize || 1);
      const y = Number(text.y || 0) * (value.cellSize || 1);
      context.strokeText(String(text.text || ""), x, y);
      context.fillText(String(text.text || ""), x, y);
    });
    context.restore();
  }
  function markUncompiled() {
    client?.invalidate();
    stage = null;
    stageWindowOpen = false;
    resultDialog = null;
    invokeDialog = null;
    createDialog = null;
    activeInspectorId = "";
    inspectorWindows = [];
    history = [];
    status = "Uncompiled";
    error = "";
  }
  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (projectInfo) projectInfo = null;
      else if (bluePlayApiFile) bluePlayApiFile = null;
      else if (compilerDialog) compilerDialog = false;
      else if (createDialog) {
        createDialog = null;
        dialogError = "";
      } else if (invokeDialog) {
        invokeDialog = null;
        dialogError = "";
      } else if (objectNamePrompt) objectNamePrompt = null;
      else if (resultDialog) resultDialog = null;
      else if (activeInspectorId && inspectorWindows.some((item) => item.id === activeInspectorId))
        closeInspector(activeInspectorId);
      else if (newClassOpen) newClassOpen = false;
      else if (settingsNotice) settingsNotice = false;
      else if (filesNotice) filesNotice = false;
      else if (shareLinkDialog) shareLinkDialog = null;
      else if (toolbarDialog) toolbarDialog = null;
      else if (newProjectOpen) newProjectOpen = false;
      else if (activeWindow === "terminal" && terminalOpen) {
        terminalOpen = false;
        terminalSplit = false;
      } else if (terminalOpen) {
        terminalOpen = false;
        terminalSplit = false;
      } else if (stageWindowOpen) {
        stageWindowOpen = false;
        stageMaximized = false;
      } else if (menu) menu = null;
      else if (codepadMenu) codepadMenu = null;
      else return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (document.activeElement?.classList.contains("game-stage"))
      stageKey(event, true);
  }
  function newFile(kind: "class" | "functions", name: string) {
    const source =
      kind === "functions"
        ? "// Add top-level Kotlin functions here\n"
        : `class ${name} {\n}\n`;
    const file: ProjectFile = {
      id: `svelte-${Date.now()}-${files.length}`,
      fileName: `${name}.kt`,
      kind,
      source,
      revision: 1,
    };
    files = [...files, file];
    selected = files.length - 1;
    markUncompiled();
  }
  function confirmNewClass() {
    const name = newClassName.trim();
    if (
      !/^[A-Za-z_]\w*$/.test(name) ||
      files.some((file) => file.fileName === `${name}.kt`)
    ) {
      error = "Bitte einen eindeutigen gültigen Kotlin-Namen angeben.";
      return;
    }
    if (newClassType === "functions") {
      newFile("functions", name);
      newClassOpen = false;
      error = "";
      return;
    }
    const sources = {
      class: `class ${name} {\n}\n`,
      interface: `interface ${name} {\n}\n`,
      open: `open class ${name} {\n}\n`,
      abstract: `abstract class ${name} {\n}\n`,
      data: `data class ${name}(val value: Any?)\n`,
    };
    const source = sources[newClassType];
    const file: ProjectFile = {
      id: `svelte-${Date.now()}-${files.length}`,
      fileName: `${name}.kt`,
      kind: "class",
      source,
      revision: 1,
    };
    files = [...files, file];
    selected = files.length - 1;
    newClassOpen = false;
    error = "";
    markUncompiled();
  }
  function addFile(kind: "class" | "functions" = "class") {
    const base = kind === "functions" ? "Functions" : "NewClass";
    let number = files.length + 1,
      name = `${base}${number}`;
    while (files.some((file) => file.fileName === `${name}.kt`))
      name = `${base}${++number}`;
    newFile(kind, name);
  }
  function openEditor(file = currentFile) {
    if (!file) return;
    selected = files.findIndex((item) => item.id === file.id);
    const existing = editorWindows.find((item) => item.fileId === file.id);
    if (!existing) {
      editorWindows = [...editorWindows, {
        id: `editor-${file.id}`,
        fileId: file.id,
        maximized: false,
        position: null,
        size: { width: 780, height: 520 },
      }];
      activeEditorId = `editor-${file.id}`;
    } else {
      activeEditorId = existing.id;
    }
    activeWindow = "editor";
    menu = null;
  }
  function collectEditors() {
    if (editorWindows.length < 2 || editorTabbed) return;
    const active = editorWindows.find((item) => item.id === activeEditorId) || editorWindows[0];
    editorGroup = { ...active, id: "editor-group" };
    editorTabbed = true;
    activeEditorId = active.id;
    activeWindow = "editor";
  }
  function ungroupEditors() {
    if (!editorTabbed || !editorGroup) return;
    const baseLeft = editorGroup.position?.left ?? Math.max(8, (window.innerWidth - editorGroup.size.width) / 2);
    const baseTop = editorGroup.position?.top ?? Math.max(8, (window.innerHeight - editorGroup.size.height) / 2);
    editorWindows = editorWindows.map((item, index) => ({
      ...item,
      maximized: false,
      size: { ...editorGroup!.size },
      position: item.position || {
        left: Math.max(8, Math.min(window.innerWidth - 220, baseLeft + index * 32)),
        top: Math.max(8, Math.min(window.innerHeight - 120, baseTop + index * 32)),
      },
    }));
    editorGroup = null;
    editorTabbed = false;
  }
  function selectEditorTab(id: string) {
    if (!editorWindows.some((item) => item.id === id)) return;
    activeEditorId = id;
    activeWindow = "editor";
  }
  function toggleEditorMaximized(id: string) {
    const frame = editorFrame(id);
    if (frame) updateEditorFrame(id, { maximized: !frame.maximized });
    activeEditorId = id;
    activeWindow = "editor";
  }
  function closeEditor(id = activeEditorId) {
    editorWindows = editorWindows.filter((item) => item.id !== id);
    if (activeEditorId === id) activeEditorId = editorWindows.at(-1)?.id || "";
    if (editorTabbed && editorWindows.length === 1) {
      editorWindows = editorWindows.map((item) => ({
        ...item,
        maximized: editorGroup?.maximized || false,
        position: editorGroup?.position || item.position,
        size: editorGroup?.size || item.size,
      }));
      editorGroup = null;
      editorTabbed = false;
    }
    if (!editorWindows.length) {
      editorGroup = null;
      editorTabbed = false;
      if (activeWindow === "editor") activeWindow = terminalOpen ? "terminal" : null;
    }
  }
  function closeAllEditors() {
    editorWindows = [];
    editorGroup = null;
    editorTabbed = false;
    activeEditorId = "";
    if (activeWindow === "editor") activeWindow = terminalOpen ? "terminal" : null;
  }
  function editorFrame(id: string): EditorWindowState | null {
    return editorTabbed ? editorGroup : editorWindows.find((item) => item.id === id) || null;
  }
  function updateEditorFrame(id: string, update: Partial<EditorWindowState>) {
    if (editorTabbed && editorGroup) editorGroup = { ...editorGroup, ...update };
    else editorWindows = editorWindows.map((item) => item.id === id ? { ...item, ...update } : item);
  }
  function beginEditorDrag(event: PointerEvent, id: string) {
    const editorWindow = editorFrame(id);
    if (!editorWindow || editorWindow.maximized || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const element = (event.currentTarget as HTMLElement).closest(".editor-dialog");
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left;
    const offsetY = event.clientY - bounds.top;
    const move = (next: PointerEvent) => {
      const position = {
        left: Math.max(8, Math.min(window.innerWidth - 220, next.clientX - offsetX)),
        top: Math.max(8, Math.min(window.innerHeight - 120, next.clientY - offsetY)),
      };
      updateEditorFrame(id, { position });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  }
  function beginEditorResize(event: PointerEvent, id: string, direction: string) {
    const editorWindow = editorFrame(id);
    if (!editorWindow || editorWindow.maximized || event.button !== 0) return;
    const element = (event.currentTarget as HTMLElement).closest(".editor-dialog");
    if (!element) return;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const bounds = element.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x, dy = next.clientY - start.y;
      const minWidth = 420, minHeight = 260;
      let left = start.left, top = start.top, width = start.width, height = start.height;
      if (direction.includes("e")) width = Math.max(minWidth, start.width + dx);
      if (direction.includes("s")) height = Math.max(minHeight, start.height + dy);
      if (direction.includes("w")) {
        width = Math.max(minWidth, start.width - dx);
        left = start.left + start.width - width;
      }
      if (direction.includes("n")) {
        height = Math.max(minHeight, start.height - dy);
        top = start.top + start.height - height;
      }
      const position = { left: Math.max(8, left), top: Math.max(8, top) };
      updateEditorFrame(id, { position, size: { width, height } });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  }
  function updateSource(fileId: string, value: string) {
    if (!currentFile) return;
    const file = files.find((item) => item.id === fileId);
    if (!file) return;
    const oldName = sourceDeclarationName(file.source);
    const newName = sourceDeclarationName(value);
    const fileStem = file.fileName.replace(/\.kt$/, "");
    const renamedFileName =
      file.kind === "class" &&
      newName &&
      newName !== oldName &&
      (oldName === fileStem || !oldName) &&
      !files.some(
        (item) => item.id !== file.id && item.fileName === `${newName}.kt`,
      )
        ? `${newName}.kt`
        : file.fileName;
    files = files.map((file) =>
        file.id === fileId
        ? {
            ...file,
            fileName: renamedFileName,
            source: value,
            revision: file.revision + 1,
          }
        : file,
    );
    client?.invalidate();
    activeInspectorId = "";
    inspectorWindows = [];
    history = [];
    status = "Uncompiled";
    error = "";
  }
  function deleteFile(file: ProjectFile) {
    files = files.filter((item) => item.id !== file.id);
    selected = Math.max(0, Math.min(selected, files.length - 1));
    menu = null;
    editorWindows = editorWindows.filter((item) => item.fileId !== file.id);
    if (activeEditorId && !editorWindows.some((item) => item.id === activeEditorId))
      activeEditorId = editorWindows.at(-1)?.id || "";
    if (!editorWindows.length) {
      editorGroup = null;
      editorTabbed = false;
    }
    markUncompiled();
  }
  function duplicateFile(file: ProjectFile) {
    const stem = file.fileName.replace(/\.kt$/, "");
    let number = 2,
      name = `${stem}${number}`;
    while (files.some((item) => item.fileName === `${name}.kt`))
      name = `${stem}${++number}`;
    const duplicate = {
      ...file,
      id: `svelte-${Date.now()}`,
      fileName: `${name}.kt`,
      revision: 1,
    };
    files = [...files, duplicate];
    selected = files.length - 1;
    openEditor(duplicate);
    markUncompiled();
  }
  async function compile(): Promise<boolean> {
    if (!client || runtime.phase === "compiling") return false;
    status = "Compiling…";
    error = "";
    compilerDialog = false;
    compilerDiagnostics = [];
    history = [];
    activeInspectorId = "";
    inspectorWindows = [];
    const result = await compileProject(client, files, Date.now(), library, await prepareRuntimeResources(resources));
    compilerDiagnostics = result.diagnostics;
    if (!result.ok) {
        status = "Compile error";
        error = result.diagnostics
          .map(
            (item) =>
              `${item.fileName || ""}:${item.line}:${item.column}: ${item.message}`,
          )
          .join("\n") || result.error || "Compilation failed.";
        compilerDialog = true;
        return false;
    }
    status = "Compiled";
    return true;
  }
  async function runMain() {
    if (!canExecute || !mainEntries.length) return;
    status = "Running…";
    try {
      const result = await client.execute({
        op: "main",
        fileName: `${mainEntries[0].name}.kt`,
      });
      if (result.kind === "error")
        error = result.display || "Execution failed.";
      else status = "Ready";
      await refreshComputedInspectors();
    } catch (reason) {
      if (runtime.phase !== "uncompiled") {
        status = "Ready";
        error = reason instanceof Error ? reason.message : String(reason);
      }
    }
  }
  async function executeCode(code = codepad.trim()) {
    if (!client || !code) return;
    codepad = "";
    codepadHistoryIndex = -1;
    const result = await executeCodepad(client, files, Date.now(), code, library, await prepareRuntimeResources(resources));
    if (result.kind === "compile-error") {
      compilerDiagnostics = result.compile.diagnostics;
      status = "Compile error";
      error = result.compile.diagnostics
        .map((item) => `${item.fileName || ""}:${item.line}:${item.column}: ${item.message}`)
        .join("\n") || result.compile.error || "Compilation failed.";
      compilerDialog = true;
      return;
    }
    if (result.kind === "stale") return;
    if (result.kind === "error") {
      history = [...history, { code, error: result.error }];
    } else {
      const response = result.response;
      history = [
        ...history,
        response.kind === "error"
          ? { code, error: codepadError(response) }
          : response.kind === "object" || Boolean(response.objectId)
            ? {
                code,
                objectResult: true,
                result: response.kind === "object" ? undefined : codepadResult(response),
                objectId: response.objectId,
                className:
                  response.className || response.type?.displayName || "Object",
              }
            : { code, result: codepadResult(response) },
      ];
    }
    await refreshComputedInspectors();
    await tick();
    const historyElement = document.querySelector(".codepad-history");
    if (historyElement) historyElement.scrollTop = historyElement.scrollHeight;
    if (codepadOpen && !inputReady)
      document.querySelector<HTMLTextAreaElement>(".codepad textarea")?.focus();
  }
  function submitCodepad(event: KeyboardEvent) {
    if (event.key === "ArrowUp" && history.length) {
      event.preventDefault();
      codepadHistoryIndex =
        codepadHistoryIndex < 0
          ? history.length - 1
          : Math.max(0, codepadHistoryIndex - 1);
      codepad = history[codepadHistoryIndex].code;
      return;
    }
    if (event.key === "ArrowDown" && history.length) {
      event.preventDefault();
      codepadHistoryIndex =
        codepadHistoryIndex < 0
          ? -1
          : Math.min(history.length, codepadHistoryIndex + 1);
      codepad =
        codepadHistoryIndex >= 0 && codepadHistoryIndex < history.length
          ? history[codepadHistoryIndex].code
          : "";
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      executeCode();
    }
  }
  async function sendInput(event: KeyboardEvent) {
    if (event.key !== "Enter" || !inputReady) return;
    const value = inputElement.value;
    inputElement.value = "";
    terminal += `\u0001${value}\u0002\n`;
    await client.sendInput(value);
  }
  async function sendEof() {
    if (!inputReady) return;
    await client.sendEof();
  }
  $: bench = runtime.references.flatMap((reference) => reference.onBench && reference.objectId
    ? [{ objectId: reference.objectId, name: reference.name, className: reference.className }] : []);



  function chooseConstructor(index: number) {
    if (!createDialog) return;
    createDialog = {
      ...createDialog,
      constructorIndex: index,
      parameters: createDialog.constructors[index]?.parameters || [],
    };
    createArgs = createDialog.parameters.map(() => "");
    dialogError = "";
  }
  function createObject(className: string, index = 0) {
    const meta = classes.find((item) => item.name === className),
      constructors = meta?.constructors || [];
    if (!canExecute || !constructors.length) return;
    const parameters = constructors[index]?.parameters || [],
      typeParameters = meta?.typeParameters || [];
    const name = defaultObjectName(className, runtime.references.map((reference) => reference.name));
    menu = null;
    createDialog = {
      className,
      constructors,
      constructorIndex: index,
      typeParameters,
      parameters,
    };
    createName = name;
    createArgs = (constructors[index]?.parameters || []).map(() => "");
    createTypeArgs = (meta?.typeParameters || []).map(() => "");
    dialogError = "";
    menu = null;
  }
  async function confirmCreate() {
    if (!canExecute) return;
    if (!createDialog || !/^[A-Za-z_]\w*$/.test(createName.trim())) {
      dialogError = "Bitte einen gültigen Instanznamen angeben.";
      return;
    }
    if (runtime.references.some((reference) => reference.name === createName.trim())) {
      dialogError = "Dieser Instanzname ist bereits vergeben.";
      return;
    }
    if (
      missingTypeArgument(createTypeArgs) ||
      missingRequired(createDialog.parameters, createArgs)
    ) {
      dialogError =
        "Bitte alle erforderlichen Kotlin-Argumente und Typargumente ausfüllen.";
      return;
    }
    const dialog = createDialog;
    const name = createName.trim();
    const args = kotlinCallArguments(dialog.parameters, createArgs);
    const typeArguments = [...createTypeArgs];
    createDialog = null;
    await executeCreate(dialog.className, name, args, typeArguments);
  }
  async function executeCreate(className: string, name: string, args: string[], typeArguments: string[]) {
    const generation = client.getSnapshot().generationId;
    try {
      const result = await client.execute({
        op: "create",
        className, name, typeArguments, args,
      });
      if (client.getSnapshot().generationId !== generation) return;
      if (result.kind === "error")
        showCallError(result.display || "Objekt konnte nicht erstellt werden.");
    } catch (reason) {
      if (client.getSnapshot().generationId === generation) showCallError(reason);
    }
  }
  function invokeObject(object: BenchObject, original: any) {
    const method = specializeCallable(original, object, classes);
    if (method.name === "show") stageWindowOpen = true;
    prepareInvoke({ object, method });
  }
  function methodLabel(method: any) {
    const returnType =
      method.returnType?.displayName && method.returnType.displayName !== "Unit"
        ? `${method.returnType.displayName} `
        : "";
    const typeParameters = method.typeParameters?.length
      ? `<${method.typeParameters.join(", ")}>`
      : "";
    const parameters = (method.parameters || [])
      .map(
        (parameter: any) =>
          `${parameter.name}: ${parameter.type?.displayName || "Any?"}${parameter.hasDefault ? " = …" : ""}`,
      )
      .join(", ");
    const inherited = method.inheritedFrom
      ? `  [inherited from ${method.inheritedFrom}]`
      : "";
    const generated = method.autoGenerated ? "  [auto-generated]" : "";
    return `${returnType}${method.name}${typeParameters}(${parameters})${inherited}${generated}`;
  }
  function popupObjectMethods(object: BenchObject) {
    return (
      classes.find((item) => item.name === runtimeClassName(object))?.methods ||
      []
    )
      .filter((method) => !method.autoGenerated)
      .map((method) => specializeCallable(method, object, classes));
  }
  function directPopupMethods(object: BenchObject) {
    const methods = popupObjectMethods(object),
      inheritedNames = new Set(
        methods
          .filter((method) => method.inheritedFrom)
          .map(
            (method) => `${method.name}(${(method.parameters || []).length})`,
          ),
      ),
      className = object.className.replace(/\s*<.*>$/, "");
    return methods
      .filter((method) => !method.inheritedFrom)
      .map((method) => ({
        ...method,
        overrides: inheritedNames.has(
          `${method.name}(${(method.parameters || []).length})`,
        )
          ? className
          : undefined,
      }));
  }
  function inheritedPopupGroups(object: BenchObject) {
    const groups = new Map<string, any[]>();
    popupObjectMethods(object)
      .filter((method) => method.inheritedFrom)
      .forEach((method) => {
        const owner = method.inheritedFrom as string;
        groups.set(owner, [...(groups.get(owner) || []), method]);
      });
    const order: string[] = [];
    const visit = (name: string) => {
      const owner = classes.find((item) => item.name === name);
      (owner?.supertypes || [])
        .map((value: any) =>
          (typeof value === "string"
            ? value
            : value?.classifier || value?.displayName || ""
          ).replace(/\s*<.*>$/, ""),
        )
        .filter(Boolean)
        .forEach((parent: string) => {
          if (!order.includes(parent)) {
            order.push(parent);
            visit(parent);
          }
        });
    };
    visit(object.className.replace(/\s*<.*>$/, ""));
    order.reverse();
    return [...groups.entries()].sort(
      ([left], [right]) =>
        (order.indexOf(left) < 0
          ? Number.MAX_SAFE_INTEGER
          : order.indexOf(left)) -
        (order.indexOf(right) < 0
          ? Number.MAX_SAFE_INTEGER
          : order.indexOf(right)),
    );
  }
  function popupObjectMethodLabel(method: any) {
    const label = methodLabel({
      ...method,
      inheritedFrom: undefined,
      autoGenerated: false,
    });
    return method.overrides
      ? `${label}  [redefined in ${method.overrides}]`
      : label;
  }
  function invokeClassMethod(className: string, method: any) {
    const owner = classes.find((item) => item.name === className);
    if (!owner) return;
    if (
      method.name === "main" &&
      owner.kind === "functions" &&
      !method.parameters?.length
    ) {
      menu = null;
      client
        .execute({ op: "main", fileName: `${owner.name}.kt` })
        .then(showResult)
        .catch((reason) => (error = String(reason)));
      return;
    }
    prepareInvoke({
      receiver:
        owner.kind === "object" || method.isCompanion ? `${owner.name}.` : "",
      method,
    });
  }
  function prepareInvoke(call: NonNullable<typeof invokeDialog>) {
    if (!canExecute) return;
    menu = null;
    if (!call.method.parameters?.length && !call.method.typeParameters?.length) {
      void executeInvoke(call, [], []);
      return;
    }
    invokeArgs = (call.method.parameters || []).map(() => "");
    invokeTypeArgs = (call.method.typeParameters || []).map(() => "");
    dialogError = "";
    invokeDialog = call;
  }
  function showCallError(reason: unknown) {
    error = reason instanceof Error ? reason.message : String(reason);
    compilerDiagnostics = [];
    compilerDialog = true;
  }
  function showResult(result: RuntimeValue, method = "") {
    if (result.kind === "error") {
      error = result.display || "Execution failed.";
      return;
    }
    if (result.kind !== "unit")
      resultDialog = {
        method,
        value:
          codepadResult(result) ||
          result.display ||
          result.className ||
          result.kind,
        objectId: result.objectId,
        className: result.className,
      };
  }
  function fileMethods(file: ProjectFile) {
    const owner = classes.find(
      (item) => item.name === file.fileName.replace(/\.kt$/, ""),
    );
    return owner?.kind === "functions" || owner?.kind === "object"
      ? owner.methods || []
      : (owner?.companionMethods || []).map((method) => ({
          ...method,
          isCompanion: true,
        }));
  }
  async function confirmInvoke() {
    if (!canExecute || !invokeDialog) return;
    const dialog = invokeDialog,
      method = dialog.method,
      parameters = method.parameters || [];
    if (
      missingTypeArgument(invokeTypeArgs) ||
      missingRequired(parameters, invokeArgs)
    ) {
      dialogError =
        "Bitte alle erforderlichen Kotlin-Argumente und Typargumente ausfüllen.";
      return;
    }
    const args = kotlinCallArguments(parameters, invokeArgs);
    const typeArguments = [...invokeTypeArgs];
    invokeDialog = null;
    await executeInvoke(dialog, args, typeArguments);
  }
  async function executeInvoke(dialog: NonNullable<typeof invokeDialog>, args: string[], typeArguments: string[]) {
    const generation = client.getSnapshot().generationId;
    const method = dialog.method;
    try {
      const suffix = typeArguments.length ? `<${typeArguments.join(", ")}>` : "";
      const propertyName = method.propertyName;
      const request: RuntimeCommand = dialog.object
        ? method.autoGenerated && propertyName
          ? method.name.startsWith("set")
            ? {
                op: "set",
                objectId: dialog.object.objectId,
                property: propertyName,
                value: args[0],
              }
            : {
                op: "get",
                objectId: dialog.object.objectId,
                property: propertyName,
              }
          : {
              op: "invoke",
              objectId: dialog.object.objectId,
              name: method.name,
              typeArguments,
              args,
            }
        : {
          op: "eval",
          code: `${dialog.receiver || ""}${method.name}${suffix}(${args.join(", ")})`,
        };
      const result = await client.execute(request);
      if (client.getSnapshot().generationId !== generation) return;
      if (result.kind === "error")
        showCallError(result.display || "Aufruf fehlgeschlagen.");
      else {
        showResult(
          result,
          `${dialog.object ? dialog.object.name + "." : dialog.receiver || ""}${method.name}${suffix}()`,
        );
        if (request.op !== "get") await refreshComputedInspectors();
      }
    } catch (reason) {
      if (client.getSnapshot().generationId === generation) showCallError(reason);
    }
  }
  function requestObjectOnBench(value: RuntimeValue) {
    if (!value.objectId) return;
    objectNamePrompt = value;
    objectNameError = "";
    objectName =
      value.name ||
      (value.className || "object")
        .replace(/<.*>/, "")
        .replace(/^./, (letter) => letter.toLowerCase());
  }
  function getLastCodepadObject() {
    const entry = [...history].reverse().find((item) => item.objectId && runtime.liveObjectIds.includes(item.objectId));
    if (entry?.objectId)
      requestObjectOnBench({
        kind: "object",
        objectId: entry.objectId,
        className: entry.className || "Object",
        name: entry.className || "Object",
      });
  }
  async function confirmObjectOnBench() {
    if (
      !objectNamePrompt?.objectId ||
      !/^[A-Za-z_]\w*$/.test(objectName.trim())
    )
      return;
    const result = await client.execute({
      op: "bind",
      objectId: objectNamePrompt.objectId,
      name: objectName.trim(),
    });
    if (result.kind !== "error") {
      objectNamePrompt = null;
    } else objectNameError = result.display || "The reference could not be added.";
  }
  async function inspectObject(object: BenchObject) {
    menu = null;
    const result = await client.execute({
      op: "inspect",
      objectId: object.objectId,
    });
    if (result.kind !== "error") {
      const existing = inspectorWindows.find(
        (item) => item.id === object.objectId,
      );
      const position = existing?.position || {
        left: Math.max(
          12,
          Math.min(window.innerWidth - 552, 80 + inspectorWindows.length * 28),
        ),
        top: 90 + inspectorWindows.length * 28,
      };
      inspectorWindows = [
        ...inspectorWindows.filter((item) => item.id !== object.objectId),
        { id: object.objectId, referenceName: object.name, position },
      ];
      activeInspectorId = object.objectId;
      await inspectorModel.refresh(object.objectId);
    }
  }
  function bringInspectorToFront(id: string) {
    activeInspectorId = id;
    const inspector = inspectorWindows.find((item) => item.id === id);
    if (!inspector || inspectorWindows.at(-1)?.id === id) return;
    inspectorWindows = [
      ...inspectorWindows.filter((item) => item.id !== id),
      inspector,
    ];
  }
  function closeInspector(id: string) {
    inspectorWindows = inspectorWindows.filter((item) => item.id !== id);
    inspectorModel.forget(id);
    if (inspected?.objectId === id) {
      const next = inspectorWindows.at(-1);
      activeInspectorId = next?.id || "";
    }
  }
  function beginInspectorDrag(event: PointerEvent, objectId: string) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button,input")
    )
      return;
    const element = (event.currentTarget as HTMLElement).closest(
      ".inspect-window",
    );
    if (!element) return;
    const bounds = element.getBoundingClientRect(),
      offsetX = event.clientX - bounds.left,
      offsetY = event.clientY - bounds.top;
    const move = (next: PointerEvent) => {
      const position = {
        left: Math.max(
          8,
          Math.min(
            window.innerWidth - bounds.width - 8,
            next.clientX - offsetX,
          ),
        ),
        top: Math.max(
          8,
          Math.min(
            window.innerHeight - bounds.height - 8,
            next.clientY - offsetY,
          ),
        ),
      };
      inspectorWindows = inspectorWindows.map((item) =>
        item.id === objectId ? { ...item, position } : item,
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  }
  async function removeObject(object: BenchObject) {
    const result = await client.execute({
      op: "remove",
      objectId: object.objectId,
      name: object.name,
    });
    if (result.kind === "error") {
      showCallError(result.display || "The object reference could not be removed.");
    }
    menu = null;
  }
  function fieldProperty(data: RuntimeValue, field: InspectedField) {
    return classes
      .find(
        (item) =>
          item.name ===
          (
            data.className ||
            bench.find((object) => object.objectId === data.objectId)
              ?.className ||
            ""
          ).replace(/\s*<.*>$/, ""),
      )
      ?.properties?.find((item) => item.name === field.name);
  }
  function fieldValue(data: RuntimeValue, field: InspectorField) {
    return inspectorFieldText(field, field.type || fieldProperty(data, field)?.type);
  }
  function inspectorType(data: InspectionView) {
    return data.className || data.type?.displayName || data.type?.classifier || "Object";
  }
  async function refreshComputedInspectors() {
    for (const inspector of inspectorWindows) {
      await inspectorModel.refresh(inspector.id);
    }
  }
  function canEditField(field: InspectorField, data = inspected) {
    const property = data && fieldProperty(data, field);
    return (
      canExecute &&
      field.setterPrivate !== true &&
      property?.mutable === true &&
      property?.visibility === "public"
    );
  }
  function fitPopup(node: HTMLElement) {
    const fit = () => {
      const rect = node.getBoundingClientRect();
      node.style.top = `${Math.max(8, Math.min(menu?.y || 8, window.innerHeight - rect.height - 8))}px`;
      node.style.left = `${Math.max(8, Math.min(menu?.x || 8, window.innerWidth - rect.width - 8))}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    fit();
    return {
      destroy() {
        observer.disconnect();
      },
    };
  }
  function openMenu(
    event: MouseEvent,
    file?: ProjectFile,
    object?: BenchObject,
  ) {
    event.preventDefault();
    event.stopPropagation();
    menu = { x: event.clientX, y: event.clientY, file, object };
  }
  function clearTerminal() {
    terminal = "";
    renderTerminal();
  }
  function toggleTerminalMaximized() {
    if (terminalSplit) {
      terminalSplit = false;
      terminalMaximized = true;
    } else terminalMaximized = !terminalMaximized;
  }
  function toggleTerminalSplit() {
    terminalSplit = !terminalSplit;
    terminalMaximized = false;
    terminalPosition = null;
  }
  function beginTerminalDrag(event: PointerEvent) {
    if (
      terminalMaximized ||
      terminalSplit ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    const element = (event.currentTarget as HTMLElement).closest(
      ".terminal-window",
    );
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left,
      offsetY = event.clientY - bounds.top;
    const move = (next: PointerEvent) => {
      terminalPosition = {
        left: Math.max(
          8,
          Math.min(window.innerWidth - 220, next.clientX - offsetX),
        ),
        top: Math.max(
          8,
          Math.min(window.innerHeight - 120, next.clientY - offsetY),
        ),
      };
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  }
  function beginTerminalResize(event: PointerEvent, direction: string) {
    if (terminalMaximized || terminalSplit || event.button !== 0) return;
    const element = (event.currentTarget as HTMLElement).closest(
      ".terminal-window",
    );
    if (!element) return;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const bounds = element.getBoundingClientRect();
    const start = {
      x: event.clientX,
      y: event.clientY,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x,
        dy = next.clientY - start.y;
      const minWidth = 420,
        minHeight = 260;
      let left = start.left,
        top = start.top,
        width = start.width,
        height = start.height;
      if (direction.includes("e")) width = Math.max(minWidth, start.width + dx);
      if (direction.includes("s"))
        height = Math.max(minHeight, start.height + dy);
      if (direction.includes("w")) {
        width = Math.max(minWidth, start.width - dx);
        left = start.left + start.width - width;
      }
      if (direction.includes("n")) {
        height = Math.max(minHeight, start.height - dy);
        top = start.top + start.height - height;
      }
      terminalPosition = { left: Math.max(8, left), top: Math.max(8, top) };
      terminalSize = { width, height };
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  }
  function beginTerminalSplitResize(event: PointerEvent) {
    if (!terminalSplit || event.button !== 0) return;
    const startX = event.clientX,
      startWidth = terminalSplitWidth;
    const move = (next: PointerEvent) => {
      terminalSplitWidth = Math.max(
        320,
        Math.min(
          Math.max(320, window.innerWidth - 520),
          startWidth - (next.clientX - startX),
        ),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    event.preventDefault();
  }
  async function resetRuntime() {
    if (!client || runtime.phase === "compiling") return;
    terminal = "";
    stage = null;
    stageWindowOpen = false;
    stageMaximized = false;
    activeInspectorId = "";
    inspectorWindows = [];
    history = [];
    error = "";
    status = "Resetting…";
    try {
      const result = await client.reset();
      const diagnostics = result.diagnostics || [];
      if (diagnostics.length) {
        status = "Compile error";
        error = diagnostics
          .map(
            (item) =>
              `${item.fileName || ""}:${item.line}:${item.column}: ${item.message}`,
          )
          .join("\n");
        compilerDiagnostics = diagnostics;
        compilerDialog = true;
      } else status = "Compiled";
    } catch (reason) {
      status = "Reset failed";
      error = reason instanceof Error ? reason.message : String(reason);
    }
  }
  function beginFieldEdit(field: InspectorField, data = inspected) {
    if (!data) return;
    activeInspectorId = data.objectId || "";
    editingField = field.name;
    fieldDraft = fieldValue(data, field);
    fieldError = "";
  }
  async function saveField(field: InspectorField) {
    if (!inspected?.objectId) return;
    try {
      const objectId = inspected.objectId,
        result = await client.execute({
          op: "set",
          objectId,
          property: field.name,
          value: fieldDraft,
        });
      if (result.kind === "error")
        fieldError = result.display || "Could not set property.";
      else {
        await inspectorModel.refresh(objectId);
        editingField = "";
        fieldError = "";
      }
    } catch (reason) {
      fieldError = reason instanceof Error ? reason.message : String(reason);
    }
  }
  function selectCard(file: ProjectFile, index: number) {
    if (!inheritanceMode) {
      if (!isBluePlayFrameworkFile(file)) selected = files.findIndex((item) => item.id === file.id);
      return;
    }
    if (file.kind !== "class") return;
    if (!inheritanceSelection) {
      if (isBluePlayFrameworkFile(file)) return;
      inheritanceSelection = file.id;
      status = "Select superclass";
      return;
    }
    const child = files.find((item) => item.id === inheritanceSelection);
    if (child && child.id !== file.id) {
      if (sourceSuperclass(child.source))
        status = "The selected class already has a superclass.";
      else {
        const source = addSuperclass(
          child.source,
          file.fileName.replace(/\.kt$/, ""),
        );
        files = files.map((item) =>
          item.id === child.id
            ? { ...item, source, revision: item.revision + 1 }
            : item,
        );
        markUncompiled();
      }
    }
    inheritanceMode = false;
    inheritanceSelection = "";
  }
  function exportProject() {
    const blob = new Blob([JSON.stringify(projectPayload(), null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bluek-project.bluek.json";
    link.click();
    URL.revokeObjectURL(link.href);
    status = "Project exported";
  }
  async function shareProject() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = `bluek=${await encodeProjectLink(projectPayload())}`;
    try {
      await navigator.clipboard.writeText(url.href);
      status = "Project link copied";
      shareNotice = "Project link copied to clipboard.";
      window.setTimeout(() => (shareNotice = ""), 3000);
    } catch {
      window.prompt("Copy this project link:", url.href);
      shareNotice = "Project link ready to copy.";
      window.setTimeout(() => (shareNotice = ""), 4000);
    }
  }
  async function saveShortProject() {
    try {
      const { code } = await saveProjectToServer(projectPayload());
      const url = new URL(`/load/${code}`, window.location.origin);
      try {
        await navigator.clipboard.writeText(url.href);
        status = "Short project link copied";
        shareLinkDialog = { url: url.href, code, copied: true };
      } catch {
        window.prompt("Copy this project link:", url.href);
        shareLinkDialog = { url: url.href, code, copied: false };
      }
    } catch (reason) {
      shareNotice = reason instanceof Error ? reason.message : "Project could not be saved on the server.";
      window.setTimeout(() => (shareNotice = ""), 5000);
    }
  }
  async function loadSharedProjectFromCode() {
    const words = shareCodeInput.trim().toLowerCase().split(/[-\s]+/).filter(Boolean);
    if (words.length !== 3 || words.some((word) => !/^[a-z]{4,6}$/.test(word))) {
      shareCodeError = "Enter exactly three words, each 4–6 letters long.";
      return;
    }
    try {
      await loadProject(
        await loadProjectFromServer(words.join("-")),
        "Shared BlueK project loaded. Compile the project.",
      );
      window.history.replaceState(window.history.state, "", "/");
      shareCodeInput = "";
      shareCodeError = "";
      toolbarDialog = null;
    } catch (reason) {
      shareCodeError = reason instanceof Error ? reason.message : "Project could not be loaded.";
    }
  }
  async function copySharedLink() {
    if (!shareLinkDialog) return;
    try {
      await navigator.clipboard.writeText(shareLinkDialog.url);
      shareLinkDialog = { ...shareLinkDialog, copied: true };
    } catch {
      window.prompt("Copy this project link:", shareLinkDialog.url);
    }
  }
  async function loadProject(payload: any, message = "Project loaded.") {
    const imported = projectModelFromPayload(payload, (index) => `project-${Date.now()}-${index}`);
    const frameworkFiles = new Set(["World.kt", "Actor.kt", "Image.kt", "BluePlayFunctions.kt", "BluePlayHelpers.kt"]);
    files = imported.library?.id === "blueplay"
      ? imported.files.filter((file) => !frameworkFiles.has(file.fileName))
      : imported.files;
    library = imported.library;
    resources = imported.resources;
    cardPositions = imported.cardPositions;
    selected = 0;
    editorWindows = [];
    activeEditorId = "";
    editorGroup = null;
    editorTabbed = false;
    markUncompiled();
    status = message;
  }
  async function importProject(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    await openProjectFile(file);
  }
  async function openProjectFile(file: File) {
    try {
      if (!/\.json$/i.test(file.name)) {
        status = "This file format is not implemented yet.";
        return;
      }
      await loadProject(JSON.parse(await file.text()), `Loaded ${file.name}`);
    } catch (reason) {
      status = "Project error";
      error = reason instanceof Error ? reason.message : String(reason);
    }
  }
  async function openProjectDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) await openProjectFile(file);
  }
  async function importKotlin(event: Event) {
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
      files = [
        ...files.filter(
          (file) => !imported.some((item) => item.fileName === file.fileName),
        ),
        ...imported,
      ];
      selected = files.length - imported.length;
      markUncompiled();
    }
  }
  async function importMedia(event: Event) {
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
    resources = [
      ...resources.filter(
        (item) => !imported.some((value) => value.path === item.path),
      ),
      ...imported,
    ];
    markUncompiled();
  }
  async function chooseTemplate(choice: string) {
    if (
      (files.length || resources.length) &&
      !window.confirm(
        "Das aktuelle Projekt enthält Daten. Möchtest du es wirklich ersetzen?",
      )
    )
      return;
    newProjectOpen = false;
    if (client && runtime.phase !== "uncompiled") await client.stop();
    stage = null;
    if (choice === "empty") {
      files = [];
      resources = [];
      cardPositions = {};
      selected = 0;
      markUncompiled();
      status = "New project";
      return;
    }
    const path =
      choice === "kotlin"
        ? "./examples/kotlin-example.bluek.json"
        : choice === "empty-blueplay"
          ? "./examples/blueplay-empty.bluek.json"
          : "./examples/blueplay.bluek.json";
    try {
      const payload = await (await fetch(path)).json();
      if (choice === "empty-blueplay")
        payload.files = payload.files
          .filter((file: ProjectFile) => file.fileName !== "Main.kt")
          .sort(
            (a: ProjectFile, b: ProjectFile) =>
              [
                "BluePlayFunctions.kt",
                "Actor.kt",
                "World.kt",
                "Image.kt",
              ].indexOf(a.fileName) -
              [
                "BluePlayFunctions.kt",
                "Actor.kt",
                "World.kt",
                "Image.kt",
              ].indexOf(b.fileName),
          );
      await loadProject(payload, "Project template loaded.");
      const positions = Object.fromEntries(
        files
          .filter((file) => bluePlayCardPositions[file.fileName])
          .map((file) => [file.id, bluePlayCardPositions[file.fileName]]),
      );
      if (Object.keys(positions).length) cardPositions = positions;
    } catch {
      status = "Project error";
      error = "Could not load project template.";
    }
  }
</script>

<svelte:window
  bind:innerWidth={viewportWidth}
  on:click={() => {
    menu = null;
    codepadMenu = null;
  }}
  on:keydown={handleWindowKeydown}
  on:keyup={(event) =>
    document.activeElement?.classList.contains("game-stage") &&
    stageKey(event, false)}
  on:blur={releaseStageKeys}
/>

<div
  class:terminal-split={terminalOpen && terminalSplit}
  class:bluek-stage-closed={!stageWindowOpen}
  class="bluek svelte-preview"
  style={`--editor-font-size:${editorFontSize}px;--terminal-split-width:${terminalSplitWidth}px;--bluek-stage-height:${stageHeight}px;--bluek-stage-window-width:${stageWindowWidth}px;${stagePosition ? `--bluek-stage-left:${stagePosition.left}px;--bluek-stage-top:${stagePosition.top}px;` : ""}`}
>
  {#if stage && stageWindowOpen}
    <div
      class:maximized={stageMaximized}
      class:stage-compact={(stage.width || 1) * (stage.cellSize || 1) < 560}
      class="stage-window"
      role="dialog"
      aria-label="BluePlay – World"
      data-library={library?.id || ""}
      data-phase={runtime.phase}
      data-simulation={runtime.simulation}
    >
      <div
        class="stage-window-chrome"
        role="toolbar"
        tabindex="0"
        on:pointerdown={beginStageDrag}
      >
        <span>BluePlay – World</span>
        <div>
          <button
            on:click|stopPropagation={() => (stageMaximized = !stageMaximized)}
            aria-label={stageMaximized ? "Restore BluePlay world" : "Maximize BluePlay world"}
            >{stageMaximized ? "❐" : "□"}</button
          >
          <button
            on:click|stopPropagation={() => {
              stageWindowOpen = false;
              stageMaximized = false;
            }}
            aria-label="Close BluePlay world"
            >×</button
          >
        </div>
      </div>
      <div class="stage-window-body">
        <canvas
          bind:this={stageCanvas}
          class="game-stage"
          class:game-canvas={true}
          role="button"
          aria-label="BluePlay world"
          tabindex="0"
          style={stageStyle(stage)}
          on:click={stageClick}
        ></canvas>
      </div>
      <div class="game-controls" aria-label="BluePlay controls">
        {#if mainEntries.length}<button
            on:click={resetGame}
            disabled={!canExecute}
            aria-label="Reset BluePlay world">Reset</button
          >{/if}
        <button
          on:click={() => bluePlayAction("step")}
          disabled={!canExecute || stageRunning}
          aria-label="Act once">Act</button
        >
        <button
          on:click={() => bluePlayAction("start")}
          disabled={!canExecute || stageRunning}
          aria-label="Run BluePlay world">Run</button
        >
        <button
          on:click={() => bluePlayAction("stop")}
          disabled={!stageRunning}
          aria-label="Pause BluePlay world">Pause</button
        >
        <label
          >Speed <input
            aria-label="Speed"
            type="range"
            min="1"
            max="100"
            bind:value={speed}
            disabled={runtime.phase !== "ready" && runtime.phase !== "waitingForInput"}
            on:input={() => bluePlayAction("setSpeed")}
          /></label
        >
      </div>
    </div>
  {/if}
  <div class="toolbar">
    <button class="toolbar-main-action" on:click={() => (newProjectOpen = true)} aria-label="New Project" title="New Project">
      <span class="toolbar-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 2.5h10l4 4V21.5H5z"/><path d="M15 2.5v4h4"/></svg></span><span>New Project</span>
    </button>
    <button class="toolbar-main-action" on:click={() => (toolbarDialog = "open")} aria-label="Open / Import" title="Open / Import">
        <span class="toolbar-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 19h12M12 16V5M9 8l3-3 3 3"/></svg></span><span>Open / Import</span>
      </button>
    <button class="toolbar-main-action" on:click={() => (toolbarDialog = "save")} disabled={!files.length} aria-label="Save / Export" title="Save / Export">
        <span class="toolbar-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 5h12M12 8v11M9 16l3 3 3-3"/></svg></span><span>Save / Export</span>
      </button>
    <button class="toolbar-main-action" on:click={() => (filesNotice = true)} aria-label="Files" title="Files">
      <span class="toolbar-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 3.5h7l1.5 2H20v4H7v11H4z"/><path d="M7 9.5v11h13v-11M10 13h7M10 16h5"/></svg></span><span>Files</span>
    </button>
    <div class="toolbar-options">
      <button
        class:active={terminalOpen}
        class="toolbar-icon-button"
        on:click={() => {
          terminalOpen = !terminalOpen;
          if (terminalOpen) activeWindow = "terminal";
          if (!terminalOpen) terminalSplit = false;
        }}
        aria-label={terminalOpen ? "Hide terminal" : "Show terminal"}
        title={terminalOpen ? "Hide terminal" : "Show terminal"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><rect x="2.5" y="3" width="19" height="18" rx="2" /><path
            d="M6 9l3 3-3 3M11 15h5"
          /></svg
        >
      </button>
      <button
        class:active={showInheritance}
        class="toolbar-icon-button"
        on:click={toggleInheritance}
        aria-label={showInheritance
          ? "Hide inheritance arrows"
          : "Show inheritance arrows"}
        title={showInheritance
          ? "Hide inheritance arrows"
          : "Show inheritance arrows"}
      >
        <svg viewBox="0 0 32 24" aria-hidden="true"
          ><rect x="2" y="2" width="11" height="6" rx="1" /><rect
            x="19"
            y="16"
            width="11"
            height="6"
            rx="1"
          /><path d="M24.5 16L8 8" /><path
            class="toolbar-arrowhead"
            d="M5.5 7.5L10 5.5 9 10z"
          /></svg
        >
      </button>
      <button
        class="toolbar-icon-button settings-button"
        on:click={() => (settingsNotice = true)}
        aria-label="Settings"
        title="Settings"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><path
            d="M9.7 3.8l.6-1.3h3.4l.6 1.3 1.3.6 1.4-.3 2.4 2.4-.3 1.4.6 1.3 1.3.6v3.4l-1.3.6-.6 1.3.3 1.4-2.4 2.4-1.4-.3-1.3.6-.6 1.3h-3.4l-.6-1.3-1.3-.6-1.4.3-2.4-2.4.3-1.4-.6-1.3-1.3-.6V9.8l1.3-.6.6-1.3-.3-1.4 2.4-2.4 1.4.3zM12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"
          /></svg
        >
      </button>
    </div>
  </div>
  <div class="body">
    <nav class="sidebar">
      <button
        on:click={() => {
          newClassOpen = true;
          newClassName = "";
          newClassType = "class";
        }}>New File</button
      >
      <button class="sidebar-legacy-save" on:click={exportProject}
        >Save Project</button
      >
      <button
        class:active-tool={inheritanceMode}
        disabled={displayFiles.filter((file) => file.kind === "class").length < 2}
        on:click={() => {
          inheritanceMode = !inheritanceMode;
          inheritanceSelection = "";
          status = inheritanceMode
            ? "Select subclass, then superclass"
            : "Ready";
        }}
      >
        Inheritance<span class="inheritance-icon" aria-hidden="true"
          ><svg viewBox="0 0 72 32"
            ><line x1="2" y1="16" x2="40" y2="16" /><path
              d="M40 2 L70 16 L40 30 Z"
            /></svg
          ></span
        >
      </button>
      <button
        on:click={compile}
        disabled={!files.length ||
          runtime.phase === "compiling" ||
          runtime.phase === "running" ||
          inputReady}>Compile</button
      >
      <div class="side-spacer"></div>
    </nav>
    <section
      class="workspace"
      style={`--pane-split:${paneSplit}%;--upper-pane:${paneSplit}%;${benchWidth ? `--bench-width:${benchWidth}px;` : ""}`}
    >
      <div class="panels">
        <div class="canvas">
          {#if showInheritance}
            <svg class="inheritance-layer" aria-hidden="true"
              ><defs
                ><marker
                  id="svelte-inheritance-arrow"
                  viewBox="0 0 14 14"
                  refX="12"
                  refY="7"
                  markerWidth="14"
                  markerHeight="14"
                  markerUnits="userSpaceOnUse"
                  orient="auto"><path d="M 0 0 L 12 7 L 0 14 Z" /></marker
                ></defs
              >
              {#each inheritanceEdges as edge}<line
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  marker-end="url(#svelte-inheritance-arrow)"
                />{/each}
            </svg>
          {/if}
          <div class="cards">
            {#each displayFiles as file, index (file.id)}
              {@const position = displayCardPositions[index]}
              <div
                role="button"
                tabindex="0"
                aria-label={file.fileName.replace(".kt", "")}
                class:uncompiled={runtime.phase === "uncompiled"}
                class:inheritance-selected={inheritanceSelection === file.id}
                class="classcard"
                style={`left:${position.x}px;top:${position.y}px;--card-left:${position.x}px;--card-top:${position.y}px`}
                on:mousedown={(event) => {
                  if (!inheritanceMode) beginCardDrag(event, file);
                }}
                on:pointermove={(event) => moveCard(event, file)}
                on:pointerup={endCardDrag}
                on:pointercancel={endCardDrag}
                on:click={() => selectCard(file, index)}
                on:dblclick={() => {
                  if (inheritanceMode) return;
                  if (isBluePlayFrameworkFile(file)) openBluePlayApi(file);
                  else openEditor(file);
                }}
                on:contextmenu={(event) => openMenu(event, file)}
                on:keydown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectCard(file, index);
                  }
                }}
              >
                <div class="card-header">
                  {#if file.kind === "functions"}<small>«functions»</small
                    >{/if}<strong>{file.fileName.replace(".kt", "")}</strong>
                </div>
                <div class="card-body"></div>
              </div>
            {/each}
          </div>
        </div>
      </div>
      <div
        class="pane-splitter"
        role="separator"
        aria-label="Resize upper and lower panes"
        on:pointerdown={beginPaneResize}
      ></div>
      <div class:codepad-collapsed={!codepadOpen} class="lower">
        <section class="bench">
          <div class="bench-items">
            {#each bench as object (object.name)}
              <div
                role="button"
                tabindex="0"
                class:selected={selectedObjectId === object.objectId}
                class="object"
                on:click={() => (selectedObjectId = object.objectId)}
                on:dblclick={() => inspectObject(object)}
                on:keydown={(event) =>
                  event.key === "Enter" && inspectObject(object)}
                on:contextmenu={(event) => {
                  selectedObjectId = object.objectId;
                  openMenu(event, undefined, object);
                }}
              >
                {object.name}:<br /><span>{object.className}</span>
              </div>
            {/each}
          </div>
        </section>
        <div
          class="bench-codepad-splitter"
          role="separator"
          aria-label="Resize object bench and codepad"
          on:pointerdown={beginBenchResize}
        ></div>
        <button
          class="codepad-toggle"
          aria-label={codepadOpen ? "Collapse Codepad" : "Expand Codepad"}
          on:click={() => (codepadOpen = !codepadOpen)}
          >{codepadOpen ? "›" : "‹"}</button
        >
        {#if codepadOpen}
          <section class="codepad">
            <div
              class="codepad-history"
              role="log"
              aria-label="Codepad history"
              on:contextmenu|preventDefault|stopPropagation={(event) =>
                (codepadMenu = { x: event.clientX, y: event.clientY })}
            >
              {#each history as entry}
                <div
                  class="codepad-entry"
                  role="group"
                  on:contextmenu|preventDefault|stopPropagation={(event) =>
                    (codepadMenu = {
                      x: event.clientX,
                      y: event.clientY,
                      text: entry.code,
                    })}
                >
                  <div>{entry.code}</div>
                  {#if entry.objectResult || entry.objectId}
                    <button
                      class="codepad-object-result svelte-codepad-object-result"
                      disabled={!entry.objectId || !runtime.liveObjectIds.includes(entry.objectId)}
                      on:click={() =>
                        entry.objectId &&
                        requestObjectOnBench({
                          kind: "object",
                          objectId: entry.objectId,
                          className: entry.className || "Object",
                        })}
                      aria-label={`Get ${entry.className || "object"} on object bench`}
                    >
                      <span class="codepad-object-icon" aria-hidden="true"
                      ></span><span class="codepad-object-label"
                        >{#if entry.result}<span class="codepad-result-value" title={entry.result}
                          >{codepadResultValue(entry.result)}</span
                        ><span class="codepad-result-type">{codepadResultType(entry.result)}</span
                        >{:else}<span class="codepad-object-placeholder"
                          >&lt;object&gt;</span
                        ><span> : {entry.className}</span>{/if}</span
                      >
                    </button>
                  {:else if entry.error}<div class="codepad-error">
                      {entry.error}
                    </div>
                  {:else if entry.result}<div class="codepad-result">
                      <span class="codepad-value-icon" aria-hidden="true"></span><span class="codepad-result-value" title={entry.result}
                        >{codepadResultValue(entry.result)}</span
                      ><span class="codepad-result-type">{codepadResultType(entry.result)}</span>
                    </div>{/if}
                </div>
              {/each}
            </div>
            <textarea
              aria-label="Codepad input"
              rows="1"
              bind:value={codepad}
              on:keydown={submitCodepad}
              disabled={codepadIsDisabled(runtime.phase, inputReady)}
            ></textarea>
          </section>
        {/if}
      </div>
      <footer class="status-bar">
        <span class="current-element"
          >{selectedObjectId &&
          bench.find((object) => object.objectId === selectedObjectId)
            ? `${bench.find((object) => object.objectId === selectedObjectId)?.name} : ${bench.find((object) => object.objectId === selectedObjectId)?.className}`
            : "No object selected"}</span
        >
        {#if !terminalOpen && (terminal || inputReady)}<button
            class="terminal-reopen"
            on:click={() => {
              terminalOpen = true;
              activeWindow = "terminal";
            }}>Terminal</button
          >{/if}
        <span
          class:active={programActive}
          class="activity-bar"
          role="progressbar"
          aria-busy={programActive}
          title={programActive ? "BlueK is running" : "Ready"}
          aria-label={runtime.phase === "compiling"
            ? "Compiling"
            : runtime.phase === "running" || inputReady
              ? "Program active"
              : "Ready"}
        >{#if programActive}<span class="activity-indicator" aria-hidden="true"></span>{/if}</span>
        <button
          class="reset-runtime"
          aria-label="Reset runtime"
          title="Reset"
          on:click={resetRuntime}
          disabled={runtime.phase === "compiling"}>↶</button
        >
      </footer>
    </section>
  </div>
  {#if shareNotice}<div class="share-notice" role="status" aria-live="polite">{shareNotice}</div>{/if}
  {#if terminalOpen}<div
      class:terminal-modal-split={terminalSplit}
      class:window-active={activeWindow === "terminal"}
      class="terminal-modal"
      on:pointerdown={() => (activeWindow = "terminal")}
    >
      <div
        class:split={terminalSplit}
        class:maximized={terminalMaximized}
        class:floating={Boolean(terminalPosition) &&
          !terminalSplit &&
          !terminalMaximized}
        class="terminal-window"
        style={`${terminalSplit ? `width:${terminalSplitWidth}px;height:100vh;position:fixed;right:0;top:0;margin:0;` : terminalMaximized ? "" : `width:${terminalSize.width}px;height:${terminalSize.height}px;`} ${terminalPosition && !terminalSplit && !terminalMaximized ? `left:${terminalPosition.left}px;top:${terminalPosition.top}px;` : ""}`}
      >
        <div
          role="toolbar"
          tabindex="0"
          class="terminal-header window-header"
          on:pointerdown={(event) => {
            activeWindow = "terminal";
            beginTerminalDrag(event);
          }}
        >
          <span>BlueK Terminal</span>
          <div>
            <button
              on:click|stopPropagation={toggleTerminalMaximized}
              aria-label={terminalMaximized
                ? "Restore terminal window"
                : "Maximize terminal window"}
              >{terminalMaximized ? "❐" : "□"}</button
            ><button
              class="terminal-split-toggle"
              on:click|stopPropagation={toggleTerminalSplit}
              aria-label={terminalSplit
                ? "Restore terminal window"
                : "Split terminal to the right"}>◫</button
            ><button
              on:click|stopPropagation={() => {
                terminalOpen = false;
                terminalMaximized = false;
                terminalSplit = false;
                terminalPosition = null;
              }}>×</button
            >
          </div>
        </div>
        <div class="terminal-output">
          {#key terminal}<pre>{#each terminalParts(terminal) as part}<span
                  class:terminal-input-echo={part.input}>{part.text}</span
                >{/each}</pre>{/key}
          <button
            class="terminal-clear"
            on:click|stopPropagation={clearTerminal}
            aria-label="Clear terminal">⌫</button
          >
        </div>
        {#if runtime.phase === "faulted"}<div
            class="terminal-notice"
            role="alert"
          >
            Execution stopped. Reset the runtime before running more code.<button
              on:click={resetRuntime}>Reset runtime</button
            >
          </div>{/if}<input
          bind:this={inputElement}
          placeholder={inputReady ? "Enter a line; press Return" : ""}
          disabled={!inputReady}
          on:keydown={sendInput}
        />{#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as direction}<div
            role="separator"
            class={`terminal-resize-handle terminal-resize-${direction}`}
            on:pointerdown={(event) => beginTerminalResize(event, direction)}
          ></div>{/each}
      </div>
    </div>{/if}
  {#if editorWindows.length}<div class:window-active={activeWindow === "editor"} class="modal editor-modal">
      {#if editorTabbed && editorGroup}
        {@const editorFile = files.find((file) => file.id === activeEditorId.replace(/^editor-/, "")) || files.find((file) => file.id === editorGroup?.fileId)}
        {#if editorFile}<div
          class:maximized={editorGroup.maximized}
          class:floating={Boolean(editorGroup.position) && !editorGroup.maximized}
          class="dialog editor-dialog editor-tabbed-dialog"
          style={`${editorGroup.maximized ? "" : `width:${editorGroup.size.width}px;height:${editorGroup.size.height}px;`} ${editorGroup.position && !editorGroup.maximized ? `left:${editorGroup.position.left}px;top:${editorGroup.position.top}px;` : ""}`}
          on:pointerdown={() => { activeWindow = "editor"; }}
        >
          <div
            class="editor-header window-header"
            role="toolbar"
            tabindex="0"
            on:pointerdown={(event) => {
              activeWindow = "editor";
              beginEditorDrag(event, activeEditorId);
            }}
          >
            <div class="editor-tabs" role="tablist" aria-label="Open editor files">
              {#each editorWindows as tabWindow (tabWindow.id)}
                {@const tabFile = files.find((file) => file.id === tabWindow.fileId)}
                {#if tabFile}<button
                  class:active={tabWindow.id === activeEditorId}
                  role="tab"
                  aria-selected={tabWindow.id === activeEditorId}
                  on:click={() => selectEditorTab(tabWindow.id)}
                ><span>{tabFile.fileName}</span><span
                    class="editor-tab-close"
                    role="button"
                    tabindex="0"
                    aria-label={`Close ${tabFile.fileName}`}
                    on:click|stopPropagation={() => closeEditor(tabWindow.id)}
                    on:keydown|stopPropagation={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        closeEditor(tabWindow.id);
                      }
                    }}>×</span></button>{/if}
              {/each}
            </div>
            <div class="editor-window-controls">
              <button
                on:click={() => toggleEditorMaximized(activeEditorId)}
                aria-label={editorGroup.maximized ? "Restore editor window" : "Maximize editor window"}
                title={editorGroup.maximized ? "Restore editor window" : "Maximize editor window"}
              >{editorGroup.maximized ? "❐" : "□"}</button>
              <button
                on:click={ungroupEditors}
                aria-label="Ungroup editor tabs"
                title="Ungroup editor tabs"
              ><svg class="window-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 10L3 3M3 9V3h6M14 10l7-7M15 3h6v6M10 14l-7 7M3 15v6h6M14 14l7 7M21 15v6h-6"/></svg></button>
              <button on:click={closeAllEditors} aria-label="Close all editors" title="Close all editors">×</button>
            </div>
          </div>
          <div
            class="svelte-editor-host"
            on:pointerdown={() => { activeWindow = "editor"; }}
            use:codeMirror={{ id: activeEditorId, value: editorFile.source, fontSize: editorFontSize, onChange: (value: string) => updateSource(editorFile.id, value) }}
          ><button
              class="editor-format"
              on:click={() => formatEditor(activeEditorId)}
              aria-label="Format Kotlin file"
              title={`Format Kotlin file (${formatShortcutLabel})`}
            >≡</button></div>
          {#if dialogError}<div class="dialog-error editor-dialog-error" role="alert"><span>{dialogError}</span><button
              type="button"
              class="dialog-error-close"
              aria-label="Close format error"
              title="Close format error"
              on:click={() => (dialogError = "")}
            >×</button></div>{/if}
          {#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as direction}<div
            role="separator"
            aria-label={`Resize editor ${direction}`}
            class={`editor-resize-handle editor-resize-${direction}`}
            on:pointerdown={(event) => {
              activeWindow = "editor";
              beginEditorResize(event, activeEditorId, direction);
            }}
          ></div>{/each}
        </div>{/if}
      {:else}{#each editorWindows as editorWindow (editorWindow.id)}
          {@const editorFile = files.find((file) => file.id === editorWindow.fileId)}
          {#if editorFile}<div
            class:maximized={editorWindow.maximized}
            class:floating={Boolean(editorWindow.position) && !editorWindow.maximized}
            class:editor-window-active={activeEditorId === editorWindow.id}
            class="dialog editor-dialog"
            style={`${editorWindow.maximized ? "" : `width:${editorWindow.size.width}px;height:${editorWindow.size.height}px;`} ${editorWindow.position && !editorWindow.maximized ? `left:${editorWindow.position.left}px;top:${editorWindow.position.top}px;` : ""} z-index:${activeEditorId === editorWindow.id ? 2 : 1};`}
            on:pointerdown={() => { activeWindow = "editor"; activeEditorId = editorWindow.id; }}
          >
            <div
              class="editor-header window-header"
              role="toolbar"
              tabindex="0"
              on:pointerdown={(event) => {
                activeWindow = "editor";
                activeEditorId = editorWindow.id;
                beginEditorDrag(event, editorWindow.id);
              }}
            >
              <h3>{editorFile.fileName}</h3>
              <div class="editor-window-controls">
                <button
                  on:click={() => toggleEditorMaximized(editorWindow.id)}
                  aria-label={editorWindow.maximized ? "Restore editor window" : "Maximize editor window"}
                  title={editorWindow.maximized ? "Restore editor window" : "Maximize editor window"}
                >{editorWindow.maximized ? "❐" : "□"}</button>
                <button
                  disabled={editorWindows.length < 2}
                  on:click={collectEditors}
                  aria-label="Collect editor windows into tabs"
                  title="Collect editor windows into tabs"
                ><svg class="window-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l7 7M10 4v6H4M21 3l-7 7M14 4v6h6M3 21l7-7M4 14h6v6M21 21l-7-7M14 20v-6h6"/></svg></button>
                <button on:click={() => closeEditor(editorWindow.id)} aria-label="Close editor" title="Close editor">×</button>
              </div>
            </div>
            <div
              class="svelte-editor-host"
              on:pointerdown={() => { activeWindow = "editor"; activeEditorId = editorWindow.id; }}
              use:codeMirror={{ id: editorWindow.id, value: editorFile.source, fontSize: editorFontSize, onChange: (value: string) => updateSource(editorFile.id, value) }}
            ><button
                class="editor-format"
                on:click={() => formatEditor(editorWindow.id)}
                aria-label="Format Kotlin file"
                title={`Format Kotlin file (${formatShortcutLabel})`}
              >≡</button></div>
            {#if dialogError}<div class="dialog-error editor-dialog-error" role="alert"><span>{dialogError}</span><button
                type="button"
                class="dialog-error-close"
                aria-label="Close format error"
                title="Close format error"
                on:click={() => (dialogError = "")}
              >×</button></div>{/if}
            {#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as direction}<div
              role="separator"
              aria-label={`Resize editor ${direction}`}
              class={`editor-resize-handle editor-resize-${direction}`}
              on:pointerdown={(event) => {
                activeWindow = "editor";
                activeEditorId = editorWindow.id;
                beginEditorResize(event, editorWindow.id, direction);
              }}
            ></div>{/each}
          </div>{/if}
        {/each}{/if}
    </div>{/if}
  {#if compilerDialog}<div class="modal" role="presentation">
      <div
        class="dialog compiler-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="compiler-error-title"
      >
        <h3 id="compiler-error-title">Compiler errors</h3>
        <p>The project could not be compiled.</p>
        {#each compilerDiagnostics as diagnostic}<div
            class="compiler-error-location"
          >
            <strong>{diagnostic.fileName || "Kotlin source"}</strong> · line {diagnostic.line},
            column {diagnostic.column}
          </div>
          {#if files.find((file) => file.fileName === diagnostic.fileName)}<div
              class="compiler-error-code"
              aria-label="Source code at compiler error"
            >
              {#each files
                .find((file) => file.fileName === diagnostic.fileName)
                ?.source.split("\n") || [] as sourceLine, index}<div
                  class:compiler-error-line-marked={index + 1 ===
                    diagnostic.line}
                >
                  <span class="compiler-error-line-number"
                    >{String(index + 1).padStart(3, " ")}</span
                  ><code>{sourceLine || " "}</code
                  >{#if index + 1 === diagnostic.line}<span
                      class="compiler-error-marker"
                      style={`--error-column:${Math.max(0, (diagnostic.column || 1) - 1)}ch`}
                      aria-label="Error location">^</span
                    >{/if}
                </div>{/each}
            </div>{/if}
          <pre
            class="compiler-error-message">{diagnostic.message}</pre>{/each}{#if !compilerDiagnostics.length}<pre
            class="compiler-error-text">{error}</pre>{/if}<div class="dialog-actions"><button
          use:focusOnMount
          on:click={() => (compilerDialog = false)}>Close</button></div>
      </div>
    </div>{/if}

  {#each inspectorViews as inspector, index (inspector.id)}
    <div class="inspector">
      <div
        class="inspect-window"
        role="dialog"
        aria-label="Object inspector"
        tabindex="-1"
        style={`position:fixed;left:${inspector.position.left}px;top:${inspector.position.top}px;margin:0;z-index:${inspector.id === activeInspectorId ? 100 : 10 + index}`}
        on:pointerdown={(event) => {
          bringInspectorToFront(inspector.id);
          if (
            !(event.target as HTMLElement).closest("button,input,.inspect-row")
          )
            beginInspectorDrag(event, inspector.id);
        }}
        on:click={() => bringInspectorToFront(inspector.id)}
        on:keydown={(event) => {
          if (event.key === "Escape" && (!editingField || inspected?.objectId !== inspector.id)) {
            event.preventDefault();
            event.stopPropagation();
            closeInspector(inspector.id);
          }
        }}
      >
        <h2>
          {`${inspector.referenceName} : ${inspectorType(inspector.data)}`}
        </h2>
        <div
          class="inspect-fields"
          class:inspect-no-fields={!inspector.data.fields?.length}
        >
          {#each inspector.data.fields || [] as field}
            {@const property = fieldProperty(inspector.data, field)}
            {@const editable = canEditField(field, inspector.data)}
            {@const privateField = property?.visibility === "private"}
            {@const editing =
              editingField === field.name &&
              inspected?.objectId === inspector.id}
            <div
              class:editable
              class:private-field={privateField}
              class:private-setter={field.setterPrivate === true}
              class="inspect-row"
              role="group"
              on:dblclick={() =>
                editable && !editing && beginFieldEdit(field, inspector.data)}
            >
              <span
                >{field.name} : {fieldProperty(inspector.data, field)?.type
                  ?.displayName ||
                  field.type?.displayName ||
                  "Any?"}</span
              >
              {#if editing}
                <input
                  use:focusOnMount
                  aria-label={`Value of ${field.name}`}
                  aria-invalid={Boolean(fieldError)}
                  bind:value={fieldDraft}
                  on:keydown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      editingField = "";
                    }
                    if (event.key === "Enter") saveField(field);
                  }}
                />
                {#if fieldError}<small class="inspect-error">{fieldError}</small
                  >{/if}
              {:else}
                <output title={fieldValue(inspector.data, field)}
                  >{fieldValue(inspector.data, field)}</output
                >
                {#if editable || field.setterPrivate}<button
                    class="inspect-edit"
                    class:inspect-edit-disabled={!editable}
                    disabled={!editable}
                    aria-label={`Edit ${field.name}`}
                    title={field.setterPrivate ? "The setter is private" : "Edit"}
                    on:click={() => beginFieldEdit(field, inspector.data)}
                    >✎</button
                  >{/if}
              {/if}
            </div>
          {:else}No fields{/each}
        </div>
        <div class="dialog-actions"><button on:click={() => closeInspector(inspector.id)}>Close</button></div>
      </div>
    </div>
  {/each}
  {#if createDialog}<div class="modal" role="presentation">
      <div
        class="dialog create-object-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="create-object-title"
        use:containClicks
      >
        <h3 id="create-object-title">
          Create {createDialog.className}{createDialog.typeParameters.length
            ? `<${createTypeArgs.map((value) => value || "…").join(", ")}>`
            : ""}
        </h3>
        <label
          >Name of instance<input
            bind:value={createName}
            use:focusOnMount={!createDialog.parameters.length &&
              !createDialog.typeParameters.length}
            on:keydown={(event) => {
              if (event.key === "Escape") createDialog = null;
              if (event.key === "Enter") confirmCreate();
            }}
          /></label
        >{#if createDialog.constructors.length > 1}<label
            >Constructor<select
              bind:value={createDialog.constructorIndex}
              on:change={(event) =>
                chooseConstructor(
                  Number((event.currentTarget as HTMLSelectElement).value),
                )}
              >{#each createDialog.constructors as constructor, index}<option
                  value={index}
                  >{createDialog.className}({constructor.parameters
                    ?.map(
                      (parameter: any) =>
                        `${parameter.name}: ${parameter.type?.displayName || "Any?"}`,
                    )
                    .join(", ")})</option
                >{/each}</select
            ></label
          >{/if}{#each createDialog.typeParameters as typeParameter, index}<label
            >Type argument {typeParameter}<input
              bind:value={createTypeArgs[index]}
              use:focusOnMount={index === 0}
              on:keydown={(event) => event.key === "Enter" && confirmCreate()}
            /></label
          >{/each}{#each createDialog.parameters as parameter, index}<label
            >{parameter.name}: {parameter.type?.displayName ||
              "Any?"}{parameter.hasDefault ? " (optional)" : ""}<input
              bind:value={createArgs[index]}
              use:focusOnMount={index === 0}
              on:keydown={(event) => event.key === "Enter" && confirmCreate()}
            /></label
          >{/each}{#if dialogError}<div class="dialog-error" role="alert">
            {dialogError}
          </div>{/if}<div class="dialog-actions"><button on:click={() => (createDialog = null)}
          >Cancel</button
        ><button
          on:click={confirmCreate}
          disabled={!canExecute ||
            missingTypeArgument(createTypeArgs) ||
            missingRequired(createDialog.parameters, createArgs)}>Create</button></div>
      </div>
    </div>{/if}
  {#if invokeDialog}<div class="modal" role="presentation">
      <div
        class="dialog method-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="invoke-method-title"
        use:containClicks
      >
        <h3 id="invoke-method-title">
          {invokeDialog.object?.name ||
            invokeDialog.receiver ||
            ""}.{invokeDialog.method.name}()
        </h3>
        {#each invokeDialog.method.typeParameters || [] as typeParameter, index}<label
            >Type argument {typeParameter}<input
              bind:value={invokeTypeArgs[index]}
              use:focusOnMount={index === 0}
              on:keydown={(event) => event.key === "Enter" && confirmInvoke()}
            /></label
          >{/each}{#each invokeDialog.method.parameters || [] as parameter, index}<label
            >{parameter.name}: {parameter.type?.displayName ||
              "Any?"}{parameter.hasDefault ? " (optional)" : ""}<input
              bind:value={invokeArgs[index]}
              use:focusOnMount={index === 0}
              on:keydown={(event) => event.key === "Enter" && confirmInvoke()}
            /></label
          >{/each}{#if dialogError}<div class="dialog-error" role="alert">
            {dialogError}
          </div>{/if}<div class="dialog-actions"><button on:click={() => (invokeDialog = null)}
          >Cancel</button
        ><button
          on:click={confirmInvoke}
          disabled={!canExecute ||
            missingTypeArgument(invokeTypeArgs) ||
            missingRequired(invokeDialog.method.parameters || [], invokeArgs)}
          >Invoke</button></div>
      </div>
    </div>{/if}
  {#if resultDialog}<div class="modal">
      <div
        class="dialog result-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        <h3>Method result</h3>
        <div class="result-method">{resultDialog.method}</div>
        <output class="result-value">{resultDialog.value}</output>
        <div class="result-actions">
          {#if resultDialog.objectId}<button
              on:click={() => {
                const object = {
                  objectId: resultDialog!.objectId!,
                  className: resultDialog!.className || "Object",
                  name: resultDialog!.className || "Object",
                };
                inspectObject(object);
                resultDialog = null;
              }}>Inspect</button
            ><button
              on:click={() => {
                requestObjectOnBench({
                  objectId: resultDialog!.objectId!,
                  className: resultDialog!.className || "Object",
                  name: resultDialog!.className || "Object",
                  kind: "object",
                });
                resultDialog = null;
              }}>Get</button
            >{/if}<button on:click={() => (resultDialog = null)}>Close</button>
        </div>
      </div>
    </div>{/if}
  {#if newProjectOpen}<div class="modal topmost-modal">
      <div
        class="dialog new-project-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="new-project-title"
      >
        <h3 id="new-project-title">Create New Project</h3>
        <p>Choose a starting point:</p>
        <div class="project-choice-list">
          <div class="project-choice-row">
            <button on:click={() => chooseTemplate("empty")}><strong>Empty Project</strong><span>Start with a blank BlueK project.</span></button>
            <button on:click={() => chooseTemplate("kotlin")}><strong>Kotlin Example</strong><span>Start with a small Kotlin example.</span></button>
          </div>
          <div class="project-choice-with-info">
            <button on:click={() => chooseTemplate("empty-blueplay")}><strong>BluePlay Template</strong><span>Start with the built-in World, Actor and Image library.</span></button
            ><button
            class="project-info-button"
            on:click|stopPropagation={() => (projectInfo = "template")}
            aria-label="What is BluePlay?">?</button
            >
          </div>
          <div class="project-choice-with-info">
            <button on:click={() => chooseTemplate("blueplay")}><strong>BluePlay Example</strong><span>Open a small runnable World and Actor project.</span></button
            ><button
            class="project-info-button"
            on:click|stopPropagation={() => (projectInfo = "example")}
            aria-label="What is BluePlay?">?</button
            >
          </div>
        </div>
        <div class="dialog-actions"><button
          on:click={() => {
            newProjectOpen = false;
            projectInfo = null;
          }}>Cancel</button></div
        >{#if projectInfo}<div
            class="project-info-panel"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
          >
            <button
              class="project-info-close"
              on:click={() => (projectInfo = null)}
              aria-label="Close BluePlay information">×</button
            >
            <h4>What is BluePlay?</h4>
            <p>
              BluePlay is a lightweight Kotlin framework for creating graphical
              games and simulations with worlds, actors and images.
            </p>
            <p>
              {projectInfo === "template"
                ? "The template provides an empty starting point."
                : "The example demonstrates a small World and Actor project."}
            </p>
            <a
              href="https://github.com/tomkarp/BluePlay"
              target="_blank"
              rel="noreferrer">View BluePlay on GitHub</a
            >
          </div>{/if}
      </div>
    </div>{/if}
  {#if bluePlayApiFile}{@const api = bluePlayApiDocs[bluePlayApiFile.fileName]}<div class="modal topmost-modal">
      <div
        class="dialog blueplay-api-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="blueplay-api-title"
      >
        <h3 id="blueplay-api-title">{api.title}</h3>
        <p>{api.summary}</p>
        <ul class="blueplay-api-members">
          {#each api.members as member}<li><code>{member}</code></li>{/each}
        </ul>
        <div class="dialog-actions"><button on:click={() => (bluePlayApiFile = null)}>Close</button></div>
      </div>
    </div>{/if}
  {#if newClassOpen}<div class="modal topmost-modal" role="presentation">
      <div
        class="dialog new-class-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="new-class-title"
        use:containClicks
      >
        <h3 id="new-class-title">Create New Kotlin File</h3>
        <label
          >Name<input
            bind:value={newClassName}
            use:focusOnMount
            placeholder="e.g. Animal"
            on:keydown={(event) => event.key === "Enter" && confirmNewClass()}
          /></label
        >
        <fieldset>
          <legend>Type</legend
          >{#each [["class", "Class"], ["interface", "Interface"], ["open", "Open Class"], ["abstract", "Abstract Class"], ["data", "Data Class"], ["functions", "Kotlin Functions"]] as option}<label
              class="new-class-option"
              ><input
                type="radio"
                name="svelte-new-class-type"
                value={option[0]}
                bind:group={newClassType}
              /><span>{option[1]}</span></label
            >{/each}
        </fieldset>
        {#if error}<div class="dialog-error" role="alert">
            {error}
          </div>{/if}<div class="dialog-actions"><button on:click={() => (newClassOpen = false)}
          >Cancel</button
        ><button on:click={confirmNewClass}>Create</button></div>
      </div>
    </div>{/if}

  {#if menu}
    <div
      class="popup"
      style={`left:${menu.x}px;top:${menu.y}px`}
      use:fitPopup
      use:containClicks
    >
      <div class="popup-title">
        {menu.object?.className || menu.file?.fileName.replace(".kt", "")}
      </div>
      {#if menu.file && isBluePlayFrameworkFile(menu.file)}
        <button on:click={() => openBluePlayApi(menu!.file!)}>Show API documentation</button>
      {:else if menu.file}
        {#each classes.find((item) => item.name === menu!.file!.fileName.replace(".kt", ""))?.constructors || [] as constructor, index}
          <button
            class="constructor-menu-item"
            disabled={!canExecute}
            on:click={() =>
              createObject(menu!.file!.fileName.replace(".kt", ""), index)}
          >
            {menu.file.fileName.replace(".kt", "")}({constructor.parameters
              ?.map(
                (parameter: any) =>
                  `${parameter.name}: ${parameter.type?.displayName || "Any?"}`,
              )
              .join(", ")})
          </button>
        {/each}
        {#each fileMethods(menu.file) as method}
          <button
            disabled={!canExecute}
            on:click={() =>
              invokeClassMethod(
                menu!.file!.fileName.replace(".kt", ""),
                method,
              )}>{methodLabel(method)}</button
          >
        {/each}
        <hr />
        <button on:click={() => openEditor(menu?.file)}>Open Editor</button>
        <button
          disabled={!canExecute && runtime.phase !== "uncompiled"}
          on:click={() => {
            menu = null;
            compile();
          }}>Compile</button
        >
        <button on:click={() => deleteFile(menu!.file!)}>Delete</button>
        <button on:click={() => duplicateFile(menu!.file!)}>Duplicate…</button>
      {:else if menu.object}
        {#each inheritedPopupGroups(menu.object) as group}
          <div class="popup-submenu">
            <button class="popup-submenu-trigger" use:containClicks
              >inherited from {group[0]}<span>›</span></button
            >
            <div class="popup-submenu-panel">
              {#each group[1] as method}<button
                  class="method-menu-item"
                  disabled={!canExecute}
                  on:click={() => invokeObject(menu!.object!, method)}
                  >{methodLabel({
                    ...method,
                    inheritedFrom: undefined,
                  })}</button
                >{/each}
            </div>
          </div>
        {/each}
        {#if inheritedPopupGroups(menu.object).length}<hr />{/if}
        {#each directPopupMethods(menu.object) as method}
          <button
            class="method-menu-item"
            disabled={!canExecute}
            on:click={() => invokeObject(menu!.object!, method)}
            >{popupObjectMethodLabel(method)}</button
          >
        {:else}<div class="popup-no-methods">
            (No accessible methods)
          </div>{/each}
        <hr />
        <button
          disabled={!canExecute}
          on:click={() => inspectObject(menu!.object!)}>Inspect</button
        >
        <button
          disabled={!canExecute}
          on:click={() => removeObject(menu!.object!)}>Remove</button
        >
      {/if}
    </div>
  {/if}
  {#if toolbarDialog === "open"}<div class="modal topmost-modal" role="presentation">
      <div class="dialog toolbar-dialog" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="open-import-title" use:containClicks>
        <h3 id="open-import-title">Open / Import</h3>
        <p>Drop a project file or directory here, or click to choose one.</p>
        <label
          class="project-dropzone"
          on:dragover|preventDefault
          on:drop={openProjectDrop}
        >
          <strong>JSON · BlueJ ZIP · Project directory</strong>
          <span>Accepted: .json, .zip, or a complete project directory</span>
          <input type="file" accept=".json,.bluek.json,.zip,application/json,application/zip" webkitdirectory multiple on:change={(event) => { importProject(event); toolbarDialog = null; }} />
        </label>
        <div class="shared-project-loader">
          <strong>Load shared project</strong>
          <label>
            <span>Three words</span>
            <input
              aria-label="Three-word project code"
              bind:value={shareCodeInput}
              placeholder="green-lamp-river"
              on:keydown={(event) => event.key === "Enter" && loadSharedProjectFromCode()}
            />
          </label>
          <button
            class="shared-project-load"
            disabled={!shareCodeInput.trim()}
            on:click={loadSharedProjectFromCode}>Load project</button
          >
          {#if shareCodeError}<div class="dialog-error" role="alert">{shareCodeError}</div>{/if}
        </div>
        <div class="dialog-actions"><button on:click={() => (toolbarDialog = null)}>Cancel</button></div>
      </div>
    </div>{/if}
  {#if toolbarDialog === "save"}<div class="modal topmost-modal" role="presentation">
      <div class="dialog toolbar-dialog" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="save-export-title" use:containClicks>
        <h3 id="save-export-title">Save / Export</h3>
        <p>Choose how to save or share this project:</p>
        <div class="project-choice-list toolbar-project-choice-list">
          <button on:click={() => { exportProject(); toolbarDialog = null; }} disabled={!files.length}><strong>Export Project JSON</strong><span>Export the complete BlueK project as JSON.</span></button>
          <button on:click={() => { shareProject(); toolbarDialog = null; }} disabled={!files.length}><strong>Copy Full Project Link</strong><span>Share the complete project encoded in the URL.</span></button>
          <button disabled><strong>Export BlueJ Project (.zip)</strong><span>Export for BlueJ (not implemented yet).</span></button>
          <button on:click={() => { void saveShortProject(); toolbarDialog = null; }} disabled={!files.length}><strong>Copy Short Link</strong><span>Save the project for 30 days and copy a short link.</span></button>
        </div>
        <div class="dialog-actions"><button on:click={() => (toolbarDialog = null)}>Cancel</button></div>
      </div>
    </div>{/if}
  {#if shareLinkDialog}<div class="modal" role="presentation">
      <div class="dialog share-link-dialog" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="share-link-title" use:containClicks>
        <h3 id="share-link-title">Short project link</h3>
        <p>{shareLinkDialog.copied ? "The link was copied to the clipboard. Write down these three words:" : "Write down these three words:"}</p>
        <button class="share-link-code" aria-label="Three-word project code" title="Copy project link" on:click={() => { void copySharedLink(); }}>{shareLinkDialog.code}</button>
        <p class="share-link-full-label">Complete link:</p>
        <button class="share-link-value" aria-label="Complete project link" title="Copy project link" on:click={() => { void copySharedLink(); }}>{shareLinkDialog.url}</button>
        <p class="share-link-expiry">This project will be deleted after 30 days.</p>
        <div class="dialog-actions"><button on:click={() => (shareLinkDialog = null)}>Close</button></div>
      </div>
    </div>{/if}
  {#if filesNotice}<div class="modal topmost-modal" role="presentation">
      <div class="dialog settings-dialog" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="svelte-files-title" use:containClicks>
        <h3 id="svelte-files-title">Files</h3>
        <p>The file manager is not implemented yet.</p>
        <div class="dialog-actions"><button on:click={() => (filesNotice = false)}>Close</button></div>
      </div>
    </div>{/if}
  {#if settingsNotice}<div class="modal topmost-modal" role="presentation">
      <div
        class="dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="svelte-settings-title"
        use:containClicks
      >
        <h3 id="svelte-settings-title">Settings</h3>
        <label class="settings-field">
          <span>Editor font size</span>
          <select aria-label="Editor font size" bind:value={editorFontSize}>
            {#each Array.from({ length: 21 }, (_, index) => index + 10) as size}
              <option value={size}>{size}px</option>
            {/each}
          </select>
        </label>
        <div class="dialog-actions"><button on:click={() => (settingsNotice = false)}>Close</button></div>
      </div>
    </div>{/if}
  {#if objectNamePrompt}<div class="modal" role="presentation">
      <div
        class="dialog create-object-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        use:containClicks
      >
        <h3>New Object Name</h3>
        <p>Enter the name for the new object on the object bench.</p>
        <label
          >Name of instance<input
            bind:value={objectName}
            use:focusOnMount
            on:keydown={(event) => {
              if (event.key === "Escape") objectNamePrompt = null;
              if (event.key === "Enter") confirmObjectOnBench();
            }}
          /></label
        >
        {#if objectNameError}<p role="alert">{objectNameError}</p>{/if}
        <div class="dialog-actions"><button on:click={() => (objectNamePrompt = null)}>Cancel</button
        ><button
          on:click={confirmObjectOnBench}
          disabled={!/^[A-Za-z_]\w*$/.test(objectName.trim())}>OK</button></div>
      </div>
    </div>{/if}
  {#if codepadMenu}<div
      class="codepad-context-menu"
      style={`left:${codepadMenu.x}px;top:${codepadMenu.y}px`}
      use:containClicks
    >
      <button
        on:click={() =>
          copyCodepadText(
            codepadMenu?.text || history.map((entry) => entry.code).join("\n"),
          )}>Copy</button
      ><button
        on:click={() => {
          history = [];
          codepadMenu = null;
        }}>Clear history</button
      ><button on:click={selectAllCodepadHistory}>Select all history</button>
    </div>{/if}

  {#if terminalSplit}<div
      class="terminal-split-divider"
      role="separator"
      aria-label="Resize BlueK and terminal"
      on:pointerdown={beginTerminalSplitResize}
    ></div>{/if}
</div>
