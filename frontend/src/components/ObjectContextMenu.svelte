<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
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
  export let isTestFile: (file: ProjectFile) => boolean = () => false;
  export let createTestClass: (file: ProjectFile) => void = () => {};
  export let runTests: (name: string, method?: string) => void = () => {};
  export let loadFixture: (name: string) => void = () => {};
  export let saveFixture: (name: string) => void = () => {};
  export let recordTest: (name: string) => void = () => {};
  export let recording = false;
  export let canCapture = false;
  export let menu: ObjectMenu | null;
  export let classes: ClassMeta[];
  export let canExecute: boolean;
  export let phase: RuntimeSnapshot["phase"];
  export let isBluePlayFrameworkFile: (file: ProjectFile) => boolean;
  export let openBluePlayApi: (file: ProjectFile) => void;
  export let createObject: (className: string, index?: number) => void;
  export let invokeClassMethod: (
    className: string,
    method: CallableMeta,
  ) => void;
  export let openEditor: (file?: ProjectFile) => void;
  export let compile: () => Promise<boolean>;
  export let deleteFile: (file: ProjectFile) => void;
  export let duplicateFile: (file: ProjectFile) => void;
  export let invokeObject: (object: BenchObject, method: CallableMeta) => void;
  export let inspectObject: (
    object: BenchObject,
    preserveReferenceName?: boolean,
  ) => Promise<void>;
  export let removeObject: (object: BenchObject) => Promise<void>;
  const testClassName = (file: ProjectFile) =>
    classes.find((item) => item.testing?.fileName === file.fileName)?.name ||
    file.fileName.replace(".kt", "");
  $: testActionBusy =
    recording ||
    phase === "running" ||
    phase === "compiling" ||
    phase === "waitingForInput";
</script>

{#if menu}
  <div
    class="popup"
    style={`left:${menu.x}px;top:${menu.y}px`}
    use:fitPopup={menu}
    use:containClicks
  >
    <div class="popup-title">
      {menu.object?.className || menu.file?.fileName.replace(".kt", "")}
    </div>
    {#if menu.file && isBluePlayFrameworkFile(menu.file)}
      <button on:click={() => openBluePlayApi(menu!.file!)}
        >{t("ui.objects.showAPIDocumentation")}</button
      >
    {:else if menu.file}
      {#if isTestFile(menu.file)}
        <button
          disabled={testActionBusy}
          on:click={() => {
            const name = testClassName(menu!.file!);
            menu = null;
            runTests(name);
          }}>{t("ui.common.runTests")}</button
        >
        {#each classes.find((item) => item.testing?.fileName === menu!.file!.fileName)?.testing?.methods || [] as method}<button
            disabled={testActionBusy}
            on:click={() => {
              const name = testClassName(menu!.file!);
              menu = null;
              runTests(name, method.name);
            }}>▶ {method.name}()</button
          >{/each}
        <hr />
        <button
          disabled={testActionBusy}
          on:click={() => {
            const name = testClassName(menu!.file!);
            menu = null;
            loadFixture(name);
          }}>{t("ui.objects.loadStateToObjectBench")}</button
        >
        <button
          disabled={!canExecute || !canCapture || recording}
          on:click={() => {
            const name = testClassName(menu!.file!);
            menu = null;
            saveFixture(name);
          }}>{t("ui.objects.saveStateFromObjectBench")}</button
        >
        <button
          disabled={testActionBusy}
          on:click={() => {
            const name = testClassName(menu!.file!);
            menu = null;
            recordTest(name);
          }}>{t("ui.common.recordTest")}</button
        >
      {:else}
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
      {/if}
      {#each fileMethods(menu.file, classes) as method}
        <button
          disabled={!canExecute}
          on:click={() =>
            invokeClassMethod(menu!.file!.fileName.replace(".kt", ""), method)}
          >{methodLabel(method)}</button
        >
      {/each}
      <hr />
      <button on:click={() => openEditor(menu?.file)}
        >{t("ui.objects.openEditor")}</button
      >
      <button
        disabled={!canExecute && phase !== "uncompiled"}
        on:click={() => {
          menu = null;
          compile();
        }}>{t("ui.common.compile")}</button
      >
      <button on:click={() => deleteFile(menu!.file!)}
        >{t("ui.objects.delete")}</button
      >
      <button on:click={() => duplicateFile(menu!.file!)}
        >{t("ui.objects.duplicate")}</button
      >
      {#if menu.file.kind === "class" && !isTestFile(menu.file)}<hr />
        <button on:click={() => createTestClass(menu!.file!)}
          >{t("ui.common.createTestClass")}</button
        >{/if}
    {:else if menu.object}
      {#each inheritedPopupGroups(menu.object, classes) as group}
        <div
          role="group"
          class="popup-submenu"
          on:pointerenter={(event) =>
            fitPopupSubmenu(event.currentTarget as HTMLElement)}
          on:focusin={(event) =>
            fitPopupSubmenu(event.currentTarget as HTMLElement)}
        >
          <button class="popup-submenu-trigger" use:containClicks
            >{t("ui.objects.inheritedFrom")} {group[0]}<span>›</span></button
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
      {#if inheritedPopupGroups(menu.object, classes).length}<hr />{/if}
      {#each directPopupMethods(menu.object, classes) as method}
        <button
          class="method-menu-item"
          disabled={!canExecute}
          on:click={() => invokeObject(menu!.object!, method)}
          >{popupObjectMethodLabel(method)}</button
        >
      {:else}<div class="popup-no-methods">
          {t("ui.objects.noAccessibleMethods")}
        </div>{/each}
      <hr />
      <button
        disabled={!canExecute}
        on:click={() => inspectObject(menu!.object!)}
        >{t("ui.common.inspect")}</button
      >
      <button
        disabled={!canExecute}
        on:click={() => removeObject(menu!.object!)}
        >{t("ui.objects.remove")}</button
      >
    {/if}
  </div>
{/if}
