import { unzipSync } from "fflate";
import type { SavedProject, SavedProjectFile, ProjectResource, ProjectCardPosition } from "./projectFormat";

/** One file of a BlueJ project, e.g. from a ZIP archive or a chosen directory. */
export type ImportEntry = { path: string; bytes: Uint8Array };

// The built-in BluePlay library replaces these historical framework sources.
const BLUEPLAY_FRAMEWORK = new Set(["World.kt", "Actor.kt", "Image.kt", "BluePlayFunctions.kt", "BluePlayHelpers.kt"]);
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

/**
 * Convert a BlueJ project (Kotlin sources, images/, sounds/, package.bluej) into
 * the BlueK project format. The project root is the directory of the shallowest
 * package.bluej, so ZIP archives with an enclosing folder work as well.
 */
export function blueJProjectFromEntries(entries: ImportEntry[]): SavedProject {
  const usable = entries
    .map((entry) => ({ ...entry, path: entry.path.replace(/\\/g, "/").replace(/^\/+/, "") }))
    .filter((entry) => !entry.path.split("/").some((part) => part === "__MACOSX" || part.startsWith(".")));
  const depth = (path: string) => path.split("/").length;
  const byDepth = (a: ImportEntry, b: ImportEntry) => depth(a.path) - depth(b.path);
  const marker = usable.filter((entry) => /(^|\/)package\.bluej$/.test(entry.path)).sort(byDepth)[0]
    ?? usable.filter((entry) => entry.path.endsWith(".kt")).sort(byDepth)[0];
  if (!marker) throw new Error("No BlueJ project found: the ZIP file or directory contains no package.bluej and no Kotlin files.");
  const root = marker.path.slice(0, marker.path.lastIndexOf("/") + 1);
  const inRoot = usable
    .filter((entry) => entry.path.startsWith(root))
    .map((entry) => ({ ...entry, path: entry.path.slice(root.length) }));
  const decoder = new TextDecoder();
  const kotlin = inRoot.filter((entry) => /^[A-Za-z0-9_.-]+\.kt$/.test(entry.path));
  const blueplay = ["World.kt", "Actor.kt"].every((name) => kotlin.some((entry) => entry.path === name));
  const files: SavedProjectFile[] = kotlin
    .filter((entry) => !(blueplay && BLUEPLAY_FRAMEWORK.has(entry.path)))
    .map((entry) => {
      const source = decoder.decode(entry.bytes);
      const kind: SavedProjectFile["kind"] = CLASS_DECLARATION.test(source) ? "class" : "functions";
      return { fileName: entry.path, kind, source };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
  if (!files.length && !blueplay) throw new Error("The BlueJ project contains no Kotlin files.");
  const resources: ProjectResource[] = inRoot.flatMap((entry) => {
    const type = /^(?:images|sounds)\/[^/]+$/.test(entry.path) ? MEDIA_TYPES[entry.path.split(".").pop()!.toLowerCase()] : undefined;
    return type ? [{ path: entry.path, data: `data:${type};base64,${base64(entry.bytes)}` }] : [];
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
