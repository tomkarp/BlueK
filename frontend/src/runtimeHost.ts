import { manifestClasses } from './runtimeMetadata';
import type { BluePlayStage, RuntimeEvent, RuntimeSnapshot, RuntimeValue, SimulationState, WorkerCommand, WorkerReply } from '../../runtime-contract/src/index';

class RequestError extends Error {}

export interface KotliteSessionBridge {
  load(filename: string, source: string): string;
  manifest(): string;
  referenceSnapshot(): string;
  evaluate(filename: string, source: string): string;
  startEvaluate(filename: string, source: string, onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
  startLoadProject(filenames: string[], sources: string[], libraryId: string | null, libraryVersion: number, onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
  mainFunctionName(filename: string): string;
  startCreate(className: string, argumentsSource: string, requestedName: string, onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
  startInvoke(objectId: string, methodName: string, argumentsSource: string, onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
  startSet(objectId: string, propertyName: string, valueSource: string, onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
  startGet(objectId: string, propertyName: string, onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
  setOutputCallback(callback: (() => void) | null): void;
  create(className: string, argumentsSource: string, name: string): string;
  invoke(objectId: string, name: string, argumentsSource: string): string;
  get(objectId: string, property: string): string;
  set(objectId: string, property: string, value: string): string;
  bind(objectId: string, name: string): string;
  remove(objectId: string, name: string): string;
  inspect(objectId: string): string;
  enqueueInput(text: string): string;
  enqueueEof(): string;
  setKey(key: string, pressed: boolean): string;
  setClick(x: number, y: number, actorId: string): string;
  takeOutput(): string;
  takeStage(): string;
  renderBluePlay(): void;
  takeEffects(): string;
  configureBluePlay(enabled: boolean, generationId: string): void;
  setBluePlayResources(manifest: string): void;
  setBluePlaySpeed(speed: number): string;
  startBluePlayStep(onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
  startBluePlayMain(onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
  takeBluePlayIntent(): string;
}

type Emit = (message: WorkerReply | RuntimeEvent) => void;
const initialSnapshot = (): RuntimeSnapshot => ({ generationId: '', revision: 0, phase: 'uncompiled', classes: [], inspections: {}, references: [], liveObjectIds: [], error: null, simulation: 'inactive' });

export class RuntimeHost {
  private session: KotliteSessionBridge | null = null;
  private snapshot: RuntimeSnapshot = initialSnapshot();
  private sequence = 0;
  private lastOutputPublishAt = -Infinity;
  private outputTimer: ReturnType<typeof setTimeout> | null = null;
  private active: { executionId: number; inputRequestId?: number } | null = null;
  private lastStage: BluePlayStage | undefined;
  private simulation: { state: SimulationState; speed: number; emit: Emit | null; timer: ReturnType<typeof setTimeout> | null } = { state: 'inactive', speed: 50, emit: null, timer: null };

  constructor(private readonly createSession: () => KotliteSessionBridge) {}

  private refreshSnapshot(includeInspections = true) {
    const inspections: Record<string, RuntimeValue> = {};
    const references = this.session ? JSON.parse(this.session.referenceSnapshot()) : { references: [], liveObjectIds: [] };
    if (includeInspections) {
      for (const handle of references.liveObjectIds) {
        try { inspections[handle] = JSON.parse(this.session!.inspect(handle)); }
        catch { inspections[handle] = { kind: 'error', objectId: handle, display: 'Inspection unavailable.' }; }
      }
    }
    this.snapshot = {
      ...this.snapshot,
      ...references,
      revision: this.snapshot.revision + 1,
      inspections: includeInspections ? inspections : this.snapshot.inspections,
      simulation: this.simulation.state,
      stage: this.lastStage,
    };
  }

  private publish(id: number, response: RuntimeValue, includeInspections = true): WorkerReply {
    this.clearOutputTimer();
    this.refreshSnapshot(includeInspections);
    response.output = this.session?.takeOutput() || '';
    this.session?.renderBluePlay();
    const stage = this.session?.takeStage();
    if (stage) { const parsed = JSON.parse(stage); response.stage = parsed.stage || parsed; this.lastStage = response.stage as BluePlayStage; }
    const effects = this.session?.takeEffects();
    if (effects) response.effects = JSON.parse(effects);
    this.snapshot = { ...this.snapshot, stage: this.lastStage, simulation: this.simulation.state, error: response.kind === 'error' ? response.display || 'Runtime error' : null };
    if (response.fatal) this.snapshot.phase = 'faulted';
    return { id, generationId: this.snapshot.generationId, response, snapshot: this.snapshot };
  }

  private publishInputState(id: number, response: RuntimeValue): WorkerReply {
    this.snapshot = { ...this.snapshot, simulation: this.simulation.state };
    return { id, generationId: this.snapshot.generationId, response, snapshot: this.snapshot };
  }

  private emitEvent(executionId: number, kind: RuntimeEvent['kind'], emit: Emit, extra: Partial<RuntimeEvent> = {}) {
    this.clearOutputTimer();
    const output = this.session?.takeOutput() || '';
    this.refreshSnapshot();
    if (output) emit({ type: 'event', generationId: this.snapshot.generationId, executionId, sequence: ++this.sequence, kind: 'output', output, snapshot: this.snapshot });
    emit({ type: 'event', generationId: this.snapshot.generationId, executionId, sequence: ++this.sequence, kind, snapshot: this.snapshot, ...extra });
  }

  private emitSimulationSnapshot(executionId: number, emit: Emit, response: RuntimeValue) {
    const reply = this.publish(0, response, false);
    if (reply.response.output) emit({ type: 'event', generationId: reply.generationId, executionId, sequence: ++this.sequence, kind: 'output', output: reply.response.output, snapshot: reply.snapshot });
    emit({ type: 'event', generationId: reply.generationId, executionId, sequence: ++this.sequence, kind: 'snapshot', snapshot: reply.snapshot });
  }

  private clearOutputTimer() {
    if (this.outputTimer !== null) clearTimeout(this.outputTimer);
    this.outputTimer = null;
  }

  private emitStreamingOutput(executionId: number, emit: Emit) {
    // println can run thousands of times per second. Keep output streaming,
    // but do not flood the UI with one full snapshot per line. Remaining text
    // is drained by a trailing timer, or immediately at input/completion.
    const now = performance.now();
    const remaining = 16 - (now - this.lastOutputPublishAt);
    if (remaining > 0) {
      if (this.outputTimer === null) {
        const generationId = this.snapshot.generationId;
        this.outputTimer = setTimeout(() => {
          this.outputTimer = null;
          if (this.snapshot.generationId === generationId && this.active?.executionId === executionId)
            this.emitStreamingOutput(executionId, emit);
        }, remaining);
      }
      return;
    }
    this.clearOutputTimer();
    const output = this.session?.takeOutput() || '';
    if (!output) return;
    this.lastOutputPublishAt = now;
    this.refreshSnapshot();
    emit({ type: 'event', generationId: this.snapshot.generationId, executionId, sequence: ++this.sequence, kind: 'output', output, snapshot: this.snapshot });
  }

  dispatch(id: number, command: WorkerCommand, emit: Emit): void {
    try {
      if (command.op === 'compile') {
        if (this.simulation.timer !== null) clearTimeout(this.simulation.timer);
        this.simulation = { state: 'inactive', speed: 50, emit: null, timer: null };
        this.lastStage = undefined; this.active = null; this.sequence = 0; this.lastOutputPublishAt = -Infinity;
        this.snapshot = { ...initialSnapshot(), generationId: command.generationId, phase: 'compiling' };
        this.session = this.createSession();
        this.session.configureBluePlay(command.library?.id === 'blueplay', command.generationId);
        this.session.setBluePlayResources((command.resources || [])
          .filter(resource => resource.imageWidth && resource.imageHeight && resource.alphaHex)
          .map(resource => `${resource.path}\u0000${resource.imageWidth}\u0000${resource.imageHeight}\u0000${resource.alphaHex}`)
          .join('\n'));
        const executionId = id;
        this.active = { executionId };
        this.session.setOutputCallback(() => this.emitStreamingOutput(executionId, emit));
        this.emitEvent(executionId, 'started', emit);
        const onInput = (inputRequestId: number) => {
          if (!this.active || this.active.executionId !== executionId) return;
          this.active.inputRequestId = inputRequestId; this.snapshot.phase = 'waitingForInput';
          this.emitEvent(executionId, 'inputRequested', emit, { inputRequestId });
        };
        const onComplete = (result: string) => {
          if (!this.active || this.active.executionId !== executionId) return;
          this.session!.setOutputCallback(null); this.active = null;
          const response = JSON.parse(result) as RuntimeValue;
          if (response.kind !== 'error') { this.snapshot.classes = manifestClasses(JSON.parse(this.session!.manifest()), command.files); this.snapshot.phase = 'ready'; }
          else this.snapshot.phase = response.fatal ? 'faulted' : 'uncompiled';
          emit(this.publish(id, response));
        };
        const started = this.session.startLoadProject(command.files.map(file => file.fileName), command.files.map(file => file.source), command.library?.id || null, command.library?.version || 0, onInput, onComplete);
        if ((JSON.parse(started) as RuntimeValue).kind === 'error') onComplete(started);
        return;
      }
      if (!this.session || command.generationId !== this.snapshot.generationId) throw new RequestError('Stale or missing runtime generation.');
      if (command.op === 'simulation') { this.dispatchSimulation(id, command, emit); return; }
      if (command.op === 'key') { emit(this.publishInputState(id, JSON.parse(this.session.setKey(command.key, !!command.pressed)))); return; }
      if (command.op === 'click') { emit(this.publishInputState(id, JSON.parse(this.session.setClick(command.x, command.y, command.actorId || '')))); return; }
      if (command.op === 'input') {
        if (!this.active || this.snapshot.phase !== 'waitingForInput' || command.inputRequestId !== this.active.inputRequestId) throw new RequestError('Stale or duplicate input response.');
        this.active.inputRequestId = undefined; this.snapshot.phase = 'running';
        emit(this.publish(id, JSON.parse(command.eof ? this.session.enqueueEof() : this.session.enqueueInput(command.text)))); return;
      }
      if (command.op === 'inspect' && this.simulation.state !== 'inactive' && this.simulation.state !== 'paused') {
        emit(this.publish(id, { kind: 'inspect', display: 'Inspection is available at the last completed step.' })); return;
      }
      if (this.active || this.snapshot.phase !== 'ready' || (this.simulation.state !== 'inactive' && this.simulation.state !== 'paused')) throw new RequestError('Another runtime command is running.');
      if (command.op === 'inspect') { emit(this.publish(id, JSON.parse(this.session.inspect(command.objectId)))); return; }
      if (command.op === 'bind') { emit(this.publish(id, JSON.parse(this.session.bind(command.objectId, command.name)))); return; }
      if (command.op === 'remove') { emit(this.publish(id, JSON.parse(this.session.remove(command.objectId, command.name)))); return; }

      const args = ('args' in command ? command.args : []).join(', ');
      const types = ('typeArguments' in command ? command.typeArguments : []) || [];
      const suffix = types.length ? `<${types.join(', ')}>` : '';
      let filename = '<Codepad>', source = '';
      if (command.op === 'eval') { filename = command.filename || filename; source = command.code; }
      else if (command.op === 'main') {
        filename = command.fileName || '<Main>';
        const owner = command.fileName?.replace(/\.kt$/, '');
        const main = this.snapshot.classes.find(value => value.kind === 'functions' && value.name === owner)?.methods.find(value => value.name === 'main');
        // Each file may declare its own main(); the session knows its callable name.
        const name = this.session.mainFunctionName(filename);
        source = main && main.parameters.length > 0 ? `${name}(emptyArray<String>())` : `${name}()`;
      }
      const executionId = id;
      this.active = { executionId }; this.snapshot.phase = 'running';
      this.lastOutputPublishAt = -Infinity;
      this.session.setOutputCallback(() => this.emitStreamingOutput(executionId, emit)); this.emitEvent(executionId, 'started', emit);
      const onInput = (inputRequestId: number) => {
        if (!this.active || this.active.executionId !== executionId) return;
        this.active.inputRequestId = inputRequestId; this.snapshot.phase = 'waitingForInput';
        this.emitEvent(executionId, 'inputRequested', emit, { inputRequestId });
      };
      const onComplete = (result: string) => {
        if (!this.active || this.active.executionId !== executionId) return;
        this.session!.setOutputCallback(null); this.active = null;
        const response = JSON.parse(result) as RuntimeValue;
        this.snapshot.phase = response.fatal ? 'faulted' : 'ready';
        const intent = this.session!.takeBluePlayIntent();
        if (intent === 'start') { this.simulation.state = 'running'; this.simulation.emit = emit; this.scheduleSimulationStep(); }
        if (intent === 'stop') this.simulation.state = 'paused';
        emit(this.publish(id, response));
      };
      const started = command.op === 'create'
        ? this.session.startCreate(command.className + suffix, args, command.name, onInput, onComplete)
        : command.op === 'invoke'
          ? this.session.startInvoke(command.objectId, command.name + suffix, args, onInput, onComplete)
          : command.op === 'set'
            ? this.session.startSet(command.objectId, command.property, command.value, onInput, onComplete)
            : command.op === 'get'
              ? this.session.startGet(command.objectId, command.property, onInput, onComplete)
              : this.session.startEvaluate(filename, source, onInput, onComplete);
      const initial = JSON.parse(started) as RuntimeValue;
      if (initial.kind === 'error' && this.active?.executionId === executionId) { this.active = null; this.snapshot.phase = initial.fatal ? 'faulted' : 'ready'; emit(this.publish(id, initial)); }
    } catch (error) {
      emit(this.publish(id, { kind: 'error', display: error instanceof Error ? error.message : String(error), phase: error instanceof RequestError ? 'request' : 'transport', fatal: !(error instanceof RequestError) }));
    }
  }

  private dispatchSimulation(id: number, command: Extract<WorkerCommand, { op: 'simulation' }>, emit: Emit) {
    if (!this.session) throw new RequestError('BluePlay is not compiled.');
    if (command.action === 'setSpeed') {
      this.simulation.speed = Math.max(1, Math.min(100, Math.trunc(command.speed || 50)));
      if (this.simulation.timer !== null) {
        clearTimeout(this.simulation.timer);
        this.simulation.timer = null;
        this.scheduleSimulationStep();
      }
      emit(this.publish(id, JSON.parse(this.session.setBluePlaySpeed(this.simulation.speed)), false)); return;
    }
    if (command.action === 'stop') {
      if (this.simulation.timer !== null) {
        clearTimeout(this.simulation.timer);
        this.simulation.timer = null;
      }
      this.simulation.state = this.active ? 'stopping' : 'paused';
      this.session.takeBluePlayIntent();
      emit(this.publish(id, { kind: 'unit', display: 'Unit' }));
      return;
    }
    if (command.action === 'start') {
      if (this.simulation.state === 'running' || this.simulation.state === 'stopping') { emit(this.publish(id, { kind: 'unit', display: 'Unit' })); return; }
      this.simulation.state = 'running'; this.simulation.emit = emit; emit(this.publish(id, { kind: 'unit', display: 'Unit' })); this.scheduleSimulationStep(); return;
    }
    if (command.action === 'reset') {
      if (this.active) throw new RequestError('BluePlay reset waits for the current step to finish.');
      this.simulation.state = 'stopping'; const executionId = id; this.active = { executionId };
      const onComplete = (result: string) => {
        if (!this.active || this.active.executionId !== executionId) return;
        this.active = null; const response = JSON.parse(result) as RuntimeValue; this.snapshot.phase = response.fatal ? 'faulted' : 'ready'; this.simulation.state = response.fatal ? 'faulted' : 'paused'; emit(this.publish(id, response));
      };
      const started = this.session.startBluePlayMain(() => undefined, onComplete); const initial = JSON.parse(started) as RuntimeValue;
      if (initial.kind === 'error') { this.active = null; this.simulation.state = 'paused'; emit(this.publish(id, initial)); }
      return;
    }
    if (this.simulation.state === 'running' || this.simulation.state === 'stopping') { emit(this.publish(id, { kind: 'unit', display: 'Unit' })); return; }
    this.runSimulationStep(id, emit, false);
  }

  private runSimulationStep(id: number, emit: Emit, automatic: boolean) {
    if (!this.session) return;
    const startedAt = performance.now();
    const executionId = automatic ? ++this.sequence : id; this.active = { executionId };
    const onInput = (inputRequestId: number) => {
      if (!this.active || this.active.executionId !== executionId) return;
      this.active.inputRequestId = inputRequestId; this.snapshot.phase = 'waitingForInput'; this.simulation.state = 'waiting';
      emit({ type: 'event', generationId: this.snapshot.generationId, executionId, sequence: ++this.sequence, kind: 'inputRequested', inputRequestId, snapshot: this.snapshot });
    };
    const onComplete = (result: string) => {
      if (!this.active || this.active.executionId !== executionId) return;
      this.active = null; const response = JSON.parse(result) as RuntimeValue; const intent = this.session!.takeBluePlayIntent();
      if (response.fatal) this.simulation.state = 'faulted'; else if (intent === 'stop' || this.simulation.state === 'stopping') this.simulation.state = 'paused'; else this.simulation.state = automatic ? 'running' : 'paused';
      this.snapshot.phase = response.fatal ? 'faulted' : 'ready';
      if (automatic) this.emitSimulationSnapshot(executionId, emit, response); else emit(this.publish(id, response));
      if (automatic && this.simulation.state === 'running') this.scheduleSimulationStep(performance.now() - startedAt);
    };
    const started = this.session.startBluePlayStep(onInput, onComplete); const initial = JSON.parse(started) as RuntimeValue;
    if (initial.kind === 'error') { this.active = null; this.simulation.state = 'faulted'; if (automatic) this.emitSimulationSnapshot(executionId, emit, initial); else emit(this.publish(id, initial)); }
  }

  private scheduleSimulationStep(elapsed = 0) {
    if (this.simulation.timer !== null || this.simulation.state !== 'running' || this.active || !this.simulation.emit) return;
    // Speed defines the interval between ticks, not an extra sleep after work.
    // Never catch up with a burst of queued ticks when a step exceeds its budget.
    this.simulation.timer = setTimeout(() => { this.simulation.timer = null; if (this.simulation.state === 'running') this.runSimulationStep(0, this.simulation.emit!, true); }, Math.max(1, 100 - this.simulation.speed - elapsed));
  }
}
