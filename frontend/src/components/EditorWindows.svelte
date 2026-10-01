<script lang="ts">
  import type { Action } from "svelte/action";
  import type {
    Diagnostic,
    ProjectFile,
  } from "../../../runtime-contract/src/index";

  import type { EditorWindowState, ActiveWindow } from "../uiTypes";
  import type { EditorOptions } from "../editorActions";
  import { isCompileError } from "../compileDiagnostics";
  export let editorWindows: EditorWindowState[];
  export let editorTabbed: boolean;
  export let editorGroup: EditorWindowState | null;
  export let files: ProjectFile[];
  export let activeWindow: ActiveWindow;
  export let activeEditorId: string;
  export let diagnosticsByFile: Record<string, Diagnostic[]>;
  export let diagnosticsRun: number;
  export let dialogError: string;
  export let editorFontSize: number;
  export let vimMode: boolean;
  export let darkMode: boolean;
  export let commentShortcutLabel: string;
  export let formatShortcutLabel: string;
  export let codeMirror: Action<HTMLElement, EditorOptions>;
  export let closeEditor: (id?: string) => void;
  export let closeAllEditors: () => void;
  export let selectEditorTab: (id: string) => void;
  export let toggleEditorMaximized: (id: string) => void;
  export let ungroupEditors: () => void;
  export let collectEditors: () => void;
  export let beginEditorDrag: (event: PointerEvent, id: string) => void;
  export let beginEditorResize: (
    event: PointerEvent,
    id: string,
    direction: string,
  ) => void;
  export let updateSource: (id: string, value: string) => void;
  export let toggleEditorComments: (id: string) => void;
  export let formatEditor: (id: string) => void;
  export let markDiagnostics: (
    diagnostics: Diagnostic[],
    reveal?: boolean,
  ) => boolean;
  export let closeFormatError: () => void;
  const onlyWarnings = (diagnostics: Diagnostic[] = []) =>
    diagnostics.length > 0 && !diagnostics.some(isCompileError);
</script>

{#if editorWindows.length}<div
    class:window-active={activeWindow === "editor"}
    class="modal editor-modal"
  >
    {#if editorTabbed && editorGroup}
      {@const editorFile =
        files.find(
          (file) => file.id === activeEditorId.replace(/^editor-/, ""),
        ) || files.find((file) => file.id === editorGroup?.fileId)}
      {#if editorFile}<div
          class:maximized={editorGroup.maximized}
          class:floating={Boolean(editorGroup.position) &&
            !editorGroup.maximized}
          class="dialog editor-dialog editor-tabbed-dialog"
          role="dialog"
          aria-label={`Editor: ${editorFile.fileName}`}
          tabindex="-1"
          style={`${editorGroup.maximized ? "" : `width:${editorGroup.size.width}px;height:${editorGroup.size.height}px;`} ${editorGroup.position && !editorGroup.maximized ? `left:${editorGroup.position.left}px;top:${editorGroup.position.top}px;` : ""}`}
          on:pointerdown={() => {
            activeWindow = "editor";
          }}
        >
          <div
            class="editor-header window-header"
            role="toolbar"
            tabindex="0"
            on:pointerdown={(event) => {
              activeWindow = "editor";
              beginEditorDrag(event, activeEditorId);
            }}
          >
            <div
              class="editor-tabs"
              role="tablist"
              aria-label="Open editor files"
            >
              {#each editorWindows as tabWindow (tabWindow.id)}
                {@const tabFile = files.find(
                  (file) => file.id === tabWindow.fileId,
                )}
                {#if tabFile}<button
                    class:active={tabWindow.id === activeEditorId}
                    role="tab"
                    aria-selected={tabWindow.id === activeEditorId}
                    on:click={() => selectEditorTab(tabWindow.id)}
                    ><span>{tabFile.fileName}</span><span
                      class="editor-tab-close"
                      role="button"
                      tabindex="0"
                      aria-label={`Close ${tabFile.fileName}`}
                      on:click|stopPropagation={() => closeEditor(tabWindow.id)}
                      on:keydown|stopPropagation={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          closeEditor(tabWindow.id);
                        }
                      }}>×</span
                    ></button
                  >{/if}
              {/each}
            </div>
            <div class="editor-window-controls">
              <button
                on:click={() => toggleEditorMaximized(activeEditorId)}
                aria-label={editorGroup.maximized
                  ? "Restore editor window"
                  : "Maximize editor window"}
                title={editorGroup.maximized
                  ? "Restore editor window"
                  : "Maximize editor window"}
                ><svg
                  class="window-control-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  >{#if editorGroup.maximized}<path
                      d="M8 7.5V5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2.5"
                    /><rect
                      x="3.5"
                      y="7.5"
                      width="13"
                      height="13"
                      rx="2.5"
                    />{:else}<rect
                      x="3.5"
                      y="3.5"
                      width="17"
                      height="17"
                      rx="2.5"
                    />{/if}</svg
                ></button
              >
              <button
                on:click={ungroupEditors}
                aria-label="Ungroup editor tabs"
                title="Ungroup editor tabs"
                ><svg class="window-icon" viewBox="0 0 24 24" aria-hidden="true"
                  ><path
                    d="M10 10L3 3M3 9V3h6M14 10l7-7M15 3h6v6M10 14l-7 7M3 15v6h6M14 14l7 7M21 15v6h-6"
                  /></svg
                ></button
              >
              <button
                on:click={closeAllEditors}
                aria-label="Close all editors"
                title="Close all editors">×</button
              >
            </div>
          </div>
          <div
            class="svelte-editor-host"
            role="group"
            aria-label="Code editor content"
            on:pointerdown={() => {
              activeWindow = "editor";
            }}
            use:codeMirror={{
              id: activeEditorId,
              value: editorFile.source,
              fontSize: editorFontSize,
              onChange: (value: string) => updateSource(editorFile.id, value),
              diagnostics: diagnosticsByFile[editorFile.fileName] || [],
              diagnosticsRun,
              vim: vimMode,
              dark: darkMode,
            }}
          >
            <div
              class="editor-actions"
              role="toolbar"
              aria-label="Editor actions"
            >
              <button
                class="editor-action editor-comment"
                on:click={() => toggleEditorComments(activeEditorId)}
                aria-label="Toggle line comments"
                title={`Comment / uncomment lines (${commentShortcutLabel})`}
                >//</button
              ><button
                class="editor-action editor-format"
                on:click={() => formatEditor(activeEditorId)}
                aria-label="Format Kotlin file"
                title={`Format Kotlin file (${formatShortcutLabel})`}>≡</button
              >
            </div>
          </div>
          {#if (diagnosticsByFile[editorFile.fileName] || []).length}<div
              class="dialog-error editor-dialog-error editor-diagnostics"
              class:editor-warnings={onlyWarnings(
                diagnosticsByFile[editorFile.fileName],
              )}
              role="alert"
              aria-label={onlyWarnings(diagnosticsByFile[editorFile.fileName])
                ? "Compiler warnings"
                : "Compiler errors"}
            >
              <span
                >{#each diagnosticsByFile[editorFile.fileName] as diagnostic}<span
                    class="editor-diagnostic"
                    ><strong
                      >Line {diagnostic.line}{isCompileError(diagnostic)
                        ? ""
                        : " (warning)"}:</strong
                    >
                    {diagnostic.message}</span
                  >{/each}</span
              ><button
                type="button"
                class="dialog-error-close"
                aria-label={onlyWarnings(diagnosticsByFile[editorFile.fileName])
                  ? "Close compiler warnings"
                  : "Close compiler errors"}
                title={onlyWarnings(diagnosticsByFile[editorFile.fileName])
                  ? "Close compiler warnings"
                  : "Close compiler errors"}
                on:click={() => markDiagnostics([])}>×</button
              >
            </div>{/if}
          {#if dialogError}<div
              class="dialog-error editor-dialog-error"
              role="alert"
            >
              <span>{dialogError}</span><button
                type="button"
                class="dialog-error-close"
                aria-label="Close format error"
                title="Close format error"
                on:click={closeFormatError}>×</button
              >
            </div>{/if}
          {#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as direction}<div
              role="separator"
              aria-label={`Resize editor ${direction}`}
              class={`editor-resize-handle editor-resize-${direction}`}
              on:pointerdown={(event) => {
                activeWindow = "editor";
                beginEditorResize(event, activeEditorId, direction);
              }}
            ></div>{/each}
        </div>{/if}
    {:else}{#each editorWindows as editorWindow (editorWindow.id)}
        {@const editorFile = files.find(
          (file) => file.id === editorWindow.fileId,
        )}
        {#if editorFile}<div
            class:maximized={editorWindow.maximized}
            class:floating={Boolean(editorWindow.position) &&
              !editorWindow.maximized}
            class:editor-window-active={activeEditorId === editorWindow.id}
            class="dialog editor-dialog"
            role="dialog"
            aria-label={`Editor: ${editorFile.fileName}`}
            tabindex="-1"
            style={`${editorWindow.maximized ? "" : `width:${editorWindow.size.width}px;height:${editorWindow.size.height}px;`} ${editorWindow.position && !editorWindow.maximized ? `left:${editorWindow.position.left}px;top:${editorWindow.position.top}px;` : ""} z-index:${activeEditorId === editorWindow.id ? 2 : 1};`}
            on:pointerdown={() => {
              activeWindow = "editor";
              activeEditorId = editorWindow.id;
            }}
          >
            <div
              class="editor-header window-header"
              role="toolbar"
              tabindex="0"
              on:pointerdown={(event) => {
                activeWindow = "editor";
                activeEditorId = editorWindow.id;
                beginEditorDrag(event, editorWindow.id);
              }}
            >
              <h3>{editorFile.fileName}</h3>
              <div class="editor-window-controls">
                <button
                  on:click={() => toggleEditorMaximized(editorWindow.id)}
                  aria-label={editorWindow.maximized
                    ? "Restore editor window"
                    : "Maximize editor window"}
                  title={editorWindow.maximized
                    ? "Restore editor window"
                    : "Maximize editor window"}
                  ><svg
                    class="window-control-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    >{#if editorWindow.maximized}<path
                        d="M8 7.5V5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2.5"
                      /><rect
                        x="3.5"
                        y="7.5"
                        width="13"
                        height="13"
                        rx="2.5"
                      />{:else}<rect
                        x="3.5"
                        y="3.5"
                        width="17"
                        height="17"
                        rx="2.5"
                      />{/if}</svg
                  ></button
                >
                <button
                  disabled={editorWindows.length < 2}
                  on:click={collectEditors}
                  aria-label="Collect editor windows into tabs"
                  title="Collect editor windows into tabs"
                  ><svg
                    class="window-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    ><path
                      d="M3 3l7 7M10 4v6H4M21 3l-7 7M14 4v6h6M3 21l7-7M4 14h6v6M21 21l-7-7M14 20v-6h6"
                    /></svg
                  ></button
                >
                <button
                  on:click={() => closeEditor(editorWindow.id)}
                  aria-label="Close editor"
                  title="Close editor">×</button
                >
              </div>
            </div>
            <div
              class="svelte-editor-host"
              role="group"
              aria-label="Code editor content"
              on:pointerdown={() => {
                activeWindow = "editor";
                activeEditorId = editorWindow.id;
              }}
              use:codeMirror={{
                id: editorWindow.id,
                value: editorFile.source,
                fontSize: editorFontSize,
                onChange: (value: string) => updateSource(editorFile.id, value),
                diagnostics: diagnosticsByFile[editorFile.fileName] || [],
                diagnosticsRun,
                vim: vimMode,
                dark: darkMode,
              }}
            >
              <div
                class="editor-actions"
                role="toolbar"
                aria-label="Editor actions"
              >
                <button
                  class="editor-action editor-comment"
                  on:click={() => toggleEditorComments(editorWindow.id)}
                  aria-label="Toggle line comments"
                  title={`Comment / uncomment lines (${commentShortcutLabel})`}
                  >//</button
                ><button
                  class="editor-action editor-format"
                  on:click={() => formatEditor(editorWindow.id)}
                  aria-label="Format Kotlin file"
                  title={`Format Kotlin file (${formatShortcutLabel})`}
                  >≡</button
                >
              </div>
            </div>
            {#if (diagnosticsByFile[editorFile.fileName] || []).length}<div
                class="dialog-error editor-dialog-error editor-diagnostics"
                class:editor-warnings={onlyWarnings(
                  diagnosticsByFile[editorFile.fileName],
                )}
                role="alert"
                aria-label={onlyWarnings(diagnosticsByFile[editorFile.fileName])
                  ? "Compiler warnings"
                  : "Compiler errors"}
              >
                <span
                  >{#each diagnosticsByFile[editorFile.fileName] as diagnostic}<span
                      class="editor-diagnostic"
                      ><strong
                        >Line {diagnostic.line}{isCompileError(diagnostic)
                          ? ""
                          : " (warning)"}:</strong
                      >
                      {diagnostic.message}</span
                    >{/each}</span
                ><button
                  type="button"
                  class="dialog-error-close"
                  aria-label={onlyWarnings(
                    diagnosticsByFile[editorFile.fileName],
                  )
                    ? "Close compiler warnings"
                    : "Close compiler errors"}
                  title={onlyWarnings(diagnosticsByFile[editorFile.fileName])
                    ? "Close compiler warnings"
                    : "Close compiler errors"}
                  on:click={() => markDiagnostics([])}>×</button
                >
              </div>{/if}
            {#if dialogError}<div
                class="dialog-error editor-dialog-error"
                role="alert"
              >
                <span>{dialogError}</span><button
                  type="button"
                  class="dialog-error-close"
                  aria-label="Close format error"
                  title="Close format error"
                  on:click={closeFormatError}>×</button
                >
              </div>{/if}
            {#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as direction}<div
                role="separator"
                aria-label={`Resize editor ${direction}`}
                class={`editor-resize-handle editor-resize-${direction}`}
                on:pointerdown={(event) => {
                  activeWindow = "editor";
                  activeEditorId = editorWindow.id;
                  beginEditorResize(event, editorWindow.id, direction);
                }}
              ></div>{/each}
          </div>{/if}
      {/each}{/if}
  </div>{/if}
