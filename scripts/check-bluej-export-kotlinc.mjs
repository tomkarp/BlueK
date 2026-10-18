// Optional check (needs `kotlinc` on PATH): exports every bundled example
// project for BlueJ and compiles the exported folder with the Kotlin/JVM
// compiler, as BlueJ would. BluePlay examples compile against the BlueJ
// version of the library.
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'frontend/src/blueJExport.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { blueJProjectZip } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

const examples = (await readdir('frontend/public/examples')).filter(name => name.endsWith('.bluek.json')).sort();
const root = await mkdtemp(path.join(tmpdir(), 'bluek-bluej-export-'));
try {
  for (const example of examples) {
    const project = JSON.parse(await readFile(path.join('frontend/public/examples', example), 'utf8'));
    for (const [name, bytes] of Object.entries(unzipSync(blueJProjectZip(project, example.replace('.bluek.json', ''))))) {
      await mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await writeFile(path.join(root, name), bytes);
    }
    const folder = path.join(root, example.replace('.bluek.json', ''));
    const sources = (await readdir(folder)).filter(name => name.endsWith('.kt')).map(name => path.join(folder, name));
    execFileSync('kotlinc', [...sources, '-nowarn', '-d', path.join(folder, 'classes')], { stdio: ['ignore', 'inherit', 'inherit'] });
    console.log(`${example}: ${sources.length} Kotlin files compiled${project.library?.id === 'blueplay' ? ' with the BlueJ BluePlay library' : ''}.`);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
