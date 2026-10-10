<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import { containClicks, focusOnMount } from "../uiActions";
  import type { FeedbackWorkspace } from "../workspace/FeedbackWorkspace.svelte";
  const language = useLanguage();
  const { t } = language;
  let { feedback }: { feedback: FeedbackWorkspace } = $props();
  let privacyPinned = $state(false);
  let privacyHovered = $state(false);
  let privacyFocused = $state(false);
  const privacyVisible = $derived(
    privacyPinned || privacyHovered || privacyFocused,
  );
  $effect(() => {
    if (!feedback.open) {
      privacyPinned = false;
      privacyHovered = false;
      privacyFocused = false;
    }
  });
  const errorText = $derived(
    feedback.error ? t(`ui.feedback.errors.${feedback.error}`) : "",
  );
</script>

{#if feedback.open}
  <div class="modal topmost-modal feedback-modal" role="presentation">
    <div
      class="dialog feedback-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      tabindex="-1"
      use:containClicks
      use:focusOnMount
    >
      <header>
        <h3 id="feedback-title">{t("ui.feedback.title")}</h3>
        <div
          class="feedback-privacy"
          role="presentation"
          onpointerenter={() => (privacyHovered = true)}
          onpointerleave={() => (privacyHovered = false)}
          onfocusin={() => (privacyFocused = true)}
          onfocusout={() => (privacyFocused = false)}
        >
          <button
            type="button"
            class="feedback-privacy-button"
            aria-label={t("ui.feedback.privacyLabel")}
            aria-expanded={privacyVisible}
            aria-controls="feedback-privacy-note"
            onclick={() => {
              privacyPinned = !privacyPinned;
              if (!privacyPinned) {
                privacyHovered = false;
                privacyFocused = false;
              }
            }}
          >ⓘ</button>
          <div
            id="feedback-privacy-note"
            class="feedback-privacy-note"
            role="note"
            hidden={!privacyVisible}
          >
            <strong>{t("ui.feedback.privacyLabel")}</strong>
            <p>{t("ui.feedback.privacyData")}</p>
            <p>{t("ui.feedback.privacyProject")}</p>
            <p>{t("ui.feedback.privacyStorage")}</p>
            <p>{t("ui.feedback.privacyRetention")}</p>
          </div>
        </div>
      </header>
      {#if feedback.receipt}
        <div class="feedback-content" role="status">
          <h4>{t("ui.feedback.thanks")}</h4>
          <p>
            {feedback.receipt.issueNumber
              ? t("ui.feedback.sent", [feedback.receipt.issueNumber])
              : t("ui.feedback.queued", [feedback.receipt.reference])}
          </p>
          <p class="feedback-hint">{t("ui.feedback.privateReceipt")}</p>
        </div>
        <footer class="dialog-actions">
          <button onclick={feedback.close}>{t("ui.common.close")}</button>
        </footer>
      {:else}
        <form
          onsubmit={(event) => {
            event.preventDefault();
            void feedback.send();
          }}
        >
          <div class="feedback-content">
            <p class="feedback-intro">{t("ui.feedback.intro")}</p>
            <fieldset disabled={feedback.sending}>
              <div class="feedback-fields">
                <label
                  >{t("ui.feedback.category")}
                  <select bind:value={feedback.category}>
                    <option value="bug">{t("ui.feedback.bug")}</option>
                    <option value="kotlin-support"
                      >{t("ui.feedback.kotlinSupport")}</option
                    >
                  </select>
                </label>
                <label
                  >{t("ui.feedback.summary")}
                  <input
                    type="text"
                    bind:value={feedback.summary}
                    maxlength="160"
                    required
                  />
                </label>
              </div>
              <label
                >{t("ui.feedback.description")}
                <textarea
                  bind:value={feedback.description}
                  maxlength="10000"
                  rows="4"
                  required
                  placeholder={t("ui.feedback.descriptionHint")}
                ></textarea>
              </label>
              <label
                >{t("ui.feedback.expected")}
                <textarea
                  bind:value={feedback.expected}
                  maxlength="4000"
                  rows="2"
                ></textarea>
              </label>
              <label
                >{t("ui.feedback.contact")}
                <input
                  type="email"
                  bind:value={feedback.contact}
                  maxlength="254"
                />
              </label>
              <div class="feedback-attachments">
                <label class="feedback-project-toggle">
                  <input
                    type="checkbox"
                    bind:checked={feedback.includeProject}
                  />
                  <span>{t("ui.feedback.includeProject")}</span>
                </label>
                <p class="feedback-hint">{t("ui.feedback.projectHint")}</p>
              </div>
              <details class="feedback-details">
                <summary
                  >{t("ui.feedback.details", [feedback.build.version])}</summary
                >
                <p class="feedback-hint">{t("ui.feedback.detailsHint")}</p>
                <pre>{feedback.preview}</pre>
              </details>
            </fieldset>
            {#if feedback.checking}<p class="feedback-hint" role="status">
                {t("ui.feedback.checking")}
              </p>
            {:else if !feedback.available}
              <p class="feedback-notice" role="status">
                {t("ui.feedback.unavailable")}
              </p>
            {/if}
            {#if feedback.tooLarge}<p class="dialog-error" role="alert">
                {t("ui.feedback.errors.too-large")}
              </p>{/if}
            {#if errorText}<p class="dialog-error" role="alert">
                {errorText}
              </p>{/if}
          </div>
          <footer class="dialog-actions">
            <button
              type="button"
              onclick={feedback.close}
              disabled={feedback.sending}>{t("ui.common.cancel")}</button
            >
            <button
              type="submit"
              class="feedback-send"
              disabled={!feedback.valid ||
                feedback.sending ||
                feedback.tooLarge}
            >
              {feedback.sending
                ? t("ui.feedback.sending")
                : t("ui.feedback.send")}
            </button>
          </footer>
        </form>
      {/if}
    </div>
  </div>
{/if}
