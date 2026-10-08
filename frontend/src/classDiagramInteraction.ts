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
  let pointer: { x: number; y: number } | null = null;
  let autoScrollFrame = 0;
  const cardGridSize = 20;
  function beginCardDrag(event: MouseEvent | PointerEvent, file: ProjectFile) {
    if (
      file.testTarget ||
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
      dx: event.clientX - bounds.left + canvas.scrollLeft - position.x,
      dy: event.clientY - bounds.top + canvas.scrollTop - position.y,
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
    pointer = { x: event.clientX, y: event.clientY };
    placeCard(file.id);
    if (autoScrollFrame === 0)
      autoScrollFrame = requestAnimationFrame(() => autoScroll(file));
  }
  // Moving a card back would shrink the scroll area, so the browser clamps
  // scrollLeft/Top and the card jumps further back with it. During a drag the
  // card layer therefore keeps the largest extent the dragged card reached;
  // it shrinks again when the card is dropped.
  function holdScrollExtent(x: number, y: number) {
    const layer = document.querySelector<HTMLElement>(".canvas .cards");
    if (!layer) return;
    const card = layer.querySelector<HTMLElement>(".classcard");
    const width = x + (card?.offsetWidth ?? 0) + cardGridSize;
    const height = y + (card?.offsetHeight ?? 0) + cardGridSize;
    if (width > (parseFloat(layer.style.minWidth) || 0))
      layer.style.minWidth = `${width}px`;
    if (height > (parseFloat(layer.style.minHeight) || 0))
      layer.style.minHeight = `${height}px`;
  }
  function releaseScrollExtent() {
    const layer = document.querySelector<HTMLElement>(".canvas .cards");
    if (!layer) return;
    layer.style.minWidth = "";
    layer.style.minHeight = "";
  }
  function placeCard(id: string) {
    const canvas = document.querySelector<HTMLElement>(".canvas");
    if (!cardDrag || cardDrag.id !== id || !canvas || !pointer) return;
    const bounds = canvas.getBoundingClientRect();
    const targetX = pointer.x - bounds.left + canvas.scrollLeft - cardDrag.dx;
    const targetY = pointer.y - bounds.top + canvas.scrollTop - cardDrag.dy;
    const x = Math.max(0, Math.round(targetX / cardGridSize) * cardGridSize);
    const y = Math.max(0, Math.round(targetY / cardGridSize) * cardGridSize);
    holdScrollExtent(x, y);
    host.move(id, { x, y });
  }
  // Cards may leave the visible area. While the pointer rests near or beyond
  // an edge, the canvas scrolls at a fixed speed per frame (not per mouse
  // event), so the speed does not depend on how fast the mouse moves.
  function autoScroll(file: ProjectFile) {
    autoScrollFrame = 0;
    const canvas = document.querySelector<HTMLElement>(".canvas");
    if (!cardDrag || cardDrag.id !== file.id || !canvas || !pointer) return;
    const bounds = canvas.getBoundingClientRect();
    const dxScroll = scrollSpeed(pointer.x, bounds.left, bounds.right);
    const dyScroll = scrollSpeed(pointer.y, bounds.top, bounds.bottom);
    if (dxScroll === 0 && dyScroll === 0) return;
    canvas.scrollLeft += dxScroll;
    canvas.scrollTop += dyScroll;
    placeCard(file.id);
    autoScrollFrame = requestAnimationFrame(() => autoScroll(file));
  }
  function scrollSpeed(position: number, start: number, end: number) {
    const edge = 32;
    const maxStep = 3;
    if (position > end - edge)
      return Math.min(
        maxStep,
        Math.ceil(((position - (end - edge)) / edge) * maxStep),
      );
    if (position < start + edge)
      return -Math.min(
        maxStep,
        Math.ceil(((start + edge - position) / edge) * maxStep),
      );
    return 0;
  }
  function endCardDrag() {
    cardDrag = null;
    releaseScrollExtent();
    pointer = null;
    if (autoScrollFrame !== 0) cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = 0;
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
      parentId: displayFiles[parentIndex].id,
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
