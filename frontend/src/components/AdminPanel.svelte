<script lang="ts">
  import { onMount } from "svelte";
  import { containClicks } from "../uiActions";
  import { apiRequest } from "../apiClient";
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = $derived($language.t);
  type Account = { id: string; username: string; admin: number; trusted: number; blocked: number; lastUsedAt: number; privateCount: number; privateBytes: number; publicationCount: number; publicationBytes: number; totalBytes: number };
  type StorageSummary = { accountCount: number; privateProjectCount: number; privateBytes: number; publicationCount: number; publicationBytes: number; totalBytes: number };
  type Publication = { code: string; name: string; program: boolean; owner: string | null; expiresAt: string | null; size: number | null; blocked: number; available: boolean };
  type Audit = { createdAt: number; actor: string; action: string; target: string };
  const tabs = ["accounts", "publications", "audit"] as const;
  const auditLabels: Record<string, import("../i18n/catalog").MessageKey> = {
    trust: "ui.admin.trust", untrust: "ui.admin.untrust", "block-account": "ui.admin.blockAccount",
    "unblock-account": "ui.admin.unblockAccount", "delete-account": "ui.admin.deleteAccount",
    "block-publication": "ui.admin.blockPublication", "unblock-publication": "ui.admin.unblockPublication",
    "delete-publication": "ui.admin.deletePublication",
    "grant-admin": "ui.admin.grantAdmin", "revoke-admin": "ui.admin.revokeAdmin",
  };
  let { onclose }: { onclose: () => void } = $props();
  onMount(() => { void load(); });
  let tab = $state<"accounts" | "publications" | "audit">("accounts");
  let query = $state("");
  let accountSort = $state<"username" | "private" | "publications" | "total">("username");
  let bulkUsernames = $state("");
  let bulkResult = $state("");
  let offset = $state(0);
  let busy = $state(false);
  let error = $state("");
  let storageError = $state(false);
  let accounts = $state.raw<Account[]>([]);
  let publications = $state.raw<Publication[]>([]);
  let audit = $state.raw<Audit[]>([]);
  let storageSummary = $state<StorageSummary | null>(null);
  let more = $state(false);
  let inspected = $state<{ code: string; text: string; images: { path: string; data: string }[]; sounds: { path: string; data: string }[] } | null>(null);
  async function load() {
    if (busy) return;
    busy = true; error = ""; storageError = false; inspected = null;
    try {
      if (tab === "accounts") {
        const result = await apiRequest<{ accounts: Account[]; more: boolean }>(`/api/admin/accounts?q=${encodeURIComponent(query)}&offset=${offset}&sort=${accountSort}`);
        accounts = result.accounts; more = result.more;
        try { storageSummary = await apiRequest<StorageSummary>("/api/admin/storage"); }
        catch { storageSummary = null; storageError = true; }
      } else if (tab === "publications") {
        const result = await apiRequest<{ publications: Publication[]; more: boolean }>(`/api/admin/publications?q=${encodeURIComponent(query)}&offset=${offset}`);
        publications = result.publications; more = result.more;
      } else {
        audit = (await apiRequest<{ entries: Audit[] }>("/api/admin/audit")).entries; more = false;
      }
    } catch { error = t("ui.admin.loadError"); }
    finally { busy = false; }
  }
  async function switchTab(next: typeof tab) { tab = next; query = ""; offset = 0; await load(); }
  async function act(action: string, target: string, confirmation?: string) {
    if (busy || (confirmation && !window.confirm(confirmation))) return;
    busy = true; error = "";
    try { await apiRequest("/api/admin/action", { method: "POST", body: JSON.stringify({ action, target }) }); }
    catch { error = t("ui.admin.actionError"); busy = false; return; }
    busy = false; await load();
  }
  async function trustMany() {
    const usernames = [...new Set(bulkUsernames.split(/[\s,;]+/).map(name => name.trim().toLowerCase()).filter(Boolean))];
    if (!usernames.length || busy || !window.confirm(t("ui.admin.bulkTrustConfirm", [usernames.length]))) return;
    busy = true; error = ""; bulkResult = "";
    try {
      const result = await apiRequest<{ trusted: string[]; alreadyTrusted: string[]; missing: string[]; administrators: string[] }>("/api/admin/trust-batch", { method: "POST", body: JSON.stringify({ usernames }) });
      bulkResult = t("ui.admin.bulkTrustResult", [result.trusted.length, result.alreadyTrusted.length, result.missing.join(", ") || "–", result.administrators.join(", ") || "–"]);
    } catch { error = t("ui.admin.actionError"); busy = false; return; }
    busy = false;
    await load();
  }
  async function inspect(code: string) {
    if (inspected?.code === code) { inspected = null; return; }
    busy = true; error = "";
    try {
      const result = await apiRequest<{ payload: unknown }>(`/api/admin/publications/${encodeURIComponent(code)}`);
      const envelope = result.payload as { format?: string; project?: { resources?: unknown[] }; resources?: unknown[] };
      const project = envelope?.format === "bluek-program" ? envelope.project : envelope;
      const resources = Array.isArray(project?.resources) ? project.resources : [];
      const media = resources.filter((item): item is { path: string; data: string } => !!item && typeof item === "object" && typeof (item as { path?: unknown }).path === "string" && typeof (item as { data?: unknown }).data === "string");
      const images = media.filter(item => /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/]*={0,2}$/i.test(item.data));
      const sounds = media.filter(item => /^data:audio\/(?:mpeg|wav|x-wav|ogg|webm);base64,[a-z0-9+/]*={0,2}$/i.test(item.data));
      const text = JSON.stringify(result.payload, (key, value) => key === "data" && typeof value === "string" && value.startsWith("data:") ? t("ui.admin.mediaOmitted") : value, 2);
      inspected = { code, text, images, sounds };
    }
    catch { error = t("ui.admin.loadError"); }
    finally { busy = false; }
  }
  function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes)) return "–";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${bytes} B`;
  }
</script>

<div class="modal topmost-modal admin-modal" role="presentation">
  <div class="dialog admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-title" tabindex="-1" use:containClicks>
    <h3 id="admin-title">{t("ui.admin.title")}</h3>
    <div class="admin-content">
      <nav class="admin-tabs" aria-label={t("ui.admin.title")}>
        {#each tabs as item}
          <button aria-pressed={tab === item} disabled={busy} onclick={() => switchTab(item)}>{t(`ui.admin.${item}`)}</button>
        {/each}
      </nav>
      {#if error}<p class="dialog-error" role="alert">{error}</p>{/if}
      {#if tab !== "audit"}
        <form class="admin-search" onsubmit={(event) => { event.preventDefault(); offset = 0; void load(); }}>
          <input aria-label={t(tab === "accounts" ? "ui.admin.searchAccounts" : "ui.admin.searchPublications")} placeholder={t(tab === "accounts" ? "ui.admin.searchAccounts" : "ui.admin.searchPublications")} bind:value={query} maxlength="32" />
          {#if tab === "accounts"}
            <label class="admin-sort">{t("ui.admin.sortAccounts")}
              <select aria-label={t("ui.admin.sortAccounts")} bind:value={accountSort} onchange={() => { offset = 0; void load(); }}>
                <option value="username">{t("ui.admin.sortByUsername")}</option>
                <option value="private">{t("ui.admin.sortByPrivateStorage")}</option>
                <option value="publications">{t("ui.admin.sortByPublicationStorage")}</option>
                <option value="total">{t("ui.admin.sortByTotalStorage")}</option>
              </select>
            </label>
          {/if}
          <button type="submit" disabled={busy}>{t("ui.admin.search")}</button>
        </form>
      {:else}
        <p>{t("ui.admin.auditInfo")}</p><button disabled={busy} onclick={load}>{t("ui.admin.refresh")}</button>
      {/if}
      {#if busy}<p role="status">{t("ui.admin.loading")}</p>{/if}
      {#if tab !== "audit" && (offset > 0 || more)}
        <div class="admin-pages">
          <button disabled={busy || offset === 0} onclick={() => { offset = Math.max(0, offset - 100); void load(); }}>{t("ui.admin.previous")}</button>
          <span>{t("ui.admin.page", [Math.floor(offset / 100) + 1])}</span>
          <button disabled={busy || !more} onclick={() => { offset += 100; void load(); }}>{t("ui.admin.next")}</button>
        </div>
      {/if}
      {#if tab === "accounts"}
        {#if storageSummary}
          <section class="admin-storage-summary" aria-label={t("ui.admin.storageSummary")}>
            <div><span>{t("ui.admin.accountTotal")}</span><strong>{storageSummary.accountCount}</strong></div>
            <div><span>{t("ui.admin.totalProjectStorage")}</span><strong>{formatBytes(storageSummary.totalBytes)}</strong></div>
            <p>{t("ui.admin.storageBreakdown", [storageSummary.privateProjectCount, formatBytes(storageSummary.privateBytes), storageSummary.publicationCount, formatBytes(storageSummary.publicationBytes)])}</p>
          </section>
        {/if}
        <form class="admin-bulk-trust" onsubmit={(event) => { event.preventDefault(); void trustMany(); }}>
          <label for="admin-bulk-usernames">{t("ui.admin.bulkTrustLabel")}</label>
          <textarea id="admin-bulk-usernames" bind:value={bulkUsernames} rows="3" placeholder={t("ui.admin.bulkTrustPlaceholder")} disabled={busy}></textarea>
          <button type="submit" disabled={busy || !bulkUsernames.trim()}>{t("ui.admin.bulkTrust")}</button>
          {#if bulkResult}<p role="status">{bulkResult}</p>{/if}
        </form>
        {#if storageError}<p class="dialog-error">{t("ui.admin.storageLoadError")}</p>{/if}
        {#if !busy && !error && !accounts.length}<p>{t("ui.admin.noAccounts")}</p>{/if}
        <ul class="admin-list">
          {#each accounts as account (account.id)}
            <li><div class="admin-item-info"><strong>{account.username}</strong><span>{t(account.admin ? "ui.admin.administrator" : account.trusted ? "ui.admin.trusted" : "ui.admin.ordinary")} · {t(account.blocked ? "ui.admin.blocked" : "ui.admin.active")}</span><span>{t("ui.admin.lastUsed", [new Date(account.lastUsedAt).toLocaleDateString($language.locale)])}</span><span>{t("ui.admin.accountCounts", [account.privateCount, account.publicationCount])}</span><span>{t("ui.admin.privateStorage", [formatBytes(account.privateBytes)])}</span><span>{t("ui.admin.publicationStorage", [formatBytes(account.publicationBytes)])}</span><span>{t("ui.admin.accountTotalStorage", [formatBytes(account.totalBytes)])}</span></div>
              {#if !account.admin}<div class="admin-actions">
                <button disabled={busy} onclick={() => act(account.trusted ? "untrust" : "trust", account.id, account.trusted ? t("ui.admin.untrustConfirm", [account.username]) : undefined)}>{t(account.trusted ? "ui.admin.untrust" : "ui.admin.trust")}</button>
                <button disabled={busy} onclick={() => act(account.blocked ? "unblock-account" : "block-account", account.id, account.blocked ? undefined : t("ui.admin.blockAccountConfirm", [account.username]))}>{t(account.blocked ? "ui.admin.unblockAccount" : "ui.admin.blockAccount")}</button>
                <button disabled={busy} onclick={() => act("delete-account", account.id, t("ui.admin.deleteConfirm", [account.username]))}>{t("ui.admin.deleteAccount")}</button>
              </div>{/if}</li>
          {/each}
        </ul>
      {:else if tab === "publications"}
        {#if !busy && !publications.length}<p>{t("ui.admin.noPublications")}</p>{/if}
        <ul class="admin-list">
          {#each publications as publication (publication.code)}
            <li><div class="admin-item-info"><strong>{publication.name || (publication.available ? t("ui.common.untitledProject") : publication.code)}</strong><span>{publication.available ? `${t(publication.program ? "ui.cloud.publicationProgram" : "ui.cloud.publicationProject")} · ` : ""}<code>{publication.code}</code> · {publication.owner || t("ui.admin.anonymous")}</span><span>{publication.available ? `${t("ui.admin.expires", [new Date(publication.expiresAt!).toLocaleDateString($language.locale)])} · ${(publication.size! / 1024).toFixed(1)} KiB · ${t(publication.blocked ? "ui.admin.blocked" : "ui.admin.active")}` : t("ui.admin.publicationUnavailable")}</span></div>
              {#if publication.available}<div class="admin-actions"><button disabled={busy} onclick={() => inspect(publication.code)}>{t(inspected?.code === publication.code ? "ui.admin.hide" : "ui.admin.inspect")}</button><button disabled={busy} onclick={() => act(publication.blocked ? "unblock-publication" : "block-publication", publication.code, publication.blocked ? undefined : t("ui.admin.blockPublicationConfirm", [publication.code]))}>{t(publication.blocked ? "ui.admin.unblockPublication" : "ui.admin.blockPublication")}</button><button disabled={busy} onclick={() => act("delete-publication", publication.code, t("ui.admin.deletePublicationConfirm", [publication.code]))}>{t("ui.admin.deletePublication")}</button></div>{/if}
              {#if inspected?.code === publication.code}
                <div class="admin-preview">
                  {#each inspected.images as image}<figure><img src={image.data} alt={image.path} /><figcaption>{image.path}</figcaption></figure>{/each}
                  {#each inspected.sounds as sound}<figure><figcaption>{sound.path}</figcaption><audio controls src={sound.data}><track kind="captions" /></audio></figure>{/each}
                  <pre class="admin-inspection">{inspected.text}</pre>
                </div>
              {/if}</li>
          {/each}
        </ul>
      {:else}
        {#if !busy && !audit.length}<p>{t("ui.admin.auditEmpty")}</p>{/if}
        <ul class="admin-list">{#each audit as entry}<li><span>{new Date(entry.createdAt).toLocaleString($language.locale)} · {entry.actor || t("ui.admin.deletedAccount")} · {auditLabels[entry.action] ? t(auditLabels[entry.action]) : entry.action} · {entry.target || t("ui.admin.deletedAccount")}</span></li>{/each}</ul>
      {/if}
    </div>
    <div class="dialog-actions"><button onclick={onclose}>{t("ui.admin.close")}</button></div>
  </div>
</div>

<style>
  .admin-modal { z-index: 160; }
  .admin-dialog { display: flex; flex-direction: column; width: min(1000px, 96vw); max-height: 92vh; overflow: auto; }
  .admin-content { flex: 1; min-height: 0; padding: 0 0 12px; }
  .admin-tabs, .admin-search, .admin-actions, .admin-pages { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .admin-bulk-trust { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; margin: 12px 0; }
  .admin-bulk-trust label, .admin-bulk-trust p { grid-column: 1 / -1; }
  .admin-bulk-trust textarea { box-sizing: border-box; width: 100%; min-width: 0; resize: vertical; }
  .admin-tabs button[aria-pressed="true"] { background: #087ff5; color: white; }
  .admin-search { margin: 12px 0; }
  .admin-search input { flex: 1 1 180px; width: auto; margin: 0; }
  .admin-sort { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
  .admin-sort select { max-width: 190px; }
  .admin-storage-summary { display: grid; grid-template-columns: minmax(120px, 0.5fr) minmax(200px, 1fr); gap: 8px 20px; margin: 12px 0; padding: 12px; border: 1px solid #ccc; border-radius: 6px; }
  .admin-storage-summary div { display: flex; flex-direction: column; gap: 3px; }
  .admin-storage-summary strong { font-size: 1.15em; }
  .admin-storage-summary p { grid-column: 1 / -1; margin: 0; font-size: 0.85em; }
  .admin-list { list-style: none; padding: 0; margin: 12px 0; max-height: 350px; overflow: auto; }
  .admin-list li { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; border: 1px solid #ccc; border-radius: 6px; padding: 10px; margin: 6px 0; }
  .admin-item-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
  .admin-item-info span { font-size: 0.85em; }
  .admin-preview { flex-basis: 100%; min-width: 0; }
  .admin-preview figure { display: inline-flex; flex-direction: column; gap: 5px; vertical-align: top; margin: 8px; max-width: 100%; overflow-wrap: anywhere; }
  .admin-preview img { max-width: min(240px, 100%); max-height: 200px; object-fit: contain; }
  .admin-preview audio { max-width: 100%; }
  .admin-inspection { width: 100%; max-height: 240px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
  :global(.dark) .admin-list li { border-color: #555; }
  :global(.dark) .admin-storage-summary { border-color: #555; }
</style>
