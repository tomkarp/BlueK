import type { ClassMeta } from '../../runtime-contract/src/index';

/** Entry points are derived from the compiled runtime manifest, never source text. */
export function mainFiles(classes: ClassMeta[]): string[] {
  return classes.filter(owner => owner.kind === 'functions' &&
    owner.methods.some(method => method.name === 'main' && method.parameters.length === 0))
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
