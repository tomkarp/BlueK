import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

vm.runInThisContext(await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8'));
const api = globalThis['bluek-kotlite-browser'];
const entity = 'open class Entity\nopen class Coin : Entity()\nclass Gold : Coin()\nclass Wall : Entity()\n';
const tests = [];
const value = (name, source, expected) => tests.push({ name, source, expected });
const rejected = (name, source) => tests.push({ name, source, reject: true });

rejected('erased List type test', 'val item: Any = listOf(1)\nitem is List<String>');
rejected('erased nested List type test', 'val item: Any = listOf(listOf(1))\nitem !is List<List<*>>');
value('star type test', 'val item: Any = listOf(1)\nitem is List<*>', 'true');
value('statically known type arguments', 'val item: List<String> = listOf("a")\nitem is List<String>', 'true');
value('reified classifier erasure', 'inline fun <reified T> matches(x: Any?): Boolean = x is T\nmatches<List<String>>(listOf(1))', 'true');
value('native classifier erasure', 'val items: List<Any> = listOf(listOf(1), "no", listOf("a"))\nitems.filterIsInstance<List<String>>().size', '2');
value('Any includes functions', 'val f: () -> Int = { 1 }\nf is Any', 'true');
value('generic type within reified classifier', 'inline fun <reified R> matches(x: Any): Boolean = x is R\nfun <T> test(x: Any): Boolean = matches<List<T>>(x)\ntest<String>(listOf(1))', 'true');
rejected('inferred erased reified argument', 'inline fun <reified R> probe(x: R): Boolean = x is R\nfun <T> invalid(x: T): Boolean = probe(x)');
rejected('reified class parameter', 'class Box<reified T>(val value: T)');
rejected('reified Nothing', 'inline fun <reified T> probe(x: Any): Boolean = x is T\nprobe<Nothing>(1)');
value('reified nullable cast', 'inline fun <reified T> cast(x: Any?): T? = x as? T\ncast<String>(1) == null && cast<String>("ok") == "ok"', 'true');
value('implicit argument of returned reified lambda', 'inline fun <reified T> matcher(): (Any) -> Boolean = { it is T }\nval f = matcher<String>()\nf("ok") && !f(1)', 'true');
value('escaping nested reified closure', entity + `
inline fun <reified T : Entity> factory(): () -> ((Entity) -> Boolean) {
    return { { item: Entity -> item is T } }
}
val coinTest = factory<Coin>()()
val wallTest = factory<Wall>()()
coinTest(Gold()) && !coinTest(Wall()) && wallTest(Wall()) && !wallTest(Coin())`, 'true');
value('nested lambda captures values and types', entity + `
inline fun <reified T : Entity> select(items: List<Entity>): List<T> {
    return items.filter { outer -> items.any { inner -> inner === outer && inner is T } }.map { it as T }
}
val coin = Coin()
val result = select<Coin>(listOf(Wall(), coin))
result.size == 1 && result[0] === coin`, 'true');
value('inherited generic methods and method chain', entity + `
open class World {
    val items = mutableListOf<Entity>()
    inline fun <reified T : Entity> getObjects(): List<T> = items.filterIsInstance<T>()
    inline fun <reified T : Entity> getOne(): T? = getObjects<T>().firstOrNull()
}
class MyWorld : World()
val world = MyWorld()
val coin = Coin()
world.items.add(Wall())
world.items.add(coin)
world.getObjects<Coin>().size == 1 && world.getOne<Coin>() === coin`, 'true');
rejected('type parameter shadowing', 'inline fun <reified T> outer(): Boolean { fun <T> inner(x: Any): Boolean = x is T; return inner<String>(1) }');

value('stdlib inline forEach return', 'fun find(): Int { listOf(1, 2, 3).forEach { if (it == 2) { return it } }; return 0 }\nfind()', '2');
value('stdlib inline let return', 'fun find(): Int { 42.let { return it }; return 0 }\nfind()', '42');
value('stdlib implicit local label', 'var sum = 0\nlistOf(1, 2, 3).forEach { if (it == 2) { return@forEach }; sum += it }\nsum', '4');

rejected('class type parameter shadows reified type', 'inline fun <reified T> outer(): Boolean { class C<T> { fun test(x: Any): Boolean = x is T }; return C<Int>().test(2) }');
value('explicit inline invoke', 'inline fun perform(block: () -> Unit) { block.invoke() }\nfun answer(): Int { perform { return 42 }; return 0 }\nanswer()', '42');

const inline = 'inline fun perform(block: () -> Unit) { block() }\n';
value('non-local return', inline + 'fun answer(): Int { perform { return 7 }; return 9 }\nanswer()', '7');
value('nested inline non-local return', inline + 'fun answer(): Int { perform { perform { return 7 } }; return 9 }\nanswer()', '7');
value('return bypasses catch and runs finally', inline + `
var trace = ""
inline fun guarded(block: () -> Unit) {
    try { block() } catch (e: Throwable) { trace += "caught" } finally { trace += "finally" }
}
fun answer(): Int { guarded { return 7 }; return 9 }
answer() == 7 && trace == "finally"`, 'true');
value('implicit local return label', inline + 'var n = 0\nfun answer(): Int { perform { n++; return@perform }; return n }\nanswer()', '1');
value('explicit outer lambda label', inline + 'var n = 0\nperform outer@ { perform { n++; return@outer }; n += 10 }\nn', '1');
value('recursive calls have distinct return targets', inline + `
fun answer(n: Int): Int {
    perform {
        if (n > 0) { return answer(n - 1) + 1 }
        return 10
    }
    return -100
}
answer(4)`, '14');
value('noinline function value through Any', 'inline fun keep(noinline block: () -> Int): Any = block\nkeep { 42 } is Any', 'true');
value('function cast to Any', 'val f: () -> Int = { 42 }\n(f as? Any) != null', 'true');
value('crossinline captures mutable local state', 'inline fun wrap(crossinline block: () -> Int): () -> Int = { block() }\nvar n = 1\nval f = wrap { n++ }\nf(); f(); n', '3');
value('noinline closure can escape', 'inline fun keep(noinline block: () -> Int): () -> Int = block\nval f = keep { 42 }\nf()', '42');
value('crossinline can escape through wrapper', 'inline fun wrap(crossinline block: () -> Int): () -> Int = { block() }\nval f = wrap { 42 }\nf()', '42');
value('inline parameter forwarding', inline + 'inline fun relay(block: () -> Unit) { perform(block) }\nfun answer(): Int { relay { return 42 }; return 0 }\nanswer()', '42');
value('crossinline forwarding into inline call', inline + 'inline fun relay(crossinline block: () -> Unit) { perform(block) }\nvar n = 0\nrelay { n++ }\nn', '1');
rejected('noinline non-local return', 'inline fun run(noinline block: () -> Unit) { block() }\nfun f(): Int { run { return 7 }; return 9 }');
rejected('crossinline non-local return', 'inline fun run(crossinline block: () -> Unit) { block() }\nfun f(): Int { run { return 7 }; return 9 }');
rejected('ordinary lambda non-local return', 'fun run(block: () -> Unit) { block() }\nfun f(): Int { run { return 7 }; return 9 }');
rejected('inline lambda cannot be stored', 'inline fun keep(block: () -> Int): () -> Int = block');
rejected('crossinline value cannot be stored', 'inline fun keep(crossinline block: () -> Int): () -> Int = block');
rejected('explicit invoke cannot escape inline parameter', 'inline fun keep(block: () -> Int): () -> Int = { block.invoke() }');
rejected('inline lambda cannot escape through wrapper', 'inline fun keep(block: () -> Int): () -> Int = { block() }');
rejected('inline parameter cannot pass to ordinary function', 'fun run(block: () -> Unit) { block() }\ninline fun bad(block: () -> Unit) { run(block) }');
rejected('inline parameter cannot pass to crossinline', 'inline fun run(crossinline block: () -> Unit) { block() }\ninline fun bad(block: () -> Unit) { run(block) }');
rejected('noinline requires inline function', 'fun bad(noinline block: () -> Unit) { block() }');
rejected('crossinline requires function parameter', 'inline fun bad(crossinline n: Int): Int = n');
rejected('conflicting parameter modifiers', 'inline fun bad(noinline crossinline block: () -> Unit) { block() }');
rejected('open inline method', 'open class Example { open inline fun run(block: () -> Unit) { block() } }');
rejected('break cannot escape ordinary lambda', 'fun run(block: () -> Unit) { block() }\nwhile (true) { run { break } }');

let failures = 0;
for (const test of tests) {
    const session = api.bluekCreateKotliteSession();
    const result = JSON.parse(session.evaluate(`<${test.name}>`, test.source));
    const passed = test.reject
        ? result.kind === 'error' && result.phase === 'analysis'
        : result.kind !== 'error' && result.display === test.expected;
    if (!passed) {
        failures++;
        console.error(`${test.name}: expected ${test.reject ? 'analysis error' : test.expected}, got ${JSON.stringify(result)}`);
    }
}
if (failures) throw new Error(`${failures}/${tests.length} generic/inline boundary tests failed.`);
console.log(`Generic and inline boundaries passed: ${tests.length} cases.`);

// A return target must survive suspension and resume in the same invocation.
const suspended = api.bluekCreateKotliteSession();
const resumed = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Suspended inline return timed out')), 5000);
    const started = JSON.parse(suspended.startEvaluate('<suspended inline>', `
        inline fun perform(block: () -> Unit) { block() }
        fun answer(): Int {
            perform { Thread.sleep(1); return 42 }
            return 0
        }
        answer()
    `, () => {}, result => { clearTimeout(timeout); resolve(JSON.parse(result)); }));
    if (started.kind === 'error') { clearTimeout(timeout); reject(new Error(JSON.stringify(started))); }
});
if (resumed.kind === 'error' || resumed.display !== '42') throw new Error(`Suspended inline return: ${JSON.stringify(resumed)}`);
console.log('Suspended inline return passed.');
