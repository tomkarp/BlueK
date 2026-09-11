import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ClassMeta, ProjectFile } from '../../runtime-contract/src/index.js';

const browserPackage = 'de.tomkarp.bluek.bridge';
const frameworkNames = new Set(['Actor', 'World', 'Image', 'BluePlayFunctions']);

const kotlinIdentifier = (value: string) => value.replace(/[^A-Za-z0-9_]/g, '_');
const typeName = (displayName: string) => displayName.trim().replace(/\?$/, '').replace(/^in\s+|^out\s+/, '').trim();
const packageOf = (source: string) => source.match(/^\s*package\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/m)?.[1] || '';
const splitTopLevelStatements = (source: string): string[] => {
    const result: string[] = [];
    let start = 0;
    let round = 0;
    let curly = 0;
    let square = 0;
    let quote = '';
    let escaped = false;
    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = '';
            continue;
        }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === '(') round += 1;
        else if (char === ')') round = Math.max(0, round - 1);
        else if (char === '{') curly += 1;
        else if (char === '}') curly = Math.max(0, curly - 1);
        else if (char === '[') square += 1;
        else if (char === ']') square = Math.max(0, square - 1);
        else if ((char === '\n' || char === ';') && round === 0 && curly === 0 && square === 0) {
            const statement = source.slice(start, index).trim();
            if (statement) result.push(statement);
            start = index + 1;
        }
    }
    const last = source.slice(start).trim();
    if (last) result.push(last);
    return result;
};
const codepadFunctionBody = (source: string): string => {
    const statements = splitTopLevelStatements(source);
    const last = statements.at(-1)?.trim() || '';
    if (!last) return 'return Unit';
    const withoutStrings = last.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
    const isStatement = /^(?:val|var|fun|class|object|typealias|import|package|return|throw|break|continue|for|while|do)\b/.test(last)
        || /(^|[^=!<>])=($|[^=])/.test(withoutStrings);
    const isExpressionBlock = /^(?:if|when|try)\b/.test(last);
    if (isStatement && !isExpressionBlock) return `${source}\nreturn Unit`;
    const lastStart = source.lastIndexOf(last);
    const prefix = lastStart >= 0 ? source.slice(0, lastStart).trimEnd() : '';
    return `${prefix}${prefix ? '\n' : ''}return ${last}`;
};
const browserCompatibleSource = (source: string) => source
    .replace(/@JvmSynthetic\b/g, '')
    .replace(/\bThread\.sleep\s*\(/g, 'bluekSleep(')
    .replace(/\bSystem\.err\b/g, 'bluekSystemErr');
const splitTypeArguments = (source: string) => {
    const result: string[] = [];
    let start = 0;
    let depth = 0;
    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '<') depth += 1;
        else if (source[index] === '>') depth -= 1;
        else if (source[index] === ',' && depth === 0) { result.push(source.slice(start, index).trim()); start = index + 1; }
    }
    if (source.slice(start).trim()) result.push(source.slice(start).trim());
    return result;
};

const kotlinType = (displayName: string, bindings: Map<string, string> = new Map(), knownTypes: Set<string> = new Set()): string => {
    const raw = displayName.trim();
    const nullable = raw.endsWith('?');
    const withoutNullable = nullable ? raw.slice(0, -1).trim() : raw;
    const variance = withoutNullable.match(/^(in|out)\s+(.+)$/);
    if (variance) return `${variance[1]} ${kotlinType(variance[2], bindings, knownTypes)}`;
    const projected = withoutNullable;
    if (bindings.has(projected)) return `${bindings.get(projected)}${nullable ? '?' : ''}`;
    // Function types and Kotlin collection types are not valid @JsExport
    // signatures in all compiler versions. They remain usable in student code,
    // but are deliberately omitted from generated callable bridges below.
    if (/\([^)]*\)\s*->/.test(projected)) return 'Any?';
    const open = projected.indexOf('<');
    if (open >= 0 && projected.endsWith('>')) {
        const base = projected.slice(0, open).trim();
        const args: string[] = splitTypeArguments(projected.slice(open + 1, -1)).map(argument => kotlinType(argument, bindings, knownTypes));
        if (['Array', 'List', 'MutableList', 'Set', 'MutableSet', 'Map', 'MutableMap', 'Collection', 'Iterable', 'Sequence'].includes(base) || knownTypes.has(base)) {
            return `${base}<${args.join(', ')}>${nullable ? '?' : ''}`;
        }
        return `Any?`;
    }
    const type = projected.trim();
    if (['String', 'Int', 'Double', 'Float', 'Boolean', 'Long', 'Short', 'Byte', 'Char', 'Number', 'Any', 'Unit', 'Nothing'].includes(type) || knownTypes.has(type)) return `${type}${nullable ? '?' : ''}`;
    return `Any?`;
};
const bridgeMethodKey = (method: { name: string; parameters: { type: { displayName: string } }[] }) => `${kotlinIdentifier(method.name)}_${method.parameters.map(parameter => kotlinIdentifier(typeName(parameter.type.displayName))).join('_') || 'noargs'}`;
const requiredParameters = <T extends { hasDefault?: boolean }>(parameters: T[]) => parameters.filter(parameter => !parameter.hasDefault);
const bridgeCallArguments = (method: { parameters: { name: string; hasDefault?: boolean }[] }) => {
    let requiredIndex = 0;
    return method.parameters.flatMap((parameter, index) => {
        if (parameter.hasDefault) return [];
        const argument = `arg${requiredIndex++}`;
        const needsName = method.parameters.slice(0, index).some(previous => previous.hasDefault);
        return [needsName ? `${parameter.name} = ${argument}` : argument];
    });
};

function bridgeSource(files: ProjectFile[], classes: ClassMeta[]): { source: string; packageName: string } {
    const mainFile = files.find(file => file.fileName === 'Main.kt') || files.find(file => /\bfun\s+main\s*\(/.test(file.source));
    const mainPackage = mainFile ? packageOf(mainFile.source) : '';
    const projectPackage = files.map(file => packageOf(file.source)).find(Boolean) || '';
    const imports = new Set<string>();
    const knownTypes = new Set([...classes.map(value => value.name), ...frameworkNames]);
    for (const file of files) {
        const pkg = packageOf(file.source);
        if (pkg && pkg !== (mainPackage || projectPackage)) {
            for (const klass of classes) if (klass.name && file.source.includes(`class ${klass.name}`)) imports.add(`${pkg}.${klass.name}`);
            if (file.kind === 'functions') for (const method of classes.find(value => value.name === file.fileName.replace(/\.kt$/, ''))?.methods || []) imports.add(`${pkg}.${method.name}`);
        }
    }
    const bridgePackage = mainPackage || projectPackage;
    const lines = [
        ...(bridgePackage ? [`package ${bridgePackage}`] : []),
        'import kotlin.js.ExperimentalJsExport',
        'import kotlin.js.JsExport',
        ...[...imports].map(value => `import ${value}`),
        ...(mainPackage ? [`import ${mainPackage}.main`] : []),
        '',
        '@OptIn(ExperimentalJsExport::class)',
        '@JsExport',
        'fun bluekRuntimeVersion(): String = "bluek-js-1"',
        '',
        '@OptIn(ExperimentalJsExport::class)',
        '@JsExport',
        'fun bluekFlushOutput() { println("") }',
        '',
        '@OptIn(ExperimentalJsExport::class)',
        '@JsExport',
        'fun bluekStage(): String = bluekStageJson()',
    ];
    if (mainFile) {
        lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', 'fun bluekStart() { main() }');
    }
    for (const klass of classes.filter(value => value.kind === 'class' && value.constructors.length && !frameworkNames.has(value.name))) {
        const className = kotlinIdentifier(klass.name);
        const typeBindings = new Map<string, string>();
        for (const value of klass.typeParameters || []) {
            const [name, bound] = value.split(':', 2).map(part => part.trim());
            if (name) typeBindings.set(name, bound ? kotlinType(bound, new Map(), knownTypes) : 'Any?');
        }
        const classType = klass.typeParameters?.length ? `${klass.name}<${klass.typeParameters.map(value => typeBindings.get(value.split(':', 2)[0].trim()) || 'Any?').join(', ')}>` : klass.name;
        klass.constructors.forEach((constructor, constructorIndex) => {
            const constructorParameters = requiredParameters(constructor.parameters || []);
            const unsupportedConstructor = constructorParameters.some(parameter => /\([^)]*\)\s*->/.test(parameter.type.displayName));
            if (unsupportedConstructor) return;
            const parameters = constructorParameters.map((parameter, index) => `arg${index}: ${kotlinType(parameter.type.displayName, typeBindings, knownTypes)}`);
            const suffix = constructorIndex === 0 ? '' : `_${constructorIndex}`;
            lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', `fun bluekCreate_${className}${suffix}(${parameters.join(', ')}): ${classType} = ${classType}(${parameters.map((_, index) => `arg${index}`).join(', ')})`);
        });
        // Use the class metadata here instead of reparsing the source. This
        // keeps the inspector in sync with properties whose type is inferred,
        // such as `var alter = 0`, as well as properties with custom getters.
        const fieldNames = (klass.properties || []).map(property => property.name);
        const fieldJson = JSON.stringify(fieldNames).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', `fun bluekInspectNames_${className}(): String = "${fieldJson}"`);
        for (const method of klass.methods.filter(value => value.visibility === 'public' && !value.typeParameters?.length && !(value.inheritedFrom && frameworkNames.has(value.declaringType)) && !value.parameters.some(parameter => parameter.type.displayName.startsWith('List') || /\([^)]*\)\s*->/.test(parameter.type.displayName)))) {
            const methodMeta = method as typeof method & { autoGenerated?: boolean; propertyName?: string };
            const methodName = kotlinIdentifier(method.name);
            const args = requiredParameters(method.parameters || []).map((parameter, index) => `arg${index}: ${kotlinType(parameter.type.displayName, typeBindings, knownTypes)}`);
            const rawReturnType = kotlinType(method.returnType.displayName, typeBindings, knownTypes);
            const returnType = /^(?:List|MutableList|Set|MutableSet|Collection|Iterable|Sequence|Map|MutableMap)\b/.test(method.returnType.displayName.trim()) ? 'Any?' : rawReturnType;
            if (returnType === 'Any?' && method.returnType.displayName !== 'Any?' && !typeBindings.has(method.returnType.displayName.trim().replace(/\?$/, ''))) continue;
            const requiredKey = bridgeMethodKey({ ...method, parameters: requiredParameters(method.parameters || []) });
            const setter = methodMeta.autoGenerated && method.name.startsWith('set');
            const propertyName = methodMeta.propertyName || '';
            const body = methodMeta.autoGenerated ? (setter ? `{ receiver.${propertyName} = arg0 }` : `= receiver.${propertyName}`) : `= receiver.${method.name}(${bridgeCallArguments(methodMeta).join(', ')})`;
            // Let Kotlin infer the bridge return type from the student's
            // declaration.  This matters for expression-bodied functions:
            // the lightweight metadata parser reports Unit when no explicit
            // `: Type` is present, although the compiler may infer Boolean,
            // Int, String, etc.  An explicit, guessed Unit here makes the
            // generated bridge fail with a return-type mismatch.
            lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', `fun bluekInvoke_${className}_${requiredKey}(receiver: ${classType}${args.length ? `, ${args.join(', ')}` : ''}) ${body}`);
        }
    }
    for (const owner of classes.filter(value => value.kind === 'functions')) {
        for (const method of owner.methods.filter(value => value.declaringType === owner.name && value.visibility === 'public' && !value.typeParameters?.length && !value.parameters.some(parameter => parameter.type.displayName.startsWith('List') || /\([^)]*\)\s*->/.test(parameter.type.displayName)))) {
            const args = requiredParameters(method.parameters || []).map((parameter, index) => `arg${index}: ${kotlinType(parameter.type.displayName, new Map(), knownTypes)}`);
            const rawReturnType = kotlinType(method.returnType.displayName, new Map(), knownTypes);
            const returnType = /^(?:List|MutableList|Set|MutableSet|Collection|Iterable|Sequence|Map|MutableMap)\b/.test(method.returnType.displayName.trim()) ? 'Any?' : rawReturnType;
            if (returnType === 'Any?' && method.returnType.displayName !== 'Any?') continue;
            const requiredKey = bridgeMethodKey({ ...method, parameters: requiredParameters(method.parameters || []) });
            // As above, infer the return type instead of trusting regex
            // metadata for expression-bodied top-level functions.
            lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', `fun bluekCall_${kotlinIdentifier(owner.name)}_${requiredKey}(${args.join(', ')}) = ${method.name}(${bridgeCallArguments(method).join(', ')})`);
        }
    }
    return { source: `${lines.join('\n')}\n`, packageName: bridgePackage };
}

const run = (command: string, args: string[], cwd: string) => new Promise<{ code: number; out: string; err: string }>(resolve => execFile(command, args, { cwd, maxBuffer: 20e6, timeout: 120000 }, (error, stdout, stderr) => resolve({ code: error ? Number(error.code) || 1 : 0, out: stdout, err: stderr })));
const compilerDiagnostic = (result: { out: string; err: string }) => {
    const lines = `${result.out}\n${result.err}`.split(/\r?\n/).map(line => line.trim()).filter(line => /^(?:e|w):\s+file:\/\//.test(line)).map(line => line.replace(/file:\/\/.*\/(?:project|bridge)\/([^/:]+):(\d+):(\d+)/, (_match, file, lineNumber, column) => `${file === 'BlueKSnippet.kt' ? 'Codepad' : file}:${lineNumber}:${column}`));
    return lines.length ? lines.join('\n') : 'Kotlin/JS compilation failed.';
};

export async function compileBrowserProject(root: string, sessionDir: string, files: ProjectFile[], classes: ClassMeta[]): Promise<{ ok: boolean; diagnostics: string; directory: string }> {
    const buildDir = path.join(sessionDir, 'browser');
    const bridgeDir = path.join(buildDir, 'bridge');
    // Keep Gradle's build directory between generations. Kotlin/JS compilation is
    // expensive; the generated bridge and filtered project are the only inputs
    // that must be replaced for a session compile. Gradle will invalidate the
    // affected tasks from their file inputs without throwing away the toolchain.
    await fs.rm(path.join(buildDir, 'bridge'), { recursive: true, force: true });
    await fs.rm(path.join(buildDir, 'project'), { recursive: true, force: true });
    await fs.cp(path.join(root, 'browser-runtime'), buildDir, { recursive: true });
    // The framework implementation is a fixed JavaScript module. Keep only
    // the Gradle project files here; the old Kotlin runtime must not enter the
    // student's compilation unit.
    await fs.rm(path.join(buildDir, 'src'), { recursive: true, force: true });
    await fs.mkdir(bridgeDir, { recursive: true });
    const browserProjectDir = path.join(buildDir, 'project');
    await fs.mkdir(browserProjectDir, { recursive: true });
    const frameworkFiles = new Set(['Actor.kt', 'World.kt', 'Image.kt', 'BluePlayFunctions.kt']);
    for (const file of files) if (!frameworkFiles.has(file.fileName)) await fs.writeFile(path.join(browserProjectDir, file.fileName), browserCompatibleSource(file.source));
    const packages = new Set(files.map(file => packageOf(file.source)));
    const apiSource = await fs.readFile(path.join(root, 'browser-runtime-js', 'BluePlayApi.kt'), 'utf8');
    for (const pkg of packages) {
        const prefix = pkg ? `package ${pkg}\n\n` : '';
        await fs.writeFile(path.join(browserProjectDir, `BlueKApi${pkg ? `_${kotlinIdentifier(pkg)}` : ''}.kt`), `${prefix}${apiSource}`);
    }
    for (const pkg of packages) {
        const prefix = pkg ? `package ${pkg}\n\n` : '';
        const fileName = `BlueKInput${pkg ? `_${kotlinIdentifier(pkg)}` : ''}.kt`;
        await fs.writeFile(path.join(browserProjectDir, fileName), `${prefix}fun readln(): String = bluekReadln()\nfun readlnOrNull(): String? = bluekReadlnOrNull()\nfun readLine(): String? = bluekReadlnOrNull()\nfun bluekSleep(millis: Long) {}\nobject bluekSystemErr { fun print(value: Any?) = kotlin.io.print(value); fun println(value: Any?) = kotlin.io.println(value); fun flush() {} }\n`);
    }
    const bridge = bridgeSource(files, classes);
    await fs.writeFile(path.join(bridgeDir, 'BlueKBridge.kt'), bridge.source);
    const result = await run(path.join(root, 'jvm', 'gradlew'), ['jsBrowserProductionLibraryDistribution', '--no-daemon', `-PbluekProjectDir=${browserProjectDir}`, `-PbluekBridgeDir=${bridgeDir}`], buildDir);
    if (result.code) return { ok: false, diagnostics: compilerDiagnostic(result), directory: buildDir };
    const output = path.join(buildDir, 'build', 'dist', 'js', 'productionLibrary');
    const dist = path.join(buildDir, 'dist');
    await fs.rm(dist, { recursive: true, force: true });
    await fs.cp(output, dist, { recursive: true });
    const compiledModule = path.join(dist, 'bluek-browser-runtime.js');
    await fs.rename(compiledModule, path.join(dist, 'student.js'));
    await fs.copyFile(path.join(root, 'browser-runtime-js', 'bluek-browser-runtime.js'), path.join(dist, 'bluek-runtime.js'));
    await fs.writeFile(compiledModule, [
        "import * as runtime from './bluek-runtime.js';",
        "import * as student from './student.js';",
        'export * from "./bluek-runtime.js";',
        'export * from "./student.js";',
        'Object.assign(globalThis, runtime, student);',
        '',
    ].join('\n'));
    return { ok: true, diagnostics: '', directory: buildDir };
}

export async function compileBrowserSnippet(root: string, sessionDir: string, source: string, snippetId: string, bindings: Array<string | { name: string; type: string; mutable?: boolean }> = []): Promise<{ ok: boolean; diagnostics: string; entry?: string }> {
    if (/^\s*package\b/m.test(source)) return { ok: false, diagnostics: 'Codepad expressions may not declare a package.' };
    const buildDir = path.join(sessionDir, 'browser', 'codepad', snippetId);
    const projectDir = path.join(buildDir, 'project');
    const bridgeDir = path.join(buildDir, 'bridge');
    await fs.rm(buildDir, { recursive: true, force: true });
    await fs.cp(path.join(root, 'browser-runtime'), buildDir, { recursive: true });
    await fs.rm(path.join(buildDir, 'src'), { recursive: true, force: true });
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(bridgeDir, { recursive: true });
    // Codepad modules live in the same browser generation as the project.
    // They must see the fixed BluePlay declarations as well; otherwise a
    // perfectly valid expression such as `World(10, 10, 1)` is compiled
    // without a constructor symbol and fails only when the user evaluates it.
    const apiSource = await fs.readFile(path.join(root, 'browser-runtime-js', 'BluePlayApi.kt'), 'utf8');
    await fs.writeFile(path.join(projectDir, 'BlueKApi.kt'), apiSource);
    await fs.writeFile(path.join(projectDir, 'BlueKInput.kt'), 'external fun __bluekReadln(): String\nexternal fun __bluekReadlnOrNull(): String?\nexternal fun __bluekPrint(value: Any?, newline: Boolean)\nfun readln(): String = __bluekReadln()\nfun readlnOrNull(): String? = __bluekReadlnOrNull()\nfun readLine(): String? = __bluekReadlnOrNull()\nfun print(value: Any?) = __bluekPrint(value, false)\nfun println(value: Any?) = __bluekPrint(value, true)\n');
    // Fixed BluePlay classes are already declared by BluePlayApi.kt. They are
    // resolved from the browser runtime, so declaring them again as dynamic
    // codepad bindings creates a Kotlin conflict (`class Actor` vs
    // `val Actor: dynamic`) in snippets that access an Actor property.
    const normalizedBindings = bindings.map(binding => typeof binding === 'string' ? { name: binding, type: 'dynamic', mutable: false } : binding);
    const declaredBindings = normalizedBindings.filter(binding => /^[A-Za-z_]\w*$/.test(binding.name) && !frameworkNames.has(binding.name) && !new RegExp(`\\b(?:val|var|fun|class|object)\\s+${binding.name}\\b`).test(source));
    const bindingDeclarations = declaredBindings.map(binding => {
        if (!binding.mutable) return `external val ${binding.name}: ${binding.type}`;
        const holder = `__bluekBinding_${binding.name}`;
        const type = binding.type === 'dynamic' ? 'dynamic' : binding.type;
        return `external val ${holder}: dynamic\nvar ${binding.name}: ${type}\n    get() = ${holder}.value as ${type}\n    set(value) { ${holder}.value = value }`;
    }).join('\n');
    const bridge = [
        'import kotlin.js.ExperimentalJsExport',
        'import kotlin.js.JsExport',
        bindingDeclarations,
        '',
        '@OptIn(ExperimentalJsExport::class)',
        '@JsExport',
        `fun bluekEval(): Any? {\n${codepadFunctionBody(source).split('\n').map(line => `    ${line}`).join('\n')}\n}`,
        '',
    ].join('\n');
    await fs.writeFile(path.join(bridgeDir, 'BlueKSnippet.kt'), bridge);
    const result = await run(path.join(root, 'jvm', 'gradlew'), ['jsBrowserProductionLibraryDistribution', '--no-daemon', `-PbluekProjectDir=${projectDir}`, `-PbluekBridgeDir=${bridgeDir}`], buildDir);
    if (result.code) return { ok: false, diagnostics: compilerDiagnostic(result) };
    const output = path.join(buildDir, 'build', 'dist', 'js', 'productionLibrary');
    const target = path.join(sessionDir, 'browser', 'dist');
    await fs.mkdir(target, { recursive: true });
    const files = await fs.readdir(output);
    for (const file of files) if (file !== 'bluek-browser-runtime.js') await fs.copyFile(path.join(output, file), path.join(target, file));
    const entry = `codepad-${snippetId}.js`;
    const rawEntry = `${entry}.umd.js`;
    await fs.copyFile(path.join(output, 'bluek-browser-runtime.js'), path.join(target, rawEntry));
    // Kotlin/JS library output is UMD and publishes its @JsExport functions
    // on the shared global object. Wrap each snippet in a real ES module so
    // cached A -> B -> A evaluations keep their own function reference.
    await fs.writeFile(path.join(target, entry), `await import('./kotlin-kotlin-stdlib.js?codepad=${kotlinIdentifier(snippetId)}');\nawait import('./${rawEntry}');\nconst bluekEval = globalThis['bluek-browser-runtime']?.bluekEval;\nexport { bluekEval };\n`);
    return { ok: true, diagnostics: '', entry };
}
