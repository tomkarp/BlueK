import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// PERF-06: interpreter throughput for typical school code (recursion, loops,
// method calls, lambdas, strings) and the compile time of a whole project.
// Each case runs several times in a fresh session; the median is compared
// with a generous limit so that only a clear slowdown fails, not a busy
// machine. `--report` only prints the numbers. BLUEK_BUNDLE selects another
// interpreter build, e.g. an older one for a before/after comparison.
vm.runInThisContext(await readFile(process.env.BLUEK_BUNDLE || 'frontend/public/kotlite/bluek-kotlite-browser.js', 'utf8'));
const api = globalThis['bluek-kotlite-browser'];
const reportOnly = process.argv.includes('--report');

const complete = start => new Promise((resolve, reject) => {
  const accept = raw => {
    const value = JSON.parse(raw);
    if (value.kind === 'error') reject(new Error(value.display ?? JSON.stringify(value.diagnostics))); else resolve(value);
  };
  const started = start(() => reject(new Error('Unexpected input')), accept);
  if (JSON.parse(started).kind === 'error') accept(started);
});

const files = {
  'Konto.kt': `class Konto(var stand: Int) {
    fun einzahlen(betrag: Int) { stand += betrag }
    fun istReich(): Boolean = stand > 1000
}`,
  'Punkt.kt': `data class Punkt(val x: Int, val y: Int) {
    operator fun plus(other: Punkt) = Punkt(x + other.x, y + other.y)
}`,
  'Bench.kt': `fun fib(n: Int): Int = if (n < 2) n else fib(n - 1) + fib(n - 2)

fun schleife(n: Int): Int {
    var summe = 0
    var i = 0
    while (i < n) {
        if (i % 3 == 0) summe += i else summe -= 1
        i += 1
    }
    for (k in 0 until n) summe += k % 7
    return summe
}

fun objekte(n: Int): Int {
    val konto = Konto(0)
    var punkt = Punkt(0, 0)
    repeat(n) {
        konto.einzahlen(it % 5)
        punkt = punkt + Punkt(1, 2)
    }
    return konto.stand + punkt.x + punkt.y + if (konto.istReich()) 1 else 0
}

fun lambdas(n: Int): Int {
    val zahlen = (1..n).toList()
    val gerade = zahlen.filter { it % 2 == 0 }.map { it * it }
    val gruppen = zahlen.groupBy { it % 10 }
    return gerade.sumOf { it % 100 } + gruppen.size + zahlen.count { it > n / 2 } + zahlen.sortedByDescending { it % 13 }.first()
}

// A lambda per iteration at the top level, where a lambda has no this.
fun lambdaObjekte(n: Int): Int {
    var summe = 0
    for (i in 1..n) {
        val rest = { i % 3 }
        summe += rest()
    }
    return summe
}

fun texte(n: Int): Int {
    val sb = StringBuilder()
    for (i in 1..n) sb.append("\${i % 10}")
    val wort = sb.toString()
    var vokale = 0
    for (c in wort) if (c == '1' || c == '5') vokale += 1
    return vokale + wort.length
}`,
};

// Medians on the quiet development Mac are 150-340 ms; the limits are about 1.6
// times that. A short burst of load is filtered by up to two more attempts, but the
// test needs a machine without other heavy work. It catches e.g. the lambda
// creation of e247b7b, which cost an exception each (1.65 times slower).
const cases = [
  { name: 'recursion fib(18)', call: 'fib(18)', expected: '2584', limitMs: 300 },
  { name: 'loops 20000', call: 'schleife(20000)', expected: '66709997', limitMs: 530 },
  { name: 'objects 3000', call: 'objekte(3000)', expected: '15001', limitMs: 360 },
  { name: 'lambdas 3000', call: 'lambdas(3000)', expected: '61522', limitMs: 420 },
  { name: 'lambda creation 10000', call: 'lambdaObjekte(10000)', expected: '10000', limitMs: 380 },
  { name: 'strings 3000', call: 'texte(3000)', expected: '3600', limitMs: 330 },
];
const runs = 5;
const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];

const evaluate = benchmark => async () => {
  const session = api.bluekCreateKotliteSession();
  await complete((input, done) => session.startLoadProject(Object.keys(files), Object.values(files), null, 1, input, done));
  const start = performance.now();
  const value = await complete((input, done) => session.startEvaluate('<PERF-06>', benchmark.call, input, done));
  const duration = performance.now() - start;
  if (value.display !== benchmark.expected) {
    throw new Error(`PERF-06 ${benchmark.name}: expected ${benchmark.expected}, got ${value.display}`);
  }
  return duration;
};

// Compile time of the Space Invaders template (parser and semantic analysis).
const project = JSON.parse(await readFile('frontend/public/examples/space-invaders.bluek.json', 'utf8'));
const compile = async () => {
  const session = api.bluekCreateKotliteSession();
  session.configureBluePlay(true, 'benchmark-compile');
  const start = performance.now();
  await complete((input, done) => session.startLoadProject(
    project.files.map(f => f.fileName), project.files.map(f => f.source), 'blueplay', 1, input, done));
  return performance.now() - start;
};

const measurements = [
  ...cases.map(benchmark => ({ name: benchmark.name, limitMs: benchmark.limitMs, measure: evaluate(benchmark) })),
  { name: 'compile Space Invaders', limitMs: 250, measure: compile },
];
const failures = [];
for (const { name, limitMs, measure } of measurements) {
  const medianOfRuns = async () => {
    const durations = [];
    for (let run = 0; run < runs; run++) durations.push(await measure());
    return median(durations);
  };
  // Further attempts filter out a short burst of load on the machine.
  let ms = await medianOfRuns();
  for (let attempt = 1; attempt < 3 && ms > limitMs; attempt++) ms = Math.min(ms, await medianOfRuns());
  console.log(`${name.padEnd(24)} ${ms.toFixed(1).padStart(8)} ms  (limit ${limitMs} ms)`);
  if (ms > limitMs) failures.push(`${name}: ${ms.toFixed(1)} ms > ${limitMs} ms`);
}
if (failures.length && !reportOnly) throw new Error(`PERF-06 interpreter slower than allowed:\n${failures.join('\n')}`);
console.log('Interpreter benchmark passed.');
