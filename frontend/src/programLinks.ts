import {
  createExportedProgram,
  MAX_PROJECT_LINK_LENGTH,
  type ExportedProgram,
  type ProgramOptions,
} from "./programExport";
import type { SavedProject } from "./projectFormat";
import { encodeBlueKLink } from "./uiParity";
import { applicationUrl, shortShareUrl } from "./shareLinks";

export function programForLink(
  project: SavedProject,
  mainFile: string,
  basePath: string,
  pageUrl: string,
  options: ProgramOptions,
): ExportedProgram {
  return createExportedProgram(
    project,
    mainFile,
    applicationUrl(basePath, pageUrl).href,
    options,
  );
}

export async function fullProgramLink(
  program: ExportedProgram,
  basePath: string,
  pageUrl: string,
): Promise<string> {
  const url = applicationUrl(basePath, pageUrl);
  url.hash = `run=${await encodeBlueKLink(program)}`;
  if (url.href.length > MAX_PROJECT_LINK_LENGTH)
    throw new Error(
      "This program is too large for a full link. Use a short link or export HTML.",
    );
  return url.href;
}

export function shortProgramLink(
  code: string,
  basePath: string,
  pageUrl: string,
): string {
  return shortShareUrl("run", code, basePath, pageUrl).href;
}
