<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import type { RuntimeSnapshot } from "../../../runtime-contract/src/index";

  import type { BenchObject, ActiveWindow } from "../uiTypes";
  export let selectedObjectId: string;
  export let bench: BenchObject[];
  export let terminalOpen: boolean;
  export let terminal: string;
  export let inputReady: boolean;
  export let activeWindow: ActiveWindow;
  export let programActive: boolean;
  export let phase: RuntimeSnapshot["phase"];
  export let resetRuntime: () => Promise<void>;
  export let defaultTestClass = "";
  export let canSaveFixture = false;
  export let captureError = "";
  export let canLoadFixture = false;
  export let canChooseTestClass = false;
  export let saveFixture: () => void = () => {};
  export let loadFixture: () => void = () => {};
  export let chooseTestClass: () => void = () => {};
</script>

<footer class="status-bar">
  <span class="current-element"
    >{selectedObjectId &&
    bench.find((object) => object.objectId === selectedObjectId)
      ? `${bench.find((object) => object.objectId === selectedObjectId)?.name} : ${bench.find((object) => object.objectId === selectedObjectId)?.className}`
      : t("ui.status.noObjectSelected")}</span
  >
  <div class="fixture-actions" aria-label={t("ui.status.testStateActions")}>
    <button
      aria-label={t("ui.common.saveState")}
      title={captureError ||
        (defaultTestClass
          ? t("ui.status.saveStateTo0", [defaultTestClass])
          : t("ui.status.saveObjectBenchAsATestState"))}
      disabled={!canSaveFixture}
      on:click={saveFixture}
      ><svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 3h12l4 4v14H4z" />
        <path d="M8 3v5h8V3" />
        <path d="M12 12v7m-3-3 3 3 3-3" />
      </svg></button
    ><button
      aria-label={t("ui.common.loadState")}
      title={defaultTestClass
        ? t("ui.status.loadStateFrom0", [defaultTestClass])
        : t("ui.common.chooseADefaultTestClassFirst")}
      disabled={!canLoadFixture}
      on:click={loadFixture}
      ><svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 3h12l4 4v14H4z" />
        <path d="M8 3v5h8V3" />
        <path d="M12 19v-7m-3 3 3-3 3 3" />
      </svg></button
    ><button
      aria-label={t("ui.common.chooseDefaultTestClass")}
      title={defaultTestClass
        ? t("ui.status.defaultTestClass0", [defaultTestClass])
        : t("ui.common.chooseDefaultTestClass")}
      disabled={!canChooseTestClass}
      on:click={chooseTestClass}
      ><svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="14" height="16" rx="1" />
        <path d="M7 8h6M7 12h6M7 16h3" />
        <path d="M17 8h4v13h-9v-1" />
      </svg></button
    >
  </div>
  {#if !terminalOpen && (terminal || inputReady)}<button
      class="terminal-reopen"
      on:click={() => {
        terminalOpen = true;
        activeWindow = "terminal";
      }}>{t("ui.status.terminal")}</button
    >{/if}
  <span
    class:active={programActive}
    class="activity-bar"
    role="progressbar"
    aria-busy={programActive}
    title={programActive ? t("ui.status.blueKIsRunning") : t("ui.status.ready")}
    aria-label={phase === "compiling"
      ? t("ui.status.compiling")
      : phase === "running" || inputReady
        ? t("ui.status.programActive")
        : t("ui.status.ready")}
    >{#if programActive}<span class="activity-indicator" aria-hidden="true"
      ></span>{/if}</span
  >
  <button
    class="reset-runtime"
    aria-label={t("ui.common.resetRuntime")}
    title={t("ui.common.reset")}
    on:click={resetRuntime}
    disabled={phase === "compiling"}>↶</button
  >
</footer>
