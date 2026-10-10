import { bluekBuild } from "../buildInfo";
import {
  feedbackAvailable,
  sendFeedback,
  FeedbackRequestError,
  maxFeedbackBytes,
  type FeedbackReport,
  type FeedbackCategory,
  type FeedbackContext,
  type FeedbackReceipt,
  type FeedbackError,
} from "../feedbackApi";
import type { SavedProject } from "../projectFormat";

type FeedbackHost = {
  project: () => SavedProject;
  context: () => FeedbackContext;
  language: () => string;
};

/** Owns a report draft, never runtime state. A snapshot is captured on opening;
 * project data is sent only after explicit opt-in and submitting the form. */
export class FeedbackWorkspace {
  open = $state(false);
  category = $state<FeedbackCategory>("bug");
  summary = $state("");
  description = $state("");
  expected = $state("");
  contact = $state("");
  includeProject = $state(false);
  context = $state<FeedbackContext>({});
  environment: FeedbackReport["environment"] = $state({
    browser: "",
    language: "",
    mode: "web",
    origin: "",
  });
  projectSnapshot: SavedProject | undefined = $state.raw();
  checking = $state(false);
  available = $state(false);
  sending = $state(false);
  error: FeedbackError | "" = $state("");
  receipt: FeedbackReceipt | null = $state(null);
  private requestId = "";
  private requestContent = "";
  readonly build = bluekBuild;
  constructor(private host: FeedbackHost) {}

  show = (context?: FeedbackContext) => {
    // Keep an unfinished draft when the dialog is closed and reopened.
    if (!this.requestId || this.receipt) {
      this.summary = "";
      this.description = "";
      this.expected = "";
      this.contact = "";
      this.includeProject = false;
      this.category = "bug";
      this.error = "";
      this.receipt = null;
      // Project fields may be Svelte proxies. JSON is also the wire format.
      this.projectSnapshot = JSON.parse(JSON.stringify(this.host.project()));
      this.context = this.captureContext(context || this.host.context());
      this.environment = {
        browser: navigator.userAgent,
        language: this.host.language(),
        mode: import.meta.env.VITE_BLUEK_OFFLINE === "1" ? "offline" : "web",
        origin:
          window.location.origin === "null"
            ? "file://"
            : window.location.origin,
      };
      this.requestId = crypto.randomUUID();
      this.requestContent = "";
    } else if (context) this.context = this.captureContext(context);
    this.open = true;
    void this.checkAvailability();
  };
  private captureContext(context: FeedbackContext): FeedbackContext {
    return {
      ...(context.error ? { error: context.error.slice(0, 20000) } : {}),
      ...(context.code ? { code: context.code.slice(0, 20000) } : {}),
      ...(context.diagnostics?.length
        ? {
            diagnostics: context.diagnostics
              .slice(0, 100)
              .map((diagnostic) => ({
                ...diagnostic,
                message: diagnostic.message.slice(0, 10000),
              })),
          }
        : {}),
    };
  }
  close = () => {
    if (!this.sending) this.open = false;
  };
  checkAvailability = async () => {
    this.checking = true;
    this.available = await feedbackAvailable();
    this.checking = false;
  };
  report = (): FeedbackReport => ({
    format: "bluek-feedback",
    version: 1,
    id: this.requestId,
    category: this.category,
    summary: this.summary.trim(),
    description: this.description.trim(),
    expected: this.expected.trim(),
    contact: this.contact.trim(),
    build: this.build,
    environment: this.environment,
    context: this.context,
    ...(this.includeProject && this.projectSnapshot
      ? { project: this.projectSnapshot }
      : {}),
  });
  get preview() {
    return JSON.stringify(this.report(), null, 2);
  }
  get tooLarge() {
    return new Blob([JSON.stringify(this.report())]).size > maxFeedbackBytes;
  }
  get valid() {
    return this.summary.trim().length > 0 && this.description.trim().length > 0;
  }
  send = async () => {
    if (!this.valid || this.sending || this.receipt) return;
    this.error = "";
    const report = this.report();
    const content = JSON.stringify({ ...report, id: "" });
    // Retrying an identical submission reuses the receipt, even if the first
    // HTTP response was lost. Edited reports receive a new id.
    if (this.requestContent && this.requestContent !== content)
      report.id = this.requestId = crypto.randomUUID();
    this.requestContent = content;
    this.sending = true;
    try {
      this.receipt = await sendFeedback(report);
    } catch (error) {
      this.error =
        error instanceof FeedbackRequestError ? error.reason : "network";
    } finally {
      this.sending = false;
    }
  };
}
