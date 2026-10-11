import playerWorkerSource from "virtual:bluek-player-worker";
import { openPlayer } from "./playerBootstrap";

// Standalone HTML keeps its interpreter/worker inline for file:// use.
const workerUrl = URL.createObjectURL(
  new Blob([playerWorkerSource], { type: "text/javascript" }),
);
void openPlayer(
  document.getElementById("app")!,
  () => new Worker(workerUrl),
  new URL("../", window.location.href).href,
);
