// Kotlin features that the inf-schule OOP chapters (Kapitel 1-3) rely on.
// Each case is a minimal, self-written reproduction of a fixed BlueK/Kotlite gap.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

vm.runInThisContext(await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8'));
const api = globalThis['bluek-kotlite-browser'];

const project = async (files, library = null) => {
  const session = api.bluekCreateKotliteSession();
  session.configureBluePlay(library === 'blueplay', 'curriculum');
  const result = await new Promise(resolve => {
    const started = JSON.parse(session.startLoadProject(Object.keys(files), Object.values(files), library, 1, () => {}, value => resolve(JSON.parse(value))));
    if (started.kind === 'error') resolve(started);
  });
  const evaluate = source => JSON.parse(session.evaluate('<curriculum>', source));
  return { session, result, evaluate, output: () => session.takeOutput() };
};
const ok = (value, label) => { assert.notEqual(value.kind, 'error', `${label}: ${value.display}`); return value; };
const fails = (value, label, pattern) => {
  assert.equal(value.kind, 'error', `${label} must be rejected`);
  if (pattern) assert.match(value.display, pattern, label);
  return value;
};

// Private member functions: usable inside the class, rejected outside, hidden in the manifest.
{
  const p = await project({ 'Stapel.kt': 'class Stapel {\n    private val karten: MutableList<String> = mutableListOf()\n    fun lege(karte: String) { karten.add(karte) }\n    fun ziehe(): String? = nimm()\n    private fun nimm(): String? = if (karten.isEmpty()) null else karten.removeAt(0)\n}' });
  ok(p.result, 'private fun + expected-type inference for mutableListOf()');
  assert.equal(ok(p.evaluate('val s = Stapel(); s.lege("A"); s.ziehe()'), 'private call inside class').display, 'A');
  fails(p.evaluate('s.nimm()'), 'private call outside class', /Private function `nimm`/);
  fails(p.evaluate('s.karten'), 'private property outside class', /Private property `karten`/);
  const stapel = JSON.parse(p.session.manifest()).classes.find(item => item.name === 'Stapel');
  assert.equal(stapel.methods.find(method => method.name === 'nimm').visibility, 'private');
}

// `private` applies to every member, not just the first one (the `private set` lookahead used to
// swallow the modifier of the following property). Trailing semicolons stay allowed.
{
  const p = await project({ 'Spiel.kt': 'class Spiel {\n    private val namen = mutableListOf("");\n    private val futter = mutableListOf(5)\n    var punkte = 0\n        private set\n    private val tiere = mutableListOf<String>()\n}' });
  ok(p.result, 'private on several members');
  const spiel = JSON.parse(p.session.manifest()).classes.find(item => item.name === 'Spiel');
  assert.deepEqual(spiel.properties.map(property => `${property.name}:${property.visibility}${property.setterPrivate ? '/set' : ''}`), ['namen:private', 'futter:private', 'punkte:public/set', 'tiere:private']);
  fails(p.evaluate('Spiel().futter'), 'second private property', /Private property `futter`/);
  fails(p.evaluate('Spiel().punkte = 3'), 'private setter', /Private setter for `punkte`/);
}

// String templates end at non-identifier characters; `$` alone is literal text.
{
  const p = await project({ 'Main.kt': 'fun main() {}' });
  assert.equal(ok(p.evaluate('val rang = "D"; val name = "Bob"; "│$rang│ $name\'s 5$"'), 'template').display, '│D│ Bob\'s 5$');
}

// Standard exceptions are available, catchable and reported by their Kotlin name.
{
  const p = await project({ 'Karte.kt': 'class Karte(farbe: String) {\n    val farbe: String = pruefe(farbe)\n    private fun pruefe(wert: String): String {\n        if (wert != "herz") throw IllegalArgumentException("Unbekannte Farbe: $wert")\n        return wert\n    }\n}' });
  ok(p.result, 'IllegalArgumentException project');
  fails(p.evaluate('Karte("blau")'), 'uncaught exception', /^IllegalArgumentException: Unbekannte Farbe: blau$/);
  const q = await project({ 'Main.kt': 'fun main() {}' });
  assert.equal(ok(q.evaluate('try { throw IllegalStateException("x") } catch (e: IllegalStateException) { "gefangen" }'), 'catch').display, 'gefangen');
}

// Kotlin output formats: whole doubles keep `.0`, collections print their elements.
{
  const p = await project({ 'Main.kt': 'fun main() {\n    println(2.0 * 3.0)\n    println(listOf(1, 2, 3))\n    println(mutableListOf("a"))\n    println(19.75)\n}' });
  ok(p.evaluate('main()'), 'output formats');
  assert.equal(p.output(), '6.0\n[1, 2, 3]\n[a]\n19.75\n');
}

// Float is approximated by Double, including `1.5f` literals.
{
  const p = await project({ 'Roboter.kt': 'class Roboter {\n    var strecke = 0.0\n    fun laufen(entfernung: Float) {\n        strecke = strecke + entfernung\n    }\n}' });
  ok(p.result, 'Float parameter');
  assert.equal(ok(p.evaluate('val r = Roboter(); r.laufen(1.5f); r.laufen(2f); r.strecke'), 'Float literals').display, '3.5');
}

// Imports: Kotlin standard library imports are accepted, JVM libraries rejected clearly.
{
  ok((await project({ 'Main.kt': 'import kotlin.math.abs\nfun main() {}' })).result, 'kotlin import');
  const jvm = await project({ 'Person.kt': 'import java.time.LocalDate\nclass Person' });
  fails(jvm.result, 'JVM import', /Import `java\.time\.LocalDate` is not available in BlueK/);
  assert.equal(jvm.result.diagnostics[0].line, 1);
}

// Accessors see every property of the class (also later ones), never constructor parameters.
{
  const p = await project({ 'Timer.kt': 'class Timer(max: Int) {\n    var min: Int = 0\n        set(value) {\n            if (value <= max) field = value\n        }\n    var max: Int = 0\n    init {\n        this.max = max\n    }\n    val zeitspanne: Int\n        get() = max - min\n}' });
  ok(p.result, 'accessor forward reference and shadowed constructor parameter');
  assert.equal(ok(p.evaluate('val t = Timer(10); t.min = 4; t.min = 20; t.zeitspanne'), 'accessors').display, '6');
}

// A property needs a value (unless an init block assigns it).
fails((await project({ 'Auto.kt': 'class Auto {\n    var marke: String\n}' })).result, 'uninitialized property', /Property `marke` must be initialized/);
ok((await project({ 'Auto.kt': 'class Auto {\n    var marke: String\n    init {\n        marke = "BMW"\n    }\n}' })).result, 'property assigned in init');

// Arguments of a member call are evaluated in the caller's scope (implicit this).
{
  const p = await project({ 'Stapel.kt': 'class Stapel {\n    val karten = mutableListOf<String>()\n    fun fuellen() {\n        for (i in 1..3) karten.add(neueKarte(i))\n    }\n    fun neueKarte(nr: Int): String = "K$nr"\n}' });
  ok(p.result, 'member call argument project');
  assert.equal(ok(p.evaluate('val s = Stapel(); s.fuellen(); s.karten.size'), 'implicit receiver in argument').display, '3');
}

// Type errors name the argument types, e.g. showText(Int, Int, Int).
fails((await project({ 'Anzeige.kt': 'class Anzeige {\n    fun zeige(text: String) {}\n    fun test() { zeige(5) }\n}' })).result, 'argument type mismatch', /argument types \(Int\)/);

// stop()/start() also work after `welt.show()` (not only after showWorld(welt)).
{
  const p = await project({ 'Feld.kt': 'class Feld : World(20, 10, 1)' }, 'blueplay');
  ok(p.result, 'BluePlay project');
  ok(p.evaluate('val welt = Feld(); welt.show(); start(); stop(); welt.running'), 'stop after show()');
}

console.log('Curriculum Kotlin smoke test passed.');
