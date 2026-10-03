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

// Exceptions from native stdlib functions are caught by their class and its superclasses (RT-38);
// integer division by zero throws ArithmeticException instead of yielding 0.
{
  const p = await project({ 'Zahl.kt': 'fun zahl(text: String): Int = text.toInt()' });
  ok(p.result, 'native exception project');
  const caught = [
    ['try { zahl("x") } catch (e: NumberFormatException) { e.message }', "Invalid number format: 'x'"],
    ['try { "x".toInt() } catch (e: IllegalArgumentException) { "IllegalArgumentException" }', 'IllegalArgumentException'],
    ['try { "x".toInt() } catch (e: Exception) { e is NumberFormatException }', 'true'],
    ['try { "x".toInt() } catch (e: ArithmeticException) { "falsch" } catch (e: Exception) { "Exception" }', 'Exception'],
    ['try { require(false) { "require" } } catch (e: IllegalArgumentException) { e.message }', 'require'],
    ['try { check(false) { "check" } } catch (e: IllegalStateException) { e.message }', 'check'],
    ['try { listOf(1)[5] } catch (e: IndexOutOfBoundsException) { e.message }', 'index: 5, size: 1'],
    ['try { listOf<Int>().first() } catch (e: NoSuchElementException) { e.message }', 'List is empty.'],
    ['try { 1 / 0 } catch (e: ArithmeticException) { e.message }', '/ by zero'],
    ['try { 5L % 0L } catch (e: Exception) { e is ArithmeticException }', 'true'],
  ];
  for (const [source, expected] of caught) assert.equal(ok(p.evaluate(source), source).display, expected, source);
  ok(p.evaluate('try { "x".toInt() } catch (e: Exception) { e.printStackTrace() }'), 'printStackTrace');
  assert.equal(p.output(), "NumberFormatException: Invalid number format: 'x'\n");
  // An uncaught runtime error ends the session, so each of these needs its own.
  fails((await project({ 'Main.kt': 'fun main() {}' })).evaluate('try { "x".toInt() } catch (e: IllegalStateException) { -1 }'), 'unrelated catch type', /^NumberFormatException: Invalid number format: 'x'$/);
  fails((await project({ 'Main.kt': 'fun main() {}' })).evaluate('7 / 0'), 'uncaught division by zero', /^ArithmeticException: \/ by zero$/);
}

// String.substring checks its bounds like Kotlin instead of clamping and swapping like JavaScript (RT-39).
{
  const p = await project({ 'Main.kt': 'fun main() {}' });
  const cases = [
    ['"Hallo Welt".substring(6)', 'Welt'],
    ['"abc".substring(1, 3)', 'bc'],
    ['"abc".substring(3)', ''],
    ['try { "abc".substring(5) } catch (e: IndexOutOfBoundsException) { e.message }', 'begin 5, end 3, length 3'],
    ['try { "abc".substring(1, 10) } catch (e: IndexOutOfBoundsException) { e.message }', 'begin 1, end 10, length 3'],
    ['try { "abc".substring(2, 1) } catch (e: Exception) { e.message }', 'begin 2, end 1, length 3'],
    ['try { "abc".substring(-1) } catch (e: IndexOutOfBoundsException) { e.message }', 'begin -1, end 3, length 3'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), source).display, expected, source);
  fails((await project({ 'Main.kt': 'fun main() {}' })).evaluate('"abc".substring(5)'), 'uncaught substring', /^IndexOutOfBoundsException: begin 5, end 3, length 3$/);
}

// A stdlib callback that suspends is replayed (RT-37); what it throws keeps its class for `catch` (RT-38, RT-39).
// BlueK's "cannot pause here" error is a limit of BlueK, not a program exception: no `catch` hides it.
{
  const p = await project({ 'Z.kt': 'class Z {\n    override fun toString(): String {\n        Thread.sleep(1)\n        return "z"\n    }\n}' });
  ok(p.result, 'toString with Thread.sleep');
  const run = source => new Promise(resolve => {
    const started = JSON.parse(p.session.startEvaluate('<curriculum>', source, () => {}, value => resolve(JSON.parse(value))));
    if (started.kind === 'error') resolve(started);
  });
  const cases = [
    ['try { listOf("1", "x").map { Thread.sleep(1); it.toInt() } } catch (e: NumberFormatException) { e.message }', "Invalid number format: 'x'"],
    ['try { listOf(1, 0).map { Thread.sleep(1); 10 / it } } catch (e: ArithmeticException) { e.message }', '/ by zero'],
    ['try { listOf("abc").map { Thread.sleep(1); it.substring(5) } } catch (e: IndexOutOfBoundsException) { e.message }', 'begin 5, end 3, length 3'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(await run(source), source).display, expected, source);
  // Last: an uncaught runtime error ends the session.
  fails(await run('try { println(Z()) } catch (e: Throwable) { println("gefangen") } finally { println("finally") }'), 'pause in toString() inside catch (e: Throwable)', /^InterpreterStateException: Thread\.sleep\(\) cannot pause inside toString\(\)/);
  assert.equal(p.output(), 'finally\n');
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

// Classes that reference each other compile and run in any file order (RT-40): property,
// nullable and generic types, parameter and return types, constructor parameters, constructor
// calls and method calls in both directions, inheritance and interfaces.
{
  const hund = 'class Hund {\n    var herrchen: Mensch? = null\n    var frauchen: Mensch? = null\n    val alle = mutableListOf<Mensch>()\n}';
  const variants = [
    ['property type', 'class Mensch {\n    var hund: Hund? = null\n}', 'val m = Mensch(); val h = Hund(); m.hund = h; h.herrchen = m; m.hund === h && h.herrchen === m', 'true'],
    ['parameter type', 'class Mensch {\n    fun gassi(h: Hund) {\n        println("Gassi")\n    }\n}', 'val m = Mensch(); m.gassi(Hund()); m.gassi(Hund()); 2', '2'],
    ['constructor call in a body', 'class Mensch {\n    fun kaufen() {\n        val h = Hund()\n        h.herrchen = this\n    }\n}', 'val m = Mensch(); m.kaufen(); 1', '1'],
    ['generic type argument', 'class Mensch {\n    val hunde = mutableListOf<Hund>()\n}', 'val m = Mensch(); m.hunde.add(Hund()); val h = m.hunde[0]; h.alle.add(m); h.alle.size + m.hunde.size', '2'],
    ['constructor parameter', 'class Mensch(var hund: Hund? = null)', 'val h = Hund(); val m = Mensch(h); h.frauchen = m; m.hund === h && Mensch().hund == null', 'true'],
  ];
  for (const [label, mensch, check, expected] of variants) {
    for (const files of [{ 'Hund.kt': hund, 'Mensch.kt': mensch }, { 'Mensch.kt': mensch, 'Hund.kt': hund }]) {
      const name = `RT-40 ${label} (${Object.keys(files).join(', ')})`;
      const p = await project(files);
      ok(p.result, name);
      assert.equal(ok(p.evaluate(check), `${name}: run`).display, expected, name);
    }
    for (const source of [`${hund}\n${mensch}`, `${mensch}\n${hund}`]) {
      const session = api.bluekCreateKotliteSession();
      ok(JSON.parse(session.load('<RT-40>', source)), `RT-40 ${label} (one source)`);
      assert.equal(ok(JSON.parse(session.evaluate('<RT-40>', check)), `RT-40 ${label} (one source): run`).display, expected);
    }
  }

  // A bidirectional association with calls in both directions, a superclass declared after its
  // subclass and an interface naming a later class. `rufen` (in Tier) calls Mensch, whose methods
  // construct a Hund, a subclass of Tier.
  const files = {
    'Halter.kt': 'interface Halter {\n    fun nimm(tier: Tier)\n}',
    'Hund.kt': 'class Hund(name: String) : Tier(name) {\n    fun bellen() = name + " bellt"\n}',
    'Mensch.kt': 'class Mensch(val name: String) : Halter {\n    val tiere = mutableListOf<Tier>()\n    var lieblingshund: Hund? = null\n    override fun nimm(tier: Tier) {\n        tiere.add(tier)\n        tier.besitzer = this\n    }\n    fun kaufeHund(name: String): Hund {\n        val hund = Hund(name)\n        nimm(hund)\n        lieblingshund = hund\n        return hund\n    }\n    fun antworten(tier: Tier): String = name + " antwortet " + tier.name\n    fun lieblingBellt() = lieblingshund?.bellen()\n}',
    'Tier.kt': 'open class Tier(val name: String) {\n    var besitzer: Mensch? = null\n    fun rufen(): String = besitzer?.antworten(this) ?: name + " ist allein"\n}',
  };
  const orders = [Object.keys(files), Object.keys(files).reverse()];
  for (const order of orders) {
    const label = `RT-40 association (${order.join(', ')})`;
    const p = await project(Object.fromEntries(order.map(name => [name, files[name]])));
    ok(p.result, label);
    const cases = [
      ['val anna = Mensch("Anna"); val bello = anna.kaufeHund("Bello"); bello.rufen()', 'Anna antwortet Bello'],
      ['anna.lieblingBellt()', 'Bello bellt'],
      ['bello.besitzer === anna && anna.lieblingshund === bello', 'true'],
      ['Tier("Mia").rufen()', 'Mia ist allein'],
      ['val halter: Halter = anna; halter.nimm(Tier("Rex")); anna.tiere.size', '2'],
      // Classes declared together in the Codepad may reference each other as well.
      ['class Napf {\n    var katze: Katze? = null\n}\nclass Katze(val name: String) {\n    val napf = Napf()\n    fun fressen(): String = napf.katze?.name ?: "leer"\n}', null],
      ['val minka = Katze("Minka"); minka.napf.katze = minka; minka.fressen()', 'Minka'],
      // Earlier bindings survive the new declarations.
      ['bello.rufen() + " / " + anna.tiere.size', 'Anna antwortet Bello / 2'],
    ];
    for (const [source, expected] of cases) {
      const value = ok(p.evaluate(source), `${label}: ${source}`);
      if (expected !== null) assert.equal(value.display, expected, `${label}: ${source}`);
    }
  }

  // While its constructor parameters are analyzed, a class has no members yet: calls in default
  // values resolve as before, also to a constructor of a class that needs the members later.
  {
    const p = await project({ 'Stapel.kt': 'class Stapel(val karten: MutableList<String> = mutableListOf<String>(), val ablage: Ablage = Ablage()) {\n    fun oben() = karten.size\n}', 'Ablage.kt': 'class Ablage {\n    fun zaehle(s: Stapel) = s.oben()\n}' });
    ok(p.result, 'RT-40 calls in constructor default values');
    assert.equal(ok(p.evaluate('val s = Stapel(); s.karten.add("A"); s.ablage.zaehle(s)'), 'RT-40 default values: run').display, '1');
  }

  // Classes are declared before other code runs, also an enum used by a file before its own.
  // An enum whose entries read a top-level property keeps its place after that property.
  {
    const p = await project({ 'Main.kt': 'val start = Farbe.ROT', 'Farbe.kt': 'enum class Farbe { ROT, GRUEN }', 'Werte.kt': 'val basis = 5', 'Level.kt': 'enum class Level(val n: Int) { EINS(basis), ZWEI(basis + 1) }' });
    ok(p.result, 'RT-40 enums used before their file');
    assert.equal(ok(p.evaluate('start == Farbe.ROT && Level.ZWEI.n == 6'), 'RT-40 enums: run').display, 'true');
  }

  // A class analyzed on demand from inside an accessor of another class is not part of that
  // accessor: B writing its own `name` is no self-calling setter of A (RT-43 warning).
  {
    const p = await project({ 'A.kt': 'class A {\n    var b: B? = null\n    var name: String = ""\n        set(value) {\n            field = value\n            b?.umbenennen(value)\n        }\n}', 'B.kt': 'class B {\n    var name: String = ""\n    fun umbenennen(neu: String) {\n        name = neu\n    }\n}' });
    ok(p.result, 'RT-40 analysis on demand inside an accessor');
    assert.deepEqual(p.result.diagnostics ?? [], [], 'RT-40 no accessor warning from another class');
    assert.equal(ok(p.evaluate('val a = A(); a.b = B(); a.name = "Rex"; a.b?.name'), 'RT-40 accessor: run').display, 'Rex');
  }

  // Genuine errors stay errors: a missing class and cyclic inheritance.
  fails((await project({ 'Hund.kt': 'class Hund {\n    var herrchen: Mensch? = null\n}' })).result, 'RT-40 missing class', /Cannot resolve type Mensch\?/);
  fails((await project({ 'A.kt': 'open class A : B()', 'B.kt': 'open class B : A()' })).result, 'RT-40 cyclic inheritance', /cycle in the inheritance hierarchy of `[AB]`/);
  fails((await project({ 'I.kt': 'interface I : J', 'J.kt': 'interface J : I' })).result, 'RT-40 cyclic interfaces', /cycle in the inheritance hierarchy of `[IJ]`/);
}

// Top-level functions and properties can be used regardless of file order (RT-45), from
// top-level functions, classes and property initializers; later overloads take part in the
// resolution, and property initializers still run in file order.
{
  const both = files => [files, Object.fromEntries(Object.entries(files).reverse())];
  const check = async (label, files, run, expected) => {
    for (const ordered of both(files)) {
      const name = `RT-45 ${label} (${Object.keys(ordered).join(', ')})`;
      const p = await project(ordered);
      ok(p.result, name);
      p.output();
      ok(p.evaluate(run), `${name}: run`);
      assert.equal(p.output(), expected, name);
    }
  };
  // The reported reproductions.
  await check('function from main', { 'Main.kt': 'fun main() { println(hilfe()) }', 'Util.kt': 'fun hilfe(): Int = 1' }, 'main()', '1\n');
  await check('function from a class', { 'Hund.kt': 'class Hund { fun f() = hilfe() }', 'Util.kt': 'fun hilfe(): Int = 1' }, 'println(Hund().f())', '1\n');
  await check('property from a class', { 'Hund.kt': 'class Hund { fun f() = maximum + 1 }', 'Werte.kt': 'val maximum = 3' }, 'println(Hund().f())', '4\n');
  // One project with every other form, in both file orders: an inferred return type, an
  // extension and an operator extension, a property of function type, overloads declared after
  // the call, mutual recursion across files, a class property initializer, a `var` written from
  // a class and a function called by a property initializer.
  await check('forms', {
    'Main.kt': 'fun main() {\n    println(doppelt(2) + 1)\n    println(3.mal2())\n    println((Punkt(1) + Punkt(2)).x)\n    println(verdopple(4))\n    println(zeige(3) + zeige("a"))\n}\nval start = hilfe() + 1',
    'Hund.kt': 'class Hund {\n    val max = maximum\n}',
    'Zaehler.kt': 'class Zaehler {\n    fun tick() {\n        stand += 1\n        stand++\n    }\n}',
    'Gerade.kt': 'fun istGerade(n: Int): Boolean = if (n == 0) true else istUngerade(n - 1)',
    'Punkt.kt': 'class Punkt(val x: Int)',
    'Util.kt': 'fun hilfe(): Int = 1\nfun doppelt(x: Int) = x * 2\nfun Int.mal2(): Int = this * 2\noperator fun Punkt.plus(o: Punkt): Punkt = Punkt(x + o.x)\nfun istUngerade(n: Int): Boolean = if (n == 0) false else istGerade(n - 1)\nval verdopple: (Int) -> Int = { it * 2 }',
    'Any.kt': 'fun zeige(x: Any): String = "Any"',
    'Int.kt': 'fun zeige(x: Int): String = "Int"',
    'Werte.kt': 'val maximum = 3\nvar stand = 0',
  }, 'main(); println(Hund().max); val z = Zaehler(); z.tick(); z.tick(); println(stand); println(istGerade(10)); println(start)', '5\n6\n3\n8\nIntAny\n3\n4\ntrue\n2\n');

  // Codepad: a snippet may use its own later declarations; later snippets, also with an overload
  // of a function the project used before its declaration, keep earlier names and bindings.
  {
    const p = await project({ 'Main.kt': 'fun main() { println(hilfe() + grenze) }', 'Util.kt': 'fun hilfe(): Int = 1\nval grenze = 10' });
    ok(p.result, 'RT-45 codepad project');
    // Property initializers and statements run in order, so they cannot read a later property.
    fails(p.evaluate('println(x)\nval x = 1'), 'RT-45 Codepad statement reads a later property', /`x` is initialized after .* file order/);
    assert.equal(ok(p.evaluate('val r = spaeter() + 1\nfun spaeter(): Int = 6\nr'), 'RT-45 codepad forward reference').display, '7');
    ok(p.evaluate('fun hilfe(x: Int): Int = x + grenze'), 'RT-45 codepad overload');
    p.output();
    assert.equal(ok(p.evaluate('main(); hilfe() + hilfe(5) + r + spaeter()'), 'RT-45 codepad after overload').display, '29');
    assert.equal(p.output(), '11\n', 'RT-45 codepad main output');
  }

  // Property initializers run in file order: reading a later property directly is a compile
  // error, through a function or class a clear runtime error instead of an unknown name.
  fails((await project({ 'Main.kt': 'val a = b + 1', 'Werte.kt': 'val b = 2' })).result, 'RT-45 initializer reads a later property', /`b` is initialized after .* file order/);
  ok((await project({ 'Werte.kt': 'val b = 2', 'Main.kt': 'val a = b + 1' })).result, 'RT-45 initializer reads an earlier property');
  fails((await project({ 'Main.kt': 'val h = Hund()', 'Hund.kt': 'class Hund { val m = maximum }', 'Werte.kt': 'val maximum = 3' })).result, 'RT-45 later property read through a class', /^InterpreterStateException: `maximum` is used before it is initialized/);
  // A limit of BlueK, not an exception of the program: no `catch` hides it.
  fails((await project({ 'Main.kt': 'val a = try { f() } catch (e: Throwable) { -1 }', 'F.kt': 'fun f() = b', 'Werte.kt': 'val b = 2' })).result, 'RT-45 later property read through a function', /^InterpreterStateException: `b` is used before it is initialized/);
  {
    const p = await project({ 'Werte.kt': 'val maximum = 3', 'Hund.kt': 'class Hund { val m = maximum }', 'Main.kt': 'val h = Hund()' });
    assert.equal(ok(p.evaluate('h.m'), 'RT-45 earlier property read through a class').display, '3');
  }
  fails((await project({ 'Main.kt': 'val a = f()', 'F.kt': 'fun f(): Int = a + 1' })).result, 'RT-45 own initializer through a function', /`a` is used before it is initialized: the initializer of `a` needs its value/);
  fails((await project({ 'Main.kt': 'fun main() { println(fehlt()) }', 'Util.kt': 'fun hilfe(): Int = 1' })).result, 'RT-45 unknown function', /`fehlt` is unknown/);
  fails((await project({ 'A.kt': 'fun a() = b()', 'B.kt': 'fun b() = a()' })).result, 'RT-45 inference cycle', /Cannot infer return type/);

  // The BluePlay library is a source unit of its own: a project function named like one the
  // library calls (`Image.fill()` calls `mutableListOf(String)`) does not change the library.
  {
    const p = await project({ 'Feld.kt': 'class Feld : World(20, 10, 1) {\n    fun f() = liste("a").size\n}', 'Util.kt': 'fun liste(text: String) = mutableListOf(text)\nfun mutableListOf(text: String): MutableList<String> = listOf(text, "Projekt").toMutableList()' }, 'blueplay');
    ok(p.result, 'RT-45 BluePlay library with a clashing project function');
    ok(p.evaluate('val bild = Image(30, 20); bild.fill(); val probe = Actor(); probe.image = bild; val welt = Feld(); welt.addObject(probe, 0, 0); welt.show()'), 'RT-45 BluePlay library: run');
    const stage = JSON.parse(p.session.takeStage()).stage;
    assert.deepEqual(stage.images[stage.objects[0].image].operations, ['fill|rgb(0,0,0)']);
    assert.equal(ok(p.evaluate('Feld().f()'), 'RT-45 BluePlay project call').display, '2');
  }
}

// stop()/start() work after the original API call `welt.show()`.
{
  const p = await project({ 'Feld.kt': 'class Feld : World(20, 10, 1)' }, 'blueplay');
  ok(p.result, 'BluePlay project');
  ok(p.evaluate('val welt = Feld(); welt.show(); start()'), 'start after show()');
  assert.equal(p.session.takeBluePlayIntent(), 'start');
  ok(p.evaluate('stop()'), 'stop after show()');
  assert.equal(p.session.takeBluePlayIntent(), 'stop');
}

// Smart casts after `is` (RT-46): the analysis narrows the variable, the interpreter still reads members
// from the actual value. Kotlin's limits apply: nothing after `||`, nothing for a `var` or computed property.
{
  const zoo = {
    'Tier.kt': 'open class Tier {\n    open fun laut(): String = "..."\n}',
    'Hund.kt': 'class Hund(val name: String) : Tier() {\n    override fun laut(): String = "Wuff"\n    fun bellen(): String = "$name: Wuff"\n}',
    'Katze.kt': 'class Katze(val leben: Int) : Tier()',
  };
  const p = await project({
    ...zoo,
    'Zoo.kt': [
      'fun mitIf(t: Tier): String { if (t is Hund) { return t.bellen() }; return "?" }',
      'fun alsAusdruck(t: Tier): String = if (t is Hund) t.bellen() else "?"',
      'fun elseZweig(t: Tier): String = if (t !is Hund) "kein Hund" else t.bellen()',
      'fun fruehZurueck(t: Tier): String { if (t !is Hund) return "kein Hund"; return t.bellen() }',
      'fun negiert(t: Tier): String { if (!(t is Hund)) return "-"; return t.name }',
      'fun und(t: Tier): Boolean = t is Hund && t.name.length > 2',
      'fun kette(a: Tier, b: Tier): Boolean = a is Hund && b is Hund && a.name == b.name',
      'fun oderMitNegation(t: Tier): Boolean = t !is Hund || t.name.isEmpty()',
      'fun wahl(t: Tier): String = when (t) { is Hund -> t.bellen(); is Katze -> "Leben ${t.leben}"; else -> "?" }',
      'fun wahlNegativ(t: Tier): String = when (t) { !is Hund -> "-"; else -> t.name }',
      'fun wahlOhneSubjekt(t: Tier): String = when { t is Hund -> t.name; else -> "?" }',
      'fun wahlMitBindung(t: Tier): String = when (val u = t) { is Hund -> u.name; else -> "?" }',
      'fun solange(t: Tier): Int { var i = 0; while (t is Hund && i < t.name.length) i++; return i }',
      'fun beschreibe(x: String) = "Text ${x.length}"',
      'fun beschreibe(x: Int) = "Zahl ${x + 1}"',
      'fun ueberladen(x: Any): String = if (x is String) beschreibe(x) else if (x is Int) beschreibe(x) else "?"',
      'fun ausAny(x: Any?): Int = if (x is Int) x + 1 else if (x is String) x.length else 0',
      'fun liste(x: Any): Int = if (x is List<*>) x.size else -1',
      'fun nullable(t: Tier?): String = if (t is Hund) t.name else "kein Hund"',
      'fun nullOrIs(x: Any?): Int = if (x != null && x is String) x.length else -1',
      'fun zuweisung(): String { var t: Tier = Hund("a"); if (t is Hund) { t = Katze(1) }; return if (t is Katze) "Katze" else "?" }',
      'fun ohneGeltung(t: Tier): String = if (t is Hund) "Hund" else t.laut()',
      'fun ausLambda(t: Tier): String { if (t is Hund) { val f = { t.name }; return f() }; return "?" }',
    ].join('\n'),
    'Punkt.kt': 'class Punkt(val x: Int) {\n    override fun equals(other: Any?): Boolean = other is Punkt && other.x == x\n    override fun hashCode(): Int = x\n}',
    'Knoten.kt': 'class Knoten(val wert: Int) {\n    var naechster: Knoten? = null\n}',
    'Kette.kt': [
      'fun summe(start: Knoten?): Int { var k = start; var s = 0; while (k != null) { s += k.wert; k = k.naechster }; return s }',
      'fun laenge(k: Knoten?): Int = if (k == null) 0 else 1 + laenge(k.naechster)',
      'fun wenige(namen: List<String?>): Int { var n = 0; for (i in 0 until namen.size) { val x = namen[i]; if (x == null) continue; n += x.length }; return n }',
    ].join('\n'),
  });
  ok(p.result, 'smart cast project');
  const show = source => ok(p.evaluate(source), source).display;
  assert.equal(show('mitIf(Hund("Rex"))'), 'Rex: Wuff');
  assert.equal(show('mitIf(Katze(9))'), '?');
  assert.equal(show('alsAusdruck(Hund("Rex"))'), 'Rex: Wuff');
  assert.equal(show('elseZweig(Hund("Rex"))'), 'Rex: Wuff');
  assert.equal(show('elseZweig(Katze(1))'), 'kein Hund');
  assert.equal(show('fruehZurueck(Hund("Rex"))'), 'Rex: Wuff');
  assert.equal(show('fruehZurueck(Katze(1))'), 'kein Hund');
  assert.equal(show('negiert(Hund("Rex"))'), 'Rex');
  assert.equal(show('und(Hund("Rex"))'), 'true');
  assert.equal(show('und(Hund("Al"))'), 'false');
  assert.equal(show('und(Katze(1))'), 'false');
  assert.equal(show('kette(Hund("A"), Hund("A"))'), 'true');
  assert.equal(show('kette(Hund("A"), Katze(1))'), 'false');
  assert.equal(show('oderMitNegation(Katze(1))'), 'true');
  assert.equal(show('oderMitNegation(Hund(""))'), 'true');
  assert.equal(show('oderMitNegation(Hund("Rex"))'), 'false');
  assert.equal(show('wahl(Katze(7))'), 'Leben 7');
  assert.equal(show('wahl(Hund("Rex"))'), 'Rex: Wuff');
  assert.equal(show('wahlNegativ(Hund("Rex"))'), 'Rex');
  assert.equal(show('wahlNegativ(Katze(1))'), '-');
  assert.equal(show('wahlOhneSubjekt(Hund("Rex"))'), 'Rex');
  assert.equal(show('wahlMitBindung(Hund("Rex"))'), 'Rex');
  assert.equal(show('solange(Hund("Rex"))'), '3');
  assert.equal(show('solange(Katze(1))'), '0');
  assert.equal(show('ueberladen("abc")'), 'Text 3');
  assert.equal(show('ueberladen(4)'), 'Zahl 5');
  assert.equal(show('ausAny(4)'), '5');
  assert.equal(show('ausAny("abcd")'), '4');
  assert.equal(show('ausAny(null)'), '0');
  assert.equal(show('liste(listOf(1, 2, 3))'), '3');
  assert.equal(show('nullable(null)'), 'kein Hund');
  assert.equal(show('nullable(Hund("Rex"))'), 'Rex');
  assert.equal(show('nullOrIs("abc")'), '3');
  assert.equal(show('zuweisung()'), 'Katze');
  assert.equal(show('ohneGeltung(Hund("Rex"))'), 'Hund');
  assert.equal(show('ohneGeltung(Katze(1))'), '...');
  assert.equal(show('ausLambda(Hund("Rex"))'), 'Rex');
  // `equals` with a smart cast on the parameter; a value of another type is not a Punkt.
  assert.equal(show('Punkt(2) == Punkt(2)'), 'true');
  assert.equal(show('Punkt(2) == Punkt(3)'), 'false');
  assert.equal(show('Punkt(2).equals("2")'), 'false');
  assert.equal(show('Punkt(2).equals(null)'), 'false');
  // The same for null checks: `while`, the `else` branch and `continue`.
  show('val k3 = Knoten(3); val k2 = Knoten(2); k2.naechster = k3; val k1 = Knoten(1); k1.naechster = k2');
  assert.equal(show('summe(k1)'), '6');
  assert.equal(show('laenge(k1)'), '3');
  assert.equal(show('laenge(null)'), '0');
  assert.equal(show('wenige(listOf<String?>("ab", "c"))'), '3');
  // Codepad: top-level `val` is stable, a top-level `var` is not (as in Kotlin).
  assert.equal(show('val fest: Any = "abc"; if (fest is String) fest.length else -1'), '3');
  fails(p.evaluate('var veraenderlich: Any = "abc"; if (veraenderlich is String) veraenderlich.length else -1'), 'top-level var', /`length` is unknown for Any/);

  const rejected = (label, files, pattern) => project({ ...zoo, ...files }).then(q => fails(q.result, label, pattern));
  await rejected('no smart cast after ||', { 'F.kt': 'fun f(t: Tier): Boolean = t is Hund || t.name.isEmpty()' }, /`name` is unknown for Tier/);
  await rejected('no smart cast after leaving the block', { 'F.kt': 'fun f(t: Tier): String { if (t is Hund) { }; return t.name }' }, /`name` is unknown for Tier/);
  await rejected('no smart cast in the else branch of is', { 'F.kt': 'fun f(t: Tier): String = if (t is Hund) "Hund" else t.name' }, /`name` is unknown for Tier/);
  await rejected('no smart cast after an assignment', { 'F.kt': 'fun f(): String { var t: Tier = Hund("a"); if (t is Hund) { t = Katze(1); return t.name }; return "" }' }, /`name` is unknown for Tier/);
  await rejected('no smart cast after a conditional assignment', { 'F.kt': 'fun f(c: Boolean): String { var t: Tier = Hund("a"); if (t is Hund) { if (c) { t = Katze(1) }; return t.name }; return "" }' }, /`name` is unknown for Tier/);
  await rejected('no smart cast of a var in a lambda', { 'F.kt': 'fun f(): String { var t: Tier = Hund("a"); if (t is Hund) { val g = { t.name }; return g() }; return "" }' }, /`name` is unknown for Tier/);
  await rejected('a shadowing declaration is not narrowed', { 'F.kt': 'fun f(t: Tier): String { if (t is Hund) { val t: Tier = Katze(1); return t.name }; return "" }' }, /`name` is unknown for Tier/);
  await rejected('no smart cast for several conditions of one when entry', { 'F.kt': 'fun f(t: Tier): String = when (t) { is Hund, is Katze -> t.name; else -> "" }' }, /`name` is unknown for Tier/);
  await rejected('no smart cast of a var property', { 'Halter.kt': 'class Halter(var tier: Tier) {\n    fun name(): String = if (tier is Hund) tier.name else "?"\n}' }, /`name` is unknown for Tier/);
  await rejected('no smart cast of a property with getter', { 'Halter.kt': 'class Halter {\n    val tier: Tier\n        get() = Hund("a")\n    fun name(): String = if (tier is Hund) tier.name else "?"\n}' }, /`name` is unknown for Tier/);
  await rejected('no smart cast of an open property', { 'Halter.kt': 'open class Halter(open val tier: Tier) {\n    fun name(): String = if (tier is Hund) tier.name else "?"\n}' }, /`name` is unknown for Tier/);
  await rejected('no smart cast of an override property', { 'Halter.kt': 'class Halter(override val tier: Tier) : Basis(tier) {\n    fun name(): String = if (tier is Hund) tier.name else "?"\n}', 'Basis.kt': 'open class Basis(open val tier: Tier)' }, /`name` is unknown for Tier/);
  await rejected('a null check does not leak out of its block', { 'F.kt': 'fun f(c: Boolean, x: String?): Int { if (c) { if (x == null) return 0 }; return x.length }' }, /`length` is unknown for String|nullable receiver/);
  // A val property (also a constructor `val`) keeps its smart cast.
  const q = await project({ ...zoo, 'Halter.kt': 'class Halter(val tier: Tier) {\n    val zweiter: Tier = Katze(2)\n    fun name(): String = if (tier is Hund) tier.name else "?"\n    fun leben(): Int = if (zweiter is Katze) zweiter.leben else 0\n}' });
  ok(q.result, 'smart cast of val properties');
  assert.equal(ok(q.evaluate('Halter(Hund("Rex")).name()'), 'val property').display, 'Rex');
  assert.equal(ok(q.evaluate('Halter(Hund("Rex")).leben()'), 'body val property').display, '2');
}

// Pairs, lists, sets and maps compare, hash and print by content like in Kotlin (RT-52). They
// used to compare by identity (`listOf(1) == listOf(1)` was false) and a pair printed as `Pair()`.
{
  const p = await project({ 'Punkt.kt': 'class Punkt(val x: Int) {\n    override fun toString(): String = "P$x"\n    override fun equals(other: Any?): Boolean = other is Punkt && (other as Punkt).x == x\n    override fun hashCode(): Int = x\n}', 'Leer.kt': 'class Leer' });
  ok(p.result, 'RT-52 project');
  const cases = [
    // Text
    ['Pair(1, "a")', '(1, a)'],
    ['"${1 to 2}"', '(1, 2)'],
    ['(1 to "a").toString()', '(1, a)'],
    ['Pair("a", null).toString()', '(a, null)'],
    ['listOf(1, 2).zip(listOf("a", "b"))', '[(1, a), (2, b)]'],
    ['listOf(1, 2, 3).partition { it > 1 }', '([2, 3], [1])'],
    ['Pair(1, listOf(2)).toString()', '(1, [2])'],
    // Elements use their own toString(), also through an explicit toString() call.
    ['listOf(Punkt(1)).toString() + Pair(Punkt(1), Punkt(2)).toString() + mapOf(1 to Punkt(3)).toString()', '[P1](P1, P2){1=P3}'],
    // Equality
    ['Pair(1, 2) == Pair(1, 2)', 'true'],
    ['(1 to 2) != (1 to 2)', 'false'],
    ['Pair(1, 2) == Pair(2, 1)', 'false'],
    ['Pair(1, 2) == Pair(1L, 2L)', 'false'],
    ['Pair(1, 2).equals(Pair(1, 2))', 'true'],
    ['listOf(1, 2) == listOf(1, 2)', 'true'],
    ['mutableListOf(1) == listOf(1)', 'true'],
    ['listOf(1, 2) == listOf(2, 1)', 'false'],
    ['listOf(1).equals(listOf(1))', 'true'],
    ['setOf(1, 2) == setOf(2, 1)', 'true'],
    ['mapOf(1 to 2) == mapOf(1 to 2)', 'true'],
    ['listOf(1) == setOf(1)', 'false'],
    ['listOf(1) === listOf(1)', 'false'],
    ['listOf(Punkt(1)) == listOf(Punkt(1))', 'true'],
    ['listOf(Punkt(1)) == listOf(Punkt(2))', 'false'],
    ['listOf(Leer()) == listOf(Leer())', 'false'],
    ['val leer = Leer(); listOf(leer) == listOf(leer)', 'true'],
    ['val liste = mutableListOf(1); val ref = liste; liste.add(2); ref == listOf(1, 2)', 'true'],
    // Comparisons with null or other types, also through the member equals.
    ['Pair(1, 2) == null', 'false'],
    ['listOf(1) == null', 'false'],
    ['val kein: Pair<Int, Int>? = null; kein == Pair(1, 2)', 'false'],
    ['Pair(1, 2).equals(null)', 'false'],
    ['Pair(1, 2).equals("x")', 'false'],
    // Hash codes as in Kotlin, so sets, map keys and searches work with pairs and lists.
    ['Pair(1, 2).hashCode()', '33'],
    ['listOf(1, 2).hashCode()', '994'],
    ['setOf(1 to 2, 1 to 2).size', '1'],
    ['setOf(listOf(1), listOf(1)).size', '1'],
    ['mapOf((1 to 2) to "x")[1 to 2]', 'x'],
    ['listOf(1 to 2).indexOf(1 to 2)', '0'],
    ['listOf(listOf(1)).contains(listOf(1))', 'true'],
    ['mutableListOf(1 to 2).remove(1 to 2)', 'true'],
    // Other library values keep identity and their plain text.
    ['val it1 = listOf(1).iterator(); "${it1 == it1} ${it1 == listOf(1).iterator()} ${it1.equals(it1)} ${it1.hashCode() == it1.hashCode()}"', 'true false true true'],
    ['listOf(1).iterator().toString()', 'Iterator()'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-52 ${source}`).display, expected, `RT-52 ${source}`);
}

// `super.equals()`, `super.hashCode()` and `super.toString()` that reach `Any` work on the whole
// object (RT-53). They used to run on the object's `Any` part: an object with
// `equals() = super.equals(other)` was not equal to itself, and `super.toString()` gave `Any()`.
{
  const p = await project({
    'Eigen.kt': 'class Eigen(val n: Int) {\n    override fun equals(other: Any?): Boolean = super.equals(other)\n    override fun hashCode(): Int = super.hashCode()\n    override fun toString(): String = "E:" + super.toString()\n    fun basis(): Int = super.hashCode()\n}',
    'Basis.kt': 'open class Basis {\n    override fun equals(other: Any?): Boolean = super.equals(other)\n}',
    'Kind.kt': 'class Kind : Basis()',
    'Wert.kt': 'class Wert(val n: Int) {\n    override fun equals(other: Any?): Boolean {\n        if (other is Wert) return (other as Wert).n == n\n        return super.equals(other)\n    }\n    override fun hashCode(): Int = n\n}',
    'Tier.kt': 'open class Tier(val name: String) {\n    override fun toString(): String = "Tier $name"\n}',
    'Hund.kt': 'class Hund(name: String) : Tier(name) {\n    override fun toString(): String = super.toString() + " bellt"\n}',
    'Leer.kt': 'class Leer',
  });
  ok(p.result, 'RT-53 project');
  const cases = [
    ['val e = Eigen(1); "${e == e} ${e.equals(e)} ${e == Eigen(1)} ${e == null}"', 'true true false false'],
    ['"${setOf(e, e).size} ${listOf(e).contains(e)} ${listOf(e).indexOf(e)}"', '1 true 0'],
    ['e.hashCode() == e.hashCode()', 'true'],
    ['e.basis() == e.hashCode()', 'true'],
    ['e.toString()', 'E:Eigen()'],
    ['"$e"', 'E:Eigen()'],
    // Inherited from a student class whose `equals` calls `super.equals`.
    ['val k = Kind(); "${k == k} ${k == Kind()}"', 'true false'],
    ['"${Wert(1) == Wert(1)} ${Wert(1) == Wert(2)} ${Wert(1) == null} ${setOf(Wert(1), Wert(1)).size}"', 'true false false 1'],
    // `super.toString()` of a student superclass keeps working.
    ['Hund("Rex").toString()', 'Tier Rex bellt'],
    ['val leer = Leer(); "${leer == leer} ${leer == Leer()} ${leer.hashCode() == leer.hashCode()} $leer"', 'true false true Leer()'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-53 ${source}`).display, expected, `RT-53 ${source}`);
}

// Exceptions are objects like in Kotlin (RT-54): `toString()` gives `MyEx: x`, `catch` receives the
// thrown object itself with the fields of a student exception class, and `message`/`cause` work
// outside `catch`. `IllegalStateException("x").toString()` used to fail with
// "memberFunctionsForSA not initialized", a template gave `MyEx()`, `MyEx("x").message` a
// ClassCastException, and `catch (e: KontoException) { e.betrag }` a NullPointerException.
{
  const files = {
    'MyEx.kt': 'class MyEx(m: String) : Exception(m)',
    'LeerEx.kt': 'class LeerEx : Exception()',
    'KontoException.kt': 'class KontoException(val betrag: Int) : IllegalStateException("Konto zu niedrig: $betrag")',
    'M2.kt': 'class M2(m: String) : Exception(m) {\n    override fun toString(): String = "M2:" + super.toString()\n}',
  };
  const p = await project(files);
  ok(p.result, 'RT-54 project');
  const cases = [
    ['IllegalStateException("x").toString()', 'IllegalStateException: x'],
    ['"${IllegalArgumentException("y")}"', 'IllegalArgumentException: y'],
    ['Exception().toString()', 'Exception'],
    ['MyEx("x").toString()', 'MyEx: x'],
    ['"${MyEx("x")}"', 'MyEx: x'],
    ['LeerEx().toString()', 'LeerEx'],
    ['M2("q").toString()', 'M2:M2: q'],
    ['"${listOf(MyEx("l"), IllegalStateException("m"))}"', '[MyEx: l, IllegalStateException: m]'],
    ['MyEx("x").message', 'x'],
    ['KontoException(5).message', 'Konto zu niedrig: 5'],
    ['try { throw MyEx("x") } catch (e: Exception) { "$e | ${e.message} | ${e is MyEx}" }', 'MyEx: x | x | true'],
    ['try { throw KontoException(3) } catch (e: KontoException) { e.betrag }', '3'],
    ['try { throw KontoException(3) } catch (e: IllegalStateException) { "$e" }', 'KontoException: Konto zu niedrig: 3'],
    ['val geworfen = MyEx("a"); try { throw geworfen } catch (e: Exception) { e === geworfen }', 'true'],
    ['try { throw MyEx("x") } catch (e: IllegalStateException) { "falsch" } catch (e: Exception) { "richtig" }', 'richtig'],
    ['try { try { throw MyEx("re") } catch (e: MyEx) { throw e } } catch (e: Exception) { "erneut " + e.message }', 'erneut re'],
    ['try { "x".toInt() } catch (e: Exception) { e.toString() }', "NumberFormatException: Invalid number format: 'x'"],
    ['try { 1 / 0 } catch (e: ArithmeticException) { "$e" }', 'ArithmeticException: / by zero'],
    ['try { throw Exception("a", MyEx("b")) } catch (e: Exception) { "${e.cause} ${e.cause is MyEx}" }', 'MyEx: b true'],
    ['Exception("a", IllegalStateException("b")).cause?.message', 'b'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-54 ${source}`).display, expected, `RT-54 ${source}`);
  ok(p.evaluate('MyEx("y").printStackTrace()'), 'RT-54 printStackTrace outside catch');
  assert.equal(p.output(), 'MyEx: y\n', 'RT-54 printStackTrace output');
  // An uncaught exception names the thrown object; one without message only its class.
  fails((await project(files)).evaluate('throw KontoException(7)'), 'RT-54 uncaught', /^KontoException: Konto zu niedrig: 7$/);
  fails((await project(files)).evaluate('throw LeerEx()'), 'RT-54 uncaught without message', /^LeerEx$/);
}

// `break` and `continue` in `for` loops (RT-55). Every one of them used to end the program with
// "NormalContinueException: Continue" / "NormalBreakException: Break"; `while` was not affected.
{
  const p = await project({
    'Schleifen.kt': 'fun weiter(): String {\n    var s = ""\n    for (i in 1..4) {\n        if (i == 2) continue\n        if (i == 4) break\n        s += i\n    }\n    return s\n}\n' +
      'fun ohneB(): String {\n    var s = ""\n    for (x in listOf("a", "b", "c")) {\n        if (x == "b") continue\n        s += x\n    }\n    return s\n}\n' +
      'fun main() {\n    for (i in 1..3) {\n        if (i == 2) continue\n        println(i)\n    }\n}',
  });
  ok(p.result, 'RT-55 project');
  assert.equal(ok(p.evaluate('weiter()'), 'RT-55 range').display, '13');
  assert.equal(ok(p.evaluate('ohneB()'), 'RT-55 list').display, 'ac');
  ok(p.evaluate('main()'), 'RT-55 main');
  const cases = [
    ['var s1 = ""; for (i in 0 until 5) { if (i == 3) break; s1 += i }; s1', '012'],
    ['var s2 = ""; for (i in 1..3) { for (j in 1..3) { if (j == 2) break; s2 += "$i$j " } }; s2', '11 21 31 '],
    ['var s3 = ""; for (i in 3 downTo 1) { if (i == 2) continue; s3 += i }; s3', '31'],
    ['var s4 = 0; for (c in "abc") { if (c == \'b\') continue; s4++ }; s4', '2'],
    ['var s5 = ""; for (i in 1..3) { if (i == 2) { continue }; s5 += i }; s5', '13'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-55 ${source}`).display, expected, `RT-55 ${source}`);
  assert.equal(p.output(), '1\n3\n', 'RT-55 main output');
}

// `when` without `else` (RT-56): as a statement it does nothing if no entry matches; as a value it
// needs `else` unless it covers every value (all enum entries, `true` and `false`, and `null` for a
// nullable subject). It used to require `else` always ("Currently, `when` expression must be used
// with an `else` branch").
{
  const p = await project({
    'Farbe.kt': 'enum class Farbe { ROT, GRUEN, BLAU }',
    'Ampel.kt': 'fun name(f: Farbe): String = when (f) {\n    Farbe.ROT -> "rot"\n    Farbe.GRUEN -> "grün"\n    Farbe.BLAU -> "blau"\n}\n' +
      'fun drucke(n: Int) {\n    when (n) {\n        1 -> println("eins")\n        2 -> println("zwei")\n    }\n}',
  });
  ok(p.result, 'RT-56 project');
  const cases = [
    ['name(Farbe.BLAU)', 'blau'],
    ['val t = when (Farbe.GRUEN) { Farbe.ROT -> 1; Farbe.GRUEN -> 2; Farbe.BLAU -> 3 }; t + 1', '3'],
    ['val ja = false; val s: String = when (ja) { true -> "j"; false -> "n" }; s', 'n'],
    ['val vielleicht: Farbe? = null; when (vielleicht) { Farbe.ROT -> 1; Farbe.GRUEN -> 2; Farbe.BLAU -> 3; null -> 0 }', '0'],
    ['var r = ""; when (5) { 1 -> r = "a"; 5 -> r = "e" }; r', 'e'],
    ['var r2 = ""; for (i in 1..3) { when (i) { 2 -> continue; 3 -> break }; r2 += i }; r2', '1'],
    ['when (7) { 1 -> 1; else -> 2 }', '2'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-56 ${source}`).display, expected, `RT-56 ${source}`);
  ok(p.evaluate('drucke(1); drucke(3); drucke(2); when { 1 > 2 -> println("nie") }'), 'RT-56 statements');
  assert.equal(p.output(), 'eins\nzwei\n', 'RT-56 statement output');
  const exhaustive = /'when' expression must be exhaustive\. Add an 'else' branch\./;
  for (const source of [
    'val v1 = when (2) { 1 -> "a" }',
    'fun g1(w: Int): String = when (w) { 1 -> "a" }',
    'fun h1(z: Int): String { return when (z) { 1 -> "a" } }',
    'println(when (2) { 1 -> "a" })',
    'var z1 = ""; z1 = when (2) { 1 -> "a" }',
    'val v2 = when (Farbe.ROT) { Farbe.ROT -> 1; Farbe.GRUEN -> 2 }',
    'val f3: Farbe? = Farbe.ROT; val v3 = when (f3) { Farbe.ROT -> 1; Farbe.GRUEN -> 2; Farbe.BLAU -> 3 }',
  ]) fails(p.evaluate(source), `RT-56 ${source}`, exhaustive);
  fails(p.evaluate('when (4) { 1 -> 1; else -> 2; 3 -> 3 }'), 'RT-56 else not last', /`else` branch must be the last branch/);
}

// `override fun toString() = …`, `equals` and `hashCode` without return type (RT-57). They used to
// fail with "Cannot infer return type of function toString" because the lookup of these special
// functions needed the return type before the body was analyzed.
{
  const p = await project({
    'Hund.kt': 'class Hund(val name: String, val alter: Int) {\n    override fun toString() = "Hund $name ($alter)"\n    override fun equals(other: Any?) = other is Hund && (other as Hund).name == name\n    override fun hashCode() = name.hashCode()\n}',
    'Tier.kt': 'open class Tier {\n    override fun toString() = "Tier"\n}',
    'Katze.kt': 'class Katze : Tier() {\n    override fun toString() = "Katze/" + super.toString()\n}',
  });
  ok(p.result, 'RT-57 project');
  const cases = [
    ['Hund("Rex", 3).toString()', 'Hund Rex (3)'],
    ['"${Hund("Rex", 3)}"', 'Hund Rex (3)'],
    ['Hund("Rex", 3) == Hund("Rex", 5)', 'true'],
    ['setOf(Hund("Rex", 3), Hund("Rex", 4)).size', '1'],
    ['listOf(Hund("A", 1)).toString()', '[Hund A (1)]'],
    ['Katze().toString()', 'Katze/Tier'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-57 ${source}`).display, expected, `RT-57 ${source}`);
  // As in Kotlin, the body must still fit the overridden return type.
  fails(p.evaluate('class Falsch { override fun toString() = 5 }'), 'RT-57 wrong toString type', /Expected type is `String`, but actual type is `Int`/);
  fails(p.evaluate('class Falsch2 { override fun hashCode() = "x" }'), 'RT-57 wrong hashCode type', /Expected type is `Int`, but actual type is `String`/);
}

// Map entries print and compare like Kotlin's (RT-58): `a=1` instead of `MapEntry()`, equal by key and
// value. `map.entries` itself is covered by smoke-kotlin-surface.mjs.
{
  const p = await project({ 'Punkt.kt': 'class Punkt(val x: Int) {\n    override fun toString(): String = "P$x"\n}' });
  ok(p.result, 'RT-58 project');
  const cases = [
    ['mapOf("a" to 1).iterator().next()', 'a=1'],
    ['var me = ""; for (e in mapOf("a" to 1, "b" to 2)) me += "$e "; me', 'a=1 b=2 '],
    ['var mf = ""; mapOf("a" to 1).forEach { mf += it.toString() }; mf', 'a=1'],
    ['mapOf("a" to 3, "b" to 1).maxByOrNull { it.value }.toString()', 'a=3'],
    ['mapOf(1 to Punkt(2)).entries.first().toString()', '1=P2'],
    ['val e1 = mapOf("a" to 1).iterator().next(); val e2 = mapOf("a" to 1).entries.first(); "${e1 == e2} ${e2 == e1} ${e1.hashCode() == e2.hashCode()}"', 'true true true'],
    ['mapOf("a" to 1).iterator().next() == mapOf("a" to 2).iterator().next()', 'false'],
    ['mapOf("a" to 1).entries == mapOf("a" to 1).entries', 'true'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-58 ${source}`).display, expected, `RT-58 ${source}`);
}

// Doubles print like Kotlin/JVM (RT-60): plain from 10^-3 up to below 10^7, otherwise with an
// exponent. Kotlin/JS printed `100000000000000000000.0`, `1e-7` and `123456789000.0`.
{
  const p = await project({ 'Main.kt': 'fun main() {}' });
  const cases = [
    ['6.0', '6.0'],
    ['-2.5', '-2.5'],
    ['100.0', '100.0'],
    ['1234567.0', '1234567.0'],
    ['12345678.0', '1.2345678E7'],
    ['10000000.0', '1.0E7'],
    ['0.001', '0.001'],
    ['0.0001', '1.0E-4'],
    ['1.5 * 10.0.pow(-7)', '1.5E-7'],
    ['10.0.pow(20)', '1.0E20'],
    ['123456789.0 * 1000', '1.23456789E11'],
    ['Double.MAX_VALUE', '1.7976931348623157E308'],
    ['0.1 + 0.2', '0.30000000000000004'],
    ['1.0 / 0.0', 'Infinity'],
    ['"Summe: ${12345678.9}"', 'Summe: 1.23456789E7'],
    ['listOf(1.0, 12345678.9).toString()', '[1.0, 1.23456789E7]'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-60 ${source}`).display, expected, `RT-60 ${source}`);
}

// `null!!` throws a NullPointerException without message, as in Kotlin (RT-61). It used to carry the
// text "null" and showed as `NullPointerException: null`.
{
  const p = await project({ 'Main.kt': 'fun main() {}' });
  const cases = [
    ['val leer: String? = null; try { leer!!.length } catch (e: NullPointerException) { "${e.message == null} $e" }', 'true NullPointerException'],
    ['try { throw NullPointerException("eigen") } catch (e: Exception) { "$e" }', 'NullPointerException: eigen'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-61 ${source}`).display, expected, `RT-61 ${source}`);
  fails((await project({ 'Main.kt': 'fun main() {}' })).evaluate('val nichts: String? = null; nichts!!.length'), 'RT-61 uncaught', /^NullPointerException$/);
}

// Extension functions and supertype extension properties through an implicit receiver (RT-63):
// `liste.apply { add(1) }`, `text.run { uppercase() }`, `with(liste) { size }` for a MutableList and
// `gruss()` for `fun Hund.gruss()` inside Hund or another Hund extension. Kotlite used to find only
// members there ("No matching function or constructor `add`", "`gruss` is unknown").
{
  const p = await project({
    'Hund.kt': 'class Hund(var name: String) {\n    val tricks = mutableListOf<String>()\n    fun innen(): String = gruss()\n    fun lerne(t: String) { tricks.apply { add(t) } }\n    fun anzahl(): Int = with(tricks) { size }\n}',
    'Ext.kt': 'fun Hund.gruss(): String = "Hallo " + name\nfun Hund.zweimal(): String = gruss() + " " + gruss()\nfun List<Int>.doppelt(): List<Int> = this.map { it * 2 }',
  });
  ok(p.result, 'RT-63 project');
  const cases = [
    ['mutableListOf(1).apply { add(2) }', '[1, 2]'],
    ['with(mutableListOf(1)) { add(2); size }', '2'],
    ['"abc".run { uppercase() }', 'ABC'],
    ['with("abc") { substring(1) }', 'bc'],
    ['listOf(3, 1).run { sorted() }', '[1, 3]'],
    ['listOf(1, 2).run { map { it + 1 } }', '[2, 3]'],
    ['listOf(1, 2).run { doppelt() }', '[2, 4]'],
    ['mutableListOf(1, 2).run { lastIndex }', '1'],
    ['Hund("Rex").innen()', 'Hallo Rex'],
    ['Hund("Rex").zweimal()', 'Hallo Rex Hallo Rex'],
    ['Hund("Rex").apply { name = gruss() }.name', 'Hallo Rex'],
    ['val hund = Hund("A"); hund.lerne("Sitz"); hund.lerne("Platz"); "${hund.anzahl()} ${hund.tricks}"', '2 [Sitz, Platz]'],
  ];
  for (const [source, expected] of cases) assert.equal(ok(p.evaluate(source), `RT-63 ${source}`).display, expected, `RT-63 ${source}`);
  // Unknown names and wrong argument types keep their messages.
  fails(p.evaluate('mutableListOf(1).apply { gibtsNicht(2) }'), 'RT-63 unknown', /`gibtsNicht` is unknown/);
  fails(p.evaluate('mutableListOf(1).apply { add("x") }'), 'RT-63 wrong argument', /No matching function or constructor `add` found for the argument types \(String\)/);
}

console.log('Curriculum Kotlin smoke test passed.');
