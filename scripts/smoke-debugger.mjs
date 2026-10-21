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

const bluePlaySession = globalThis['bluek-kotlite-browser'].bluekCreateKotliteSession();
bluePlaySession.configureBluePlay(true, 'debugger-blueplay-simulation');
const bluePlaySources = [
  `fun main() {
    val world = TestWorld()
    world.addObject(TestActor(), 1, 1)
    world.show()
}`,
  `class TestWorld : World(5, 5, 20) {
    var ticks = 0
    override fun act() {
        ticks += 1
        println("tick $ticks")
    }
}`,
  `class TestActor : Actor() {
    var acts = 0
    override fun act() {
        acts += 1
        println("actor $acts")
    }
}`,
];
let bluePlayLoaded;
expectOk(bluePlaySession.startLoadProject(
  ['Main.kt', 'TestWorld.kt', 'TestActor.kt'], bluePlaySources, 'blueplay', 1, () => {},
  value => { bluePlayLoaded = expectOk(value, 'BluePlay debugger project compile'); },
), 'BluePlay debugger project compile start');
while (!bluePlayLoaded) await new Promise(resolve => setTimeout(resolve, 0));
const bluePlayPauses = [];
bluePlaySession.setDebugPauseCallback(value => bluePlayPauses.push(JSON.parse(value)));
expectOk(JSON.parse(bluePlaySession.setDebugBreakpoint('TestWorld.kt', 4, true)), 'set BluePlay act breakpoint');
let bluePlayMainComplete;
expectOk(bluePlaySession.startBluePlayMain('Main.kt', () => {}, value => {
  bluePlayMainComplete = expectOk(value, 'BluePlay main');
}), 'start BluePlay main');
while (!bluePlayMainComplete) await new Promise(resolve => setTimeout(resolve, 0));
if (!JSON.parse(bluePlaySession.takeStage()).stage) throw new Error('BluePlay main did not show its world.');
const waitForBluePlayPause = async label => await wait(callback => {
  const timer = setInterval(() => {
    if (bluePlayPauses.length) { clearInterval(timer); callback(bluePlayPauses.shift()); }
  }, 0);
}, label);
const pauseBeforeAct = async label => {
  // The runtime host installs this callback anew for each scheduled game tick.
  bluePlaySession.setDebugPauseCallback(value => bluePlayPauses.push(JSON.parse(value)));
  let complete;
  expectOk(bluePlaySession.startBluePlayStep(() => {}, value => { complete = expectOk(value, `${label} step`); }), `${label} step start`);
  const pause = await waitForBluePlayPause(`${label} act breakpoint`);
  if (pause.fileName !== 'TestWorld.kt' || pause.line !== 4) {
    throw new Error(`Expected BluePlay to stop at TestWorld.kt:4, got ${pause.fileName}:${pause.line}.`);
  }
  return { pause, get complete() { return complete; } };
};
const firstAct = await pauseBeforeAct('first BluePlay tick');
if (!firstAct.pause.attributes.some(attribute => attribute.name === 'ticks' && attribute.display === '0')) {
  throw new Error(`BluePlay pause did not expose the pre-step world state: ${JSON.stringify(firstAct.pause.attributes)}.`);
}
expectOk(JSON.parse(bluePlaySession.resumeDebug('step')), 'step BluePlay act');
const actBodyPause = await waitForBluePlayPause('BluePlay next act statement');
if (actBodyPause.fileName !== 'TestWorld.kt' || actBodyPause.line !== 5 || !actBodyPause.attributes.some(attribute => attribute.name === 'ticks' && attribute.display === '1')) {
  throw new Error(`Stepping the BluePlay act body did not update ticks before the next statement: ${JSON.stringify(actBodyPause)}.`);
}
expectOk(JSON.parse(bluePlaySession.resumeDebug('continue')), 'continue first BluePlay tick');
while (!firstAct.complete) await new Promise(resolve => setTimeout(resolve, 0));
if (bluePlaySession.takeOutput() !== 'tick 1\nactor 1\n') throw new Error('Stepping BluePlay changed first-tick output.');

const secondAct = await pauseBeforeAct('second BluePlay tick');
if (!secondAct.pause.attributes.some(attribute => attribute.name === 'ticks' && attribute.display === '1')) {
  throw new Error('The BluePlay breakpoint did not remain active for the next manual game step.');
}
// A paused simulation can swap breakpoints between the World and Actor hooks.
expectOk(JSON.parse(bluePlaySession.setDebugBreakpoint('TestWorld.kt', 4, false)), 'remove BluePlay act breakpoint while paused');
expectOk(JSON.parse(bluePlaySession.setDebugBreakpoint('TestActor.kt', 4, true)), 'set BluePlay actor breakpoint while paused');
expectOk(JSON.parse(bluePlaySession.resumeDebug('continue')), 'continue after removing BluePlay breakpoint');
const actorPause = await waitForBluePlayPause('BluePlay Actor.act breakpoint');
if (actorPause.fileName !== 'TestActor.kt' || actorPause.line !== 4 || !actorPause.attributes.some(attribute => attribute.name === 'acts' && attribute.display === '1')) {
  throw new Error(`BluePlay did not pause on Actor.act after World.act: ${JSON.stringify(actorPause)}.`);
}
const actorAttributeNames = actorPause.attributes.map(attribute => attribute.name);
if (['worldWidth', 'worldHeight', 'worldCellSize'].some(name => actorAttributeNames.includes(name))) {
  throw new Error(`BluePlay debugger exposed private Actor implementation properties: ${JSON.stringify(actorPause.attributes)}.`);
}
if (!['x', 'y', 'rotation', 'image'].every(name => actorAttributeNames.includes(name))) {
  throw new Error(`BluePlay debugger hid public Actor properties: ${JSON.stringify(actorPause.attributes)}.`);
}
expectOk(JSON.parse(bluePlaySession.resumeDebug('step')), 'step BluePlay actor act');
const actorBodyPause = await waitForBluePlayPause('BluePlay next Actor.act statement');
if (actorBodyPause.fileName !== 'TestActor.kt' || actorBodyPause.line !== 5 || !actorBodyPause.attributes.some(attribute => attribute.name === 'acts' && attribute.display === '2')) {
  throw new Error(`Stepping Actor.act did not update its state before println: ${JSON.stringify(actorBodyPause)}.`);
}
expectOk(JSON.parse(bluePlaySession.resumeDebug('continue')), 'continue BluePlay actor act');
while (!secondAct.complete) await new Promise(resolve => setTimeout(resolve, 0));
if (bluePlaySession.takeOutput() !== 'tick 2\nactor 2\n') throw new Error('Stepping BluePlay Actor.act changed tick output.');

expectOk(JSON.parse(bluePlaySession.setDebugBreakpoint('TestWorld.kt', 4, true)), 'restore World.act breakpoint');
const thirdAct = await pauseBeforeAct('third BluePlay tick');
if (!thirdAct.pause.attributes.some(attribute => attribute.name === 'ticks' && attribute.display === '2')) {
  throw new Error('BluePlay did not preserve World.act state between ticks.');
}
expectOk(JSON.parse(bluePlaySession.resumeDebug('continue')), 'continue third BluePlay tick');
const nextActorPause = await waitForBluePlayPause('next BluePlay Actor.act breakpoint');
if (nextActorPause.fileName !== 'TestActor.kt' || nextActorPause.line !== 4 || !nextActorPause.attributes.some(attribute => attribute.name === 'acts' && attribute.display === '2')) {
  throw new Error(`The Actor.act breakpoint did not trigger on a later tick: ${JSON.stringify(nextActorPause)}.`);
}
expectOk(JSON.parse(bluePlaySession.setDebugBreakpoint('TestActor.kt', 4, false)), 'remove BluePlay actor breakpoint while paused');
expectOk(JSON.parse(bluePlaySession.resumeDebug('continue')), 'continue after removing Actor.act breakpoint');
while (!thirdAct.complete) await new Promise(resolve => setTimeout(resolve, 0));
if (bluePlaySession.takeOutput() !== 'tick 3\nactor 3\n') throw new Error('Removing the Actor.act breakpoint changed third-tick output.');
if (bluePlayPauses.length) throw new Error('BluePlay produced an unexpected extra debugger pause.');
console.log('debugger: BluePlay simulation hit World.act and Actor.act breakpoints on successive ticks, stepped through state updates, and resumed after removing each breakpoint');
