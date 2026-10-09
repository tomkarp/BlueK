import type { ProjectResource } from "../../runtime-contract/src/index";

export type MediaKind = "sound" | "image";

interface MediaRules {
  folder: string;
  /** Accepted extensions and the media type of their data URL. */
  types: Readonly<Record<string, string>>;
  maxBytes: number;
  /** Largest width and height of an image in pixels. */
  maxSide?: number;
}

/**
 * Files a BluePlay project can add. Projects are saved in browser storage and
 * shared as links, so files stay small.
 *
 * Sounds: WAV keeps projects playable in BlueJ's BluePlay; MP3 is the compact
 * choice for longer sounds. Every current browser decodes both.
 *
 * Images: PNG carries an alpha channel, which collision detection and clicks
 * use pixel by pixel; JPEG suits photos and backgrounds but has no
 * transparency, so it collides as a full rectangle. BlueJ reads both. The alpha
 * mask of every image is sent to the runtime on each compile, which bounds its
 * pixel size.
 */
export const MEDIA: Readonly<Record<MediaKind, MediaRules>> = {
  sound: {
    folder: "sounds",
    types: { wav: "audio/wav", mp3: "audio/mpeg" },
    maxBytes: 1024 * 1024,
  },
  image: {
    folder: "images",
    types: { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" },
    maxBytes: 1024 * 1024,
    maxSide: 2048,
  },
};

/** Extensions of other media files; renaming to one of them would misname the content. */
const OTHER_MEDIA = ["gif", "webp", "svg", "bmp", "avif", "tif", "tiff", "ico", "ogg", "m4a", "aac", "flac", "opus"];

export type MediaProblem = "format" | "size" | "dimensions" | "unreadable";

export const isMediaResource = (kind: MediaKind) => (resource: ProjectResource) =>
  resource.path.startsWith(`${MEDIA[kind].folder}/`);

const extension = (fileName: string) =>
  fileName.includes(".") ? fileName.split(".").at(-1)!.toLowerCase() : "";

/** Approximate stored size of a data URL resource in bytes. */
export const resourceBytes = (resource: ProjectResource) =>
  Math.floor((resource.data.length - resource.data.indexOf(",") - 1) * 0.75);

/** Whether the browser can decode the sound; without Web Audio it is accepted. */
async function decodableSound(bytes: ArrayBuffer) {
  if (typeof OfflineAudioContext === "undefined") return true;
  try {
    await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Natural size of a decodable image, or null. */
function imageSize(data: string) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve(image.naturalWidth && image.naturalHeight ? { width: image.naturalWidth, height: image.naturalHeight } : null);
    image.onerror = () => resolve(null);
    image.src = data;
  });
}

function dataUrl(type: string, bytes: ArrayBuffer) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let index = 0; index < view.length; index += 0x8000)
    binary += String.fromCharCode(...view.subarray(index, index + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

/** Reads a chosen file as a resource of `kind`, or names why it cannot be added. */
export async function readMediaFile(
  kind: MediaKind,
  file: File,
): Promise<ProjectResource | MediaProblem> {
  const rules = MEDIA[kind];
  const type = rules.types[extension(file.name)];
  if (!type) return "format";
  if (file.size > rules.maxBytes) return "size";
  const bytes = await file.arrayBuffer();
  if (kind === "sound" && !(await decodableSound(bytes.slice(0)))) return "unreadable";
  const data = dataUrl(type, bytes);
  if (kind === "image") {
    const size = await imageSize(data);
    if (!size) return "unreadable";
    if (size.width > rules.maxSide! || size.height > rules.maxSide!) return "dimensions";
  }
  return { path: `${rules.folder}/${file.name}`, data };
}

export type RenameProblem = "empty" | "invalid" | "extension" | "taken";

/**
 * The new path for a renamed resource. The file type cannot change, so a name
 * without extension keeps the old one (`.jpg` and `.jpeg` are the same type);
 * a project resource with that name already existing is refused. A standard
 * image or sound may be replaced on purpose.
 */
export function renamedMediaPath(
  kind: MediaKind,
  path: string,
  entered: string,
  projectPaths: readonly string[],
): string | RenameProblem {
  const { folder, types } = MEDIA[kind];
  const name = entered.trim();
  const current = extension(path);
  if (!name) return "empty";
  if (/[/\\]/.test(name) || name.startsWith(".")) return "invalid";
  const given = extension(name);
  const known = given in MEDIA.sound.types || given in MEDIA.image.types || OTHER_MEDIA.includes(given);
  if (known && types[given] !== types[current]) return "extension";
  const fileName = known ? name : `${name}.${current}`;
  const next = `${folder}/${fileName}`;
  if (next !== path && projectPaths.includes(next)) return "taken";
  return next;
}
