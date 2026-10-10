import type { Diagnostic } from "../../runtime-contract/src/index";
import type { BuildInfo } from "./buildInfo";
import type { SavedProject } from "./projectFormat";

export type FeedbackCategory = "bug" | "kotlin-support";
export type FeedbackContext = {
  diagnostics?: Diagnostic[];
  error?: string;
  code?: string;
};
export type FeedbackReport = {
  format: "bluek-feedback";
  version: 1;
  id: string;
  category: FeedbackCategory;
  summary: string;
  description: string;
  expected: string;
  contact: string;
  build: BuildInfo;
  environment: {
    browser: string;
    language: string;
    mode: "offline" | "web";
    origin: string;
  };
  context: FeedbackContext;
  project?: SavedProject;
};
export type FeedbackReceipt = {
  reference: string;
  issueNumber?: number;
  queued: boolean;
};
export type FeedbackError =
  "unavailable" | "network" | "too-large" | "rate-limit" | "invalid";
export class FeedbackRequestError extends Error {
  constructor(readonly reason: FeedbackError) {
    super(reason);
  }
}
export const maxFeedbackBytes = 10 * 1024 * 1024;

// Pages and the downloaded app use the same private-report service. A dev
// server uses Vite's existing API proxy; no credential is bundled here.
function feedbackUrl(path: string) {
  const origin = window.location.origin;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    window.location.hostname,
  );
  const ownHost = ["bluek.de", "beta.bluek.de"].includes(
    window.location.hostname,
  );
  return new URL(
    path,
    (local || ownHost) && origin !== "null" ? origin : "https://bluek.de",
  ).toString();
}
export async function feedbackAvailable(): Promise<boolean> {
  try {
    const response = await fetch(feedbackUrl("/api/feedback/config"), {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return response.ok && (await response.json()).available === true;
  } catch {
    return false;
  }
}
export async function sendFeedback(
  report: FeedbackReport,
): Promise<FeedbackReceipt> {
  const body = JSON.stringify(report);
  if (new Blob([body]).size > maxFeedbackBytes)
    throw new FeedbackRequestError("too-large");
  let response: Response;
  try {
    response = await fetch(feedbackUrl("/api/feedback"), {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new FeedbackRequestError("network");
  }
  if (!response.ok)
    throw new FeedbackRequestError(
      response.status === 413
        ? "too-large"
        : response.status === 429
          ? "rate-limit"
          : response.status === 400 || response.status === 409
            ? "invalid"
            : "unavailable",
    );
  let receipt = await response.json();
  if (
    receipt.reference !== report.id ||
    typeof receipt.queued !== "boolean" ||
    (!receipt.queued &&
      (!Number.isInteger(receipt.issueNumber) || receipt.issueNumber < 1))
  )
    throw new FeedbackRequestError("network");
  // Acceptance is durable. Briefly wait for the private issue number; a
  // failed status request must not turn an accepted report into a send error.
  for (let attempt = 0; receipt.queued && attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const status = await fetch(feedbackUrl(`/api/feedback/${report.id}`), {
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (!status.ok) break;
      const updated = await status.json();
      if (
        updated.reference !== report.id ||
        typeof updated.queued !== "boolean" ||
        (!updated.queued &&
          (!Number.isInteger(updated.issueNumber) || updated.issueNumber < 1))
      )
        break;
      receipt = updated;
    } catch {
      break;
    }
  }
  return receipt;
}
