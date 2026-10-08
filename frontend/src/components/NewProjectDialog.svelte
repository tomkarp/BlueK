<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  export let newProjectOpen: boolean;
  export let projectInfo: "template" | "example" | null;
  export let chooseTemplate: (choice: string) => Promise<void>;
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
      <p>{t("ui.projects.chooseAStartingPoint")}</p>
      <div class="project-choice-list">
        <div class="project-choice-row">
          <button on:click={() => chooseTemplate("empty")}
            ><strong>{t("ui.projects.emptyProject")}</strong><span
              >{t("ui.projects.startWithABlankBlueKProject")}</span
            ></button
          >
        </div>
        <div class="project-choice-with-info">
          <button on:click={() => chooseTemplate("empty-blueplay")}
            ><strong>{t("ui.projects.bluePlayTemplate")}</strong><span
              >{t("ui.projects.startWithTheBuiltInWorldActorAnd")}</span
            ></button
          ><button
            class="project-info-button"
            on:click|stopPropagation={() => (projectInfo = "template")}
            aria-label={t("ui.projects.whatIsBluePlay")}>?</button
          >
        </div>
        <div class="project-choice-with-info">
          <button on:click={() => chooseTemplate("blueplay")}
            ><strong>{t("ui.projects.bluePlayExample")}</strong><span
              >{t("ui.projects.openASmallRunnableWorldAndActorProject")}</span
            ></button
          ><button
            class="project-info-button"
            on:click|stopPropagation={() => (projectInfo = "example")}
            aria-label={t("ui.projects.whatIsBluePlay")}>?</button
          >
        </div>
        <div class="project-choice-secondary">
          <p class="project-choice-note">
            {t("ui.projects.theFollowingExamplesCurrentlyExistToTestAnd")}
          </p>
          <div class="project-choice-row">
            <button on:click={() => chooseTemplate("bluek-demo")}
              ><strong>{t("ui.projects.blueKDemoProject")}</strong><span
                >{t(
                  "ui.projects.exploreClassesInheritanceAndObjectInteractionWithPerson",
                )}</span
              ></button
            >
          </div>
          <div class="project-choice-row">
            <button on:click={() => chooseTemplate("space-invaders")}
              ><strong>{t("ui.projects.spaceInvadersDemo")}</strong><span
                >{t(
                  "ui.projects.playASimplifiedBluePlayGameWithAMovable",
                )}</span
              ></button
            >
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button
          on:click={() => {
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
            on:click={() => (projectInfo = null)}
            aria-label={t("ui.projects.closeBluePlayInformation")}>×</button
          >
          <h4>{t("ui.projects.whatIsBluePlay")}</h4>
          <p>
            {t("ui.projects.bluePlayIsALightweightKotlinFrameworkForCreating")}
          </p>
          <p>
            {projectInfo === "template"
              ? t("ui.projects.theTemplateProvidesAnEmptyStartingPoint")
              : t("ui.projects.theExampleDemonstratesASmallWorldAndActor")}
          </p>
          <a
            href="https://github.com/tomkarp/BluePlay"
            target="_blank"
            rel="noreferrer">{t("ui.projects.viewBluePlayOnGitHub")}</a
          >
        </div>{/if}
    </div>
  </div>{/if}
