<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import type { CloudWorkspace } from "../workspace/CloudWorkspace.svelte";
  const language = useLanguage();
  const t = $derived($language.t);
  let renamingId = $state<string | null>(null);
  let renameValue = $state("");
  let {
    cloud,
    mode,
    projectName = $bindable(),
    onLoaded,
    exportProject,
  }: {
    cloud: CloudWorkspace;
    mode: "open" | "save";
    projectName?: string;
    onLoaded: () => void;
    exportProject: () => void;
  } = $props();

  function beginRename(id: string, name: string) {
    renamingId = id;
    renameValue = name;
  }

  async function saveRename(id: string) {
    if (await cloud.rename(id, renameValue)) {
      renamingId = null;
      renameValue = "";
    }
  }
</script>

<div class="cloud-project-panel">
  {#if cloud.error}<p class="dialog-error" role="alert">
      {cloud.error}
      {mode === "save" ? t("ui.cloud.failureBackup") : ""}
    </p>{/if}
  {#if cloud.notice}<p role="status">{cloud.notice}</p>{:else if cloud.busy && cloud.sessionReady}<p
      role="status"
    >
      {t("ui.cloud.working")}
    </p>{/if}
  {#if !cloud.sessionReady}
    <p role="status">{t("ui.cloud.working")}</p>
  {:else if cloud.user}
    <p>{t("ui.cloud.signedIn", [cloud.user.username])}</p>
    {#if mode === "save"}
      <p>{t("ui.cloud.storageAdvice")}</p>
      <label class="cloud-project-name">
        <span>{t("ui.cloud.accountProjectName")}</span>
        <input type="text" maxlength="120" required bind:value={projectName} />
      </label>
      <div class="cloud-actions">
        <button disabled={cloud.busy} onclick={() => cloud.save()}
          >{t(cloud.attached ? "ui.cloud.update" : "ui.cloud.save")}</button
        >
        {#if cloud.attached}<button
            disabled={cloud.busy}
            onclick={() => cloud.save(true)}>{t("ui.cloud.saveCopy")}</button
          >{/if}
      </div>
      <p class="program-source-note">
        {t("ui.cloud.size", [cloud.sizeBytes.toLocaleString($language.locale)])}
      </p>
      <div class="cloud-saved-projects">
        <div class="cloud-saved-projects-heading">
          <h4>{t("ui.cloud.savedProjects")}</h4>
        </div>
        {#if cloud.projects.length}<ul class="cloud-projects">
            {#each cloud.projects as project (project.id)}
              <li>
                {#if renamingId === project.id}<form
                    class="cloud-rename-form"
                    onsubmit={(event) => {
                      event.preventDefault();
                      void saveRename(project.id);
                    }}
                  >
                    <input
                      type="text"
                      required
                      maxlength="120"
                      aria-label={t("ui.cloud.newProjectName0", [
                        project.name || t("ui.common.untitledProject"),
                      ])}
                      bind:value={renameValue}
                    />
                    <button type="submit" disabled={cloud.busy}
                      >{t("ui.cloud.rename")}</button
                    >
                    <button
                      type="button"
                      disabled={cloud.busy}
                      onclick={() => (renamingId = null)}
                      >{t("ui.common.cancel")}</button
                    >
                  </form>{:else}<div class="cloud-project-summary">
                    <strong
                      >{project.name || t("ui.common.untitledProject")}</strong
                    >
                    {#if cloud.attachedProjectId === project.id}<span
                        class="cloud-current-project"
                        >{t("ui.cloud.currentProject")}</span
                      >{/if}
                    <small
                      >{new Date(project.updatedAt).toLocaleString(
                        $language.locale,
                      )}</small
                    >
                  </div>
                  <button
                    type="button"
                    class="cloud-project-rename"
                    disabled={cloud.busy}
                    aria-label={t("ui.cloud.renameProject0", [
                      project.name || t("ui.common.untitledProject"),
                    ])}
                    title={t("ui.cloud.renameProject0", [
                      project.name || t("ui.common.untitledProject"),
                    ])}
                    onclick={() =>
                      beginRename(
                        project.id,
                        project.name || t("ui.common.untitledProject"),
                      )}
                    ><svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m14 5 5 5M4 20l4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
                    </svg></button
                  >{/if}
              </li>
            {/each}
          </ul>{:else if !cloud.busy}<p>{t("ui.cloud.noProjects")}</p>{/if}
      </div>
    {:else}
      {#if !cloud.projects.length && !cloud.busy && !cloud.error}<p>
          {t("ui.cloud.noProjects")}
        </p>{/if}
      <ul class="cloud-projects">
        {#each cloud.projects as project (project.id)}
          <li>
            {#if renamingId === project.id}<form
                class="cloud-rename-form cloud-rename-form-open"
                onsubmit={(event) => {
                  event.preventDefault();
                  void saveRename(project.id);
                }}
              >
                <input
                  type="text"
                  required
                  maxlength="120"
                  aria-label={t("ui.cloud.newProjectName0", [
                    project.name || t("ui.common.untitledProject"),
                  ])}
                  bind:value={renameValue}
                />
                <button type="submit" disabled={cloud.busy}
                  >{t("ui.cloud.rename")}</button
                >
                <button
                  type="button"
                  disabled={cloud.busy}
                  onclick={() => (renamingId = null)}
                  >{t("ui.common.cancel")}</button
                >
              </form>
              <button
                disabled={cloud.busy}
                class="cloud-project-delete"
                aria-label={t("ui.transfer.deleteSavedProject0", [
                  project.name || t("ui.common.untitledProject"),
                ])}
                title={t("ui.transfer.deleteSavedProject0", [
                  project.name || t("ui.common.untitledProject"),
                ])}
                onclick={() => cloud.remove(project.id)}
                ><svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
                </svg></button
              >{:else}<button
                class="cloud-project-open"
                disabled={cloud.busy}
                onclick={async () => {
                  if (await cloud.load(project.id)) onLoaded();
                }}
              >
                <strong
                  >{project.name || t("ui.common.untitledProject")}</strong
                >
                <span
                  >{new Date(project.updatedAt).toLocaleString(
                    $language.locale,
                  )}</span
                >
              </button>
              <button
                type="button"
                class="cloud-project-rename"
                disabled={cloud.busy}
                aria-label={t("ui.cloud.renameProject0", [
                  project.name || t("ui.common.untitledProject"),
                ])}
                title={t("ui.cloud.renameProject0", [
                  project.name || t("ui.common.untitledProject"),
                ])}
                onclick={() =>
                  beginRename(
                    project.id,
                    project.name || t("ui.common.untitledProject"),
                  )}
                ><svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m14 5 5 5M4 20l4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
                </svg></button
              >
              <button
                disabled={cloud.busy}
                class="cloud-project-delete"
                aria-label={t("ui.transfer.deleteSavedProject0", [
                  project.name || t("ui.common.untitledProject"),
                ])}
                title={t("ui.transfer.deleteSavedProject0", [
                  project.name || t("ui.common.untitledProject"),
                ])}
                onclick={() => cloud.remove(project.id)}
                ><svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
                </svg></button
              >{/if}
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <p>
      {t(
        mode === "open"
          ? "ui.transfer.signInToOpen"
          : "ui.transfer.signInToSave",
      )}
    </p>
    <button disabled={cloud.busy} onclick={() => cloud.show(mode)}
      >{t("ui.cloud.login")}</button
    >
  {/if}
  {#if cloud.error && mode === "save"}<button onclick={exportProject}
      >{t("ui.common.exportProjectJSON")}</button
    >{/if}
</div>

<style>
  .cloud-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .cloud-project-name {
    display: grid;
    gap: 5px;
    margin: 12px 0;
  }
  .cloud-project-name span,
  .cloud-saved-projects-heading h4 {
    font-weight: 600;
  }
  .cloud-project-name input {
    box-sizing: border-box;
    width: 100%;
  }
  .cloud-saved-projects {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #ccc;
  }
  .cloud-saved-projects-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .cloud-saved-projects-heading h4 {
    margin: 0;
  }
  .cloud-current-project {
    font-size: 12px;
    color: #526b36;
  }
  .cloud-projects li {
    display: grid;
    align-items: stretch;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 4px 10px;
    padding: 8px 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
  }
  .cloud-projects li strong {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .cloud-projects li small {
    grid-column: 1;
    color: #666;
  }
  .cloud-project-summary {
    grid-column: 1;
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .cloud-project-rename {
    grid-column: 2;
    grid-row: 1;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    min-width: 36px;
    padding: 6px;
  }
  .cloud-project-rename svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .cloud-rename-form {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .cloud-rename-form-open {
    grid-column: 1 / 3;
  }
  .cloud-rename-form input {
    box-sizing: border-box;
    flex: 1 1 100%;
    min-width: 0;
  }
  .cloud-projects {
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
  }
  .cloud-project-open {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 5px;
  }
  .cloud-project-open strong {
    overflow-wrap: anywhere;
  }
  .cloud-project-open span {
    font-size: 12px;
  }
  .cloud-project-delete {
    grid-column: 3;
    grid-row: 1;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    min-width: 36px;
    padding: 6px;
  }
  .cloud-project-delete svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
