import type { ClassMeta, CompileResult, ProjectFile, RuntimeClient, RuntimeStatus, TypeRef, Value } from '../../runtime-contract/src/index.js';

type Resource = { path: string; data: string };
type Action = { op: string; [key: string]: unknown };

export class HttpRuntimeClient implements RuntimeClient {
  constructor(public readonly sessionId: string, private readonly onFailure: (message: string) => void = () => undefined) {}

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`/api/session/${this.sessionId}${path}`, init);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body.message || `Runtime request failed (${response.status}).`;
      if (response.status === 409 || response.status === 503 || response.status === 504) this.onFailure(message);
      throw new Error(message);
    }
    return response;
  }

  async execute(request: Action): Promise<Value & { output?: string; stage?: unknown; name?: string }> {
    const response = await this.request('/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
    return response.json();
  }

  async compile(files: ProjectFile[], revision: number, resources: Resource[] = []): Promise<CompileResult> {
    const response = await this.request('/compile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files, resources, revision }) });
    return response.json();
  }

  async createObject(classId: string, constructorId: string, typeArguments: TypeRef[], args: string[], name: string): Promise<Value> {
    return this.execute({ op: 'create', className: classId, constructorId, typeArguments: JSON.stringify(typeArguments), args: JSON.stringify(args), name });
  }

  async invokeMethod(objectId: string, callableId: string, typeArguments: TypeRef[], args: string[]): Promise<Value> {
    return this.execute({ op: 'invoke', objectId, name: callableId, typeArguments: JSON.stringify(typeArguments), args: JSON.stringify(args) });
  }

  async inspectObject(objectId: string): Promise<unknown> { return this.execute({ op: 'inspect', objectId }); }
  async evaluate(code: string, mode: 'expression' | 'block'): Promise<Value> { return this.execute({ op: 'eval', code, mode }); }
  async removeObject(objectId: string): Promise<void> { await this.execute({ op: 'remove', objectId }); }
  async sendInput(text: string): Promise<void> { await this.request('/input', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) }); }
  async stop(): Promise<void> { await this.request('/stop', { method: 'POST' }); }
  async reset(): Promise<void> { await this.stop(); }

  async sendKey(key: string, pressed: boolean): Promise<void> { await this.request('/key', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, pressed }) }); }
  async sendClick(x: number, y: number): Promise<void> { await this.request('/click', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x, y }) }); }
  async stage(): Promise<any> { return (await this.request('/stage')).json(); }
  stageStream(onStage: (value: any) => void): () => void { const stream = new EventSource(`/api/session/${this.sessionId}/stage-stream`); stream.onmessage = event => { try { const value = JSON.parse(event.data); if (value?.stage) onStage(value); } catch { /* ignore malformed stream events */ } }; return () => stream.close(); }
  async events(): Promise<any[]> { return (await this.request('/events')).json(); }
  async status(): Promise<RuntimeStatus> { return (await this.request('/status')).json(); }
}

type BrowserAction = { op: 'load'; url: string; packageName: string } | { op: 'main' } | { op: 'run' } | { op: 'act' } | { op: 'pause' } | { op: 'stage' } | { op: 'speed'; value: number } | { op: 'key'; key: string; pressed: boolean } | { op: 'click'; x: number; y: number } | { op: 'create'; functionName: string; args: unknown[]; className: string; name: string } | { op: 'invoke'; functionName: string; objectId: string; args: unknown[]; className: string } | { op: 'inspect'; objectId: string } | { op: 'remove'; objectId: string } | { op: 'stop' };

const parseKotlinArgument = (value: string, bindings: Map<string, unknown>): unknown => {
  const text = value.trim();
  if (bindings.has(text)) return { __bluekObjectId: bindings.get(text) };
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?(?:\d+\.\d*|\d*\.\d+)$/.test(text)) return Number(text);
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    try { return JSON.parse(text); } catch { return text.slice(1, -1); }
  }
  throw new Error(`This local action only supports simple Kotlin arguments; compile the expression first: ${text}`);
};
const splitSimpleArguments = (source: string): string[] => { const result: string[] = []; let start = 0; let depth = 0; let quote = ''; let escaped = false; for (let index = 0; index < source.length; index += 1) { const char = source[index]; if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = ''; continue; } if (char === '"' || char === "'") { quote = char; continue; } if (char === '(') depth += 1; else if (char === ')') depth -= 1; else if (char === ',' && depth === 0) { result.push(source.slice(start, index).trim()); start = index + 1; } } if (source.slice(start).trim()) result.push(source.slice(start).trim()); return result; };
const simpleCodepadCall = (code: string): { binding?: string; receiver?: string; callable: string; args: string[] } | null => { const match = code.trim().replace(/;$/, '').match(/^(?:(?:val|var)\s+([A-Za-z_]\w*)\s*=\s*)?([A-Za-z_]\w*)(?:\.([A-Za-z_]\w*))?\s*\((.*)\)$/s); return match ? { binding: match[1], receiver: match[3] ? match[2] : undefined, callable: match[3] || match[2], args: splitSimpleArguments(match[4]) } : null; };

const browserWorkerSource = `
let api = null;
let timer = null;
const objects = new Map();
const displayValues = new Map();
const valueOf = (value, className = '') => {
  if (value === undefined || value === null) return { kind: value === null ? 'null' : 'unit', display: value === null ? 'null' : 'Unit' };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return { kind: 'scalar', display: String(value) };
  const objectId = crypto.randomUUID(); objects.set(objectId, value); const display = className || value.constructor?.name || 'Object'; displayValues.set(objectId, display); return { kind: 'object', display, objectId };
};
const resolve = (path) => path.split('.').filter(Boolean).reduce((current, part) => current?.[part], api);
const resolveArguments = (args) => args.map((arg) => arg && typeof arg === 'object' && arg.__bluekObjectId ? objects.get(arg.__bluekObjectId) : arg);
const finish = () => self.postMessage({ kind: 'value', value: { kind: 'unit', display: 'Unit' } });
const stage = () => { const value = api.bluekStage || resolve('bluekStage'); if (typeof value === 'function') self.postMessage({ kind: 'stage', stage: JSON.parse(value()) }); };
self.onmessage = async ({ data }) => {
  try {
    if (data.op === 'load') { await import(new URL('kotlin-kotlin-stdlib.js', data.url).href); const moduleValue = await import(data.url); const exported = globalThis['bluek-browser-runtime'] || moduleValue.default || moduleValue; api = data.packageName ? (exported[data.packageName] || data.packageName.split('.').reduce((v, p) => v?.[p], exported)) : exported; if (!api || typeof api !== 'object') api = exported; self.postMessage({ kind: 'ready' }); return; }
    if (!api) throw new Error('Browser Kotlin runtime is not loaded.');
    if (data.op === 'main') { const start = api.bluekStart || resolve('bluekStart'); if (!start) throw new Error('This project has no parameterless main().'); start(); stage(); self.postMessage({ kind: 'value', value: { kind: 'unit', display: 'Unit' } }); return; }
    if (data.op === 'run') { const run = api.start || resolve('start'); if (typeof run === 'function') run(); clearInterval(timer); timer = setInterval(() => { const tick = api.bluekStep || resolve('bluekStep'); if (typeof tick === 'function') tick(); stage(); }, 16); stage(); self.postMessage({ kind: 'value', value: { kind: 'unit', display: 'Unit' } }); return; }
    if (data.op === 'stage') { stage(); finish(); return; }
    if (data.op === 'act') { const act = api.bluekAct || resolve('bluekAct'); if (typeof act === 'function') act(); stage(); finish(); return; }
    if (data.op === 'pause') { const pause = api.bluekPause || resolve('bluekPause'); if (typeof pause === 'function') pause(); stage(); finish(); return; }
    if (data.op === 'speed') { const speed = api.bluekSetSpeed || resolve('bluekSetSpeed'); if (typeof speed === 'function') speed(data.value); stage(); finish(); return; }
    if (data.op === 'key') { const key = api.bluekKey || resolve('bluekKey'); if (typeof key === 'function') key(data.key, data.pressed); return; }
    if (data.op === 'click') { const click = api.bluekClick || resolve('bluekClick'); if (typeof click === 'function') click(data.x, data.y); return; }
    if (data.op === 'create') { const fn = api[data.functionName] || resolve(data.functionName); if (typeof fn !== 'function') throw new Error('Generated constructor bridge is missing: ' + data.functionName); const object = fn(...resolveArguments(data.args)); const objectId = crypto.randomUUID(); objects.set(objectId, object); displayValues.set(objectId, data.className + '()'); self.postMessage({ kind: 'value', value: { kind: 'object', display: data.className + '()', objectId }, objectId, name: data.name }); return; }
    if (data.op === 'invoke') { const receiver = objects.get(data.objectId); if (!receiver) throw new Error('Object handle is no longer available.'); const fn = api[data.functionName] || resolve(data.functionName); if (typeof fn !== 'function') throw new Error('Generated method bridge is missing: ' + data.functionName); self.postMessage({ kind: 'value', value: valueOf(fn(receiver, ...resolveArguments(data.args)), data.className) }); return; }
    if (data.op === 'inspect') { const object = objects.get(data.objectId); if (!object) throw new Error('Object handle is no longer available.'); const fields = Object.entries(object).filter(([key]) => !key.startsWith('$')).map(([name, value]) => ({ name, value: valueOf(value).display })); self.postMessage({ kind: 'value', value: { kind: 'object', objectId: data.objectId, fields } }); return; }
    if (data.op === 'remove') { objects.delete(data.objectId); displayValues.delete(data.objectId); self.postMessage({ kind: 'value', value: { kind: 'unit', display: 'Unit' } }); return; }
    if (data.op === 'stop') { clearInterval(timer); close(); return; }
  } catch (error) { self.postMessage({ kind: 'error', message: error instanceof Error ? error.message : String(error) }); }
};`;

export class HybridRuntimeClient implements RuntimeClient {
  private readonly http: HttpRuntimeClient;
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private classes: ClassMeta[] = [];
  private readonly bindings = new Map<string, unknown>();
  private readonly localObjects = new Map<string, unknown>();
  private browserGeneration: string | null = null;
  private latestStage: any = null;

  constructor(sessionId: string, onFailure?: (message: string) => void) { this.http = new HttpRuntimeClient(sessionId, onFailure); }
  private async local(request: BrowserAction): Promise<any> {
    if (!this.worker || !this.ready) throw new Error('Browser runtime is not available.');
    await this.ready;
    return new Promise((resolve, reject) => {
      const worker = this.worker!;
      const onMessage = (event: MessageEvent) => { if (event.data?.kind === 'value' || event.data?.kind === 'ready') { worker.removeEventListener('message', onMessage); resolve(event.data); } else if (event.data?.kind === 'error') { worker.removeEventListener('message', onMessage); reject(new Error(event.data.message)); } };
      worker.addEventListener('message', onMessage);
      worker.postMessage(request);
    });
  }
  async execute(request: Action): Promise<Value & { output?: string; stage?: unknown; name?: string }> {
    if (this.worker && this.ready && request.op === 'main') { const result = await this.local({ op: 'main' }); return result.value; }
    if (this.worker && this.ready && request.op === 'eval') {
      const code = String(request.code || '').replace(/\s+/g, '');
      const localAction = code === 'start()' ? { op: 'run' as const } : code === 'stop()' ? { op: 'pause' as const } : code === 'step()' ? { op: 'act' as const } : code === 'show()' ? { op: 'stage' as const } : code.startsWith('setSpeed(') && code.endsWith(')') ? { op: 'speed' as const, value: Number(code.slice(9, -1)) } : null;
      if (localAction) { const result = await this.local(localAction); return result.value; }
    }
    if (this.worker && this.ready && request.op === 'create') {
      const klass = this.classes.find(value => value.name === request.className); const constructor = klass?.constructors.find(value => value.id === request.constructorId) || klass?.constructors[0];
      if (klass && constructor && !(constructor.parameters || []).some(parameter => parameter.hasDefault)) {
        const args = JSON.parse(String(request.args || '[]')).map((value: string) => parseKotlinArgument(value, this.bindings)); const functionName = `bluekCreate_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}`;
        const result = await this.local({ op: 'create', functionName, args, className: klass.name, name: String(request.name || klass.name.toLowerCase()) });
        if (result.objectId) this.localObjects.set(result.objectId, klass.name); if (result.name) this.bindings.set(result.name, result.objectId); return result.value;
      }
    }
    if (this.worker && this.ready && request.op === 'eval') {
      const parsed = simpleCodepadCall(String(request.code || ''));
      if (parsed) {
        if (parsed.receiver) {
          const objectId = this.bindings.get(parsed.receiver);
          const localClassName = objectId ? this.localObjects.get(String(objectId)) : undefined;
          const klass = this.classes.find(value => value.name === localClassName);
          const method = klass?.methods.find(value => value.name === parsed.callable);
          if (objectId && klass && method && !method.parameters.some(parameter => parameter.hasDefault) && !method.typeParameters?.length) {
            const args = parsed.args.map(value => parseKotlinArgument(value, this.bindings));
            const methodKey = `${method.name.replace(/[^A-Za-z0-9_]/g, '_')}_${method.parameters.map(parameter => parameter.type.classifier.replace(/[^A-Za-z0-9_]/g, '_')).join('_') || 'noargs'}`;
            const result = await this.local({ op: 'invoke', functionName: `bluekInvoke_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}_${methodKey}`, objectId: String(objectId), args, className: method.returnType.classifier });
            return parsed.binding ? { ...result.value, name: parsed.binding } : result.value;
          }
        } else {
          const klass = this.classes.find(value => value.name === parsed.callable);
          const constructor = klass?.constructors[0];
          if (klass && constructor && !constructor.parameters.some(parameter => parameter.hasDefault)) {
            const result = await this.local({ op: 'create', functionName: `bluekCreate_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}`, args: parsed.args.map(value => parseKotlinArgument(value, this.bindings)), className: klass.name, name: parsed.binding || klass.name.toLowerCase() });
            if (result.objectId) this.localObjects.set(result.objectId, klass.name);
            if (parsed.binding && result.objectId) this.bindings.set(parsed.binding, result.objectId);
            return result.value;
          }
        }
      }
      throw new Error('This Codepad expression is not prepared for local Kotlin/JS execution yet.');
    }
    if (this.worker && this.ready && request.op === 'invoke') {
      const object = this.localObjects.has(String(request.objectId)); const localClassName = this.localObjects.get(String(request.objectId)); const klass = this.classes.find(value => value.name === localClassName);
      const method = klass?.methods.find(value => value.name === request.name); if (object && klass && method && !method.parameters.some(parameter => parameter.hasDefault) && !method.typeParameters?.length) {
        const args = JSON.parse(String(request.args || '[]')).map((value: string) => parseKotlinArgument(value, this.bindings)); const methodKey = `${method.name.replace(/[^A-Za-z0-9_]/g, '_')}_${method.parameters.map(parameter => parameter.type.classifier.replace(/[^A-Za-z0-9_]/g, '_')).join('_') || 'noargs'}`; const functionName = `bluekInvoke_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}_${methodKey}`;
        const result = await this.local({ op: 'invoke', functionName, objectId: String(request.objectId), args, className: method.returnType.classifier }); return result.value;
      }
    }
    if (this.worker && this.ready && ['create', 'invoke', 'eval', 'inspect', 'remove'].includes(request.op)) throw new Error('This Kotlin expression is not prepared for local execution yet. Compile it before running it.');
    return this.http.execute(request);
  }
  async compile(files: ProjectFile[], revision: number, resources: Resource[] = []): Promise<CompileResult> {
    const result = await this.http.compile(files, revision, resources); this.classes = result.classes; this.localObjects.clear(); this.bindings.clear(); this.latestStage = null;
    if (result.browserRuntime) {
      this.browserGeneration = result.generationId;
      this.worker?.terminate(); this.worker = new Worker(URL.createObjectURL(new Blob([browserWorkerSource], { type: 'text/javascript' })), { type: 'module' });
      this.ready = new Promise((resolve, reject) => { const worker = this.worker!; const listener = (event: MessageEvent) => { if (event.data?.kind === 'ready') { worker.removeEventListener('message', listener); resolve(); } if (event.data?.kind === 'error') reject(new Error(event.data.message)); }; worker.addEventListener('message', listener); worker.postMessage({ op: 'load', url: new URL(`/api/session/${this.http.sessionId}/browser/${result.browserRuntime!.entry}`, window.location.origin).href, packageName: result.browserRuntime!.packageName }); });
    } else { this.browserGeneration = null; this.worker?.terminate(); this.worker = null; this.ready = null; }
    return result;
  }
  createObject(classId: string, constructorId: string, typeArguments: TypeRef[], args: string[], name: string): Promise<Value> { return this.execute({ op: 'create', className: classId, constructorId, typeArguments: JSON.stringify(typeArguments), args: JSON.stringify(args), name }); }
  invokeMethod(objectId: string, callableId: string, typeArguments: TypeRef[], args: string[]): Promise<Value> { return this.execute({ op: 'invoke', objectId, name: callableId, typeArguments: JSON.stringify(typeArguments), args: JSON.stringify(args) }); }
  async inspectObject(objectId: string): Promise<unknown> { if (this.worker && this.ready) return (await this.local({ op: 'inspect', objectId })).value; return this.http.inspectObject(objectId); }
  async evaluate(code: string, mode: 'expression' | 'block'): Promise<Value> { if (this.worker && this.ready) throw new Error('This expression is not prepared for local Kotlin/JS execution yet.'); return this.http.evaluate(code, mode); }
  async removeObject(objectId: string): Promise<void> { this.localObjects.delete(objectId); if (this.worker && this.ready) { await this.local({ op: 'remove', objectId }); return; } await this.http.removeObject(objectId); }
  sendInput(text: string): Promise<void> { if (this.worker) return Promise.reject(new Error('Terminal input is not connected to the local Kotlin/JS worker yet.')); return this.http.sendInput(text); }
  async stop(): Promise<void> { const hadBrowserWorker = Boolean(this.worker); this.worker?.terminate(); this.worker = null; this.ready = null; this.browserGeneration = null; if (!hadBrowserWorker) await this.http.stop(); }
  reset(): Promise<void> { return this.stop(); }
  sendKey(key: string, pressed: boolean): Promise<void> { if (this.worker && this.ready) { return this.ready.then(() => { this.worker!.postMessage({ op: 'key', key, pressed }); }); } return this.http.sendKey(key, pressed); }
  sendClick(x: number, y: number): Promise<void> { if (this.worker && this.ready) { return this.ready.then(() => { this.worker!.postMessage({ op: 'click', x, y }); }); } return this.http.sendClick(x, y); }
  stage(): Promise<any> { if (this.worker) { this.worker.postMessage({ op: 'stage' }); return Promise.resolve({ stage: this.latestStage }); } return this.http.stage(); }
  stageStream(onStage: (value: any) => void): () => void { if (!this.worker || !this.ready) return this.http.stageStream(onStage); const worker = this.worker; const listener = (event: MessageEvent) => { if (event.data?.kind === 'stage') { this.latestStage = event.data.stage; onStage({ stage: event.data.stage }); } }; worker.addEventListener('message', listener); this.ready.then(() => worker.postMessage({ op: 'stage' })); return () => worker.removeEventListener('message', listener); }
  events(): Promise<any[]> { return this.worker ? Promise.resolve([]) : this.http.events(); }
  status(): Promise<RuntimeStatus> { return this.worker ? Promise.resolve({ workerAlive: true, generationId: this.browserGeneration, available: true, error: null }) : this.http.status(); }
}

export type { ClassMeta };
