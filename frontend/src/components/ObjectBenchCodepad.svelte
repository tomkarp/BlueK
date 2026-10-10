<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import type {
    ProjectFile,
    RuntimeSnapshot,
    RuntimeValue,
  } from "../../../runtime-contract/src/index";

  import type { BenchObject, HistoryEntry, CodepadMenu } from "../uiTypes";
  import { codepadIsDisabled } from "../uiParity";
  import {
    codepadResultValue,
    codepadResultType,
  } from "../codepadPresentation";
  export let codepadOpen: boolean;
  export let bench: BenchObject[];
  export let fieldInput: HTMLInputElement | null;
  export let selectedObjectId: string;
  export let history: HistoryEntry[];
  export let codepadMenu: CodepadMenu | null;
  export let codepad: string;
  export let liveObjectIds: string[];
  export let phase: RuntimeSnapshot["phase"];
  export let inputReady: boolean;
  export let insertBenchName: (name: string) => void;
  export let inspectObject: (object: BenchObject) => Promise<void>;
  export let openMenu: (
    event: MouseEvent,
    file?: ProjectFile,
    object?: BenchObject,
  ) => void;
  export let beginBenchResize: (event: PointerEvent) => void;
  export let requestObjectOnBench: (value: RuntimeValue) => void;
  export let submitCodepad: (event: KeyboardEvent) => void;
  export let openFeedback: (
    context: import("../feedbackApi").FeedbackContext,
  ) => void;
</script>

<div class:codepad-collapsed={!codepadOpen} class="lower">
  <section class="bench" class:bench-picking={Boolean(fieldInput)}>
    <div class="bench-items">
      {#each bench as object (object.name)}
        <div
          role="button"
          tabindex="0"
          class:selected={selectedObjectId === object.objectId}
          class="object"
          title={fieldInput
            ? t("ui.codepad.insert0", [object.name])
            : undefined}
          on:mousedown={(event) => fieldInput && event.preventDefault()}
          on:click={(event) => {
            // Like BlueJ's call dialogs: while a field is edited, a
            // click inserts the object's name instead of selecting it.
            if (!fieldInput) selectedObjectId = object.objectId;
            else if (event.detail <= 1) insertBenchName(object.name);
          }}
          on:dblclick={() => !fieldInput && inspectObject(object)}
          on:keydown={(event) => event.key === "Enter" && inspectObject(object)}
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
    aria-label={t("ui.codepad.resizeObjectBenchAndCodepad")}
    on:pointerdown={beginBenchResize}
  ></div>
  <button
    class="codepad-toggle"
    aria-label={codepadOpen
      ? t("ui.codepad.collapseCodepad")
      : t("ui.codepad.expandCodepad")}
    on:click={() => (codepadOpen = !codepadOpen)}
    >{codepadOpen ? "›" : "‹"}</button
  >
  {#if codepadOpen}
    <section class="codepad">
      <div
        class="codepad-history"
        role="log"
        aria-label={t("ui.codepad.codepadHistory")}
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
                disabled={!entry.objectId ||
                  !liveObjectIds.includes(entry.objectId)}
                on:click={() =>
                  entry.objectId &&
                  requestObjectOnBench({
                    kind: "object",
                    objectId: entry.objectId,
                    className: entry.className || "Object",
                  })}
                aria-label={t("ui.codepad.get0OnObjectBench", [
                  entry.className || "object",
                ])}
              >
                <span class="codepad-object-icon" aria-hidden="true"
                ></span><span class="codepad-object-label"
                  >{#if entry.result}<span
                      class="codepad-result-value"
                      title={entry.result}
                      >{codepadResultValue(entry.result)}</span
                    ><span class="codepad-result-type"
                      >{codepadResultType(entry.result)}</span
                    >{:else}<span class="codepad-object-placeholder"
                      >{t("ui.codepad.object")}</span
                    ><span> : {entry.className}</span>{/if}</span
                >
              </button>
            {:else if entry.error}<div class="codepad-error">
                {entry.error}
                <button
                  class="feedback-inline-button"
                  on:click={() =>
                    openFeedback({ error: entry.error, code: entry.code })}
                  >{t("ui.feedback.title")}</button
                >
              </div>
            {:else if entry.result}<div class="codepad-result">
                <span class="codepad-value-icon" aria-hidden="true"></span><span
                  class="codepad-result-value"
                  title={entry.result}>{codepadResultValue(entry.result)}</span
                ><span class="codepad-result-type"
                  >{codepadResultType(entry.result)}</span
                >
              </div>{/if}
          </div>
        {/each}
      </div>
      <textarea
        aria-label={t("ui.codepad.codepadInput")}
        rows="1"
        bind:value={codepad}
        on:keydown={submitCodepad}
        disabled={codepadIsDisabled(phase, inputReady)}
      ></textarea>
    </section>
  {/if}
</div>
