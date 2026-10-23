import {
  createExportedProgram,
  type ExportedProgram,
  type ProgramOptions,
} from "./programExport";
import type { SavedProject } from "./projectFormat";
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

export function shortProgramLink(
  code: string,
  basePath: string,
  pageUrl: string,
): string {
  return shortShareUrl("run", code, basePath, pageUrl).href;
}
