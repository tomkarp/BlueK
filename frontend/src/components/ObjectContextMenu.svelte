<script lang="ts">
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
        >Show API documentation</button
      >
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
      {#each fileMethods(menu.file, classes) as method}
        <button
          disabled={!canExecute}
          on:click={() =>
            invokeClassMethod(menu!.file!.fileName.replace(".kt", ""), method)}
          >{methodLabel(method)}</button
        >
      {/each}
      <hr />
      <button on:click={() => openEditor(menu?.file)}>Open Editor</button>
      <button
        disabled={!canExecute && phase !== "uncompiled"}
        on:click={() => {
          menu = null;
          compile();
        }}>Compile</button
      >
      <button on:click={() => deleteFile(menu!.file!)}>Delete</button>
      <button on:click={() => duplicateFile(menu!.file!)}>Duplicate…</button>
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
      {#if inheritedPopupGroups(menu.object, classes).length}<hr />{/if}
      {#each directPopupMethods(menu.object, classes) as method}
        <button
          class="method-menu-item"
          disabled={!canExecute}
          on:click={() => invokeObject(menu!.object!, method)}
          >{popupObjectMethodLabel(method)}</button
        >
      {:else}<div class="popup-no-methods">(No accessible methods)</div>{/each}
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
