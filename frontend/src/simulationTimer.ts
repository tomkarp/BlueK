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

/**
 * Interval in ms between the starts of two steps at `speed` (1..100). Like
 * Greenfoot the slider works exponentially, so its left half slows down a lot
 * while its right half spans milliseconds; unlike Greenfoot, which ends at no delay, the
 * fastest setting still waits 1 ms. ln(interval) is the parabola through
 * 1 s at speed 1, 30 ms at speed 50 and 1 ms at speed 100.
 */
export function stepInterval(speed: number): number {
  const s = Math.max(1, Math.min(100, speed));
  // Lagrange form of the parabola; ln(1 ms) = 0 drops the third term.
  const slowest = Math.log(1000) * ((s - 50) * (s - 100)) / ((1 - 50) * (1 - 100));
  const middle = Math.log(30) * ((s - 1) * (s - 100)) / ((50 - 1) * (50 - 100));
  return Math.exp(slowest + middle);
}

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
