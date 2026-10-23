<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import { containClicks } from "../uiActions";
  import type { CloudWorkspace } from "../workspace/CloudWorkspace.svelte";
  import CloudProjectManagement from "./CloudProjectManagement.svelte";
  const language = useLanguage();
  const t = $derived($language.t);
  let { cloud }: { cloud: CloudWorkspace } = $props();
  let register = $state(false);
  let username = $state("");
  let password = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let confirmNewPassword = $state("");
  let showPasswords = $state(false);
  let passwordOpen = $state(false);
  let newUsername = $state("");
  let usernameOpen = $state(false);
  let deleteAccountOpen = $state(false);
  let deleteAccountPassword = $state("");
  let acknowledgedUniquePassword = $state(false);
  let acknowledgedAccessLoss = $state(false);
  const registrationPasswordMismatch = $derived(
    register && confirmPassword.length > 0 && password !== confirmPassword,
  );
  const registrationPasswordTooShort = $derived(
    register && password.length < 10,
  );
  const changedPasswordMismatch = $derived(
    confirmNewPassword.length > 0 && newPassword !== confirmNewPassword,
  );
  const usernameValidationIssues = $derived.by(() => {
    if (!register) return [];
    const issues: string[] = [];
    if (username.length < 3) issues.push(t("ui.cloud.usernameTooShort"));
    if (username.length > 32) issues.push(t("ui.cloud.usernameTooLong"));
    const invalidCharacter = Array.from(username).find(
      (character) => !/[A-Za-z0-9._-]/.test(character),
    );
    if (invalidCharacter) {
      issues.push(t("ui.cloud.usernameInvalidCharacter", [invalidCharacter]));
    }
    return issues;
  });
  async function authenticate() {
    await cloud.authenticate(register, username, password);
    password = "";
    confirmPassword = "";
    showPasswords = false;
  }
</script>

{#if cloud.open}
  <div class="modal topmost-modal account-modal" role="presentation">
    <div
      class="dialog cloud-dialog"
      role="dialog"
      aria-modal="true"
      aria-busy={cloud.busy}
      aria-labelledby="cloud-title"
      tabindex="-1"
      use:containClicks
    >
      <h3 id="cloud-title">{t("ui.cloud.title")}</h3>
      {#if cloud.error && !passwordOpen && !usernameOpen && !deleteAccountOpen}<p class="dialog-error" role="alert">
          {cloud.error}
        </p>{/if}
      {#if cloud.notice}<p role="status">{cloud.notice}</p>{/if}
      {#if cloud.user}
        <section class="cloud-account-section" aria-label={t("ui.cloud.title")}>
          <div class="cloud-account-heading">
            <p>{t("ui.cloud.signedIn", [cloud.user.username])}</p>
            <div class="cloud-account-actions">
              <button
                disabled={cloud.busy}
                onclick={() => {
                  usernameOpen = true;
                  password = "";
                  newUsername = cloud.user?.username ?? "";
                }}>{t("ui.cloud.changeUsername")}</button
              >
              <button
                disabled={cloud.busy}
                onclick={() => {
                  passwordOpen = true;
                  password = "";
                  newPassword = "";
                  confirmNewPassword = "";
                  showPasswords = false;
                }}>{t("ui.cloud.changePassword")}</button
              >
              <button
                class="cloud-logout-button"
                disabled={cloud.busy}
                onclick={async () => {
                  await cloud.logout();
                  if (!cloud.user) {
                    register = false;
                    password = "";
                    newPassword = "";
                    confirmPassword = "";
                    confirmNewPassword = "";
                    showPasswords = false;
                    passwordOpen = false;
                  }
                }}>{t("ui.cloud.logout")}</button
              >
              <button
                class="cloud-delete-account-button"
                disabled={cloud.busy}
                onclick={() => {
                  deleteAccountPassword = "";
                  deleteAccountOpen = true;
                }}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M10 11v7m4-7v7M6 7l1 14h10l1-14M9 7V4h6v3" />
                </svg>
                {t("ui.cloud.deleteAccount")}
              </button
              >
            </div>
          </div>
        </section>
        <section class="cloud-project-management-section" aria-labelledby="cloud-project-management-title">
          <h4 id="cloud-project-management-title">{t("ui.cloud.projectManagement")}</h4>
          <CloudProjectManagement {cloud} />
        </section>
        {#if passwordOpen}
          <div class="modal topmost-modal account-password-modal" role="presentation">
            <div
              class="dialog cloud-password-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cloud-password-title"
              tabindex="-1"
              use:containClicks
            >
              <h3 id="cloud-password-title">{t("ui.cloud.changePassword")}</h3>
              {#if cloud.error}<p class="dialog-error" role="alert">{cloud.error}</p>{/if}
              <form
                onsubmit={async (event) => {
                  event.preventDefault();
                  if (newPassword !== confirmNewPassword) return;
                  const changed = await cloud.changePassword(password, newPassword);
                  password = "";
                  newPassword = "";
                  confirmNewPassword = "";
                  showPasswords = false;
                  if (changed) passwordOpen = false;
                }}
              >
                <label
                  >{t("ui.cloud.currentPassword")}<input
                    type={showPasswords ? "text" : "password"}
                    name="current-password"
                    autocomplete="current-password"
                    bind:value={password}
                    required
                    maxlength="128"
                  /></label
                >
                <label
                  >{t("ui.cloud.newPassword")}<input
                    type={showPasswords ? "text" : "password"}
                    name="new-password"
                    autocomplete="new-password"
                    bind:value={newPassword}
                    required
                    minlength="10"
                    maxlength="128"
                  /></label
                >
                <label
                  >{t("ui.cloud.confirmPassword")}<input
                    type={showPasswords ? "text" : "password"}
                    name="confirm-new-password"
                    autocomplete="new-password"
                    bind:value={confirmNewPassword}
                    required
                    minlength="10"
                    maxlength="128"
                  /></label
                >
                {#if changedPasswordMismatch}<p class="dialog-error" role="alert">
                    {t("ui.cloud.passwordMismatch")}
                  </p>{/if}
                <button
                  type="button"
                  class="cloud-password-toggle"
                  aria-pressed={showPasswords}
                  onclick={() => (showPasswords = !showPasswords)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {#if showPasswords}<path d="m3 3 18 18" />{/if}
                  </svg>
                  {t(showPasswords ? "ui.cloud.hidePasswords" : "ui.cloud.showPasswords")}
                </button>
                <div class="dialog-actions">
                  <button type="button" disabled={cloud.busy} onclick={() => {
                    passwordOpen = false;
                    password = "";
                    newPassword = "";
                    confirmNewPassword = "";
                    showPasswords = false;
                  }}>{t("ui.common.cancel")}</button>
                  <button type="submit" disabled={cloud.busy}>{t("ui.cloud.changePassword")}</button>
                </div>
              </form>
            </div>
          </div>
        {/if}
        {#if usernameOpen}
          <div class="modal topmost-modal account-password-modal" role="presentation">
            <div
              class="dialog cloud-password-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cloud-username-title"
              tabindex="-1"
              use:containClicks
            >
              <h3 id="cloud-username-title">{t("ui.cloud.changeUsername")}</h3>
              {#if cloud.error}<p class="dialog-error" role="alert">{cloud.error}</p>{/if}
              <form
                onsubmit={async (event) => {
                  event.preventDefault();
                  const changed = await cloud.changeUsername(password, newUsername);
                  password = "";
                  if (changed) usernameOpen = false;
                }}
              >
                <label
                  >{t("ui.cloud.newUsername")}<input
                    name="username"
                    autocomplete="username"
                    autocapitalize="none"
                    spellcheck="false"
                    bind:value={newUsername}
                    required
                    minlength="3"
                    maxlength="32"
                    pattern="[A-Za-z0-9._-]+"
                  /></label
                >
                <label
                  >{t("ui.cloud.currentPassword")}<input
                    type="password"
                    name="current-password"
                    autocomplete="current-password"
                    bind:value={password}
                    required
                    maxlength="128"
                  /></label
                >
                <div class="dialog-actions">
                  <button type="button" disabled={cloud.busy} onclick={() => (usernameOpen = false)}>{t("ui.common.cancel")}</button>
                  <button type="submit" disabled={cloud.busy}>{t("ui.cloud.changeUsername")}</button>
                </div>
              </form>
            </div>
          </div>
        {/if}
        {#if deleteAccountOpen}
          <div class="modal topmost-modal account-password-modal" role="presentation">
            <div
              class="dialog cloud-password-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cloud-delete-account-title"
              tabindex="-1"
              use:containClicks
            >
              <h3 id="cloud-delete-account-title">{t("ui.cloud.deleteAccount")}</h3>
              <p class="cloud-delete-account-warning" role="alert">
                {t("ui.cloud.deleteAccountWarning")}
              </p>
              {#if cloud.error}<p class="dialog-error" role="alert">{cloud.error}</p>{/if}
              <form
                onsubmit={async (event) => {
                  event.preventDefault();
                  const deleted = await cloud.deleteAccount(deleteAccountPassword);
                  deleteAccountPassword = "";
                  if (deleted) deleteAccountOpen = false;
                }}
              >
                <label
                  >{t("ui.cloud.currentPassword")}<input
                    type="password"
                    name="delete-account-current-password"
                    autocomplete="current-password"
                    bind:value={deleteAccountPassword}
                    required
                    maxlength="128"
                  /></label
                >
                <div class="dialog-actions">
                  <button type="button" disabled={cloud.busy} onclick={() => {
                    deleteAccountOpen = false;
                    deleteAccountPassword = "";
                  }}>{t("ui.common.cancel")}</button>
                  <button type="submit" class="cloud-delete-account-button" disabled={cloud.busy}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16M10 11v7m4-7v7M6 7l1 14h10l1-14M9 7V4h6v3" />
                    </svg>
                    {t("ui.cloud.deleteAccountConfirm")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        {/if}
      {:else}
        <div class="cloud-actions">
          <button
            class="cloud-mode-button"
            disabled={cloud.busy}
            aria-pressed={!register}
            onclick={() => {
              register = false;
              password = "";
              confirmPassword = "";
              showPasswords = false;
              acknowledgedUniquePassword = false;
              acknowledgedAccessLoss = false;
            }}>{t("ui.cloud.login")}</button
          >
          <button
            class="cloud-mode-button"
            disabled={cloud.busy}
            aria-pressed={register}
            onclick={() => {
              register = true;
              password = "";
              confirmPassword = "";
              showPasswords = false;
              acknowledgedUniquePassword = false;
              acknowledgedAccessLoss = false;
            }}>{t("ui.cloud.register")}</button
          >
        </div>
        {#if register}
          <div class="dialog-warning storage-warning" role="note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 2.8 20h18.4L12 3Z" />
              <path d="M12 9v5m0 3h.01" />
            </svg>
            <span>{t("ui.cloud.storageAdvice")}</span>
          </div>{/if}
        <form
          onsubmit={(event) => {
            event.preventDefault();
            if (register && password !== confirmPassword) return;
            void authenticate();
          }}
        >
          <label class="cloud-username-field">
            <span class="cloud-username-label-line">
              <span>{t("ui.cloud.username")}</span>
              {#if register && usernameValidationIssues.length > 0}
                <span class="cloud-validation-hint" aria-live="polite">
                  {usernameValidationIssues.join(" · ")}
                </span>
              {/if}
            </span>
            <input
              name="username"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              bind:value={username}
              required
              minlength={register ? 3 : undefined}
              maxlength={register ? 32 : undefined}
              pattern={register ? "[A-Za-z0-9._-]+" : undefined}
            />
          </label>
          <label>
            <span class="cloud-field-label-line">
              <span>{t("ui.cloud.password")}</span>
              {#if registrationPasswordTooShort}
                <span class="cloud-password-length-hint" aria-live="polite">
                  {t("ui.cloud.passwordLengthHint")}
                </span>
              {/if}
            </span>
            <input
              type={showPasswords ? "text" : "password"}
              name="password"
              autocomplete={register ? "new-password" : "current-password"}
              bind:value={password}
              required
              minlength={register ? 10 : undefined}
              maxlength={register ? 128 : undefined}
            />
          </label>
          {#if register}<label
              >{t("ui.cloud.confirmPassword")}<input
                type={showPasswords ? "text" : "password"}
                name="confirm-password"
                autocomplete="new-password"
                bind:value={confirmPassword}
                required
                minlength="10"
                maxlength="128"
              /></label
            >
            {#if registrationPasswordMismatch}<p class="dialog-error" role="alert">
                {t("ui.cloud.passwordMismatch")}
              </p>{/if}
          {/if}
          <button
            type="button"
            class="cloud-password-toggle"
            aria-pressed={showPasswords}
            onclick={() => (showPasswords = !showPasswords)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {#if showPasswords}<path d="m3 3 18 18" />{/if}
            </svg>
            {t(showPasswords ? "ui.cloud.hidePasswords" : "ui.cloud.showPasswords")}
          </button>
          {#if register}<label class="cloud-ack">
              <input type="checkbox" bind:checked={acknowledgedUniquePassword} required />
              <span>{t("ui.cloud.acknowledgeUniquePassword")}</span>
            </label>
            <label class="cloud-ack">
              <input type="checkbox" bind:checked={acknowledgedAccessLoss} required />
              <span>{t("ui.cloud.acknowledgeAccessLoss")}</span>
            </label>{/if}
          <button
            disabled={cloud.busy || (register && (!acknowledgedUniquePassword || !acknowledgedAccessLoss))}
            >{t(register ? "ui.cloud.register" : "ui.cloud.login")}</button
          >
        </form>
      {/if}
      <div class="dialog-actions">
        <button
          onclick={() => {
            cloud.open = false;
            password = "";
            newPassword = "";
            confirmPassword = "";
            confirmNewPassword = "";
            showPasswords = false;
            passwordOpen = false;
            usernameOpen = false;
          }}>{t("ui.common.close")}</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .account-modal {
    z-index: 160;
  }
  .cloud-dialog {
    display: flex;
    flex-direction: column;
    width: min(1000px, 96vw);
    max-height: 92vh;
    overflow: auto;
  }
  .cloud-account-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .cloud-account-heading p {
    margin: 0;
  }
  .cloud-account-section {
    background: #f7f7f7;
    border: 1px solid #ccc;
    border-radius: 6px;
    margin-bottom: 16px;
    padding: 12px 14px;
  }
  .cloud-project-management-section {
    padding-top: 12px;
  }
  .cloud-project-management-section h4 {
    color: #555;
    border-bottom: 1px solid #ddd;
    margin: 0 0 10px;
    padding-bottom: 6px;
    font-size: 14px;
    font-weight: 600;
  }
  .cloud-account-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .cloud-logout-button {
    padding: 6px 9px;
    font-size: 12px;
  }
  .cloud-delete-account-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: #8c1616;
    background: #fff5f5;
    border: 1px solid #e8c4c4;
    border-radius: 6px;
    box-shadow: none;
  }
  .cloud-delete-account-button:hover:not(:disabled) {
    background: #ffeaea;
    border-color: #d7a4a4;
  }
  .cloud-delete-account-button svg {
    flex: 0 0 16px;
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .cloud-delete-account-warning {
    padding: 10px 12px;
    border: 1px solid #d99;
    border-radius: 4px;
    background: #fff0f0;
    color: #8c1616;
  }
  .account-password-modal {
    z-index: 170;
  }
  .cloud-password-dialog {
    width: min(460px, 92vw);
  }
  .cloud-password-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: #087ff5;
    cursor: pointer;
    font: inherit;
  }
  .cloud-password-toggle svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
  }
  .cloud-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cloud-mode-button[aria-pressed="true"] {
    color: #fff;
    background: #087ff5;
    border-color: #087ff5;
  }
  .cloud-field-label-line,
  .cloud-username-label-line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px 12px;
  }
  .cloud-validation-hint,
  .cloud-password-length-hint {
    color: #b42318;
    font-size: 0.9em;
    font-weight: 600;
    margin-left: auto;
    text-align: right;
  }
  form {
    display: grid;
    gap: 12px;
    margin: 16px 0;
  }
  label {
    display: grid;
    gap: 5px;
  }
  input {
    font: inherit;
    padding: 6px;
  }
  .cloud-ack {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .cloud-ack input {
    flex: 0 0 auto;
    width: auto;
    margin: 2px 0 0;
    padding: 0;
  }
  @media (max-width: 600px) {
    .cloud-account-heading {
      align-items: flex-start;
      flex-direction: column;
    }
  }
  :global(.dark) .cloud-account-section {
    background: #29292c;
    border-color: #555;
  }
  :global(.dark) .cloud-project-management-section h4 {
    border-color: #555;
  }
  :global(.dark) .cloud-project-management-section h4 {
    color: #bbb;
  }
  :global(.dark) .cloud-delete-account-button {
    color: #ffd0d0;
    background: #3a2020;
    border-color: #805050;
  }
  :global(.dark) .cloud-delete-account-button:hover:not(:disabled) {
    background: #482525;
    border-color: #a06b6b;
  }
  :global(.dark) .cloud-delete-account-warning {
    background: #3a2020;
    color: #ffd0d0;
    border-color: #9b5b5b;
  }
</style>
