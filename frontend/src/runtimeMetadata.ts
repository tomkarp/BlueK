import type { CallableMeta, ClassMeta, ProjectFile, SymbolManifest } from '../../runtime-contract/src/index';

// Presentation grouping only: signatures and types come from Kotlite.
export function manifestClasses(manifest: SymbolManifest, files: ProjectFile[]): ClassMeta[] {
  if (!Array.isArray(manifest.classes) || !Array.isArray(manifest.functions)) {
    throw new Error('Kotlite returned an invalid manifest.');
  }
  const cards = files.flatMap(file => {
    if (file.kind !== 'functions') return [];
    return [{ id: file.fileName, name: file.fileName.replace(/\.kt$/, ''), kind: 'functions',
      constructors: [], properties: [], supertypes: [], typeParameters: [],
      methods: manifest.functions.filter(m => m.sourceFile === file.fileName || (!m.sourceFile && m.sourceLine >= 0 && !m.builtin)),
    }];
  });
  const all: ClassMeta[] = [...manifest.classes.map(item => ({ ...item, builtin: item.builtin || false })), ...cards];
  const byName = new Map(all.map(value => [value.name, value]));
  const visit = (item: ClassMeta, path: Set<string>): ClassMeta => {
    if (path.has(item.name)) throw new Error('Cyclic class inheritance in manifest.');
    const nextPath = new Set(path).add(item.name);
    const parents = item.supertypes.flatMap(type => {
      const parent = byName.get(type.classifier);
      return parent ? [visit(parent, nextPath)] : [];
    });
    const signature = (m: CallableMeta) => m.name + '(' + m.parameters.map(p => p.type.displayName).join(',') + ')';
    const own = new Set(item.methods.map(signature));
    const properties = new Set(item.properties.map(p => p.name));
    return { ...item,
      methods: [...item.methods, ...parents.flatMap(parent => parent.methods
        .filter(method => !own.has(signature(method)))
        .map(method => ({ ...method, inheritedFrom: method.inheritedFrom || parent.name })))],
      properties: [...item.properties, ...parents.flatMap(parent => parent.properties.filter(p => !properties.has(p.name)))],
    };
  };
  return all.map(item => visit(item, new Set()));
}
