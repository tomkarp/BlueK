import type { WindowPosition, WindowSize } from "./uiTypes";

export interface WindowFrame {
  position: WindowPosition;
  size: WindowSize;
}
export type DragConstraint = "visible" | "contained" | "minimum";

// Keep the existing window rules: editors/terminal retain a reachable header,
// inspectors stay fully inside the viewport, BluePlay only has a minimum edge.
export function dragPosition(
  bounds: Pick<DOMRect, "width" | "height">,
  point: WindowPosition,
  viewport: WindowSize,
  constraint: DragConstraint,
): WindowPosition {
  const maxLeft =
    constraint === "contained"
      ? viewport.width - bounds.width - 8
      : constraint === "visible"
        ? viewport.width - 220
        : Infinity;
  const maxTop =
    constraint === "contained"
      ? viewport.height - bounds.height - 8
      : constraint === "visible"
        ? viewport.height - 120
        : Infinity;
  return {
    left: Math.max(8, Math.min(maxLeft, point.left)),
    top: Math.max(8, Math.min(maxTop, point.top)),
  };
}

export function resizedFrame(
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">,
  dx: number,
  dy: number,
  direction: string,
): WindowFrame {
  let { left, top, width, height } = bounds;
  if (direction.includes("e")) width = Math.max(420, bounds.width + dx);
  if (direction.includes("s")) height = Math.max(260, bounds.height + dy);
  if (direction.includes("w")) {
    width = Math.max(420, bounds.width - dx);
    left = bounds.left + bounds.width - width;
  }
  if (direction.includes("n")) {
    height = Math.max(260, bounds.height - dy);
    top = bounds.top + bounds.height - height;
  }
  return {
    position: { left: Math.max(8, left), top: Math.max(8, top) },
    size: { width, height },
  };
}

export function trackPointer(
  event: PointerEvent,
  move: (next: PointerEvent) => void,
) {
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  event.preventDefault();
}

export function beginWindowDrag(
  event: PointerEvent,
  selector: string,
  update: (position: WindowPosition) => void,
  constraint: DragConstraint = "visible",
) {
  if (
    event.button !== 0 ||
    (event.target as HTMLElement).closest("button,input")
  )
    return;
  const element = (event.currentTarget as HTMLElement).closest(selector);
  if (!element) return;
  const bounds = element.getBoundingClientRect();
  const offsetX = event.clientX - bounds.left,
    offsetY = event.clientY - bounds.top;
  trackPointer(event, (next) =>
    update(
      dragPosition(
        bounds,
        { left: next.clientX - offsetX, top: next.clientY - offsetY },
        { width: window.innerWidth, height: window.innerHeight },
        constraint,
      ),
    ),
  );
}

export function beginWindowResize(
  event: PointerEvent,
  selector: string,
  direction: string,
  update: (frame: WindowFrame) => void,
) {
  if (event.button !== 0) return;
  const element = (event.currentTarget as HTMLElement).closest(selector);
  if (!element) return;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  const bounds = element.getBoundingClientRect();
  const startX = event.clientX,
    startY = event.clientY;
  trackPointer(event, (next) =>
    update(
      resizedFrame(
        bounds,
        next.clientX - startX,
        next.clientY - startY,
        direction,
      ),
    ),
  );
}
