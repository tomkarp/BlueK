// Self-written Kotlin fixtures shared by bundle regression and official-compiler comparison.
const main = 'fun main() { println(Tier().istGluecklich()) }';
const tier = body => `class Tier {\n    var glueckslevel = 10\n\n    fun istGluecklich(): Boolean {\n${body}\n    }\n}`;
const returning = (id, body, expected = 'false', extras = '') => ({
  id, files: { 'Tier.kt': tier(body), 'Main.kt': extras + main }, query: 'Tier().istGluecklich()', expected,
});
const missing = (id, body, extras = '') => {
  const result = returning(id, body, null, extras);
  delete result.expected;
  result.diagnostic = { fileName: 'Tier.kt', line: result.files['Tier.kt'].split('\n').length - 1, column: 5, message: 'missing return statement.' };
  return result;
};
const condition = (id, declaration, expression, actual) => ({
  id, files: { 'Main.kt': `fun main() {\n    ${declaration}\n\n    if (${expression}) {\n        println("ja")\n    }\n}` },
  ...(actual ? { diagnostic: { fileName: 'Main.kt', line: 4, column: 9, message: `condition type mismatch: inferred type is '${actual}' but 'Boolean' was expected.` } } : { output: 'ja\n' }),
});
export const controlFlowCases = [
  missing('suspect-1-conditional-return', '        if (glueckslevel >= 20) {\n            return true\n        }'),
  missing('suspect-2-last-expression', '        glueckslevel >= 20'),
  condition('suspect-3-int-condition', 'val zahl = 1', 'zahl', 'Int'),
  condition('string-condition', 'val zahl = "one"', 'zahl', 'String'),
  condition('nullable-boolean-condition', 'val zahl: Boolean? = null', 'zahl', 'Boolean?'),
  condition('arithmetic-int-condition', 'val zahl = 1', 'zahl + 1', 'Int'),
  condition('null-condition', 'val zahl = 1', 'null', 'Nothing?'),
  condition('boolean-condition', 'val zahl = true', 'zahl'),
  condition('comparison-condition', 'val zahl = 1', 'zahl == 1'),
  condition('smart-cast-boolean-condition', 'val zahl: Boolean? = true; if (zahl == null) return', 'zahl'),
  returning('if-else-returns', '        if (glueckslevel >= 20) return true else return false'),
  returning('return-after-if', '        if (glueckslevel >= 20) return true\n        return false'),
  returning('explicit-return', '        return glueckslevel >= 20'),
  { id: 'expression-body', files: { 'Tier.kt': 'class Tier {\n    var glueckslevel = 10\n    fun istGluecklich(): Boolean = glueckslevel >= 20\n}', 'Main.kt': main }, query: 'Tier().istGluecklich()', expected: 'false' },
  returning('lambda-last-expression', '        val test: () -> Boolean = { glueckslevel >= 20 }\n        return test()'),
  returning('lambda-labeled-return', '        val test: () -> Boolean = mark@ { if (glueckslevel < 20) return@mark false; true }\n        return test()'),
  returning('nested-lambda-labeled-result', '        return run outer@ { run { return@outer false } }'),
  missing('nested-lambda-label-is-not-function-return', '        run outer@ { run { return@outer false } }'),
  returning('inline-nonlocal-return', '        run { return false }'),
  returning('nested-if-returns', '        if (glueckslevel > 0) {\n            if (glueckslevel >= 20) return true else return false\n        } else return false'),
  missing('nested-if-missing-path', '        if (glueckslevel > 0) {\n            if (glueckslevel >= 20) return true\n        } else return false'),
  returning('return-before-unreachable-unit', '        return false\n        println("unreachable")'),
  returning('return-before-unreachable-wrong-type', '        return false\n        "unreachable"'),
  missing('if-constant-true-needs-return', '        if (true) return true'),
  missing('if-else-values-do-not-return', '        if (glueckslevel >= 20) true else false'),
  missing('lambda-does-not-return-from-function', '        val test: () -> Boolean = { return@mark true }', ''),
  missing('inline-call-without-contract', '        once { return true }', 'inline fun once(action: () -> Unit) { action() }\n'),
  returning('throw-alternative', '        if (glueckslevel >= 20) throw IllegalStateException("unhappy")\n        return false'),
  returning('return-or-throw', '        if (glueckslevel < 20) return false else throw IllegalStateException("unhappy")'),
  returning('throw-only', '        throw IllegalStateException("unhappy")', null),
  returning('nothing-call', '        fail()', null, 'fun fail(): Nothing { throw IllegalStateException("unhappy") }\n'),
  returning('nothing-in-initializer', '        val unused = error("unhappy")', null),
  returning('nothing-in-typed-initializer', '        val unused: String = error("unhappy")', null),
  returning('nothing-in-argument', '        consume(error("unhappy"))', null, 'fun consume(value: Boolean) {}\n'),
  returning('nothing-in-condition', '        if (error("unhappy")) return true', null),
  returning('nothing-in-when-condition', '        when { error("unhappy") -> return true; else -> return false }', null),
  returning('nothing-in-template', '        val unused = "${error("unhappy")}"', null),
  returning('try-catch-returns', '        try { return glueckslevel >= 20 } catch (e: Exception) { return false }'),
  missing('try-catch-missing-path', '        try { return true } catch (e: Exception) { println("caught") }'),
  missing('caught-throw-does-not-terminate', '        try { throw IllegalStateException("x") } catch (e: Exception) { println("caught") }'),
  returning('finally-preserves-return', '        try { return false } finally { glueckslevel++ }'),
  returning('finally-return-overrides', '        try { return true } finally { return false }'),
  returning('finally-throw-overrides', '        try { return true } finally { throw IllegalStateException("unhappy") }', null),
  returning('finally-return-completes-path', '        try { glueckslevel++ } finally { return false }'),
  missing('finally-conditional-missing-path', '        try { glueckslevel++ } finally { if (glueckslevel >= 20) return true }'),
  returning('exhaustive-when-returns', '        when (glueckslevel >= 20) { true -> return true; false -> return false }'),
  returning('when-else-returns', '        when (glueckslevel) { 20 -> return true; else -> return false }'),
  missing('nonexhaustive-when', '        when (glueckslevel) { 20 -> return true }'),
  returning('nested-try-if-when', '        try {\n            if (glueckslevel > 0) { when (glueckslevel) { 20 -> return true; else -> return false } }\n            else throw IllegalStateException("unhappy")\n        } catch (e: IllegalStateException) { return false }'),
  missing('exhaustive-when-values-do-not-return', '        when (glueckslevel >= 20) { true -> true; false -> false }'),
  returning('while-true-return', '        while (true) { return false }'),
  returning('while-true-break-then-return', '        while (true) { break }\n        return false'),
  returning('while-unreachable-break', '        while (true) { return false; break }'),
  missing('while-conditional-missing-path', '        while (glueckslevel >= 20) { return true }'),
  missing('while-true-reachable-break', '        while (true) { if (glueckslevel < 20) break; return true }'),
  returning('nested-loop-break-stays-inner', '        while (true) { while (true) { break }; return false }'),
  missing('labeled-break-leaves-outer', '        outer@ while (true) { while (true) { break@outer } }'),
  returning('do-while-return', '        do { return false } while (false)'),
  missing('do-while-break-missing-path', '        do { break } while (true)'),
  returning('finally-return-overrides-break', '        while (true) { try { break } finally { return false } }'),
  missing('finally-break-overrides-return', '        while (true) { try { return true } finally { break } }'),
  missing('for-may-be-empty', '        for (x in listOf(1)) { return true }'),
  returning('for-followed-by-return', '        for (x in emptyList<Int>()) { return true }\n        return false'),
  missing('local-function-is-not-executed', '        fun nested(): Boolean { return true }'),
  { id: 'unit-block-ignores-last-expression', files: { 'Tier.kt': 'class Tier { fun f() { true } }', 'Main.kt': 'fun main() { Tier().f(); println("unit") }' }, output: 'unit\n' },
  { id: 'nullable-unit-needs-return', files: { 'Main.kt': 'fun test(): Unit? {\n}\nfun main() {}' }, diagnostic: { fileName: 'Main.kt', line: 2, column: 1, message: 'missing return statement.' } },
  { id: 'nullable-nothing-needs-return', files: { 'Main.kt': 'fun test(): Nothing? {\n    null\n}\nfun main() {}' }, diagnostic: { fileName: 'Main.kt', line: 3, column: 1, message: 'missing return statement.' } },
  { id: 'infinite-loop-no-return-needed', files: { 'Tier.kt': tier('        while (true) { continue }'), 'Main.kt': 'fun main() { println("compiled") }' }, output: 'compiled\n' },
  { id: 'infinite-do-loop-no-return-needed', files: { 'Tier.kt': tier('        do { continue } while (true)'), 'Main.kt': 'fun main() { println("compiled") }' }, output: 'compiled\n' },
  { id: 'return-in-condition', files: { 'Main.kt': 'fun test(): Int { if (return 7) println("unreachable") }\nfun main() { println(test()) }' }, output: '7\n' },
  { id: 'try-return-in-condition', files: { 'Main.kt': 'fun test(): Int { if (try { return 7 } finally {}) println("unreachable") }\nfun main() { println(test()) }' }, output: '7\n' },
];
export const projectFormatCase = {
  id: 'project-format-mixed-class-and-main',
  files: { 'Tier.kt': 'class Tier { fun istGluecklich(): Boolean = false }\nfun main() { println(Tier().istGluecklich()) }' },
  output: 'false\n',
};
// These cases deliberately throw during execution; use main to observe the
// same catchable exception in both implementations without comparing stacks.
for (const entry of controlFlowCases) {
  if (entry.query && entry.expected === null && !entry.diagnostic) {
    entry.files['Main.kt'] = entry.files['Main.kt'].replace(main, 'fun main() { try { println(Tier().istGluecklich()) } catch (e: IllegalStateException) { println(e.message) } }');
    delete entry.query;
    entry.output = 'unhappy\n';
  }
}
// A stored lambda's labeled return is local, never evidence of a caller return.
const storedLambda = controlFlowCases.find(c => c.id === 'lambda-does-not-return-from-function');
storedLambda.files['Tier.kt'] = storedLambda.files['Tier.kt'].replace('{ return@mark true }', 'mark@ { return@mark true }');
