/** Load this classic script once from inf-schule's central site template.
 * Content pages need only <a href="project.bluek.json" data-bluek-project>…</a>.
 * Relative project paths work unchanged on local and published inf-schule.
 */
(() => {
  const target =
    document.currentScript?.getAttribute("data-bluek-target") ||
    "https://bluek.online/";
  function openInBlueK(projectPath, bluekAddress = target) {
    const projectURL = new URL(projectPath, window.location.href);
    const bluekURL = new URL(bluekAddress);
    if (
      projectURL.origin !== window.location.origin ||
      !["http:", "https:"].includes(projectURL.protocol) ||
      projectURL.username ||
      projectURL.password ||
      !["http:", "https:"].includes(bluekURL.protocol) ||
      bluekURL.username ||
      bluekURL.password ||
      bluekURL.search ||
      bluekURL.hash
    ) {
      return Promise.reject(
        new Error("Ungültige Adresse für die BlueK-Übergabe."),
      );
    }
    bluekURL.searchParams.set("import", "inf-schule");
    bluekURL.searchParams.set("sender", window.location.origin);
    const targetOrigin = bluekURL.origin;
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      let child = null;
      let ready = false;
      let sent = false;
      let project;
      let failure;
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        controller.abort();
        window.removeEventListener("message", message);
        if (error) reject(error);
        else resolve();
      };
      const send = () => {
        if (!ready || sent || settled || !child) return;
        if (failure) {
          child.postMessage(
            { type: "bluek:handoff:cancel", version: 1 },
            targetOrigin,
          );
          finish(failure);
        } else if (project !== undefined) {
          sent = true;
          child.postMessage(
            { type: "bluek:handoff:project", version: 1, project },
            targetOrigin,
          );
        }
      };
      const message = (event) => {
        if (
          !event.isTrusted ||
          event.origin !== targetOrigin ||
          event.source !== child ||
          !event.data ||
          event.data.version !== 1
        )
          return;
        if (event.data.type === "bluek:handoff:ready") {
          ready = true;
          send();
        } else if (sent && event.data.type === "bluek:handoff:result") {
          finish(
            event.data.status === "loaded"
              ? undefined
              : new Error(
                  event.data.status === "cancelled"
                    ? "Die Übergabe wurde abgebrochen."
                    : "BlueK konnte das Projekt nicht übernehmen. Lade die JSON-Datei herunter und öffne sie in BlueK.",
                ),
          );
        }
      };
      const timeout = setTimeout(
        () =>
          finish(
            new Error(
              "BlueK antwortet nicht. Öffne das Projekt erneut oder lade die JSON-Datei herunter und öffne sie in BlueK.",
            ),
          ),
        30_000,
      );
      window.addEventListener("message", message);
      // Keep the opener intentionally: it is the pinned reply/transfer window.
      // Do not use a link with noopener/noreferrer or await a fetch before this.
      child = window.open(bluekURL.href, "_blank");
      if (!child) {
        finish(
          new Error(
            "Erlaube das Öffnen eines neuen Tabs, um das Projekt in BlueK zu öffnen.",
          ),
        );
        return;
      }
      fetch(projectURL, {
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok)
            throw new Error("Die Projektdatei konnte nicht geladen werden.");
          return response.json();
        })
        .then((value) => {
          project = value;
          send();
        })
        .catch((error) => {
          if (settled) return;
          failure =
            error instanceof Error
              ? error
              : new Error("Die Projektdatei konnte nicht geladen werden.");
          send();
        });
    });
  }

  const pending = new WeakSet();
  const statuses = new WeakMap();
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    const link =
      event.target instanceof Element
        ? event.target.closest("a[data-bluek-project]")
        : null;
    if (!link) return;
    event.preventDefault();
    if (pending.has(link)) return;
    pending.add(link);
    const previousBusy = link.getAttribute("aria-busy");
    link.setAttribute("aria-busy", "true");
    let status = statuses.get(link);
    if (!status) {
      status = document.createElement("span");
      status.className = "bluek-project-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      link.insertAdjacentElement("afterend", status);
      statuses.set(link, status);
    }
    status.textContent = " Projekt wird geöffnet …";
    const finished = () => {
      pending.delete(link);
      if (previousBusy === null) link.removeAttribute("aria-busy");
      else link.setAttribute("aria-busy", previousBusy);
    };
    try {
      openInBlueK(link.href)
        .then(() => {
          status.textContent = " Das Projekt ist in BlueK geöffnet.";
        })
        .catch((error) => {
          status.textContent = " " + error.message;
        })
        .finally(finished);
    } catch (error) {
      status.textContent = " " + error.message;
      finished();
    }
  });
})();
