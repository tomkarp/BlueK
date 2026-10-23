<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  import { containClicks, focusOnMount } from "../uiActions";
  import type { CloudWorkspace } from "../workspace/CloudWorkspace.svelte";
  const language = useLanguage();
  const t = $derived($language.t);
  let { cloud }: { cloud: CloudWorkspace } = $props();
  let register = $state(false);
  let username = $state("");
  let password = $state("");
  let newPassword = $state("");
  let passwordOpen = $state(false);
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
      aria-labelledby="cloud-title"
      tabindex="-1"
      use:containClicks
    >
      <h3 id="cloud-title">{t("ui.cloud.title")}</h3>
      {#if cloud.error}<p class="dialog-error" role="alert">
          {cloud.error}
        </p>{/if}
      {#if cloud.notice}<p role="status">{cloud.notice}</p>{/if}
      {#if cloud.busy && !cloud.notice}<p role="status">
          {t("ui.cloud.working")}
        </p>{/if}
      {#if cloud.user}
        <p>{t("ui.cloud.signedIn", [cloud.user.username])}</p>
        <div class="cloud-actions">
          <button
            disabled={cloud.busy}
            onclick={async () => {
              await cloud.logout();
              if (!cloud.user) {
                register = false;
                password = "";
                newPassword = "";
              }
            }}>{t("ui.cloud.logout")}</button
          >
        </div>
        <button
          disabled={cloud.busy}
          onclick={() => {
            passwordOpen = !passwordOpen;
            password = "";
            newPassword = "";
          }}>{t("ui.cloud.changePassword")}</button
        >
        {#if passwordOpen}
          <form
            onsubmit={async (event) => {
              event.preventDefault();
              await cloud.changePassword(password, newPassword);
              password = "";
              newPassword = "";
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
                minlength="12"
                maxlength="128"
              /></label
            >
            <button disabled={cloud.busy}>{t("ui.cloud.changePassword")}</button
            >
          </form>
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
          <p>{t("ui.cloud.storageAdvice")}</p>{/if}
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
              pattern="[A-Za-z0-9_-]+"
              use:focusOnMount
            /></label
          >
          <label
            >{t("ui.cloud.password")}<input
              type="password"
              name="password"
              autocomplete={register ? "new-password" : "current-password"}
              bind:value={password}
              required
              minlength="12"
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
    width: min(650px, 94vw);
    max-height: 88vh;
    overflow: auto;
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
</style>
