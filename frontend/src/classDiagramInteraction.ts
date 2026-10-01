import type { ProjectFile } from "../../runtime-contract/src/index";
import type { CardPosition, InheritanceEdge } from "./uiTypes";
import { sourceSuperclass, cardCenter, cardBorderPoint } from "./uiParity";

export interface DiagramInteractionHost {
  files: () => ProjectFile[];
  position: (file: ProjectFile, index: number) => CardPosition;
  raise: (file: ProjectFile) => void;
  move: (id: string, position: CardPosition) => void;
}

export function createDiagramInteraction(host: DiagramInteractionHost) {
  let cardDrag: { id: string; dx: number; dy: number } | null = null;
  const cardGridSize = 20;
  function beginCardDrag(event: MouseEvent | PointerEvent, file: ProjectFile) {
    if (
      event.button !== 0 ||
      ("pointerType" in event && event.pointerType === "touch")
    )
      return;
    const canvas = (event.currentTarget as HTMLElement).closest(".canvas");
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const position = host.position(file, host.files().indexOf(file));
    host.raise(file);
    cardDrag = {
      id: file.id,
      dx: event.clientX - bounds.left - position.x,
      dy: event.clientY - bounds.top - position.y,
    };
    const move = (next: MouseEvent | PointerEvent) => moveCard(next, file);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      endCardDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("mousemove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }
  function moveCard(event: MouseEvent | PointerEvent, file: ProjectFile) {
    if (!cardDrag || cardDrag.id !== file.id) return;
    const canvas = document.querySelector<HTMLElement>(".canvas");
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const maxX = Math.max(
      0,
      Math.floor((bounds.width - 250) / cardGridSize) * cardGridSize,
    );
    const maxY = Math.max(
      0,
      Math.floor((bounds.height - 145) / cardGridSize) * cardGridSize,
    );
    const targetX = event.clientX - bounds.left - cardDrag.dx;
    const targetY = event.clientY - bounds.top - cardDrag.dy;
    host.move(file.id, {
      x: Math.max(
        0,
        Math.min(maxX, Math.round(targetX / cardGridSize) * cardGridSize),
      ),
      y: Math.max(
        0,
        Math.min(maxY, Math.round(targetY / cardGridSize) * cardGridSize),
      ),
    });
  }
  function endCardDrag() {
    cardDrag = null;
  }
  return { beginCardDrag, moveCard, endCardDrag };
}

export function measureInheritanceEdges(
  displayFiles: ProjectFile[],
  cardLayer: (file: ProjectFile, index: number) => number,
  showInheritance: boolean,
): InheritanceEdge[] {
  const canvas = document.querySelector<HTMLElement>(".canvas");
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(".classcard"),
  );
  if (!canvas || !showInheritance) {
    return [];
  }
  const bounds = canvas.getBoundingClientRect();
  const next: InheritanceEdge[] = [];
  displayFiles.forEach((child, index) => {
    const parent = sourceSuperclass(child.source);
    const parentIndex = displayFiles.findIndex(
      (file) => file.fileName.replace(/\.kt$/, "") === parent,
    );
    if (parentIndex < 0 || !elements[index] || !elements[parentIndex]) return;
    const local = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - bounds.left + canvas.scrollLeft,
        top: rect.top - bounds.top + canvas.scrollTop,
        width: rect.width,
        height: rect.height,
      };
    };
    const a = local(elements[index]),
      b = local(elements[parentIndex]),
      ac = cardCenter(a),
      bc = cardCenter(b);
    if (ac.x === bc.x && ac.y === bc.y) return;
    const start = cardBorderPoint(a, ac, bc),
      end = cardBorderPoint(b, bc, ac);
    next.push({
      id: child.id,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      zIndex: Math.max(
        cardLayer(child, index),
        cardLayer(displayFiles[parentIndex], parentIndex),
      ),
    });
  });
  return next;
}
