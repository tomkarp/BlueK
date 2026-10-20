import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundle = await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8');
vm.runInThisContext(bundle, { filename: 'bluek-kotlite-browser.js' });
const session = globalThis['bluek-kotlite-browser'].bluekCreateKotliteSession();
const expectOk = (value, label) => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (parsed.kind === 'error') throw new Error(`${label}: ${parsed.display}`);
  return parsed;
};
const wait = (subscribe, label) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`${label} timed out.`)), 3000);
  subscribe(value => {
    clearTimeout(timeout);
    resolve(value);
  });
});
const source = `fun main() {
    var sum = 0
    var i = 1
    while (i <= 2) {
        sum += twice(i)
        i += 1
    }
    println(sum)
}
fun twice(n: Int): Int {
    val doubled = n * 2
    return doubled
}`;
let loaded;
expectOk(session.startLoadProject(['Main.kt'], [source], null, 0, () => {}, value => { loaded = expectOk(value, 'project compile'); }), 'project compile start');
while (!loaded) await new Promise(resolve => setTimeout(resolve, 0));

const pauses = [];
let completed;
expectOk(JSON.parse(session.setDebugBreakpoint('Main.kt', 2, true)), 'set main breakpoint');
const invalidBreakpoint = JSON.parse(session.setDebugBreakpoint('Main.kt', 9, true));
if (invalidBreakpoint.kind !== 'error') throw new Error('A breakpoint was accepted on a closing brace.');
session.setDebugPauseCallback(value => pauses.push(JSON.parse(value)));
expectOk(session.startMain('Main.kt', () => {}, value => { completed = expectOk(value, 'stepped main'); }), 'start main');
const first = await wait(callback => {
  const timer = setInterval(() => {
    if (pauses.length) { clearInterval(timer); callback(pauses.shift()); }
  }, 0);
}, 'first pause');
if (first.fileName !== 'Main.kt' || first.line !== 2) throw new Error(`Expected first pause at Main.kt:2, got ${first.fileName}:${first.line}.`);
expectOk(session.resumeDebug('step'), 'single step');
const second = await wait(callback => {
  const timer = setInterval(() => {
    if (pauses.length) { clearInterval(timer); callback(pauses.shift()); }
  }, 0);
}, 'second pause');
if (second.fileName !== 'Main.kt' || second.line !== 3) throw new Error(`Expected step pause at Main.kt:3, got ${second.fileName}:${second.line}.`);
const sum = second.variables.find(variable => variable.name === 'sum');
if (sum?.display !== '0' || sum.initialized !== true) throw new Error(`Expected stored local sum = 0 at the second pause, got ${JSON.stringify(second.variables)}.`);
expectOk(session.resumeDebug('continue'), 'continue');
while (!completed) await new Promise(resolve => setTimeout(resolve, 0));
const output = session.takeOutput();
if (output !== '6\n') throw new Error(`Expected exactly one final output of 6, got ${JSON.stringify(output)}.`);
console.log('debugger: real main coroutine paused before Main.kt:2, exposed sum = 0 after one step, and continued with output 6');

const objectSession = globalThis['bluek-kotlite-browser'].bluekCreateKotliteSession();
const objectSource = `class Calculator {
    var getterReads = 0
    val danger: Int
        get() { getterReads += 1; return 9 }
    fun twice(value: Int): Int {
        val result = value * 2
        return result
    }
    val name = "Wuffi"
}`;
let objectLoaded;
expectOk(objectSession.startLoadProject(['Calculator.kt'], [objectSource], null, 0, () => {}, value => { objectLoaded = expectOk(value, 'object project compile'); }), 'object project compile start');
while (!objectLoaded) await new Promise(resolve => setTimeout(resolve, 0));
expectOk(JSON.parse(objectSession.setDebugBreakpoint('Calculator.kt', 7, true)), 'set method breakpoint');
const objectPauses = [];
objectSession.setDebugPauseCallback(value => objectPauses.push(JSON.parse(value)));
let objectComplete;
expectOk(objectSession.startEvaluate('<object menu>', 'val calculator = Calculator(); calculator.twice(4)', () => {}, value => { objectComplete = expectOk(value, 'object method result'); }), 'object method start');
const objectPause = await wait(callback => {
  const timer = setInterval(() => {
    if (objectPauses.length) { clearInterval(timer); callback(objectPauses.shift()); }
  }, 0);
}, 'object breakpoint');
if (objectPause.fileName !== 'Calculator.kt' || objectPause.line !== 7) throw new Error(`Expected object breakpoint at Calculator.kt:7, got ${objectPause.fileName}:${objectPause.line}.`);
if (!objectPause.variables.some(variable => variable.name === 'value' && variable.display === '4')) throw new Error(`Object call parameter was not captured: ${JSON.stringify(objectPause.variables)}.`);
if (!objectPause.attributes.some(attribute => attribute.name === 'name' && attribute.display === '"Wuffi"')) throw new Error(`Object receiver attribute was not captured: ${JSON.stringify(objectPause.attributes)}.`);
if (!objectPause.attributes.some(attribute => attribute.name === 'danger' && attribute.computed === true && attribute.initialized === false)) throw new Error(`Computed getter was not identified without execution: ${JSON.stringify(objectPause.attributes)}.`);
expectOk(JSON.parse(objectSession.resumeDebug('continue')), 'continue object call');
while (!objectComplete) await new Promise(resolve => setTimeout(resolve, 0));
if (objectComplete.display !== '8') throw new Error(`Object method returned ${objectComplete.display}, expected 8.`);
if (JSON.parse(objectSession.evaluate('<debugger getter effects>', 'calculator.getterReads')).display !== '0') throw new Error('Debugger attribute capture unexpectedly executed a computed property getter.');
console.log('debugger: object method breakpoint captured stored attributes and listed computed properties without invoking getters');

const constructorSession = globalThis['bluek-kotlite-browser'].bluekCreateKotliteSession();
const constructorSource = `class Box {
    val value = 1
    init {
        val ready = value
    }
}`;
const constructorMain = `fun main() {
    val box = Box()
    println(box.value)
}`;
let constructorLoaded;
expectOk(constructorSession.startLoadProject(['Box.kt', 'Main.kt'], [constructorSource, constructorMain], null, 0, () => {}, value => { constructorLoaded = expectOk(value, 'constructor project compile'); }), 'constructor project compile start');
while (!constructorLoaded) await new Promise(resolve => setTimeout(resolve, 0));
const constructorPauses = [];
constructorSession.setDebugPauseCallback(value => constructorPauses.push(JSON.parse(value)));
let constructorComplete;
expectOk(JSON.parse(constructorSession.setDebugBreakpoint('Main.kt', 2, true)), 'set constructor call breakpoint');
expectOk(constructorSession.startMain('Main.kt', () => {}, value => { constructorComplete = expectOk(value, 'constructor main'); }), 'start constructor main');
const callPause = await wait(callback => {
  const timer = setInterval(() => {
    if (constructorPauses.length) { clearInterval(timer); callback(constructorPauses.shift()); }
  }, 0);
}, 'constructor call breakpoint');
if (callPause.fileName !== 'Main.kt' || callPause.line !== 2) throw new Error(`Expected pause at Main.kt:2 before construction, got ${callPause.fileName}:${callPause.line}.`);
expectOk(JSON.parse(constructorSession.resumeDebug('stepIn')), 'step into constructor');
const constructorPause = await wait(callback => {
  const timer = setInterval(() => {
    if (constructorPauses.length) { clearInterval(timer); callback(constructorPauses.shift()); }
  }, 0);
}, 'constructor initializer pause');
if (constructorPause.fileName !== 'Box.kt' || constructorPause.line !== 2) throw new Error(`Step in did not enter the property initializer; got ${constructorPause.fileName}:${constructorPause.line}.`);
expectOk(JSON.parse(constructorSession.resumeDebug('continue')), 'continue constructor');
while (!constructorComplete) await new Promise(resolve => setTimeout(resolve, 0));
if (constructorSession.takeOutput() !== '1\n') throw new Error('Constructor step-in changed program output.');
console.log('debugger: Step in entered the constructor property initializer at Box.kt:2');

const propertyConstructorSession = globalThis['bluek-kotlite-browser'].bluekCreateKotliteSession();
const propertyConstructorSource = `class NamedBox(val name: String) {
    val value = 1
}`;
const propertyConstructorMain = `fun main() {
    val box = NamedBox("Bello")
    println(box.value)
}`;
let propertyConstructorLoaded;
expectOk(propertyConstructorSession.startLoadProject(
  ['NamedBox.kt', 'Main.kt'],
  [propertyConstructorSource, propertyConstructorMain],
  null,
  0,
  () => {},
  value => { propertyConstructorLoaded = expectOk(value, 'primary-property project compile'); },
), 'primary-property project compile start');
while (!propertyConstructorLoaded) await new Promise(resolve => setTimeout(resolve, 0));
expectOk(JSON.parse(propertyConstructorSession.setDebugBreakpoint('Main.kt', 2, true)), 'set primary-property call breakpoint');
expectOk(JSON.parse(propertyConstructorSession.setDebugBreakpoint('NamedBox.kt', 1, true)), 'set primary-property assignment breakpoint');
const propertyConstructorPauses = [];
propertyConstructorSession.setDebugPauseCallback(value => propertyConstructorPauses.push(JSON.parse(value)));
let propertyConstructorComplete;
expectOk(propertyConstructorSession.startMain('Main.kt', () => {}, value => {
  propertyConstructorComplete = expectOk(value, 'primary-property main');
}), 'start primary-property main');
const propertyCallPause = await wait(callback => {
  const timer = setInterval(() => {
    if (propertyConstructorPauses.length) { clearInterval(timer); callback(propertyConstructorPauses.shift()); }
  }, 0);
}, 'primary-property call breakpoint');
if (propertyCallPause.fileName !== 'Main.kt' || propertyCallPause.line !== 2 || !propertyCallPause.stepInAvailable) {
  throw new Error(`Expected an enterable constructor call at Main.kt:2, got ${JSON.stringify(propertyCallPause)}.`);
}
expectOk(JSON.parse(propertyConstructorSession.resumeDebug('stepIn')), 'step into primary-property constructor');
const propertyAssignmentPause = await wait(callback => {
  const timer = setInterval(() => {
    if (propertyConstructorPauses.length) { clearInterval(timer); callback(propertyConstructorPauses.shift()); }
  }, 0);
}, 'primary-property assignment breakpoint');
if (propertyAssignmentPause.fileName !== 'NamedBox.kt' || propertyAssignmentPause.line !== 1) {
  throw new Error(`Step in did not stop on the primary-property assignment at NamedBox.kt:1: ${JSON.stringify(propertyAssignmentPause)}.`);
}
for (const name of ['name', 'value']) {
  if (!propertyAssignmentPause.attributes.some(attribute => attribute.name === name && attribute.initialized === false)) {
    throw new Error(`Expected ${name} to be visible but uninitialized before constructor assignments: ${JSON.stringify(propertyAssignmentPause.attributes)}.`);
  }
}
expectOk(JSON.parse(propertyConstructorSession.resumeDebug('step')), 'step primary-property assignment');
const propertyInitializerPause = await wait(callback => {
  const timer = setInterval(() => {
    if (propertyConstructorPauses.length) { clearInterval(timer); callback(propertyConstructorPauses.shift()); }
  }, 0);
}, 'property initializer after primary-property assignment');
if (propertyInitializerPause.fileName !== 'NamedBox.kt' || propertyInitializerPause.line !== 2) {
  throw new Error(`Expected the next constructor pause at NamedBox.kt:2, got ${propertyInitializerPause.fileName}:${propertyInitializerPause.line}.`);
}
if (!propertyInitializerPause.attributes.some(attribute => attribute.name === 'name' && attribute.display === '"Bello"')) {
  throw new Error(`Primary-constructor attribute was not assigned after one step: ${JSON.stringify(propertyInitializerPause.attributes)}.`);
}
expectOk(JSON.parse(propertyConstructorSession.resumeDebug('continue')), 'continue primary-property constructor');
while (!propertyConstructorComplete) await new Promise(resolve => setTimeout(resolve, 0));
if (propertyConstructorSession.takeOutput() !== '1\n') throw new Error('Primary-property stepping changed program output.');
console.log('debugger: Step in pauses on a primary-constructor property assignment, then advances to the next initializer');
