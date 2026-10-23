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
  let passwordOpen = $state(false);
  let newUsername = $state("");
  let usernameOpen = $state(false);
  let acknowledged = $state(false);
  async function authenticate() {
    await cloud.authenticate(register, username, password);
    password = "";
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
      {#if cloud.error && !passwordOpen && !usernameOpen}<p class="dialog-error" role="alert">
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
                    passwordOpen = false;
                  }
                }}>{t("ui.cloud.logout")}</button
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
                  const changed = await cloud.changePassword(password, newPassword);
                  password = "";
                  newPassword = "";
                  if (changed) passwordOpen = false;
                }}
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
                <label
                  >{t("ui.cloud.newPassword")}<input
                    type="password"
                    name="new-password"
                    autocomplete="new-password"
                    bind:value={newPassword}
                    required
                    minlength="10"
                    maxlength="128"
                  /></label
                >
                <div class="dialog-actions">
                  <button type="button" disabled={cloud.busy} onclick={() => (passwordOpen = false)}>{t("ui.common.cancel")}</button>
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
      {:else}
        <p>{t("ui.cloud.localWithoutAccount")}</p>
        <div class="cloud-actions">
          <button
            disabled={cloud.busy}
            aria-pressed={!register}
            onclick={() => {
              register = false;
              password = "";
            }}>{t("ui.cloud.login")}</button
          >
          <button
            disabled={cloud.busy}
            aria-pressed={register}
            onclick={() => {
              register = true;
              password = "";
            }}>{t("ui.cloud.register")}</button
          >
        </div>
        {#if register}<p>{t("ui.cloud.registrationAdvice")}</p>
          <div class="dialog-warning storage-warning" role="note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 2.8 20h18.4L12 3Z" />
              <path d="M12 9v5m0 3h.01" />
            </svg>
            <span>{t("ui.cloud.storageAdvice")}</span>
          </div>{/if}
        <p>{t("ui.cloud.passwordAdvice")}</p>
        <form
          onsubmit={(event) => {
            event.preventDefault();
            void authenticate();
          }}
        >
          <label
            >{t("ui.cloud.username")}<input
              name="username"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              bind:value={username}
              required
              minlength="3"
              maxlength="32"
              pattern="[A-Za-z0-9._-]+"
            /></label
          >
          <label
            >{t("ui.cloud.password")}<input
              type="password"
              name="password"
              autocomplete={register ? "new-password" : "current-password"}
              bind:value={password}
              required
              minlength="10"
              maxlength="128"
            /></label
          >
          {#if register}<label class="cloud-ack"
              ><input type="checkbox" bind:checked={acknowledged} required />{t(
                "ui.cloud.acknowledge",
              )}</label
            >{/if}
          <button disabled={cloud.busy || (register && !acknowledged)}
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
  .account-password-modal {
    z-index: 170;
  }
  .cloud-password-dialog {
    width: min(460px, 92vw);
  }
  .cloud-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
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
    align-items: start;
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
</style>
