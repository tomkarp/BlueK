import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open, save } from "@tauri-apps/plugin-dialog";

let confirmedClose = false;

export type OpenedDesktopFile = { path: string; contents: string };

export function isDesktopBuild(): boolean {
  return isTauri();
}

export async function chooseDesktopProject(): Promise<OpenedDesktopFile | null> {
  const path = await open({
    title: "Open BlueK project",
    multiple: false,
    filters: [{ name: "BlueK project", extensions: ["bluek", "json"] }],
  });
  if (!path || Array.isArray(path)) return null;
  return { path, contents: await invoke<string>("read_project", { path }) };
}

export async function readDesktopProject(path: string): Promise<OpenedDesktopFile> {
  return { path, contents: await invoke<string>("read_project", { path }) };
}

export async function saveDesktopProject(
  contents: string,
  fileName: string,
  existingPath?: string | null,
): Promise<string | null> {
  const path = existingPath?.toLowerCase().endsWith(".bluek") ? existingPath : await save({
    title: "Save BlueK project",
    defaultPath: fileName,
    filters: [{ name: "BlueK project", extensions: ["bluek"] }],
  });
  if (!path) return null;
  const normalizedPath = path.toLowerCase().endsWith(".bluek") ? path : `${path}.bluek`;
  await invoke("write_project", { path: normalizedPath, contents });
  return normalizedPath;
}

export async function listenForDesktopProject(
  callback: (path: string) => void,
): Promise<() => void> {
  const current = getCurrentWindow();
  return current.listen<{ path: string; windowLabel: string }>(
    "bluek://open-project",
    ({ payload }) => {
      if (payload.windowLabel === current.label) callback(payload.path);
    },
  );
}

export function takeStartupDesktopProject(): Promise<string | null> {
  return invoke<string | null>("take_startup_project");
}

function openDesktopWindow(query: URLSearchParams): Promise<void> {
  const label = `project-${crypto.randomUUID()}`;
  const window = new WebviewWindow(label, {
    url: `index.html?${query.toString()}`,
    title: "BlueK",
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
  });
  return new Promise((resolve, reject) => {
    window.once("tauri://created", () => resolve());
    window.once("tauri://error", (event) => reject(event.payload));
  });
}

export function openNewProjectWindow(template: string): Promise<void> {
  const query = new URLSearchParams({ bluekNewProject: template });
  return openDesktopWindow(query);
}

export function openDesktopProjectWindow(path: string): Promise<void> {
  const query = new URLSearchParams({ bluekOpenProject: path });
  return openDesktopWindow(query);
}

export async function listenForDesktopCloseRequest(
  hasUnsavedChanges: () => boolean,
  requestCloseConfirmation: () => void,
): Promise<() => void> {
  return getCurrentWindow().onCloseRequested((event) => {
    if (confirmedClose) {
      confirmedClose = false;
      return;
    }
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    requestCloseConfirmation();
  });
}

export async function closeDesktopWindow(): Promise<void> {
  confirmedClose = true;
  try {
    await invoke("authorize_window_close_exit");
    await getCurrentWindow().close();
  } catch (error) {
    confirmedClose = false;
    throw error;
  }
}

export async function listenForDesktopExitRequest(
  callback: () => void,
): Promise<() => void> {
  const current = getCurrentWindow();
  return current.listen<string>("bluek://exit-requested", ({ payload }) => {
    if (payload === current.label) callback();
  });
}

export function exitDesktopApplication(): Promise<void> {
  return invoke("exit_application");
}
