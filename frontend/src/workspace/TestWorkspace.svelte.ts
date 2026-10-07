import type {
  ProjectFile,
  RuntimeCommand,
  TestCaseResult,
} from "../../../runtime-contract/src/index";
import type { ExecutionWorkspace } from "./ExecutionWorkspace.svelte";
import type { ProjectWorkspace } from "./ProjectWorkspace.svelte";
import type { EditorWorkspace } from "./EditorWorkspace.svelte";
import type { ObjectWorkspace } from "./ObjectWorkspace.svelte";
interface TestWorkspaceHost {
  session: () => Pick<
    ExecutionWorkspace,
    | "runtime"
    | "classes"
    | "client"
    | "compile"
    | "canExecute"
    | "programActive"
    | "reportCallError"
  >;
  project: () => Pick<
    ProjectWorkspace,
    | "files"
    | "defaultTestClass"
    | "setDefaultTestClass"
    | "addTestClass"
    | "addIndependentTestClass"
    | "applyGeneratedSource"
  >;
  editor: () => Pick<EditorWorkspace, "openEditor" | "markDiagnostics">;
  objects: () => Pick<ObjectWorkspace, "dismissMenu" | "closeCalls">;
}
/** Dialog drafts only; discovery, results, recording and replay state come from the runtime. */
export class TestWorkspace {
  constructor(private readonly host: TestWorkspaceHost) {}
  open = $state(false);
  selected = $state("");
  error = $state("");
  busy = $state(false);
  newClass: ProjectFile | null = $state.raw(null);
  className = $state("");
  createFixtureClass = $state(false);
  fixtureClassName = $state("StateTest");
  chooseDefaultOpen = $state(false);
  chosenDefaultClass = $state("");
  methodName = $state("test");
  preview: {
    fileId: string;
    fileName: string;
    revision: number;
    source: string;
    recording: boolean;
    replacesFixture: boolean;
    replacesInitializers?: boolean;
    newClassName?: string;
  } | null = $state(null);
  suites = $derived.by(() =>
    this.host.session().classes.filter((item) => item.testing),
  );
  stateClasses = $derived.by(() =>
    [
      ...new Set([
        ...this.host
          .session()
          .classes.filter((item) => item.testing)
          .map((item) => item.name),
        ...this.host
          .project()
          .files.filter((file) => file.isTestClass || file.testTarget)
          .map((file) => file.fileName.replace(/\.kt$/, "")),
      ]),
    ].map((name) => ({ name })),
  );
  state = $derived.by(() => this.host.session().runtime.testing);
  selectedClass = $derived.by(() =>
    this.stateClasses.some((suite) => suite.name === this.selected)
      ? this.selected
      : "",
  );
  defaultClass = $derived.by(() =>
    this.stateClasses.some(
      (suite) => suite.name === this.host.project().defaultTestClass,
    )
      ? this.host.project().defaultTestClass
      : "",
  );
  ready = $derived.by(() => this.host.session().canExecute && !this.busy);
  canRun = $derived.by(
    () =>
      !this.busy &&
      !this.state?.recording &&
      !this.host.session().programActive,
  );
  requestCreate = (file: ProjectFile) => {
    this.host.objects().dismissMenu();
    this.newClass = file;
    this.className = file.fileName.replace(".kt", "") + "Test";
    this.error = "";
  };
  create = async () => {
    if (!this.newClass) return;
    try {
      const file = this.host
        .project()
        .addTestClass(this.newClass, this.className.trim());
      this.newClass = null;
      this.selected = file.fileName.replace(".kt", "");
      this.host.editor().openEditor(file);
      await this.host.session().compile();
    } catch (e) {
      this.error = String((e as Error).message);
    }
  };
  private command = async (command: RuntimeCommand) => {
    this.error = "";
    try {
      const result = await this.host.session().client.execute(command);
      if (result.kind === "error")
        this.error = result.display || "Test action failed.";
      if (
        result.kind === "error" &&
        !this.open &&
        !this.preview &&
        !this.createFixtureClass
      )
        this.host
          .session()
          .reportCallError(
            this.error,
            result.phase === "runtime" || result.fatal === true,
          );
      return result;
    } catch (e) {
      this.error = (e as Error).message;
      if (!this.open && !this.preview && !this.createFixtureClass)
        this.host.session().reportCallError(this.error);
      return { kind: "error" as const, display: this.error };
    }
  };
  run = async (className = "", method = "") => {
    if (this.busy || this.state?.recording || this.host.session().programActive)
      return;
    this.open = true;
    this.selected = className;
    this.busy = true;
    this.error = "";
    try {
      this.host.objects().closeCalls();
      if (await this.host.session().compile())
        await this.command({ op: "tests", className, method });
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  };
  fixture = async (className: string, record = false) => {
    if (this.busy || this.state?.recording || this.host.session().programActive)
      return;
    this.selected = className;
    this.busy = true;
    try {
      this.host.objects().dismissMenu();
      this.host.objects().closeCalls();
      if (await this.host.session().compile()) {
        const result = await this.command({ op: "fixture", className });
        if (record && result.kind !== "error")
          await this.command({ op: "testing", action: "begin", className });
      }
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  };
  record = (className: string) => {
    this.open = true;
    return this.fixture(className, true);
  };
  saveBench = () => {
    if (!this.ready || !this.state?.canCapture || this.state?.recording) return;
    if (this.defaultClass) {
      void this.capture(this.defaultClass);
      return;
    }
    this.fixtureClassName = "StateTest";
    this.createFixtureClass = true;
    this.error = "";
  };
  createFixtureFromBench = async () => {
    const name = this.fixtureClassName.trim();
    if (
      !/^[A-Za-z_]\w*$/.test(name) ||
      this.host.project().files.some((file) => file.fileName === `${name}.kt`)
    ) {
      this.error = "Choose a unique Kotlin class name.";
      return;
    }
    this.busy = true;
    this.error = "";
    try {
      const result = await this.command({
        op: "testing",
        action: "fixtureSource",
        className: name,
      });
      if (result.generatedSource) {
        this.preview = {
          fileId: "",
          fileName: `${name}.kt`,
          revision: 0,
          source: result.generatedSource,
          recording: false,
          replacesFixture: false,
          newClassName: name,
        };
        this.createFixtureClass = false;
      }
    } finally {
      this.busy = false;
    }
  };
  openDefaultClassPicker = () => {
    if (!this.stateClasses.length) return;
    this.chosenDefaultClass = this.defaultClass || this.stateClasses[0].name;
    this.chooseDefaultOpen = true;
    this.error = "";
  };
  confirmDefaultClass = () => {
    if (
      !this.stateClasses.some((suite) => suite.name === this.chosenDefaultClass)
    ) {
      this.error = "Choose an available test class.";
      return;
    }
    this.host.project().setDefaultTestClass(this.chosenDefaultClass);
    this.chooseDefaultOpen = false;
  };
  loadDefaultFixture = async () => {
    const name = this.host.project().defaultTestClass;
    if (!name || !this.host.project().files.some((file) => file.fileName === `${name}.kt`)) {
      this.host.session().reportCallError("Choose a default test class before loading state.");
      return;
    }
    await this.fixture(name);
  };
  cancel = async () => {
    this.preview = null;
    await this.command({ op: "testing", action: "cancel" });
  };
  assertion = async (
    expected: string,
    kind: "equals" | "null" | "notNull" = "equals",
  ) => {
    await this.command({
      op: "testing",
      action: "assert",
      value: expected,
      kind,
    });
  };
  capture = async (className: string, recording = false) => {
    this.host.objects().dismissMenu();
    this.selected = className;
    if (!this.ready || (!recording && this.state?.recording)) return;
    this.busy = true;
    try {
      const result = await this.command({
        op: "testing",
        action: recording ? "recordSource" : "fixtureSource",
        className,
        value: this.methodName.trim(),
      });
      const file = this.host
        .project()
        .files.find((file) => file.fileName === result.fileName);
      if (result.generatedSource && file)
        this.preview = {
          fileId: file.id,
          fileName: file.fileName,
          revision: file.revision,
          source: result.generatedSource,
          recording,
          replacesFixture: !recording && result.replacesFixture === true,
          replacesInitializers: result.replacesInitializers === true,
        };
    } finally {
      this.busy = false;
    }
  };
  save = async () => {
    const preview = this.preview;
    if (!preview || this.busy) return;
    const file = preview.newClassName
      ? undefined
      : this.host.project().files.find((file) => file.id === preview.fileId);
    if (
      !preview.newClassName &&
      (!file || file.revision !== preview.revision)
    ) {
      this.error = "The source changed. Generate the preview again.";
      return;
    }
    this.busy = true;
    try {
      if (preview.recording) await this.cancel();
      if (preview.newClassName) {
        const created = this.host
          .project()
          .addIndependentTestClass(preview.newClassName);
        this.host.project().setDefaultTestClass(preview.newClassName);
        this.host.project().applyGeneratedSource(created.id, preview.source);
        this.selected = preview.newClassName;
      } else {
        this.host.project().applyGeneratedSource(file!.id, preview.source);
      }
      this.preview = null;
      const savedFile = preview.newClassName
        ? this.host
            .project()
            .files.find(
              (item) => item.fileName === `${preview.newClassName}.kt`,
            )
        : this.host.project().files.find((item) => item.id === file!.id);
      if (savedFile && preview.recording)
        this.host.editor().openEditor(savedFile);
      await this.host.session().compile();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  };
  reveal = (result: TestCaseResult) => {
    this.host.editor().markDiagnostics(
      [
        {
          fileName: result.fileName,
          line: result.line,
          column: 1,
          severity: result.status === "passed" ? "warning" : "error",
          message: result.errors[0] || result.name,
        },
      ],
      true,
    );
  };
}
