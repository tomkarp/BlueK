import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundle = await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8');
vm.runInThisContext(bundle, { filename: 'bluek-kotlite-browser.js' });
const api = globalThis['bluek-kotlite-browser'];
const json = (value) => JSON.parse(value);
const ok = (value, label) => {
  if (value.kind === 'error') throw new Error(`${label}: ${value.display}`);
  return value;
};
const load = (session, source, label) => ok(json(session.load(`<${label}>`, source)), `${label} load`);
const evaluate = (session, source, label) => ok(json(session.evaluate(`<${label}>`, source)), label);
const expectAnalysisError = (value, label, fragment) => {
  if (value.kind !== 'error' || value.phase !== 'analysis' || (fragment && !value.display.includes(fragment))) {
    throw new Error(`${label} was not rejected during analysis: ${value.display}`);
  }
};

// Reproduction 1: a reified type argument must survive both iterator lambdas
// and the nested `as T`; the filter must not fall back to Entity.
const lambdaSession = api.bluekCreateKotliteSession();
load(lambdaSession, `
    open class Entity
    class Coin : Entity()
    class Wall : Entity()
    inline fun <reified T : Entity> select(items: List<Entity>): List<T> {
        return items.filter { it is T }.map { it as T }
    }
`, 'reified lambda filter');
const lambdaResult = evaluate(lambdaSession, `
    val coin = Coin()
    val source: List<Entity> = listOf(coin, Wall())
    val selected = select<Coin>(source)
    selected.size == 1 && selected[0] === coin
`, 'reified lambda filter');
if (lambdaResult.display !== 'true') {
  throw new Error('A reified type argument, list order, or object identity was lost in lambdas.');
}

// Reproduction 2: a non-reified type parameter may not be forwarded into a
// reified call, even when the callee itself is valid.
const forwardingSession = api.bluekCreateKotliteSession();
const forwardingLoad = json(forwardingSession.load('<reified forwarding>', `
    inline fun <reified R> matches(value: Any): Boolean {
        return value is R
    }
    fun <T> invalid(value: Any): Boolean {
        return matches<T>(value)
    }
`));
expectAnalysisError(forwardingLoad, 'non-reified forwarding', 'erased');

// A valid reified-to-reified forwarding chain remains executable.
const validForwardingSession = api.bluekCreateKotliteSession();
load(validForwardingSession, `
    inline fun <reified R> matches(value: Any): Boolean = value is R
    inline fun <reified T> relay(value: Any): Boolean = matches<T>(value)
`, 'reified forwarding');
if (evaluate(validForwardingSession, 'relay<String>("ok")', 'reified forwarding').display !== 'true') {
  throw new Error('A reified type argument was not forwarded through a nested call.');
}

// Direct non-reified type tests are rejected at the same general boundary.
const directTypeTestSession = api.bluekCreateKotliteSession();
expectAnalysisError(json(directTypeTestSession.load('<direct erased type test>', `
    fun <T> invalid(value: Any): Boolean = value is T
`)), 'direct erased type test', 'erased type parameter');

// Generic classes are loaded like project files, then consumed by Codepad
// expressions. This exercises the session boundary rather than one source
// string only, for both String and Int concrete arguments.
const boxSession = api.bluekCreateKotliteSession();
load(boxSession, `
    class Box<T>(val value: T) {
        fun identity(item: T): T { return item }
        fun same(item: T): Boolean { return item === value }
    }
`, 'Box.kt');
load(boxSession, `
    fun <T> pass(value: T): T { return value }
`, 'GenericFunctions.kt');
ok(evaluate(boxSession, 'val stringBox = Box<String>("Hallo")', 'Box<String> construction'), 'Box<String> construction');
ok(evaluate(boxSession, 'val intBox = Box<Int>(42)', 'Box<Int> construction'), 'Box<Int> construction');
if (evaluate(boxSession, 'stringBox.value', 'Box<String> field').display !== 'Hallo') {
  throw new Error('Box<String> did not preserve its field type/value.');
}
if (evaluate(boxSession, 'intBox.identity(pass(intBox.value))', 'Box<Int> nested return').display !== '42') {
  throw new Error('Box<Int> or a generic return value lost its concrete type.');
}
if (evaluate(boxSession, 'stringBox.same(pass(stringBox.value))', 'generic member identity').display !== 'true') {
  throw new Error('A generic member call did not preserve the original object identity.');
}

// List is covariant, while MutableList remains invariant. Keep the positive
// and negative cases separate so a later rejected declaration cannot hide a
// regression in the positive case.
const listVarianceSession = api.bluekCreateKotliteSession();
load(listVarianceSession, `
    open class Entity
    class Coin : Entity()
    val coins: List<Coin> = listOf(Coin())
    val entities: List<Entity> = coins
`, 'List covariance');
if (evaluate(listVarianceSession, 'entities.size', 'List covariance').display !== '1') {
  throw new Error('List<Coin> could not be used as List<Entity>.');
}

const mutableVarianceSession = api.bluekCreateKotliteSession();
expectAnalysisError(json(mutableVarianceSession.load('<MutableList invariance>', `
    open class Entity
    class Coin : Entity()
    val coins: MutableList<Coin> = mutableListOf(Coin())
    val entities: MutableList<Entity> = coins
`)), 'MutableList invariance', 'MutableList<Entity>');

// Reified filterIsInstance is a native registered function in the separated
// generic-collections module. Source and target element types are independent.
const filterSession = api.bluekCreateKotliteSession();
load(filterSession, `
    open class Entity
    open class Coin : Entity()
    class GoldCoin : Coin()
    class Wall : Entity()
    inline fun <reified T : Entity> select(items: List<Entity>): List<T> {
        return items.filterIsInstance<T>()
    }
`, 'filterIsInstance');
const erasedFilterSession = api.bluekCreateKotliteSession();
expectAnalysisError(json(erasedFilterSession.load('<erased filter target>', `
    fun <T> invalid(items: List<Any>): List<T> = items.filterIsInstance<T>()
`)), 'non-reified filter target', 'erased');
const filterResult = evaluate(filterSession, `
    val coin = Coin()
    val gold = GoldCoin()
    val source: List<Entity> = listOf(Wall(), coin, gold, Wall())
    val selected = select<Coin>(source)
    selected.size == 2 && selected[0] === coin && selected[1] === gold
`, 'filterIsInstance order and identity');
if (filterResult.display !== 'true') {
  throw new Error('filterIsInstance did not preserve subclass matching, order, or identity.');
}
ok(evaluate(filterSession, 'val emptyEntities: List<Entity> = listOf(Wall()).filterIsInstance<Coin>()', 'empty source'), 'empty source');
if (evaluate(filterSession, 'select<Coin>(emptyEntities).size', 'empty reified filter').display !== '0') {
  throw new Error('filterIsInstance did not return an empty result for an empty source.');
}
expectAnalysisError(
  json(filterSession.evaluate('<invalid reified bound>', 'select<String>(emptyEntities)')),
  'reified bound',
  'out of upper bound',
);

const nullableFilter = evaluate(filterSession, `
    val nullableSource: List<Entity?> = listOf(Coin(), null, Wall())
    nullableSource.filterIsInstance<Entity?>().size == 3 &&
        nullableSource.filterIsInstance<Coin?>().size == 2 &&
        nullableSource.filterIsInstance<Wall>().size == 1
`, 'nullable reified filters');
if (nullableFilter.display !== 'true') {
  throw new Error('Nullable and non-matching filterIsInstance targets behaved incorrectly.');
}

// The original acceptance criterion specifically mentions MutableList.
if (evaluate(filterSession, `
    val mutable: MutableList<Entity> = mutableListOf(Coin(), Wall())
    mutable.filterIsInstance<Coin>().size
`, 'MutableList filterIsInstance').display !== '1') {
  throw new Error('filterIsInstance was not available for MutableList.');
}

// Parameter modifiers require an inline function; supported behavior is
// exercised in smoke-generics-boundaries.mjs.
const modifierSession = api.bluekCreateKotliteSession();
expectAnalysisError(json(modifierSession.load('<noinline>', `
    fun invalid(noinline predicate: (Any) -> Boolean): Boolean = predicate(1)
`)), 'noinline boundary');
expectAnalysisError(json(modifierSession.load('<crossinline>', `
    fun invalid(crossinline predicate: () -> Boolean): Boolean = predicate()
`)), 'crossinline boundary');

console.log('Generics smoke test passed.');
