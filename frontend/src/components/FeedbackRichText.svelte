<script lang="ts">
  import type { FeedbackAttachment } from "../feedbackApi";

  let {
    value,
    label,
    placeholder,
    rows = 4,
    attachments,
    addAttachments,
    imageSizeLabel,
    imageSizes,
    setAttachmentSize,
    onChange,
  }: {
    value: string;
    label: string;
    placeholder: string;
    rows?: number;
    attachments: FeedbackAttachment[];
    addAttachments: (files: FileList | File[]) => Promise<string[]>;
    imageSizeLabel: (name: string) => string;
    imageSizes: Record<"original" | "large" | "medium" | "small", string>;
    setAttachmentSize: (id: string, size: "original" | "large" | "medium" | "small") => void;
    onChange: (value: string) => void;
  } = $props();
  let editor: HTMLDivElement;
  let renderedValue = "";
  const imagePattern = /\[\[bluek-image:([a-f0-9-]+)\]\]/g;

  function imageNode(attachment: FeedbackAttachment) {
    const wrapper = document.createElement("span");
    wrapper.className = "feedback-inline-image";
    wrapper.contentEditable = "false";
    const image = document.createElement("img");
    image.src = `data:${attachment.type};base64,${attachment.data}`;
    image.alt = attachment.name;
    image.dataset.attachmentId = attachment.id;
    image.dataset.size = attachment.displaySize ?? "medium";
    const size = document.createElement("select");
    size.setAttribute("aria-label", imageSizeLabel(attachment.name));
    size.title = imageSizeLabel(attachment.name);
    for (const key of ["original", "large", "medium", "small"] as const) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = imageSizes[key];
      size.append(option);
    }
    size.value = attachment.displaySize ?? "medium";
    const applySize = () => {
      const selected = size.value as "original" | "large" | "medium" | "small";
      image.dataset.size = selected;
      setAttachmentSize(attachment.id, selected);
    };
    size.addEventListener("input", applySize);
    size.addEventListener("change", applySize);
    wrapper.append(image, size);
    return wrapper;
  }

  function renderValue(source: string) {
    if (!editor) return;
    if (renderedValue === source && editor.childNodes.length) {
      editor.querySelectorAll<HTMLImageElement>("img[data-attachment-id]").forEach((image) => {
        const attachment = attachments.find((item) => item.id === image.dataset.attachmentId);
        image.dataset.size = attachment?.displaySize ?? "medium";
        const size = image.parentElement?.querySelector("select");
        if (size) size.value = attachment?.displaySize ?? "medium";
      });
      return;
    }
    editor.replaceChildren();
    imagePattern.lastIndex = 0;
    let offset = 0;
    for (const match of source.matchAll(imagePattern)) {
      const index = match.index ?? 0;
      editor.append(document.createTextNode(source.slice(offset, index)));
      const attachment = attachments.find((item) => item.id === match[1]);
      if (attachment) {
        editor.append(imageNode(attachment), document.createTextNode("\u00a0"));
      }
      offset = index + match[0].length;
    }
    editor.append(document.createTextNode(source.slice(offset)));
    renderedValue = source;
  }

  function readValue() {
    if (!editor) return "";
    const walk = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
      if (!(node instanceof HTMLElement)) return "";
      if (node.classList.contains("feedback-inline-image")) {
        const id = node.querySelector("img")?.dataset.attachmentId;
        return id ? `[[bluek-image:${id}]]` : "";
      }
      if (node.tagName === "IMG") {
        const id = node.dataset.attachmentId;
        return id ? `[[bluek-image:${id}]]` : "";
      }
      if (node.tagName === "BR") return "\n";
      const content = Array.from(node.childNodes, walk).join("");
      return ["DIV", "P"].includes(node.tagName) ? `${content}\n` : content;
    };
    return Array.from(editor.childNodes, walk).join("").replace(/\n+$/, "");
  }

  function update() {
    const next = readValue();
    renderedValue = next;
    onChange(next);
  }

  function insertImage(id: string) {
    const attachment = attachments.find((item) => item.id === id);
    if (!attachment || !editor) return;
    const wrapper = imageNode(attachment);
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrapper);
      const space = document.createTextNode("\u00a0");
      wrapper.after(space);
      range.setStartAfter(space);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editor.append(wrapper, document.createTextNode("\u00a0"));
    }
    update();
    editor.focus();
  }

  async function paste(event: ClipboardEvent) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const images = Array.from(clipboard.files).filter((file) => file.type.startsWith("image/"));
    if (images.length) {
      event.preventDefault();
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const ids = await addAttachments(images);
      if (range && editor) {
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      ids.forEach((id) => insertImage(id));
      return;
    }
    event.preventDefault();
    document.execCommand("insertText", false, clipboard.getData("text/plain"));
    update();
  }

  $effect(() => {
    value;
    attachments;
    renderValue(value);
  });
</script>

<div
  bind:this={editor}
  class="feedback-rich-text"
  contenteditable="true"
  role="textbox"
  aria-multiline="true"
  aria-label={label}
  data-placeholder={placeholder}
  style={`min-height:${rows * 24}px`}
  oninput={update}
  onpaste={paste}
></div>
