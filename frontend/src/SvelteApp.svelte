<script lang="ts">
  import BluePlayWindow from "./components/BluePlayWindow.svelte";
  import TerminalWindow from "./components/TerminalWindow.svelte";
  import EditorWindows from "./components/EditorWindows.svelte";
  import CompilerDialog from "./components/CompilerDialog.svelte";
  import InspectorWindows from "./components/InspectorWindows.svelte";
  import CallDialogs from "./components/CallDialogs.svelte";
  import MainSelectionDialog from "./components/MainSelectionDialog.svelte";
  import NewProjectDialog from "./components/NewProjectDialog.svelte";
  import ReadmeDialog from "./components/ReadmeDialog.svelte";
  import BluePlayApiDialog from "./components/BluePlayApiDialog.svelte";
  import NewClassDialog from "./components/NewClassDialog.svelte";
  import ObjectContextMenu from "./components/ObjectContextMenu.svelte";
  import ProjectTransferDialogs from "./components/ProjectTransferDialogs.svelte";
  import MediaDialogs from "./components/MediaDialogs.svelte";
  import SettingsDialogs from "./components/SettingsDialogs.svelte";
  import ObjectNameDialog from "./components/ObjectNameDialog.svelte";
  import AppToolbar from "./components/AppToolbar.svelte";
  import AppSidebar from "./components/AppSidebar.svelte";
  import ClassDiagram from "./components/ClassDiagram.svelte";
  import ObjectBenchCodepad from "./components/ObjectBenchCodepad.svelte";
  import AppStatusBar from "./components/AppStatusBar.svelte";
  import CodepadContextMenu from "./components/CodepadContextMenu.svelte";
  import { WorkspaceUi } from "./workspace/WorkspaceUi.svelte";
  import { ProjectWorkspace } from "./workspace/ProjectWorkspace.svelte";
  import { EditorWorkspace } from "./workspace/EditorWorkspace.svelte";
  import { ExecutionWorkspace } from "./workspace/ExecutionWorkspace.svelte";
  import { ObjectWorkspace } from "./workspace/ObjectWorkspace.svelte";
  import { BluePlayWorkspace } from "./workspace/BluePlayWorkspace.svelte";
  import { TerminalWorkspace } from "./workspace/TerminalWorkspace.svelte";
  import { onMount, untrack } from "svelte";
  const ui: WorkspaceUi = new WorkspaceUi();
  const project: ProjectWorkspace = new ProjectWorkspace({
    objects: () => objects,
    session: () => session,
    ui: () => ui,
    editor: () => editor,
  });
  const editor: EditorWorkspace = new EditorWorkspace({
    project: () => project,
    ui: () => ui,
    objects: () => objects,
    terminal: () => terminal,
  });
  const session: ExecutionWorkspace = new ExecutionWorkspace({
    play: () => play,
    objects: () => objects,
    ui: () => ui,
    editor: () => editor,
    project: () => project,
    terminal: () => terminal,
  });
  const objects: ObjectWorkspace = new ObjectWorkspace({
    ui: () => ui,
    session: () => session,
    play: () => play,
    editor: () => editor,
    terminal: () => terminal,
  });
  const play: BluePlayWorkspace = new BluePlayWorkspace({
    session: () => session,
    project: () => project,
    ui: () => ui,
  });
  const terminal: TerminalWorkspace = new TerminalWorkspace({
    ui: () => ui,
    session: () => session,
  });
  const offlineBuild = import.meta.env.VITE_BLUEK_OFFLINE === "1";
  const OFFLINE_DOWNLOAD = `${import.meta.env.BASE_URL}downloads/BlueK-offline.zip`;

  // Each controller owns its UI state; runtime data has one client and one snapshot.
  $effect(() =>
    untrack(() => {
      const disconnect = session.connect();
      play.connect();
      terminal.connect();
      const disconnectProject = project.connect();
      return () => {
        disconnectProject();
        disconnect();
      };
    }),
  );
  onMount(() => {
    ui.initializeShortcuts();
    void project.initialize();
    const vimShortcut = (event: KeyboardEvent) => {
      if (
        (event.key.toLowerCase() !== "v" && event.code !== "KeyV") ||
        !event.shiftKey ||
        (!event.metaKey && !event.ctrlKey)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      ui.setVimMode(!ui.vimMode);
    };
    const captureShortcut = (event: KeyboardEvent) => {
      const mod = (event.metaKey || event.ctrlKey) && !event.altKey;
      if (mod && !event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (session.canExecute && session.mainEntries.length)
          void session.runMain();
      } else if (
        mod &&
        (event.key.toLowerCase() === "e" || event.code === "KeyE")
      ) {
        event.preventDefault();
        event.stopPropagation();
        editor.cycleEditor(event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener("keydown", vimShortcut, true);
    window.addEventListener("keydown", captureShortcut, true);
    return () => {
      window.removeEventListener("keydown", vimShortcut, true);
      window.removeEventListener("keydown", captureShortcut, true);
    };
  });
  function escapeWindowAction(): (() => void) | null {
    if (objects.inspectorError)
      return () => {
        objects.inspectorError = null;
      };
    if (session.mainDialog)
      return () => {
        session.mainDialog = null;
      };
    if (project.projectInfo)
      return () => {
        project.projectInfo = null;
      };
    if (project.readmeOpen)
      return () => {
        const content = document.querySelector<HTMLElement>(
          ".readme-editor .cm-content",
        );
        if (project.readmeHelp) project.readmeHelp = false;
        else if (content && document.activeElement === content) content.blur();
        else project.closeReadme();
      };
    if (project.bluePlayApiFile)
      return () => {
        project.bluePlayApiFile = null;
      };
    if (session.compilerDialog)
      return () => {
        session.compilerDialog = false;
      };
    if (objects.createDialog)
      return () => {
        objects.createDialog = null;
        ui.dialogError = "";
      };
    if (objects.invokeDialog)
      return () => {
        objects.invokeDialog = null;
        ui.dialogError = "";
      };
    if (objects.objectNamePrompt)
      return () => {
        objects.objectNamePrompt = null;
      };
    if (objects.resultDialog)
      return () => {
        objects.resultDialog = null;
      };
    if (
      ui.activeWindow === "inspector" &&
      objects.activeInspectorId &&
      objects.inspectorWindows.some(
        (item) => item.id === objects.activeInspectorId,
      )
    )
      return () => objects.closeInspector(objects.activeInspectorId);
    if (project.newClassOpen)
      return () => {
        project.newClassOpen = false;
      };
    if (ui.shortcutsHelpOpen)
      return () => {
        ui.shortcutsHelpOpen = false;
      };
    if (ui.settingsNotice)
      return () => {
        ui.settingsNotice = false;
      };
    if (project.mediaNotice)
      return () => {
        project.mediaNotice = "";
      };
    if (project.imageLibraryOpen)
      return () => {
        project.imageLibraryOpen = false;
      };
    if (project.shareLinkDialog)
      return () => {
        project.shareLinkDialog = null;
      };
    if (project.toolbarDialog)
      return () => {
        project.toolbarDialog = null;
      };
    if (project.newProjectOpen)
      return () => {
        project.newProjectOpen = false;
      };
    if (ui.activeWindow === "editor" && editor.editorWindows.length)
      return editor.closeEditor;
    if (terminal.terminalOpen)
      return () => {
        terminal.terminalOpen = false;
        terminal.terminalSplit = false;
      };
    if (editor.editorWindows.length) return editor.closeEditor;
    if (play.stageWindowOpen)
      return () => {
        play.stageWindowOpen = false;
        play.stageMaximized = false;
      };
    if (objects.menu)
      return () => {
        objects.menu = null;
      };
    if (session.codepadMenu)
      return () => {
        session.codepadMenu = null;
      };
    return null;
  }
  function handleWindowKeydown(event: KeyboardEvent) {
    const mod =
      (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;
    if (mod && (event.key.toLowerCase() === "k" || event.code === "KeyK")) {
      event.preventDefault();
      event.stopPropagation();
      if (
        project.files.length &&
        session.runtime.phase !== "compiling" &&
        session.runtime.phase !== "running" &&
        !session.inputReady
      )
        session.compile();
      return;
    }
    if (mod && (event.key.toLowerCase() === "s" || event.code === "KeyS")) {
      event.preventDefault();
      event.stopPropagation();
      if (project.files.length) project.toolbarDialog = "save";
      return;
    }
    if (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      event.key === "#"
    ) {
      event.preventDefault();
      event.stopPropagation();
      // Cycles through the terminal's three states: closed -> window -> split -> closed.
      if (!terminal.terminalOpen) {
        terminal.terminalOpen = true;
        terminal.terminalSplit = false;
        ui.activeWindow = "terminal";
      } else if (!terminal.terminalSplit) {
        terminal.toggleTerminalSplit();
      } else {
        terminal.terminalOpen = false;
        terminal.terminalSplit = false;
      }
      return;
    }
    if (event.key === "Escape") {
      const action = escapeWindowAction();
      if (!action) return;
      // With Vim on, a bare Escape is pressed constantly to leave insert
      // mode, so closing the editor window that way needs Shift held too —
      // a plain Escape is left alone here for Vim's own keymap to handle.
      // Everything else Escape closes stays instant, Shift or not.
      if (ui.vimMode && action === editor.closeEditor && !event.shiftKey)
        return;
      action();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      document.activeElement?.classList.contains("game-stage") ||
      play.stageRunning
    )
      play.stageKey(event, true);
  }
</script>

<svelte:window
  bind:innerWidth={ui.viewportWidth}
  on:click={() => {
    objects.menu = null;
    session.codepadMenu = null;
  }}
  on:pointerdown|capture={(event) => {
    // The dialog keeps its own clicks to itself, so the help has to listen
    // before them: a click anywhere else puts it away again.
    if (
      project.readmeHelp &&
      !(event.target as HTMLElement).closest(
        ".readme-help, .readme-help-button",
      )
    )
      project.readmeHelp = false;
  }}
  on:keydown={handleWindowKeydown}
  on:keyup={(event) =>
    (document.activeElement?.classList.contains("game-stage") ||
      play.stageRunning) &&
    play.stageKey(event, false)}
  on:blur={play.releaseStageKeys}
/>

<div
  class:terminal-split={terminal.terminalOpen && terminal.terminalSplit}
  class:bluek-stage-closed={!play.stageWindowOpen}
  class:dark={ui.darkMode}
  class="bluek svelte-preview"
  style={`--editor-font-size:${ui.editorFontSize}px;--terminal-split-width:${terminal.terminalSplitWidth}px;--bluek-stage-height:${play.stageHeight}px;--bluek-stage-window-width:${play.stageWindowWidth}px;${play.stagePosition ? `--bluek-stage-left:${play.stagePosition.left}px;--bluek-stage-top:${play.stagePosition.top}px;` : ""}`}
>
  <BluePlayWindow
    stage={play.stage}
    bind:stageWindowOpen={play.stageWindowOpen}
    bind:stageWindowDismissed={play.stageWindowDismissed}
    bind:stageMaximized={play.stageMaximized}
    bind:stageCanvas={play.stageCanvas}
    bind:speed={play.speed}
    canExecute={session.canExecute}
    stageRunning={play.stageRunning}
    mainEntries={session.mainEntries}
    phase={session.runtime.phase}
    simulation={session.runtime.simulation}
    libraryId={project.library?.id || ""}
    beginStageDrag={play.beginStageDrag}
    stageClick={play.stageClick}
    resetGame={play.resetGame}
    bluePlayAction={play.bluePlayAction}
  />
  <AppToolbar
    bind:newProjectOpen={project.newProjectOpen}
    bind:toolbarDialog={project.toolbarDialog}
    files={project.files}
    libraryId={project.library?.id || ""}
    bind:imageLibraryOpen={project.imageLibraryOpen}
    bind:mediaNotice={project.mediaNotice}
    bind:projectName={project.projectName}
    bind:terminalOpen={terminal.terminalOpen}
    bind:terminalSplit={terminal.terminalSplit}
    bind:activeWindow={ui.activeWindow}
    showInheritance={project.showInheritance}
    bind:settingsNotice={ui.settingsNotice}
    toggleInheritance={project.toggleInheritance}
    commitProjectName={project.commitProjectName}
  />
  <div class="body">
    <AppSidebar
      bind:newClassOpen={project.newClassOpen}
      bind:newClassName={project.newClassName}
      bind:newClassType={project.newClassType}
      bind:inheritanceMode={project.inheritanceMode}
      bind:inheritanceSelection={project.inheritanceSelection}
      bind:status={ui.status}
      displayFiles={project.displayFiles}
      files={project.files}
      phase={session.runtime.phase}
      inputReady={session.inputReady}
      canExecute={session.canExecute}
      mainEntries={session.mainEntries}
      {offlineBuild}
      {OFFLINE_DOWNLOAD}
      bind:shortcutsHelpOpen={ui.shortcutsHelpOpen}
      compileShortcutLabel={ui.compileShortcutLabel}
      runShortcutLabel={ui.runShortcutLabel}
      exportProject={project.exportProject}
      compile={session.compile}
      runMain={session.runMain}
    />
    <section
      class="workspace"
      style={`--pane-split:${ui.paneSplit}%;--upper-pane:${ui.paneSplit}%;${ui.benchWidth ? `--bench-width:${ui.benchWidth}px;` : ""}`}
    >
      <div class="panels">
        <ClassDiagram
          inheritanceMode={project.inheritanceMode}
          inheritanceSelection={project.inheritanceSelection}
          showInheritance={project.showInheritance}
          inheritanceEdges={project.inheritanceEdges}
          hasReadme={Boolean(
            project.files.length ||
            project.resources.length ||
            project.readme.trim(),
          )}
          readme={project.readme}
          displayFiles={project.displayFiles}
          displayCardPositions={project.displayCardPositions}
          uncompiled={session.runtime.phase === "uncompiled"}
          cardLayer={project.cardLayer}
          selectCard={project.selectCard}
          beginCardDrag={project.beginCardDrag}
          moveCard={project.moveCard}
          endCardDrag={project.endCardDrag}
          openEditor={editor.openEditor}
          openMenu={objects.openMenu}
          isBluePlayFrameworkFile={project.isBluePlayFrameworkFile}
          openBluePlayApi={project.openBluePlayApi}
          openReadme={project.openReadme}
        />
      </div>
      <div
        class="pane-splitter"
        role="separator"
        aria-label="Resize upper and lower panes"
        onpointerdown={ui.beginPaneResize}
      ></div>
      <ObjectBenchCodepad
        bind:codepadOpen={session.codepadOpen}
        bench={objects.bench}
        fieldInput={objects.fieldInput}
        bind:selectedObjectId={ui.selectedObjectId}
        history={session.history}
        bind:codepadMenu={session.codepadMenu}
        bind:codepad={session.codepad}
        liveObjectIds={session.runtime.liveObjectIds}
        phase={session.runtime.phase}
        inputReady={session.inputReady}
        insertBenchName={objects.insertBenchName}
        inspectObject={objects.inspectObject}
        openMenu={objects.openMenu}
        beginBenchResize={ui.beginBenchResize}
        requestObjectOnBench={objects.requestObjectOnBench}
        submitCodepad={session.submitCodepad}
      />
      <AppStatusBar
        selectedObjectId={ui.selectedObjectId}
        bench={objects.bench}
        bind:terminalOpen={terminal.terminalOpen}
        terminal={terminal.terminal}
        inputReady={session.inputReady}
        bind:activeWindow={ui.activeWindow}
        programActive={session.programActive}
        phase={session.runtime.phase}
        resetRuntime={session.resetRuntime}
      />
    </section>
  </div>
  {#if project.shareNotice}<div
      class="share-notice"
      role="status"
      aria-live="polite"
    >
      {project.shareNotice}
    </div>{/if}
  <TerminalWindow
    bind:terminalOpen={terminal.terminalOpen}
    bind:terminalSplit={terminal.terminalSplit}
    bind:terminalMaximized={terminal.terminalMaximized}
    bind:terminalPosition={terminal.terminalPosition}
    terminalSize={terminal.terminalSize}
    terminalSplitWidth={terminal.terminalSplitWidth}
    bind:activeWindow={ui.activeWindow}
    terminal={terminal.terminal}
    inputReady={session.inputReady}
    bind:inputElement={terminal.inputElement}
    phase={session.runtime.phase}
    beginTerminalDrag={terminal.beginTerminalDrag}
    beginTerminalResize={terminal.beginTerminalResize}
    toggleTerminalMaximized={terminal.toggleTerminalMaximized}
    toggleTerminalSplit={terminal.toggleTerminalSplit}
    beginTerminalSplitResize={terminal.beginTerminalSplitResize}
    clearTerminal={terminal.clearTerminal}
    resetRuntime={session.resetRuntime}
    sendInput={terminal.sendInput}
  />
  <EditorWindows
    editorWindows={editor.editorWindows}
    editorTabbed={editor.editorTabbed}
    editorGroup={editor.editorGroup}
    files={project.files}
    bind:activeWindow={ui.activeWindow}
    bind:activeEditorId={editor.activeEditorId}
    diagnosticsByFile={editor.diagnosticsByFile}
    diagnosticsRun={editor.diagnosticsRun}
    dialogError={ui.dialogError}
    editorFontSize={ui.editorFontSize}
    vimMode={ui.vimMode}
    darkMode={ui.darkMode}
    commentShortcutLabel={ui.commentShortcutLabel}
    formatShortcutLabel={ui.formatShortcutLabel}
    codeMirror={editor.codeMirror}
    closeEditor={editor.closeEditor}
    closeAllEditors={editor.closeAllEditors}
    selectEditorTab={editor.selectEditorTab}
    toggleEditorMaximized={editor.toggleEditorMaximized}
    ungroupEditors={editor.ungroupEditors}
    collectEditors={editor.collectEditors}
    beginEditorDrag={editor.beginEditorDrag}
    beginEditorResize={editor.beginEditorResize}
    updateSource={project.updateSource}
    toggleEditorComments={editor.toggleEditorComments}
    formatEditor={editor.formatEditor}
    markDiagnostics={editor.markDiagnostics}
    closeFormatError={editor.closeFormatError}
  />
  <CompilerDialog
    bind:compilerDialog={session.compilerDialog}
    exception={session.callException}
    compilerDiagnostics={editor.compilerDiagnostics}
    error={ui.error}
  />
  <InspectorWindows
    inspectorViews={objects.inspectorViews}
    activeWindow={ui.activeWindow}
    activeInspectorId={objects.activeInspectorId}
    inspected={objects.inspected}
    bind:editingField={objects.editingField}
    bind:fieldInput={objects.fieldInput}
    bind:fieldDraft={objects.fieldDraft}
    fieldError={objects.fieldError}
    bind:inspectorError={objects.inspectorError}
    fieldProperty={objects.fieldProperty}
    canEditField={objects.canEditField}
    fieldValue={objects.fieldValue}
    inspectorType={objects.inspectorType}
    bringInspectorToFront={objects.bringInspectorToFront}
    beginInspectorDrag={objects.beginInspectorDrag}
    closeInspector={objects.closeInspector}
    saveField={objects.saveField}
    inspectFieldReference={objects.inspectFieldReference}
    beginFieldEdit={objects.beginFieldEdit}
  />
  <CallDialogs
    bind:createDialog={objects.createDialog}
    bind:invokeDialog={objects.invokeDialog}
    bind:resultDialog={objects.resultDialog}
    bind:createName={objects.createName}
    bind:createArgs={objects.createArgs}
    bind:createTypeArgs={objects.createTypeArgs}
    bind:invokeArgs={objects.invokeArgs}
    bind:invokeTypeArgs={objects.invokeTypeArgs}
    dialogError={ui.dialogError}
    canExecute={session.canExecute}
    chooseConstructor={objects.chooseConstructor}
    confirmCreate={objects.confirmCreate}
    confirmInvoke={objects.confirmInvoke}
    inspectObject={objects.inspectObject}
    requestObjectOnBench={objects.requestObjectOnBench}
  />
  <MainSelectionDialog
    bind:mainDialog={session.mainDialog}
    mainEntries={session.mainEntries}
    chooseMain={session.chooseMain}
  />
  <NewProjectDialog
    bind:newProjectOpen={project.newProjectOpen}
    bind:projectInfo={project.projectInfo}
    chooseTemplate={project.chooseTemplate}
  />
  <ReadmeDialog
    readmeOpen={project.readmeOpen}
    bind:readmeHelp={project.readmeHelp}
    bind:readme={project.readme}
    closeReadme={project.closeReadme}
  />
  <BluePlayApiDialog bind:bluePlayApiFile={project.bluePlayApiFile} />
  <NewClassDialog
    bind:newClassOpen={project.newClassOpen}
    bind:newClassName={project.newClassName}
    bind:newClassType={project.newClassType}
    error={ui.error}
    confirmNewClass={project.confirmNewClass}
  />
  <ObjectContextMenu
    bind:menu={objects.menu}
    classes={session.classes}
    canExecute={session.canExecute}
    phase={session.runtime.phase}
    isBluePlayFrameworkFile={project.isBluePlayFrameworkFile}
    openBluePlayApi={project.openBluePlayApi}
    createObject={objects.createObject}
    invokeClassMethod={objects.invokeClassMethod}
    openEditor={editor.openEditor}
    compile={session.compile}
    deleteFile={project.deleteFile}
    duplicateFile={project.duplicateFile}
    invokeObject={objects.invokeObject}
    inspectObject={objects.inspectObject}
    removeObject={objects.removeObject}
  />
  <ProjectTransferDialogs
    bind:toolbarDialog={project.toolbarDialog}
    bind:shareLinkDialog={project.shareLinkDialog}
    bind:shareCodeInput={project.shareCodeInput}
    shareCodeError={project.shareCodeError}
    bind:shareWithReadme={project.shareWithReadme}
    readme={project.readme}
    files={project.files}
    htmlExportBlocked={session.htmlExportBlocked}
    htmlExporting={project.htmlExporting}
    openProjectDrop={project.openProjectDrop}
    importProject={project.importProject}
    loadSharedProjectFromCode={project.loadSharedProjectFromCode}
    shareProject={project.shareProject}
    saveShortProject={project.saveShortProject}
    exportProject={project.exportProject}
    exportHtml={project.exportHtml}
    copySharedLink={project.copySharedLink}
  />
  <MediaDialogs
    bind:imageLibraryOpen={project.imageLibraryOpen}
    libraryId={project.library?.id || ""}
    bind:mediaNotice={project.mediaNotice}
  />
  <SettingsDialogs
    bind:settingsNotice={ui.settingsNotice}
    bind:shortcutsHelpOpen={ui.shortcutsHelpOpen}
    bind:darkMode={ui.darkMode}
    bind:editorFontSize={ui.editorFontSize}
    vimMode={ui.vimMode}
    setVimMode={ui.setVimMode}
    vimShortcutLabel={ui.vimShortcutLabel}
    compileShortcutLabel={ui.compileShortcutLabel}
    runShortcutLabel={ui.runShortcutLabel}
    saveShortcutLabel={ui.saveShortcutLabel}
    terminalShortcutLabel={ui.terminalShortcutLabel}
    formatShortcutLabel={ui.formatShortcutLabel}
    commentShortcutLabel={ui.commentShortcutLabel}
    editorNextShortcutLabel={ui.editorNextShortcutLabel}
    editorPrevShortcutLabel={ui.editorPrevShortcutLabel}
  />
  <ObjectNameDialog
    bind:objectNamePrompt={objects.objectNamePrompt}
    bind:objectName={objects.objectName}
    objectNameError={objects.objectNameError}
    confirmObjectOnBench={objects.confirmObjectOnBench}
  />
  <CodepadContextMenu
    bind:codepadMenu={session.codepadMenu}
    bind:history={session.history}
  />
</div>
