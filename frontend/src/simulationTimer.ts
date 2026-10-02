/**
 * Timer for the BluePlay scheduler. The speed sets the interval between
 * steps, so a game runs equally fast with few or many actors as long as the
 * steps fit. Timers alone cannot keep such a pace: they fire late, and nested
 * ones not before 4 ms in browsers. A step therefore waits for the bulk of its
 * delay with a timer and for the rest in event-loop tasks; commands such as key
 * presses and Pause are still handled in between.
 */

/** Waited in event-loop tasks instead of with a timer. */
const TIMER_MARGIN_MS = 4;

type Task = () => void;

/** Runs a task in a new event-loop task without the minimum delay of nested timers. */
const postTask: (task: Task) => void = (() => {
  // Node (tests): setImmediate does not keep a message port open.
  const setImmediate = (globalThis as { setImmediate?: (task: Task) => unknown }).setImmediate;
  if (typeof setImmediate === "function") return (task: Task) => { setImmediate(task); };
  if (typeof MessageChannel === "function") {
    const tasks: Task[] = [];
    const channel = new MessageChannel();
    channel.port1.onmessage = () => tasks.shift()?.();
    return (task: Task) => {
      tasks.push(task);
      channel.port2.postMessage(null);
    };
  }
  return (task: Task) => { setTimeout(task, 0); };
})();

/** Calls `task` after `delay` ms; the returned function cancels it. */
export function scheduleAfter(delay: number, task: Task): () => void {
  const due = performance.now() + delay;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    if (cancelled) return;
    if (performance.now() >= due) task();
    else postTask(check);
  };
  if (delay > TIMER_MARGIN_MS) timer = setTimeout(check, delay - TIMER_MARGIN_MS);
  else postTask(check);
  return () => {
    cancelled = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}
