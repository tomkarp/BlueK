import type { ClassMeta, CompileResult, ProjectFile, RuntimeClient, RuntimeStatus, TypeRef, Value } from '../../runtime-contract/src/index.js';

type Resource = { path: string; data: string };
type Action = { op: string; [key: string]: unknown };

export class HttpRuntimeClient implements RuntimeClient {
  constructor(private readonly sessionId: string, private readonly onFailure: (message: string) => void = () => undefined) {}

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
  async events(): Promise<any[]> { return (await this.request('/events')).json(); }
  async status(): Promise<RuntimeStatus> { return (await this.request('/status')).json(); }
}

export type { ClassMeta };
