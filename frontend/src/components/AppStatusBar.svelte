<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import type { RuntimeSnapshot } from "../../../runtime-contract/src/index";

  import type { BenchObject, ActiveWindow } from "../uiTypes";
  interface Props {
    selectedObjectId: string;
    bench: BenchObject[];
    benchOpen?: boolean;
    terminalOpen: boolean;
    terminal: string;
    inputReady: boolean;
    activeWindow: ActiveWindow;
    programActive: boolean;
    phase: RuntimeSnapshot["phase"];
    resetRuntime: () => Promise<void>;
    defaultTestClass?: string;
    canSaveFixture?: boolean;
    captureError?: string;
    canLoadFixture?: boolean;
    canChooseTestClass?: boolean;
    saveFixture?: () => void;
    loadFixture?: () => void;
    chooseTestClass?: () => void;
  }

  let {
    selectedObjectId,
    bench,
    benchOpen = true,
    terminalOpen = $bindable(),
    terminal,
    inputReady,
    activeWindow = $bindable(),
    programActive,
    phase,
    resetRuntime,
    defaultTestClass = "",
    canSaveFixture = false,
    captureError = "",
    canLoadFixture = false,
    canChooseTestClass = false,
    saveFixture = () => {},
    loadFixture = () => {},
    chooseTestClass = () => {},
  }: Props = $props();
</script>

<footer class="status-bar">
  <div class:bench-hidden={!benchOpen} class="object-bench-status">
    <span
      class:project-specific={Boolean(
        selectedObjectId &&
        bench.some((object) => object.objectId === selectedObjectId),
      )}
      class="current-element"
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
        onclick={saveFixture}
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
        onclick={loadFixture}
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
        onclick={chooseTestClass}
        ><svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="14" height="16" rx="1" />
          <path d="M7 8h6M7 12h6M7 16h3" />
          <path d="M17 8h4v13h-9v-1" />
        </svg></button
      >
    </div>
  </div>
  {#if !terminalOpen && (terminal || inputReady)}<button
      class="terminal-reopen"
      onclick={() => {
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
    onclick={resetRuntime}
    disabled={phase === "compiling"}>↶</button
  >
</footer>
