import { loadEditableProjectFromServer, saveProjectToServer } from "./shareApi";
import {
  blueJProjectFromEntries,
  entriesFromZip,
  type ImportEntry,
} from "./blueJImport";
import type { SavedProject as ProjectSource } from "./projectFormat";
import type { ShareLinkDialog } from "./uiTypes";
import { shortShareUrl } from "./shareLinks";

export function downloadFile(
  content: string | Uint8Array<ArrayBuffer>,
  type: string,
  fileName: string,
) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
// Reads a dropped directory recursively through the File System Entries API.
export async function droppedDirectoryEntries(
  directory: FileSystemDirectoryEntry,
): Promise<ImportEntry[]> {
  const children: FileSystemEntry[] = [];
  const reader = directory.createReader();
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (!batch.length) break;
    children.push(...batch);
  }
  const nested = await Promise.all(
    children.map(async (child) => {
      if (child.isDirectory)
        return droppedDirectoryEntries(child as FileSystemDirectoryEntry);
      const file = await new Promise<File>((resolve, reject) =>
        (child as FileSystemFileEntry).file(resolve, reject),
      );
      return [
        {
          path: child.fullPath,
          bytes: new Uint8Array(await file.arrayBuffer()),
        },
      ];
    }),
  );
  return nested.flat();
}

export async function copyLink(
  url: string,
  promptLabel = "Copy this project link:",
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    window.prompt(promptLabel, url);
    return false;
  }
}

export async function saveShortProjectLink(
  payload: ProjectSource,
  readme: boolean,
  state: boolean,
  promptLabel = "Copy this project link:",
): Promise<ShareLinkDialog> {
  const { code, expiresInDays } = await saveProjectToServer(payload);
  const url = shortShareUrl(
    "bluek",
    code,
    import.meta.env.BASE_URL,
    window.location.href,
  );
  if (readme) url.searchParams.set("readme", "1");
  if (state) url.searchParams.set("state", "1");
  return {
    url: url.href,
    code,
    copied: await copyLink(url.href, promptLabel),
    expiresInDays,
  };
}

export function normalizeSharedProjectCode(input: string): string {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const queryCode =
        url.searchParams.get("p") ?? url.searchParams.get("run");
      if (queryCode) value = queryCode;
      else {
        const pathCode = url.pathname.match(
          /(?:^|\/)(?:BlueK\/)?(?:bluek|run|load)\/([^/]+)\/?$/i,
        )?.[1];
        if (pathCode) value = pathCode;
      }
    } catch {
      // Keep the original text so the regular validation below reports an error.
    }
  }
  const lower = value.toLowerCase();
  const compact = lower.replace(/[\s-]+/g, "");
  if (/^[a-z0-9]{12}$/.test(compact)) return compact;
  return lower.replace(/\s+/g, "-");
}

export async function readSharedProject(code: string): Promise<unknown> {
  const normalized = normalizeSharedProjectCode(code);
  if (!/^(?:[a-z0-9]{12}|(?:[a-z]{4,6}-){2,3}[a-z]{4,6})$/.test(normalized))
    throw new Error("Enter a 12-character code or an existing word code.");
  return loadEditableProjectFromServer(normalized);
}

export async function readProjectFile(file: File): Promise<unknown> {
  if (/\.zip$/i.test(file.name))
    return blueJProjectFromEntries(
      entriesFromZip(new Uint8Array(await file.arrayBuffer())),
    );
  return JSON.parse(await file.text());
}
