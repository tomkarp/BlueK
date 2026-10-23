<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import type { CloudWorkspace } from "../workspace/CloudWorkspace.svelte";
  const language = useLanguage();
  const t = $derived($language.t);
  let {
    cloud,
    mode,
    onLoaded,
    onSaved = () => {},
    onManage = () => {},
    exportProject,
  }: {
    cloud: CloudWorkspace;
    mode: "open" | "save";
    onLoaded: () => void;
    onSaved?: () => void;
    onManage?: () => void;
    exportProject: () => void;
  } = $props();
</script>

<div class="cloud-project-panel">
  {#if mode === "open"}<button class="cloud-management-link" onclick={onManage}>
      {t("ui.cloud.openProjectManagement")}
    </button>{/if}
  {#if cloud.error}<p class="dialog-error" role="alert">
      {cloud.error}
      {mode === "save" ? t("ui.cloud.failureBackup") : ""}
    </p>{/if}
  {#if cloud.notice}<p role="status">
      {cloud.notice}
    </p>{:else if cloud.busy && cloud.sessionReady}<p role="status">
      {t("ui.cloud.working")}
    </p>{/if}
  {#if !cloud.sessionReady}
    <p role="status">{t("ui.cloud.working")}</p>
  {:else if cloud.user}
    {#if mode === "save"}
      <div class="dialog-warning storage-warning" role="note">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 2.8 20h18.4L12 3Z" />
          <path d="M12 9v5m0 3h.01" />
        </svg>
        <span>{t("ui.cloud.storageAdvice")}</span>
      </div>
      <div class="project-choice-list cloud-save-choices">
        <button
          class="file-export-choice cloud-save-choice"
          disabled={cloud.busy}
          onclick={async () => {
            if (await cloud.save()) onSaved();
          }}
          ><strong>{cloud.currentProjectName}</strong><span
            >{t(cloud.attached ? "ui.cloud.update" : "ui.cloud.save")}</span
          ></button
        >
      </div>
    {:else}
      {#if !cloud.projects.length && !cloud.busy && !cloud.error}<p>
          {t("ui.cloud.noProjects")}
        </p>{/if}
      <ul class="cloud-projects">
        {#each cloud.projects as project (project.id)}
          <li>
            <button
              class="cloud-project-open"
              disabled={cloud.busy}
              onclick={async () => {
                if (await cloud.load(project.id)) onLoaded();
              }}
            >
              <strong>{project.name || t("ui.common.untitledProject")}</strong>
              <span
                >{new Date(project.updatedAt).toLocaleString(
                  $language.locale,
                )}</span
              >
            </button>
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
  .cloud-project-panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }
  .cloud-projects li {
    display: flex;
    align-items: stretch;
    margin: 8px 0;
    border: 1px solid #ccc;
    border-radius: 5px;
  }
  .cloud-projects {
    flex: 1;
    min-height: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
  }
  .cloud-project-open {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 5px;
  }
  .cloud-project-open span {
    font-size: 12px;
  }
  .cloud-management-link {
    align-self: flex-start;
    flex: 0 0 auto;
    margin: 0 0 10px;
  }
</style>
