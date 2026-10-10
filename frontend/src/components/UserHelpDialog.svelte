<script lang="ts">
  import TranslatedText from "./TranslatedText.svelte";
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  $: t = $language.t;
  import { containClicks, focusOnMount } from "../uiActions";
  export let close: () => void;
  export let openFeedback: () => void;
  const sections = [
    ["start", "Quick start"],
    ["objects", "Objects & codepad"],
    ["projects", "Projects & saving"],
    ["state", "Saved state"],
    ["tests", "Testing"],
    ["kotlin", "Kotlin compatibility"],
    ["blueplay", "BluePlay"],
    ["shortcuts", "Keyboard shortcuts"],
    ["troubleshooting", "Troubleshooting"],
  ] as const;
  let selected: (typeof sections)[number][0] = "start";
  let content: HTMLElement;
  function select(id: typeof selected) {
    selected = id;
    if (content) content.scrollTop = 0;
  }
</script>

<div class="modal topmost-modal" role="presentation">
  <div
    class="dialog user-help-dialog"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    aria-labelledby="user-help-title"
    use:containClicks
    use:focusOnMount
  >
    <header>
      <h3 id="user-help-title">{t("help.navigation.blueKHelp")}</h3>
    </header>
    <div class="user-help-layout">
      <nav aria-label={t("help.navigation.helpSections")}>
        {#each sections as [id, title]}
          <button
            aria-current={selected === id ? "page" : undefined}
            on:click={() => select(id)}>{$language.message(title)}</button
          >
        {/each}
      </nav>
      <!-- The scrollable reading area needs keyboard focus for Page Up/Down. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <article
        bind:this={content}
        tabindex="0"
        aria-label={$language.message(
          sections.find(([id]) => id === selected)?.[1] || "",
        )}
      >
        {#if selected === "start"}
          <h4>{t("help.navigation.quickStart")}</h4>
          <p><TranslatedText message="help.start.introduction" /></p>
          <ol>
            <li><TranslatedText message="help.start.createProject" /></li>
            <li><TranslatedText message="help.start.createFile" /></li>
            <li><TranslatedText message="help.start.compile" /></li>
            <li><TranslatedText message="help.start.run" /></li>
            <li><TranslatedText message="help.start.export" /></li>
          </ol>
          <h5>{t("help.start.aFirstClass")}</h5>
          <pre><code
              >{`class Counter {
    var value = 0
    fun increment() { value++ }
}`}</code
            ></pre>
          <p><TranslatedText message="help.start.firstObject" /></p>
          <h5>{t("help.start.workspaceReference")}</h5>
          <ul>
            <li><TranslatedText message="help.start.diagram" /></li>
            <li><TranslatedText message="help.start.objectBench" /></li>
            <li><TranslatedText message="help.start.codepad" /></li>
            <li><TranslatedText message="help.start.terminal" /></li>
            <li><TranslatedText message="help.start.viewIcons" /></li>
            <li><TranslatedText message="help.start.utilities" /></li>
          </ul>
          <h5>{t("help.start.editingTitle")}</h5>
          <p><TranslatedText message="help.start.editing" /></p>
          <h5>{t("help.start.runningACompleteProgram")}</h5>
          <p><TranslatedText message="help.start.main" /></p>
          <p><TranslatedText message="help.start.freshSession" /></p>
        {:else if selected === "objects"}
          <h4>{t("help.navigation.objectsCodepad")}</h4>
          <h5>{t("help.objects.creatingAndUsingObjects")}</h5>
          <p>
            {t("help.objects.constructorsAndMethods")}
          </p>
          <p><TranslatedText message="help.objects.returnedValues" /></p>
          <h5>{t("help.objects.inspectingAndEditing")}</h5>
          <p>
            {t("help.objects.inspection")}
          </p>
          <p>
            {t("help.objects.inspectionEffects")}
          </p>
          <h5>{t("help.objects.codepad")}</h5>
          <pre><code
              >{`val counter = Counter()
counter.increment()
counter.value`}</code
            ></pre>
          <p>
            {t("help.objects.codepadExecution")}
          </p>
          <h5>{t("help.objects.inputAndOutput")}</h5>
          <p><TranslatedText message="help.objects.inputOutput" /></p>
        {:else if selected === "projects"}
          <h4>{t("help.navigation.projectsSaving")}</h4>
          <h5>{t("help.projects.browserDrafts")}</h5>
          <p>
            {t("help.projects.autosave")}
          </p>
          <p><TranslatedText message="help.projects.recentWork" /></p>
          <p>
            {t("help.projects.retention")}
          </p>
          <h5>{t("help.projects.importAndExportReference")}</h5>
          <dl>
            <dt>{t("ui.common.openImport")}</dt>
            <dd>
              {t("help.projects.import")}
            </dd>
            <dt>{t("ui.common.exportProjectJSON")}</dt>
            <dd>
              {t("help.projects.jsonExport")}
            </dd>
            <dt>{t("ui.common.copyFullProjectLink")}</dt>
            <dd>
              {t("help.projects.fullLink")}
            </dd>
            <dt>{t("ui.common.copyShortLink")}</dt>
            <dd>
              {t("help.projects.shortLink")}
            </dd>
            <dt>{t("ui.common.exportAsHTMLBeta")}</dt>
            <dd>
              {t("help.projects.htmlExport")}
            </dd>
            <dt>{t("help.projects.exportBlueJProject")}</dt>
            <dd>{t("help.projects.notImplementedYet")}</dd>
          </dl>
          <p><TranslatedText message="help.projects.linkOptions" /></p>
          <p>
            {t("help.projects.linkReload")}
          </p>
          <h5>{t("help.projects.readmeAndResources")}</h5>
          <p>
            {t("help.projects.resources")}
          </p>
          <h5>{t("help.projects.offlineVersion")}</h5>
          <p><TranslatedText message="help.projects.offline" /></p>
          <p>
            {t("help.projects.offlineCaution")}
          </p>
        {:else if selected === "state"}
          <h4>{t("help.navigation.savedState")}</h4>
          <p>
            {t("help.state.introduction")}
          </p>
          <ol>
            <li>
              {t("help.state.prepare")}
            </li>
            <li><TranslatedText message="help.state.save" /></li>
            <li><TranslatedText message="help.state.review" /></li>
            <li><TranslatedText message="help.state.load" /></li>
          </ol>
          <h5>{t("help.state.buttonsTitle")}</h5>
          <dl>
            <dt>{t("ui.common.saveState")}</dt>
            <dd>
              {t("help.state.saveButton")}
            </dd>
            <dt>{t("ui.common.loadState")}</dt>
            <dd>{t("help.state.loadButton")}</dd>
            <dt>{t("ui.common.chooseDefaultTestClass")}</dt>
            <dd>
              {t("help.state.classButton")}
            </dd>
          </dl>
          <p>
            {t("help.state.defaultClass")}
          </p>
          <h5>{t("help.state.whatGetsSaved")}</h5>
          <p><TranslatedText message="help.state.recordedActions" /></p>
          <p><TranslatedText message="help.state.replacement" /></p>
          <h5>{t("help.state.limits")}</h5>
          <p>
            {t("help.state.replayLimits")}
          </p>
          <p>
            {t("help.state.failedActions")}
          </p>
        {:else if selected === "tests"}
          <h4>{t("help.navigation.testing")}</h4>
          <p><TranslatedText message="help.tests.introduction" /></p>
          <h5>{t("help.tests.createRunAndInspect")}</h5>
          <p><TranslatedText message="help.tests.createClasses" /></p>
          <p><TranslatedText message="help.tests.run" /></p>
          <pre><code
              >{`import kotlin.test.*

class CounterTest {
    val counter = Counter()

    @Test
    fun incrementChangesValue() {
        counter.increment()
        assertEquals(1, counter.value)
    }
}`}</code
            ></pre>
          <h5>{t("help.tests.annotations")}</h5>
          <dl>
            <dt>@Test</dt>
            <dd>
              {t("help.tests.testAnnotation")}
            </dd>
            <dt>@BeforeTest</dt>
            <dd>
              {t("help.tests.beforeAnnotation")}
            </dd>
            <dt>@AfterTest</dt>
            <dd>
              {t("help.tests.afterAnnotation")}
            </dd>
            <dt>@Ignore</dt>
            <dd>{t("help.tests.ignoreAnnotation")}</dd>
          </dl>
          <p>
            {t("help.tests.limits")}
          </p>
          <h5>{t("help.tests.assertionsTitle")}</h5>
          <p><TranslatedText message="help.tests.assertions" /></p>
          <h5>{t("help.tests.recordATest")}</h5>
          <ol>
            <li><TranslatedText message="help.tests.recordStart" /></li>
            <li><TranslatedText message="help.tests.recordActions" /></li>
            <li><TranslatedText message="help.tests.recordFinish" /></li>
          </ol>
          <p><TranslatedText message="help.tests.recordCancel" /></p>
        {:else if selected === "kotlin"}
          <h4>{t("help.navigation.kotlinCompatibility")}</h4>
          <p>
            {t("help.kotlin.introduction")}
          </p>
          <h5>{t("help.kotlin.importantBoundaries")}</h5>
          <ul>
            <li>
              {t("help.kotlin.files")}
            </li>
            <li><TranslatedText message="help.kotlin.imports" /></li>
            <li>
              {t("help.kotlin.unsupportedDeclarations")}
            </li>
            <li><TranslatedText message="help.kotlin.constructors" /></li>
            <li>
              {t("help.kotlin.typeInference")}
            </li>
            <li>
              {t("help.kotlin.initialization")}
            </li>
          </ul>
          <p><TranslatedText message="help.kotlin.references" /></p>
        {:else if selected === "blueplay"}
          <h4>BluePlay</h4>
          <p><TranslatedText message="help.blueplay.introduction" /></p>
          <pre><code
              >{`class MyWorld : World(600, 400, 1)

fun main() {
    val world = MyWorld()
    world.show()
}`}</code
            ></pre>
          <h5>{t("help.blueplay.execution")}</h5>
          <p><TranslatedText message="help.blueplay.controls" /></p>
          <p><TranslatedText message="help.blueplay.reset" /></p>
          <h5>{t("help.blueplay.apiOverview")}</h5>
          <dl>
            <dt>World</dt>
            <dd>
              {t("help.blueplay.worldApi")}
            </dd>
            <dt>Actor</dt>
            <dd>
              {t("help.blueplay.actorApi")}
            </dd>
            <dt>Image</dt>
            <dd>
              {t("help.blueplay.imageApi")}
            </dd>
            <dt>{t("help.blueplay.functions")}</dt>
            <dd>
              isKeyDown, playSound, start, stop, step, getSpeed and setSpeed.
            </dd>
          </dl>
          <p><TranslatedText message="help.blueplay.properties" /></p>
          <h5>{t("help.blueplay.resourcesAndBoundaries")}</h5>
          <p>
            {t("help.blueplay.resources")}
          </p>
          <p>
            {t("help.blueplay.limits")}
          </p>
        {:else if selected === "shortcuts"}
          <h4>{t("help.navigation.keyboardShortcuts")}</h4>
          <p>
            {t("help.shortcuts.introduction")}
          </p>
          <slot name="shortcuts" />
        {:else}
          <h4>{t("help.navigation.troubleshooting")}</h4>
          <dl>
            <dt>{t("help.troubleshooting.startMainIsDisabled")}</dt>
            <dd>
              {t("help.troubleshooting.main")}
            </dd>
            <dt>{t("help.troubleshooting.objectsDisappeared")}</dt>
            <dd>
              {t("help.troubleshooting.sessionReset")}
            </dd>
            <dt>
              {t("help.troubleshooting.aProgramIsWaitingOrWillNotFinish")}
            </dt>
            <dd>
              {t("help.troubleshooting.stop")}
            </dd>
            <dt>
              {t("help.troubleshooting.aCallFailedAfterChangingAnObject")}
            </dt>
            <dd>
              {t("help.troubleshooting.failedCalls")}
            </dd>
            <dt>{t("help.troubleshooting.theInspectorShowsAnError")}</dt>
            <dd>
              {t("help.troubleshooting.getters")}
            </dd>
            <dt>{t("help.troubleshooting.aDraftIsMissing")}</dt>
            <dd>
              {t("help.troubleshooting.drafts")}
            </dd>
            <dt>{t("help.troubleshooting.theGeneratedStateCannotBeSaved")}</dt>
            <dd>
              {t("help.troubleshooting.stateSave")}
            </dd>
          </dl>
          <p><TranslatedText message="help.troubleshooting.reporting" /></p>
          <button on:click={openFeedback}>{t("ui.feedback.title")}</button>
        {/if}
      </article>
    </div>
    <div class="dialog-actions">
      <button on:click={close}>{t("ui.common.close")}</button>
    </div>
  </div>
</div>
