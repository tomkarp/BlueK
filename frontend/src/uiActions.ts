import { on } from "svelte/events";
import { tick } from "svelte";

export function focusOnMount(node: HTMLElement, enabled = true) {
  const previous = document.activeElement as HTMLElement | null;
  if (enabled) tick().then(() => node.isConnected && node.focus());
  return {
    destroy() {
      if (document.activeElement === node) previous?.focus();
    },
  };
}
export function containClicks(node: HTMLElement) {
  const stop = (event: MouseEvent) => event.stopPropagation();
  // Dispatch delegated Svelte handlers before containing the click.
  return { destroy: on(node, "click", stop) };
}

export function fitPopup(
  node: HTMLElement,
  coordinates: { x: number; y: number },
) {
  let current = coordinates;
  const fit = () => {
    const rect = node.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(current.x || 8, window.innerWidth - rect.width - 8),
    );
    node.style.top = `${Math.max(8, Math.min(current.y || 8, window.innerHeight - rect.height - 8))}px`;
    node.style.left = `${left}px`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(node);
  window.addEventListener("resize", fit);
  fit();
  return {
    update(next: { x: number; y: number }) {
      current = next;
      fit();
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    },
  };
}
export function fitPopupSubmenu(node: HTMLElement) {
  const panel = node.querySelector<HTMLElement>(".popup-submenu-panel");
  if (!panel) return;
  const trigger = node.getBoundingClientRect();
  const availableBelow = Math.max(0, window.innerHeight - trigger.top - 8);
  const availableAbove = Math.max(0, trigger.bottom - 8);
  const contentHeight = panel.scrollHeight;
  const openUp =
    contentHeight > availableBelow && availableAbove > availableBelow;
  const available = openUp ? availableAbove : availableBelow;
  panel.style.maxHeight = `${Math.max(0, Math.min(contentHeight, window.innerHeight * 0.7, available))}px`;
  panel.style.top = openUp ? "auto" : "-1px";
  panel.style.bottom = openUp ? "-1px" : "auto";
  // The panel is as wide as its longest signature; it opens to the left only
  // when the right side is too narrow and the left side has more room.
  panel.style.maxWidth = "";
  const width = panel.offsetWidth;
  const availableRight = Math.max(0, window.innerWidth - trigger.right - 8);
  const availableLeft = Math.max(0, trigger.left - 8);
  const openLeft = width > availableRight && availableLeft > availableRight;
  panel.style.left = openLeft ? "auto" : "100%";
  panel.style.right = openLeft ? "100%" : "auto";
  panel.style.maxWidth = `${openLeft ? availableLeft : availableRight}px`;
  panel.scrollLeft = 0;
}
