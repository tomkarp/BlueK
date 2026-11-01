<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import { focusOnMount } from "../uiActions";

  import type { Diagnostic } from "../../../runtime-contract/src/index";

  interface Props {
    compilerDialog: boolean;
    compilerDiagnostics: Diagnostic[];
    error: string;
    /** An exception ended a call (RT-82); the runtime stays usable. */
    exception?: boolean;
    openFeedback: () => void;
  }

  let {
    compilerDialog = $bindable(),
    compilerDiagnostics,
    error,
    exception = false,
    openFeedback,
  }: Props = $props();
</script>

{#if compilerDialog}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog compiler-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="compiler-error-title"
    >
      {#if exception}<h3 id="compiler-error-title">
          {t("ui.compiler.exception")}
        </h3>
        <p>{t("ui.compiler.theCallEndedWithAnException")}</p>{:else}<h3
          id="compiler-error-title"
        >
          {t("ui.common.compilerErrors")}
        </h3>
        <p>{t("ui.compiler.theProjectCouldNotBeCompiled")}</p>{/if}
      <!-- Errors inside a project file are marked in its editor; only errors
             without a source location, such as a failed call, land here. -->
      {#each compilerDiagnostics as diagnostic}<div
          class="compiler-error-location"
        >
          <strong>{diagnostic.fileName || t("ui.compiler.kotlinSource")}</strong
          >
          {t("ui.compiler.line")}
          {diagnostic.line}{t("ui.compiler.column")}
          {diagnostic.column}
        </div>
        <pre
          class="compiler-error-message">{diagnostic.message}</pre>{/each}{#if !compilerDiagnostics.length}<pre
          class="compiler-error-text">{error}</pre>{/if}
      <div class="dialog-actions">
        <button onclick={openFeedback}>{t("ui.feedback.title")}</button>
        <button use:focusOnMount onclick={() => (compilerDialog = false)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>{/if}
