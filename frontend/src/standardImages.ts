import type { ProjectResource } from "../../runtime-contract/src/index";
import { STANDARD_IMAGES } from "./standardImages.generated";
import { STANDARD_SOUNDS } from "./standardSounds.generated";

/**
 * The graphics and sounds BlueK ships with, mirroring BluePlay's `images/` and
 * `sounds/` folders.
 * They are available in every project without being stored in it, so a project
 * file stays small and a shared link carries no copies. A project resource with
 * the same path wins, which is how a student replaces one with their own file.
 *
 * The lists and the pixel masks are generated into the bundle
 * (`scripts/build-standard-images.mjs`): they are ready before the first
 * compile, without a network round trip and without decoding an image first.
 */
export const standardImages: ProjectResource[] = STANDARD_IMAGES;
export const standardSounds: ProjectResource[] = STANDARD_SOUNDS;
export const standardResources: ProjectResource[] = [...standardImages, ...standardSounds];

/** Project resources win over a standard graphic or sound with the same path. */
export function withStandardResources(
  projectResources: ProjectResource[],
  standard: ProjectResource[] = standardResources,
): ProjectResource[] {
  const taken = new Set(projectResources.map((resource) => resource.path));
  return [...standard.filter((resource) => !taken.has(resource.path)), ...projectResources];
}
