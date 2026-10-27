import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { HttpError, record } from "./http.mjs";
const standardMedia = JSON.parse(
  readFileSync(new URL("./standard-media.json", import.meta.url), "utf8"),
).sha256;
export const maxProjectBytes = 1024 * 1024;
const fileName = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_.-]+\.kt$/.test(value);
const keys = (value, allowed) =>
  record(value) && Object.keys(value).every((key) => allowed.includes(key));
const optionalText = (value, key) =>
  value[key] === undefined || typeof value[key] === "string";
function validProject(value) {
  return (
    keys(value, [
      "format",
      "version",
      "library",
      "files",
      "resources",
      "cardPositions",
      "readme",
      "projectName",
      "defaultTestClass",
    ]) &&
    value.format === "bluek-project" &&
    value.version === 1 &&
    (value.library === undefined ||
      (keys(value.library, ["id", "version"]) &&
        value.library.id === "blueplay" &&
        value.library.version === 1)) &&
    Array.isArray(value.files) &&
    value.files.every(
      (file) =>
        keys(file, [
          "fileName",
          "path",
          "source",
          "kind",
          "testTarget",
          "isTestClass",
        ]) &&
        fileName(file.fileName) &&
        typeof file.source === "string" &&
        optionalText(file, "path") &&
        (file.testTarget === undefined || fileName(file.testTarget)) &&
        (file.isTestClass === undefined ||
          typeof file.isTestClass === "boolean"),
    ) &&
    new Set(value.files.map((file) => file.fileName)).size ===
      value.files.length &&
    (value.resources === undefined ||
      (Array.isArray(value.resources) &&
        value.resources.every(
          (resource) =>
            keys(resource, ["path", "data"]) &&
            typeof resource.path === "string" &&
            resource.path.length > 0 &&
            !resource.path.startsWith("/") &&
            !resource.path.split("/").includes("..") &&
            typeof resource.data === "string" &&
            /^data:[^;]+;base64,/.test(resource.data),
        ) &&
        new Set(value.resources.map((resource) => resource.path)).size ===
          value.resources.length)) &&
    (value.cardPositions === undefined ||
      (record(value.cardPositions) &&
        Object.entries(value.cardPositions).every(
          ([name, pos]) =>
            fileName(name) &&
            keys(pos, ["x", "y"]) &&
            Number.isFinite(pos.x) &&
            Number.isFinite(pos.y) &&
            pos.x >= 0 &&
            pos.y >= 0,
        ))) &&
    ["readme", "projectName", "defaultTestClass"].every((key) =>
      optionalText(value, key),
    ) &&
    (value.defaultTestClass === undefined ||
      /^[A-Za-z_]\w*$/.test(value.defaultTestClass))
  );
}
export function validateProject(value, publishing = false) {
  if (!validProject(value)) throw new HttpError(400, "invalid-project");
  if (Buffer.byteLength(JSON.stringify(value)) > maxProjectBytes)
    throw new HttpError(413, "too-large");
  // Verified standard copies become library references. This changes only the
  // new public copy, never the local/private original. A filename alone proves nothing.
  if (publishing && value.resources?.length) {
    const custom = value.resources.filter(
      (resource) =>
        value.library?.id !== "blueplay" ||
        !Object.hasOwn(standardMedia, resource.path) ||
        createHash("sha256").update(resource.data).digest("hex") !==
          standardMedia[resource.path],
    );
    if (custom.length)
      throw new HttpError(422, "custom-media", {
        resources: custom.map((resource) => resource.path),
      });
    return { ...value, resources: [] };
  }
  return value;
}
export function validateProgram(value) {
  const booleans = [
    "allowDownload",
    "allowBlueK",
    "showProjectName",
    "autoRun",
    "showControls",
    "showSpeed",
  ];
  if (
    !keys(value, [
      "format",
      "version",
      "project",
      "mainFile",
      "blueKUrl",
      ...booleans,
    ]) ||
    value.format !== "bluek-program" ||
    value.version !== 1 ||
    booleans.some(
      (key) => value[key] !== undefined && typeof value[key] !== "boolean",
    )
  )
    throw new HttpError(400, "invalid-program");
  const project = validateProject(value.project, true);
  if (
    !value.project.files.some((file) => file.fileName === value.mainFile) ||
    typeof value.blueKUrl !== "string" ||
    value.blueKUrl.length > 2048
  )
    throw new HttpError(400, "invalid-program");
  try {
    if (!["http:", "https:"].includes(new URL(value.blueKUrl).protocol))
      throw new Error();
  } catch {
    throw new HttpError(400, "invalid-program");
  }
  if (
    value.project.library?.id === "blueplay" &&
    value.autoRun !== true &&
    value.showControls === false
  )
    throw new HttpError(400, "invalid-program");
  return { ...value, project };
}
