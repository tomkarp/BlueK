import { mount } from "svelte";
import PlayerApp from "./PlayerApp.svelte";
import PlayerProblem from "./PlayerProblem.svelte";
import {
  PROGRAM_ELEMENT_ID,
  parseEmbeddedProgram,
  parseExportedProgram,
} from "./programExport";
import { decodeBlueKLink } from "./uiParity";
import { loadProgramFromServer, ShareCodeError } from "./shareApi";
import { Language } from "./i18n/Language.svelte";
import { shareRoute } from "./shareRoutes";
import { shortShareUrl } from "./shareLinks";

async function decodeProgramLink(encoded: string): Promise<unknown> {
  try {
    return await decodeBlueKLink(encoded);
  } catch {
    throw new Error("Invalid BlueK program link.");
  }
}

/** Hosted links and standalone HTML validate and mount the same player. */
export async function openPlayer(
  target: HTMLElement,
  createWorker: () => Worker,
  developerBaseUrl: string,
) {
  const language = new Language();
  language.restore();
  document.documentElement.lang = language.locale;
  // Embedded HTML remains self-contained, regardless of an appended hash.
  const embedded = document.getElementById(PROGRAM_ELEMENT_ID)?.textContent;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const encoded = params.get("run");
  const route = shareRoute(developerBaseUrl, window.location.href);
  const code = route?.kind === "run" ? route.code : null;
  const projectUrl = (shared: string) =>
    shortShareUrl("bluek", shared, developerBaseUrl, window.location.href).href;
  try {
    const program = embedded?.trim()
      ? parseEmbeddedProgram(embedded)
      : encoded
        ? parseExportedProgram(await decodeProgramLink(encoded))
        : code
          ? await loadProgramFromServer(code)
          : parseEmbeddedProgram(embedded);
    mount(PlayerApp, {
      target,
      props: {
        program,
        developerUrl:
          code && !encoded && !embedded?.trim()
            ? projectUrl(code)
            : undefined,
        language,
        createWorker,
      },
    });
  } catch (error) {
    const problem = error instanceof ShareCodeError ? error.problem : null;
    // Links lead back to BlueK; a standalone file has no BlueK page of its own.
    const linked =
      !embedded?.trim() &&
      Boolean(encoded || code) &&
      /^https?:$/.test(new URL(developerBaseUrl).protocol);
    mount(PlayerProblem, {
      target,
      props: {
        language,
        message: error instanceof Error ? error.message : String(error),
        expired: problem === "missing",
        projectUrl:
          problem === "project" && code ? projectUrl(code) : undefined,
        homeUrl: linked ? developerBaseUrl : undefined,
      },
    });
  }
}
