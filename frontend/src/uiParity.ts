import { inflateSync } from "fflate";
import type { ClassMeta } from "../../runtime-contract/src/index";
type ClassModel = ClassMeta;
type ObjectModel = { className: string };
type ResourceModel = { path: string; data: string };

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};
const base64UrlToBytes = (value: string) => {
  const base64 =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
const encodeBlueKLink = async (payload: unknown) => {
  const json = JSON.stringify(payload);
  if (!("CompressionStream" in window))
    return `p1.${bytesToBase64Url(new TextEncoder().encode(json))}`;
  const stream = new Blob([json])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return `d1.${bytesToBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
};
const decodeBlueKLink = async (value: string) => {
  const separator = value.indexOf(".");
  const version = separator < 0 ? "" : value.slice(0, separator);
  const encoded = separator < 0 ? "" : value.slice(separator + 1);
  if (!encoded || !["d1", "p1"].includes(version))
    throw new Error("Invalid BlueK project link.");
  const bytes = base64UrlToBytes(encoded);
  if (version === "p1") return JSON.parse(new TextDecoder().decode(bytes));
  if ("DecompressionStream" in window) {
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(inflateSync(bytes)));
};
const svgEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] || character,
  );
const decodeDrawingText = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
const decodeDrawingValue = (value: string) =>
  decodeDrawingText(value).replace(/\\n/g, "\n").replace(/\\p/g, "|");
const decodeDrawingTransport = (value: string) => {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\" || index + 1 >= value.length) {
      decoded += character;
      continue;
    }
    const escaped = value[++index];
    decoded +=
      escaped === "\\"
        ? "\\"
        : escaped === '"'
          ? '"'
          : escaped === "p"
            ? "|"
            : escaped === "n"
              ? "\n"
              : `\\${escaped}`;
  }
  return decoded;
};
const decodeNestedImage = (value: string) => {
  try {
    return JSON.parse(decodeDrawingTransport(decodeDrawingText(value)));
  } catch {
    return null;
  }
};

const backgroundDataUrl = (
  operations: string[] = [],
  width: number,
  height: number,
  resources: ResourceModel[] = [],
) => {
  if (!operations.length) return undefined;
  const elements = operations
    .map((operation) => {
      const [name, ...parts] = operation.split("|");
      if (name === "drawImage" && parts.length >= 3) {
        const [fileName, x, y, imageWidth = "30", imageHeight = "30"] = parts;
        return renderImageElement(
          fileName,
          x,
          y,
          imageWidth,
          imageHeight,
          resources,
        );
      }
      const paint = parts.at(-1) || "rgb(255, 255, 255)";
      const values = parts.slice(0, -1);
      if (name === "fill")
        return `<rect x="0" y="0" width="${width}" height="${height}" fill="${paint}"/>`;
      if (name === "fillRect" && values.length >= 4)
        return `<rect x="${values[0]}" y="${values[1]}" width="${values[2]}" height="${values[3]}" fill="${paint}"/>`;
      if (name === "drawRect" && values.length >= 4)
        return `<rect x="${values[0]}" y="${values[1]}" width="${values[2]}" height="${values[3]}" fill="none" stroke="${paint}"/>`;
      if (name === "fillOval" && values.length >= 4)
        return `<ellipse cx="${Number(values[0]) + Number(values[2]) / 2}" cy="${Number(values[1]) + Number(values[3]) / 2}" rx="${Number(values[2]) / 2}" ry="${Number(values[3]) / 2}" fill="${paint}"/>`;
      if (name === "drawOval" && values.length >= 4)
        return `<ellipse cx="${Number(values[0]) + Number(values[2]) / 2}" cy="${Number(values[1]) + Number(values[3]) / 2}" rx="${Number(values[2]) / 2}" ry="${Number(values[3]) / 2}" fill="none" stroke="${paint}"/>`;
      if (name === "drawLine" && values.length >= 4)
        return `<line x1="${values[0]}" y1="${values[1]}" x2="${values[2]}" y2="${values[3]}" stroke="${paint}"/>`;
      if (name === "drawString" && values.length >= 3)
        return `<text x="${values[1]}" y="${values[2]}" fill="${paint}">${svgEscape(decodeDrawingValue(values[0]))}</text>`;
      return "";
    })
    .join("");
  if (!elements) return undefined;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements}</svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
};
const drawnImageDataUrl = (
  operations: string[] | null = [],
  width: number,
  height: number,
  resources: ResourceModel[] = [],
): string | undefined => {
  if (operations === null) return undefined;
  if (!operations.length) return emptyImageDataUrl(width, height);
  const elements = operations
    .map((operation) => {
      const [name, ...parts] = operation.split("|");
      if (name === "drawImage" && parts.length >= 3) {
        const [fileName, x, y, imageWidth = "30", imageHeight = "30"] = parts;
        return renderImageElement(
          fileName,
          x,
          y,
          imageWidth,
          imageHeight,
          resources,
        );
      }
      const paint = parts.at(-1) || "rgb(0, 0, 0)";
      const values = parts.slice(0, -1);
      if (name === "fillRect" && values.length >= 4)
        return `<rect x="${values[0]}" y="${values[1]}" width="${values[2]}" height="${values[3]}" fill="${paint}"/>`;
      if (name === "drawRect" && values.length >= 4)
        return `<rect x="${values[0]}" y="${values[1]}" width="${values[2]}" height="${values[3]}" fill="none" stroke="${paint}"/>`;
      if (name === "fillOval" && values.length >= 4)
        return `<ellipse cx="${Number(values[0]) + Number(values[2]) / 2}" cy="${Number(values[1]) + Number(values[3]) / 2}" rx="${Number(values[2]) / 2}" ry="${Number(values[3]) / 2}" fill="${paint}"/>`;
      if (name === "drawOval" && values.length >= 4)
        return `<ellipse cx="${Number(values[0]) + Number(values[2]) / 2}" cy="${Number(values[1]) + Number(values[3]) / 2}" rx="${Number(values[2]) / 2}" ry="${Number(values[3]) / 2}" fill="none" stroke="${paint}"/>`;
      if (name === "drawLine" && values.length >= 4)
        return `<line x1="${values[0]}" y1="${values[1]}" x2="${values[2]}" y2="${values[3]}" stroke="${paint}"/>`;
      if (name === "drawString" && values.length >= 3)
        return `<text x="${values[1]}" y="${values[2]}" fill="${paint}">${svgEscape(decodeDrawingValue(values[0]))}</text>`;
      return "";
    })
    .join("");
  if (!elements) return undefined;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements}</svg>`)}`;
};
const emptyImageDataUrl = (width: number, height: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"/>`)}`;
const renderImageElement = (
  fileName: string,
  x: string,
  y: string,
  imageWidth: string,
  imageHeight: string,
  resources: ResourceModel[],
): string => {
  if (fileName.startsWith("__bluek:")) {
    try {
      const nested = decodeNestedImage(fileName.slice("__bluek:".length));
      if (!nested) return "";
      const href = drawnImageDataUrl(
        nested.operations || [],
        Number(nested.width) || Number(imageWidth) || 1,
        Number(nested.height) || Number(imageHeight) || 1,
        resources,
      );
      return `<image href="${href}" x="${x}" y="${y}" width="${imageWidth}" height="${imageHeight}"/>`;
    } catch {
      return "";
    }
  }
  const resource = resources.find(
    (item) =>
      item.path === `images/${fileName}` ||
      item.path.endsWith(`/images/${fileName}`),
  );
  return resource
    ? `<image href="${resource.data}" x="${x}" y="${y}" width="${imageWidth}" height="${imageHeight}"/>`
    : "";
};

const runtimeClassName = (object: ObjectModel) =>
  object.className.replace(/\s*<.*>$/, "");
const splitTypeArguments = (text: string) => {
  const values: string[] = [];
  let start = 0,
    depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "<") depth += 1;
    else if (text[index] === ">") depth -= 1;
    else if (text[index] === "," && depth === 0) {
      values.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (text.slice(start).trim()) values.push(text.slice(start).trim());
  return values;
};
const typeParameterName = (value: string) =>
  value
    .split(":", 1)[0]
    .trim()
    .replace(/^(in|out)\s+/, "");
const specializeCallable = (
  callable: any,
  object: ObjectModel,
  classes: ClassModel[],
) => {
  const classMeta = classes.find(
    (value) => value.name === runtimeClassName(object),
  );
  const actual = object.className.match(/<(.+)>$/)?.[1];
  if (!classMeta || !actual) return callable;
  const actualArguments = splitTypeArguments(actual);
  const argumentsByName = new Map(
    (classMeta.typeParameters || []).map((name, index) => [
      typeParameterName(name),
      actualArguments[index],
    ]),
  );
  const specialize = (type: any): any => {
    const replacement = argumentsByName.get(type?.classifier);
    if (replacement)
      return {
        ...type,
        classifier: replacement.replace(/\?$/, ""),
        arguments: [],
        nullable: replacement.endsWith("?"),
        displayName: replacement,
      };
    if (!type) return type;
    const argumentsList = (type.arguments || []).map(specialize);
    const projection =
      type.projection === "in" || type.projection === "out"
        ? `${type.projection} `
        : "";
    const displayName = `${projection}${type.classifier}${argumentsList.length ? `<${argumentsList.map((argument: any) => argument.displayName).join(", ")}>` : ""}${type.nullable ? "?" : ""}`;
    return { ...type, arguments: argumentsList, displayName };
  };
  return {
    ...callable,
    parameters: (callable.parameters || []).map((parameter: any) => ({
      ...parameter,
      type: specialize(parameter.type),
    })),
    returnType: specialize(callable.returnType),
  };
};

const sourceSuperclass = (source: string) => {
  const declaration = source.match(
    /\bclass\s+[A-Za-z_]\w*(?:\s*<[^>{}]*>)?(?:\s*\([^{}]*\))?\s*:\s*([^\n{]+)/m,
  );
  if (!declaration) return null;
  const candidates = declaration[1].split(",").map((value) => value.trim());
  return (
    candidates
      .map(
        (value) =>
          value.match(/^([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*(?:\(|$)/)?.[1],
      )
      .find(Boolean) || null
  );
};
const sourceDeclarationName = (source: string) =>
  source.match(/\b(?:class|interface|object)\s+([A-Za-z_]\w*)/)?.[1] || null;
const addSuperclass = (source: string, superclass: string) => {
  if (sourceSuperclass(source) === superclass) return source;
  const declaration =
    /\b((?:(?:public|private|protected|internal|abstract|open|data|sealed|inner|enum|annotation|value)\s+)*class\s+[A-Za-z_]\w*(?:\s*<[^>{}]*>)?(?:\s*\([^{}]*\))?)(?:\s*:\s*([^\n{]+))?(\s*\{)/m;
  return source.replace(
    declaration,
    (_match, header: string, existing: string | undefined, brace: string) => {
      if (existing?.includes(superclass)) return _match;
      const interfaces = existing?.trim();
      return `${header} : ${superclass}()${interfaces ? `, ${interfaces}` : ""}${brace}`;
    },
  );
};
const cardCenter = (bounds: {
  left: number;
  top: number;
  width: number;
  height: number;
}) => ({
  x: bounds.left + bounds.width / 2,
  y: bounds.top + bounds.height / 2,
});
const defaultObjectName = (className: string, usedNames: string[] = []) => {
  const base = className
    .replace(/s*<.*>$/, "")
    .replace(/^./, (letter) => letter.toLowerCase());
  let number = 1;
  while (usedNames.includes(`${base}${number}`)) number += 1;
  return `${base}${number}`;
};
const cardBorderPoint = (
  bounds: { left: number; top: number; width: number; height: number },
  center: { x: number; y: number },
  target: { x: number; y: number },
) => {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const horizontal =
    dx === 0
      ? Number.POSITIVE_INFINITY
      : (dx > 0
          ? bounds.left + bounds.width - center.x
          : bounds.left - center.x) / dx;
  const vertical =
    dy === 0
      ? Number.POSITIVE_INFINITY
      : (dy > 0
          ? bounds.top + bounds.height - center.y
          : bounds.top - center.y) / dy;
  const factor = Math.min(
    horizontal > 0 ? horizontal : Number.POSITIVE_INFINITY,
    vertical > 0 ? vertical : Number.POSITIVE_INFINITY,
  );
  return { x: center.x + dx * factor, y: center.y + dy * factor };
};

export {
  encodeBlueKLink,
  decodeBlueKLink,
  backgroundDataUrl,
  drawnImageDataUrl,
  runtimeClassName,
  specializeCallable,
  sourceDeclarationName,
  sourceSuperclass,
  addSuperclass,
  cardCenter,
  cardBorderPoint,
  defaultObjectName,
};

export function appendTerminal(previous: string, addition: string) {
  const index = addition.lastIndexOf("\u000C");
  return (index >= 0 ? addition.slice(index + 1) : previous + addition).slice(
    -1_000_000,
  );
}

export function terminalParts(value: string) {
  let input = false;
  return value.split(/([\u0001\u0002])/).flatMap((part) => {
    if (part === "\u0001" || part === "\u0002") {
      input = !input;
      return [];
    }
    return part ? [{ text: part, input }] : [];
  });
}

export function codepadResult(value: any) {
  if (!value || value.kind === "unit" || value.kind === "error")
    return undefined;
  const type = value.type?.displayName || value.className || "Any?";
  const raw = String(value.display ?? "null");
  const display =
    type === "String"
      ? JSON.stringify(raw)
      : type === "Char"
        ? `'${raw}'`
        : raw;
  return `${display} : ${type}`;
}

export function codepadError(value: any) {
  return String(value?.display ?? value?.message ?? "Execution failed.")
    .replace(
      /^(?:SemanticException|RuntimeException|EvaluationException):\s*/i,
      "",
    )
    .replace(/\s+at\s+\[<BlueK project>:\d+:\d+\]\s*$/i, "")
    .replace(
      /^(?:Property|Variable) `([^`]+)` has already been declared$/i,
      "Error: $1 is already defined.",
    )
    .trim();
}

export function kotlinCallArguments(parameters: any[] = [], values: string[]) {
  const firstMissing = values.findIndex((value) => !value.trim());
  if (
    firstMissing < 0 ||
    parameters
      .slice(firstMissing)
      .some(
        (parameter, index) =>
          !values[firstMissing + index].trim() && !parameter.hasDefault,
      )
  )
    return values;
  return values
    .map((value, index) =>
      value.trim()
        ? index > firstMissing
          ? `${parameters[index].name} = ${value}`
          : value
        : "",
    )
    .filter(Boolean);
}

export function missingRequired(parameters: any[] = [], values: string[]) {
  return parameters.some(
    (parameter, index) => !parameter.hasDefault && !values[index]?.trim(),
  );
}

export function missingTypeArgument(values: string[]) {
  return values.some((value) => !value.trim());
}

export function codepadIsDisabled(phase: string, inputReady = false) {
  return (
    inputReady ||
    phase === "compiling" ||
    phase === "running" ||
    phase === "waitingForInput" ||
    phase === "faulted"
  );
}
