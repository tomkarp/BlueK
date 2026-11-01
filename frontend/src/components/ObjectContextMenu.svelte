<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import { containClicks, fitPopup, fitPopupSubmenu } from "../uiActions";

  import type {
    ProjectFile,
    RuntimeSnapshot,
    CallableMeta,
    ClassMeta,
  } from "../../../runtime-contract/src/index";

  import type { BenchObject, ObjectMenu } from "../uiTypes";
  import {
    methodLabel,
    fileMethods,
    inheritedPopupGroups,
    directPopupMethods,
    popupObjectMethodLabel,
  } from "../objectMenuMethods";
  interface Props {
    isTestFile?: (file: ProjectFile) => boolean;
    createTestClass?: (file: ProjectFile) => void;
    runTests?: (name: string, method?: string) => void;
    loadFixture?: (name: string) => void;
    saveFixture?: (name: string) => void;
    recordTest?: (name: string) => void;
    recording?: boolean;
    canCapture?: boolean;
    menu: ObjectMenu | null;
    classes: ClassMeta[];
    canExecute: boolean;
    phase: RuntimeSnapshot["phase"];
    isBluePlayLibraryFile: (file: ProjectFile) => boolean;
    openBluePlayApi: (file: ProjectFile) => void;
    createObject: (className: string, index?: number) => void;
    invokeClassMethod: (className: string, method: CallableMeta) => void;
    openEditor: (file?: ProjectFile) => void;
    compile: () => Promise<boolean>;
    deleteFile: (file: ProjectFile) => void;
    renameFunctionsFile: (file: ProjectFile) => void;
    renameClassFile: (file: ProjectFile) => void;
    duplicateFile: (file: ProjectFile) => void;
    invokeObject: (object: BenchObject, method: CallableMeta) => void;
    inspectObject: (
      object: BenchObject,
      preserveReferenceName?: boolean,
    ) => Promise<void>;
    removeObject: (object: BenchObject) => Promise<void>;
  }

  let {
    isTestFile = () => false,
    createTestClass = () => {},
    runTests = () => {},
    loadFixture = () => {},
    saveFixture = () => {},
    recordTest = () => {},
    recording = false,
    canCapture = false,
    menu = $bindable(),
    classes,
    canExecute,
    phase,
    isBluePlayLibraryFile,
    openBluePlayApi,
    createObject,
    invokeClassMethod,
    openEditor,
    compile,
    deleteFile,
    renameFunctionsFile,
    renameClassFile,
    duplicateFile,
    invokeObject,
    inspectObject,
    removeObject,
  }: Props = $props();
  const testClassName = (file: ProjectFile) =>
    classes.find((item) => item.testing?.fileName === file.fileName)?.name ||
    file.fileName.replace(".kt", "");
  let testActionBusy = $derived(
    recording ||
      phase === "running" ||
      phase === "compiling" ||
      phase === "waitingForInput",
  );
</script>

{#if menu}
  {@const fileClassName = menu.file?.fileName.replace(".kt", "") || ""}
  {@const constructors =
    menu.file && !isTestFile(menu.file)
      ? classes.find((item) => item.name === fileClassName)?.constructors || []
      : []}
  <div
    class="popup"
    style={`left:${menu.x}px;top:${menu.y}px`}
    use:fitPopup={menu}
    use:containClicks
  >
    <div class="popup-title">
      {menu.object?.className || menu.file?.fileName.replace(".kt", "")}
    </div>
    {#each constructors as constructor, index}
      <button
        class="constructor-menu-item"
        disabled={!canExecute}
        onclick={() => createObject(fileClassName, index)}
      >
        {fileClassName}({constructor.parameters
          ?.map(
            (parameter) =>
              `${parameter.name}: ${parameter.type?.displayName || "Any?"}`,
          )
          .join(", ")})
      </button>
    {/each}
    {#if menu.file && isBluePlayLibraryFile(menu.file)}
      {#if constructors.length}<hr />{/if}
      <button onclick={() => openBluePlayApi(menu!.file!)}
        >{t("ui.objects.showAPIDocumentation")}</button
      >
    {:else if menu.file}
      {#if isTestFile(menu.file)}
        <button
          disabled={testActionBusy}
          onclick={() => {
            const name = testClassName(menu!.file!);
            menu = null;
            runTests(name);
          }}>{t("ui.common.runTests")}</button
        >
        {#each classes.find((item) => item.testing?.fileName === menu!.file!.fileName)?.testing?.methods || [] as method}<button
            disabled={testActionBusy}
            onclick={() => {
              const name = testClassName(menu!.file!);
              menu = null;
              runTests(name, method.name);
            }}>▶ {method.name}()</button
          >{/each}
        <hr />
        <button
          disabled={testActionBusy}
          onclick={() => {
            const name = testClassName(menu!.file!);
            menu = null;
            loadFixture(name);
          }}>{t("ui.objects.loadStateToObjectBench")}</button
        >
        <button
          disabled={!canExecute || !canCapture || recording}
          onclick={() => {
            const name = testClassName(menu!.file!);
            menu = null;
            saveFixture(name);
          }}>{t("ui.objects.saveStateFromObjectBench")}</button
        >
        <button
          disabled={testActionBusy}
          onclick={() => {
            const name = testClassName(menu!.file!);
            menu = null;
            recordTest(name);
          }}>{t("ui.common.recordTest")}</button
        >
      {/if}
      {#each fileMethods(menu.file, classes) as method}
        <button
          disabled={!canExecute}
          onclick={() =>
            invokeClassMethod(menu!.file!.fileName.replace(".kt", ""), method)}
          >{methodLabel(method)}</button
        >
      {/each}
      <hr />
      <button onclick={() => openEditor(menu?.file)}
        >{t("ui.objects.openEditor")}</button
      >
      <button
        disabled={!canExecute && phase !== "uncompiled"}
        onclick={() => {
          menu = null;
          compile();
        }}>{t("ui.common.compile")}</button
      >
      <button onclick={() => deleteFile(menu!.file!)}
        >{t("ui.objects.delete")}</button
      >
      {#if menu.file.kind === "functions"}<button
          onclick={() => renameFunctionsFile(menu!.file!)}
          >{t("ui.files.renameFile")}</button
        >{:else if menu.file.kind === "class" && !isTestFile(menu.file)}<button
          onclick={() => renameClassFile(menu!.file!)}
          >{t("ui.files.renameClass")}</button
        >{/if}
      <button onclick={() => duplicateFile(menu!.file!)}
        >{t("ui.objects.duplicate")}</button
      >
      {#if menu.file.kind === "class" && !isTestFile(menu.file)}<hr />
        <button onclick={() => createTestClass(menu!.file!)}
          >{t("ui.common.createTestClass")}</button
        >{/if}
    {:else if menu.object}
      {#each inheritedPopupGroups(menu.object, classes) as group}
        <div
          role="group"
          class="popup-submenu"
          onpointerenter={(event) =>
            fitPopupSubmenu(event.currentTarget as HTMLElement)}
          onfocusin={(event) =>
            fitPopupSubmenu(event.currentTarget as HTMLElement)}
        >
          <button class="popup-submenu-trigger" use:containClicks
            >{t("ui.objects.inheritedFrom")} {group[0]}<span>›</span></button
          >
          <div class="popup-submenu-panel">
            {#each group[1] as method}<button
                class="method-menu-item"
                disabled={!canExecute}
                onclick={() => invokeObject(menu!.object!, method)}
                >{methodLabel({
                  ...method,
                  inheritedFrom: undefined,
                })}</button
              >{/each}
          </div>
        </div>
      {/each}
      {#if inheritedPopupGroups(menu.object, classes).length}<hr />{/if}
      {#each directPopupMethods(menu.object, classes) as method}
        <button
          class="method-menu-item"
          disabled={!canExecute}
          onclick={() => invokeObject(menu!.object!, method)}
          >{popupObjectMethodLabel(method)}</button
        >
      {:else}<div class="popup-no-methods">
          {t("ui.objects.noAccessibleMethods")}
        </div>{/each}
      <hr />
      <button
        disabled={!canExecute}
        onclick={() => inspectObject(menu!.object!)}
        >{t("ui.common.inspect")}</button
      >
      <button disabled={!canExecute} onclick={() => removeObject(menu!.object!)}
        >{t("ui.objects.remove")}</button
      >
    {/if}
  </div>
{/if}
