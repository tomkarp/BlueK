import type { ProjectResource } from "../../runtime-contract/src/index";

const cache = new Map<string, Promise<ProjectResource>>();

function encodeAlpha(data: Uint8ClampedArray): string {
  let result = "";
  for (let index = 3; index < data.length; index += 4)
    result += data[index].toString(16).padStart(2, "0");
  return result;
}

async function prepareImageResource(resource: ProjectResource): Promise<ProjectResource> {
  // The graphics BlueK ships with arrive with their mask already generated.
  if (resource.imageWidth && resource.imageHeight && resource.alphaHex) return resource;
  if (!resource.path.startsWith("images/") || typeof Image === "undefined" || typeof document === "undefined")
    return { path: resource.path, data: resource.data };
  const cached = cache.get(resource.data);
  if (cached) return { ...(await cached), path: resource.path };
  const prepared = new Promise<ProjectResource>((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, image.naturalWidth);
        canvas.height = Math.max(1, image.naturalHeight);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas 2D is unavailable.");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        resolve({
          path: resource.path,
          data: resource.data,
          imageWidth: canvas.width,
          imageHeight: canvas.height,
          alphaHex: encodeAlpha(context.getImageData(0, 0, canvas.width, canvas.height).data),
        });
      } catch {
        resolve({ path: resource.path, data: resource.data });
      }
    };
    image.onerror = () => resolve({ path: resource.path, data: resource.data });
    image.src = resource.data;
  });
  cache.set(resource.data, prepared);
  return prepared;
}

export async function prepareRuntimeResources(resources: ProjectResource[]): Promise<ProjectResource[]> {
  return Promise.all(resources.map(prepareImageResource));
}
