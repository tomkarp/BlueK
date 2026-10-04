<script lang="ts">
  import { focusOnMount } from "../uiActions";

  import type { Diagnostic } from "../../../runtime-contract/src/index";

  export let compilerDialog: boolean;
  export let compilerDiagnostics: Diagnostic[];
  export let error: string;
</script>

{#if compilerDialog}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog compiler-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="compiler-error-title"
    >
      <h3 id="compiler-error-title">Compiler errors</h3>
      <p>The project could not be compiled.</p>
      <!-- Errors inside a project file are marked in its editor; only errors
             without a source location, such as a failed call, land here. -->
      {#each compilerDiagnostics as diagnostic}<div
          class="compiler-error-location"
        >
          <strong>{diagnostic.fileName || "Kotlin source"}</strong> · line {diagnostic.line},
          column {diagnostic.column}
        </div>
        <pre
          class="compiler-error-message">{diagnostic.message}</pre>{/each}{#if !compilerDiagnostics.length}<pre
          class="compiler-error-text">{error}</pre>{/if}
      <div class="dialog-actions">
        <button use:focusOnMount on:click={() => (compilerDialog = false)}
          >Close</button
        >
      </div>
    </div>
  </div>{/if}
