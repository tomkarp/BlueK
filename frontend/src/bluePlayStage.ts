import type { BluePlayActorFrame, BluePlayImageFrame, BluePlayStage, ProjectResource } from "../../runtime-contract/src/index";
import { drawnImageDataUrl } from "./uiParity";

/**
 * Drawing, pointer targeting, key names and sound for a published BluePlay
 * frame. The runtime session owns world state; this module only derives what a
 * canvas shows from the latest `BluePlayStage` and the project resources, so the
 * IDE and an exported player render the same frame the same way.
 */

export type ImageSizes = Record<string, { width: number; height: number }>;
/** An image of a frame with its effective size and drawable data. */
export type StageImage = BluePlayImageFrame & { data?: string };
export type StageFrame = Omit<BluePlayStage, "images"> & { images: StageImage[] };
export interface StagePointer { x: number; y: number; actorId?: string }

export function resourceData(resources: ProjectResource[], path: string | undefined) {
  if (!path) return undefined;
  return resources.find((item) => item.path === path || item.path.endsWith(`/${path}`))?.data;
}

/** Natural sizes of the image resources; standard images already carry theirs. */
export async function measureImageSizes(resources: ProjectResource[]): Promise<ImageSizes> {
  const entries = await Promise.all(
    resources
      .filter((item) => item.path.startsWith("images/"))
      .map((item) =>
        item.imageWidth && item.imageHeight
          ? Promise.resolve<[string, { width: number; height: number }] | null>([
              item.path,
              { width: item.imageWidth, height: item.imageHeight },
            ])
          : new Promise<[string, { width: number; height: number }] | null>((resolve) => {
              const image = new Image();
              image.onload = () => resolve([item.path, { width: image.naturalWidth, height: image.naturalHeight }]);
              image.onerror = () => resolve(null);
              image.src = item.data;
            }),
      ),
  );
  return Object.fromEntries(
    entries.filter((entry): entry is [string, { width: number; height: number }] => Boolean(entry)),
  );
}

/**
 * Data URLs of drawn images by content, per resource list. A frame repeats a
 * few distinct images (e.g. every laser looks the same) on every frame.
 */
const drawnImages = new WeakMap<ProjectResource[], Map<string, string | undefined>>();
const DRAWN_IMAGE_LIMIT = 512;

function drawnImage(operations: string[], width: number, height: number, resources: ProjectResource[], path: string | undefined) {
  let cache = drawnImages.get(resources);
  if (!cache) drawnImages.set(resources, (cache = new Map()));
  const key = `${width}\u0000${height}\u0000${path ?? ""}\u0000${operations.join("\u0000")}`;
  if (cache.has(key)) return cache.get(key);
  const data = drawnImageDataUrl(operations, width, height, resources, path);
  // Images drawn anew each step (e.g. a score) must not accumulate.
  if (cache.size >= DRAWN_IMAGE_LIMIT) cache.clear();
  cache.set(key, data);
  return data;
}

/**
 * Resolves each distinct image of a frame to drawable data and its effective
 * size. A decorated frame can be decorated again, e.g. once sizes are known.
 */
export function decorateStage(value: BluePlayStage | StageFrame, resources: ProjectResource[], sizes: ImageSizes): StageFrame {
  return { ...value, images: (value.images || []).map((image) => decorateImage(image, resources, sizes)) };
}

function decorateImage(image: BluePlayImageFrame, resources: ProjectResource[], sizes: ImageSizes): StageImage {
  const path = image.resourcePath || undefined;
  const resource = path
    ? resources.find((item) => item.path === `images/${path}` || item.path.endsWith(`/images/${path}`))
    : undefined;
  const size = resource ? sizes[resource.path] : undefined;
  const width = image.width || size?.width || 30,
    height = image.height || size?.height || 30;
  return { ...image, width, height, opacity: image.opacity ?? 1, data: drawnImage(image.operations || [], width, height, resources, path) };
}

export function stageStyle(value: Pick<BluePlayStage, "width" | "height" | "cellSize" | "backgroundColor">) {
  const width = Math.max(1, (value.width || 1) * (value.cellSize || 1));
  const height = Math.max(1, (value.height || 1) * (value.cellSize || 1));
  return `--bluek-world-width:${width}px;--bluek-world-height:${height}px;aspect-ratio:${width}/${height};background-color:${value.backgroundColor || "#fff"}`;
}

/** The key name BluePlay's `isKeyDown` expects for a DOM `KeyboardEvent.key`. */
export function stageKeyName(key: string) {
  return (
    ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", " ": "space" } as Record<string, string>)[key] ||
    key.toLowerCase()
  );
}

const IMAGE_CACHE_LIMIT = 512;

/**
 * Owns the decoded images and alpha masks of one canvas. `onImageLoad` asks the
 * owner for another draw once an image finished decoding.
 */
export class StageRenderer {
  private images = new Map<string, HTMLImageElement>();
  private alphaMasks = new Map<string, { width: number; height: number; alpha: Uint8ClampedArray }>();

  constructor(private readonly onImageLoad: () => void) {}

  private image(data: string) {
    let image = this.images.get(data);
    if (!image) {
      // Images drawn anew each step must not accumulate; decoded ones are reloaded on demand.
      if (this.images.size >= IMAGE_CACHE_LIMIT) {
        this.images.clear();
        this.alphaMasks.clear();
      }
      image = new Image();
      image.onload = () => this.onImageLoad();
      image.src = data;
      this.images.set(data, image);
    }
    return image;
  }

  private alphaMask(data: string) {
    const cached = this.alphaMasks.get(data);
    if (cached) return cached;
    const image = this.image(data);
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) return undefined;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return undefined;
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
      for (let source = 3, target = 0; source < rgba.length; source += 4, target += 1) alpha[target] = rgba[source];
      const mask = { width: canvas.width, height: canvas.height, alpha };
      this.alphaMasks.set(data, mask);
      return mask;
    } catch {
      return undefined;
    }
  }

  private containsVisiblePixel(object: BluePlayActorFrame, image: StageImage | undefined, worldX: number, worldY: number, cellSize: number) {
    const width = Math.max(1, Number(image?.width || 30));
    const height = Math.max(1, Number(image?.height || 30));
    const opacity = Math.max(0, Math.min(1, Number(image?.opacity ?? 1)));
    if (opacity * 255 <= 16) return false;
    const centerX = (Number(object.x || 0) + 0.5) * cellSize;
    const centerY = (Number(object.y || 0) + 0.5) * cellSize;
    const radians = (Number(object.rotation || 0) * Math.PI) / 180;
    const cosine = Math.cos(radians), sine = Math.sin(radians);
    const deltaX = worldX - centerX, deltaY = worldY - centerY;
    const localX = cosine * deltaX + sine * deltaY + width / 2;
    const localY = -sine * deltaX + cosine * deltaY + height / 2;
    if (localX < 0 || localY < 0 || localX >= width || localY >= height) return false;
    const imageData = image?.data;
    if (!imageData) return true;
    const mask = this.alphaMask(imageData);
    if (!mask) return false;
    const sourceX = Math.min(mask.width - 1, Math.floor((localX / width) * mask.width));
    const sourceY = Math.min(mask.height - 1, Math.floor((localY / height) * mask.height));
    return mask.alpha[sourceY * mask.width + sourceX] * opacity > 16;
  }

  /** Maps a client position inside `bounds` to a world cell and the topmost visible actor there. */
  pointer(stage: StageFrame, bounds: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number): StagePointer {
    const cellSize = stage.cellSize || 1;
    const worldPixelX = ((clientX - bounds.left) / Math.max(bounds.width, 1)) * (stage.width || 1) * cellSize;
    const worldPixelY = ((clientY - bounds.top) / Math.max(bounds.height, 1)) * (stage.height || 1) * cellSize;
    const x = Math.max(0, Math.min((stage.width || 1) - 1, Math.floor(worldPixelX / Math.max(cellSize, 1))));
    const y = Math.max(0, Math.min((stage.height || 1) - 1, Math.floor(worldPixelY / Math.max(cellSize, 1))));
    const actor = [...(stage.objects || [])].reverse()
      .find((object) => this.containsVisiblePixel(object, stage.images[object.image], worldPixelX, worldPixelY, cellSize));
    return { x, y, actorId: actor?.hitId };
  }

  draw(canvas: HTMLCanvasElement, value: StageFrame, resources: ProjectResource[], pixelRatio = 1) {
    const logicalWidth = Math.max(1, (value.width || 1) * (value.cellSize || 1));
    const logicalHeight = Math.max(1, (value.height || 1) * (value.cellSize || 1));
    const ratio = Math.max(1, pixelRatio || 1);
    if (canvas.width !== Math.round(logicalWidth * ratio) || canvas.height !== Math.round(logicalHeight * ratio)) {
      canvas.width = Math.round(logicalWidth * ratio);
      canvas.height = Math.round(logicalHeight * ratio);
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, logicalWidth, logicalHeight);
    context.fillStyle = value.backgroundColor || "#fff";
    context.fillRect(0, 0, logicalWidth, logicalHeight);
    const drawImage = (data: string | undefined, x: number, y: number, width: number, height: number, rotation = 0, opacity = 1) => {
      if (!data) return false;
      const image = this.image(data);
      if (!image.complete || !image.naturalWidth) return false;
      context.save();
      context.globalAlpha = Math.max(0, Math.min(1, opacity));
      context.translate(x + width / 2, y + height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(image, -width / 2, -height / 2, width, height);
      context.restore();
      return true;
    };
    const background = value.background;
    const backgroundWidth = background?.width || logicalWidth, backgroundHeight = background?.height || logicalHeight;
    const backgroundData = background
      ? drawnImage(background.operations || [], backgroundWidth, backgroundHeight, resources, background.resourcePath || undefined)
      : undefined;
    drawImage(backgroundData, 0, 0, backgroundWidth, backgroundHeight, 0, background?.opacity ?? 1);
    (value.objects || []).forEach((object) => {
      const image = value.images[object.image];
      const width = Number(image?.width || 30);
      const height = Number(image?.height || 30);
      const centerX = (Number(object.x || 0) + 0.5) * (value.cellSize || 1);
      const centerY = (Number(object.y || 0) + 0.5) * (value.cellSize || 1);
      if (!drawImage(image?.data, centerX - width / 2, centerY - height / 2, width, height, Number(object.rotation || 0), Number(image?.opacity ?? 1))) {
        context.save();
        context.fillStyle = "#f33142";
        context.strokeStyle = "#111";
        context.lineWidth = 2;
        context.fillRect(centerX - width / 2, centerY - height / 2, width, height);
        context.strokeRect(centerX - width / 2, centerY - height / 2, width, height);
        context.fillStyle = "#fff";
        context.font = "bold 14px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(object.className || "?").slice(0, 1), centerX, centerY);
        context.restore();
      }
    });
    context.save();
    context.font = `${Math.max(12, value.cellSize || 16)}px Arial`;
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    context.strokeStyle = "#000";
    context.lineWidth = 3;
    (value.texts || []).forEach((text) => {
      const x = Number(text.x || 0) * (value.cellSize || 1);
      const y = Number(text.y || 0) * (value.cellSize || 1);
      context.strokeText(String(text.text || ""), x, y);
      context.fillText(String(text.text || ""), x, y);
    });
    context.restore();
  }
}

/** Plays the sounds a frame requests and BlueK's built-in beep. Audio failures never fail a program. */
export class StageAudio {
  private context: AudioContext | null = null;

  beep() {
    try {
      this.context ||= new AudioContext();
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.08, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.15);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + 0.15);
    } catch {
      // Audio is optional.
    }
  }

  playFrameSounds(stage: Pick<BluePlayStage, "sounds">, resources: ProjectResource[]) {
    (stage.sounds || []).forEach((sound) => {
      const data = resourceData(resources, `sounds/${sound}`);
      if (data) new Audio(data).play().catch(() => undefined);
    });
  }
}
