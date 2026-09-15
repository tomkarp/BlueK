import { manifestClasses } from './runtimeMetadata';
import type { RuntimeEvent, RuntimeSnapshot, WorkerCommand, WorkerReply, RuntimeValue } from '../../runtime-contract/src/index';

class RequestError extends Error {}

export interface KotliteSessionBridge {
  load(filename: string, source: string): string;
  manifest(): string;
  evaluate(filename: string, source: string): string;
  startEvaluate(filename: string, source: string, onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
  startLoadProject(filenames: string[], sources: string[], onInput: (requestId: number) => void, onComplete: (result: string) => void): string;
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
  inspect(objectId: string): string;
  enqueueInput(text: string): string;
  enqueueEof(): string;
  setKey(key: string, pressed: boolean): string;
  setClick(x: number, y: number): string;
  takeOutput(): string;
  takeStage(): string;
}

type Emit = (message: WorkerReply | RuntimeEvent) => void;

export class RuntimeHost {
  private session: KotliteSessionBridge | null = null;
  private handles = new Set<string>();
  private snapshot: RuntimeSnapshot = { generationId: '', revision: 0, phase: 'uncompiled', classes: [], inspections: {}, error: null };
  private sequence = 0;
  private active: { executionId: number; inputRequestId?: number } | null = null;
  constructor(private readonly createSession: () => KotliteSessionBridge) {}

  private publish(id: number, response: RuntimeValue): WorkerReply {
    if (response.objectId) this.handles.add(response.objectId);
    const inspections: Record<string, RuntimeValue> = {};
    for (const handle of this.handles) {
      try { inspections[handle] = JSON.parse(this.session!.inspect(handle)); }
      catch { inspections[handle] = { kind: 'error', objectId: handle, display: 'Inspection unavailable.' }; }
    }
    response.output = this.session?.takeOutput() || '';
    const stage = this.session?.takeStage();
    if (stage) { const parsed = JSON.parse(stage); response.stage = parsed.stage || parsed; }
    this.snapshot = { ...this.snapshot, revision: this.snapshot.revision + 1, inspections, error: response.kind === 'error' ? response.display || 'Runtime error' : null };
    if (response.fatal) this.snapshot.phase = 'faulted';
    return { id, generationId: this.snapshot.generationId, response, snapshot: this.snapshot };
  }

  private refreshSnapshot() {
    const inspections: Record<string, RuntimeValue> = {};
    for (const handle of this.handles) {
      try { inspections[handle] = JSON.parse(this.session!.inspect(handle)); }
      catch { inspections[handle] = { kind: 'error', objectId: handle, display: 'Inspection unavailable.' }; }
    }
    this.snapshot = { ...this.snapshot, revision: this.snapshot.revision + 1, inspections };
  }

  private emitEvent(executionId: number, kind: RuntimeEvent['kind'], emit: Emit, extra: Partial<RuntimeEvent> = {}) {
    const output = this.session?.takeOutput() || '';
    this.refreshSnapshot();
    if (output) emit({ type: 'event', generationId: this.snapshot.generationId, executionId, sequence: ++this.sequence, kind: 'output', output, snapshot: this.snapshot });
    emit({ type: 'event', generationId: this.snapshot.generationId, executionId, sequence: ++this.sequence, kind, snapshot: this.snapshot, ...extra });
  }

  private emitStreamingOutput(executionId: number, emit: Emit) {
    const output = this.session?.takeOutput() || '';
    if (!output) return;
    this.refreshSnapshot();
    emit({ type: 'event', generationId: this.snapshot.generationId, executionId, sequence: ++this.sequence, kind: 'output', output, snapshot: this.snapshot });
  }

  dispatch(id: number, command: WorkerCommand, emit: Emit): void {
    try {
      if (command.op === 'compile') {
        this.active = null; this.handles.clear(); this.sequence = 0;
        this.snapshot = { generationId: command.generationId, revision: 0, phase: 'compiling', classes: [], inspections: {}, error: null };
        this.session = this.createSession();
        const executionId = id;
        this.active = { executionId };
        this.session.setOutputCallback(() => this.emitStreamingOutput(executionId, emit));
        this.emitEvent(executionId, 'started', emit);
        const onInput = (inputRequestId: number) => {
          if (!this.active || this.active.executionId !== executionId) return;
          this.active.inputRequestId = inputRequestId;
          this.snapshot.phase = 'waitingForInput';
          this.emitEvent(executionId, 'inputRequested', emit, { inputRequestId });
        };
        const onComplete = (result: string) => {
          if (!this.active || this.active.executionId !== executionId) return;
          this.session!.setOutputCallback(null);
          this.active = null;
          const response = JSON.parse(result) as RuntimeValue;
          if (response.kind !== 'error') {
            this.snapshot.classes = manifestClasses(JSON.parse(this.session!.manifest()), command.files);
            this.snapshot.phase = 'ready';
          } else {
            this.snapshot.phase = response.fatal ? 'faulted' : 'uncompiled';
          }
          emit(this.publish(id, response));
        };
        const started = this.session.startLoadProject(command.files.map(file => file.fileName), command.files.map(file => file.source), onInput, onComplete);
        if ((JSON.parse(started) as RuntimeValue).kind === 'error') onComplete(started);
        return;
      }
      if (!this.session || command.generationId !== this.snapshot.generationId) throw new RequestError('Stale or missing runtime generation.');
      if (command.op === 'input') {
        if (!this.active || this.snapshot.phase !== 'waitingForInput' || command.inputRequestId !== this.active.inputRequestId) throw new RequestError('Stale or duplicate input response.');
        this.active.inputRequestId = undefined; this.snapshot.phase = 'running';
        emit(this.publish(id, JSON.parse(command.eof ? this.session.enqueueEof() : this.session.enqueueInput(command.text)))); return;
      }
      if (this.active || this.snapshot.phase !== 'ready') throw new RequestError('Another runtime command is running.');
      if (command.op === 'inspect') { emit(this.publish(id, JSON.parse(this.session.inspect(command.objectId)))); return; }
      if (command.op === 'bind') { emit(this.publish(id, JSON.parse(this.session.bind(command.objectId, command.name)))); return; }
      if (command.op === 'key') { emit(this.publish(id, JSON.parse(this.session.setKey(command.key, !!command.pressed)))); return; }
      if (command.op === 'click') { emit(this.publish(id, JSON.parse(this.session.setClick(command.x, command.y)))); return; }

      const args = ('args' in command ? command.args : []).join(', ');
      const types = ('typeArguments' in command ? command.typeArguments : []) || [];
      const suffix = types.length ? `<${types.join(', ')}>` : '';
      let filename = '<Codepad>', source = '';
      if (command.op === 'eval') { filename = command.filename || filename; source = command.code; }
      else if (command.op === 'main') {
        filename = command.fileName || '<Main>';
        const owner = command.fileName?.replace(/\.kt$/, '');
        const main = this.snapshot.classes.find(value => value.kind === 'functions' && value.name === owner)?.methods.find(value => value.name === 'main');
        if (main && main.parameters.length > 0) source = 'main(emptyArray<String>())';
        else source = 'main()';
      }
      const executionId = id;
      this.active = { executionId }; this.snapshot.phase = 'running';
      this.session.setOutputCallback(() => this.emitStreamingOutput(executionId, emit));
      this.emitEvent(executionId, 'started', emit);
      const onInput = (inputRequestId: number) => {
        if (!this.active || this.active.executionId !== executionId) return;
        this.active.inputRequestId = inputRequestId; this.snapshot.phase = 'waitingForInput';
        this.emitEvent(executionId, 'inputRequested', emit, { inputRequestId });
      };
      const onComplete = (result: string) => {
        if (!this.active || this.active.executionId !== executionId) return;
        this.session!.setOutputCallback(null);
        this.active = null; const response = JSON.parse(result); this.snapshot.phase = response.fatal ? 'faulted' : 'ready';
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
      if (initial.kind === 'error' && this.active?.executionId === executionId) {
        this.active = null;
        this.snapshot.phase = initial.fatal ? 'faulted' : 'ready';
        emit(this.publish(id, initial));
      }
    } catch (error) {
      emit(this.publish(id, { kind: 'error', display: error instanceof Error ? error.message : String(error), phase: error instanceof RequestError ? 'request' : 'transport', fatal: !(error instanceof RequestError) }));
    }
  }
}
