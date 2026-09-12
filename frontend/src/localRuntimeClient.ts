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

export class LocalRuntimeClient implements RuntimeClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private generationId: string | null = null;
  private classes: ClassMeta[] = [];
  constructor(private readonly onFailure: (message: string) => void = () => undefined, private readonly onOutput: (output?: string) => void = () => undefined) {}
  private start() { if (this.worker) return; this.worker = new Worker(new URL('./localRuntimeWorker.ts', import.meta.url), { type: 'module' }); this.worker.onmessage = event => { const pending = this.pending.get(event.data.id); if (!pending) return; this.pending.delete(event.data.id); pending.resolve(event.data.response); }; this.worker.onerror = event => { this.onFailure(event.message || 'Kotlite worker stopped.'); }; }
  private request(op: string, data: Record<string, unknown> = {}): Promise<any> { this.start(); const id = this.nextId++; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.worker!.postMessage({ id, op, ...data }); }); }
  async compile(files: ProjectFile[], revision: number, ..._unused: unknown[]): Promise<CompileResult> { this.worker?.terminate(); this.worker = null; this.classes = metadata(files); const response = await this.request('compile', { files }); if (response.kind === 'error') return { generationId: '', sourceRevision: revision, classes: [], diagnostics: [{ fileName: '<Kotlite>', line: 1, column: 1, severity: 'error', message: response.display }] }; this.generationId = crypto.randomUUID(); return { generationId: this.generationId, sourceRevision: revision, classes: this.classes, diagnostics: [] }; }
  async execute(request: any): Promise<any> {
    const rawMethod = String(request.name || request.callableId || '').replace(/<.*>$/, '');
    const methodParts = rawMethod.split('.');
    const methodName = methodParts.length >= 3 ? methodParts[methodParts.length - 2] : rawMethod;
    return this.request(request.op === 'eval' ? 'eval' : request.op, { code: request.code, filename: request.filename, className: request.className, args: request.args ? JSON.parse(request.args).join(', ') : '', name: request.name, objectId: request.objectId, methodName, generationId: request.generationId });
  }
  async createObject(classId: string, _constructorId: string, _typeArguments: TypeRef[], args: string[], name: string): Promise<Value> { return this.execute({ op: 'create', className: classId, args: JSON.stringify(args), name }); }
  async invokeMethod(objectId: string, callableId: string, _typeArguments: TypeRef[], args: string[]): Promise<Value> { return this.execute({ op: 'invoke', objectId, name: callableId, args: JSON.stringify(args) }); }
  async inspectObject(objectId: string): Promise<unknown> { return this.execute({ op: 'inspect', objectId }); }
  async evaluate(code: string, mode: 'expression' | 'block'): Promise<Value> { return this.execute({ op: 'eval', code, mode }); }
  async removeObject(objectId: string): Promise<void> { await this.execute({ op: 'remove', objectId }); }
  async sendInput(_text: string): Promise<void> { throw new Error('Kotlite console input is not yet supported in the local adapter.'); }
  async sendKey(_key: string, _pressed: boolean): Promise<void> {}
  async sendClick(_x: number, _y: number): Promise<void> {}
  async status(): Promise<RuntimeStatus> { return { workerAlive: Boolean(this.worker), generationId: this.generationId, available: Boolean(this.worker), error: null }; }
  async stop(): Promise<void> { this.worker?.terminate(); this.worker = null; this.generationId = null; for (const pending of this.pending.values()) pending.reject(new Error('Kotlite worker stopped.')); this.pending.clear(); }
  async reset(): Promise<void> { await this.request('reset'); }
  stageStream(_onStage: (value: any) => void): () => void { return () => undefined; }
  events(): Promise<any[]> { return Promise.resolve([]); }
  attachCanvas(_canvas: HTMLCanvasElement): boolean { return false; }
}
