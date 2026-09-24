import type { InspectedField, RuntimeSnapshot, RuntimeValue, TypeRef } from '../../runtime-contract/src/index';

/** Only the capabilities needed to resolve an inspection; no UI or Worker dependency. */
export interface InspectorRuntime {
  getSnapshot(): Pick<RuntimeSnapshot, 'generationId' | 'phase' | 'inspections'>;
  execute(command: { op: 'get'; objectId: string; property: string }): Promise<RuntimeValue>;
}

export interface InspectorField extends InspectedField {
  computed: boolean;
  objectId?: string;
  error?: string;
}
export interface InspectionView extends Omit<RuntimeValue, 'fields'> {
  fields: InspectorField[];
}

/** Runtime snapshots own stored fields. This model owns only explicitly evaluated getters. */
export class InspectorModel {
  private generation = '';
  private values = new Map<string, Map<string, RuntimeValue>>();
  private requests = new Map<string, object>();

  constructor(private readonly runtime: InspectorRuntime, private readonly changed: () => void) {}

  private synchronize() {
    const generation = this.runtime.getSnapshot().generationId;
    if (generation !== this.generation) {
      this.generation = generation;
      this.values.clear();
      this.requests.clear();
    }
    return generation;
  }

  forget(objectId: string) {
    this.values.delete(objectId);
    this.requests.delete(objectId);
  }

  view(objectId: string): InspectionView | null {
    this.synchronize();
    const raw = this.runtime.getSnapshot().inspections[objectId];
    if (!raw) return null;
    return {
      ...raw,
      fields: (raw.fields || []).map(field => {
        const computed = field.value === '<computed>';
        const value = computed ? this.values.get(objectId)?.get(field.name) : undefined;
        return {
          ...field,
          computed,
          value: value ? value.display ?? (value.kind === 'null' ? 'null' : `<object> : ${value.className || 'Object'}`) : field.value,
          type: value?.type || field.type,
          objectId: value?.kind === 'object' ? value.objectId : undefined,
          reference: field.reference || value?.kind === 'object',
          error: value?.kind === 'error' ? value.display || 'Getter failed.' : undefined,
        };
      }),
    };
  }

  /** Called after a user operation, never as a side effect of rendering/snapshot delivery. */
  async refresh(objectId: string): Promise<void> {
    const generation = this.synchronize();
    const snapshot = this.runtime.getSnapshot();
    if (snapshot.phase !== 'ready' || this.requests.has(objectId)) return;
    const fields = snapshot.inspections[objectId]?.fields || [];
    const token = {};
    this.requests.set(objectId, token);
    const current = () => this.runtime.getSnapshot().generationId === generation && this.requests.get(objectId) === token;
    try {
      for (const field of fields.filter(field => field.value === '<computed>')) {
        if (!current() || this.runtime.getSnapshot().phase !== 'ready') break;
        const value = await this.runtime.execute({ op: 'get', objectId, property: field.name });
        if (!current()) return;
        const values = this.values.get(objectId) || new Map<string, RuntimeValue>();
        values.set(field.name, value);
        this.values.set(objectId, values);
        this.changed();
      }
    } catch (error) {
      // Reset/compile cancels pending requests. Other transport failures belong to runtime.error.
      if (current() && this.runtime.getSnapshot().phase === 'ready') throw error;
    } finally {
      if (current()) this.requests.delete(objectId);
    }
  }
}

export function inspectorFieldText(field: InspectedField, type?: TypeRef | null): string {
  return (type || field.type)?.classifier === 'String' && field.value !== 'null' && field.value !== '<computed>'
    ? JSON.stringify(field.value) : field.value;
}
