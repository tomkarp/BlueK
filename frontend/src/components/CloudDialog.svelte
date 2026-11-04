<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import { containClicks } from "../uiActions";
  import type { CloudWorkspace } from "../workspace/CloudWorkspace.svelte";
  import CloudProjectManagement from "./CloudProjectManagement.svelte";
  import AdminPanel from "./AdminPanel.svelte";
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
    if (await cloud.authenticate(register, username, password)) {
      password = "";
      confirmPassword = "";
      showPasswords = false;
    }
  }
</script>

{#if cloud.open && !cloud.adminOpen}
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
              {#if cloud.storage?.admin}
                <button disabled={cloud.busy} onclick={() => { cloud.adminOpen = true; }}>{t("ui.admin.title")}</button>
              {/if}
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
          {#if cloud.storage}
            <div class="cloud-storage-info">
              <p>{t("ui.cloud.storageUsage", [(cloud.storage.used / 1048576).toFixed(2), (cloud.storage.limit / 1048576).toFixed(0)])}</p>
              {#if cloud.storage.trusted}<p>{t("ui.cloud.trustedAccount")}</p>{/if}
            </div>
          {/if}
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
            type="submit"
            disabled={cloud.busy || (register && (!acknowledgedUniquePassword || !acknowledgedAccessLoss))}
            >{t(cloud.creatingAccount ? "ui.cloud.registrationCreating" : register ? "ui.cloud.register" : "ui.cloud.login")}</button
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
    {#if cloud.creatingAccount}
      <div class="cloud-registration-overlay">
        <div class="cloud-registration-progress" role="status" aria-live="polite">
          <svg class="cloud-construction" viewBox="0 0 320 180" aria-hidden="true">
            <rect x="12" y="8" width="296" height="150" rx="42" fill="#e7f4fb" />
            <circle cx="46" cy="42" r="4" fill="#b6d8e9" />
            <circle cx="275" cy="55" r="5" fill="#c0dfeb" />
            <path d="M42 72h16m-8-8v16m208-48v14m-7-7h14" stroke="#8bc4d9" stroke-width="2" stroke-linecap="round" />
            <ellipse cx="160" cy="155" rx="139" ry="12" fill="#cce6ed" />
            <!-- A large account card, being assembled by the two workers. -->
            <rect x="101" y="35" width="125" height="116" rx="13" fill="#b3d1df" />
            <rect x="96" y="30" width="125" height="116" rx="13" fill="#fff" stroke="#8bb8cd" stroke-width="3" />
            <rect x="111" y="43" width="36" height="36" rx="11" fill="#d9eff7" />
            <circle cx="129" cy="55" r="6" fill="#5a96b1" />
            <path d="M118 71c1-6 5-9 11-9s10 3 11 9" fill="#5a96b1" />
            <rect x="158" y="49" width="46" height="6" rx="3" fill="#6d9eb5" />
            <rect x="158" y="62" width="33" height="5" rx="2.5" fill="#bed8e4" />
            <rect x="112" y="92" width="92" height="6" rx="3" fill="#d9eaf0" />
            <rect x="112" y="105" width="65" height="6" rx="3" fill="#d9eaf0" />
            <rect x="112" y="120" width="42" height="13" rx="6.5" fill="#a9d9bd" />
            <!-- Builder with hammer. -->
            <path d="M51 114l-3 34h15l5-25 6 25h15l-5-34" fill="#315d76" stroke="#25495d" stroke-width="2" stroke-linejoin="round" />
            <path d="M45 148h20v7H40q-1-4 5-7zm29 0h16q6 3 6 7H73z" fill="#263f4e" />
            <path d="M52 80q17-10 31 0l5 38H48z" fill="#f2a044" stroke="#d88232" stroke-width="2" />
            <path d="M57 81l3 21h17l3-21m-20 21v16m17-16v16" fill="none" stroke="#315d76" stroke-width="4" />
            <rect x="64" y="105" width="10" height="8" rx="2" fill="#315d76" />
            <path d="M52 86l-9 19" stroke="#e8ad83" stroke-width="9" stroke-linecap="round" />
            <circle cx="68" cy="65" r="15" fill="#e8ad83" />
            <path d="M54 63q1-17 14-17t14 17z" fill="#f6c84c" stroke="#dca62b" stroke-width="2" />
            <path d="M52 64h32M68 47v8" stroke="#dca62b" stroke-width="3" stroke-linecap="round" />
            <circle cx="73" cy="67" r="1.5" fill="#493e39" />
            <path d="M70 73q3 2 6 0" fill="none" stroke="#9d6553" stroke-width="1.5" stroke-linecap="round" />
            <g class="cloud-builder-hammer">
              <path d="M81 86l13-14 7-10" fill="none" stroke="#e8ad83" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M100 65l7-18" stroke="#a16d43" stroke-width="4" stroke-linecap="round" />
              <path d="M101 45l13 5" stroke="#5a7180" stroke-width="7" stroke-linecap="round" />
            </g>
            <!-- Builder with brush and hair tucked behind her helmet. -->
            <path d="M238 114l-5 34h15l6-25 5 25h15l-3-34" fill="#315d76" stroke="#25495d" stroke-width="2" stroke-linejoin="round" />
            <path d="M231 148h18v7h-24q0-4 6-7zm28 0h16q6 3 6 7h-22z" fill="#263f4e" />
            <path d="M239 80q16-10 30 0l6 38h-42z" fill="#f18c55" stroke="#d87542" stroke-width="2" />
            <path d="M243 81l3 21h17l3-21m-20 21v16m17-16v16" fill="none" stroke="#315d76" stroke-width="4" />
            <rect x="250" y="105" width="10" height="8" rx="2" fill="#315d76" />
            <path d="M268 86l11 20" stroke="#b87957" stroke-width="9" stroke-linecap="round" />
            <path d="M261 55c10 0 14 8 13 17l-1 13c0 4 2 7 4 9-9 1-14-3-15-11z" fill="#513d37" />
            <circle cx="254" cy="65" r="15" fill="#b87957" />
            <path d="M262 57c6 2 7 8 6 14l-3 5-1-11z" fill="#513d37" />
            <path d="M240 63q1-17 14-17t14 17z" fill="#f6c84c" stroke="#dca62b" stroke-width="2" />
            <path d="M238 64h32m-16-17v8" stroke="#dca62b" stroke-width="3" stroke-linecap="round" />
            <circle cx="249" cy="67" r="1.5" fill="#493e39" />
            <path d="M246 73q3 2 6 0" fill="none" stroke="#82523e" stroke-width="1.5" stroke-linecap="round" />
            <g class="cloud-builder-brush">
              <path d="M240 87l-12 7-10-4" fill="none" stroke="#b87957" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M219 91l-9-6" stroke="#a16d43" stroke-width="4" stroke-linecap="round" />
              <path d="M207 82l-4 6" stroke="#4a9dc4" stroke-width="6" stroke-linecap="round" />
            </g>
            <rect x="18" y="140" width="21" height="14" rx="3" fill="#eb8f4c" stroke="#ce743a" stroke-width="2" />
            <path d="M24 140v-4h9v4" fill="none" stroke="#ce743a" stroke-width="2" />
            <path d="M288 155h18m-15 0 2-15h11l2 15" fill="#f0b84e" stroke="#d3932b" stroke-width="2" stroke-linejoin="round" />
          </svg>
          <strong>{t("ui.cloud.registrationCreating")}</strong>
          <span>{t("ui.cloud.registrationVerification")}</span>
        </div>
      </div>
    {/if}
  </div>
{/if}

{#if cloud.open && cloud.adminOpen && cloud.user && cloud.storage?.admin}
  <AdminPanel onclose={() => { cloud.adminOpen = false; }} />
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
  .cloud-storage-info {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
    margin-top: 10px;
    color: #555;
    font-size: 0.9em;
  }
  .cloud-storage-info p { margin: 0; }
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
  .cloud-account-actions button {
    appearance: none;
    box-sizing: border-box;
    height: 34px;
    border: 1px solid #aaa;
    border-radius: 6px;
    background: #eee;
    box-shadow: none;
  }
  .cloud-account-actions button:hover:not(:disabled) {
    background: #dedede;
    border-color: #aaa;
  }
  .cloud-account-actions .cloud-delete-account-button {
    color: #8c1616;
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
    color: #0769c7;
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
  .cloud-registration-overlay {
    position: fixed;
    inset: 0;
    z-index: 1;
    display: grid;
    place-items: center;
    padding: 18px;
    background: #12283c99;
  }
  .cloud-registration-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    box-sizing: border-box;
    width: min(420px, 100%);
    padding: 22px 24px 26px;
    border: 1px solid #cbdde6;
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 18px 60px #12283c40;
    color: #27475d;
    text-align: center;
  }
  .cloud-registration-progress strong { font-size: 1.2rem; }
  .cloud-registration-progress span { font-size: 0.95rem; line-height: 1.45; }
  .cloud-construction {
    display: block;
    width: min(320px, 100%);
    height: auto;
    margin-bottom: 3px;
  }
  .cloud-builder-hammer, .cloud-builder-brush {
    transform-box: fill-box;
    transform-origin: 10% 90%;
  }
  .cloud-builder-hammer { animation: cloud-hammer 0.9s ease-in-out infinite alternate; }
  .cloud-builder-brush { transform-origin: 95% 20%; animation: cloud-brush 1.1s ease-in-out infinite alternate; }
  @keyframes cloud-hammer { to { transform: rotate(-18deg); } }
  @keyframes cloud-brush { to { transform: rotate(13deg); } }
  @media (prefers-reduced-motion: reduce) {
    .cloud-builder-hammer, .cloud-builder-brush { animation: none; }
  }
  :global(.dark) .cloud-registration-progress {
    background: #273844;
    border-color: #516977;
    color: #eef7fb;
  }
  .cloud-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cloud-mode-button[aria-pressed="true"] {
    color: #fff;
    background: #0769c7;
    border-color: #0769c7;
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
    margin: 0;
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
  :global(.dark) .cloud-storage-info { color: #bbb; }
  :global(.dark) .cloud-password-toggle { color: #8fc8ff; }
  :global(.dark) .cloud-account-actions button {
    color: #d4d4d4;
    background: #303034;
    border-color: #55555c;
  }
  :global(.dark) .cloud-account-actions button:hover:not(:disabled) {
    color: #f3f3f3;
    background: #45454a;
    border-color: #707077;
  }
  :global(.dark) .cloud-account-actions .cloud-delete-account-button,
  :global(.dark) .cloud-account-actions .cloud-delete-account-button:hover:not(:disabled) {
    color: #ffd0d0;
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
