import { encodeBlueKLink } from "./uiParity";
import { loadProjectFromServer, saveProjectToServer } from "./shareApi";
import {
  blueJProjectFromEntries,
  entriesFromZip,
  type ImportEntry,
} from "./blueJImport";
import type { SavedProject as ProjectSource } from "./projectFormat";
import type { ShareLinkDialog } from "./uiTypes";

export function downloadFile(content: string, type: string, fileName: string) {
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

export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    window.prompt("Copy this project link:", url);
    return false;
  }
}

export async function copyFullProjectLink(
  payload: ProjectSource,
  readme: boolean,
): Promise<boolean> {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = `bluek=${await encodeBlueKLink(payload)}${readme ? "&readme=1" : ""}`;
  return copyLink(url.href);
}

export async function saveShortProjectLink(
  payload: ProjectSource,
  readme: boolean,
): Promise<ShareLinkDialog> {
  const { code } = await saveProjectToServer(payload);
  const url = new URL(
    `/load/${code}${readme ? "?readme=1" : ""}`,
    window.location.origin,
  ).href;
  return { url, code, copied: await copyLink(url) };
}

export async function readSharedProject(code: string): Promise<unknown> {
  const words = code
    .trim()
    .toLowerCase()
    .split(/[-\s]+/)
    .filter(Boolean);
  if (words.length !== 3 || words.some((word) => !/^[a-z]{4,6}$/.test(word))) {
    throw new Error("Enter exactly three words, each 4–6 letters long.");
  }
  return loadProjectFromServer(words.join("-"));
}

export async function readProjectFile(file: File): Promise<unknown> {
  if (/\.zip$/i.test(file.name))
    return blueJProjectFromEntries(
      entriesFromZip(new Uint8Array(await file.arrayBuffer())),
    );
  return JSON.parse(await file.text());
}
