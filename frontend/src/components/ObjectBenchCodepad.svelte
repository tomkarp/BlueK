<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
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
  interface Props {
    codepadOpen: boolean;
    bench: BenchObject[];
    fieldInput: HTMLInputElement | null;
    selectedObjectId: string;
    history: HistoryEntry[];
    codepadMenu: CodepadMenu | null;
    codepad: string;
    liveObjectIds: string[];
    phase: RuntimeSnapshot["phase"];
    inputReady: boolean;
    insertBenchName: (name: string) => void;
    inspectObject: (object: BenchObject) => Promise<void>;
    openMenu: (
      event: MouseEvent,
      file?: ProjectFile,
      object?: BenchObject,
    ) => void;
    beginBenchResize: (event: PointerEvent) => void;
    benchOpen: boolean;
    requestObjectOnBench: (value: RuntimeValue) => void;
    submitCodepad: (event: KeyboardEvent) => void;
    openFeedback: (context: import("../feedbackApi").FeedbackContext) => void;
  }

  let {
    codepadOpen = $bindable(),
    bench,
    fieldInput,
    selectedObjectId = $bindable(),
    history,
    codepadMenu = $bindable(),
    codepad = $bindable(),
    liveObjectIds,
    phase,
    inputReady,
    insertBenchName,
    inspectObject,
    openMenu,
    beginBenchResize,
    benchOpen = $bindable(),
    requestObjectOnBench,
    submitCodepad,
    openFeedback,
  }: Props = $props();
  function preventDefault<E extends Event>(handler: (event: E) => unknown) {
    return (event: E) => {
      event.preventDefault();
      return handler(event);
    };
  }
  function stopPropagation<E extends Event>(handler: (event: E) => unknown) {
    return (event: E) => {
      event.stopPropagation();
      return handler(event);
    };
  }
</script>

<div
  class:codepad-collapsed={!codepadOpen}
  class:bench-collapsed={!benchOpen}
  class="lower"
>
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
          onmousedown={(event) => fieldInput && event.preventDefault()}
          onclick={(event) => {
            // Like BlueJ's call dialogs: while a field is edited, a
            // click inserts the object's name instead of selecting it.
            if (!fieldInput) selectedObjectId = object.objectId;
            else if (event.detail <= 1) insertBenchName(object.name);
          }}
          ondblclick={() => !fieldInput && inspectObject(object)}
          onkeydown={(event) => event.key === "Enter" && inspectObject(object)}
          oncontextmenu={(event) => {
            selectedObjectId = object.objectId;
            openMenu(event, undefined, object);
          }}
        >
          <span>{object.name}:</span><br /><span class="bench-object-class-name"
            >{object.className}</span
          >
        </div>
      {/each}
    </div>
  </section>
  <button
    class="pane-toggle-left"
    aria-label={benchOpen
      ? t("ui.codepad.collapseCodepad")
      : t("ui.codepad.expandObjectBench")}
    onclick={() => {
      if (benchOpen) codepadOpen = !codepadOpen;
      else benchOpen = true;
    }}>›</button
  >
  <div
    class="bench-codepad-splitter"
    role="separator"
    aria-label={t("ui.codepad.resizeObjectBenchAndCodepad")}
    onpointerdown={beginBenchResize}
  ></div>
  <button
    class="pane-toggle-right"
    aria-label={codepadOpen
      ? t("ui.codepad.collapseObjectBench")
      : t("ui.codepad.expandCodepad")}
    onclick={() => {
      if (codepadOpen) benchOpen = !benchOpen;
      else codepadOpen = true;
    }}>‹</button
  >
  {#if codepadOpen}
    <section class="codepad">
      <div
        class="codepad-history"
        role="log"
        aria-label={t("ui.codepad.codepadHistory")}
        oncontextmenu={stopPropagation(
          preventDefault(
            (event: MouseEvent) =>
              (codepadMenu = { x: event.clientX, y: event.clientY }),
          ),
        )}
      >
        {#each history as entry}
          <div
            class="codepad-entry"
            role="group"
            oncontextmenu={stopPropagation(
              preventDefault(
                (event: MouseEvent) =>
                  (codepadMenu = {
                    x: event.clientX,
                    y: event.clientY,
                    text: entry.code,
                  }),
              ),
            )}
          >
            <div>{entry.code}</div>
            {#if entry.objectResult || entry.objectId}
              <button
                class="codepad-object-result svelte-codepad-object-result"
                disabled={!entry.objectId ||
                  !liveObjectIds.includes(entry.objectId)}
                onclick={() =>
                  entry.objectId &&
                  requestObjectOnBench({
                    kind: "object",
                    objectId: entry.objectId,
                    className: entry.className || "Object",
                    name: entry.name,
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
                  onclick={() =>
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
        onkeydown={submitCodepad}
        disabled={codepadIsDisabled(phase, inputReady)}
      ></textarea>
    </section>
  {/if}
</div>
