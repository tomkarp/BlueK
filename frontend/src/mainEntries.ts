import type { CallableMeta, ClassMeta } from '../../runtime-contract/src/index';

/** `main()` or, as in Kotlin, `main(args: Array<String>)`; the runtime passes an empty array (RT-96). */
function isEntryPoint(method: CallableMeta): boolean {
  if (method.name !== 'main') return false;
  if (method.parameters.length === 0) return true;
  const [only] = method.parameters;
  return method.parameters.length === 1 && only.type.classifier === 'Array' && !only.type.nullable &&
    only.type.arguments.length === 1 && only.type.arguments[0].classifier === 'String' && !only.type.arguments[0].nullable;
}

/** Entry points are derived from the compiled runtime manifest, never source text. */
export function mainFiles(classes: ClassMeta[]): string[] {
  return classes.filter(owner => owner.kind === 'functions' && owner.methods.some(isEntryPoint))
    .map(owner => owner.id);
}

/** A caller must choose explicitly when more than one entry point exists. */
export function resolveMainFile(classes: ClassMeta[], fileName?: string): string {
  const candidates = mainFiles(classes);
  if (fileName !== undefined) {
    if (!candidates.includes(fileName)) throw new Error(`No parameterless main() in ${fileName}.`);
    return fileName;
  }
  if (!candidates.length) throw new Error('This project has no parameterless main().');
  if (candidates.length > 1) throw new Error('Choose which main() to run.');
  return candidates[0];
}
