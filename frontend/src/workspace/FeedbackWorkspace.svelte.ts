import { bluekBuild } from "../buildInfo";
import {
  feedbackAvailable,
  sendFeedback,
  FeedbackRequestError,
  maxFeedbackBytes,
  maxFeedbackAttachmentBytes,
  maxFeedbackAttachments,
  type FeedbackAttachment,
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
  attachments = $state<FeedbackAttachment[]>([]);
  attachmentError = $state("");
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
    if (this.sending) return;
    // Keep an unfinished draft when the dialog is closed and reopened.
    if (!this.requestId || this.receipt) {
      this.summary = "";
      this.description = "";
      this.expected = "";
      this.contact = "";
      this.attachments = [];
      this.attachmentError = "";
      this.includeProject = false;
      this.category = "bug";
      this.error = "";
      this.receipt = null;
      this.requestId = crypto.randomUUID();
      this.requestContent = "";
    }
    // Keep the user's text, but recapture the complete current project and
    // matching diagnostics on every opening. A cancelled draft may belong to
    // an earlier version of the project or a different project altogether.
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
  addAttachments = async (files: FileList | File[]): Promise<string[]> => {
    this.attachmentError = "";
    const incoming = Array.from(files);
    if (this.attachments.length + incoming.length > maxFeedbackAttachments) {
      this.attachmentError = "count";
      return [];
    }
    const additions: FeedbackAttachment[] = [];
    for (const file of incoming) {
      if (file.size > maxFeedbackAttachmentBytes) {
        this.attachmentError = "size";
        return [];
      }
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (!data) {
        this.attachmentError = "read";
        return [];
      }
      additions.push({
        id: crypto.randomUUID(),
        name: file.name.slice(0, 200) || "attachment",
        type: file.type.slice(0, 200) || "application/octet-stream",
        data,
      });
    }
    this.attachments = [...this.attachments, ...additions];
    if (additions.length && this.tooLarge) {
      this.attachments = this.attachments.slice(0, -additions.length);
      this.attachmentError = "total";
      return [];
    }
    return additions.map(({ id }) => id);
  };
  removeAttachment = (index: number) => {
    const attachment = this.attachments[index];
    if (attachment) {
      const marker = `[[bluek-image:${attachment.id}]]`;
      this.description = this.description.split(marker).join("");
      this.expected = this.expected.split(marker).join("");
    }
    this.attachments = this.attachments.filter((_, i) => i !== index);
    this.attachmentError = "";
  };
  addInlineAttachments = async (files: FileList | File[]) => {
    const ids = await this.addAttachments(files);
    if (ids.length) {
      const inserted = new Set(ids);
      this.attachments = this.attachments.map((attachment) =>
        inserted.has(attachment.id) ? { ...attachment, pasted: true } : attachment,
      );
    }
    return ids;
  };
  removeUnplacedPastedImages = () => {
    const content = `${this.description}\n${this.expected}`;
    this.attachments = this.attachments.filter((attachment) =>
      !attachment.pasted || content.includes(`[[bluek-image:${attachment.id}]]`),
    );
  };
  setAttachmentSize = (id: string, displaySize: "original" | "large" | "medium" | "small") => {
    this.attachments = this.attachments.map((attachment) =>
      attachment.id === id ? { ...attachment, displaySize } : attachment,
    );
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
    attachments: this.attachments,
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
