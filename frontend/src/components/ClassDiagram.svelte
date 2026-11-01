<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import type { ProjectFile } from "../../../runtime-contract/src/index";

  import type { BenchObject } from "../uiTypes";
  import type { CardPosition, InheritanceEdge } from "../uiTypes";
  interface Props {
    testFileIds?: string[];
    showTestClasses?: boolean;
    inheritanceMode: boolean;
    inheritanceSelection: string;
    showInheritance: boolean;
    inheritanceEdges: InheritanceEdge[];
    hasReadme: boolean;
    readme: string;
    displayFiles: ProjectFile[];
    displayCardPositions: CardPosition[];
    displayCardLayers: number[];
    uncompiled: boolean;
    selectCard: (file: ProjectFile, index: number) => void;
    beginCardDrag: (
      event: MouseEvent | PointerEvent,
      file: ProjectFile,
    ) => void;
    moveCard: (event: MouseEvent | PointerEvent, file: ProjectFile) => void;
    endCardDrag: () => void;
    openEditor: (file?: ProjectFile) => void;
    openMenu: (
      event: MouseEvent,
      file?: ProjectFile,
      object?: BenchObject,
    ) => void;
    isBluePlayLibraryFile: (file: ProjectFile) => boolean;
    openBluePlayApi: (file: ProjectFile) => void;
    openReadme: () => void;
  }

  let {
    testFileIds = [],
    showTestClasses = true,
    inheritanceMode,
    inheritanceSelection,
    showInheritance,
    inheritanceEdges,
    hasReadme,
    readme,
    displayFiles,
    displayCardPositions,
    displayCardLayers,
    uncompiled,
    selectCard,
    beginCardDrag,
    moveCard,
    endCardDrag,
    openEditor,
    openMenu,
    isBluePlayLibraryFile,
    openBluePlayApi,
    openReadme,
  }: Props = $props();
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
        onclick={openReadme}
        onkeydown={(event) => {
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
        onmousedown={(event) => {
          if (!inheritanceMode) beginCardDrag(event, file);
        }}
        onpointermove={(event) => moveCard(event, file)}
        onpointerup={endCardDrag}
        onpointercancel={endCardDrag}
        onclick={() => selectCard(file, index)}
        ondblclick={() => {
          if (inheritanceMode) return;
          if (isBluePlayLibraryFile(file)) openBluePlayApi(file);
          else openEditor(file);
        }}
        oncontextmenu={(event) => openMenu(event, file)}
        onkeydown={(event) => {
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
