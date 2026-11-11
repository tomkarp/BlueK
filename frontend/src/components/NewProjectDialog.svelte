<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  interface Props {
    newProjectOpen: boolean;
    projectInfo: "template" | "example" | null;
    chooseTemplate: (choice: string) => Promise<void>;
  }

  let {
    newProjectOpen = $bindable(),
    projectInfo = $bindable(),
    chooseTemplate,
  }: Props = $props();
  function stopPropagation(handler: () => unknown) {
    return (event: Event) => {
      event.stopPropagation();
      return handler();
    };
  }
</script>

{#if newProjectOpen}<div class="modal topmost-modal">
    <div
      class="dialog new-project-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="new-project-title"
    >
      <h3 id="new-project-title">{t("ui.projects.createNewProject")}</h3>
      <div class="project-choice-list">
        <div class="project-choice-row">
          <button onclick={() => chooseTemplate("empty")}
            ><strong>{t("ui.projects.emptyProject")}</strong><span
              >{t("ui.projects.startWithABlankBlueKProject")}</span
            ></button
          >
        </div>
        <div class="project-choice-with-info">
          <button onclick={() => chooseTemplate("empty-blueplay")}
            ><strong>{t("ui.projects.bluePlayTemplate")}</strong><span
              >{t("ui.projects.startWithTheBuiltInWorldActorAnd")}</span
            ></button
          ><button
            class="project-info-button"
            onclick={stopPropagation(() => (projectInfo = "template"))}
            aria-label={t("ui.projects.whatIsBluePlay")}>?</button
          >
        </div>
        <div class="project-choice-with-info">
          <button onclick={() => chooseTemplate("blueplay")}
            ><strong>{t("ui.projects.bluePlayExample")}</strong><span
              >{t("ui.projects.openASmallRunnableWorldAndActorProject")}</span
            ></button
          ><button
            class="project-info-button"
            onclick={stopPropagation(() => (projectInfo = "example"))}
            aria-label={t("ui.projects.whatIsBluePlay")}>?</button
          >
        </div>
      </div>
      <div class="dialog-actions">
        <button
          onclick={() => {
            newProjectOpen = false;
            projectInfo = null;
          }}>{t("ui.common.cancel")}</button
        >
      </div>
      {#if projectInfo}<div
          class="project-info-panel"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
        >
          <button
            class="project-info-close"
            onclick={() => (projectInfo = null)}
            aria-label={t("ui.projects.closeBluePlayInformation")}>×</button
          >
          <h4>{t("ui.projects.whatIsBluePlay")}</h4>
          <p>
            {t("ui.projects.bluePlayIsALightweightKotlinLibraryForCreating")}
          </p>
          <p>
            {projectInfo === "template"
              ? t("ui.projects.theTemplateProvidesAnEmptyStartingPoint")
              : t("ui.projects.theExampleDemonstratesASmallWorldAndActor")}
          </p>
          <a
            href="https://github.com/tomkarp/BlueK/blob/main/docs/blueplay.md"
            target="_blank"
            rel="noreferrer">{t("ui.projects.readTheBluePlayDocumentation")}</a
          >
        </div>{/if}
    </div>
  </div>{/if}
