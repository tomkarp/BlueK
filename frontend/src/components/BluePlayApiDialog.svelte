<script lang="ts">
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
        <p>{api.summary}</p>
      </div>
      <div class="blueplay-api-content">
        {#each api.sections as section}
          <section class="blueplay-api-section" aria-label={section.title}>
            <h4>{section.title}</h4>
            <dl class="blueplay-api-members">
              {#each section.members as member}
                <div class="blueplay-api-member">
                  <dt><code>{member.signature}</code></dt>
                  <dd>{member.description}</dd>
                </div>
              {/each}
            </dl>
          </section>
        {/each}
      </div>
      <div class="dialog-actions">
        <button on:click={() => (bluePlayApiFile = null)}>Close</button>
      </div>
    </div>
  </div>{/if}
