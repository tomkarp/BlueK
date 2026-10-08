<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import type { ProjectFile } from "../../../runtime-contract/src/index";

  import type { BenchObject } from "../uiTypes";
  import type { CardPosition, InheritanceEdge } from "../uiTypes";
  export let testFileIds: string[] = [];
  export let showTestClasses = true;
  export let inheritanceMode: boolean;
  export let inheritanceSelection: string;
  export let showInheritance: boolean;
  export let inheritanceEdges: InheritanceEdge[];
  export let hasReadme: boolean;
  export let readme: string;
  export let displayFiles: ProjectFile[];
  export let displayCardPositions: CardPosition[];
  export let displayCardLayers: number[];
  export let uncompiled: boolean;
  export let selectCard: (file: ProjectFile, index: number) => void;
  export let beginCardDrag: (
    event: MouseEvent | PointerEvent,
    file: ProjectFile,
  ) => void;
  export let moveCard: (
    event: MouseEvent | PointerEvent,
    file: ProjectFile,
  ) => void;
  export let endCardDrag: () => void;
  export let openEditor: (file?: ProjectFile) => void;
  export let openMenu: (
    event: MouseEvent,
    file?: ProjectFile,
    object?: BenchObject,
  ) => void;
  export let isBluePlayFrameworkFile: (file: ProjectFile) => boolean;
  export let openBluePlayApi: (file: ProjectFile) => void;
  export let openReadme: () => void;
</script>

<div class="canvas">
  {#if inheritanceMode}<div
      class="inheritance-mode-hint"
      role="status"
      aria-live="polite"
    >
      {inheritanceSelection
        ? t("ui.diagram.nowSelectItsSuperclass")
        : t("ui.diagram.selectASubclassThenItsSuperclass")}
    </div>{/if}
  {#if showInheritance}
    {#each inheritanceEdges.filter((edge) => showTestClasses || (!testFileIds.includes(edge.id) && !testFileIds.includes(edge.parentId))) as edge, index}
      <svg
        class="inheritance-edge"
        aria-hidden="true"
        style={`z-index:${Math.max(displayCardLayers[displayFiles.findIndex((file) => file.id === edge.id)] ?? edge.zIndex, displayCardLayers[displayFiles.findIndex((file) => file.id === edge.parentId)] ?? edge.zIndex)}`}
        ><defs
          ><marker
            id={`svelte-inheritance-arrow-${index}`}
            viewBox="0 0 14 14"
            refX="12"
            refY="7"
            markerWidth="14"
            markerHeight="14"
            markerUnits="userSpaceOnUse"
            orient="auto"><path d="M 0 0 L 12 7 L 0 14 Z" /></marker
          ></defs
        ><line
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          marker-end={`url(#svelte-inheritance-arrow-${index})`}
        /></svg
      >
    {/each}
  {/if}
  <div class="cards">
    <!-- Like BlueJ's README note, but quieter: show it when the project
                 has files, resources or a written description. -->
    {#if hasReadme}<div
        role="button"
        tabindex="0"
        class:written={Boolean(readme.trim())}
        class="readme-card"
        aria-label="README.md"
        title={t("ui.diagram.rEADMEMdDescribeThisProject")}
        on:click={openReadme}
        on:keydown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openReadme();
          }
        }}
      >
        <svg viewBox="0 0 24 30" aria-hidden="true"
          ><path class="readme-sheet" d="M1.5 1.5h13l8 8v19h-21z" /><path
            class="readme-fold"
            d="M14.5 1.5l8 8h-8z"
          /><path
            class="readme-text"
            d="M5.5 13h13M5.5 16.5h13M5.5 20h13M5.5 23.5h8"
          /></svg
        >
      </div>{/if}
    {#each displayFiles as file, index (file.id)}
      {@const position = displayCardPositions[index]}
      <div
        role="button"
        aria-label={file.fileName.replace(".kt", "")}
        aria-hidden={!showTestClasses && testFileIds.includes(file.id)}
        tabindex={!showTestClasses && testFileIds.includes(file.id) ? -1 : 0}
        class:test-card={testFileIds.includes(file.id)}
        class:hidden-test-card={!showTestClasses &&
          testFileIds.includes(file.id)}
        class:attached-test={Boolean(file.testTarget)}
        class:uncompiled
        class:inheritance-selected={inheritanceSelection === file.id}
        class="classcard"
        style={`left:${position.x}px;top:${position.y}px;z-index:${displayCardLayers[index]};--card-left:${position.x}px;--card-top:${position.y}px`}
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
          {#if file.kind === "functions"}<small>«functions»</small>{/if}<strong
            >{file.fileName.replace(".kt", "")}</strong
          >
        </div>
        <div class="card-body"></div>
      </div>
    {/each}
  </div>
</div>
