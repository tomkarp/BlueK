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
  import { InspectorModel, inspectorFieldText, type InspectionView, type InspectorField } from "./inspectorModel";
  import { createProjectPayload, projectModelFromPayload } from "./projectFormat";
  import { compileProject, executeCodepad } from "./codepadFlow";
  import { basicSetup } from "codemirror";
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
    RuntimeValue,
  } from "../../runtime-contract/src/index";
  type Resource = { path: string; data: string };
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
  afterUpdate(() => {
    const world = document.querySelector<HTMLElement>(".game-stage");
    if (!world) return;
    const bounds = world.getBoundingClientRect();
    const root = document.querySelector<HTMLElement>(".svelte-preview");
    root?.style.setProperty("--bluek-controls-top", `${bounds.bottom + 8}px`);
    root?.style.setProperty("--bluek-controls-left", `${bounds.left}px`);
    root?.style.setProperty("--bluek-controls-width", `${bounds.width}px`);
  });
  let runtime: RuntimeSnapshot = {
    generationId: "",
    revision: 0,
    phase: "uncompiled",
    classes: [],
    inspections: {},
    error: null,
  };
  let files: ProjectFile[] = [],
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
  let editorOpen = false,
    editorSource = "",
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
    ...item, data: inspectorModel?.view(item.id),
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
    newClassType: "class" | "interface" | "open" | "abstract" | "data" =
      "class",
    newFunctionsOpen = false,
    newFunctionsName = "",
    stage: any = null,
    speed = 50,
    inheritanceMode = false,
    inheritanceSelection = "",
    showInheritance = true,
    settingsNotice = false,
    filesNotice = false,
    stageWindowOpen = false,
    stageMaximized = false,
    stagePosition: { left: number; top: number } | null = null,
    codepadOpen = true,
    paneSplit = 66,
    benchWidth: number | null = null,
    codepadMenu: { x: number; y: number; text?: string } | null = null;
  let toolbarDialog: "open" | "save" | null = null;
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
    editingField = "",
    fieldDraft = "",
    fieldError = "";
  $: stageRunning = Boolean(stage?.running);
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

  function projectPayload() {
    return createProjectPayload(files, resources, cardPositions);
  }
  function beginCardDrag(event: PointerEvent, file: ProjectFile) {
    if (event.button !== 0 || event.pointerType === "touch") return;
    const canvas = (event.currentTarget as HTMLElement).closest(".canvas");
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const position =
      cardPositions[file.id] || defaultCardPosition(files.indexOf(file));
    cardDrag = {
      id: file.id,
      dx: event.clientX - bounds.left - position.x,
      dy: event.clientY - bounds.top - position.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  function moveCard(event: PointerEvent, file: ProjectFile) {
    if (!cardDrag || cardDrag.id !== file.id) return;
    const canvas = (event.currentTarget as HTMLElement).closest(".canvas");
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
    const x = Math.round(
      ((event.clientX - bounds.left) / bounds.width) *
        Math.max((stage.width || 1) - 1, 0),
    );
    const y = Math.round(
      ((event.clientY - bounds.top) / bounds.height) *
        Math.max((stage.height || 1) - 1, 0),
    );
    client?.sendClick(x, y).catch(() => undefined);
  }

  function bluePlayAction(code: string) {
    if (
      !client ||
      !canExecute ||
      (code === "step()" && stageRunning) ||
      (code === "start()" && stageRunning) ||
      (code === "stop()" && !stageRunning)
    )
      return;
    client.execute({ op: "eval", code }).catch(() => undefined);
  }
  async function resetGame() {
    if (!canExecute) return;
    await resetRuntime();
    if (canExecute) await runMain();
  }
  function beginStageDrag(event: PointerEvent) {
    if (
      stageMaximized ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    const stageElement = document.querySelector(".game-stage");
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
    files.forEach((child, index) => {
      const parent = sourceSuperclass(child.source);
      const parentIndex = files.findIndex(
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
    options: { value: string; onChange: (value: string) => void },
  ) {
    let current = options;
    const view = new EditorView({
      state: EditorState.create({
        doc: current.value,
        extensions: [
          basicSetup,
          lineNumbers(),
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
            indentWithTab,
          ]),
          EditorView.theme({
            "&": { height: "100%", fontSize: "14px" },
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
    view.focus();
    return {
      update(next: { value: string; onChange: (value: string) => void }) {
        current = next;
        if (next.value !== view.state.doc.toString())
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: next.value },
          });
      },
      destroy() {
        view.destroy();
      },
    };
  }
  $: currentFile = files[selected];
  $: classes = runtime.classes || [];
  $: canExecute = runtime.phase === "ready";
  $: inputReady = runtime.phase === "waitingForInput";
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

  onMount(() => {
    client = new LocalRuntimeClient();
    inspectorModel = new InspectorModel(client, () => { inspectorRevision += 1; });
    const unsubscribe = client.subscribe(() => {
      runtime = client.getSnapshot();
      if (runtime.phase === "waitingForInput" || runtime.phase === "faulted")
        terminalOpen = true;
    });
    const unsubscribeOutput = client.onResponse((value) => {
      if (value.output) {
        terminalOpen = true;
        terminal = appendTerminal(terminal, value.output);
        window.setTimeout(renderTerminal, 0);
      }
    });
    const unsubscribeStage = client.stageStream((value) => {
      if (!value.stage) return;
      stage = decorateStage(value.stage);
      stageWindowOpen = true;
      speed = Number(value.stage.speed) || speed;
      (value.stage.sounds || []).forEach((sound: string) => {
        const data = resourceData(`sounds/${sound}`);
        if (data) new Audio(data).play().catch(() => undefined);
      });
    });
    const loadExample = async () => {
      const shared = new URLSearchParams(window.location.hash.slice(1)).get(
        "bluek",
      );
      if (shared) {
        try {
          await loadProject(
            await decodeProjectLink(shared),
            "Shared BlueK project loaded. Compile the project.",
          );
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
    loadExample();
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
        const resource = object.imagePath
          ? resources.find(
              (item) =>
                item.path === `images/${object.imagePath}` ||
                item.path.endsWith(`/images/${object.imagePath}`),
            )
          : undefined;
        const size = resource ? resourceSizes[resource.path] : undefined;
        const width = size?.width || object.imageWidth || 30,
          height = size?.height || object.imageHeight || 30;
        return {
          ...object,
          image:
            resource?.data ||
            drawnImageDataUrl(object.imageOperations, width, height, resources),
          imageWidth: width,
          imageHeight: height,
        };
      }),
    };
  }

  function stageStyle(value: any) {
    const image = resourceData(
      value?.backgroundPath ? `images/${value.backgroundPath}` : undefined,
    );
    const background = image
      ? `url("${image}")`
      : backgroundDataUrl(
          value?.backgroundOperations || [],
          value.width * value.cellSize,
          value.height * value.cellSize,
          resources,
        );
    return `aspect-ratio:${value.width || 1}/${value.height || 1};background-color:${value.backgroundColor || "#fff"};background-image:${background || "none"};background-size:100% 100%`;
  }
  function markUncompiled() {
    client?.invalidate();
    stage = null;
    stageWindowOpen = false;
    resultDialog = null;
    invokeDialog = null;
    createDialog = null;
    bench = [];
    activeInspectorId = "";
    inspectorWindows = [];
    history = [];
    status = "Uncompiled";
    error = "";
  }
  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (projectInfo) projectInfo = null;
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
      else if (editorOpen) editorOpen = false;
      else if (newClassOpen) newClassOpen = false;
      else if (newFunctionsOpen) newFunctionsOpen = false;
      else if (settingsNotice) settingsNotice = false;
      else if (filesNotice) filesNotice = false;
      else if (toolbarDialog) toolbarDialog = null;
      else if (newProjectOpen) newProjectOpen = false;
      else if (terminalOpen) {
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
    editorSource = source;
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
    editorSource = source;
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
  function openFunctionsDialog() {
    let number = 1;
    while (files.some((file) => file.fileName === `Functions${number}.kt`))
      number++;
    const name = window.prompt("Name of Functions file", `Functions${number}`);
    if (name === null) return;
    newFunctionsName = name.trim();
    confirmFunctions();
  }
  function confirmFunctions() {
    const name = newFunctionsName.trim();
    if (
      !/^[A-Za-z_]\w*$/.test(name) ||
      files.some((file) => file.fileName === `${name}.kt`)
    ) {
      error = "Bitte einen eindeutigen gültigen Kotlin-Namen angeben.";
      return;
    }
    newFile("functions", name);
    newFunctionsOpen = false;
    error = "";
  }
  function openEditor(file = currentFile) {
    if (!file) return;
    selected = files.findIndex((item) => item.id === file.id);
    editorSource = file.source;
    editorOpen = true;
    menu = null;
  }
  function updateSource(value: string) {
    editorSource = value;
    if (!currentFile) return;
    const file = currentFile;
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
      file.id === currentFile.id
        ? {
            ...file,
            fileName: renamedFileName,
            source: value,
            revision: file.revision + 1,
          }
        : file,
    );
    client?.invalidate();
    bench = [];
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
    editorOpen = false;
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
    editorSource = duplicate.source;
    editorOpen = true;
    markUncompiled();
  }
  async function compile(): Promise<boolean> {
    if (!client || runtime.phase === "compiling") return false;
    status = "Compiling…";
    error = "";
    compilerDialog = false;
    compilerDiagnostics = [];
    history = [];
    bench = [];
    activeInspectorId = "";
    inspectorWindows = [];
    const result = await compileProject(client, files, Date.now());
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
    const result = await executeCodepad(client, files, Date.now(), code);
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
  function addBenchObject(value: RuntimeValue) {
    if (!value.objectId) return;
    bench = [...bench, {
      objectId: value.objectId,
      className: value.className || "Object",
      name: value.name || `object${bench.length + 1}`,
    }];
  }



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
    if (!constructors.length) return;
    createDialog = {
      className,
      constructors,
      constructorIndex: index,
      typeParameters: meta?.typeParameters || [],
      parameters: constructors[index]?.parameters || [],
    };
    createName = defaultObjectName(className, bench.map((object) => object.name));
    createArgs = (constructors[index]?.parameters || []).map(() => "");
    createTypeArgs = (meta?.typeParameters || []).map(() => "");
    dialogError = "";
    menu = null;
  }
  async function confirmCreate() {
    if (!createDialog || !/^[A-Za-z_]\w*$/.test(createName.trim())) {
      dialogError = "Bitte einen gültigen Instanznamen angeben.";
      return;
    }
    if (bench.some((object) => object.name === createName.trim())) {
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
    try {
      const result = await client.execute({
        op: "create",
        className: createDialog.className,
        name: createName.trim(),
        typeArguments: createTypeArgs,
        args: kotlinCallArguments(createDialog.parameters, createArgs),
      });
      if (result.kind === "error")
        dialogError = result.display || "Objekt konnte nicht erstellt werden.";
      else {
        addBenchObject({
          ...result,
          name: createName.trim(),
          className: result.className || createDialog.className,
        });
        createDialog = null;
      }
    } catch (reason) {
      dialogError = reason instanceof Error ? reason.message : String(reason);
    }
  }
  function invokeObject(object: BenchObject, original: any) {
    const method = specializeCallable(original, object, classes);
    if (method.name === "show") stageWindowOpen = true;
    invokeDialog = { object, method };
    invokeArgs = (method.parameters || []).map(() => "");
    invokeTypeArgs = (method.typeParameters || []).map(() => "");
    dialogError = "";
    menu = null;
    if (!invokeArgs.length && !invokeTypeArgs.length) void confirmInvoke();
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
    invokeDialog = {
      receiver:
        owner.kind === "object" || method.isCompanion ? `${owner.name}.` : "",
      method,
    };
    invokeArgs = (method.parameters || []).map(() => "");
    invokeTypeArgs = (method.typeParameters || []).map(() => "");
    dialogError = "";
    menu = null;
    if (!invokeArgs.length && !invokeTypeArgs.length) void confirmInvoke();
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
    if (!invokeDialog) return;
    const method = invokeDialog.method,
      parameters = method.parameters || [];
    if (
      missingTypeArgument(invokeTypeArgs) ||
      missingRequired(parameters, invokeArgs)
    ) {
      dialogError =
        "Bitte alle erforderlichen Kotlin-Argumente und Typargumente ausfüllen.";
      return;
    }
    try {
      const args = kotlinCallArguments(parameters, invokeArgs),
        suffix = invokeTypeArgs.length ? `<${invokeTypeArgs.join(", ")}>` : "";
      const propertyName = method.propertyName;
      const request: any = invokeDialog.object
        ? method.autoGenerated && propertyName
          ? method.name.startsWith("set")
            ? {
                op: "set",
                objectId: invokeDialog.object.objectId,
                property: propertyName,
                value: args[0],
              }
            : {
                op: "get",
                objectId: invokeDialog.object.objectId,
                property: propertyName,
              }
          : {
              op: "invoke",
              objectId: invokeDialog.object.objectId,
              name: method.name,
              typeArguments: invokeTypeArgs,
              args,
            }
        : {
            op: "eval",
            code: `${invokeDialog.receiver || ""}${method.name}${suffix}(${args.join(", ")})`,
          };
      const result = await client.execute(request);
      if (result.kind === "error")
        dialogError = result.display || "Aufruf fehlgeschlagen.";
      else {
        showResult(
          result,
          `${invokeDialog.object ? invokeDialog.object.name + "." : invokeDialog.receiver || ""}${method.name}${suffix}()`,
        );
        invokeDialog = null;
        if (request.op !== "get") await refreshComputedInspectors();
      }
    } catch (reason) {
      dialogError = reason instanceof Error ? reason.message : String(reason);
    }
  }
  function requestObjectOnBench(value: RuntimeValue) {
    if (!value.objectId) return;
    objectNamePrompt = value;
    objectName =
      value.name ||
      (value.className || "object")
        .replace(/<.*>/, "")
        .replace(/^./, (letter) => letter.toLowerCase());
  }
  function getLastCodepadObject() {
    const entry = [...history].reverse().find((item) => item.objectId);
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
      !/^[A-Za-z_]\w*$/.test(objectName.trim()) ||
      bench.some((item) => item.name === objectName.trim())
    )
      return;
    const result = await client.execute({
      op: "bind",
      objectId: objectNamePrompt.objectId,
      name: objectName.trim(),
    });
    if (result.kind !== "error") {
      addBenchObject({
        ...objectNamePrompt,
        ...result,
        name: objectName.trim(),
      });
      objectNamePrompt = null;
    }
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
  function removeObject(object: BenchObject) {
    bench = bench.filter((item) => item.name !== object.name);
    if (!bench.some((item) => item.objectId === object.objectId))
      closeInspector(object.objectId);
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
    bench = [];
    activeInspectorId = "";
    inspectorWindows = [];
    history = [];
    error = "";
    status = "Resetting…";
    try {
      const result = await client.reset();
      if (result.diagnostics.length) {
        status = "Compile error";
        error = result.diagnostics
          .map(
            (item) =>
              `${item.fileName || ""}:${item.line}:${item.column}: ${item.message}`,
          )
          .join("\n");
        compilerDiagnostics = result.diagnostics;
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
      selected = index;
      return;
    }
    if (file.kind !== "class") return;
    if (!inheritanceSelection) {
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
    } catch {
      window.prompt("Copy this project link:", url.href);
    }
  }
  async function loadProject(payload: any, message = "Project loaded.") {
    const imported = projectModelFromPayload(payload, (index) => `project-${Date.now()}-${index}`);
    files = imported.files;
    resources = imported.resources;
    cardPositions = imported.cardPositions;
    selected = 0;
    editorOpen = false;
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
  style={`--terminal-split-width:${terminalSplitWidth}px;--bluek-stage-height:${stageHeight}px;${stagePosition ? `--bluek-stage-left:${stagePosition.left}px;--bluek-stage-top:${stagePosition.top}px;` : ""}`}
>
  {#if stage && stageWindowOpen}
    <div
      class:maximized={stageMaximized}
      class="stage-window-chrome"
      role="toolbar"
      tabindex="0"
      on:pointerdown={beginStageDrag}
    >
      <span>BluePlay – World</span>
      <div>
        <button
          on:click|stopPropagation={() => (stageMaximized = !stageMaximized)}
          >{stageMaximized ? "❐" : "□"}</button
        >
        <button
          on:click|stopPropagation={() => {
            stageWindowOpen = false;
            stageMaximized = false;
          }}>×</button
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
    <button class="toolbar-main-action" on:click={() => (toolbarDialog = "save")} aria-label="Save / Export" title="Save / Export">
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
        }}>New Class</button
      >
      <button on:click={openFunctionsDialog}>New Functions</button>
      <button class="sidebar-legacy-save" on:click={exportProject}
        >Save Project</button
      >
      <button
        class:active-tool={inheritanceMode}
        disabled={files.filter((file) => file.kind === "class").length < 2}
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
          {#if stage}
            <div
              class="game-stage"
              role="button" aria-label="BluePlay world"
              tabindex="0"
              style={stageStyle(stage)}
              on:mousedown={stageClick}
            >
              {#each stage.objects || [] as object}
                <div
                  class:image={Boolean(object.image)}
                  class="game-actor"
                  title={object.type}
                  style={`left:${((object.x + 0.5) / Math.max(stage.width, 1)) * 100}%;top:${((object.y + 0.5) / Math.max(stage.height, 1)) * 100}%;width:${(object.imageWidth / (stage.width * stage.cellSize)) * 100}%;height:${(object.imageHeight / (stage.height * stage.cellSize)) * 100}%;opacity:${object.imageOpacity ?? 1};transform:translate(-50%,-50%) rotate(${object.rotation || 0}deg)`}
                >
                  {#if object.image}<img
                      class="game-actor-image"
                      src={object.image}
                      alt=""
                      draggable="false"
                    />{:else}{object.type?.slice(0, 1)}{/if}
                </div>
              {/each}
              {#each stage.texts || [] as text}<span
                  class="game-text"
                  style={`left:${(text.x / Math.max(stage.width - 1, 1)) * 100}%;top:${(text.y / Math.max(stage.height - 1, 1)) * 100}%`}
                  >{text.text}</span
                >{/each}
            </div>
            <div class="game-controls">
              {#if mainEntries.length}<button
                  on:click={resetGame}
                  disabled={!canExecute}>Reset</button
                >{/if}
              <button
                on:click={() => bluePlayAction("step()")}
                disabled={!canExecute || stageRunning}>Act</button
              >
              <button
                on:click={() => bluePlayAction("start()")}
                disabled={!canExecute || stageRunning}>Run</button
              >
              <button
                on:click={() => bluePlayAction("stop()")}
                disabled={!canExecute || !stageRunning}>Pause</button
              >
              <label
                >Speed <input
                  type="range"
                  min="1"
                  max="100"
                  bind:value={speed}
                  disabled={!canExecute}
                  on:input={() => bluePlayAction(`setSpeed(${speed})`)}
                /></label
              >
            </div>
          {/if}
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
            {#each files as file, index (file.id)}
              {@const position =
                cardPositions[file.id] || defaultCardPosition(index)}
              <div
                role="button"
                tabindex="0"
                aria-label={file.fileName.replace(".kt", "")}
                class:framework-card={file.fileName === "BluePlayFunctions.kt"}
                class:uncompiled={runtime.phase === "uncompiled"}
                class:inheritance-selected={inheritanceSelection === file.id}
                class="classcard"
                style={`left:${position.x}px;top:${position.y}px;--card-left:${position.x}px;--card-top:${position.y}px`}
                on:pointerdown={(event) => {
                  if (!inheritanceMode) beginCardDrag(event, file);
                }}
                on:pointermove={(event) => moveCard(event, file)}
                on:pointerup={endCardDrag}
                on:pointercancel={endCardDrag}
                on:click={() => selectCard(file, index)}
                on:dblclick={() => {
                  if (!inheritanceMode) openEditor(file);
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
                      disabled={!entry.objectId}
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
            on:click={() => (terminalOpen = true)}>Terminal</button
          >{/if}
        <span
          class:active={runtime.phase === "running" ||
            runtime.phase === "compiling" ||
            inputReady}
          class="activity-bar"
          aria-label={runtime.phase === "compiling"
            ? "Compiling"
            : runtime.phase === "running" || inputReady
              ? "Program active"
              : "Ready"}
        ></span>
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
  {#if terminalOpen}<div
      class:terminal-modal-split={terminalSplit}
      class="terminal-modal"
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
          class="terminal-header"
          on:pointerdown={beginTerminalDrag}
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
  {#if editorOpen}<div class="modal">
      <div class="dialog editor-dialog">
        <h3>{currentFile?.fileName || "Kotlin file"}</h3>
        <div
          class="svelte-editor-host"
          use:codeMirror={{ value: editorSource, onChange: updateSource }}
        ></div>
        <div class="dialog-actions"><button on:click={() => (editorOpen = false)}>Close</button></div>
      </div>
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
            {@const editable = canEditField(field, inspector.data)}
            {@const editing =
              editingField === field.name &&
              inspected?.objectId === inspector.id}
            <div
              class:editable
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
                {#if editable}<button
                    class="inspect-edit"
                    aria-label={`Edit ${field.name}`}
                    title="Edit"
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
        <output class="result-value">{resultDialog.value}</output
        >{#if resultDialog.objectId}<button
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
    </div>{/if}
  {#if newProjectOpen}<div class="modal">
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
            <button on:click={() => chooseTemplate("empty-blueplay")}><strong>BluePlay Template</strong><span>Start with the BluePlay classes.</span></button
            ><button
            class="project-info-button"
            on:click|stopPropagation={() => (projectInfo = "template")}
            aria-label="What is BluePlay?">?</button
            >
          </div>
          <div class="project-choice-with-info">
            <button on:click={() => chooseTemplate("blueplay")}><strong>BluePlay Example</strong><span>Open a complete BluePlay example.</span></button
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
  {#if newClassOpen}<div class="modal" role="presentation">
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
          >{#each [["class", "Class"], ["interface", "Interface"], ["open", "Open Class"], ["abstract", "Abstract Class"], ["data", "Data Class"]] as option}<label
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
  {#if newFunctionsOpen}<div class="modal" role="presentation">
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="new-functions-title"
        use:containClicks
      >
        <h3 id="new-functions-title">Create Functions File</h3>
        <label
          >Name<input
            bind:value={newFunctionsName}
            use:focusOnMount
            placeholder="e.g. Main"
            on:keydown={(event) => event.key === "Enter" && confirmFunctions()}
          /></label
        >{#if error}<div class="dialog-error" role="alert">
            {error}
          </div>{/if}<div class="dialog-actions"><button on:click={() => (newFunctionsOpen = false)}
          >Cancel</button
        ><button on:click={confirmFunctions}>Create</button></div>
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
      {#if menu.file}
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
  {#if toolbarDialog === "open"}<div class="modal" role="presentation">
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
        <div class="dialog-actions"><button on:click={() => (toolbarDialog = null)}>Cancel</button></div>
      </div>
    </div>{/if}
  {#if toolbarDialog === "save"}<div class="modal" role="presentation">
      <div class="dialog toolbar-dialog" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="save-export-title" use:containClicks>
        <h3 id="save-export-title">Save / Export</h3>
        <p>Choose how to save or share this project:</p>
        <div class="project-choice-list toolbar-project-choice-list">
          <button on:click={() => { exportProject(); toolbarDialog = null; }} disabled={!files.length}><strong>Export Project JSON</strong><span>Export the complete BlueK project as JSON.</span></button>
          <button on:click={() => { shareProject(); toolbarDialog = null; }} disabled={!files.length}><strong>Copy Full Project Link</strong><span>Share the complete project encoded in the URL.</span></button>
          <button disabled><strong>Export BlueJ Project (.zip)</strong><span>Export for BlueJ (not implemented yet).</span></button>
          <button disabled><strong>Copy Short Link</strong><span>Create a shortened project link (not implemented yet).</span></button>
        </div>
        <div class="dialog-actions"><button on:click={() => (toolbarDialog = null)}>Cancel</button></div>
      </div>
    </div>{/if}
  {#if filesNotice}<div class="modal" role="presentation">
      <div class="dialog settings-dialog" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="svelte-files-title" use:containClicks>
        <h3 id="svelte-files-title">Files</h3>
        <p>The file manager is not implemented yet.</p>
        <div class="dialog-actions"><button on:click={() => (filesNotice = false)}>Close</button></div>
      </div>
    </div>{/if}
  {#if settingsNotice}<div class="modal" role="presentation">
      <div
        class="dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="svelte-settings-title"
        use:containClicks
      >
        <h3 id="svelte-settings-title">Settings</h3>
        <p>Settings are not implemented yet.</p>
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
        ><div class="dialog-actions"><button on:click={() => (objectNamePrompt = null)}>Cancel</button
        ><button
          on:click={confirmObjectOnBench}
          disabled={!/^[A-Za-z_]\w*$/.test(objectName.trim()) ||
            bench.some((item) => item.name === objectName.trim())}>OK</button></div>
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
