import type { ProjectFile } from "../../runtime-contract/src/index";

export type ProjectResource = { path: string; data: string };
export type ProjectCardPosition = { x: number; y: number };

export type SavedProjectFile = {
  fileName: string;
  path?: string;
  source: string;
  kind?: ProjectFile["kind"];
};

export type SavedProject = {
  format: "bluek-project";
  version: 1;
  files: SavedProjectFile[];
  resources?: ProjectResource[];
  cardPositions?: Record<string, ProjectCardPosition>;
};

export type ProjectModel = {
  files: ProjectFile[];
  resources: ProjectResource[];
  cardPositions: Record<string, ProjectCardPosition>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKotlinFileName(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+\.kt$/.test(value);
}

function validateFiles(value: unknown): SavedProjectFile[] {
  if (!Array.isArray(value)) throw new Error("A BlueK project must contain Kotlin files.");
  const files = value.map((item) => {
    if (!isRecord(item) || !isKotlinFileName(item.fileName) ||
      (item.path !== undefined && (typeof item.path !== "string" || !item.path)) ||
      typeof item.source !== "string")
      throw new Error("Invalid Kotlin file in project.");
    if (item.kind !== undefined && item.kind !== "class" && item.kind !== "functions")
      throw new Error("Invalid Kotlin file kind in project.");
    return {
      fileName: item.fileName,
      path: typeof item.path === "string" ? item.path : undefined,
      source: item.source,
      kind: item.kind as ProjectFile["kind"] | undefined,
    };
  });
  if (new Set(files.map((file) => file.fileName)).size !== files.length)
    throw new Error("The project contains duplicate Kotlin file names.");
  return files;
}

function validateResources(value: unknown): ProjectResource[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => {
    if (!isRecord(item)) return true;
    return typeof item.path !== "string" || !item.path || item.path.startsWith("/") ||
      item.path.split("/").includes("..") || typeof item.data !== "string" ||
      !/^data:[^;]+;base64,/.test(item.data);
  })) throw new Error("The project contains invalid media resources.");
  const resources = value as ProjectResource[];
  if (new Set(resources.map((resource) => resource.path)).size !== resources.length)
    throw new Error("The project contains duplicate media resources.");
  return resources;
}

function validateCardPositions(value: unknown): Record<string, ProjectCardPosition> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.entries(value).some(([fileName, position]) => {
    return !isKotlinFileName(fileName) || !isRecord(position) ||
      !Number.isFinite(position.x) || !Number.isFinite(position.y) ||
      (position.x as number) < 0 || (position.y as number) < 0;
  })) throw new Error("The project contains invalid card positions.");
  return value as Record<string, ProjectCardPosition>;
}

export function parseProject(value: unknown): SavedProject {
  if (!isRecord(value) || value.format !== "bluek-project" || value.version !== 1)
    throw new Error("Invalid BlueK project.");
  return {
    format: "bluek-project",
    version: 1,
    files: validateFiles(value.files),
    resources: validateResources(value.resources),
    cardPositions: validateCardPositions(value.cardPositions),
  };
}

export function createProjectPayload(
  files: ProjectFile[],
  resources: ProjectResource[],
  cardPositions: Record<string, ProjectCardPosition>,
): SavedProject {
  return {
    format: "bluek-project",
    version: 1,
    files: files.map((file) => ({
      ...(file.path ? { path: file.path } : {}),
      fileName: file.fileName,
      kind: file.kind,
      source: file.source,
    })),
    resources,
    cardPositions: Object.fromEntries(
      files
        .filter((file) => cardPositions[file.id])
        .map((file) => [file.fileName, cardPositions[file.id]]),
    ),
  };
}

export function projectModelFromPayload(
  value: unknown,
  createId: (index: number, file: SavedProjectFile) => string,
): ProjectModel {
  const payload = parseProject(value);
  const files = payload.files.map((file, index) => ({
    id: createId(index, file),
    ...(file.path ? { path: file.path } : {}),
    fileName: file.fileName,
    kind: file.kind === "functions" ? "functions" : "class",
    source: file.source,
    revision: 1,
  } satisfies ProjectFile));
  const positions = payload.cardPositions ?? {};
  return {
    files,
    resources: payload.resources ?? [],
    cardPositions: Object.fromEntries(
      files
        .filter((file) => positions[file.fileName])
        .map((file) => [file.id, positions[file.fileName]]),
    ),
  };
}
