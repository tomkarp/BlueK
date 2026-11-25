<script lang="ts">
  import { untrack } from "svelte";
  import type {
    ProjectFile,
    ProjectResource,
  } from "../../../runtime-contract/src/index";
  import { useLanguage } from "../i18n/Language.svelte";
  import { printKotlinLines, printReadmeLines } from "../projectPrint";
  import { containClicks, focusOnMount } from "../uiActions";

  interface Props {
    files: ProjectFile[];
    name: string;
    readme: string;
    images: ProjectResource[];
    sounds: ProjectResource[];
    close: () => void;
  }

  let { files, name, readme, images, sounds, close }: Props = $props();
  const language = useLanguage();
  const { t } = language;
  const readmeId = "README.md";
  let entries = $state(
    untrack(() =>
      [
        ...(readme.trim() ? [readmeId] : []),
        ...files.map((file) => file.id),
      ].map((id) => ({ id, included: true })),
    ),
  );
  let manuallyOrdered = $state(false);
  const order = $derived.by(() => {
    if (manuallyOrdered) return entries;
    const collator = new Intl.Collator(language.locale, {
      sensitivity: "base",
    });
    const ranks = { class: 0, functions: 1, unknown: 2 };
    const sortedIds = [...files]
      .sort(
        (a, b) =>
          ranks[a.kind] - ranks[b.kind] ||
          collator.compare(a.fileName, b.fileName),
      )
      .map((file) => file.id);
    const positions = new Map(
      [readmeId, ...sortedIds].map((id, index) => [id, index]),
    );
    return [...entries].sort(
      (a, b) => positions.get(a.id)! - positions.get(b.id)!,
    );
  });
  let dragged = $state<string>();
  let target = $state<string>();
  let showLineNumbers = $state(true);
  let printError = $state(false);
  let fileContents = $derived(
    new Map(
      files.map((file) => [
        file.id,
        {
          name: file.path || file.fileName,
          lines: printKotlinLines(file.source),
        },
      ]),
    ),
  );
  let readmeLines = $derived(printReadmeLines(readme));
  let included = $derived(
    order
      .filter((item) => item.included)
      .flatMap((item) => {
        if (item.id === readmeId) return readme.trim() ? [item.id] : [];
        return fileContents.has(item.id) ? [item.id] : [];
      }),
  );
  let hasContent = $derived(
    included.length > 0 || images.length > 0 || sounds.length > 0,
  );

  function move(id: string, to: number) {
    const from = order.findIndex((item) => item.id === id);
    if (from < 0 || from === to || to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    entries = next;
    manuallyOrdered = true;
  }

  function startDrag(event: DragEvent, id: string) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    dragged = id;
  }

  function endDrag() {
    dragged = undefined;
    target = undefined;
  }

  function dragOver(event: DragEvent, id: string) {
    if (!dragged || !event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    target = id;
  }

  function drop(event: DragEvent, index: number) {
    if (!dragged) return;
    event.preventDefault();
    move(dragged, index);
    endDrag();
  }

  async function print() {
    printError = false;
    try {
      await window.print();
    } catch {
      printError = true;
    }
  }
</script>

<div class="modal topmost-modal project-print-modal" role="presentation">
  <div
    class="project-print-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="project-print-title"
    use:containClicks
  >
    <header class="print-controls">
      <h2 id="project-print-title">{t("ui.print.title")}</h2>
      <div class="print-actions">
        <button onclick={close} use:focusOnMount>{t("ui.common.close")}</button>
        <button onclick={print} disabled={!hasContent}
          >{t("ui.print.print")}</button
        >
      </div>
    </header>
    {#if printError}<p class="print-controls" role="alert">
        {t("ui.print.error")}
      </p>{/if}

    <div class="print-layout">
      {#if order.length}
        <section
          class="print-settings print-controls"
          aria-labelledby="project-print-files"
        >
          <h3 id="project-print-files">{t("ui.print.files")}</h3>
          <p>{t("ui.print.reorderHelp")}</p>
          <ol class="print-file-list">
            {#each order as item, index (item.id)}
              {@const fileName =
                item.id === readmeId
                  ? readmeId
                  : fileContents.get(item.id)?.name}
              {#if fileName}
                <li
                  draggable="true"
                  class={{
                    "drop-target": target === item.id && dragged !== item.id,
                  }}
                  ondragstart={(event) => startDrag(event, item.id)}
                  ondragend={endDrag}
                  ondragover={(event) => dragOver(event, item.id)}
                  ondrop={(event) => drop(event, index)}
                >
                  <span class="drag-handle" aria-hidden="true">⠿</span>
                  <label
                    ><input
                      type="checkbox"
                      bind:checked={item.included}
                    />{fileName}</label
                  >
                  <button
                    aria-label={t("ui.print.moveUp", [fileName])}
                    disabled={index === 0}
                    onclick={() => move(item.id, index - 1)}>↑</button
                  >
                  <button
                    aria-label={t("ui.print.moveDown", [fileName])}
                    disabled={index === order.length - 1}
                    onclick={() => move(item.id, index + 1)}>↓</button
                  >
                </li>
              {/if}
            {/each}
          </ol>
          <label class="print-line-number-choice">
            <input type="checkbox" bind:checked={showLineNumbers} />
            {t("ui.print.lineNumbers")}
          </label>
        </section>
      {/if}
      <div class="print-paper-scroll">
        <article class="project-print-paper">
          <h1>{name.trim() || t("ui.common.untitledProject")}</h1>
          {#each included as id (id)}
            {@const file = fileContents.get(id)}
            {#if id === readmeId}
              <section class="print-readme">
                <h2>{readmeId}</h2>
                {#each readmeLines as line, index (index)}
                  {#if !line.hidden}
                    <div class={line.className}>
                      {#each line.spans as span, index (index)}<span
                          class={span.className}>{span.text}</span
                        >{/each}
                    </div>
                  {/if}
                {/each}
              </section>
            {:else if file}
              <section class="print-source">
                <h2>{file.name}</h2>
                {#each file.lines as line, index (index)}
                  <div class="code-line">
                    {#if showLineNumbers}
                      <span class="line-number" aria-hidden="true"
                        >{index + 1}</span
                      >
                    {/if}
                    <code
                      >{#each line as span, index (index)}<span
                          class={span.className}>{span.text}</span
                        >{/each}</code
                    >
                  </div>
                {/each}
              </section>
            {/if}
          {/each}
          {#if images.length}
            <section>
              <h2>{t("ui.common.images")}</h2>
              <div class="print-images">
                {#each images as image (image.path)}
                  <figure>
                    <img src={image.data} alt="" />
                    <figcaption>{image.path}</figcaption>
                  </figure>
                {/each}
              </div>
            </section>
          {/if}
          {#if sounds.length}
            <section>
              <h2>{t("ui.toolbar.audio")}</h2>
              <ul>
                {#each sounds as sound (sound.path)}<li>{sound.path}</li>{/each}
              </ul>
            </section>
          {/if}
          {#if !hasContent}<p class="print-controls">
              {t("ui.print.empty")}
            </p>{/if}
        </article>
      </div>
    </div>
  </div>
</div>

<style>
  .project-print-dialog {
    background: var(--action-bg);
    color: var(--action-text);
    border-radius: 9px;
    width: min(1180px, 96vw);
    max-height: 94dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header,
  .print-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  header {
    padding: 12px 18px;
    border-bottom: 1px solid var(--action-border);
  }
  button {
    background: var(--action-bg);
    border-color: var(--action-border);
  }
  .print-actions button {
    padding: 7px 12px;
  }
  .print-actions button:last-child:not(:disabled) {
    background: var(--action-hover-bg);
    border-color: var(--action-accent);
  }
  header h2,
  .print-settings h3 {
    margin: 0;
  }
  .print-layout {
    display: flex;
    min-height: 0;
  }
  .print-settings {
    flex: 0 1 330px;
    min-width: 210px;
    overflow: auto;
    padding: 16px;
  }
  .print-settings p {
    color: var(--action-muted);
  }
  .print-file-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .print-file-list li {
    display: flex;
    gap: 5px;
    align-items: center;
    border: 1px solid var(--action-border);
    border-radius: 5px;
    margin-block: 5px;
    padding: 4px;
  }
  .print-line-number-choice {
    display: flex;
    gap: 5px;
    margin-top: 12px;
  }
  .print-file-list li.drop-target {
    outline: 2px solid var(--action-accent);
  }
  .drag-handle {
    cursor: grab;
    padding: 4px;
  }
  .print-file-list label {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .print-paper-scroll {
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 16px;
    background: #d4d7db;
  }
  .project-print-paper {
    box-sizing: border-box;
    background: white;
    color: #171717;
    margin: 0 auto;
    max-width: 210mm;
    padding: 9mm;
    user-select: text;
    overflow-wrap: anywhere;
  }
  .project-print-paper h1 {
    margin: 0 0 14px;
    font-size: 22pt;
  }
  .project-print-paper h2 {
    font-size: 12pt;
    margin: 16px 0 7px;
    border-bottom: 1px solid #bbb;
  }
  .code-line {
    display: flex;
    align-items: baseline;
    font: 9pt/1.45 monospace;
    min-height: 1lh;
  }
  .line-number {
    flex: 0 0 4.5ch;
    color: #555;
    user-select: none;
  }
  code {
    font: inherit;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    tab-size: 4;
    min-width: 0;
  }
  .print-images {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  figure {
    margin: 0;
    max-width: 42mm;
  }
  img {
    display: block;
    max-width: 100%;
    max-height: 35mm;
    object-fit: contain;
  }
  .print-readme {
    white-space: pre-wrap;
    line-height: 1.45;
  }
  .print-readme > div {
    min-height: 1lh;
  }
  .print-readme :global(.cm-md-h1) {
    font-size: 1.45em;
  }
  .print-readme :global(.cm-md-h2) {
    font-size: 1.25em;
  }
  .print-readme
    :global(
      :is(
        .cm-md-h1,
        .cm-md-h2,
        .cm-md-h3,
        .cm-md-h4,
        .cm-md-h5,
        .cm-md-h6,
        .cm-md-strong
      )
    ) {
    font-weight: bold;
  }
  .print-readme :global(.cm-md-em) {
    font-style: italic;
  }
  .print-readme :global(.cm-md-link) {
    color: #075b70;
    text-decoration: underline;
  }
  .print-readme :global(:is(.cm-md-code-span, .cm-md-code-block)) {
    font-family: monospace;
  }
  .print-readme :global(.cm-md-quote) {
    border-left: 3px solid #777;
    padding-left: 8px;
  }
  .print-readme :global(.cm-md-rule) {
    border-bottom: 1px solid #bbb;
  }
  .project-print-paper :global(:is(.tok-keyword, .cm-md-tok-keyword)) {
    color: #70228a;
    font-weight: 600;
  }
  .project-print-paper
    :global(
      :is(.tok-string, .tok-string2, .cm-md-tok-string, .cm-md-tok-string2)
    ) {
    color: #a02231;
  }
  .project-print-paper :global(:is(.tok-comment, .cm-md-tok-comment)) {
    color: #49623f;
    font-style: italic;
  }
  .project-print-paper
    :global(
      :is(.tok-typeName, .tok-definition, .cm-md-tok-type, .cm-md-tok-def)
    ) {
    color: #115e8c;
  }
  .project-print-paper
    :global(
      :is(.tok-number, .tok-bool, .tok-atom, .cm-md-tok-number, .cm-md-tok-atom)
    ) {
    color: #146250;
  }

  @media screen and (max-width: 700px) {
    .print-layout {
      flex-direction: column;
    }
    .print-settings {
      flex: 0 1 auto;
      max-height: 32dvh;
    }
  }
  @media print {
    @page {
      size: A4;
      margin: 14mm;
    }
    :global(.bluek:has(> .project-print-modal)) {
      width: auto;
      height: auto;
      overflow: visible;
      background: white;
    }
    :global(.bluek:has(> .project-print-modal) > :not(.project-print-modal)) {
      display: none !important;
    }
    .project-print-modal,
    .project-print-dialog,
    .print-layout,
    .print-paper-scroll,
    .project-print-paper {
      display: block;
      position: static;
      width: auto;
      max-width: none;
      height: auto;
      max-height: none;
      overflow: visible;
      margin: 0;
      padding: 0;
      background: white;
      border-radius: 0;
    }
    .print-controls {
      display: none !important;
    }
    .project-print-paper h1,
    .project-print-paper h2 {
      break-after: avoid;
    }
    .code-line,
    figure {
      break-inside: avoid;
    }
    .print-images {
      display: block;
    }
    figure {
      display: inline-block;
      vertical-align: top;
      margin: 0 8px 8px 0;
    }
  }
</style>
