import { unzipSync } from "fflate";
import type { SavedProject, SavedProjectFile, ProjectResource, ProjectCardPosition } from "./projectFormat";
import { STANDARD_IMAGES } from "./standardImages.generated";
import { STANDARD_SOUNDS } from "./standardSounds.generated";

/** One file of a BlueJ project, e.g. from a ZIP archive or a chosen directory. */
export type ImportEntry = { path: string; bytes: Uint8Array };

// The built-in BluePlay library replaces these historical library sources.
const BLUEPLAY_LIBRARY_SOURCES = new Set(["World.kt", "Actor.kt", "Image.kt", "BluePlayFunctions.kt", "BluePlayHelpers.kt"]);
const MEDIA_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg",
};
const CLASS_DECLARATION = /^\s*(?:(?:open|abstract|data|sealed|enum|private|internal)\s+)*(?:class|interface|object)\s/m;

export function entriesFromZip(bytes: Uint8Array): ImportEntry[] {
  return Object.entries(unzipSync(bytes))
    .filter(([path]) => !path.endsWith("/"))
    .map(([path, content]) => ({ path, bytes: content }));
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

/** Card positions from BlueJ's `package.bluej` (targetN.name/x/y). */
function cardPositions(packageText: string | undefined, files: SavedProjectFile[]) {
  if (!packageText) return {};
  const properties = new Map(packageText.split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf("=");
    return separator > 0 ? [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()] as const] : [];
  }));
  const names = new Set(files.map((file) => file.fileName));
  const positions: Record<string, ProjectCardPosition> = {};
  for (const [key, name] of properties) {
    const target = key.match(/^(target\d+)\.name$/)?.[1];
    const x = Number(properties.get(`${target}.x`)), y = Number(properties.get(`${target}.y`));
    if (target && names.has(`${name}.kt`) && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0)
      positions[`${name}.kt`] = { x, y };
  }
  return positions;
}

/** Normalize archive and dropped-folder paths before discovering independent projects. */
function usableEntries(entries: ImportEntry[]) {
  return entries
    .map((entry) => ({ ...entry, path: entry.path.replace(/\\/g, "/").replace(/^\/+/, "") }))
    .filter((entry) => !entry.path.split("/").some((part) => part === "__MACOSX" || part.startsWith(".")));
}

export type BlueJProjectChoice = { root: string; label: string; fileCount: number };

/** One choice per project, not per package nested inside a project. */
export function blueJProjects(entries: ImportEntry[]): BlueJProjectChoice[] {
  const usable = usableEntries(entries);
  const directory = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);
  const markers = usable.filter((entry) => /(^|\/)package\.bluej$/.test(entry.path)).map((entry) => directory(entry.path));
  const roots = markers.length ? markers : usable.filter((entry) => entry.path.endsWith(".kt")).map((entry) => directory(entry.path));
  return [...new Set(roots)]
    .map((root) => ({
      root,
      label: root.replace(/\/$/, "") || ".",
      fileCount: usable.filter((entry) => entry.path.startsWith(root) && /^[A-Za-z0-9_.-]+\.kt$/.test(entry.path.slice(root.length))).length,
    }))
    .filter((project) => project.fileCount > 0)
    .filter((project, _, all) => !all.some((parent) => parent.root !== project.root && project.root.startsWith(parent.root)))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}

/** Convert exactly one selected project; collections require an explicit choice. */
export function blueJProjectFromEntries(entries: ImportEntry[], selectedRoot?: string): SavedProject {
  const projects = blueJProjects(entries);
  if (!projects.length) throw new Error("No BlueJ project found: the ZIP file or directory contains no package.bluej and no Kotlin files.");
  if (selectedRoot === undefined && projects.length > 1) throw new Error("This archive contains several BlueJ projects. Choose a project to open.");
  const root = selectedRoot ?? projects[0].root;
  if (!projects.some((project) => project.root === root)) throw new Error("The selected BlueJ project was not found.");
  const inRoot = usableEntries(entries)
    .filter((entry) => entry.path.startsWith(root))
    .map((entry) => ({ ...entry, path: entry.path.slice(root.length) }));
  const decoder = new TextDecoder();
  const kotlin = inRoot.filter((entry) => /^[A-Za-z0-9_.-]+\.kt$/.test(entry.path));
  const blueplay = ["World.kt", "Actor.kt"].every((name) => kotlin.some((entry) => entry.path === name));
  const files: SavedProjectFile[] = kotlin
    .filter((entry) => !(blueplay && BLUEPLAY_LIBRARY_SOURCES.has(entry.path)))
    .map((entry) => {
      const source = decoder.decode(entry.bytes);
      const kind: SavedProjectFile["kind"] = CLASS_DECLARATION.test(source) ? "class" : "functions";
      return { fileName: entry.path, kind, source };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
  if (!files.length && !blueplay) throw new Error("The BlueJ project contains no Kotlin files.");
  // BlueJ exports of BluePlay projects carry every standard image and sound;
  // unchanged copies stay standard resources instead of becoming project files.
  const standard = new Map([...STANDARD_IMAGES, ...STANDARD_SOUNDS].map(({ path, data }) => [path, data.slice(data.indexOf(",") + 1)]));
  const resources: ProjectResource[] = inRoot.flatMap((entry) => {
    const type = /^(?:images|sounds)\/[^/]+$/.test(entry.path) ? MEDIA_TYPES[entry.path.split(".").pop()!.toLowerCase()] : undefined;
    if (!type) return [];
    const encoded = base64(entry.bytes);
    return blueplay && standard.get(entry.path) === encoded ? [] : [{ path: entry.path, data: `data:${type};base64,${encoded}` }];
  });
  const packageFile = inRoot.find((entry) => entry.path === "package.bluej");
  // BlueJ keeps the project description in README.TXT; BlueK reads it as the
  // Markdown README, so an imported project does not lose what it says about itself.
  const readme = inRoot.find((entry) => /^README\.(?:TXT|MD)$/i.test(entry.path));
  const description = readme ? decoder.decode(readme.bytes) : "";
  return {
    format: "bluek-project",
    version: 1,
    ...(blueplay ? { library: { id: "blueplay", version: 1 } as const } : {}),
    files,
    resources,
    cardPositions: cardPositions(packageFile && decoder.decode(packageFile.bytes), files),
    ...(description.trim() ? { readme: description } : {}),
  };
}
