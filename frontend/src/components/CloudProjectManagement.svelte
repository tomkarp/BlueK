<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import { focusOnMount } from "../uiActions";
  import type { CloudWorkspace } from "../workspace/CloudWorkspace.svelte";

  const language = useLanguage();
  const t = $derived($language.t);
  let {
    cloud,
  }: {
    cloud: CloudWorkspace;
  } = $props();
  let renamingId = $state<string | null>(null);
  let renameValue = $state("");
  let selectedIds = $state<string[]>([]);

  function toggleProject(id: string, selected: boolean) {
    selectedIds = selected
      ? [...new Set([...selectedIds, id])]
      : selectedIds.filter((item) => item !== id);
  }

  function selectAllProjects(selected: boolean) {
    selectedIds = selected ? cloud.projects.map((project) => project.id) : [];
  }

  async function deleteSelectedProjects() {
    const ids = selectedIds.filter((id) =>
      cloud.projects.some((project) => project.id === id),
    );
    if (
      !ids.length ||
      !window.confirm(
        t("ui.cloud.deleteSelectedConfirm", [ids.length]),
      )
    )
      return;
    await cloud.removeMany(ids);
    selectedIds = selectedIds.filter((id) =>
      cloud.projects.some((project) => project.id === id),
    );
  }

  function beginRename(id: string, name: string) {
    renamingId = id;
    renameValue = name;
  }

  function cancelRename() {
    renamingId = null;
    renameValue = "";
  }

  async function saveRename(id: string) {
    if (await cloud.rename(id, renameValue)) {
      renamingId = null;
      renameValue = "";
    }
  }
</script>

<section
  class="cloud-project-management"
  aria-label={t("ui.cloud.projectManagement")}
>
  <div class="cloud-project-management-heading">
    <button
      disabled={cloud.busy || !cloud.projects.length}
      onclick={() => void cloud.downloadAllProjectsZip()}
      >{t("ui.cloud.downloadAllProjects")}</button
    >
  </div>
  {#if cloud.projects.length}
    <div class="cloud-management-selection">
      <label>
        <input
          type="checkbox"
          checked={selectedIds.length === cloud.projects.length}
          disabled={cloud.busy}
          onchange={(event) =>
            selectAllProjects(event.currentTarget.checked)}
        />
        {t("ui.cloud.selectAllProjects")}
      </label>
      <button
        disabled={cloud.busy || selectedIds.length === 0}
        onclick={() => void deleteSelectedProjects()}
        >{t(
          selectedIds.length === 1
            ? "ui.cloud.deleteOneSelectedProject"
            : "ui.cloud.deleteSelectedProjects",
          [selectedIds.length],
        )}</button
      >
    </div>
    <ul class="cloud-management-projects">
      {#each cloud.projects as project (project.id)}
        <li>
          <label class="cloud-management-select-project">
            <input
              type="checkbox"
              checked={selectedIds.includes(project.id)}
              disabled={cloud.busy || renamingId === project.id}
              aria-label={t("ui.cloud.selectProject0", [project.name])}
              onchange={(event) =>
                toggleProject(project.id, event.currentTarget.checked)}
            />
          </label>
          <div class="cloud-management-project-summary">
            {#if renamingId === project.id}
              <form
                class="cloud-management-rename-form"
                onsubmit={(event) => {
                  event.preventDefault();
                  void saveRename(project.id);
                }}
              >
                <input
                  use:focusOnMount
                  type="text"
                  required
                  maxlength="120"
                  aria-label={t("ui.cloud.newProjectName0", [project.name])}
                  onkeydown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRename();
                    }
                  }}
                  bind:value={renameValue}
                />
              </form>
            {:else}
              <div class="cloud-management-project-title">
                <strong>{project.name || t("ui.common.untitledProject")}</strong>
                <button
                  type="button"
                  class="cloud-management-rename-trigger"
                  disabled={cloud.busy}
                  aria-label={t("ui.cloud.renameProject0", [project.name])}
                  title={t("ui.cloud.renameProject0", [project.name])}
                  onclick={() => beginRename(project.id, project.name)}>✎</button
                >
              </div>
            {/if}
            <span
              >{new Date(project.updatedAt).toLocaleString(
                $language.locale,
              )}</span
            >
          </div>
          <div class="cloud-management-actions">
            <button
              type="button"
              class="cloud-management-icon-action"
              disabled={cloud.busy}
              aria-label={t("ui.cloud.openProject0", [project.name])}
              title={t("ui.cloud.openProject0", [project.name])}
              onclick={() => void cloud.load(project.id)}
              ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h12M12 16V5M9 8l3-3 3 3" /></svg></button
            >
            <button
              type="button"
              class="cloud-management-icon-action"
              disabled={cloud.busy}
              aria-label={t("ui.cloud.downloadJSONProject0", [project.name])}
              title={t("ui.cloud.downloadJSONProject0", [project.name])}
              onclick={() => void cloud.downloadProjectJSON(project.id)}
              ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m-4-4 4 4 4-4M4 17v4h16v-4" /></svg></button
            >
            <button
              type="button"
              class="cloud-management-icon-action"
              disabled={cloud.busy}
              aria-label={t("ui.cloud.duplicateProject0", [project.name])}
              title={t("ui.cloud.duplicateProject0", [project.name])}
              onclick={() => void cloud.duplicate(project.id)}
              ><svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 8V4h12v12h-4M4 8h12v12H4z" />
              </svg></button
            >
            <button
              type="button"
              class="cloud-management-icon-action"
              disabled={cloud.busy}
              aria-label={t("ui.cloud.deleteProject0", [project.name])}
              title={t("ui.cloud.deleteProject0", [project.name])}
              onclick={() => void cloud.remove(project.id)}
              ><svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"
                />
              </svg></button
            >
          </div>
        </li>
      {/each}
    </ul>
  {:else if !cloud.busy}
    <p>{t("ui.cloud.noProjects")}</p>
  {/if}
</section>

<style>
  .cloud-project-management-heading {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    margin: 0;
  }
  .cloud-project-management {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }
  .cloud-project-management-heading button,
  .cloud-management-selection button {
    box-sizing: border-box;
    width: min(100%, 250px);
    min-height: 36px;
  }
  .cloud-management-selection {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .cloud-project-management .cloud-management-selection label,
  .cloud-project-management .cloud-management-select-project {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }
  .cloud-project-management .cloud-management-selection input[type="checkbox"],
  .cloud-project-management .cloud-management-select-project input[type="checkbox"] {
    appearance: auto;
    flex: 0 0 16px;
    width: 16px;
    min-width: 16px;
    height: 16px;
    margin: 0;
    padding: 0;
    display: inline-block;
    cursor: pointer;
  }
  .cloud-management-projects {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 48vh;
    overflow: auto;
  }
  .cloud-management-projects li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    margin: 8px 0;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
  }
  .cloud-management-project-summary {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .cloud-management-project-summary strong {
    overflow-wrap: anywhere;
  }
  .cloud-management-project-title {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .cloud-management-project-title strong {
    min-width: 0;
  }
  .cloud-management-rename-trigger {
    appearance: none;
    flex: 0 0 22px;
    width: 22px;
    min-width: 22px;
    height: 24px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    color: #555;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
  }
  .cloud-management-rename-trigger:hover {
    background: transparent;
    color: #087c9d;
  }
  .cloud-management-rename-trigger:focus-visible {
    outline: 2px solid #168fbd;
    outline-offset: 1px;
  }
  .cloud-management-project-summary span {
    color: #666;
    font-size: 12px;
  }
  .cloud-management-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }
  .cloud-management-icon-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    min-width: 36px;
    height: 36px;
    margin: 0;
    padding: 0;
  }
  .cloud-management-icon-action svg {
    display: block;
    flex: none;
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .cloud-management-rename-form {
    display: block;
    width: 100%;
    height: 24px;
    margin: 0;
  }
  .cloud-management-rename-form input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 100%;
    margin: 0;
    padding: 2px 5px;
    display: block;
    font: inherit;
  }
  :global(.dark) .cloud-management-projects li {
    border-color: #55555c;
  }
  :global(.dark) .cloud-management-project-summary span {
    color: #bdbdc4;
  }
  @media (max-width: 600px) {
    .cloud-management-projects li {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .cloud-management-actions {
      grid-column: 2;
      justify-content: flex-start;
    }
  }
</style>
