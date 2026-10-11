import { openPlayer } from "./playerBootstrap";
import { createLocalRuntimeWorker } from "./localRuntimeWorkerFactory";
import { applicationUrl } from "./shareLinks";

void openPlayer(
  document.getElementById("root")!,
  createLocalRuntimeWorker,
  applicationUrl(import.meta.env.BASE_URL, window.location.href).href,
);
