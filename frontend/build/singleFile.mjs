import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function iife(entry, name, plugins) {
  const [result] = await build({
    configFile: false,
    root: repository,
    logLevel: 'warn',
    plugins,
    build: {
      write: false,
      minify: true,
      target: 'es2022',
      lib: { entry: path.join(repository, entry), name, formats: ['iife'], fileName: name },
    },
  });
  const chunks = result.output.filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || result.output.length !== 1)
    throw new Error(`${entry} must build to a single script, got ${result.output.map(item => item.fileName).join(', ')}.`);
  return chunks[0].code;
}

export function inlineScript(code) {
  // Inside <script>, only these sequences can end the element or change how
  // the HTML parser reads it; in minified code they occur in strings/regexes.
  const escaped = code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  if (/<\/script|<!--/i.test(escaped)) throw new Error('Script cannot be inlined safely.');
  return escaped;
}

