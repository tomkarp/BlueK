import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/web/pbkdf2";

self.onmessage = async (event: MessageEvent) => {
  try {
    const solution = await solveChallenge({
      challenge: event.data,
      deriveKey,
      timeout: 180000,
    });
    self.postMessage(solution ? { solution } : { error: true });
  } catch {
    self.postMessage({ error: true });
  }
};
