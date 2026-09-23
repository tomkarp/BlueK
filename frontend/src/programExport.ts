import { parseProject, type SavedProject } from "./projectFormat";

/**
 * A runnable export: one saved project plus the `main()` the player starts.
 * The project part is exactly the `.bluek.json` payload, so the player can hand
 * it back to BlueK as a file or link unchanged.
 *
 * Which files declare a parameterless `main()` is only known after compiling;
 * the exporter chooses from the runtime manifest and the player checks the
 * choice again against its own compile.
 */
export type ExportedProgram = {
  format: "bluek-program";
  version: 1;
  /** File whose parameterless `main()` starts the program. */
  mainFile: string;
  /** BlueK instance that "Open in BlueK" links to. */
  blueKUrl: string;
  project: SavedProject;
};

/** The template element whose text the exporter fills with the program JSON. */
export const PROGRAM_ELEMENT_ID = "bluek-program";
export const PROGRAM_PLACEHOLDER = `<script type="application/json" id="${PROGRAM_ELEMENT_ID}"></script>`;

/** Longest "Open in BlueK" link offered; Chrome rejects URLs above 2 MB. */
export const MAX_PROJECT_LINK_LENGTH = 1_000_000;

/** Where exports made from a local or offline BlueK send "Open in BlueK". */
export const PUBLIC_BLUEK_URL = "https://bluek.de/";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateBlueKUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("The program has no BlueK address.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The program has an invalid BlueK address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("The program has an invalid BlueK address.");
  url.search = "";
  url.hash = "";
  return url.href;
}

function validateMainFile(value: unknown, project: SavedProject): string {
  if (typeof value !== "string" || !project.files.some((file) => file.fileName === value))
    throw new Error("The program's main file is not part of the project.");
  return value;
}

export function parseExportedProgram(value: unknown): ExportedProgram {
  if (!isRecord(value) || value.format !== "bluek-program" || value.version !== 1)
    throw new Error("Invalid BlueK program.");
  const project = parseProject(value.project);
  return {
    format: "bluek-program",
    version: 1,
    mainFile: validateMainFile(value.mainFile, project),
    blueKUrl: validateBlueKUrl(value.blueKUrl),
    project,
  };
}

export function createExportedProgram(project: SavedProject, mainFile: string, blueKUrl: string): ExportedProgram {
  return parseExportedProgram({ format: "bluek-program", version: 1, mainFile, blueKUrl, project });
}

/**
 * The BlueK address an export links back to: the exporting instance, unless it
 * only exists on this machine (development server, offline package).
 */
export function blueKUrlForExport(origin: string, basePath: string): string {
  const url = new URL(basePath || "/", origin);
  const local = url.protocol === "file:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return local ? PUBLIC_BLUEK_URL : validateBlueKUrl(url.href);
}

/**
 * JSON that is safe as the text of an HTML `<script>` element: no `<` can
 * close the element or open a comment, whatever the Kotlin sources contain.
 */
export function programScriptText(program: ExportedProgram): string {
  return JSON.stringify(program).replace(/[<>&\u2028\u2029]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/** Fills the player template's single, empty program element. */
export function embedProgram(template: string, program: ExportedProgram): string {
  const index = template.indexOf(PROGRAM_PLACEHOLDER);
  if (index < 0 || template.indexOf(PROGRAM_PLACEHOLDER, index + 1) >= 0)
    throw new Error("The BlueK player template is damaged.");
  const filled = PROGRAM_PLACEHOLDER.replace("></script>", `>${programScriptText(program)}</script>`);
  return template.slice(0, index) + filled + template.slice(index + PROGRAM_PLACEHOLDER.length);
}

/** Reads the program element's text in the player. */
export function parseEmbeddedProgram(text: string | null | undefined): ExportedProgram {
  if (!text?.trim()) throw new Error("This file contains no BlueK program.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("The BlueK program in this file is damaged.");
  }
  return parseExportedProgram(value);
}

/** File name for a download, from the project name; the extension is appended. */
export function exportFileName(projectName: string | undefined, extension: string): string {
  const safe = (projectName ?? "").trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-") || "bluek-project";
  return `${safe}${extension}`;
}
