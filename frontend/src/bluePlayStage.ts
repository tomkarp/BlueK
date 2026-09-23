import type { BluePlayActorFrame, BluePlayStage, ProjectResource } from "../../runtime-contract/src/index";
import { backgroundDataUrl, drawnImageDataUrl } from "./uiParity";

/**
 * Drawing, pointer targeting, key names and sound for a published BluePlay
 * frame. The runtime session owns world state; this module only derives what a
 * canvas shows from the latest `BluePlayStage` and the project resources, so the
 * IDE and an exported player render the same frame the same way.
 */

export type ImageSizes = Record<string, { width: number; height: number }>;
export type StageActor = BluePlayActorFrame & { imageData?: string };
export type StageFrame = Omit<BluePlayStage, "objects"> & { objects: StageActor[] };
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

/** Resolves each actor's image to drawable data and its effective size. */
export function decorateStage(value: BluePlayStage, resources: ProjectResource[], sizes: ImageSizes): StageFrame {
  return {
    ...value,
    objects: (value.objects || []).map((object: any) => {
      const rawImage = object.image;
      const image = rawImage && typeof rawImage === "object" ? rawImage : {};
      const imagePath = object.imagePath || image.resourcePath;
      const operations = object.imageOperations || image.operations;
      const resource = imagePath
        ? resources.find((item) => item.path === `images/${imagePath}` || item.path.endsWith(`/images/${imagePath}`))
        : undefined;
      const size = resource ? sizes[resource.path] : undefined;
      const width = size?.width || image.width || object.imageWidth || 30,
        height = size?.height || image.height || object.imageHeight || 30;
      return {
        ...object,
        image: {
          ...image,
          resourcePath: imagePath,
          operations,
          width,
          height,
          opacity: object.imageOpacity ?? image.opacity ?? 1,
        },
        imageData:
          object.imageData ||
          (typeof rawImage === "string" ? rawImage : undefined) ||
          resource?.data ||
          drawnImageDataUrl(operations, width, height, resources),
        imagePath,
        imageOperations: operations,
        imageWidth: width,
        imageHeight: height,
        imageOpacity: object.imageOpacity ?? image.opacity ?? 1,
      };
    }),
  };
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

function canvasDataUrl(value: string | undefined) {
  if (!value) return undefined;
  const match = value.match(/^url\(["']?(.*?)["']?\)$/);
  return match?.[1] || value;
}

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

  private containsVisiblePixel(object: StageActor, worldX: number, worldY: number, cellSize: number) {
    const frame: any = object.image && typeof object.image === "object" ? object.image : {};
    const width = Math.max(1, Number(object.imageWidth || frame.width || 30));
    const height = Math.max(1, Number(object.imageHeight || frame.height || 30));
    const opacity = Math.max(0, Math.min(1, Number(object.imageOpacity ?? frame.opacity ?? 1)));
    if (opacity * 255 <= 16) return false;
    const centerX = (Number(object.x || 0) + 0.5) * cellSize;
    const centerY = (Number(object.y || 0) + 0.5) * cellSize;
    const radians = (Number(object.rotation || 0) * Math.PI) / 180;
    const cosine = Math.cos(radians), sine = Math.sin(radians);
    const deltaX = worldX - centerX, deltaY = worldY - centerY;
    const localX = cosine * deltaX + sine * deltaY + width / 2;
    const localY = -sine * deltaX + cosine * deltaY + height / 2;
    if (localX < 0 || localY < 0 || localX >= width || localY >= height) return false;
    const imageData = object.imageData || (typeof object.image === "string" ? (object.image as string) : undefined);
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
    const actor = [...(stage.objects || [])].reverse().find((object) => this.containsVisiblePixel(object, worldPixelX, worldPixelY, cellSize));
    return { x, y, actorId: actor?.hitId || actor?.objectId };
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
    const backgroundResource = value.backgroundPath ? resourceData(resources, `images/${value.backgroundPath}`) : undefined;
    const backgroundSvg = backgroundDataUrl(value.backgroundOperations || [], logicalWidth, logicalHeight, resources);
    drawImage(backgroundResource || canvasDataUrl(backgroundSvg), 0, 0, logicalWidth, logicalHeight);
    (value.objects || []).forEach((object: any) => {
      const frame = object.image && typeof object.image === "object" ? object.image : {};
      const width = Number(object.imageWidth || frame.width || 30);
      const height = Number(object.imageHeight || frame.height || 30);
      const centerX = (Number(object.x || 0) + 0.5) * (value.cellSize || 1);
      const centerY = (Number(object.y || 0) + 0.5) * (value.cellSize || 1);
      const imageData = object.imageData || (typeof object.image === "string" ? object.image : undefined);
      if (!drawImage(imageData, centerX - width / 2, centerY - height / 2, width, height, Number(object.rotation || 0), Number(object.imageOpacity ?? frame.opacity ?? 1))) {
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
        context.fillText(String(object.className || object.type || "?").slice(0, 1), centerX, centerY);
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
