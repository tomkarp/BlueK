<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
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
          aria-label={t("ui.readme.markdownHelp")}
          title={t("ui.readme.markdownHelp")}
          on:click={() => (readmeHelp = !readmeHelp)}>?</button
        >
      </div>
      {#if readmeHelp}<div
          class="readme-help"
          aria-label={t("ui.readme.markdownSyntax")}
        >
          <table>
            <tbody>
              <tr
                ><td><code># Heading</code></td><td
                  ><span class="help-h1">{t("ui.readme.heading")}</span></td
                ></tr
              >
              <tr
                ><td><code>## Sub heading</code></td><td
                  ><span class="help-h2">{t("ui.readme.subHeading")}</span></td
                ></tr
              >
              <tr
                ><td><code>**bold**</code></td><td
                  ><strong>{t("ui.readme.bold")}</strong></td
                ></tr
              >
              <tr
                ><td><code>*italic*</code></td><td
                  ><em>{t("ui.readme.italic")}</em></td
                ></tr
              >
              <tr
                ><td><code>`code`</code></td><td
                  ><code class="help-code">code</code></td
                ></tr
              >
              <tr
                ><td><code>```</code> … <code>```</code></td><td
                  ><code class="help-code">{t("ui.readme.codeBlock")}</code></td
                ></tr
              >
              <tr><td><code>- item</code></td><td>{t("ui.readme.item")}</td></tr
              >
              <tr
                ><td><code>1. item</code></td><td>{t("ui.readme.1Item")}</td
                ></tr
              >
              <tr
                ><td><code>&gt; quote</code></td><td
                  ><span class="help-quote">{t("ui.readme.quote")}</span></td
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
          placeholder: t(
            "ui.readme.describeTheProjectHereMarkdownWorksHeadingBold",
          ),
          value: readme,
          onChange: (value: string) => (readme = value),
        }}
      ></div>
      <div class="dialog-actions">
        <button on:click={closeReadme}>{t("ui.common.close")}</button>
      </div>
    </div>
  </div>{/if}
