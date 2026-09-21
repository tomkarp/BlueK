import type { ProjectResource } from "../../runtime-contract/src/index";
import { STANDARD_IMAGES } from "./standardImages.generated";

/**
 * The graphics BlueK ships with, mirroring BluePlay's `images/` folder.
 * They are available in every project without being stored in it, so a project
 * file stays small and a shared link carries no copies. A project resource with
 * the same path wins, which is how a student replaces one with their own file.
 *
 * The list and the pixel masks are generated into the bundle
 * (`scripts/build-standard-images.mjs`): they are ready before the first
 * compile, without a network round trip and without decoding an image first.
 */
export const standardImages: ProjectResource[] = STANDARD_IMAGES;

/** Project resources win over a standard graphic with the same path. */
export function withStandardImages(
  projectResources: ProjectResource[],
  standard: ProjectResource[] = standardImages,
): ProjectResource[] {
  const taken = new Set(projectResources.map((resource) => resource.path));
  return [...standard.filter((resource) => !taken.has(resource.path)), ...projectResources];
}
