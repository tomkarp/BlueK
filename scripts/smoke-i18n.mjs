import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {rolldown} from 'rolldown';
const directory = new URL('../frontend/src/i18n/', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file, directory), 'utf8'));
function flatten(value, prefix = '', result = {}) {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === 'string') result[path] = entry;
    else flatten(entry, path, result);
  }
  return result;
}
const groups = ['ui', 'help', 'blueplay'];
const catalog = locale => Object.fromEntries(groups.flatMap(group => Object.entries(flatten(read(`${locale}/${group}.json`), group))));
const en = catalog('en');
const placeholders = text => [...text.matchAll(/\{\d+\}|\$/g)].map(match => match[0]).sort();
const locales = readdirSync(directory, {withFileTypes:true}).filter(entry => entry.isDirectory()).map(entry => entry.name);
for (const locale of locales) {
  const messages = catalog(locale);
  assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort(), `${locale}: catalog keys must match`);
  for (const [key, value] of Object.entries(en)) {
    assert.ok(messages[key].trim(), `${locale}: empty translation: ${key}`);
    assert.deepEqual(placeholders(messages[key]), placeholders(value), `${locale}: placeholder mismatch: ${key}`);
  }
  assert.equal(messages['ui.sidebar.runAllTests'], locale === 'de' ? 'Alles testen' : 'Run All Tests');
  assert.ok(!Object.values(messages).includes('Offene Klasse'));
  assert.ok(!Object.values(messages).includes('Datenklasse'));
}
const bundle = await rolldown({input:new URL('../frontend/src/i18n/catalog.ts',import.meta.url).pathname});
const {output} = await bundle.generate({format:'esm'});
const {richText, browserLocale} = await import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`);
assert.equal(richText('<strong>Test</strong> <code>val</code>'), '<strong>Test</strong> <code>val</code>');
assert.equal(richText('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
assert.equal(richText('<a href="https://example.com">link</a>'), '&lt;a href="https://example.com"&gt;link</a>');
assert.equal(browserLocale('de-DE'), 'de');
assert.equal(browserLocale('de-AT'), 'de');
assert.equal(browserLocale('en-GB'), 'en');
assert.equal(browserLocale('fr-FR'), 'en');
for (const key of ['openClass', 'abstractClass', 'dataClass']) assert.equal(catalog('de')[`ui.files.${key}`], en[`ui.files.${key}`]);
await bundle.close();
console.log(`i18n: ${Object.keys(en).length} messages in ${locales.join(', ')}; keys, placeholders and rich-text handling match`);
