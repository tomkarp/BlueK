import type {
  ProjectFile,
  CallableMeta,
  ManifestConstructor,
} from "../../runtime-contract/src/index";
import type { InspectionView } from "./inspectorModel";

export type BenchObject = { objectId: string; className: string; name: string };
export type HistoryEntry = {
  code: string;
  result?: string;
  error?: string;
  objectResult?: boolean;
  objectId?: string;
  className?: string;
};
export type WindowPosition = { left: number; top: number };
export type WindowSize = { width: number; height: number };
export type ActiveWindow = "terminal" | "editor" | "inspector" | null;
export type EditorWindowState = {
  id: string;
  fileId: string;
  maximized: boolean;
  position: WindowPosition | null;
  size: WindowSize;
};
export type InspectorWindowView = {
  id: string;
  referenceName: string;
  position: WindowPosition;
  data: InspectionView;
};
export type CreateDialog = {
  className: string;
  constructors: ManifestConstructor[];
  constructorIndex: number;
  typeParameters: string[];
  parameters: ManifestConstructor["parameters"];
};
export type InvokeDialog = {
  object?: BenchObject;
  receiver?: string;
  method: CallableMeta;
};
export type ResultDialog = {
  method: string;
  value: string;
  objectId?: string;
  className?: string;
};
export type ObjectMenu = {
  x: number;
  y: number;
  file?: ProjectFile;
  object?: BenchObject;
};
export type CodepadMenu = { x: number; y: number; text?: string };
export type MainAction = "start" | "reset" | "export";
export type MainDialog = { action: MainAction; generationId: string };
export type ShareLinkDialog = { url: string; code: string; copied: boolean };
export type NewClassType =
  "class" | "interface" | "open" | "abstract" | "data" | "test" | "functions";
export type CardPosition = { x: number; y: number };
export type InheritanceEdge = {
  id: string;
  parentId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  zIndex: number;
};
