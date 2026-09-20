import type { ProjectFile, ProjectLibrary, ProjectResource, ProjectCardPosition } from "../../runtime-contract/src/index";

export type { ProjectResource, ProjectCardPosition };

export type SavedProjectFile = {
  fileName: string;
  path?: string;
  source: string;
  kind?: ProjectFile["kind"];
};

export type SavedProject = {
  format: "bluek-project";
  version: 1;
  library?: ProjectLibrary;
  files: SavedProjectFile[];
  resources?: ProjectResource[];
  cardPositions?: Record<string, ProjectCardPosition>;
  /** The project description (README.md); absent while nobody wrote one. */
  readme?: string;
};

export type ProjectModel = {
  files: ProjectFile[];
  library?: ProjectLibrary;
  resources: ProjectResource[];
  cardPositions: Record<string, ProjectCardPosition>;
  readme: string;
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
  const resources = (value as ProjectResource[]).map(({ path, data }) => ({ path, data }));
  if (new Set(resources.map((resource) => resource.path)).size !== resources.length)
    throw new Error("The project contains duplicate media resources.");
  return resources;
}

function validateLibrary(value: unknown): ProjectLibrary | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || value.id !== "blueplay" || value.version !== 1)
    throw new Error("The project contains an unknown BlueK library.");
  return { id: "blueplay", version: 1 };
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

// Projects written before README.md exist, and an empty description is not
// exported at all, so the entry is optional wherever it is read.
function validateReadme(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("The project contains an invalid README.");
  return value;
}

export function parseProject(value: unknown): SavedProject {
  if (!isRecord(value) || value.format !== "bluek-project" || value.version !== 1)
    throw new Error("Invalid BlueK project.");
  return {
    format: "bluek-project",
    version: 1,
    library: validateLibrary(value.library),
    files: validateFiles(value.files),
    resources: validateResources(value.resources),
    cardPositions: validateCardPositions(value.cardPositions),
    readme: validateReadme(value.readme),
  };
}

export function createProjectPayload(
  files: ProjectFile[],
  resources: ProjectResource[],
  cardPositions: Record<string, ProjectCardPosition>,
  library?: ProjectLibrary,
  additionalCardFiles: ProjectFile[] = [],
  readme = "",
): SavedProject {
  const positionedFiles = [...files, ...additionalCardFiles];
  return {
    format: "bluek-project",
    version: 1,
    ...(library ? { library } : {}),
    // A description nobody wrote is nothing to export; whitespace alone is none.
    ...(readme.trim() ? { readme } : {}),
    files: files.map((file) => ({
      ...(file.path ? { path: file.path } : {}),
      fileName: file.fileName,
      kind: file.kind,
      source: file.source,
    })),
    resources: resources.map(({ path, data }) => ({ path, data })),
    cardPositions: Object.fromEntries(
      positionedFiles
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
  const bluePlayFrameworkNames = new Set([
    "BluePlayFunctions.kt",
    "World.kt",
    "Actor.kt",
    "Image.kt",
  ]);
  return {
    files,
    library: payload.library,
    resources: payload.resources ?? [],
    readme: payload.readme ?? "",
    cardPositions: Object.fromEntries(
      files
        .filter((file) => positions[file.fileName])
        .map((file) => [
          payload.library?.id === "blueplay" && bluePlayFrameworkNames.has(file.fileName)
            ? `blueplay-framework-${file.fileName}`
            : file.id,
          positions[file.fileName],
        ])
        .concat(
          payload.library?.id === "blueplay"
            ? Array.from(bluePlayFrameworkNames)
                .filter((fileName) => positions[fileName])
                .map((fileName) => [`blueplay-framework-${fileName}`, positions[fileName]] as const)
            : [],
        ),
    ),
  };
}
