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

  async compileCodepad(source: string, generationId: string, bindings: Array<string | { name: string; type: string }> = []): Promise<{ entry: string }> {
    const response = await this.request('/codepad', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source, generationId, bindings }) });
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

type BrowserAction = { op: 'load'; url: string; packageName: string } | { op: 'codepad'; url: string; bindings?: Record<string, unknown> } | { op: 'main' } | { op: 'run' } | { op: 'act' } | { op: 'pause' } | { op: 'stage' } | { op: 'speed'; value: number } | { op: 'key'; key: string; pressed: boolean } | { op: 'click'; x: number; y: number } | { op: 'write'; text: string; newline: boolean } | { op: 'create'; functionName: string; args: unknown[]; className: string; name: string } | { op: 'invoke'; functionName: string; objectId: string; args: unknown[]; className: string; methodName?: string; typeName?: string } | { op: 'get'; objectId: string; property: string; className: string } | { op: 'set'; objectId: string; property: string; className: string; value: unknown } | { op: 'inspect'; objectId: string; className?: string } | { op: 'remove'; objectId: string } | { op: 'stop' };

const parseKotlinArgument = (value: string, bindings: Map<string, unknown>, values: Map<string, unknown> = new Map()): unknown => {
  const text = value.trim().replace(/^[A-Za-z_]\w*\s*=\s*/, '');
  if (bindings.has(text)) return { __bluekObjectId: bindings.get(text) };
  if (values.has(text)) return values.get(text);
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?(?:\d+\.\d*|\d*\.\d+)$/.test(text)) return Number(text);
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1);
    const raw = text.slice(1, -1);
    return raw.replace(/\\?\$\{([^}]+)\}|\\?\$([A-Za-z_]\w*)/g, (match, expression, name) => {
      const key = String(expression || name).trim();
      if (values.has(key)) return String(values.get(key));
      if (bindings.has(key)) return String(bindings.get(key));
      return match;
    }).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  throw new Error(`This local action only supports simple Kotlin arguments; compile the expression first: ${text}`);
};
const simpleArgumentMatches = (value: unknown, type: TypeRef): boolean => {
  if (value && typeof value === 'object' && '__bluekObjectId' in value) return true;
  if (value === null) return type.nullable;
  const classifier = type.classifier.split('.').pop() || type.classifier;
  if (classifier === 'String' || classifier === 'Char') return typeof value === 'string';
  if (classifier === 'Boolean') return typeof value === 'boolean';
  if (['Byte', 'Short', 'Int', 'Long'].includes(classifier)) return typeof value === 'number' && Number.isInteger(value);
  if (['Float', 'Double'].includes(classifier)) return typeof value === 'number';
  return true;
};
const simpleArgumentsMatch = (args: unknown[], parameters: { type: TypeRef }[]) => args.every((value, index) => !parameters[index] || simpleArgumentMatches(value, parameters[index].type));
const splitSimpleArguments = (source: string): string[] => { const result: string[] = []; let start = 0; let depth = 0; let quote = ''; let escaped = false; for (let index = 0; index < source.length; index += 1) { const char = source[index]; if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = ''; continue; } if (char === '"' || char === "'") { quote = char; continue; } if (char === '(') depth += 1; else if (char === ')') depth -= 1; else if (char === ',' && depth === 0) { result.push(source.slice(start, index).trim()); start = index + 1; } } if (source.slice(start).trim()) result.push(source.slice(start).trim()); return result; };
const splitCodepadStatements = (source: string): string[] => { const result: string[] = []; let start = 0; let round = 0; let curly = 0; let square = 0; let quote = ''; let escaped = false; const push = (end: number) => { const statement = source.slice(start, end).trim(); if (statement) result.push(statement); start = end + 1; }; for (let index = 0; index < source.length; index += 1) { const char = source[index]; if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = ''; continue; } if (char === '"' || char === "'") { quote = char; continue; } if (char === '(') round += 1; else if (char === ')') round = Math.max(0, round - 1); else if (char === '{') curly += 1; else if (char === '}') curly = Math.max(0, curly - 1); else if (char === '[') square += 1; else if (char === ']') square = Math.max(0, square - 1); else if ((char === ';' || char === '\n') && round === 0 && curly === 0 && square === 0) push(index); } const last = source.slice(start).trim(); if (last) result.push(last); return result; };
const simpleCodepadCall = (code: string): { binding?: string; receiver?: string; callable: string; args: string[]; typeArguments: string[] } | null => { const match = code.trim().replace(/;$/, '').match(/^(?:(?:val|var)\s+([A-Za-z_]\w*)(?:\s*:\s*[^=]+)?\s*=\s*)?([A-Za-z_]\w*)(?:<([^>]*)>)?(?:\.([A-Za-z_]\w*)(?:<([^>]*)>)?)?\s*\((.*)\)$/s); if (!match) return null; const typeText = match[4] ? match[5] || '' : match[3] || ''; return { binding: match[1], receiver: match[4] ? match[2] : undefined, callable: match[4] || match[2], args: splitSimpleArguments(match[6]), typeArguments: typeText ? typeText.split(',').map(value => value.trim()).filter(Boolean) : [] }; };
const simpleCodepadProperty = (code: string): { receiver: string; property: string } | null => { const match = code.trim().replace(/;$/, '').match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/); return match ? { receiver: match[1], property: match[2] } : null; };
const simpleCodepadPropertyAssignment = (code: string): { receiver: string; property: string; value: string } | null => { const match = code.trim().replace(/;$/, '').match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*=\s*(.+)$/s); return match ? { receiver: match[1], property: match[2], value: match[3].trim() } : null; };
const simpleCodepadDeclaration = (code: string): { mutable: boolean; name: string; explicitType?: string; value: string } | null => { const match = code.trim().replace(/;$/, '').match(/^(val|var)\s+([A-Za-z_]\w*)(?:\s*:\s*([^=]+?))?\s*=\s*(.+)$/s); return match ? { mutable: match[1] === 'var', name: match[2], explicitType: match[3]?.trim(), value: match[4].trim() } : null; };
const simpleCodepadAssignment = (code: string): { name: string; value: string } | null => { const match = code.trim().replace(/;$/, '').match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/s); return match ? { name: match[1], value: match[2].trim() } : null; };
const simpleCodepadIdentifier = (code: string) => code.trim().replace(/;$/, '').match(/^[A-Za-z_]\w*$/)?.[0] || null;
const requiredParameters = (parameters: any[] = []) => parameters.filter(parameter => !parameter.hasDefault);
const simpleCallableMatches = (args: unknown[], parameters: any[] = []) => args.length >= requiredParameters(parameters).length && args.length <= parameters.length && simpleArgumentsMatch(args, parameters.slice(0, args.length));
const stripExpressionParentheses = (source: string) => { let value = source.trim(); while (value.startsWith('(') && value.endsWith(')')) { let depth = 0, quote = '', escaped = false, closesAt = -1; for (let index = 0; index < value.length; index += 1) { const char = value[index]; if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = ''; continue; } if (char === '"' || char === "'") { quote = char; continue; } if (char === '(') depth += 1; else if (char === ')' && --depth === 0) { closesAt = index; break; } } if (closesAt !== value.length - 1) break; value = value.slice(1, -1).trim(); } return value; };
const topLevelBinary = (source: string): { left: string; operator: string; right: string } | null => {
  const operators = ['||', '&&', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '%'];
  const value = stripExpressionParentheses(source); let quote = '', escaped = false, round = 0, curly = 0, square = 0;
  for (const operator of operators) {
    let found = -1;
    for (let index = value.length - operator.length; index >= 0; index -= 1) {
      const char = value[index];
      if (char === '"' || char === "'") { let before = index - 1, slashCount = 0; while (before >= 0 && value[before--] === '\\') slashCount += 1; if (slashCount % 2 === 0) quote = quote ? '' : char; continue; }
      if (quote) continue;
      if (char === ')') round += 1; else if (char === '(') round -= 1; else if (char === '}') curly += 1; else if (char === '{') curly -= 1; else if (char === ']') square += 1; else if (char === '[') square -= 1;
      if (!round && !curly && !square && value.slice(index, index + operator.length) === operator && (operator !== '-' || index > 0 && !'+-*/%(<>=!&|'.includes(value[index - 1]))) { found = index; break; }
    }
    if (found > 0 && found < value.length - operator.length) return { left: value.slice(0, found).trim(), operator, right: value.slice(found + operator.length).trim() };
  }
  return null;
};
const simpleBuiltin = (source: string, bindings: Map<string, unknown>, values: Map<string, unknown>): unknown => {
  const match = source.trim().match(/^(maxOf|minOf|abs|listOf|mutableListOf|arrayOf|setOf|mutableSetOf|emptyList|emptySet)\((.*)\)$/s);
  if (!match) return undefined;
  const args = splitSimpleArguments(match[2]).map(value => simpleCodepadValue(value, bindings, values));
  switch (match[1]) {
    case 'maxOf': return Math.max(...args.map(Number));
    case 'minOf': return Math.min(...args.map(Number));
    case 'abs': return Math.abs(Number(args[0]));
    case 'listOf':
    case 'mutableListOf':
    case 'arrayOf': return args;
    case 'setOf': return [...new Set(args)];
    case 'mutableSetOf': return [...new Set(args)];
    case 'emptyList':
    case 'emptySet': return [];
    default: return undefined;
  }
};
const simpleCodepadValue = (source: string, bindings: Map<string, unknown>, values: Map<string, unknown>): unknown => {
  const builtin = simpleBuiltin(source, bindings, values);
  if (builtin !== undefined) return builtin;
  return parseKotlinArgument(source, bindings, values);
};
const SIMPLE_UNIT = Symbol('unit');
const simpleValueType = (source: string, value: unknown, explicitType?: string): string | undefined => {
  if (explicitType) return explicitType;
  const trimmed = source.trim();
  if (/^(?:listOf|mutableListOf|arrayOf)\s*\(/.test(trimmed)) {
    const inner = trimmed.slice(trimmed.indexOf('(') + 1, -1);
    const args = splitSimpleArguments(inner).filter(Boolean);
    const element = args.length && args.every(item => /^-?\d+$/.test(item)) ? 'Int' : args.length && args.every(item => /^-?(?:\d+\.\d*|\d*\.\d+)$/.test(item)) ? 'Double' : 'Any?';
    return `Array<${element}>`;
  }
  if (typeof value === 'string') return 'String';
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'Int' : 'Double';
  if (Array.isArray(value)) return 'Array<Any?>';
  return undefined;
};
const simpleCollectionType = (value: unknown[]): string => {
  const element = value.length && value.every(item => typeof item === 'number' && Number.isInteger(item)) ? 'Int'
    : value.length && value.every(item => typeof item === 'number') ? 'Double'
      : value.length && value.every(item => typeof item === 'string') ? 'String' : 'Any?';
  return `Array<${element}>`;
};
const simpleCollectionCall = (receiver: unknown, callable: string, args: unknown[]): unknown => {
  const collection = Array.isArray(receiver) ? receiver : typeof receiver === 'string' && /^-?\d+(?:,-?\d+)+$/.test(receiver) ? receiver.split(',').map(Number) : null;
  if (!collection) return undefined;
  switch (callable) {
    case 'sum': return collection.reduce((sum, value) => sum + Number(value), 0);
    case 'average': return collection.length ? collection.reduce((sum, value) => sum + Number(value), 0) / collection.length : NaN;
    case 'count': return collection.length;
    case 'first': if (collection.length) return collection[0]; throw new Error('Collection is empty.');
    case 'last': if (collection.length) return collection[collection.length - 1]; throw new Error('Collection is empty.');
    case 'contains': return collection.some(value => value === args[0]);
    case 'add': if (!Array.isArray(receiver)) return undefined; receiver.push(args[0]); return SIMPLE_UNIT;
    case 'remove': { if (!Array.isArray(receiver)) return undefined; const index = receiver.findIndex(value => value === args[0]); if (index < 0) return false; receiver.splice(index, 1); return true; }
    case 'clear': if (!Array.isArray(receiver)) return undefined; receiver.splice(0, receiver.length); return SIMPLE_UNIT;
    case 'get': return collection[Number(args[0])];
    case 'joinToString': {
      const separator = args[0] === undefined ? ', ' : String(args[0]);
      return collection.join(separator);
    }
    case 'isEmpty': return collection.length === 0;
    default: return undefined;
  }
};
const displayedSimpleValue = (value: any): unknown => { if (!value || value.kind === 'unit') return undefined; if (value.kind === 'null') return null; if (value.kind === 'scalar') { if (value.display === 'true') return true; if (value.display === 'false') return false; if (/^-?\d+(?:\.\d+)?$/.test(value.display)) return Number(value.display); return value.display; } return value.display; };

export const browserWorkerSource = `
let api = null;
let runtimeApi = null;
let simulationTimer = null;
let renderTimer = null;
const objects = new Map();
const displayValues = new Map();
let outputBuffer = '';
let flushingOutput = false;
const MAX_OUTPUT_CHARS = 1_000_000;
let outputTruncated = false;
const appendOutputText = (text) => {
  if (outputTruncated) return;
  const remaining = MAX_OUTPUT_CHARS - outputBuffer.length;
  if (text.length <= remaining) { outputBuffer += text; return; }
  outputBuffer += text.slice(0, Math.max(0, remaining));
  outputBuffer += '\\n[Output truncated after 1,000,000 characters.]\\n';
  outputTruncated = true;
};
const takeOutput = () => { const output = outputBuffer; outputBuffer = ''; outputTruncated = false; return output; };
const inputBuffer = typeof SharedArrayBuffer === 'function' ? new SharedArrayBuffer(65540) : null;
const inputState = inputBuffer ? new Int32Array(inputBuffer, 0, 1) : null;
const inputBytes = inputBuffer ? new Uint8Array(inputBuffer, 4) : null;
const readInput = (nullable) => { if (!inputBuffer || !inputState || !inputBytes) throw new Error('Terminal input requires a cross-origin-isolated browser context.'); flushStudentOutput(); const pendingOutput = takeOutput(); Atomics.store(inputState, 0, 0); self.postMessage({ kind: 'input-request', output: pendingOutput }); Atomics.wait(inputState, 0, 0); const length = Atomics.load(inputState, 0); if (nullable && length < 0) return null; return new TextDecoder().decode(inputBytes.slice(0, Math.max(0, length))); };
globalThis.__bluekReadln = () => readInput(false);
globalThis.__bluekReadlnOrNull = () => readInput(true);
globalThis.__bluekPrint = (value, newline) => { appendOutputText(String(value ?? 'null') + (newline ? '\\n' : '')); };
const appendOutput = (value) => { const text = value.map(item => typeof item === 'string' ? item : String(item)).join(' '); appendOutputText(text + (flushingOutput ? '' : '\\n')); };
const originalConsoleLog = console.log;
console.log = (...args) => { appendOutput(args); originalConsoleLog(...args); };
console.error = (...args) => { appendOutput(args); };
const valueOf = (value, className = '') => {
  if (value === undefined || value === null) return { kind: value === null ? 'null' : 'unit', display: value === null ? 'null' : 'Unit' };
  // Kotlin/JS represents kotlin.Unit as a small singleton object rather than
  // JavaScript undefined. Treat it like Unit so assignments and other
  // statements do not create a meaningless object-bank entry.
  if (value?.constructor?.name === 'Unit') return { kind: 'unit', display: 'Unit' };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return { kind: 'scalar', display: String(value) };
  const objectId = crypto.randomUUID(); objects.set(objectId, value); const display = className || value.constructor?.name || 'Object'; displayValues.set(objectId, display); return { kind: 'object', display, objectId };
};
const resolve = (path) => path.split('.').filter(Boolean).reduce((current, part) => current?.[part], api);
const flushStudentOutput = () => { const flush = api?.bluekFlushOutput || resolve('bluekFlushOutput'); if (typeof flush !== 'function') return; flushingOutput = true; try { flush(); } finally { flushingOutput = false; } };
const resolveArguments = (args) => args.map((arg) => arg && typeof arg === 'object' && arg.__bluekObjectId ? objects.get(arg.__bluekObjectId) : arg);
const bindingValue = (descriptor) => { if (!descriptor || !descriptor.objectId) return descriptor?.value; const target = objects.get(descriptor.objectId); if (!target) throw new Error('Codepad object binding is no longer available.'); const methods = new Map((descriptor.methods || []).map((method) => [method.name, method])); const properties = new Map((descriptor.properties || []).map((property) => [property.name, property])); return new Proxy(target, { get(object, property) { if (typeof property !== 'string') return object[property]; const method = methods.get(property); if (method) return (...args) => api[method.bridge](object, ...args.map((arg) => arg && arg.__bluekObjectId ? objects.get(arg.__bluekObjectId) : arg)); const field = properties.get(property); if (field?.getter && typeof api[field.getter] === 'function') return api[field.getter](object); return object[property]; }, set(object, property, value) { const field = properties.get(property); if (field?.setter && typeof api[field.setter] === 'function') { api[field.setter](object, value && value.__bluekObjectId ? objects.get(value.__bluekObjectId) : value); return true; } object[property] = value; return true; } }); };
const bindingValueWithBridges = (descriptor) => { const resolveArgs = args => args.map(arg => arg && arg.__bluekObjectId ? objects.get(arg.__bluekObjectId) : arg); if (descriptor?.runtime) return (...args) => new runtimeApi[descriptor.runtime](...resolveArgs(args)); if (descriptor?.bridge) return (...args) => api[descriptor.bridge](...resolveArgs(args)); if (descriptor?.bridges) return (...args) => { const bridge = descriptor.bridges.find(candidate => candidate.arity === args.length) || descriptor.bridges[0]; if (!bridge || typeof api[bridge.name] !== 'function') throw new Error('Generated Kotlin bridge is missing.'); return api[bridge.name](...resolveArgs(args)); }; return bindingValue(descriptor); };
const finish = () => { flushStudentOutput(); const output = takeOutput(); self.postMessage({ kind: 'value', value: { kind: 'unit', display: 'Unit' }, output }); };
const stage = () => { const value = runtimeApi?.bluekStage || globalThis.bluekStage; if (typeof value === 'function') self.postMessage({ kind: 'stage', stage: JSON.parse(value()) }); };
self.addEventListener('message', ({ data }) => { if (data?.op === 'resources') { globalThis.__bluekPendingResourceSizes = data.sizes || {}; runtimeApi?.bluekSetResourceSizes?.(globalThis.__bluekPendingResourceSizes); } });
self.onmessage = async ({ data }) => {
  if (data?.op === 'resources') return;
  try {
    if (data.op === 'load') { await import(new URL('kotlin-kotlin-stdlib.js', data.url).href); runtimeApi = await import(new URL('bluek-runtime.js', data.url).href); const moduleValue = await import(data.url); const exported = globalThis['bluek-browser-runtime'] || moduleValue.default || moduleValue; api = data.packageName ? (exported[data.packageName] || data.packageName.split('.').reduce((v, p) => v?.[p], exported)) : exported; if (!api || typeof api !== 'object') api = exported; if (inputBuffer) self.postMessage({ kind: 'input-buffer', buffer: inputBuffer }); self.postMessage({ kind: 'ready' }); return; }
    if (!api) throw new Error('Browser Kotlin runtime is not loaded.');
    if (data.op === 'main') { const start = api.bluekStart || resolve('bluekStart'); if (!start) throw new Error('This project has no parameterless main().'); start(); stage(); flushStudentOutput(); const output = takeOutput(); self.postMessage({ kind: 'value', value: { kind: 'unit', display: 'Unit' }, output }); return; }
    if (data.op === 'codepad') { const previous = new Map(); Object.entries(data.bindings || {}).forEach(([name, descriptor]) => { previous.set(name, Object.prototype.hasOwnProperty.call(globalThis, name) ? globalThis[name] : undefined); globalThis[name] = bindingValueWithBridges(descriptor); }); try { const moduleValue = await import(data.url); const exported = globalThis['bluek-browser-runtime'] || moduleValue.default || moduleValue; const evaluate = moduleValue.bluekEval || exported?.bluekEval; if (typeof evaluate !== 'function') throw new Error('Codepad compiler bridge is missing.'); const value = valueOf(evaluate()); flushStudentOutput(); const output = takeOutput(); stage(); self.postMessage({ kind: 'value', value, output }); } finally { Object.entries(data.bindings || {}).forEach(([name]) => { const old = previous.get(name); if (old === undefined) delete globalThis[name]; else globalThis[name] = old; }); } return; }
    if (data.op === 'run') { const run = runtimeApi?.bluekRun || runtimeApi?.start || api.bluekRun || resolve('bluekRun') || resolve('start'); if (typeof run !== 'function') throw new Error('Browser BluePlay runtime is missing its run bridge.'); run(); clearTimeout(simulationTimer); clearInterval(renderTimer); const tick = runtimeApi?.bluekStep || resolve('bluekStep'); const isRunning = runtimeApi?.bluekIsRunning || resolve('bluekIsRunning'); const stopTimers = () => { clearTimeout(simulationTimer); clearInterval(renderTimer); simulationTimer = null; renderTimer = null; }; const simulate = () => { if (typeof tick === 'function') tick(); if (typeof isRunning === 'function' && !isRunning()) { stopTimers(); stage(); return; } simulationTimer = setTimeout(simulate, Math.max(1, 100 - Number(runtimeApi?.getSpeed?.() || resolve('getSpeed')?.() || 50))); }; simulationTimer = setTimeout(simulate, 0); renderTimer = setInterval(stage, 16); stage(); self.postMessage({ kind: 'value', value: { kind: 'unit', display: 'Unit' } }); return; }
    if (data.op === 'stage') { stage(); finish(); return; }
    if (data.op === 'write') { appendOutputText(String(data.text) + (data.newline ? '\\n' : '')); finish(); return; }
    if (data.op === 'act') { const act = runtimeApi?.bluekAct || resolve('bluekAct'); if (typeof act === 'function') act(); stage(); finish(); return; }
    if (data.op === 'pause') { const pause = runtimeApi?.bluekPause || resolve('bluekPause'); if (typeof pause === 'function') pause(); clearTimeout(simulationTimer); clearInterval(renderTimer); simulationTimer = null; renderTimer = null; stage(); finish(); return; }
    if (data.op === 'speed') { const speed = runtimeApi?.bluekSetSpeed || resolve('bluekSetSpeed'); if (typeof speed === 'function') speed(data.value); stage(); finish(); return; }
    if (data.op === 'key') { const key = runtimeApi?.bluekKey || resolve('bluekKey'); if (typeof key === 'function') key(data.key, data.pressed); self.postMessage({ kind: 'input-ack' }); return; }
    if (data.op === 'click') { const click = runtimeApi?.bluekClick || resolve('bluekClick'); if (typeof click === 'function') click(data.x, data.y); self.postMessage({ kind: 'input-ack' }); return; }
    if (data.op === 'create') { const fn = api[data.functionName] || resolve(data.functionName) || runtimeApi?.[data.className] || globalThis[data.className]; if (typeof fn !== 'function') throw new Error('Generated constructor bridge is missing: ' + data.functionName); const args = resolveArguments(data.args); const object = ['Actor', 'World', 'Image'].includes(String(data.className)) && (runtimeApi?.[data.className] === fn || globalThis[data.className] === fn) ? new fn(...args) : fn(...args); const objectId = crypto.randomUUID(); objects.set(objectId, object); displayValues.set(objectId, data.className + '()'); flushStudentOutput(); const output = takeOutput(); stage(); self.postMessage({ kind: 'value', value: { kind: 'object', display: data.className + '()', objectId }, objectId, name: data.name, output }); return; }
    if (data.op === 'invoke') { const receiver = data.objectId ? objects.get(data.objectId) : null; if (data.objectId && !receiver) throw new Error('Object handle is no longer available.'); const directName = String(data.methodName || '').replace(/<.*>$/, ''); const genericBridge = data.typeName && ({ getIntersecting: runtimeApi?.bluekActorGetIntersecting || resolve('bluekActorGetIntersecting'), getOneIntersecting: runtimeApi?.bluekActorGetOneIntersecting || resolve('bluekActorGetOneIntersecting'), isTouching: runtimeApi?.bluekActorIsTouching || resolve('bluekActorIsTouching'), removeTouching: runtimeApi?.bluekActorRemoveTouching || resolve('bluekActorRemoveTouching'), getObjects: runtimeApi?.bluekWorldAllObjects || resolve('bluekWorldAllObjects') }[directName]); const bridge = genericBridge || api[data.functionName] || resolve(data.functionName); const fn = typeof bridge === 'function' ? bridge : receiver && directName && typeof receiver[directName] === 'function' ? (target, ...args) => target[directName](...args) : null; if (typeof fn !== 'function') throw new Error('Generated method bridge is missing: ' + data.functionName); const resolvedArgs = resolveArguments(data.args); const value = valueOf(receiver ? fn(receiver, ...(genericBridge ? [data.typeName, ...resolvedArgs] : resolvedArgs)) : fn(...resolvedArgs), data.className); flushStudentOutput(); const output = takeOutput(); stage(); self.postMessage({ kind: 'value', value, output }); return; }
    if (data.op === 'get') { const object = objects.get(data.objectId); if (!object) throw new Error('Object handle is no longer available.'); const classKey = String(data.className || '').replace(/[^A-Za-z0-9_]/g, '_'); const stem = String(data.property).charAt(0).toUpperCase() + String(data.property).slice(1); const getter = api['bluekInvoke_' + classKey + '_get' + stem + '_noargs']; const value = typeof getter === 'function' ? getter(object) : object[data.property]; const output = takeOutput(); self.postMessage({ kind: 'value', value: valueOf(value), output }); return; }
    if (data.op === 'set') { const object = objects.get(data.objectId); if (!object) throw new Error('Object handle is no longer available.'); const classKey = String(data.className || '').replace(/[^A-Za-z0-9_]/g, '_'); const stem = String(data.property).charAt(0).toUpperCase() + String(data.property).slice(1); const setterKey = Object.keys(api).find((key) => key.startsWith('bluekInvoke_' + classKey + '_set' + stem + '_')); const setter = setterKey ? api[setterKey] : null; const value = resolveArguments([data.value])[0]; if (typeof setter === 'function') setter(object, value); else object[data.property] = value; stage(); finish(); return; }
    if (data.op === 'inspect') { const object = objects.get(data.objectId); if (!object) throw new Error('Object handle is no longer available.'); const entries = Object.entries(object).filter(([key]) => !key.startsWith('$')); const namesFn = data.className ? (api['bluekInspectNames_' + data.className] || resolve('bluekInspectNames_' + data.className)) : null; let names = []; if (typeof namesFn === 'function') { try { names = JSON.parse(namesFn()); } catch { names = []; } } const classKey = String(data.className || '').replace(/[^A-Za-z0-9_]/g, '_'); const getterValue = (name) => { const stem = name.charAt(0).toUpperCase() + name.slice(1); const getter = api['bluekInvoke_' + classKey + '_get' + stem + '_noargs']; if (typeof getter !== 'function') return undefined; try { return getter(object); } catch { return undefined; } }; const fields = names.length ? names.map((name, index) => { const value = getterValue(name); const entry = entries[index]; return { name, value: valueOf(value === undefined ? entry?.[1] : value).display }; }) : entries.map(([key, value]) => ({ name: key, value: valueOf(value).display })); self.postMessage({ kind: 'value', value: { kind: 'object', objectId: data.objectId, fields } }); return; }
    if (data.op === 'remove') { objects.delete(data.objectId); displayValues.delete(data.objectId); stage(); self.postMessage({ kind: 'value', value: { kind: 'unit', display: 'Unit' } }); return; }
    if (data.op === 'stop') { clearTimeout(simulationTimer); clearInterval(renderTimer); close(); return; }
  } catch (error) { self.postMessage({ kind: 'error', message: error instanceof Error ? error.message : String(error) }); }
};`;

export class HybridRuntimeClient implements RuntimeClient {
  private readonly http: HttpRuntimeClient;
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private classes: ClassMeta[] = [];
  private readonly bindings = new Map<string, unknown>();
  private readonly localValues = new Map<string, unknown>();
  private readonly localValueTypes = new Map<string, string>();
  private readonly localObjects = new Map<string, unknown>();
  private browserGeneration: string | null = null;
  private browserModuleUrl: string | null = null;
  private browserPackageName = '';
  private browserWorkerDead = false;
  private browserReady = false;
  private browserResourceSizes: Record<string, { width: number; height: number; alpha?: number[] }> = {};
  private inputBarrier: Promise<void> = Promise.resolve();
  private latestStage: any = null;
  private readonly stageCallbacks = new Map<(value: any) => void, (event: MessageEvent) => void>();
  private inputBuffer: SharedArrayBuffer | null = null;
  private readonly onInputRequest: (output?: string) => void;
  private readonly codepadModules = new Map<string, string>();

  private readonly onFailure: (message: string) => void;
  constructor(sessionId: string, onFailure?: (message: string) => void, onInputRequest: (output?: string) => void = () => undefined) { this.http = new HttpRuntimeClient(sessionId, onFailure); this.onFailure = onFailure || (() => undefined); this.onInputRequest = onInputRequest; }
  private attachStageCallbacks(worker: Worker): void {
    for (const callback of this.stageCallbacks.keys()) {
      const listener = (event: MessageEvent) => { if (event.data?.kind === 'stage') { this.latestStage = event.data.stage; callback({ stage: event.data.stage }); } };
      this.stageCallbacks.set(callback, listener);
      worker.addEventListener('message', listener);
    }
  }
  private startBrowserWorker(): void {
    if (!this.browserModuleUrl) throw new Error('Browser runtime is not available.');
    this.worker?.terminate();
    this.browserWorkerDead = false;
    this.browserReady = false;
    this.inputBarrier = Promise.resolve();
    const worker = new Worker(new URL('./browserWorker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    this.attachStageCallbacks(worker);
    this.inputBuffer = null;
    const runtimeError = (event: ErrorEvent) => {
      if (this.worker !== worker) return;
      this.browserWorkerDead = true;
      const detail = event.error?.stack || event.error?.message || event.message || 'unknown worker error';
      const location = event.filename ? ` (${event.filename}:${event.lineno || 0}:${event.colno || 0})` : '';
      this.onFailure(`Browser Kotlin/JS worker stopped: ${detail}${location}`);
    };
    worker.addEventListener('error', runtimeError);
    this.ready = new Promise((resolve, reject) => {
      const listener = (event: MessageEvent) => {
        if (event.data?.kind === 'input-buffer') this.inputBuffer = event.data.buffer;
        if (event.data?.kind === 'ready') { this.browserReady = true; worker.postMessage({ op: 'resources', sizes: this.browserResourceSizes }); worker.removeEventListener('message', listener); worker.removeEventListener('error', errorListener); resolve(); }
        if (event.data?.kind === 'error') { worker.removeEventListener('message', listener); worker.removeEventListener('error', errorListener); reject(new Error(event.data.message)); }
      };
      const errorListener = (event: ErrorEvent) => { worker.removeEventListener('message', listener); const detail = event.error?.stack || event.error?.message || event.message || 'unknown worker error'; reject(new Error(`Browser Kotlin/JS worker failed to load: ${detail}`)); };
      worker.addEventListener('message', listener);
      worker.addEventListener('error', errorListener);
      worker.postMessage({ op: 'resources', sizes: this.browserResourceSizes });
      worker.postMessage({ op: 'load', url: this.browserModuleUrl, packageName: this.browserPackageName });
    });
  }
  private async local(request: BrowserAction): Promise<any> {
    if (!this.worker || !this.ready) throw new Error('Browser runtime is not available.');
    await this.ready;
    await this.inputBarrier;
    return new Promise((resolve, reject) => {
      const worker = this.worker!;
      const onMessage = (event: MessageEvent) => { if (event.data?.kind === 'input-request') { this.onInputRequest(event.data.output); return; } if (event.data?.kind === 'value' || event.data?.kind === 'ready') { cleanup(); resolve(event.data); } else if (event.data?.kind === 'error') { cleanup(); reject(new Error(event.data.message)); } };
      const onError = (event: ErrorEvent) => { cleanup(); reject(new Error(event.message || 'Browser Kotlin/JS worker stopped.')); };
      const cleanup = () => { worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError); };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage(request);
    });
  }
  private rememberCodepadBinding(name: string | undefined, result: any): void {
    if (!name) return;
    const value = result?.value || result;
    if (value?.objectId) {
      this.localObjects.set(String(value.objectId), String(value.display || 'Object').replace(/\(\)$/, ''));
      this.bindings.set(name, value.objectId);
      return;
    }
    const scalar = displayedSimpleValue(value);
    if (scalar !== undefined) this.localValues.set(name, scalar);
  }
  private codepadBindings(): { names: string[]; values: Record<string, unknown>; types: Array<{ name: string; type: string }> } {
    const values: Record<string, unknown> = {};
    const names: string[] = [];
    const types: Array<{ name: string; type: string }> = [];
    for (const [name, objectId] of this.bindings) {
      const className = this.localObjects.get(String(objectId));
      const klass = className ? this.classes.find(value => value.name === className) : undefined;
      if (!className || !klass) continue;
      const methods = (klass.methods || []).filter(method => !method.typeParameters?.length).map(method => {
        const methodKey = `${method.name.replace(/[^A-Za-z0-9_]/g, '_')}_${requiredParameters(method.parameters || []).map(parameter => parameter.type.classifier.replace(/[^A-Za-z0-9_]/g, '_')).join('_') || 'noargs'}`;
        return { name: method.name, bridge: `bluekInvoke_${className.replace(/[^A-Za-z0-9_]/g, '_')}_${methodKey}` };
      });
      const properties = (klass.properties || []).map(property => {
        const stem = property.name.charAt(0).toUpperCase() + property.name.slice(1);
        const getter = (klass.methods || []).find(method => method.name === `get${stem}` || method.name === property.name || method.name === `is${stem}`);
        const setter = property.mutable ? (klass.methods || []).find(method => method.name === `set${stem}`) : undefined;
        const bridge = (method: any) => method && `bluekInvoke_${className.replace(/[^A-Za-z0-9_]/g, '_')}_${method.name.replace(/[^A-Za-z0-9_]/g, '_')}_${requiredParameters(method.parameters || []).map((parameter: any) => parameter.type.classifier.replace(/[^A-Za-z0-9_]/g, '_')).join('_') || 'noargs'}`;
        return { name: property.name, getter: bridge(getter), setter: bridge(setter) };
      });
      names.push(name);
      values[name] = { objectId: String(objectId), className, methods, properties };
    }
    for (const klass of this.classes) {
      if (klass.kind === 'functions') {
        for (const method of klass.methods || []) {
          if (method.typeParameters?.length || names.includes(method.name) || this.localValues.has(method.name) || this.bindings.has(method.name)) continue;
          const methodKey = `${method.name.replace(/[^A-Za-z0-9_]/g, '_')}_${requiredParameters(method.parameters || []).map(parameter => parameter.type.classifier.replace(/[^A-Za-z0-9_]/g, '_')).join('_') || 'noargs'}`;
          names.push(method.name);
          values[method.name] = { bridge: `bluekCall_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}_${methodKey}` };
        }
      } else if (klass.constructors?.length && !names.includes(klass.name) && !this.localValues.has(klass.name)) {
        if (['Actor', 'World', 'Image'].includes(klass.name)) {
          names.push(klass.name);
          values[klass.name] = { runtime: klass.name };
          continue;
        }
        const bridges = klass.constructors.map((constructor, index) => ({ name: `bluekCreate_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}${index === 0 ? '' : `_${index}`}`, arity: requiredParameters(constructor.parameters || []).length }));
        names.push(klass.name);
        values[klass.name] = { bridges };
      }
    }
    for (const [name, value] of this.localValues) { if (!names.includes(name)) { names.push(name); values[name] = { value }; types.push({ name, type: this.localValueTypes.get(name) || 'dynamic' }); } }
    return { names, values, types };
  }
  private simpleCollectionExpression(source: string): unknown {
    const match = source.trim().match(/^([A-Za-z_]\w*)\.(map|filter)\s*\{([\s\S]*)\}$/);
    if (!match) return undefined;
    const receiver = this.localValues.get(match[1]);
    if (!Array.isArray(receiver)) return undefined;
    const lambda = match[3].trim().match(/^(?:([A-Za-z_]\w*)\s*->\s*)?([\s\S]+)$/);
    if (!lambda) return undefined;
    const parameter = lambda[1] || 'it';
    const body = lambda[2].trim();
    const previous = this.localValues.get(parameter);
    const hadPrevious = this.localValues.has(parameter);
    try {
      return receiver[match[2] === 'map' ? 'map' : 'filter']((item) => {
        this.localValues.set(parameter, item);
        return this.standaloneExpression(body);
      });
    } finally {
      if (hadPrevious) this.localValues.set(parameter, previous);
      else this.localValues.delete(parameter);
    }
  }
  private standaloneExpression(source: string): unknown {
    const collectionExpression = this.simpleCollectionExpression(source);
    if (collectionExpression !== undefined) return collectionExpression;
    const value = simpleBuiltin(source, this.bindings, this.localValues);
    if (value !== undefined) return value;
    const trimmed = stripExpressionParentheses(source);
    if (trimmed.startsWith('!') && trimmed.length > 1) return !Boolean(this.standaloneExpression(trimmed.slice(1)));
    const property = trimmed.match(/^(.+)\.(length|size|isEmpty)$/s);
    if (property) {
      const receiver = this.standaloneExpression(property[1]);
      if (typeof receiver === 'string' || Array.isArray(receiver)) return property[2] === 'isEmpty' ? receiver.length === 0 : receiver.length;
    }
    try { return parseKotlinArgument(source, this.bindings, this.localValues); } catch { /* continue with operators */ }
    const binary = topLevelBinary(source);
    if (!binary) throw new Error(`This simple expression needs a compiled project: ${source}`);
    const left = this.standaloneExpression(binary.left);
    const right = this.standaloneExpression(binary.right);
    switch (binary.operator) {
      case '+': return typeof left === 'number' && typeof right === 'number' ? left + right : `${left ?? 'null'}${right ?? 'null'}`;
      case '-': return Number(left) - Number(right);
      case '*': return Number(left) * Number(right);
      case '/': return Number(left) / Number(right);
      case '%': return Number(left) % Number(right);
      case '==': return left === right;
      case '!=': return left !== right;
      case '<': return (left as any) < (right as any);
      case '<=': return (left as any) <= (right as any);
      case '>': return (left as any) > (right as any);
      case '>=': return (left as any) >= (right as any);
      case '&&': return Boolean(left) && Boolean(right);
      case '||': return Boolean(left) || Boolean(right);
      default: throw new Error(`Unsupported simple expression: ${source}`);
    }
  }
  private async runBrowserSnippet(source: string, mode: 'expression' | 'block'): Promise<any> {
    const snippetSource = source.trim().replace(/;$/, '');
    if (!snippetSource) throw new Error('The Kotlin expression is empty.');
    const bindings = this.codepadBindings();
    const bindingSignature = bindings.names.map(name => `${name}:${this.bindings.has(name) ? this.localObjects.get(String(this.bindings.get(name))) || 'object' : bindings.types.find(binding => binding.name === name)?.type || 'dynamic'}`).join('|');
    const cacheKey = `${this.browserGeneration}:${mode}:${snippetSource}:${bindingSignature}`;
    let moduleUrl = this.codepadModules.get(cacheKey);
    if (!moduleUrl) {
      const compiled = await this.http.compileCodepad(snippetSource, String(this.browserGeneration || ''), bindings.types.length ? bindings.types : bindings.names);
      moduleUrl = new URL(`/api/session/${this.http.sessionId}/browser/${compiled.entry}`, window.location.origin).href;
      this.codepadModules.set(cacheKey, moduleUrl);
    }
    const result = await this.local({ op: 'codepad', url: moduleUrl, bindings: this.codepadBindings().values });
    return { ...result.value, output: result.output };
  }
  async execute(request: Action): Promise<Value & { output?: string; stage?: unknown; name?: string }> {
    if (request.op === 'reset' && this.worker && this.ready) { await this.reset(); return { kind: 'unit', display: 'Unit' }; }
    if (!this.worker && request.op === 'eval') {
      const source = String(request.code || '').trim().replace(/;$/, '');
      const outputCall = source.match(/^(print|println)\((.*)\)$/s);
      if (outputCall) {
        if (!outputCall[2].trim() && outputCall[1] === 'println') return { kind: 'unit', display: 'Unit', output: '\n' };
        const value = this.standaloneExpression(outputCall[2].trim());
        return { kind: 'unit', display: 'Unit', output: `${String(value ?? 'null')}${outputCall[1] === 'println' ? '\n' : ''}` };
      }
      if (request.mode === 'block') {
        const declaration = simpleCodepadDeclaration(source);
        if (declaration) { const value = this.standaloneExpression(declaration.value); this.localValues.set(declaration.name, value); const type = simpleValueType(declaration.value, value, declaration.explicitType); if (type) this.localValueTypes.set(declaration.name, type); return { kind: 'unit', display: 'Unit' }; }
        const assignment = simpleCodepadAssignment(source);
        if (assignment) { this.localValues.set(assignment.name, this.standaloneExpression(assignment.value)); return { kind: 'unit', display: 'Unit' }; }
      }
      const collection = this.simpleCollectionExpression(source);
      if (Array.isArray(collection)) return { kind: 'collection', display: `[${collection.join(', ')}]`, type: simpleCollectionType(collection) };
      const collectionCall = source.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\((.*)\)$/s);
      if (collectionCall && this.localValues.has(collectionCall[1])) {
        const receiver = this.localValues.get(collectionCall[1]);
        const args = splitSimpleArguments(collectionCall[3]).map(value => simpleCodepadValue(value, this.bindings, this.localValues));
        const result = simpleCollectionCall(receiver, collectionCall[2], args);
        if (result !== undefined) {
          if (result === SIMPLE_UNIT) return { kind: 'unit', display: 'Unit' };
          return Array.isArray(result)
            ? { kind: 'collection', display: `[${result.join(', ')}]`, type: simpleCollectionType(result) }
            : { kind: 'scalar', display: String(result) };
        }
      }
      const value = this.standaloneExpression(source);
      return Array.isArray(value) ? { kind: 'collection', display: `[${value.join(', ')}]`, type: simpleCollectionType(value) } : value === null ? { kind: 'null', display: 'null' } : { kind: 'scalar', display: String(value) };
    }
    if (this.worker && this.ready && request.op === 'main') { const result = await this.local({ op: 'main' }); return { ...result.value, output: result.output }; }
    if (this.worker && this.ready && request.op === 'eval') {
      const code = String(request.code || '').replace(/\s+/g, '');
      const localAction = code === 'start()' ? { op: 'run' as const } : code === 'stop()' ? { op: 'pause' as const } : code === 'step()' ? { op: 'act' as const } : code === 'show()' ? { op: 'stage' as const } : code.startsWith('setSpeed(') && code.endsWith(')') ? { op: 'speed' as const, value: Number(code.slice(9, -1)) } : null;
      if (localAction) { const result = await this.local(localAction); return { ...result.value, output: result.output }; }
      if (request.mode === 'expression') {
        const collection = this.simpleCollectionExpression(String(request.code || '').trim().replace(/;$/, ''));
        if (Array.isArray(collection)) return { kind: 'collection', display: `[${collection.join(', ')}]`, type: simpleCollectionType(collection) };
        const collectionCall = String(request.code || '').trim().replace(/;$/, '').match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\((.*)\)$/s);
        if (collectionCall && this.localValues.has(collectionCall[1])) {
          const receiver = this.localValues.get(collectionCall[1]);
          const args = splitSimpleArguments(collectionCall[3]).map(value => simpleCodepadValue(value, this.bindings, this.localValues));
          const result = simpleCollectionCall(receiver, collectionCall[2], args);
          if (result !== undefined) {
            if (result === SIMPLE_UNIT) return { kind: 'unit', display: 'Unit' };
            return Array.isArray(result)
              ? { kind: 'collection', display: `[${result.join(', ')}]`, type: simpleCollectionType(result) }
              : { kind: 'scalar', display: String(result) };
          }
        }
      }
    }
    if (this.worker && this.ready && request.op === 'create') {
      const klass = this.classes.find(value => value.name === request.className); const constructorIndex = Number(request.constructorIndex); const selectedConstructor = Number.isInteger(constructorIndex) && constructorIndex >= 0 ? klass?.constructors[constructorIndex] : undefined; const constructor = selectedConstructor || klass?.constructors.find(value => value.id === request.constructorId) || klass?.constructors[0];
      if (klass && constructor) {
        const args = JSON.parse(String(request.args || '[]')).map((value: string) => parseKotlinArgument(value, this.bindings, this.localValues)); if (!simpleArgumentsMatch(args, requiredParameters(constructor.parameters))) throw new Error('The local arguments do not match the Kotlin constructor types; compile the expression first.'); const functionName = `bluekCreate_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}${klass.constructors.indexOf(constructor) === 0 ? '' : `_${klass.constructors.indexOf(constructor)}`}`;
        const result = await this.local({ op: 'create', functionName, args, className: klass.name, name: String(request.name || klass.name.toLowerCase()) });
        if (result.objectId) this.localObjects.set(result.objectId, klass.name); if (result.name) this.bindings.set(result.name, result.objectId); return { ...result.value, output: result.output };
      }
      const args = JSON.parse(String(request.args || '[]')) as string[];
      const typeArguments = JSON.parse(String(request.typeArguments || '[]')) as TypeRef[];
      const typeSuffix = typeArguments.length ? `<${typeArguments.map(type => type.classifier).join(', ')}>` : '';
      const result = await this.runBrowserSnippet(`${String(request.className)}${typeSuffix}(${args.join(', ')})`, 'expression');
      if (result.objectId) {
        this.localObjects.set(String(result.objectId), String(request.className));
        if (request.name) this.bindings.set(String(request.name), result.objectId);
      }
      return { ...result, name: request.name };
    }
    if (this.worker && this.ready && request.op === 'eval') {
      const source = String(request.code || '').trim().replace(/;$/, '');
      const outputCall = source.match(/^(print|println)\((.*)\)$/s);
      if (outputCall) {
        const argument = outputCall[2].trim();
        if (!argument && outputCall[1] === 'println') {
          const result = await this.local({ op: 'write', text: '', newline: true });
          return { ...result.value, output: result.output };
        }
        let parsed: unknown;
        try {
          parsed = parseKotlinArgument(argument, this.bindings, this.localValues);
        } catch {
          parsed = displayedSimpleValue(await this.execute({ op: 'eval', code: argument, mode: 'expression' }));
        }
        const objectId = parsed && typeof parsed === 'object' && '__bluekObjectId' in parsed
          ? String((parsed as { __bluekObjectId: unknown }).__bluekObjectId)
          : '';
        const display = objectId ? String(this.localObjects.get(objectId) || objectId) : String(parsed ?? 'null');
        const result = await this.local({ op: 'write', text: display, newline: outputCall[1] === 'println' });
        return { ...result.value, output: result.output };
      }
      if (request.mode === 'expression') {
        const builtin = simpleBuiltin(source, this.bindings, this.localValues);
        if (builtin !== undefined) return Array.isArray(builtin)
          ? { kind: 'collection', display: `[${builtin.map(value => value === null ? 'null' : String(value)).join(', ')}]`, type: simpleCollectionType(builtin) }
          : { kind: 'scalar', display: String(builtin) };
        // Keep elementary Kotlin expressions on the local fast path.  In
        // particular, arithmetic such as `5 + 3` or `x + 3` must not trigger a
        // compiler round-trip merely because it is not one of the builtin
        // collection/string helpers.  If the expression is not representable
        // by the small evaluator it throws and continues to the real
        // Kotlin/JS snippet compiler below.
        try {
          const simple = this.standaloneExpression(source);
          if (simple === null) return { kind: 'null', display: 'null' };
          if (Array.isArray(simple)) return { kind: 'collection', display: `[${simple.map(value => value === null ? 'null' : String(value)).join(', ')}]`, type: simpleCollectionType(simple) };
          if (typeof simple === 'string' || typeof simple === 'number' || typeof simple === 'boolean') return { kind: 'scalar', display: String(simple) };
        } catch { /* complex expressions still go through Kotlin/JS */ }
      }
      if (request.mode === 'block') {
        const statements = splitCodepadStatements(source);
        if (statements.length > 1) {
          let result: any = { kind: 'unit', display: 'Unit' };
          const createdObjects: any[] = [];
          for (const statement of statements) {
            result = await this.execute({ ...request, code: statement });
            if (result?.objectId) createdObjects.push(result);
            if (Array.isArray(result?.createdObjects)) createdObjects.push(...result.createdObjects);
          }
          return createdObjects.length ? { ...result, createdObjects } : result;
        }
      }
      const propertyAssignment = request.mode === 'block' ? simpleCodepadPropertyAssignment(source) : null;
      if (propertyAssignment) {
        const objectId = this.bindings.get(propertyAssignment.receiver);
        if (objectId && this.localObjects.has(String(objectId))) {
          let value: unknown;
          try {
            value = parseKotlinArgument(propertyAssignment.value, this.bindings, this.localValues);
          } catch {
            const evaluated = await this.execute({ op: 'eval', code: propertyAssignment.value, mode: 'expression' });
            if (evaluated.objectId) {
              this.localObjects.set(String(evaluated.objectId), String(evaluated.display || 'Object').replace(/\(\)$/, ''));
              value = { __bluekObjectId: evaluated.objectId };
            } else {
              const scalar = displayedSimpleValue(evaluated);
              if (scalar === undefined) throw new Error(`The right-hand side of ${propertyAssignment.property} could not be evaluated.`);
              value = scalar;
            }
          }
          await this.local({ op: 'set', objectId: String(objectId), property: propertyAssignment.property, className: String(this.localObjects.get(String(objectId))), value });
          return { kind: 'unit', display: 'Unit' };
        }
      }
      const declaration = request.mode === 'block' ? simpleCodepadDeclaration(source) : null;
      if (declaration) {
        if (this.bindings.has(declaration.value)) {
          const objectId = this.bindings.get(declaration.value);
          this.bindings.set(declaration.name, objectId);
          this.localValues.delete(declaration.name);
          return { kind: 'unit', display: 'Unit' };
        }
        const collectionExpression = this.simpleCollectionExpression(declaration.value);
        if (Array.isArray(collectionExpression)) {
          this.localValues.set(declaration.name, collectionExpression);
          const type = simpleValueType(declaration.value, collectionExpression, declaration.explicitType);
          if (type) this.localValueTypes.set(declaration.name, type);
          return { kind: 'unit', display: 'Unit' };
        }
        try {
          const value = this.standaloneExpression(declaration.value);
          this.localValues.set(declaration.name, value);
          const type = simpleValueType(declaration.value, value, declaration.explicitType);
          if (type) this.localValueTypes.set(declaration.name, type);
          return { kind: 'unit', display: 'Unit' };
        } catch { /* The normal call parser may handle a constructor declaration. */ }
        try {
          const evaluated = await this.execute({ op: 'eval', code: declaration.value, mode: 'expression' });
          this.rememberCodepadBinding(declaration.name, evaluated);
          return evaluated?.objectId
            ? { kind: 'unit', display: 'Unit', createdObjects: [{ ...evaluated, name: declaration.name }], output: evaluated.output }
            : { kind: 'unit', display: 'Unit', output: evaluated.output };
        } catch { /* The normal call parser may handle an unsupported expression. */ }
      }
      const assignment = request.mode === 'block' ? simpleCodepadAssignment(source) : null;
      if (assignment && this.localValues.has(assignment.name)) {
        try {
          this.localValues.set(assignment.name, parseKotlinArgument(assignment.value, this.bindings, this.localValues));
        } catch {
          const evaluated = await this.execute({ op: 'eval', code: assignment.value, mode: 'expression' });
          const value = displayedSimpleValue(evaluated);
          if (value === undefined) throw new Error('Only scalar Kotlin values can be assigned locally.');
          this.localValues.set(assignment.name, value);
        }
        return { kind: 'unit', display: 'Unit' };
      }
      // A Codepad Run block may end with a value expression. BlueJ displays
      // that result just like Evaluate, so identifiers must be resolved in
      // both modes; assignments and declarations are handled above.
      const identifier = simpleCodepadIdentifier(source);
      if (identifier && this.localValues.has(identifier)) return { kind: 'scalar', display: String(this.localValues.get(identifier)) };
      if (request.mode === 'expression') {
        try {
          const literal = parseKotlinArgument(source, this.bindings, this.localValues);
          if (literal === null) return { kind: 'null', display: 'null' };
          if (typeof literal === 'string' || typeof literal === 'number' || typeof literal === 'boolean') return { kind: 'scalar', display: String(literal) };
        } catch { /* The expression may be a property, call, or binary expression. */ }
      }
      const property = simpleCodepadProperty(String(request.code || ''));
      if (property) {
        const objectId = this.bindings.get(property.receiver);
        if (objectId && this.localObjects.has(String(objectId))) return (await this.local({ op: 'get', objectId: String(objectId), property: property.property, className: String(this.localObjects.get(String(objectId))) })).value;
      }
      {
        const scalarProperty = source.match(/^(.+)\.(length|size|isEmpty)$/s);
        if (scalarProperty) {
          const builtinValue = simpleBuiltin(scalarProperty[1], this.bindings, this.localValues);
          const storedValue = this.localValues.get(scalarProperty[1].trim());
          const value = builtinValue !== undefined ? builtinValue : storedValue !== undefined ? storedValue : displayedSimpleValue(await this.execute({ op: 'eval', code: scalarProperty[1], mode: 'expression' }));
          if (typeof value === 'string' || Array.isArray(value)) return { kind: 'scalar', display: String(scalarProperty[2] === 'length' || scalarProperty[2] === 'size' ? value.length : value.length === 0) };
        }
      }
      const parsed = simpleCodepadCall(String(request.code || ''));
      if (parsed) {
        if (parsed.receiver) {
          const objectId = this.bindings.get(parsed.receiver);
          const localClassName = objectId ? this.localObjects.get(String(objectId)) : undefined;
          const klass = this.classes.find(value => value.name === localClassName);
          const method = klass?.methods.filter(value => value.name === parsed.callable).find(value => { try { return simpleCallableMatches(parsed.args.map(argument => parseKotlinArgument(argument, this.bindings, this.localValues)), value.parameters); } catch { return false; } });
          if (!objectId && this.localValues.has(parsed.receiver) && parsed.args.length === 0) {
            const scalar = this.localValues.get(parsed.receiver);
            if (typeof scalar === 'string') {
              const transformed = parsed.callable === 'uppercase' ? scalar.toUpperCase() : parsed.callable === 'lowercase' ? scalar.toLowerCase() : parsed.callable === 'trim' ? scalar.trim() : parsed.callable === 'reversed' ? [...scalar].reverse().join('') : undefined;
              if (transformed !== undefined) {
                if (parsed.binding) this.localValues.set(parsed.binding, transformed);
                return { kind: 'scalar', display: transformed, name: parsed.binding };
              }
            }
          }
          if (!objectId && this.localValues.has(parsed.receiver)) {
            const receiver = this.localValues.get(parsed.receiver);
            const args = parsed.args.map(value => simpleCodepadValue(value, this.bindings, this.localValues));
            const collectionValue = simpleCollectionCall(receiver, parsed.callable, args);
            if (collectionValue !== undefined) {
              if (collectionValue === SIMPLE_UNIT) return { kind: 'unit', display: 'Unit', name: parsed.binding };
              if (parsed.binding) this.localValues.set(parsed.binding, collectionValue);
              return Array.isArray(collectionValue)
                ? { kind: 'collection', display: `[${collectionValue.join(', ')}]`, type: simpleCollectionType(collectionValue), name: parsed.binding }
                : { kind: collectionValue === null ? 'null' : 'scalar', display: String(collectionValue), name: parsed.binding };
            }
          }
          if (objectId && klass && method && method.typeParameters?.length && parsed.typeArguments.length === 1 && parsed.args.length >= requiredParameters(method.parameters).length) {
            const args = parsed.args.map(value => parseKotlinArgument(value, this.bindings, this.localValues));
            if (!simpleArgumentsMatch(args, requiredParameters(method.parameters))) throw new Error('The local arguments do not match the Kotlin method types; compile the expression first.');
            const result = await this.local({ op: 'invoke', functionName: `bluekGeneric_${method.name}`, methodName: method.name, typeName: parsed.typeArguments[0], objectId: String(objectId), args, className: method.returnType.classifier });
            this.rememberCodepadBinding(parsed.binding, result);
            return parsed.binding ? { ...result.value, name: parsed.binding, output: result.output } : { ...result.value, output: result.output };
          }
          if (objectId && klass && method && !method.typeParameters?.length && parsed.args.length >= requiredParameters(method.parameters).length) {
            const args = parsed.args.map(value => parseKotlinArgument(value, this.bindings, this.localValues));
            if (!simpleArgumentsMatch(args, requiredParameters(method.parameters))) throw new Error('The local arguments do not match the Kotlin method types; compile the expression first.');
            const methodKey = `${method.name.replace(/[^A-Za-z0-9_]/g, '_')}_${requiredParameters(method.parameters).map(parameter => parameter.type.classifier.replace(/[^A-Za-z0-9_]/g, '_')).join('_') || 'noargs'}`;
            const result = await this.local({ op: 'invoke', functionName: `bluekInvoke_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}_${methodKey}`, methodName: method.name, objectId: String(objectId), args, className: method.returnType.classifier });
            this.rememberCodepadBinding(parsed.binding, result);
            return parsed.binding ? { ...result.value, name: parsed.binding, output: result.output } : { ...result.value, output: result.output };
          }
        } else {
          const klass = this.classes.find(value => value.name === parsed.callable);
          const constructorIndex = klass?.constructors.findIndex(value => { try { return simpleCallableMatches(parsed.args.map(argument => parseKotlinArgument(argument, this.bindings, this.localValues)), value.parameters); } catch { return false; } }) ?? -1;
          const constructor = constructorIndex >= 0 ? klass?.constructors[constructorIndex] : undefined;
          if (klass && constructor && parsed.args.length >= requiredParameters(constructor.parameters).length) {
            const args = parsed.args.map(value => parseKotlinArgument(value, this.bindings, this.localValues)); if (!simpleArgumentsMatch(args, requiredParameters(constructor.parameters))) throw new Error('The local arguments do not match the Kotlin constructor types; compile the expression first.');
            const result = await this.local({ op: 'create', functionName: `bluekCreate_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}${constructorIndex === 0 ? '' : `_${constructorIndex}`}`, args, className: klass.name, name: parsed.binding || klass.name.toLowerCase() });
            if (result.objectId) this.localObjects.set(result.objectId, klass.name);
            if (parsed.binding && result.objectId) this.bindings.set(parsed.binding, result.objectId);
            return { ...result.value, name: parsed.binding, output: result.output };
          }
          const owner = this.classes.find(value => value.kind === 'functions' && value.methods.some(method => method.name === parsed.callable));
          const method = owner?.methods.find(value => value.name === parsed.callable);
          if (owner && method && !method.typeParameters?.length && parsed.args.length >= requiredParameters(method.parameters).length) {
            const args = parsed.args.map(value => parseKotlinArgument(value, this.bindings, this.localValues));
            if (!simpleArgumentsMatch(args, requiredParameters(method.parameters))) throw new Error('The local arguments do not match the Kotlin function types; compile the expression first.');
            const methodKey = `${method.name.replace(/[^A-Za-z0-9_]/g, '_')}_${requiredParameters(method.parameters).map(parameter => parameter.type.classifier.replace(/[^A-Za-z0-9_]/g, '_')).join('_') || 'noargs'}`;
            const result = await this.local({ op: 'invoke', functionName: `bluekCall_${owner.name.replace(/[^A-Za-z0-9_]/g, '_')}_${methodKey}`, objectId: '', args, className: method.returnType.classifier });
            this.rememberCodepadBinding(parsed.binding, result);
            return { ...result.value, output: result.output };
          }
        }
      }
      const chainedStringCall = source.match(/^(.+)\.(uppercase|lowercase|trim|reversed)\(\)$/s);
      if (chainedStringCall) {
        const value = displayedSimpleValue(await this.execute({ op: 'eval', code: chainedStringCall[1], mode: 'expression' }));
        if (typeof value === 'string') {
          const transformed = chainedStringCall[2] === 'uppercase' ? value.toUpperCase() : chainedStringCall[2] === 'lowercase' ? value.toLowerCase() : chainedStringCall[2] === 'trim' ? value.trim() : [...value].reverse().join('');
          return { kind: 'scalar', display: transformed };
        }
      }
      if (request.mode === 'expression') {
        if (source.startsWith('!') && source.length > 1) {
          const value = displayedSimpleValue(await this.execute({ op: 'eval', code: source.slice(1), mode: 'expression' }));
          return { kind: 'scalar', display: String(!Boolean(value)) };
        }
        if (/^-\d+(?:\.\d+)?$/.test(source)) return { kind: 'scalar', display: source };
        const binary = topLevelBinary(source);
        if (binary) {
          const left = displayedSimpleValue(await this.execute({ op: 'eval', code: binary.left, mode: 'expression' }));
          const right = displayedSimpleValue(await this.execute({ op: 'eval', code: binary.right, mode: 'expression' }));
          let result: unknown;
          switch (binary.operator) {
            case '||': result = Boolean(left) || Boolean(right); break;
            case '&&': result = Boolean(left) && Boolean(right); break;
            case '==': result = left === right; break;
            case '!=': result = left !== right; break;
            case '<': result = (left as any) < (right as any); break;
            case '<=': result = (left as any) <= (right as any); break;
            case '>': result = (left as any) > (right as any); break;
            case '>=': result = (left as any) >= (right as any); break;
            case '+': result = typeof left === 'number' && typeof right === 'number' ? left + right : `${left ?? 'null'}${right ?? 'null'}`; break;
            case '-': result = Number(left) - Number(right); break;
            case '*': result = Number(left) * Number(right); break;
            case '/': result = Number(left) / Number(right); break;
            case '%': result = Number(left) % Number(right); break;
            default: result = undefined;
          }
          if (result !== undefined) return { kind: 'scalar', display: String(result) };
        }
      }
      return this.runBrowserSnippet(String(request.code || ''), request.mode === 'block' ? 'block' : 'expression');
    }
    if (this.worker && this.ready && request.op === 'invoke') {
      const object = this.localObjects.has(String(request.objectId)); const localClassName = this.localObjects.get(String(request.objectId)); const klass = this.classes.find(value => value.name === localClassName);
      const requestName = String(request.name || ''); const genericMatch = requestName.match(/^([^<]+)<(.+)>$/); const methodName = genericMatch?.[1] || requestName; const method = klass?.methods.find(value => value.id === request.callableId) || klass?.methods.find(value => value.name === methodName);
      if (object && klass && method) {
        const args = JSON.parse(String(request.args || '[]')).map((value: string) => parseKotlinArgument(value, this.bindings, this.localValues)); if (!simpleArgumentsMatch(args, requiredParameters(method.parameters))) throw new Error('The local arguments do not match the Kotlin method types; compile the expression first.');
        const typeName = genericMatch?.[2].split(',')[0].trim(); if (method.typeParameters?.length) { if (!typeName) throw new Error('A Kotlin type argument is required for this method.'); const result = await this.local({ op: 'invoke', functionName: `bluekGeneric_${methodName}`, methodName, typeName, objectId: String(request.objectId), args, className: method.returnType.classifier }); return { ...result.value, output: result.output }; }
        const methodKey = `${method.name.replace(/[^A-Za-z0-9_]/g, '_')}_${requiredParameters(method.parameters).map(parameter => parameter.type.classifier.replace(/[^A-Za-z0-9_]/g, '_')).join('_') || 'noargs'}`; const functionName = `bluekInvoke_${klass.name.replace(/[^A-Za-z0-9_]/g, '_')}_${methodKey}`;
        const result = await this.local({ op: 'invoke', functionName, methodName, objectId: String(request.objectId), args, className: method.returnType.classifier }); return { ...result.value, output: result.output };
      }
      const receiverName = [...this.bindings.entries()].find(([, objectId]) => String(objectId) === String(request.objectId))?.[0];
      if (receiverName) {
        const args = JSON.parse(String(request.args || '[]')) as string[];
        const methodName = String(request.name || request.callableId || '').replace(/<.*>$/, '').trim();
        if (methodName) return this.runBrowserSnippet(`${receiverName}.${methodName}(${args.join(', ')})`, 'expression');
      }
    }
    if (this.worker && this.ready && request.op === 'inspect') {
      return (await this.local({ op: 'inspect', objectId: String(request.objectId), className: String(this.localObjects.get(String(request.objectId)) || '') })).value;
    }
    if (this.worker && this.ready && request.op === 'remove') {
      this.localObjects.delete(String(request.objectId));
      return (await this.local({ op: 'remove', objectId: String(request.objectId) })).value;
    }
    if (this.worker && this.ready && ['create', 'invoke', 'eval', 'inspect', 'remove'].includes(request.op)) throw new Error('This Kotlin expression is not prepared for local execution yet. Compile it before running it.');
    return this.http.execute(request);
  }
  async compile(files: ProjectFile[], revision: number, resources: Resource[] = [], resourceSizes: Record<string, { width: number; height: number }> = {}, resourceAlphaMasks: Record<string, number[]> = {}): Promise<CompileResult> {
    const result = await this.http.compile(files, revision, resources); this.classes = result.classes; this.localObjects.clear(); this.localValues.clear(); this.localValueTypes.clear(); this.bindings.clear(); this.codepadModules.clear(); this.latestStage = null;
    this.browserResourceSizes = Object.fromEntries(Object.entries(resourceSizes).map(([key, size]) => [key, { ...size, alpha: resourceAlphaMasks[key] }]));
    if (result.browserRuntime) {
      this.browserGeneration = result.generationId;
      this.browserModuleUrl = new URL(`/api/session/${this.http.sessionId}/browser/${result.browserRuntime.entry}`, window.location.origin).href;
      this.browserPackageName = result.browserRuntime.packageName;
      this.startBrowserWorker();
      await this.ready;
    } else { this.browserGeneration = null; this.browserModuleUrl = null; this.browserPackageName = ''; this.worker?.terminate(); this.worker = null; this.ready = null; this.browserWorkerDead = false; }
    return result;
  }
  createObject(classId: string, constructorId: string, typeArguments: TypeRef[], args: string[], name: string): Promise<Value> { return this.execute({ op: 'create', className: classId, constructorId, typeArguments: JSON.stringify(typeArguments), args: JSON.stringify(args), name }); }
  invokeMethod(objectId: string, callableId: string, typeArguments: TypeRef[], args: string[]): Promise<Value> { return this.execute({ op: 'invoke', objectId, name: callableId, typeArguments: JSON.stringify(typeArguments), args: JSON.stringify(args) }); }
  async inspectObject(objectId: string): Promise<unknown> { if (this.worker && this.ready) return (await this.local({ op: 'inspect', objectId })).value; return this.http.inspectObject(objectId); }
  async evaluate(code: string, mode: 'expression' | 'block'): Promise<Value> { if (this.worker && this.ready) return this.execute({ op: 'eval', code, mode }); return this.http.evaluate(code, mode); }
  async removeObject(objectId: string): Promise<void> { this.localObjects.delete(objectId); if (this.worker && this.ready) { await this.local({ op: 'remove', objectId }); return; } await this.http.removeObject(objectId); }
  sendInput(text: string): Promise<void> { if (!this.worker) return this.http.sendInput(text); if (!this.inputBuffer) return Promise.reject(new Error('Terminal input requires a cross-origin-isolated browser context.')); const bytes = new TextEncoder().encode(text); const state = new Int32Array(this.inputBuffer, 0, 1); const buffer = new Uint8Array(this.inputBuffer, 4); buffer.fill(0); buffer.set(bytes.subarray(0, buffer.length)); Atomics.store(state, 0, Math.min(bytes.length, buffer.length)); Atomics.notify(state, 0); return Promise.resolve(); }
  async stop(): Promise<void> { const hadBrowserWorker = Boolean(this.worker); this.worker?.terminate(); this.worker = null; this.ready = null; this.browserReady = false; this.browserWorkerDead = true; this.inputBarrier = Promise.resolve(); this.browserGeneration = null; this.browserModuleUrl = null; this.browserPackageName = ''; this.codepadModules.clear(); this.localObjects.clear(); this.localValues.clear(); this.localValueTypes.clear(); this.bindings.clear(); if (!hadBrowserWorker) await this.http.stop(); }
  async reset(): Promise<void> { if (!this.browserModuleUrl) { await this.stop(); return; } this.worker?.terminate(); this.worker = null; this.ready = null; this.codepadModules.clear(); this.localObjects.clear(); this.localValues.clear(); this.localValueTypes.clear(); this.bindings.clear(); this.latestStage = null; this.startBrowserWorker(); await this.ready; }
  private postBrowserInput(message: { op: 'key'; key: string; pressed: boolean } | { op: 'click'; x: number; y: number }): Promise<void> {
    if (!this.worker || !this.ready) return Promise.reject(new Error('Browser runtime is not available.'));
    const worker = this.worker;
    const next = this.inputBarrier.then(async () => {
      await this.ready;
      if (!this.worker || this.worker !== worker || this.browserWorkerDead) throw new Error('Browser Kotlin/JS worker stopped.');
      await new Promise<void>((resolve, reject) => {
        const onMessage = (event: MessageEvent) => { if (event.data?.kind !== 'input-ack') return; cleanup(); resolve(); };
        const onError = (event: ErrorEvent) => { cleanup(); reject(new Error(event.message || 'Browser Kotlin/JS worker stopped.')); };
        const cleanup = () => { worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError); };
        worker.addEventListener('message', onMessage); worker.addEventListener('error', onError); worker.postMessage(message);
      });
    });
    this.inputBarrier = next.catch(() => undefined);
    return next;
  }
  sendKey(key: string, pressed: boolean): Promise<void> { if (this.worker && this.ready) return this.postBrowserInput({ op: 'key', key, pressed }); return this.http.sendKey(key, pressed); }
  sendClick(x: number, y: number): Promise<void> { if (this.worker && this.ready) return this.postBrowserInput({ op: 'click', x, y }); return this.http.sendClick(x, y); }
  stage(): Promise<any> { if (this.worker) { this.worker.postMessage({ op: 'stage' }); return Promise.resolve({ stage: this.latestStage }); } return this.http.stage(); }
  stageStream(onStage: (value: any) => void): () => void { if (!this.worker || !this.ready) return this.http.stageStream(onStage); const worker = this.worker; const listener = (event: MessageEvent) => { if (event.data?.kind === 'stage') { this.latestStage = event.data.stage; onStage({ stage: event.data.stage }); } }; this.stageCallbacks.set(onStage, listener); worker.addEventListener('message', listener); this.ready.then(() => worker.postMessage({ op: 'stage' })); return () => { const current = this.stageCallbacks.get(onStage); if (current) this.worker?.removeEventListener('message', current); this.stageCallbacks.delete(onStage); }; }
  events(): Promise<any[]> { return this.worker ? Promise.resolve([]) : this.http.events(); }
  status(): Promise<RuntimeStatus> { return this.worker && !this.browserWorkerDead ? Promise.resolve({ workerAlive: true, generationId: this.browserGeneration, available: true, error: null }) : Promise.resolve({ workerAlive: false, generationId: this.browserGeneration, available: false, error: 'Browser Kotlin/JS worker stopped.' }); }
}

export type { ClassMeta };
