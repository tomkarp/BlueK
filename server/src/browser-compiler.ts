import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ClassMeta, ProjectFile } from '../../runtime-contract/src/index.js';

const browserPackage = 'de.tomkarp.bluek.bridge';
const frameworkNames = new Set(['Actor', 'World', 'Image', 'BluePlayFunctions']);

const kotlinIdentifier = (value: string) => value.replace(/[^A-Za-z0-9_]/g, '_');
const typeName = (displayName: string) => displayName.trim().replace(/\?$/, '').replace(/<.*$/, '').replace(/^in\s+|^out\s+/, '').trim();
const packageOf = (source: string) => source.match(/^\s*package\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/m)?.[1] || '';
const kotlinType = (displayName: string) => {
    const raw = displayName.trim();
    const nullable = raw.endsWith('?');
    const type = typeName(raw);
    const suffix = nullable ? '?' : '';
    if (type === 'String') return `String${suffix}`;
    if (type === 'Int') return `Int${suffix}`;
    if (type === 'Double') return `Double${suffix}`;
    if (type === 'Float') return `Float${suffix}`;
    if (type === 'Boolean') return `Boolean${suffix}`;
    if (type === 'Long') return `Long${suffix}`;
    if (type === 'Short') return `Short${suffix}`;
    if (type === 'Byte') return `Byte${suffix}`;
    return `${type}${suffix}`;
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
    const imports = new Set<string>();
    for (const file of files) {
        const pkg = packageOf(file.source);
        if (pkg && pkg !== mainPackage) for (const klass of classes) if (klass.name && file.source.includes(`class ${klass.name}`)) imports.add(`${pkg}.${klass.name}`);
    }
    const bridgePackage = mainPackage;
    const lines = [
        ...(bridgePackage ? [`package ${bridgePackage}`] : []),
        'import kotlin.js.ExperimentalJsExport',
        'import kotlin.js.JsExport',
        ...[...imports].map(value => `import ${value}`),
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
    if (mainPackage) lines.push(`import ${mainPackage}.main`);
    if (mainFile) {
        lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', 'fun bluekStart() { main() }');
    }
    for (const klass of classes.filter(value => value.kind === 'class' && value.constructors.length && !frameworkNames.has(value.name))) {
        const className = kotlinIdentifier(klass.name);
        const constructor = klass.constructors[0];
        const constructorParameters = requiredParameters(constructor.parameters || []);
        const parameters = constructorParameters.map((parameter, index) => `arg${index}: ${kotlinType(parameter.type.displayName)}`);
        lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', `fun bluekCreate_${className}(${parameters.join(', ')}): ${klass.name} = ${klass.name}(${parameters.map((_, index) => `arg${index}`).join(', ')})`);
        const source = files.find(file => file.fileName.replace(/\.kt$/, '') === klass.name)?.source || '';
        const fieldNames = [...source.matchAll(/\b(?:val|var)\s+(\w+)\s*:/g)].map(match => match[1]);
        const fieldJson = JSON.stringify(fieldNames).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', `fun bluekInspectNames_${className}(): String = "${fieldJson}"`);
        for (const method of klass.methods.filter(value => value.visibility === 'public' && !value.typeParameters?.length && !value.returnType.displayName.startsWith('List') && !value.parameters.some(parameter => parameter.type.displayName.startsWith('List')))) {
            const methodMeta = method as typeof method & { autoGenerated?: boolean; propertyName?: string };
            const methodName = kotlinIdentifier(method.name);
            const args = requiredParameters(method.parameters || []).map((parameter, index) => `arg${index}: ${kotlinType(parameter.type.displayName)}`);
            const returnType = kotlinType(method.returnType.displayName);
            const requiredKey = bridgeMethodKey({ ...method, parameters: requiredParameters(method.parameters || []) });
            const setter = methodMeta.autoGenerated && method.name.startsWith('set');
            const propertyName = methodMeta.propertyName || '';
            const body = methodMeta.autoGenerated ? (setter ? `{ receiver.${propertyName} = arg0 }` : `= receiver.${propertyName}`) : `= receiver.${method.name}(${bridgeCallArguments(methodMeta).join(', ')})`;
            lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', `fun bluekInvoke_${className}_${requiredKey}(receiver: ${klass.name}${args.length ? `, ${args.join(', ')}` : ''}): ${returnType} ${body}`);
        }
    }
    for (const owner of classes.filter(value => value.kind === 'functions')) {
        for (const method of owner.methods.filter(value => value.declaringType === owner.name && value.visibility === 'public' && !value.typeParameters?.length && !value.returnType.displayName.startsWith('List') && !value.parameters.some(parameter => parameter.type.displayName.startsWith('List')))) {
            const args = requiredParameters(method.parameters || []).map((parameter, index) => `arg${index}: ${kotlinType(parameter.type.displayName)}`);
            const returnType = kotlinType(method.returnType.displayName);
            const requiredKey = bridgeMethodKey({ ...method, parameters: requiredParameters(method.parameters || []) });
            lines.push('', '@OptIn(ExperimentalJsExport::class)', '@JsExport', `fun bluekCall_${kotlinIdentifier(owner.name)}_${requiredKey}(${args.join(', ')}): ${returnType} = ${method.name}(${bridgeCallArguments(method).join(', ')})`);
        }
    }
    return { source: `${lines.join('\n')}\n`, packageName: bridgePackage };
}

const run = (command: string, args: string[], cwd: string) => new Promise<{ code: number; out: string; err: string }>(resolve => execFile(command, args, { cwd, maxBuffer: 20e6, timeout: 120000 }, (error, stdout, stderr) => resolve({ code: error ? Number(error.code) || 1 : 0, out: stdout, err: stderr })));

export async function compileBrowserProject(root: string, sessionDir: string, files: ProjectFile[], classes: ClassMeta[]): Promise<{ ok: boolean; diagnostics: string; directory: string }> {
    const buildDir = path.join(sessionDir, 'browser');
    const bridgeDir = path.join(buildDir, 'bridge');
    // Keep Gradle's build directory between generations. Kotlin/JS compilation is
    // expensive; the generated bridge and filtered project are the only inputs
    // that must be replaced for a session compile.
    await fs.rm(path.join(buildDir, 'bridge'), { recursive: true, force: true });
    await fs.rm(path.join(buildDir, 'project'), { recursive: true, force: true });
    await fs.rm(path.join(buildDir, 'build'), { recursive: true, force: true });
    await fs.cp(path.join(root, 'browser-runtime'), buildDir, { recursive: true });
    // The framework implementation is a fixed JavaScript module. Keep only
    // the Gradle project files here; the old Kotlin runtime must not enter the
    // student's compilation unit.
    await fs.rm(path.join(buildDir, 'src'), { recursive: true, force: true });
    await fs.mkdir(bridgeDir, { recursive: true });
    const browserProjectDir = path.join(buildDir, 'project');
    await fs.mkdir(browserProjectDir, { recursive: true });
    const frameworkFiles = new Set(['Actor.kt', 'World.kt', 'Image.kt', 'BluePlayFunctions.kt']);
    for (const file of files) if (!frameworkFiles.has(file.fileName)) await fs.copyFile(path.join(sessionDir, 'project', file.fileName), path.join(browserProjectDir, file.fileName));
    await fs.copyFile(path.join(root, 'browser-runtime-js', 'BluePlayApi.kt'), path.join(browserProjectDir, 'BluePlayApi.kt'));
    const packages = new Set(files.map(file => packageOf(file.source)));
    for (const pkg of packages) {
        const prefix = pkg ? `package ${pkg}\n\n` : '';
        const fileName = `BlueKInput${pkg ? `_${kotlinIdentifier(pkg)}` : ''}.kt`;
        await fs.writeFile(path.join(browserProjectDir, fileName), `${prefix}fun readln(): String = bluekReadln()\nfun readlnOrNull(): String? = bluekReadlnOrNull()\n`);
    }
    const bridge = bridgeSource(files, classes);
    await fs.writeFile(path.join(bridgeDir, 'BlueKBridge.kt'), bridge.source);
    const result = await run(path.join(root, 'jvm', 'gradlew'), ['jsBrowserProductionLibraryDistribution', '--no-daemon', `-PbluekProjectDir=${browserProjectDir}`, `-PbluekBridgeDir=${bridgeDir}`], buildDir);
    if (result.code) return { ok: false, diagnostics: `${result.out}\n${result.err}`.trim(), directory: buildDir };
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
