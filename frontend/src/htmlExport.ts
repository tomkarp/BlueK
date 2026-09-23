import type { SavedProject } from "./projectFormat";
import { blueKUrlForExport, createExportedProgram, embedProgram } from "./programExport";

/**
 * Builds the runnable HTML file of a project from the player template that is
 * published next to the app (`player/bluek-player.html`). Choosing the main()
 * and compiling stay with the caller; this only needs the chosen file.
 */

let template: Promise<string> | null = null;

/** The player template, loaded once from the app's base path. */
export function loadPlayerTemplate(basePath: string, pageUrl: string): Promise<string> {
  template ||= fetch(new URL(`${basePath}player/bluek-player.html`, pageUrl))
    .then((response) => {
      if (!response.ok) throw new Error("The HTML player is not available.");
      return response.text();
    })
    .catch((reason) => {
      template = null;
      throw reason instanceof Error ? reason : new Error(String(reason));
    });
  return template;
}

export async function htmlExport(project: SavedProject, mainFile: string, basePath: string, pageUrl: string): Promise<string> {
  const url = new URL(pageUrl);
  const program = createExportedProgram(project, mainFile, blueKUrlForExport(url.origin, new URL(basePath, url).pathname));
  return embedProgram(await loadPlayerTemplate(basePath, pageUrl), program);
}
