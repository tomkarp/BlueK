import type { InspectedField, RuntimeSnapshot, RuntimeValue, TypeRef } from '../../runtime-contract/src/index';

/** Only the capabilities needed to resolve an inspection; no UI or Worker dependency. */
export interface InspectorRuntime {
  getSnapshot(): Pick<RuntimeSnapshot, 'generationId' | 'phase' | 'inspections'>;
  execute(command: { op: 'inspectGet'; objectId: string; property: string }): Promise<RuntimeValue>;
}

export interface InspectorField extends InspectedField {
  computed: boolean;
  objectId?: string;
  error?: string;
}
export interface InspectionView extends Omit<RuntimeValue, 'fields'> {
  fields: InspectorField[];
}

/** Every property result belongs to the runtime snapshot; the UI owns only request lifetimes. */
export class InspectorModel {
  private generation = '';
  private requests = new Map<string, { repeat: boolean }>();

  constructor(private readonly runtime: InspectorRuntime, private readonly changed: () => void) {}

  private synchronize() {
    const generation = this.runtime.getSnapshot().generationId;
    if (generation !== this.generation) {
      this.generation = generation;
      this.requests.clear();
    }
    return generation;
  }

  forget(objectId: string) {
    this.requests.delete(objectId);
  }

  view(objectId: string): InspectionView | null {
    this.synchronize();
    const raw = this.runtime.getSnapshot().inspections[objectId];
    if (!raw) return null;
    return {
      ...raw,
      fields: (raw.fields || []).map(field => {
        return {
          ...field,
          computed: field.computed === true,
          value: field.value === '<computed>' ? '…' : field.value,
        };
      }),
    };
  }

  /** Called after a user operation, never as a side effect of rendering/snapshot delivery. */
  async refresh(objectId: string): Promise<void> {
    const generation = this.synchronize();
    const snapshot = this.runtime.getSnapshot();
    if (snapshot.phase !== 'ready') return;
    const pending = this.requests.get(objectId);
    if (pending) {
      // A user operation during inspection must not leave earlier getter
      // results displayed. Coalesce requests into a fresh pass afterwards.
      pending.repeat = true;
      return;
    }
    const token = { repeat: false };
    this.requests.set(objectId, token);
    const current = () => this.runtime.getSnapshot().generationId === generation && this.requests.get(objectId) === token;
    try {
      do {
        token.repeat = false;
        const fields = this.runtime.getSnapshot().inspections[objectId]?.fields || [];
        for (const field of fields) {
          if (!current() || this.runtime.getSnapshot().phase !== 'ready') return;
          await this.runtime.execute({ op: 'inspectGet', objectId, property: field.name });
          if (!current()) return;
          this.changed();
        }
      } while (current() && token.repeat && this.runtime.getSnapshot().phase === 'ready');
    } catch (error) {
      // Reset/compile cancels pending requests. Other transport failures belong to runtime.error.
      if (current() && this.runtime.getSnapshot().phase === 'ready') throw error;
    } finally {
      if (current()) this.requests.delete(objectId);
    }
  }
}

export function inspectorFieldText(field: InspectedField, type?: TypeRef | null): string {
  if (field.error) return field.value;
  return (type || field.type)?.classifier === 'String' && field.value !== 'null' && field.value !== '<computed>'
    ? JSON.stringify(field.value) : field.value;
}
