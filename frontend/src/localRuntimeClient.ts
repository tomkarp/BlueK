import type { CompileResult, Diagnostic, ProjectFile, ProjectLibrary, ProjectResource, BluePlayStage } from '../../runtime-contract/src/index';
import type { RuntimeCommand, RuntimeEvent, RuntimeSnapshot, RuntimeValue, WorkerCommand, WorkerReply } from '../../runtime-contract/src/index';

type Pending = { resolve: (reply: WorkerReply) => void; reject: (error: Error) => void };
const initial = (): RuntimeSnapshot => ({ generationId: '', revision: 0, phase: 'uncompiled', classes: [], inspections: {}, references: [], liveObjectIds: [], error: null, simulation: 'inactive' });

/**
 * The editor reports the message at the line it belongs to, where a dumped
 * token and a repeated position are noise that hides the actual problem.
 */
function readableMessage(message: string): string {
  return message
    .replace(/Token\(type=(\w+), value=(.*?), position=\[[^\]]*\](?:, endExclusive=\[[^\]]*\])?\)/g,
      (_, type: string, value: string) => value.trim() ? `\`${value.trim()}\`` : type)
    .replace(/\s*at \[<BlueK project>:\d+:\d+\]\s*$/, '')
    .replace(/\s*at line \d+ col \d+\s*$/, '')
    .trim();
}

/** Single command gateway and observable runtime state for every UI surface. */
export class LocalRuntimeClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private epoch = 0;
  private snapshot = initial();
  private listeners = new Set<() => void>();
  private responseListeners = new Set<(value: RuntimeValue) => void>();
  private stageListeners = new Set<(value: BluePlayStage) => void>();
  private project: ProjectFile[] = [];
  private library?: ProjectLibrary;
  private resources: ProjectResource[] = [];
  private inputRequestId: number | undefined;

  constructor(private readonly workerFactory = () => new Worker(new URL('./localRuntimeWorker.ts', import.meta.url), { type: 'module' })) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  onResponse(listener: (value: RuntimeValue) => void) { this.responseListeners.add(listener); return () => { this.responseListeners.delete(listener); }; }
  stageStream(listener: (value: BluePlayStage) => void) { this.stageListeners.add(listener); return () => { this.stageListeners.delete(listener); }; }
  private update(snapshot: RuntimeSnapshot) { this.snapshot = snapshot; this.listeners.forEach(listener => listener()); }

  invalidate(reason = 'Runtime generation replaced.') {
    this.epoch++;
    this.worker?.terminate();
    this.worker = null;
    for (const pending of this.pending.values()) pending.reject(new Error(reason));
    this.pending.clear();
    this.update(initial());
  }
  private start() {
    const worker = this.worker = this.workerFactory();
    const epoch = this.epoch;
    worker.onmessage = event => {
      if (epoch !== this.epoch || worker !== this.worker) return;
      if (event.data?.type === 'event') {
        const runtimeEvent = event.data as RuntimeEvent;
        if (runtimeEvent.generationId !== this.snapshot.generationId) return;
        this.update(runtimeEvent.snapshot);
        if (runtimeEvent.kind === 'inputRequested') this.inputRequestId = runtimeEvent.inputRequestId;
        if (runtimeEvent.output) this.responseListeners.forEach(listener => listener({ kind: 'unit', output: runtimeEvent.output, display: 'Unit' }));
        if (runtimeEvent.snapshot.stage) this.stageListeners.forEach(listener => listener(runtimeEvent.snapshot.stage!));
        return;
      }
      const pending = this.pending.get(event.data.id);
      if (!pending) return;
      this.pending.delete(event.data.id);
      if (event.data.transportError) {
        pending.reject(new Error(event.data.transportError));
        this.fail(event.data.transportError);
      } else pending.resolve(event.data);
    };
    worker.onerror = event => { if (epoch === this.epoch) this.fail(event.message || 'Runtime worker failed.'); };
    worker.onmessageerror = () => { if (epoch === this.epoch) this.fail('Invalid runtime worker message.'); };
  }
  private fail(message: string) {
    this.invalidate(message);
    this.update({ ...this.snapshot, phase: 'faulted', error: message });
  }
  private request(command: WorkerCommand) {
    if (!this.worker) throw new Error('Runtime is not compiled.');
    const id = this.nextId++;
    return new Promise<WorkerReply>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try { this.worker!.postMessage({ ...command, id }); }
      catch (error) { this.pending.delete(id); reject(error); }
    });
  }
  private accept(reply: WorkerReply, epoch: number) {
    if (epoch !== this.epoch || reply.generationId !== this.snapshot.generationId) throw new Error('Stale runtime response.');
    this.update(reply.snapshot);
    this.responseListeners.forEach(listener => listener(reply.response));
    const stage = reply.response.stage ?? reply.snapshot.stage;
    if (stage) this.stageListeners.forEach(listener => listener(stage));
    return reply.response;
  }
  async compile(files: ProjectFile[], revision: number, library?: ProjectLibrary, resources: ProjectResource[] = []): Promise<CompileResult> {
    this.invalidate();
    const epoch = this.epoch;
    const generationId = crypto.randomUUID();
    this.project = files.map(file => ({ ...file }));
    this.library = library;
    this.resources = resources.map(resource => ({ ...resource }));
    this.update({ ...initial(), generationId, phase: 'compiling' });
    try {
      this.start();
      const reply = await this.request({ op: 'compile', files: this.project, library, resources, generationId });
      const response = this.accept(reply, epoch);
      const diagnostics = (response.kind === 'error' ? response.diagnostics ?? [this.diagnostic(response.display || 'Compilation failed.', files)] : [])
        .map(item => ({ ...item, message: readableMessage(item.message) }));
      return { generationId: diagnostics.length ? '' : generationId, sourceRevision: revision, classes: reply.snapshot.classes, diagnostics };
    } catch (error) {
      if (epoch === this.epoch) this.fail(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  private diagnostic(message: string, files: ProjectFile[]): Diagnostic {
    const match = message.match(/<BlueK project>:(\d+):(\d+)/);
    const combined = Number(match?.[1] || 1);
    let first = 3; // leading session newline + file header
    for (const file of files) {
      const last = first + file.source.split('\n').length - 1;
      if (combined <= last) return { fileName: file.fileName, line: Math.max(1, combined - first + 1), column: Number(match?.[2] || 1), severity: 'error', message };
      first = last + 3;
    }
    return { fileName: files.at(-1)?.fileName, line: 1, column: 1, severity: 'error', message };
  }
  async execute(command: RuntimeCommand): Promise<RuntimeValue> {
    const inputCommand = command.op === 'input';
    const simulationCommand = command.op === 'simulation';
    const deviceInput = command.op === 'key' || command.op === 'click';
    const passiveDuringSimulation = command.op === 'key' || command.op === 'click' || command.op === 'inspect' || command.op === 'simulation' || inputCommand;
    if (!passiveDuringSimulation && this.snapshot.simulation !== 'inactive' && this.snapshot.simulation !== 'paused') {
      throw new Error('BluePlay simulation is running. Stop it before executing code.');
    }
    const simulationPhaseAllowed = (simulationCommand || deviceInput) && (this.snapshot.phase === 'ready' || this.snapshot.phase === 'running' || this.snapshot.phase === 'waitingForInput');
    if (this.snapshot.phase !== 'ready' && !simulationPhaseAllowed && !(inputCommand && this.snapshot.phase === 'waitingForInput') && !(this.snapshot.phase === 'faulted' && command.op === 'inspect' && this.worker)) {
      throw new Error(this.snapshot.phase === 'running' ? 'Another runtime command is running.' : 'Reset or compile the project before running code.');
    }
    if (command.generationId && command.generationId !== this.snapshot.generationId) throw new Error('Stale runtime command.');
    const epoch = this.epoch;
    const previous = this.snapshot;
    if (!inputCommand && !simulationCommand && !deviceInput) this.update({ ...previous, phase: 'running' });
    try {
      const reply = await this.request({ ...command, generationId: previous.generationId, ...(inputCommand ? { inputRequestId: this.inputRequestId } : {}) });
      // Input acknowledgements do not change interpreter state or publish frames.
      // In particular, never replay their older snapshot over a completed tick.
      if (deviceInput) {
        if (epoch !== this.epoch || reply.generationId !== this.snapshot.generationId) throw new Error('Stale runtime response.');
        return reply.response;
      }
      return this.accept(reply, epoch);
    } catch (error) {
      if (!deviceInput && epoch === this.epoch && this.getSnapshot().phase === 'running') this.update(previous);
      throw error;
    }
  }
  async sendInput(text: string) { return this.execute({ op: 'input', text, inputRequestId: this.inputRequestId }); }
  async sendEof() { return this.execute({ op: 'input', text: '', eof: true, inputRequestId: this.inputRequestId }); }
  async sendKey(key: string, pressed: boolean) { return this.execute({ op: 'key', key, pressed }); }
  async sendClick(x: number, y: number, actorId?: string) { return this.execute({ op: 'click', x, y, actorId }); }
  async simulation(action: 'step' | 'start' | 'stop' | 'reset' | 'setSpeed', speed?: number) {
    return this.execute(action === 'reset' ? { op: 'simulation', action } : { op: 'simulation', action, speed });
  }
  async stop() { this.invalidate(); }
  async reset(fileName?: string) {
    if (this.library?.id === 'blueplay') return this.execute({ op: 'simulation', action: 'reset', fileName });
    return this.compile(this.project, Date.now(), this.library, this.resources);
  }
}
