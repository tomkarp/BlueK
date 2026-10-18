import { strToU8, zipSync } from "fflate";
import { BLUEJ_BLUEPLAY_FILES } from "./blueJBluePlay.generated";
import { bluePlayLibraryFiles } from "./bluePlayCards";
import type { ProjectCardPosition, SavedProject } from "./projectFormat";
import { STANDARD_IMAGES } from "./standardImages.generated";
import { STANDARD_SOUNDS } from "./standardSounds.generated";

type BlueJTarget = { name: string; type: "ClassTarget" | "KotlinFileTarget"; position?: ProjectCardPosition };

const isTestFile = (file: SavedProject["files"][number]) => Boolean(file.isTestClass || file.testTarget);

/**
 * What a BlueJ export cannot carry over, so the user can be told: test classes
 * (left out, BlueJ has no kotlin.test) and MP3 sounds (exported, but BluePlay in
 * BlueJ plays WAV only). Both lists are empty for most projects.
 */
export function blueJExportLimits(project: SavedProject) {
  return {
    testClasses: project.files.filter(isTestFile).map((file) => file.fileName.replace(/\.kt$/, "")),
    mp3Sounds: (project.resources ?? [])
      .filter((resource) => resource.data.startsWith("data:audio/mpeg"))
      .map((resource) => resource.path.slice(resource.path.indexOf("/") + 1)),
  };
}

function bytesOf(dataUrl: string) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * BlueJ's package file: the class diagram with one target per Kotlin file. BlueJ
 * reads the card positions and derives everything else (roles, arrows) from the
 * sources when it compiles them.
 */
function packageFile(targets: BlueJTarget[]) {
  const placed = targets.map((target, index) => {
    const position = target.position ?? { x: 10 + (index % 4) * 160, y: 80 + Math.floor(index / 4) * 100 };
    return { ...target, x: Math.max(0, Math.round(position.x)), y: Math.max(0, Math.round(position.y)) };
  });
  const width = Math.max(720, ...placed.map((target) => target.x + 160));
  const height = Math.max(420, ...placed.map((target) => target.y + 100));
  const properties: Record<string, string | number | boolean> = {
    "objectbench.height": 101,
    "objectbench.width": 776,
    "package.divider.horizontal": 0.6,
    "package.divider.vertical": 0.8,
    "package.editor.height": height,
    "package.editor.width": width,
    "package.editor.x": 0,
    "package.editor.y": 29,
    "package.frame.height": height + 140,
    "package.frame.width": width + 80,
    "package.numDependencies": 0,
    "package.numTargets": placed.length,
    "package.showExtends": true,
    "package.showUses": false,
    "project.charset": "UTF-8",
    "readme.height": 60,
    "readme.name": "@README",
    "readme.width": 48,
    "readme.x": 10,
    "readme.y": 10,
  };
  placed.forEach((target, index) => {
    const key = `target${index + 1}`;
    properties[`${key}.height`] = 70;
    properties[`${key}.name`] = target.name;
    properties[`${key}.showInterface`] = false;
    properties[`${key}.type`] = target.type;
    properties[`${key}.width`] = target.type === "KotlinFileTarget" ? 130 : 120;
    properties[`${key}.x`] = target.x;
    properties[`${key}.y`] = target.y;
  });
  return ["#BlueJ package file", ...Object.entries(properties).map(([key, value]) => `${key}=${value}`)].join("\n") + "\n";
}

/**
 * A BlueJ project (BlueJ 6 with Kotlin) as ZIP archive, inside one folder.
 * BluePlay projects get the BlueJ version of the library instead of BlueK's
 * built-in one, and every standard image and sound in images/ and sounds/, so
 * they stay available in BlueJ; a project resource with the same name wins.
 * Test classes are left out: BlueJ has no kotlin.test, so they would not
 * compile there.
 */
export function blueJProjectZip(project: SavedProject, folderName: string): Uint8Array<ArrayBuffer> {
  const bluePlay = project.library?.id === "blueplay";
  const positions = project.cardPositions ?? {};
  const files = project.files.filter((file) => !isTestFile(file));
  const sources = [
    ...(bluePlay ? BLUEJ_BLUEPLAY_FILES : []),
    ...files.map(({ fileName, source }) => ({ fileName, source })),
  ];
  const targets: BlueJTarget[] = [
    ...(bluePlay ? bluePlayLibraryFiles : []),
    ...files,
  ].map((file) => ({
    name: file.fileName.replace(/\.kt$/, ""),
    type: file.kind === "functions" ? "KotlinFileTarget" : "ClassTarget",
    position: positions[file.fileName],
  }));
  const media = new Map<string, Uint8Array>();
  for (const resource of [...(bluePlay ? [...STANDARD_IMAGES, ...STANDARD_SOUNDS] : []), ...(project.resources ?? [])])
    media.set(resource.path, bytesOf(resource.data));
  const entries: Record<string, Uint8Array> = {};
  const add = (path: string, content: Uint8Array) => (entries[`${folderName}/${path}`] = content);
  add("package.bluej", strToU8(packageFile(targets)));
  if (project.readme?.trim()) add("README.TXT", strToU8(project.readme));
  for (const { fileName, source } of sources) add(fileName, strToU8(source));
  for (const [path, bytes] of media) add(path, bytes);
  return zipSync(entries) as Uint8Array<ArrayBuffer>;
}
