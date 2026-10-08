<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import type { ProjectFile } from "../../../runtime-contract/src/index";

  import { bluePlayApiDocs } from "../bluePlayApi";
  export let bluePlayApiFile: ProjectFile | null;
</script>

{#if bluePlayApiFile}{@const api = bluePlayApiDocs[bluePlayApiFile.fileName]}
  <div class="modal topmost-modal">
    <div
      class="dialog blueplay-api-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="blueplay-api-title"
    >
      <div class="blueplay-api-header">
        <h3 id="blueplay-api-title">{api.title}</h3>
        <p>{$language.message(api.summary)}</p>
      </div>
      <div class="blueplay-api-content">
        {#each api.sections as section}
          <section
            class="blueplay-api-section"
            aria-label={$language.message(section.title)}
          >
            <h4>{$language.message(section.title)}</h4>
            <dl class="blueplay-api-members">
              {#each section.members as member}
                <div class="blueplay-api-member">
                  <dt><code>{member.signature}</code></dt>
                  <dd>{$language.message(member.description)}</dd>
                </div>
              {/each}
            </dl>
          </section>
        {/each}
      </div>
      <div class="dialog-actions">
        <button on:click={() => (bluePlayApiFile = null)}
          >{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>{/if}
