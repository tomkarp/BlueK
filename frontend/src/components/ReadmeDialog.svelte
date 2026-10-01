<script lang="ts">
  import { containClicks } from "../uiActions";

  import { markdownEditor } from "../editorActions";
  export let readmeOpen: boolean;
  export let readmeHelp: boolean;
  export let readme: string;
  export let closeReadme: () => void;
</script>

{#if readmeOpen}<div class="modal topmost-modal" role="presentation">
    <div
      class="dialog readme-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="readme-title"
      use:containClicks
    >
      <div class="readme-header">
        <h3 id="readme-title">README.md</h3>
        <button
          class="readme-help-button"
          aria-expanded={readmeHelp}
          aria-label="Markdown help"
          title="Markdown help"
          on:click={() => (readmeHelp = !readmeHelp)}>?</button
        >
      </div>
      {#if readmeHelp}<div class="readme-help" aria-label="Markdown syntax">
          <table>
            <tbody>
              <tr
                ><td><code># Heading</code></td><td
                  ><span class="help-h1">Heading</span></td
                ></tr
              >
              <tr
                ><td><code>## Sub heading</code></td><td
                  ><span class="help-h2">Sub heading</span></td
                ></tr
              >
              <tr
                ><td><code>**bold**</code></td><td><strong>bold</strong></td
                ></tr
              >
              <tr><td><code>*italic*</code></td><td><em>italic</em></td></tr>
              <tr
                ><td><code>`code`</code></td><td
                  ><code class="help-code">code</code></td
                ></tr
              >
              <tr
                ><td><code>```</code> … <code>```</code></td><td
                  ><code class="help-code">code block</code></td
                ></tr
              >
              <tr><td><code>- item</code></td><td>• item</td></tr>
              <tr><td><code>1. item</code></td><td>1. item</td></tr>
              <tr
                ><td><code>&gt; quote</code></td><td
                  ><span class="help-quote">quote</span></td
                ></tr
              >
              <tr
                ><td><code>[BlueK](https://…)</code></td><td
                  ><span class="help-link">BlueK</span></td
                ></tr
              >
              <tr
                ><td><code>---</code></td><td
                  ><span class="help-rule"></span></td
                ></tr
              >
            </tbody>
          </table>
        </div>{/if}
      <div
        class="readme-editor"
        use:markdownEditor={{
          value: readme,
          onChange: (value: string) => (readme = value),
        }}
      ></div>
      <div class="dialog-actions">
        <button on:click={closeReadme}>Close</button>
      </div>
    </div>
  </div>{/if}
