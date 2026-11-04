import { apiRequest, ApiError } from "./apiClient";
import RegistrationProofWorker from "./registrationProof.worker?worker&inline";

export async function registrationProof(): Promise<unknown> {
  const challenge = await apiRequest<unknown>(
    "/api/account/registration-challenge",
    { method: "POST" },
  );
  const worker = new RegistrationProofWorker();
  try {
    const solution = await new Promise<unknown>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new ApiError("registration-proof")),
        185000,
      );
      worker.onmessage = (
        event: MessageEvent<{ solution?: unknown; error?: boolean }>,
      ) => {
        clearTimeout(timeout);
        if (event.data.error || !event.data.solution)
          reject(new ApiError("registration-proof"));
        else resolve(event.data.solution);
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        reject(new ApiError("registration-proof"));
      };
      worker.postMessage(challenge);
    });
    return { challenge, solution };
  } finally {
    worker.terminate();
  }
}
