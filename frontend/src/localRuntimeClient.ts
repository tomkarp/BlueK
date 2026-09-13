import type { ClassMeta, CompileResult, ProjectFile, RuntimeClient, RuntimeStatus, TypeRef, Value } from '../../runtime-contract/src/index.js';

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void };
const emptyType = (name = 'Any') => ({ classifier: name, arguments: [], nullable: false, displayName: name });
const metadata = (files: ProjectFile[]): ClassMeta[] => files.flatMap(file => {
  const source = file.source;
  const classes: ClassMeta[] = [];
  const classPattern = /\b(open\s+|abstract\s+)?(class|interface|object)\s+([A-Za-z_]\w*)(?:\s*<([^>{}]*)>)?\s*(?:\(([^{}]*)\))?\s*(?::\s*([^\n{]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = classPattern.exec(source))) {
    const name = match[3];
    const params = (match[5] || '').split(',').map(value => value.trim()).filter(Boolean).map((value, index) => {
      const part = value.match(/^(val|var)?\s*([A-Za-z_]\w*)\s*:\s*([^=]+)(?:\s*=\s*(.*))?$/);
      return { name: part?.[2] || `arg${index + 1}`, type: emptyType(part?.[3]?.trim() || 'Any'), hasDefault: Boolean(part?.[4]) };
    });
    const methods = [...source.matchAll(/\b(?:public\s+|open\s+|override\s+|private\s+|protected\s+)*fun\s+([A-Za-z_]\w*)\s*(?:<([^>]*)>)?\s*\(([^)]*)\)\s*(?::\s*([^\s{=]+))?/g)].map((method, index) => ({ id: `${name}.${method[1]}.${index}`, name: method[1], declaringType: name, parameters: [], returnType: emptyType(method[4] || 'Unit'), visibility: /\b(private|protected)\b/.test(method[0]) ? 'private' : 'public' }));
    const properties = [...source.matchAll(/\b(val|var)\s+([A-Za-z_]\w*)\s*(?::\s*([^=\n]+))?/g)].map(property => ({ id: `${name}.${property[2]}`, name: property[2], type: emptyType(property[3]?.trim() || 'Any'), mutable: property[1] === 'var', visibility: 'public' }));
    classes.push({ id: name, name, kind: match[2] === 'interface' ? 'interface' : match[2] === 'object' ? 'object' : match[1]?.trim() === 'abstract' ? 'abstract' : 'class', constructors: match[2] === 'interface' || match[2] === 'object' ? [] : [{ id: `${name}.constructor`, parameters: params }], methods, properties, supertypes: (match[6] || '').split(',').map(value => value.trim()).filter(Boolean).map(value => emptyType(value.replace(/\(.*/, '').trim())), typeParameters: (match[4] || '').split(',').map(value => value.trim()).filter(Boolean) });
  }
  if (file.kind === 'functions' || (!classes.length && /\bfun\s+/.test(source))) classes.push({ id: file.fileName, name: file.fileName.replace(/\.kt$/, ''), kind: 'functions', constructors: [], methods: [...source.matchAll(/\bfun\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*(?::\s*([^\s{=]+))?/g)].map((method, index) => ({ id: `${file.fileName}.${method[1]}.${index}`, name: method[1], declaringType: file.fileName, parameters: [], returnType: emptyType(method[2] || 'Unit'), visibility: 'public' })), properties: [], supertypes: [], typeParameters: [] });
  return classes;
});
const addInheritedMembers = (classes: ClassMeta[]) => {
  const byName = new Map(classes.map(value => [value.name, value]));
  const visiting = new Set<string>();
  const enriched = new Map<string, ClassMeta>();
  const visit = (classMeta: ClassMeta): ClassMeta => {
    const existing = enriched.get(classMeta.name);
    if (existing) return existing;
    if (visiting.has(classMeta.name)) return classMeta;
    visiting.add(classMeta.name);
    const inheritedMethods: any[] = [], inheritedProperties: any[] = [];
    for (const supertype of classMeta.supertypes || []) {
      const parent = byName.get(supertype.classifier);
      if (!parent) continue;
      const parentMeta = visit(parent);
      inheritedMethods.push(...(parentMeta.methods || []).map(method => ({ ...method, inheritedFrom: method.inheritedFrom || parentMeta.name })));
      inheritedProperties.push(...(parentMeta.properties || []).map(property => ({ ...property, inheritedFrom: property.inheritedFrom || parentMeta.name })));
    }
    const methodKeys = new Set((classMeta.methods || []).map(method => `${method.name}(${(method.parameters || []).length})`));
    const propertyNames = new Set((classMeta.properties || []).map(property => property.name));
    const result = { ...classMeta, methods: [...(classMeta.methods || []), ...inheritedMethods.filter(method => !methodKeys.has(`${method.name}(${(method.parameters || []).length})`))], properties: [...(classMeta.properties || []), ...inheritedProperties.filter(property => !propertyNames.has(property.name))] };
    visiting.delete(classMeta.name);
    enriched.set(classMeta.name, result);
    return result;
  };
  return classes.map(visit);
};
const sourceLocation = (display: string) => {
  const match = display.match(/(?:<BlueK project>|<Kotlite>|<[^>]+>):(\d+):(\d+)/) || display.match(/line\s+(\d+)\s+col\s+(\d+)/i);
  return match ? { line: Number(match[1]), column: Number(match[2]) } : { line: 1, column: 1 };
};
const sourceFileAtLine = (files: ProjectFile[], line: number) => {
  let currentLine = 1;
  let selected = files[0]?.fileName || '<Kotlite>';
  for (const file of files) {
    selected = file.fileName;
    const fileStart = currentLine + 1;
    const fileEnd = fileStart + String(file.source || '').split('\n').length - 1;
    if (line >= fileStart && line <= fileEnd) return selected;
    currentLine = fileEnd + 2;
  }
  return selected;
};
const sourceLocationInFiles = (files: ProjectFile[], combinedLine: number, combinedColumn: number) => {
  let line = 1;
  for (const file of files) {
    const headerLines = 1;
    const sourceLines = String(file.source || '').split('\n').length;
    const firstSourceLine = line + headerLines;
    const lastSourceLine = firstSourceLine + sourceLines - 1;
    if (combinedLine >= firstSourceLine && combinedLine <= lastSourceLine) {
      return { fileName: file.fileName, line: combinedLine - firstSourceLine + 1, column: combinedColumn };
    }
    // The two separator newlines share the final line break when a source
    // ends in a newline, so the next header starts after one extra line.
    line += headerLines + sourceLines + 1;
  }
  return { fileName: sourceFileAtLine(files, combinedLine), line: combinedLine, column: combinedColumn };
};

export class LocalRuntimeClient implements RuntimeClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private workerEpoch = 0;
  private generationId: string | null = null;
  private classes: ClassMeta[] = [];
  private stageListeners = new Set<(value: any) => void>();
  private simulationTimer: number | null = null;
  constructor(private readonly onFailure: (message: string) => void = () => undefined, private readonly onOutput: (output?: string) => void = () => undefined) {}
  private stopWorker(reason = 'Kotlite worker stopped.') {
    this.stopSimulation();
    const worker = this.worker;
    this.worker = null;
    this.workerEpoch += 1;
    worker?.terminate();
    for (const pending of this.pending.values()) pending.reject(new Error(reason));
    this.pending.clear();
  }
  private start() {
    if (this.worker) return;
    const epoch = ++this.workerEpoch;
    const worker = new Worker(new URL('./localRuntimeWorker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    worker.onmessage = event => {
      if (epoch !== this.workerEpoch || worker !== this.worker) return;
      const pending = this.pending.get(event.data.id);
      if (!pending) return;
      this.pending.delete(event.data.id);
      pending.resolve(event.data.response);
    };
    worker.onerror = event => {
      if (epoch !== this.workerEpoch || worker !== this.worker) return;
      const message = event.message || 'Kotlite worker stopped.';
      this.onFailure(message);
      this.stopWorker(message);
    };
  }
  private request(op: string, data: Record<string, unknown> = {}): Promise<any> { this.start(); const id = this.nextId++; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.worker!.postMessage({ id, op, ...data }); }); }
  private stageOf(response: any) { return response?.stage?.stage || response?.stage; }
  async compile(files: ProjectFile[], revision: number, ..._unused: unknown[]): Promise<CompileResult> { this.stopWorker('Kotlite worker replaced by a new compilation.'); this.classes = metadata(files); const response = await this.request('compile', { files }); if (response.kind === 'error') { const location = sourceLocation(String(response.display || 'Kotlite compilation failed.')); const mapped = sourceLocationInFiles(files, location.line, location.column); return { generationId: '', sourceRevision: revision, classes: [], diagnostics: [{ fileName: mapped.fileName, line: mapped.line, column: mapped.column, severity: 'error', message: response.display }] }; } this.classes = Array.isArray(response.classes) ? addInheritedMembers(response.classes) : this.classes; this.generationId = crypto.randomUUID(); return { generationId: this.generationId, sourceRevision: revision, classes: this.classes, diagnostics: [] }; }
  private publish(response: any) {
    if (!response?.stage) return;
    // Worker responses wrap the serialized snapshot as { stage: { stage: ... } }.
    // Stage listeners consume the actual stage object, including for quiet
    // Codepad requests whose result is not passed through write().
    const stage = response.stage.stage || response.stage;
    this.stageListeners.forEach(listener => listener({ ...response, stage }));
  }
  private stopSimulation() { if (this.simulationTimer !== null) { window.clearTimeout(this.simulationTimer); this.simulationTimer = null; } }
  private scheduleSimulation() {
    if (this.simulationTimer !== null || !this.worker) return;
    const tick = async () => {
      this.simulationTimer = null;
      if (!this.worker) return;
      try {
        const response = await this.request('eval', { code: 'step()', filename: '<BluePlay>', mode: 'expression' });
        this.publish(response);
        const stage = this.stageOf(response);
        if (response?.kind !== 'error' && stage?.running) this.simulationTimer = window.setTimeout(tick, Math.max(16, 110 - Number(stage.speed || 50)));
      } catch { this.stopSimulation(); }
    };
    this.simulationTimer = window.setTimeout(tick, 0);
  }
  async execute(request: any): Promise<any> {
    const rawMethod = String(request.name || request.callableId || '').replace(/<.*>$/, '');
    const methodParts = rawMethod.split('.');
    const methodName = methodParts.length >= 3 ? methodParts[methodParts.length - 2] : rawMethod;
    const response = await this.request(request.op === 'eval' ? 'eval' : request.op, { code: request.code, filename: request.filename, className: request.className, args: request.args ? JSON.parse(request.args).join(', ') : '', name: request.name, objectId: request.objectId, methodName, property: request.property, value: request.value, text: request.text, generationId: request.generationId, mode: request.mode });
    this.publish(response);
    const stage = this.stageOf(response);
    if (request.op === 'eval' && (/\bstop\s*\(/.test(request.code || '') || stage?.running === false)) this.stopSimulation();
    if (request.op === 'eval' && /\bstart\s*\(/.test(request.code || '') && stage?.running) this.scheduleSimulation();
    return response;
  }
  async createObject(classId: string, _constructorId: string, _typeArguments: TypeRef[], args: string[], name: string): Promise<Value> { return this.execute({ op: 'create', className: classId, args: JSON.stringify(args), name }); }
  async invokeMethod(objectId: string, callableId: string, _typeArguments: TypeRef[], args: string[]): Promise<Value> { return this.execute({ op: 'invoke', objectId, name: callableId, args: JSON.stringify(args) }); }
  async inspectObject(objectId: string): Promise<unknown> { return this.execute({ op: 'inspect', objectId }); }
  async evaluate(code: string, mode: 'expression' | 'block'): Promise<Value> { return this.execute({ op: 'eval', code, mode }); }
  async removeObject(objectId: string): Promise<void> { await this.execute({ op: 'remove', objectId }); }
  async sendInput(text: string): Promise<any> { return this.execute({ op: 'input', text }); }
  async sendKey(key: string, pressed: boolean): Promise<void> { await this.execute({ op: 'key', key, pressed }); }
  async sendClick(x: number, y: number): Promise<void> { await this.execute({ op: 'click', x, y }); }
  async status(): Promise<RuntimeStatus> { return { workerAlive: Boolean(this.worker), generationId: this.generationId, available: Boolean(this.worker), error: null }; }
  async stop(): Promise<void> { this.stopWorker(); this.generationId = null; }
  async reset(): Promise<void> { await this.request('reset'); }
  stageStream(onStage: (value: any) => void): () => void { this.stageListeners.add(onStage); return () => this.stageListeners.delete(onStage); }
  events(): Promise<any[]> { return Promise.resolve([]); }
  attachCanvas(_canvas: HTMLCanvasElement): boolean { return false; }
}
