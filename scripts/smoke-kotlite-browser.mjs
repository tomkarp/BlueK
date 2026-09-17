import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundle = await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8');
vm.runInThisContext(bundle, { filename: 'bluek-kotlite-browser.js' });
const api = globalThis['bluek-kotlite-browser'];
if (!api?.bluekCreateKotliteSession) throw new Error('Kotlite bundle did not expose the BlueK session API.');

const session = api.bluekCreateKotliteSession();
const expectOk = (json, label) => {
  if (json.kind === 'error') throw new Error(`${label}: ${json.display}`);
  return json;
};
const evaluate = (source, label) => expectOk(JSON.parse(session.evaluate('<smoke>', source)), label);
const runInteractive = async (target, source, lines, label) => {
  const requested = [];
  let result;
  const started = expectOk(JSON.parse(target.startEvaluate('<interactive>', source, id => requested.push(id), value => { result = JSON.parse(value); })), `${label} start`);
  if (started.kind !== 'unit') throw new Error(`${label}: did not start`);
  for (const line of lines) {
    const id = requested.shift();
    if (!id) throw new Error(`${label}: input was not requested`);
    expectOk(JSON.parse(line === null ? target.enqueueEof() : target.enqueueInput(line)), `${label} input ${id}`);
  }
  return { result, requested };
};

const terminalClearSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(terminalClearSession.evaluate('<terminal clear>', 'print("before"); println("\\u000C"); print("after")')), 'terminal clear');
if (terminalClearSession.takeOutput() !== '\u000C\nafter') throw new Error('Form-feed output did not clear the terminal before subsequent output.');

const forwardReferenceSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(forwardReferenceSession.load('<forward references>', `
    class First {
        fun run(): String {
            val second = Second()
            return second.text()
        }
    }
    class Uses(var value: Later)
    class Second { fun text() = "ok" }
    class Later { fun label() = "later" }
    class Child : Base() { fun child() = baseValue + 1 }
    open class Base { var baseValue = 4 }
`)), 'forward class references load');
expectOk(JSON.parse(forwardReferenceSession.evaluate('<forward references>', 'val first = First()')), 'forward method construction');
if (JSON.parse(forwardReferenceSession.evaluate('<forward references>', 'first.run()')).display !== 'ok') throw new Error('A method could not construct a class defined later in the project.');
expectOk(JSON.parse(forwardReferenceSession.evaluate('<forward references>', 'val later = Later(); val uses = Uses(later)')), 'forward typed reference construction');
if (JSON.parse(forwardReferenceSession.evaluate('<forward references>', 'uses.value.label()')).display !== 'later') throw new Error('A constructor parameter could not use a class defined later in the project.');
expectOk(JSON.parse(forwardReferenceSession.evaluate('<forward references>', 'val child = Child()')), 'forward inheritance construction');
if (JSON.parse(forwardReferenceSession.evaluate('<forward references>', 'child.child()')).display !== '5') throw new Error('Inheritance failed when the superclass was defined later in the project.');

const timerSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(timerSession.load('<timer>', `
    class Timer {
        var min: Int = 0
        var max: Int = 0

        fun starten() {
            val bis = if (max <= min) max else min + (0..(max - min)).random()
            for (i in 0 until bis) {
                try {
                    Thread.sleep(1000)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            println("Timer abgelaufen!")
        }
    }
`)), 'Thread.sleep timer load');
const runTimer = (source) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Thread.sleep did not complete.')), 5000);
    const complete = (value) => {
        clearTimeout(timeout);
        try { resolve(expectOk(JSON.parse(value), 'Thread.sleep result')); }
        catch (error) { reject(error); }
    };
    try {
        expectOk(JSON.parse(timerSession.startEvaluate('<timer>', source, () => undefined, complete)), 'Thread.sleep start');
    } catch (error) {
        clearTimeout(timeout);
        reject(error);
    }
});
let timerFinished = false;
const timerStartedAt = performance.now();
const timerRun = runTimer('val timer = Timer(); timer.min = 1; timer.max = 1; timer.starten()')
    .then(() => { timerFinished = true; });
await new Promise(resolve => setTimeout(resolve, 30));
if (timerFinished) throw new Error('Thread.sleep did not suspend execution.');
if (timerSession.takeOutput() !== '') throw new Error('Timer printed before the delay elapsed.');
await timerRun;
if (performance.now() - timerStartedAt < 1000) throw new Error('Thread.sleep returned before its requested delay.');
if (timerSession.takeOutput() !== 'Timer abgelaufen!\n') throw new Error('Thread.sleep timer did not resume and print its completion.');

// Re-analyze the same session: ranges/random and sleep overloads must keep their identities.
await runTimer('timer.min = 1; timer.max = 2; timer.starten()');
if (timerSession.takeOutput() !== 'Timer abgelaufen!\n') throw new Error('Repeated/random Timer invocation failed.');
await runTimer('val pause: Long = 5L; Thread.sleep(pause); val shortPause: Int = 5; Thread.sleep(shortPause); Thread.sleep(0); println("resumed")');
if (timerSession.takeOutput() !== 'resumed\n') throw new Error('Int/Long/zero sleep without try/catch failed.');
await runTimer(`
    try { Thread.sleep(-1) } catch (e: Exception) { e.printStackTrace() }
    finally { println("finally") }
    println("caught")
`);
const caughtOutput = timerSession.takeOutput();
if (!caughtOutput.includes('timeout value is negative') || !caughtOutput.endsWith('finally\ncaught\n')) {
    throw new Error('Negative sleep was not catchable or printStackTrace produced no diagnostic: ' + caughtOutput);
}
if (JSON.parse(timerSession.evaluate('<timer>', 'Thread.sleep("1000")')).kind !== 'error') {
    throw new Error('Thread.sleep accepted a non-integer argument.');
}
const syncSleepSession = api.bluekCreateKotliteSession();
const syncSleep = JSON.parse(syncSleepSession.evaluate('<sync sleep>', 'Thread.sleep(5); println("must not resume")'));
if (syncSleep.kind !== 'error' || !syncSleep.display.includes('asynchronous execution')) {
    throw new Error('Legacy synchronous evaluation must reject sleeping before scheduling a continuation.');
}
await new Promise(resolve => setTimeout(resolve, 20));
if (syncSleepSession.takeOutput() !== '') throw new Error('Rejected synchronous sleep resumed in the background.');

const privateSetterSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(privateSetterSession.load('<private setter>', `
    class Timer {
        private val maxDiff: Int = 30
        var min: Int = 0
            private set
        var max: Int = 0
            private set
        val zeitspanne: Int
            get() { return max - min }
        fun setzeBereich(neuesMin: Int, neuesMax: Int) {
            if (neuesMin >= 0 && (neuesMax - neuesMin) <= maxDiff) {
                min = neuesMin
                max = neuesMax
            }
        }
    }
`)), 'private setter load');
expectOk(JSON.parse(privateSetterSession.evaluate('<private setter>', 'val privateTimer = Timer(); privateTimer.setzeBereich(5, 10)')), 'private setter internal write');
if (JSON.parse(privateSetterSession.evaluate('<private setter>', 'privateTimer.zeitspanne')).display !== '5') {
    throw new Error('A private setter did not permit writes from inside its class.');
}
if (JSON.parse(privateSetterSession.evaluate('<private setter>', 'privateTimer.min = 8')).kind !== 'error') {
    throw new Error('A private setter allowed an external write.');
}
const privateTimerValue = expectOk(JSON.parse(privateSetterSession.evaluate('<private setter>', 'privateTimer')), 'private setter inspection handle');
const privateTimerInspection = expectOk(JSON.parse(privateSetterSession.inspect(privateTimerValue.objectId)), 'private setter inspection');
if (!privateTimerInspection.fields.some(field => field.name === 'min' && field.setterPrivate === true)) {
    throw new Error('Private setter metadata was not exposed to the inspector.');
}

const bluekApiSession = api.bluekCreateKotliteSession();
if (JSON.parse(bluekApiSession.evaluate('<BlueK API>', 'BlueK.beep()')).display !== 'Unit') {
    throw new Error('BlueK.beep() did not return Unit.');
}
const beepEffects = JSON.parse(bluekApiSession.takeEffects());
if (beepEffects.length !== 1 || beepEffects[0].type !== 'sound' || beepEffects[0].name !== 'beep') {
    throw new Error('BlueK.beep() did not produce the expected sound effect.');
}

const classInputSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(classInputSession.load('<class input>', `
    class Reader {
        fun ask() {
            println("prompt")
            val answer = readln()
            println("answer=" + answer)
        }
    }
`)), 'class input load');
expectOk(JSON.parse(classInputSession.evaluate('<class input>', 'val reader = Reader()')), 'class input construction');
await runInteractive(classInputSession, 'reader.ask()', ['Ada'], 'class input');
if (classInputSession.takeOutput() !== 'prompt\nanswer=Ada\n') throw new Error('Buffered class input/output order incorrect.');

const multilineExpressionSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(multilineExpressionSession.load('<multiline expression>', `
    class Text {
        fun text(): String {
            return "Hi" +
                "Hallo"
        }
    }
`)), 'multiline expression load');
expectOk(JSON.parse(multilineExpressionSession.evaluate('<multiline expression>', 'val text = Text()')), 'multiline expression construction');
if (JSON.parse(multilineExpressionSession.evaluate('<multiline expression>', 'text.text()')).display !== 'HiHallo') throw new Error('A line break after a binary operator was not accepted.');

const smartCastSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(smartCastSession.load('<smart casts>', `
    class NullableText {
        fun normalized(value: String?): String {
            if (value == null) return "fallback"
            return value.trim()
        }
        fun normalizedOrFallback(value: String?): String {
            if (value == null || value.trim() == "") return "fallback"
            return value.trim()
        }
        fun isBlank(value: String?): Boolean {
            return value == null || value.trim() == ""
        }
        fun hasText(value: String?): Boolean {
            return value != null && value.trim() != ""
        }
        fun readInt(value: String?): Int {
            while (true) {
                val number = value?.trim()?.toIntOrNull()
                if (number != null) {
                    return number
                }
                return 0
            }
        }
    }
`)), 'smart cast load');
expectOk(JSON.parse(smartCastSession.evaluate('<smart casts>', 'val nullableText = NullableText()')), 'smart cast construction');
if (JSON.parse(smartCastSession.evaluate('<smart casts>', 'nullableText.normalized(null)')).display !== 'fallback') throw new Error('A null check with an early return did not smart-cast the value.');
if (JSON.parse(smartCastSession.evaluate('<smart casts>', 'nullableText.normalized("  Ada  ")')).display !== 'Ada') throw new Error('A non-null value was not trimmed after the null check.');
if (JSON.parse(smartCastSession.evaluate('<smart casts>', 'nullableText.normalizedOrFallback("  Ada  ")')).display !== 'Ada') throw new Error('A value was not smart-cast after a null check combined with ||.');
if (JSON.parse(smartCastSession.evaluate('<smart casts>', 'nullableText.isBlank("   ")')).display !== 'true') throw new Error('The right side of || did not use a smart cast.');
if (JSON.parse(smartCastSession.evaluate('<smart casts>', 'nullableText.hasText(" Ada ")')).display !== 'true') throw new Error('The right side of && did not use a smart cast.');
if (JSON.parse(smartCastSession.evaluate('<smart casts>', 'nullableText.readInt(" 42 ")')).display !== '42') throw new Error('A nullable value was not smart-cast inside a != null branch.');

const nonReturningLoopSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(nonReturningLoopSession.load('<non-returning loop>', `
    class Reader {
        fun read(): Int {
            while (true) {
                return 1
            }
        }
    }
`)), 'non-returning loop load');
expectOk(JSON.parse(nonReturningLoopSession.evaluate('<non-returning loop>', 'val reader = Reader()')), 'non-returning loop construction');
if (JSON.parse(nonReturningLoopSession.evaluate('<non-returning loop>', 'reader.read()')).display !== '1') throw new Error('A function ending in while (true) was not accepted with its declared return type.');

const objectGraphSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(objectGraphSession.load('<object graph>', `
    class Leaf(val text: String)
    class Box(val leaf: Leaf) { fun show() = leaf.text }
    class Root(val box: Box) { fun show() = box.show() }
    class Child : Base() { override fun label() = "child" }
    open class Base { open fun label() = "base"; fun call() = label() }
`)), 'object graph and override load');
if (JSON.parse(objectGraphSession.evaluate('<object graph>', 'val leaf = Leaf("x"); val box = Box(leaf); val root = Root(box); root.show()')).display !== 'x') throw new Error('Nested object references were not preserved.');
if (JSON.parse(objectGraphSession.evaluate('<object graph>', 'val child = Child(); child.call()')).display !== 'child') throw new Error('Dynamic dispatch failed for a forward superclass definition.');

const twoInputClassSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(twoInputClassSession.load('<two class inputs>', `
    class Dialogue {
        fun run() {
            println("A")
            val first = readln()
            println("B" + first)
            val second = readln()
            println("C" + second)
        }
    }
`)), 'two class inputs load');
expectOk(JSON.parse(twoInputClassSession.evaluate('<two class inputs>', 'val dialogue = Dialogue()')), 'two class inputs construction');
await runInteractive(twoInputClassSession, 'dialogue.run()', ['one', 'two'], 'two input');
const twoOutput = twoInputClassSession.takeOutput();
if (twoOutput !== 'A\nBone\nCtwo\n') throw new Error(`Two buffered inputs had incorrect output order: ${JSON.stringify(twoOutput)}`);

const collectionsSession = api.bluekCreateKotliteSession();
const collectionsEvaluate = (source, label) => expectOk(JSON.parse(collectionsSession.evaluate('<collections>', source)), label);
collectionsEvaluate('val numbers = listOf(1, 2)', 'immutable list construction');
if (collectionsEvaluate('numbers[0]', 'list index access').display !== '1') throw new Error('List index access failed in an incremental session.');
if (collectionsEvaluate('numbers.size', 'list size').display !== '2') throw new Error('List size failed in an incremental session.');
if (collectionsEvaluate('numbers.count { it > 1 }', 'list predicate count').display !== '1') throw new Error('List predicate count failed in an incremental session.');
const lambdaInputSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(lambdaInputSession.load('<lambda input>', 'fun ask(): Boolean = readln() == "ja"')), 'lambda input load');
const lambdaRequests = [];
let lambdaResult;
expectOk(JSON.parse(lambdaInputSession.startEvaluate('<lambda input>', 'listOf(1, 2, 3).count { ask() }', id => lambdaRequests.push(id), value => { lambdaResult = JSON.parse(value); })), 'stdlib callback start');
for (const answer of ['ja', 'nein', 'ja']) {
  const requestId = lambdaRequests.shift();
  if (!requestId) throw new Error('Stdlib callback did not request its next input.');
  expectOk(JSON.parse(lambdaInputSession.enqueueInput(answer)), `stdlib callback input ${requestId}`);
}
if (lambdaResult?.display !== '2' || lambdaRequests.length !== 0) throw new Error('A stdlib callback did not resume exactly once per input.');
collectionsEvaluate('val mutableNumbers = mutableListOf(1, 2)', 'mutable list construction');
if (collectionsEvaluate('mutableNumbers.add(3)', 'mutable list add').display !== 'true') throw new Error('Mutable list add failed in an incremental session.');
if (collectionsEvaluate('mutableNumbers[2]', 'mutable list index access').display !== '3') throw new Error('Mutable list mutation was not retained.');

expectOk(JSON.parse(session.load('<project>', `
    open class Counter(var value: Int) {
        open fun increment(step: Int = 1) { value = value + step }
    }
    class Child(value: Int) : Counter(value) {
        override fun increment(step: Int = 1) { super.increment(step); value = value + 1 }
    }
`)), 'load');
const manifest = JSON.parse(session.manifest());
const counterMeta = manifest.classes.find(value => value.name === 'Counter');
const childMeta = manifest.classes.find(value => value.name === 'Child');
if (counterMeta?.constructors[0]?.parameters[0]?.name !== 'value') throw new Error('Kotlite manifest lost the constructor parameter.');
if (counterMeta?.methods[0]?.parameters[0]?.name !== 'step' || !counterMeta.methods[0].parameters[0].hasDefault) throw new Error('Kotlite manifest lost method parameter metadata.');
if (childMeta?.supertypes?.[0]?.classifier !== 'Counter') throw new Error('Kotlite manifest lost superclass metadata.');
const benchObject = expectOk(JSON.parse(session.create('Child', '5', 'bench')), 'bench construction');
if (evaluate('bench.value', 'bench binding').display !== '5') throw new Error('Bench object is not available in the codepad.');
const inheritedInspection = expectOk(JSON.parse(session.inspect(benchObject.objectId)), 'inherited inspection');
if (!inheritedInspection.fields.some(field => field.name === 'value')) throw new Error('Primary-constructor properties were not exposed to inspection.');
evaluate('bench.increment()', 'bench mutation');
if (expectOk(JSON.parse(session.invoke(benchObject.objectId, 'increment', '')), 'host invoke').display !== 'Unit') throw new Error('Host method invocation failed.');
if (evaluate('bench.value', 'host mutation visibility').display !== '9') throw new Error('Host mutation is not visible in the codepad.');
expectOk(JSON.parse(session.set(benchObject.objectId, 'value', '17')), 'inspector setter');
if (evaluate('bench.value', 'inspector mutation visibility').display !== '17') throw new Error('Inspector mutation is not visible in the codepad.');
const expressionObject = expectOk(JSON.parse(session.evaluate('<smoke>', 'Child(6)')), 'object expression result');
if (!expressionObject.objectId || expressionObject.className !== 'Child') throw new Error('A Codepad object expression did not receive a runtime handle.');
expectOk(JSON.parse(session.set(expressionObject.objectId, 'value', '7')), 'expression object setter');
if (JSON.parse(session.inspect(expressionObject.objectId)).kind === 'error' || JSON.parse(session.invoke(expressionObject.objectId, 'increment', '')).kind === 'error') throw new Error('A Codepad expression object handle could not be inspected or invoked.');
expectOk(JSON.parse(session.load('<accessors>', `
    class Meter {
        var raw = 0
        var value: Int
            get() = raw
            set(newValue) { raw = newValue }
    }
`)), 'custom accessors load');
evaluate('val meter = Meter()', 'accessor construction');
evaluate('meter.value = 42', 'custom setter');
if (evaluate('meter.value', 'custom getter').display !== '42') throw new Error('Custom property getter/setter did not preserve the value.');
expectOk(JSON.parse(session.load('<inspection>', `
    class Audited {
        var raw = 7
        var value: Int
            get() { println("getter-called"); return raw }
    }
`)), 'inspection accessor load');
const inspected = expectOk(JSON.parse(session.create('Audited', '', 'audited')), 'inspection construction');
session.takeOutput();
const inspection = expectOk(JSON.parse(session.inspect(inspected.objectId)), 'inspection');
if (!inspection.fields.some(field => field.name === 'value' && field.value === '<computed>')) throw new Error('Computed property was not marked during inspection.');
if (session.takeOutput() !== '') throw new Error('Inspecting an object invoked a custom getter.');
expectOk(JSON.parse(session.load('<setter inspection>', `
    class SetterOnly {
        var value = 7
            set(next) {
                field = next
            }
    }
`)), 'setter-only inspection load');
const setterOnly = expectOk(JSON.parse(session.create('SetterOnly', '', 'setterOnly')), 'setter-only construction');
const setterInspection = expectOk(JSON.parse(session.inspect(setterOnly.objectId)), 'setter-only inspection');
if (!setterInspection.fields.some(field => field.name === 'value' && field.value === '7')) throw new Error('Inspecting a property with only a custom setter lost its backing-field value.');
evaluate('val first = Child(0)', 'construct first');
evaluate('val alias = first', 'alias');
evaluate('alias.increment()', 'increment through alias');
evaluate('first.value', 'identity check');
if (evaluate('first.value', 'dispatch').display !== '2') throw new Error('Object identity or dynamic dispatch failed.');
const inheritedCallSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(inheritedCallSession.load('<implicit receiver>', `
    open class Base { var value = 0; fun increment() { value += 1 } }
    class Derived : Base() { fun run() { increment() } }
`)), 'implicit inherited method load');
expectOk(JSON.parse(inheritedCallSession.evaluate('<implicit receiver>', 'val derived = Derived(); derived.run()')), 'implicit inherited method call');
if (JSON.parse(inheritedCallSession.evaluate('<implicit receiver>', 'derived.value')).display !== '1') throw new Error('An inherited method required an unnecessary explicit this receiver.');
evaluate('val second = Child(10)', 'construct second');
if (evaluate('second.value', 'separate state').display !== '10') throw new Error('Instances do not keep separate state.');
evaluate('val immutable = 1', 'val declaration');
const invalid = JSON.parse(session.evaluate('<smoke>', 'immutable = 2'));
if (invalid.kind !== 'error') throw new Error('val reassignment was not rejected.');
expectOk(JSON.parse(session.inspect(benchObject.objectId)), 'retained object reference');
expectOk(JSON.parse(session.reset()), 'runtime reset');
if (JSON.parse(session.inspect(benchObject.objectId)).kind !== 'error') throw new Error('Reset retained an old object handle.');
if (JSON.parse(session.evaluate('<smoke>', 'first.value')).kind !== 'error') throw new Error('Runtime reset retained an old codepad binding.');

const personSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(personSession.load('<person project>', `
    class Person(val name: String) {
        var alter = 0
        var constructions = 0
        init {
            constructions = constructions + 1
            println("constructed")
        }
        fun sprechen() {
            println("Hi, ich bin $name und $alter Jahre alt")
        }
    }
`)), 'person load');
expectOk(JSON.parse(personSession.evaluate('<codepad>', 'val p = Person("Otto")')), 'person construction');
if (personSession.takeOutput() !== 'constructed\n') throw new Error('Constructor side effect was not emitted exactly once.');
expectOk(JSON.parse(personSession.evaluate('<codepad>', 'p.alter = 42')), 'person mutation');
if (personSession.takeOutput() !== '') throw new Error('A separated mutation repeated an earlier side effect.');
expectOk(JSON.parse(personSession.evaluate('<codepad>', 'p.sprechen()')), 'person method call');
if (personSession.takeOutput() !== 'Hi, ich bin Otto und 42 Jahre alt\n') throw new Error('Separated Person inputs did not preserve object state.');
if (JSON.parse(personSession.evaluate('<codepad>', 'p.constructions')).display !== '1') throw new Error('Separated inputs reconstructed the Person object.');
const failedPersonInput = JSON.parse(personSession.evaluate('<codepad>', 'p.alter = "not an Int"'));
if (failedPersonInput.kind !== 'error') throw new Error('An invalid follow-up input was not rejected.');
if (personSession.takeOutput() !== '') throw new Error('A failed follow-up input produced an unexpected side effect.');
expectOk(JSON.parse(personSession.evaluate('<codepad>', 'p.sprechen()')), 'method after failed input');
if (personSession.takeOutput() !== 'Hi, ich bin Otto und 42 Jahre alt\n') throw new Error('A failed follow-up input damaged the existing object session.');

const fieldSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(fieldSession.load('<field>', `
    class FieldPerson(val name: String) {
        var age = 0
        set(value) { if (value >= 0) { field = value } else { field = 0 } }
        val remaining: Int
            get() = 150 - age
        fun speak() { println("Hi, ich bin $name und $age Jahre alt und habe noch $remaining Jahre") }
    }
`)), 'field accessor load');
expectOk(JSON.parse(fieldSession.evaluate('<codepad>', 'val fp = FieldPerson("Otto")')), 'field accessor construction');
expectOk(JSON.parse(fieldSession.evaluate('<codepad>', 'fp.age = 42')), 'field accessor setter');
const remaining = JSON.parse(fieldSession.evaluate('<codepad>', 'fp.remaining'));
if (remaining.display !== '108') throw new Error('Implicit field getter did not return the backing-field based value.');
expectOk(JSON.parse(fieldSession.evaluate('<codepad>', 'fp.speak()')), 'field accessor method');
if (fieldSession.takeOutput() !== 'Hi, ich bin Otto und 42 Jahre alt und habe noch 108 Jahre\n') throw new Error('Implicit field accessor state was not preserved.');
expectOk(JSON.parse(fieldSession.evaluate('<codepad>', 'fp.age = -1')), 'field accessor validation');
const clampedAge = JSON.parse(fieldSession.evaluate('<codepad>', 'fp.age'));
if (clampedAge.display !== '0') throw new Error('Implicit field setter did not enforce its branch.');
const computedAssignment = JSON.parse(fieldSession.evaluate('<codepad>', 'fp.remaining = 5'));
if (computedAssignment.kind !== 'error' || !String(computedAssignment.display).includes('val `remaining` cannot be reassigned')) {
    throw new Error('Assigning to a computed val property should fail with a clear immutability error.');
}

const nullabilitySession = api.bluekCreateKotliteSession();
const nullabilitySource = 'class MaybeName { var name: String? = null; fun label(): String { return name?.uppercase() ?: "unbenannt" } }';
expectOk(JSON.parse(nullabilitySession.load('<nullability>', nullabilitySource)), 'safe call and Elvis load');
expectOk(JSON.parse(nullabilitySession.evaluate('<nullability>', 'val maybe = MaybeName()')), 'safe call construction');
if (JSON.parse(nullabilitySession.evaluate('<nullability>', 'maybe.label()')).display !== 'unbenannt') throw new Error('Safe-call or Elvis evaluation failed for null.');
expectOk(JSON.parse(nullabilitySession.evaluate('<nullability>', 'maybe.name = "Ada"')), 'nullable property assignment');
if (JSON.parse(nullabilitySession.evaluate('<nullability>', 'maybe.label()')).display !== 'ADA') throw new Error('Safe-call or Elvis evaluation failed for a non-null value.');

const animalGameSession = api.bluekCreateKotliteSession();
const animalGameSource = `
    class Tier(val name: String) {
        var energie = 5
        var glueckslevel = 10

        fun fuettern(menge: Int) {
            energie = energie + menge
            if (energie > 10) { energie = 10 }
        }

        fun spielen() {
            energie = energie - 1
            glueckslevel = glueckslevel + 3
        }

        fun langweilen() {
            energie = energie - 2
            glueckslevel = glueckslevel - 1
        }

        fun istGluecklich(): Boolean { return glueckslevel >= 20 }
        fun istTraurig(): Boolean { return glueckslevel <= 0 }
        fun istVerhungert(): Boolean { return energie <= 0 }
    }

    class Spiel {
        val spieler = Tier("Wuffi")
        val gegner = Tier("Bello")

        fun vorbereiten() {
            spieler.fuettern(20)
            gegner.spielen()
        }

        fun status(): String {
            return spieler.name + ": " + spieler.energie + "/" + spieler.glueckslevel
        }

        fun gewonnen(): Boolean {
            return spieler.istGluecklich() && !spieler.istVerhungert()
        }
    }
`;
expectOk(JSON.parse(animalGameSession.load('<tierisch gluecklich>', animalGameSource)), 'animal game load');
expectOk(JSON.parse(animalGameSession.evaluate('<tierisch gluecklich>', 'val spiel = Spiel()')), 'animal game construction');
expectOk(JSON.parse(animalGameSession.evaluate('<tierisch gluecklich>', 'spiel.vorbereiten()')), 'animal game state changes');
if (JSON.parse(animalGameSession.evaluate('<tierisch gluecklich>', 'spiel.status()')).display !== 'Wuffi: 10/10') {
    throw new Error('The Tierisch-gluecklich object/reference flow produced the wrong state.');
}
if (JSON.parse(animalGameSession.evaluate('<tierisch gluecklich>', 'spiel.gewonnen()')).display !== 'false') {
    throw new Error('The Tierisch-gluecklich game flow returned the wrong win state.');
}

const shadowedBuiltinSession = api.bluekCreateKotliteSession();
const shadowedBuiltinSource = `
    fun readIntInRange(prompt: String, min: Int, max: Int): Int {
        while (true) {
            val zahl = 2
            if (zahl >= min && zahl <= max) {
                return zahl
            }
        }
    }
`;
expectOk(JSON.parse(shadowedBuiltinSession.load('<shadowed builtins>', shadowedBuiltinSource)), 'shadowed builtin parameter names');
if (JSON.parse(shadowedBuiltinSession.evaluate('<shadowed builtins>', 'readIntInRange("Zahl: ", 1, 3)')).display !== '2') {
    throw new Error('Parameters named min/max were incorrectly resolved as builtin functions.');
}

const inputSession = api.bluekCreateKotliteSession();
let inputResult;
let inputRequested = 0;
inputSession.startEvaluate('<input>', 'readln()', () => { inputRequested += 1; }, value => { inputResult = JSON.parse(value); });
if (inputRequested !== 1 || inputResult) throw new Error('An open input channel did not suspend readln.');
inputSession.enqueueInput('Ada');
if (inputResult.display !== 'Ada') throw new Error('readln did not resume with the entered line.');
inputResult = undefined;
inputSession.startEvaluate('<input>', 'readLine()', () => { inputRequested += 1; }, value => { inputResult = JSON.parse(value); });
inputSession.enqueueEof();
if (inputResult.display !== 'null') throw new Error('readLine did not return null at explicit EOF.');
inputResult = undefined;
inputSession.startEvaluate('<input>', 'readlnOrNull()', () => { inputRequested += 1; }, value => { inputResult = JSON.parse(value); });
inputSession.enqueueEof();
if (inputResult.display !== 'null') throw new Error('readlnOrNull did not return null at explicit EOF.');
inputResult = undefined;
inputSession.startEvaluate('<input>', 'readln()', () => { inputRequested += 1; }, value => { inputResult = JSON.parse(value); });
inputSession.enqueueEof();
if (inputResult.kind !== 'error') throw new Error('readln did not produce a regular catchable EOF error.');

// An interrupted call must never be replayed: it may already have mutated objects.
const failedSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(failedSession.load('<failure>', 'class Counter { var n = 0; fun ask() { n++; println("prompt"); readln(); n++ } }')), 'failure fixture');
const failedObject = expectOk(JSON.parse(failedSession.create('Counter', '', 'counter')), 'failure object');
let failedInput;
failedSession.startEvaluate('<failure>', 'counter.ask()', () => { failedInput = true; }, () => undefined);
if (!failedInput || failedSession.takeOutput() !== 'prompt\n') throw new Error('Output before interactive pause was lost.');
failedSession.enqueueInput('later');
const failedInspection = JSON.parse(failedSession.inspect(failedObject.objectId));
if (failedInspection.fields.find(field => field.name === 'n').value !== '2') throw new Error('Side effects before and after continuation were duplicated or lost.');


const languageSession = api.bluekCreateKotliteSession();
if (JSON.parse(languageSession.evaluate('<language>', 'var n = 0; while (n < 3) { n += 1 }; n')).display !== '3') throw new Error('While-loop evaluation failed.');
if (JSON.parse(languageSession.evaluate('<language>', 'var total = 0; for (i in 1..3) { total += i }; total')).display !== '6') throw new Error('For-loop evaluation failed.');
const typeError = JSON.parse(languageSession.evaluate('<language>', 'val number: Int = "wrong"'));
if (typeError.kind !== 'error' || !typeError.display.includes('Expected type is `Int`')) throw new Error('A basic type mismatch was not rejected.');
const visibilitySession = api.bluekCreateKotliteSession();
if (JSON.parse(visibilitySession.load('<visibility>', 'class Secret { private var hidden = 1; fun read(): Int = hidden }')).kind === 'error') throw new Error('Private property syntax unexpectedly failed.');
const visibilityManifest = JSON.parse(visibilitySession.manifest());
if (visibilityManifest.classes[0].properties[0].visibility !== 'private') throw new Error('Private property visibility was lost in the Kotlite manifest.');
expectOk(JSON.parse(visibilitySession.evaluate('<visibility>', 'val secret = Secret()')), 'private property fixture');
if (JSON.parse(visibilitySession.evaluate('<visibility>', 'secret.read()')).display !== '1') throw new Error('Private property could not be read by its owning class.');
if (JSON.parse(visibilitySession.evaluate('<visibility>', 'secret.hidden')).kind !== 'error') throw new Error('Private property could be read from top-level code.');
// Private access is currently rejected at runtime. Test each violation in a fresh session,
// rather than accepting the generic refusal from an already-faulted interpreter.
const privateWriteSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(privateWriteSession.load('<visibility>', 'class Secret { private var hidden = 1 }; val secret = Secret()')), 'private write fixture');
const privateWriteError = JSON.parse(privateWriteSession.evaluate('<visibility>', 'secret.hidden = 2'));
if (privateWriteError.kind !== 'error' || !/private/i.test(privateWriteError.display)) throw new Error('Private property could be written from top-level code.');
const syntaxSession = api.bluekCreateKotliteSession();
const protectedError = JSON.parse(syntaxSession.load('<visibility>', 'class Protected { protected fun hidden() {} }'));
if (protectedError.kind !== 'error' || !protectedError.display.includes('protected')) throw new Error('Unsupported protected visibility did not produce a clear error.');
const secondaryConstructorError = JSON.parse(syntaxSession.evaluate('<visibility>', 'class Secondary { constructor(value: Int) {} }'));
if (secondaryConstructorError.kind !== 'error' || !secondaryConstructorError.display.includes('Secondary constructors are not supported')) throw new Error('Secondary constructors did not produce a clear local error.');

console.log('Kotlite browser session smoke test passed.');
