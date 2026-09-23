<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { Diagnostic, RuntimeSnapshot } from "../../runtime-contract/src/index";
  import { LocalRuntimeClient } from "./localRuntimeClient";
  import { mainFiles } from "./mainEntries";
  import { projectModelFromPayload } from "./projectFormat";
  import { MAX_PROJECT_LINK_LENGTH, exportFileName, type ExportedProgram } from "./programExport";
  import { appendTerminal, encodeBlueKLink, terminalParts } from "./uiParity";
  import { prepareRuntimeResources } from "./imageAlpha";
  import { standardImages, withStandardImages } from "./standardImages";
  import {
    StageAudio, StageRenderer, decorateStage, measureImageSizes, stageKeyName, stageStyle,
    type ImageSizes, type StageFrame,
  } from "./bluePlayStage";

  /**
   * Runs one exported program: compiles the embedded project in its own
   * runtime worker and starts the chosen main(). Console programs get a
   * terminal; BluePlay programs a world with its controls.
   */
  export let program: ExportedProgram;
  export let createWorker: () => Worker;

  const model = projectModelFromPayload(program.project, (index) => `file-${index}`);
  const bluePlay = model.library?.id === "blueplay";
  const title = model.projectName || "BlueK program";
  const resources = withStandardImages(model.resources, standardImages);
  const client = new LocalRuntimeClient(createWorker);
  const renderer = new StageRenderer(() => scheduleDraw());
  const audio = new StageAudio();
  const keysDown = new Set<string>();

  let runtime: RuntimeSnapshot = client.getSnapshot();
  let terminal = "";
  let diagnostics: Diagnostic[] = [];
  let problem = "";
  let stage: StageFrame | null = null;
  let sizes: ImageSizes = {};
  let speed = 50;
  let canvas: HTMLCanvasElement | null = null;
  let inputElement: HTMLInputElement | null = null;
  let outputElement: HTMLPreElement | null = null;
  let blueKLink = "";
  let linkTooLong = false;
  let run = 0;

  $: inputReady = runtime.phase === "waitingForInput";
  $: stageRunning = runtime.simulation === "running" || runtime.simulation === "stopping" || runtime.simulation === "waiting";
  $: loading = runtime.phase === "compiling";
  $: canStep = Boolean(stage) && !stageRunning && runtime.phase === "ready";
  $: canReset = !stageRunning && runtime.phase !== "compiling" && runtime.phase !== "running" && runtime.phase !== "uncompiled";
  $: failed = Boolean(problem || diagnostics.length || runtime.phase === "faulted");
  $: status = loading ? "Loading…"
    : diagnostics.length ? "Compile error"
    : failed ? "Stopped with an error"
    : inputReady ? "Waiting for input"
    : stageRunning ? "Running"
    : runtime.phase === "running" ? "Running"
    : bluePlay && stage ? "Paused"
    : runtime.phase === "ready" ? "Finished"
    : "";
  $: if (inputReady) tick().then(() => inputElement?.focus());

  let drawPending = false;
  function scheduleDraw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(() => {
      drawPending = false;
      if (canvas && stage) renderer.draw(canvas, stage, resources, window.devicePixelRatio);
    });
  }

  function message(reason: unknown) {
    return reason instanceof Error ? reason.message : String(reason);
  }

  async function start() {
    const current = ++run;
    terminal = "";
    diagnostics = [];
    problem = "";
    stage = null;
    keysDown.clear();
    try {
      const compiled = await client.compile(model.files, Date.now(), model.library, await prepareRuntimeResources(resources));
      if (current !== run) return;
      if (compiled.diagnostics.length) {
        diagnostics = compiled.diagnostics;
        return;
      }
      if (!mainFiles(compiled.classes).includes(program.mainFile)) {
        problem = `${program.mainFile} has no parameterless main().`;
        return;
      }
      const result = bluePlay
        ? await client.reset(program.mainFile)
        : await client.execute({ op: "main", fileName: program.mainFile });
      if (current === run && "kind" in result && result.kind === "error")
        problem = result.display || "The program stopped with an error.";
    } catch (reason) {
      // A restart replaces the runtime; the old run's rejection is not an error.
      if (current === run) problem = message(reason);
    }
  }

  function simulation(action: "step" | "start" | "stop" | "setSpeed") {
    if (!bluePlay || !stage || runtime.phase === "faulted") return;
    if (action === "step" && !canStep) return;
    if (action === "start" && stageRunning) return;
    if (action === "stop" && !stageRunning) return;
    if (action === "setSpeed" && runtime.phase !== "ready" && runtime.phase !== "waitingForInput") return;
    if (action === "start") canvas?.focus();
    client.simulation(action, action === "setSpeed" ? Number(speed) : undefined)
      .then((result) => {
        if (result.kind === "error") problem = result.display || "BluePlay action failed.";
      })
      .catch((reason) => (problem = message(reason)));
  }

  async function resetWorld() {
    if (!canReset) return;
    terminal = "";
    problem = "";
    try {
      const result = await client.reset(program.mainFile);
      if ("kind" in result && result.kind === "error") problem = result.display || "Reset failed.";
    } catch (reason) {
      problem = message(reason);
    }
  }

  function stageKey(event: KeyboardEvent, pressed: boolean) {
    if (!bluePlay || !stage) return;
    const key = stageKeyName(event.key);
    // A held key is always released, wherever the focus went meanwhile.
    if (!pressed) {
      if (keysDown.delete(key)) client.sendKey(key, false).catch(() => undefined);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // Typing into the terminal or using the controls is not game input.
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (document.activeElement !== canvas && !stageRunning) return;
    event.preventDefault();
    if (keysDown.has(key)) return;
    keysDown.add(key);
    client.sendKey(key, true).catch(() => undefined);
  }
  function releaseKeys() {
    for (const key of keysDown) client.sendKey(key, false).catch(() => undefined);
    keysDown.clear();
  }
  function stageClick(event: MouseEvent) {
    canvas?.focus();
    if (!stage || !canvas) return;
    event.preventDefault();
    const { x, y, actorId } = renderer.pointer(stage, canvas.getBoundingClientRect(), event.clientX, event.clientY);
    client.sendClick(x, y, actorId).catch(() => undefined);
  }

  async function sendInput(event: KeyboardEvent) {
    if (!inputReady || !inputElement) return;
    if (event.key === "d" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      await client.sendEof().catch((reason) => (problem = message(reason)));
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = inputElement.value;
    inputElement.value = "";
    terminal += `\u0001${value}\u0002\n`;
    await client.sendInput(value).catch((reason) => (problem = message(reason)));
  }

  function downloadProject() {
    const blob = new Blob([JSON.stringify(program.project, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = exportFileName(model.projectName, ".bluek.json");
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  const unsubscribe = [
    client.subscribe(() => (runtime = client.getSnapshot())),
    client.onResponse((value) => {
      if (value.output) {
        terminal = appendTerminal(terminal, value.output);
        tick().then(() => {
          if (outputElement) outputElement.scrollTop = outputElement.scrollHeight;
        });
      }
      value.effects?.forEach((effect) => {
        if (effect.type === "sound" && effect.name === "beep") audio.beep();
      });
    }),
    client.stageStream((value) => {
      stage = decorateStage(value, resources, sizes);
      speed = Number(value.speed) || speed;
      audio.playFrameSounds(value, resources);
      scheduleDraw();
    }),
  ];

  onMount(() => {
    document.title = title;
    measureImageSizes(resources).then((measured) => {
      sizes = measured;
      if (stage) {
        stage = decorateStage(stage, resources, sizes);
        scheduleDraw();
      }
    });
    encodeBlueKLink(program.project)
      .then((encoded) => {
        const link = `${program.blueKUrl}#bluek=${encoded}`;
        linkTooLong = link.length > MAX_PROJECT_LINK_LENGTH;
        blueKLink = linkTooLong ? "" : link;
      })
      .catch(() => (linkTooLong = true));
    void start();
  });
  onDestroy(() => {
    unsubscribe.forEach((stop) => stop());
    client.invalidate("Player closed.");
  });
</script>

<svelte:window on:keydown={(event) => stageKey(event, true)} on:keyup={(event) => stageKey(event, false)} on:blur={releaseKeys} />

<main class="player" class:blueplay={bluePlay}>
  <header class="player-header">
    <div class="player-title">
      <h1>{title}</h1>
      <span class="player-status" role="status">{status}</span>
    </div>
    <nav class="player-actions" aria-label="Project">
      {#if blueKLink}
        <a class="player-button" href={blueKLink} target="_blank" rel="noopener">Open in BlueK</a>
      {:else if linkTooLong}
        <span class="player-note">Too large for a link: download the project and open it in BlueK.</span>
      {/if}
      <button class="player-button" on:click={downloadProject}>Download project (.bluek.json)</button>
    </nav>
  </header>

  {#if diagnostics.length}
    <section class="player-problem" role="alert" aria-label="Compile errors">
      <strong>The program could not be compiled.</strong>
      <ul>
        {#each diagnostics as diagnostic}
          <li><code>{diagnostic.fileName ?? "?"}:{diagnostic.line}:{diagnostic.column}</code> {diagnostic.message}</li>
        {/each}
      </ul>
    </section>
  {:else if problem || runtime.phase === "faulted"}
    <section class="player-problem" role="alert" aria-label="Error">
      <strong>The program stopped.</strong>
      <pre>{problem || runtime.error || "Runtime error."}</pre>
    </section>
  {/if}

  {#if bluePlay}
    <section class="player-world" aria-label="BluePlay world">
      {#if stage}
        <canvas
          bind:this={canvas}
          class="player-stage"
          aria-label="BluePlay world"
          role="button"
          tabindex="0"
          style={stageStyle(stage)}
          on:click={stageClick}
        ></canvas>
        <div class="player-controls" aria-label="BluePlay controls">
          <button on:click={() => simulation("step")} disabled={!canStep}>Step</button>
          {#if stageRunning}
            <button on:click={() => simulation("stop")}>Pause</button>
          {:else}
            <button on:click={() => simulation("start")} disabled={runtime.phase !== "ready"}>Run</button>
          {/if}
          <button on:click={resetWorld} disabled={!canReset}>Reset</button>
          <label>Speed <input type="range" min="1" max="100" bind:value={speed} on:input={() => simulation("setSpeed")} /></label>
        </div>
      {:else if loading}
        <p class="player-placeholder">Loading…</p>
      {/if}
    </section>
  {/if}

  {#if !bluePlay || terminal || inputReady}
    <section class="player-terminal" aria-label="Terminal">
      <pre bind:this={outputElement}>{#each terminalParts(terminal) as part}<span class:player-input-echo={part.input}>{part.text}</span>{/each}</pre>
      <div class="player-input-row">
        <input
          bind:this={inputElement}
          aria-label="Program input"
          placeholder={inputReady ? "Enter a line; press Return" : ""}
          disabled={!inputReady}
          on:keydown={sendInput}
        />
        {#if !bluePlay}<button on:click={() => void start()} disabled={loading}>Restart</button>{/if}
      </div>
    </section>
  {/if}
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) { margin: 0; background: #e5e6e7; color: #222; font: 14px Arial, sans-serif; }
  .player { max-width: 1100px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; min-height: 100vh; }
  .player-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
  .player-title { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
  h1 { margin: 0; font-size: 22px; overflow-wrap: anywhere; }
  .player-status { color: #555; font-size: 13px; }
  .player-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .player-button, .player-controls button, .player-input-row button {
    padding: 6px 12px; border: 1px solid #999; border-radius: 5px; background: linear-gradient(#fff, #d9d9d9);
    color: #222; font: inherit; text-decoration: none; cursor: pointer;
  }
  .player-button:hover, .player-controls button:hover:not(:disabled), .player-input-row button:hover:not(:disabled) { background: linear-gradient(#fff, #cfcfcf); }
  button:disabled { cursor: not-allowed; opacity: .55; }
  .player-note { color: #555; font-size: 12px; max-width: 260px; }
  .player-problem { border: 1px solid #d49a9a; border-radius: 8px; background: #fff3f3; color: #8a0000; padding: 10px 14px; }
  .player-problem ul { margin: 6px 0 0; padding-left: 18px; }
  .player-problem pre { margin: 6px 0 0; white-space: pre-wrap; font: 13px monospace; }
  .player-world { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .player-stage {
    width: var(--bluek-world-width); max-width: 100%; height: auto; display: block;
    border: 2px solid #555; box-shadow: 2px 3px 8px #0003; outline: none; cursor: pointer;
  }
  .player-stage:focus-visible { outline: 3px solid #0a9dcc; outline-offset: 2px; }
  .player-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .player-controls label { display: flex; align-items: center; gap: 6px; color: #555; font-size: 12px; }
  .player-controls input { width: 110px; }
  .player-placeholder { color: #555; }
  .player-terminal { display: flex; flex-direction: column; gap: 6px; background: #f5f4f1; border: 2px solid #999; border-radius: 9px; padding: 10px; }
  /* A console program is its terminal: it fills the window and scrolls inside. */
  .player:not(.blueplay) { height: 100vh; min-height: 420px; }
  .player:not(.blueplay) .player-terminal { flex: 1; min-height: 0; }
  .player:not(.blueplay) .player-terminal pre { max-height: none; min-height: 0; }
  .player-terminal pre { flex: 1; min-height: 120px; max-height: 60vh; margin: 0; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.4 monospace; }
  .player-input-echo { color: #0655b5; }
  .player-input-row { display: flex; gap: 8px; }
  .player-input-row input { flex: 1; min-width: 0; padding: 6px; border: 1px solid #aaa; border-radius: 4px; font: 13px monospace; }
  .player-input-row input:disabled { background: #e5e5e5; }
</style>
