<script lang="ts">
  import { useLanguage } from "../i18n/Language.svelte";
  const language = useLanguage();
  const t = language.t;
  import type { Action } from "svelte/action";
  import type {
    Diagnostic,
    ProjectFile,
    DebugPause,
  } from "../../../runtime-contract/src/index";

  import type { EditorWindowState, ActiveWindow } from "../uiTypes";
  import type { EditorOptions } from "../editorActions";
  import { isCompileError } from "../compileDiagnostics";
  interface Props {
    editorWindows: EditorWindowState[];
    editorTabbed: boolean;
    editorGroup: EditorWindowState | null;
    files: ProjectFile[];
    activeWindow: ActiveWindow;
    activeEditorId: string;
    diagnosticsByFile: Record<string, Diagnostic[]>;
    diagnosticsRun: number;
    dialogError: string;
    editorFontSize: number;
    vimMode: boolean;
    darkMode: boolean;
    commentShortcutLabel: string;
    formatShortcutLabel: string;
    codeMirror: Action<HTMLElement, EditorOptions>;
    breakpointLines: (fileId: string) => number[];
    toggleBreakpointAt: (fileId: string, line: number) => void;
    updateBreakpoints: (fileId: string, lines: number[]) => void;
    toggleBreakpoint: (editorId: string) => void;
    debug?: DebugPause | undefined;
    editable?: boolean;
    closeEditor: (id?: string) => void;
    closeAllEditors: () => void;
    selectEditorTab: (id: string) => void;
    toggleEditorMaximized: (id: string) => void;
    toggleEditorWorkspaceMaximized: (id: string) => void;
    ungroupEditors: () => void;
    collectEditors: () => void;
    beginEditorDrag: (event: PointerEvent, id: string) => void;
    beginEditorResize: (
      event: PointerEvent,
      id: string,
      direction: string,
    ) => void;
    updateSource: (id: string, value: string) => void;
    resolvePendingClassRenames: () => Promise<void>;
    toggleEditorComments: (id: string) => void;
    formatEditor: (id: string) => void;
    markDiagnostics: (diagnostics: Diagnostic[], reveal?: boolean) => boolean;
    closeFormatError: () => void;
    openFeedback: (context: import("../feedbackApi").FeedbackContext) => void;
  }

  let {
    editorWindows,
    editorTabbed,
    editorGroup,
    files,
    activeWindow = $bindable(),
    activeEditorId = $bindable(),
    diagnosticsByFile,
    diagnosticsRun,
    dialogError,
    editorFontSize,
    vimMode,
    darkMode,
    commentShortcutLabel,
    formatShortcutLabel,
    codeMirror,
    breakpointLines,
    toggleBreakpointAt,
    updateBreakpoints,
    toggleBreakpoint,
    debug = undefined,
    editable = true,
    closeEditor,
    closeAllEditors,
    selectEditorTab,
    toggleEditorMaximized,
    toggleEditorWorkspaceMaximized,
    ungroupEditors,
    collectEditors,
    beginEditorDrag,
    beginEditorResize,
    updateSource,
    resolvePendingClassRenames,
    toggleEditorComments,
    formatEditor,
    markDiagnostics,
    closeFormatError,
    openFeedback,
  }: Props = $props();
  function stopPropagation<E extends Event>(
    handler: (event: E) => unknown,
  ): (event: E) => unknown;
  function stopPropagation(handler: () => unknown): (event: Event) => unknown;
  function stopPropagation(
    handler: ((event: Event) => unknown) | (() => unknown),
  ) {
    return (event: Event) => {
      event.stopPropagation();
      if (handler.length) return (handler as (event: Event) => unknown)(event);
      return (handler as () => unknown)();
    };
  }
  const onlyWarnings = (diagnostics: Diagnostic[] = []) =>
    diagnostics.length > 0 && !diagnostics.some(isCompileError);
  const resolveWhenClickLeavesEditor = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest(".editor-dialog"))
      void resolvePendingClassRenames();
  };
</script>

<svelte:window onpointerdown={resolveWhenClickLeavesEditor} />
{#if editorWindows.length}<div
    class:window-active={activeWindow === "editor"}
    class:workspace-bound={editorTabbed
      ? Boolean(editorGroup?.workspaceMaximized)
      : editorWindows.some((item) => item.workspaceMaximized)}
    class="modal editor-modal"
  >
    {#if editorTabbed && editorGroup}
      {@const editorFile =
        files.find(
          (file) => file.id === activeEditorId.replace(/^editor-/, ""),
        ) || files.find((file) => file.id === editorGroup?.fileId)}
      {#if editorFile}<div
          class:maximized={editorGroup.maximized}
          class:workspace-maximized={editorGroup.workspaceMaximized}
          class:floating={Boolean(editorGroup.position) &&
            !editorGroup.maximized &&
            !editorGroup.workspaceMaximized}
          class="dialog editor-dialog editor-tabbed-dialog"
          role="dialog"
          aria-label={t("ui.editor.editor0", [editorFile.fileName])}
          tabindex="-1"
          style={`${editorGroup.maximized || editorGroup.workspaceMaximized ? "" : `width:${editorGroup.size.width}px;height:${editorGroup.size.height}px;`} ${editorGroup.position && !editorGroup.maximized && !editorGroup.workspaceMaximized ? `left:${editorGroup.position.left}px;top:${editorGroup.position.top}px;` : ""}`}
          onpointerdown={() => {
            activeWindow = "editor";
          }}
          onfocusout={(event) => {
            if (
              !(event.currentTarget as HTMLElement).contains(
                event.relatedTarget as Node | null,
              )
            )
              void resolvePendingClassRenames();
          }}
        >
          <div
            class="editor-header window-header"
            role="toolbar"
            tabindex="0"
            onpointerdown={(event) => {
              activeWindow = "editor";
              beginEditorDrag(event, activeEditorId);
            }}
          >
            <div
              class="editor-tabs"
              role="tablist"
              aria-label={t("ui.editor.openEditorFiles")}
            >
              {#each editorWindows as tabWindow (tabWindow.id)}
                {@const tabFile = files.find(
                  (file) => file.id === tabWindow.fileId,
                )}
                {#if tabFile}<button
                    class:active={tabWindow.id === activeEditorId}
                    role="tab"
                    aria-selected={tabWindow.id === activeEditorId}
                    onclick={() => selectEditorTab(tabWindow.id)}
                    ><span>{tabFile.fileName}</span><span
                      class="editor-tab-close"
                      role="button"
                      tabindex="0"
                      aria-label={t("ui.editor.close0", [tabFile.fileName])}
                      onclick={stopPropagation(() => closeEditor(tabWindow.id))}
                      onkeydown={stopPropagation((event: KeyboardEvent) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          closeEditor(tabWindow.id);
                        }
                      })}>×</span
                    ></button
                  >{/if}
              {/each}
            </div>
            <div class="editor-window-controls">
              <button
                onclick={() => toggleEditorWorkspaceMaximized(activeEditorId)}
                aria-label={editorGroup.workspaceMaximized
                  ? t("ui.editor.restoreEditorWorkspace")
                  : t("ui.editor.maximizeEditorWorkspace")}
                title={editorGroup.workspaceMaximized
                  ? t("ui.editor.restoreEditorWorkspace")
                  : t("ui.editor.maximizeEditorWorkspace")}
                ><svg class="window-icon" viewBox="0 0 24 24" aria-hidden="true"
                  ><path d="M4 19h16M4 5h16M4 5v12M20 5v12" /></svg
                ></button
              >
              <button
                onclick={() => toggleEditorMaximized(activeEditorId)}
                aria-label={editorGroup.maximized
                  ? t("ui.editor.restoreEditorWindow")
                  : t("ui.editor.maximizeEditorWindow")}
                title={editorGroup.maximized
                  ? t("ui.editor.restoreEditorWindow")
                  : t("ui.editor.maximizeEditorWindow")}
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
                onclick={ungroupEditors}
                aria-label={t("ui.editor.ungroupEditorTabs")}
                title={t("ui.editor.ungroupEditorTabs")}
                ><svg class="window-icon" viewBox="0 0 24 24" aria-hidden="true"
                  ><path
                    d="M10 10L3 3M3 9V3h6M14 10l7-7M15 3h6v6M10 14l-7 7M3 15v6h6M14 14l7 7M21 15v6h-6"
                  /></svg
                ></button
              >
              <button
                onclick={closeAllEditors}
                aria-label={t("ui.editor.closeAllEditors")}
                title={t("ui.editor.closeAllEditors")}>×</button
              >
            </div>
          </div>
          <div
            class="svelte-editor-host"
            role="group"
            aria-label={t("ui.editor.codeEditorContent")}
            onpointerdown={() => {
              activeWindow = "editor";
            }}
            onfocusout={(event) => {
              if (
                !(event.currentTarget as HTMLElement).contains(
                  event.relatedTarget as Node | null,
                )
              )
                void resolvePendingClassRenames();
            }}
            use:codeMirror={{
              phrases: $language.editorPhrases,
              id: activeEditorId,
              fileId: editorFile.id,
              value: editorFile.source,
              fontSize: editorFontSize,
              onChange: (value: string) => updateSource(editorFile.id, value),
              diagnostics: diagnosticsByFile[editorFile.fileName] || [],
              diagnosticsRun,
              vim: vimMode,
              dark: darkMode,
              editable,
              breakpointEditable: editable || Boolean(debug),
              breakpointLines: breakpointLines(editorFile.id),
              onBreakpointToggle: toggleBreakpointAt,
              onBreakpointsChange: updateBreakpoints,
              debugLine:
                debug?.fileName === editorFile.fileName ? debug.line : null,
            }}
          >
            <div
              class="editor-actions"
              role="toolbar"
              aria-label={t("ui.common.editorActions")}
            >
              <button
                disabled={!editable && !debug}
                class="editor-action editor-breakpoint"
                onclick={() => toggleBreakpoint(activeEditorId)}
                aria-label={t("ui.editor.toggleBreakpoint")}
                title={t("ui.editor.toggleBreakpoint")}>●</button
              ><button
                disabled={!editable}
                class="editor-action editor-comment"
                onclick={() => toggleEditorComments(activeEditorId)}
                aria-label={t("ui.common.toggleLineComments")}
                title={t("ui.common.commentUncommentLines0", [
                  commentShortcutLabel,
                ])}>//</button
              ><button
                disabled={!editable}
                class="editor-action editor-format"
                onclick={() => formatEditor(activeEditorId)}
                aria-label={t("ui.common.formatKotlinFile")}
                title={t("ui.common.formatKotlinFile0", [formatShortcutLabel])}
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
                ? t("ui.editor.compilerWarnings")
                : t("ui.common.compilerErrors")}
            >
              <span
                >{#each diagnosticsByFile[editorFile.fileName] as diagnostic}<span
                    class="editor-diagnostic"
                    ><strong
                      >{t("ui.editor.line01", [
                        diagnostic.line,
                        isCompileError(diagnostic)
                          ? ""
                          : t("ui.editor.warning"),
                      ])}</strong
                    >
                    {diagnostic.message}</span
                  >{/each}<button
                  class="feedback-inline-button"
                  onclick={() =>
                    openFeedback({
                      diagnostics: diagnosticsByFile[editorFile.fileName],
                    })}>{t("ui.feedback.title")}</button
                ></span
              ><button
                type="button"
                class="dialog-error-close"
                aria-label={onlyWarnings(diagnosticsByFile[editorFile.fileName])
                  ? t("ui.editor.closeCompilerWarnings")
                  : t("ui.editor.closeCompilerErrors")}
                title={onlyWarnings(diagnosticsByFile[editorFile.fileName])
                  ? t("ui.editor.closeCompilerWarnings")
                  : t("ui.editor.closeCompilerErrors")}
                onclick={() => markDiagnostics([])}>×</button
              >
            </div>{/if}
          {#if dialogError}<div
              class="dialog-error editor-dialog-error"
              role="alert"
            >
              <span>{dialogError}</span><button
                type="button"
                class="dialog-error-close"
                aria-label={t("ui.common.closeFormatError")}
                title={t("ui.common.closeFormatError")}
                onclick={closeFormatError}>×</button
              >
            </div>{/if}
          {#if !editorGroup.maximized && !editorGroup.workspaceMaximized}
            {#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as direction}<div
                role="separator"
                aria-label={t("ui.editor.resizeEditor0", [direction])}
                class={`editor-resize-handle editor-resize-${direction}`}
                onpointerdown={(event) => {
                  activeWindow = "editor";
                  beginEditorResize(event, activeEditorId, direction);
                }}
              ></div>{/each}
          {/if}
        </div>{/if}
    {:else}{#each editorWindows as editorWindow (editorWindow.id)}
        {@const editorFile = files.find(
          (file) => file.id === editorWindow.fileId,
        )}
        {#if editorFile}<div
            class:maximized={editorWindow.maximized}
            class:workspace-maximized={editorWindow.workspaceMaximized}
            class:floating={Boolean(editorWindow.position) &&
              !editorWindow.maximized &&
              !editorWindow.workspaceMaximized}
            class:editor-window-active={activeEditorId === editorWindow.id}
            class="dialog editor-dialog"
            role="dialog"
            aria-label={t("ui.editor.editor0", [editorFile.fileName])}
            tabindex="-1"
            style={`${editorWindow.maximized || editorWindow.workspaceMaximized ? "" : `width:${editorWindow.size.width}px;height:${editorWindow.size.height}px;`} ${editorWindow.position && !editorWindow.maximized && !editorWindow.workspaceMaximized ? `left:${editorWindow.position.left}px;top:${editorWindow.position.top}px;` : ""} z-index:${activeEditorId === editorWindow.id ? 2 : 1};`}
            onpointerdown={() => {
              activeWindow = "editor";
              activeEditorId = editorWindow.id;
            }}
          >
            <div
              class="editor-header window-header"
              role="toolbar"
              tabindex="0"
              onpointerdown={(event) => {
                activeWindow = "editor";
                activeEditorId = editorWindow.id;
                beginEditorDrag(event, editorWindow.id);
              }}
            >
              <h3>{editorFile.fileName}</h3>
              <div class="editor-window-controls">
                <button
                  onclick={() =>
                    toggleEditorWorkspaceMaximized(editorWindow.id)}
                  aria-label={editorWindow.workspaceMaximized
                    ? t("ui.editor.restoreEditorWorkspace")
                    : t("ui.editor.maximizeEditorWorkspace")}
                  title={editorWindow.workspaceMaximized
                    ? t("ui.editor.restoreEditorWorkspace")
                    : t("ui.editor.maximizeEditorWorkspace")}
                  ><svg
                    class="window-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    ><path d="M4 19h16M4 5h16M4 5v12M20 5v12" /></svg
                  ></button
                >
                <button
                  onclick={() => toggleEditorMaximized(editorWindow.id)}
                  aria-label={editorWindow.maximized
                    ? t("ui.editor.restoreEditorWindow")
                    : t("ui.editor.maximizeEditorWindow")}
                  title={editorWindow.maximized
                    ? t("ui.editor.restoreEditorWindow")
                    : t("ui.editor.maximizeEditorWindow")}
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
                  onclick={collectEditors}
                  aria-label={t("ui.editor.collectEditorWindowsIntoTabs")}
                  title={t("ui.editor.collectEditorWindowsIntoTabs")}
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
                  onclick={() => closeEditor(editorWindow.id)}
                  aria-label={t("ui.editor.closeEditor")}
                  title={t("ui.editor.closeEditor")}>×</button
                >
              </div>
            </div>
            <div
              class="svelte-editor-host"
              role="group"
              aria-label={t("ui.editor.codeEditorContent")}
              onpointerdown={() => {
                activeWindow = "editor";
                activeEditorId = editorWindow.id;
              }}
              onfocusout={(event) => {
                if (
                  !(event.currentTarget as HTMLElement).contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  void resolvePendingClassRenames();
              }}
              use:codeMirror={{
                phrases: $language.editorPhrases,
                id: editorWindow.id,
                fileId: editorFile.id,
                value: editorFile.source,
                fontSize: editorFontSize,
                onChange: (value: string) => updateSource(editorFile.id, value),
                diagnostics: diagnosticsByFile[editorFile.fileName] || [],
                diagnosticsRun,
                vim: vimMode,
                dark: darkMode,
                editable,
                breakpointEditable: editable || Boolean(debug),
                breakpointLines: breakpointLines(editorFile.id),
                onBreakpointToggle: toggleBreakpointAt,
                onBreakpointsChange: updateBreakpoints,
                debugLine:
                  debug?.fileName === editorFile.fileName ? debug.line : null,
              }}
            >
              <div
                class="editor-actions"
                role="toolbar"
                aria-label={t("ui.common.editorActions")}
              >
                <button
                  disabled={!editable && !debug}
                  class="editor-action editor-breakpoint"
                  onclick={() => toggleBreakpoint(editorWindow.id)}
                  aria-label={t("ui.editor.toggleBreakpoint")}
                  title={t("ui.editor.toggleBreakpoint")}>●</button
                ><button
                  disabled={!editable}
                  class="editor-action editor-comment"
                  onclick={() => toggleEditorComments(editorWindow.id)}
                  aria-label={t("ui.common.toggleLineComments")}
                  title={t("ui.common.commentUncommentLines0", [
                    commentShortcutLabel,
                  ])}>//</button
                ><button
                  disabled={!editable}
                  class="editor-action editor-format"
                  onclick={() => formatEditor(editorWindow.id)}
                  aria-label={t("ui.common.formatKotlinFile")}
                  title={t("ui.common.formatKotlinFile0", [
                    formatShortcutLabel,
                  ])}>≡</button
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
                  ? t("ui.editor.compilerWarnings")
                  : t("ui.common.compilerErrors")}
              >
                <span
                  >{#each diagnosticsByFile[editorFile.fileName] as diagnostic}<span
                      class="editor-diagnostic"
                      ><strong
                        >{t("ui.editor.line01", [
                          diagnostic.line,
                          isCompileError(diagnostic)
                            ? ""
                            : t("ui.editor.warning"),
                        ])}</strong
                      >
                      {diagnostic.message}</span
                    >{/each}<button
                    class="feedback-inline-button"
                    onclick={() =>
                      openFeedback({
                        diagnostics: diagnosticsByFile[editorFile.fileName],
                      })}>{t("ui.feedback.title")}</button
                  ></span
                ><button
                  type="button"
                  class="dialog-error-close"
                  aria-label={onlyWarnings(
                    diagnosticsByFile[editorFile.fileName],
                  )
                    ? t("ui.editor.closeCompilerWarnings")
                    : t("ui.editor.closeCompilerErrors")}
                  title={onlyWarnings(diagnosticsByFile[editorFile.fileName])
                    ? t("ui.editor.closeCompilerWarnings")
                    : t("ui.editor.closeCompilerErrors")}
                  onclick={() => markDiagnostics([])}>×</button
                >
              </div>{/if}
            {#if dialogError}<div
                class="dialog-error editor-dialog-error"
                role="alert"
              >
                <span>{dialogError}</span><button
                  type="button"
                  class="dialog-error-close"
                  aria-label={t("ui.common.closeFormatError")}
                  title={t("ui.common.closeFormatError")}
                  onclick={closeFormatError}>×</button
                >
              </div>{/if}
            {#if !editorWindow.maximized && !editorWindow.workspaceMaximized}
              {#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as direction}<div
                  role="separator"
                  aria-label={t("ui.editor.resizeEditor0", [direction])}
                  class={`editor-resize-handle editor-resize-${direction}`}
                  onpointerdown={(event) => {
                    activeWindow = "editor";
                    activeEditorId = editorWindow.id;
                    beginEditorResize(event, editorWindow.id, direction);
                  }}
                ></div>{/each}
            {/if}
          </div>{/if}
      {/each}{/if}
  </div>{/if}
