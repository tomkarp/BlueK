import type {
  BenchObject,
  CreateDialog,
  InvokeDialog,
  ResultDialog,
  ObjectMenu,
} from "../uiTypes";
import { tick } from "svelte";

import { beginWindowDrag } from "../windowInteraction";

import {
  specializeCallable,
  defaultObjectName,
  codepadResult,
  kotlinCallArguments,
  missingRequired,
  missingTypeArgument,
} from "../uiParity";

import type { MenuCallable } from "../objectMenuMethods";

import {
  InspectorModel,
  inspectorFieldText,
  type InspectionView,
  type InspectorField,
} from "../inspectorModel";

import type {
  InspectedField,
  ProjectFile,
  RuntimeSnapshot,
  RuntimeCommand,
  RuntimeValue,
} from "../../../runtime-contract/src/index";

import type { WorkspaceUi } from "./WorkspaceUi.svelte";
import type { ExecutionWorkspace } from "./ExecutionWorkspace.svelte";
import type { BluePlayWorkspace } from "./BluePlayWorkspace.svelte";
import type { EditorWorkspace } from "./EditorWorkspace.svelte";
import type { TerminalWorkspace } from "./TerminalWorkspace.svelte";
interface ObjectWorkspaceHost {
  ui: () => Pick<WorkspaceUi, "dialogError" | "error" | "activeWindow">;
  session: () => Readonly<
    Pick<
      ExecutionWorkspace,
      "classes" | "canExecute" | "runtime" | "history" | "reportCallError"
    >
  > & {
    readonly client: Pick<
      ExecutionWorkspace["client"],
      "getSnapshot" | "execute" | "subscribe"
    >;
  };
  play: () => Pick<BluePlayWorkspace, "showWorld">;
  editor: () => Readonly<Pick<EditorWorkspace, "hasWindows">>;
  terminal: () => Readonly<Pick<TerminalWorkspace, "terminalOpen">>;
}

export class ObjectWorkspace {
  constructor(private readonly host: ObjectWorkspaceHost) {
    this.inspectorModel = new InspectorModel(host.session().client, () => {
      this.inspectorRevision += 1;
    });
  }
  activeInspectorId = $state("");
  inspectorWindows: Array<{
    id: string;
    referenceName: string;
    preserveReferenceName?: boolean;
    position: { left: number; top: number };
  }> = $state([]);
  private readonly inspectorModel: InspectorModel;
  inspectorRevision = $state(0);
  inspectorError: { property: string; message: string } | null = $state(null);

  menu: ObjectMenu | null = $state(null);
  createDialog: CreateDialog | null = $state(null);
  createName = $state("");
  createArgs: string[] = $state([]);
  createTypeArgs: string[] = $state([]);
  invokeDialog: InvokeDialog | null = $state(null);
  invokeArgs: string[] = $state([]);
  invokeTypeArgs: string[] = $state([]);
  resultDialog: ResultDialog | null = $state(null);
  objectNamePrompt: RuntimeValue | null = $state(null);
  objectName = $state("");
  objectNameError = $state("");
  editingField = $state("");
  fieldDraft = $state("");
  fieldError = $state("");
  fieldInput: HTMLInputElement | null = $state(null);
  inspected = $derived.by(() => {
    return (
      this.inspectorViews.find((item) => item.id === this.activeInspectorId)
        ?.data || null
    );
  });
  bench = $derived.by(() => {
    return this.host.session().runtime.references.flatMap((reference) =>
      reference.onBench && reference.objectId
        ? [
            {
              objectId: reference.objectId,
              name: reference.name,
              className: reference.className,
            },
          ]
        : [],
    );
  });
  chooseConstructor = (index: number) => {
    if (!this.createDialog) return;
    this.createDialog = {
      ...this.createDialog,
      constructorIndex: index,
      parameters: this.createDialog.constructors[index]?.parameters || [],
    };
    this.createArgs = this.createDialog.parameters.map(() => "");
    this.host.ui().dialogError = "";
  };
  createObject = (className: string, index = 0) => {
    const meta = this.host
        .session()
        .classes.find((item) => item.name === className),
      constructors = meta?.constructors || [];
    if (!this.host.session().canExecute || !constructors.length) return;
    const parameters = constructors[index]?.parameters || [],
      typeParameters = meta?.typeParameters || [];
    const name = defaultObjectName(
      className,
      this.host.session().runtime.references.map((reference) => reference.name),
    );
    this.menu = null;
    this.createDialog = {
      className,
      constructors,
      constructorIndex: index,
      typeParameters,
      parameters,
    };
    this.createName = name;
    this.createArgs = (constructors[index]?.parameters || []).map(() => "");
    this.createTypeArgs = (meta?.typeParameters || []).map(() => "");
    this.host.ui().dialogError = "";
    this.menu = null;
  };
  confirmCreate = async () => {
    if (!this.host.session().canExecute) return;
    if (!this.createDialog || !/^[A-Za-z_]\w*$/.test(this.createName.trim())) {
      this.host.ui().dialogError = "Please enter a valid instance name.";
      return;
    }
    if (
      this.host
        .session()
        .runtime.references.some(
          (reference) => reference.name === this.createName.trim(),
        )
    ) {
      this.host.ui().dialogError = "This instance name is already in use.";
      return;
    }
    if (
      missingTypeArgument(this.createTypeArgs) ||
      missingRequired(this.createDialog.parameters, this.createArgs)
    ) {
      this.host.ui().dialogError =
        "Fill in all required Kotlin arguments and type arguments.";
      return;
    }
    const dialog = this.createDialog;
    const name = this.createName.trim();
    const args = kotlinCallArguments(dialog.parameters, [...this.createArgs]);
    const typeArguments = [...this.createTypeArgs];
    this.createDialog = null;
    await this.executeCreate(dialog.className, name, args, typeArguments);
  };
  executeCreate = async (
    className: string,
    name: string,
    args: string[],
    typeArguments: string[],
  ) => {
    const generation = this.host.session().client.getSnapshot().generationId;
    try {
      const result = await this.host.session().client.execute({
        op: "create",
        className,
        name,
        typeArguments,
        args,
      });
      if (this.host.session().client.getSnapshot().generationId !== generation)
        return;
      if (result.kind === "error")
        this.showCallError(
          result.display || "Object could not be created.",
          result.phase === "runtime",
        );
    } catch (reason) {
      if (this.host.session().client.getSnapshot().generationId === generation)
        this.showCallError(reason);
    }
  };
  invokeObject = (object: BenchObject, original: MenuCallable) => {
    const method = specializeCallable(
      original,
      object,
      this.host.session().classes,
    );
    if (method.name === "show") {
      this.host.play().showWorld();
    }
    this.prepareInvoke({ object, method });
  };
  invokeClassMethod = (className: string, method: MenuCallable) => {
    const owner = this.host
      .session()
      .classes.find((item) => item.name === className);
    if (!owner) return;
    if (
      method.name === "main" &&
      owner.kind === "functions" &&
      !method.parameters?.length
    ) {
      this.menu = null;
      this.host
        .session()
        .client.execute({ op: "main", fileName: `${owner.name}.kt` })
        .then(this.showResult)
        .catch((reason) => (this.host.ui().error = String(reason)));
      return;
    }
    this.prepareInvoke({
      receiver:
        owner.kind === "object" || method.isCompanion ? `${owner.name}.` : "",
      method,
    });
  };
  prepareInvoke = (call: InvokeDialog) => {
    if (!this.host.session().canExecute) return;
    this.menu = null;
    if (
      !call.method.parameters?.length &&
      !call.method.typeParameters?.length
    ) {
      void this.executeInvoke(call, [], []);
      return;
    }
    this.invokeArgs = (call.method.parameters || []).map(() => "");
    this.invokeTypeArgs = (call.method.typeParameters || []).map(() => "");
    this.host.ui().dialogError = "";
    this.invokeDialog = call;
  };
  showCallError = (reason: unknown, exception = false) => {
    this.host
      .session()
      .reportCallError(
        reason instanceof Error ? reason.message : String(reason),
        exception,
      );
  };
  showResult = (result: RuntimeValue, method = "") => {
    if (result.kind === "error") {
      this.host.ui().error = result.display || "Execution failed.";
      return;
    }
    if (result.kind !== "unit")
      this.resultDialog = {
        method,
        value:
          codepadResult(result) ||
          result.display ||
          result.className ||
          result.kind,
        objectId: result.objectId,
        className: result.className,
      };
  };
  confirmInvoke = async () => {
    if (!this.host.session().canExecute || !this.invokeDialog) return;
    const dialog = this.invokeDialog,
      method = dialog.method,
      parameters = method.parameters || [];
    if (
      missingTypeArgument(this.invokeTypeArgs) ||
      missingRequired(parameters, this.invokeArgs)
    ) {
      this.host.ui().dialogError =
        "Fill in all required Kotlin arguments and type arguments.";
      return;
    }
    const args = kotlinCallArguments(parameters, [...this.invokeArgs]);
    const typeArguments = [...this.invokeTypeArgs];
    this.invokeDialog = null;
    await this.executeInvoke(dialog, args, typeArguments);
  };
  executeInvoke = async (
    dialog: InvokeDialog,
    args: string[],
    typeArguments: string[],
  ) => {
    const generation = this.host.session().client.getSnapshot().generationId;
    const method = dialog.method;
    try {
      const suffix = typeArguments.length
        ? `<${typeArguments.join(", ")}>`
        : "";
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
      const result = await this.host.session().client.execute(request);
      if (this.host.session().client.getSnapshot().generationId !== generation)
        return;
      if (result.kind === "error")
        this.showCallError(
          result.display || "Call failed.",
          result.phase === "runtime",
        );
      else {
        this.showResult(
          result,
          `${dialog.object ? dialog.object.name + "." : dialog.receiver || ""}${method.name}${suffix}()`,
        );
        await this.refreshComputedInspectors();
      }
    } catch (reason) {
      if (this.host.session().client.getSnapshot().generationId === generation)
        this.showCallError(reason);
    }
  };
  requestObjectOnBench = (value: RuntimeValue) => {
    if (!value.objectId) return;
    this.objectNamePrompt = value;
    this.objectNameError = "";
    this.objectName =
      value.name ||
      (value.className || "object")
        .replace(/<.*>/, "")
        .replace(/^./, (letter) => letter.toLowerCase());
  };
  getLastCodepadObject = () => {
    const entry = [...this.host.session().history]
      .reverse()
      .find(
        (item) =>
          item.objectId &&
          this.host.session().runtime.liveObjectIds.includes(item.objectId),
      );
    if (entry?.objectId)
      this.requestObjectOnBench({
        kind: "object",
        objectId: entry.objectId,
        className: entry.className || "Object",
        name: entry.className || "Object",
      });
  };
  confirmObjectOnBench = async () => {
    if (
      !this.objectNamePrompt?.objectId ||
      !/^[A-Za-z_]\w*$/.test(this.objectName.trim())
    )
      return;
    const result = await this.host.session().client.execute({
      op: "bind",
      objectId: this.objectNamePrompt.objectId,
      name: this.objectName.trim(),
    });
    if (result.kind !== "error") {
      this.objectNamePrompt = null;
    } else
      this.objectNameError =
        result.display || "The reference could not be added.";
  };
  waitForInspectorReady = (allowFaulted = false) => {
    const generation = this.host.session().client.getSnapshot().generationId;
    if (this.host.session().client.getSnapshot().phase !== "running")
      return Promise.resolve(
        this.host.session().client.getSnapshot().phase === "ready" ||
          (allowFaulted &&
            this.host.session().client.getSnapshot().phase === "faulted"),
      );
    return new Promise<boolean>((resolve) => {
      const unsubscribe = this.host.session().client.subscribe(() => {
        const snapshot = this.host.session().client.getSnapshot();
        if (
          snapshot.generationId !== generation ||
          snapshot.phase !== "running"
        ) {
          unsubscribe();
          resolve(
            snapshot.generationId === generation &&
              (snapshot.phase === "ready" ||
                (allowFaulted && snapshot.phase === "faulted")),
          );
        }
      });
    });
  };
  executeInspectorCommand = async (
    command: Extract<RuntimeCommand, { op: "inspect" | "inspectField" }>,
    allowFaulted = false,
  ) => {
    const generation = this.host.session().client.getSnapshot().generationId;
    while (
      this.host.session().client.getSnapshot().generationId === generation
    ) {
      if (!(await this.waitForInspectorReady(allowFaulted))) return null;
      const phase = this.host.session().client.getSnapshot().phase;
      if (
        phase !== "ready" &&
        !(allowFaulted && phase === "faulted" && command.op === "inspect")
      )
        continue;
      try {
        return await this.host.session().client.execute(command);
      } catch (reason) {
        // Replacing or unmounting the project cancels pending inspections.
        // Their old UI callback must finish quietly instead of surfacing an
        // unhandled rejection after the owning application has gone away.
        if (
          this.host.session().client.getSnapshot().generationId !== generation
        )
          return null;
        if (this.host.session().client.getSnapshot().phase !== "running")
          throw reason;
      }
    }
    return null;
  };
  showInspection = async (
    object: BenchObject,
    preserveReferenceName = false,
  ) => {
    const existing = this.inspectorWindows.find(
      (item) => item.id === object.objectId,
    );
    const position = existing?.position || {
      left: Math.max(
        12,
        Math.min(
          window.innerWidth - 552,
          80 + this.inspectorWindows.length * 28,
        ),
      ),
      top: 90 + this.inspectorWindows.length * 28,
    };
    this.inspectorWindows = [
      ...this.inspectorWindows.filter((item) => item.id !== object.objectId),
      {
        id: object.objectId,
        referenceName: object.name,
        preserveReferenceName,
        position,
      },
    ];
    this.bringInspectorToFront(object.objectId);
    await this.inspectorModel.refresh(object.objectId);
  };
  inspectObject = async (
    object: BenchObject,
    preserveReferenceName = false,
  ) => {
    this.menu = null;
    const result = await this.executeInspectorCommand(
      {
        op: "inspect",
        objectId: object.objectId,
      },
      true,
    );
    // Primitive values answer with their scalar value; they are inspectable too.
    if (result && result.kind !== "error")
      await this.showInspection(object, preserveReferenceName);
  };
  inspectFieldReference = async (ownerId: string, field: InspectorField) => {
    if (field.computed && field.objectId) {
      await this.inspectObject(
        {
          objectId: field.objectId,
          className: field.type?.displayName || "Object",
          name: field.name,
        },
        true,
      );
      return;
    }
    const result = await this.executeInspectorCommand({
      op: "inspectField",
      objectId: ownerId,
      property: field.name,
    });
    if (result?.kind === "inspect" && result.objectId)
      await this.showInspection(
        {
          objectId: result.objectId,
          className: result.className || "Object",
          name: field.name,
        },
        true,
      );
  };
  bringInspectorToFront = (id: string) => {
    const inspector = this.inspectorWindows.find((item) => item.id === id);
    if (!inspector) return;
    this.activeInspectorId = id;
    this.host.ui().activeWindow = "inspector";
    if (this.inspectorWindows.at(-1)?.id === id) return;
    this.inspectorWindows = [
      ...this.inspectorWindows.filter((item) => item.id !== id),
      inspector,
    ];
  };
  closeInspector = (id: string) => {
    this.inspectorWindows = this.inspectorWindows.filter(
      (item) => item.id !== id,
    );
    this.inspectorModel.forget(id);
    if (this.activeInspectorId === id) {
      const next = this.inspectorWindows.at(-1);
      this.activeInspectorId = next?.id || "";
      if (!next && this.host.ui().activeWindow === "inspector")
        this.host.ui().activeWindow = this.host.editor().hasWindows
          ? "editor"
          : this.host.terminal().terminalOpen
            ? "terminal"
            : null;
    }
  };
  beginInspectorDrag = (event: PointerEvent, objectId: string) => {
    beginWindowDrag(
      event,
      ".inspect-window",
      (position) => {
        this.inspectorWindows = this.inspectorWindows.map((item) =>
          item.id === objectId ? { ...item, position } : item,
        );
      },
      "contained",
    );
  };
  removeObject = async (object: BenchObject) => {
    const result = await this.host.session().client.execute({
      op: "remove",
      objectId: object.objectId,
      name: object.name,
    });
    if (result.kind === "error") {
      this.showCallError(
        result.display || "The object reference could not be removed.",
      );
    }
    this.menu = null;
  };
  fieldProperty = (data: RuntimeValue, field: InspectedField) => {
    return this.host
      .session()
      .classes.find(
        (item) =>
          item.name ===
          (
            data.className ||
            this.bench.find((object) => object.objectId === data.objectId)
              ?.className ||
            ""
          ).replace(/\s*<.*>$/, ""),
      )
      ?.properties?.find((item) => item.name === field.name);
  };
  fieldValue = (data: RuntimeValue, field: InspectorField) => {
    return inspectorFieldText(
      field,
      field.type || this.fieldProperty(data, field)?.type,
    );
  };
  inspectorType = (data: InspectionView) => {
    return (
      data.className ||
      data.type?.displayName ||
      data.type?.classifier ||
      "Object"
    );
  };
  refreshComputedInspectors = async () => {
    for (const inspector of this.inspectorWindows) {
      await this.inspectorModel.refresh(inspector.id);
    }
  };
  canEditField = (field: InspectorField, data = this.inspected) => {
    const property = data && this.fieldProperty(data, field);
    return (
      this.host.session().canExecute &&
      field.setterPrivate !== true &&
      property?.mutable === true &&
      property?.visibility === "public"
    );
  };
  openMenu = (event: MouseEvent, file?: ProjectFile, object?: BenchObject) => {
    event.preventDefault();
    event.stopPropagation();
    this.menu = { x: event.clientX, y: event.clientY, file, object };
  };
  beginFieldEdit = (field: InspectorField, data = this.inspected) => {
    if (!data) return;
    this.bringInspectorToFront(data.objectId || "");
    this.editingField = field.name;
    // Object and collection texts are no Kotlin expressions; `Hund()` would
    // silently create a new object when confirmed unchanged.
    this.fieldDraft =
      field.reference || field.summary ? "" : this.fieldValue(data, field);
    this.fieldError = "";
  };
  insertBenchName = (name: string) => {
    const input = this.fieldInput;
    if (!input) return;
    const start = input.selectionStart ?? this.fieldDraft.length,
      end = input.selectionEnd ?? start;
    this.fieldDraft =
      this.fieldDraft.slice(0, start) + name + this.fieldDraft.slice(end);
    tick().then(() => {
      input.focus();
      input.setSelectionRange(start + name.length, start + name.length);
    });
  };
  saveField = async (field: InspectorField) => {
    if (!this.inspected?.objectId) return;
    if (!this.fieldDraft.trim()) {
      this.editingField = "";
      this.fieldError = "";
      return;
    }
    try {
      const objectId = this.inspected.objectId,
        result = await this.host.session().client.execute({
          op: "set",
          objectId,
          property: field.name,
          value: this.fieldDraft,
        });
      if (result.kind === "error")
        this.fieldError = result.display || "Could not set property.";
      else {
        await this.inspectorModel.refresh(objectId);
        this.editingField = "";
        this.fieldError = "";
      }
    } catch (reason) {
      this.fieldError =
        reason instanceof Error ? reason.message : String(reason);
    }
  };
  inspectorViews = $derived.by(() => {
    void this.inspectorRevision;
    const runtime = this.host.session().runtime;
    return this.inspectorWindows
      .map((item) => ({
        ...item,
        referenceName: item.preserveReferenceName
          ? item.referenceName
          : runtime.references.find(
              (reference) =>
                reference.name === item.referenceName &&
                reference.objectId === item.id,
            )?.name ||
            runtime.references.find(
              (reference) => reference.objectId === item.id,
            )?.name ||
            item.referenceName ||
            "<object>",
        data: this.inspectorModel.view(item.id),
      }))
      .filter((item): item is typeof item & { data: InspectionView } =>
        Boolean(item.data),
      );
  });

  synchronize = (runtime: RuntimeSnapshot) => {
    if (runtime.phase === "ready")
      this.inspectorWindows
        .filter((item) => !runtime.liveObjectIds.includes(item.id))
        .forEach((item) => this.closeInspector(item.id));
  };
  dismissMenu = () => {
    this.menu = null;
  };
  closeCalls = () => {
    this.resultDialog = null;
    this.invokeDialog = null;
    this.createDialog = null;
  };
  resetInspectors = () => {
    this.inspectorWindows.forEach((item) =>
      this.inspectorModel.forget(item.id),
    );
    this.activeInspectorId = "";
    this.inspectorWindows = [];
  };
}
