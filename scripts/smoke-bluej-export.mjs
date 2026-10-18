import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { rolldown } from 'rolldown';

async function load(input) {
  const bundle = await rolldown({ input });
  const { output } = await bundle.generate({ format: 'esm' });
  await bundle.close();
  return import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
}
const { blueJProjectZip, blueJExportLimits } = await load('frontend/src/blueJExport.ts');
const { blueJProjectFromEntries } = await load('frontend/src/blueJImport.ts');

const decoder = new TextDecoder();
const unpack = zip => Object.fromEntries(Object.entries(unzipSync(zip)).map(([path, bytes]) => [path, bytes]));
const asEntries = files => Object.entries(files).map(([path, bytes]) => ({ path, bytes }));
const packageProperties = text => new Map(text.split('\n').filter(line => line.includes('=')).map(line => line.split(/=(.*)/s).slice(0, 2)));
const targetsOf = properties => Array.from({ length: Number(properties.get('package.numTargets')) }, (_, index) => {
  const key = `target${index + 1}`;
  return { name: properties.get(`${key}.name`), type: properties.get(`${key}.type`), x: Number(properties.get(`${key}.x`)), y: Number(properties.get(`${key}.y`)) };
});

// An ordinary project: Kotlin files, README and the class diagram; the test
// class stays behind because BlueJ has no kotlin.test.
{
  const project = {
    format: 'bluek-project', version: 1, readme: '# Dogs\n\nA small project.\n',
    files: [
      { fileName: 'Dog.kt', kind: 'class', source: 'class Dog {\n    var age = 0\n}\n' },
      { fileName: 'Main.kt', kind: 'functions', source: 'fun main() {\n    println(Dog().age)\n}\n' },
      { fileName: 'DogTest.kt', kind: 'class', source: 'import kotlin.test.*\n\nclass DogTest\n', testTarget: 'Dog.kt', isTestClass: true },
      { fileName: 'FreeTest.kt', kind: 'class', source: 'import kotlin.test.*\n\nclass FreeTest\n', isTestClass: true },
    ],
    cardPositions: { 'Dog.kt': { x: 100.4, y: 200 }, 'Main.kt': { x: 380, y: 40 }, 'DogTest.kt': { x: 130, y: 170 } },
  };
  assert.deepEqual(blueJExportLimits(project), { testClasses: ['DogTest', 'FreeTest'], mp3Sounds: [] });
  const files = unpack(blueJProjectZip(project, 'My Dogs'));
  assert.deepEqual(Object.keys(files).sort(), ['My Dogs/Dog.kt', 'My Dogs/Main.kt', 'My Dogs/README.TXT', 'My Dogs/package.bluej']);
  assert.equal(decoder.decode(files['My Dogs/Dog.kt']), project.files[0].source);
  assert.equal(decoder.decode(files['My Dogs/README.TXT']), project.readme);
  const properties = packageProperties(decoder.decode(files['My Dogs/package.bluej']));
  assert.equal(properties.get('project.charset'), 'UTF-8');
  assert.deepEqual(targetsOf(properties), [
    { name: 'Dog', type: 'ClassTarget', x: 100, y: 200 },
    { name: 'Main', type: 'KotlinFileTarget', x: 380, y: 40 },
  ]);
  const imported = blueJProjectFromEntries(asEntries(files));
  assert.equal(imported.library, undefined);
  assert.deepEqual(imported.files, [
    { fileName: 'Dog.kt', kind: 'class', source: project.files[0].source },
    { fileName: 'Main.kt', kind: 'functions', source: project.files[1].source },
  ]);
  assert.equal(imported.readme, project.readme);
  assert.deepEqual(imported.resources, []);
  assert.deepEqual(imported.cardPositions, { 'Dog.kt': { x: 100, y: 200 }, 'Main.kt': { x: 380, y: 40 } });
  const empty = unpack(blueJProjectZip({ ...project, readme: '  ', cardPositions: {} }, 'Plain'));
  assert.equal('Plain/README.TXT' in empty, false, 'An empty README is not exported.');
  const unplaced = targetsOf(packageProperties(decoder.decode(empty['Plain/package.bluej'])));
  assert.ok(unplaced.every(target => target.x >= 0 && target.y >= 0) && new Set(unplaced.map(target => `${target.x},${target.y}`)).size === 2, 'Cards without positions get separate places.');
}

// A BluePlay project: the BlueJ library replaces BlueK's built-in one, and
// every standard image and sound is included; project resources win.
{
  const example = JSON.parse(await readFile('frontend/public/examples/blueplay.bluek.json', 'utf8'));
  const customCat = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const music = 'data:audio/mpeg;base64,SUQzAwAAAAAAAA==';
  const project = {
    ...example,
    files: [...example.files, { fileName: 'FigureTest.kt', kind: 'class', source: 'import kotlin.test.*\n\nclass FigureTest\n', testTarget: 'Figure.kt', isTestClass: true }],
    resources: [...(example.resources ?? []), { path: 'images/cat.png', data: customCat }, { path: 'sounds/music.mp3', data: music }],
    cardPositions: { 'World.kt': { x: 300, y: 20 }, 'Figure.kt': { x: 600, y: 300 } },
  };
  assert.deepEqual(blueJExportLimits(example), { testClasses: [], mp3Sounds: [] }, 'The example needs no notice.');
  assert.deepEqual(blueJExportLimits(project), { testClasses: ['FigureTest'], mp3Sounds: ['music.mp3'] });
  const files = unpack(blueJProjectZip(project, 'Game'));
  const names = Object.keys(files);
  const library = ['Actor.kt', 'BluePlayFunctions.kt', 'Image.kt', 'World.kt'];
  for (const name of library)
    assert.equal(decoder.decode(files[`Game/${name}`]), await readFile(`assets/bluej-blueplay/${name}`, 'utf8'), `${name} is the BlueJ library source.`);
  assert.ok(decoder.decode(files['Game/BluePlayFunctions.kt']).includes('import javax.swing'), 'The exported library is the JVM version.');
  for (const file of example.files) assert.equal(decoder.decode(files[`Game/${file.fileName}`]), file.source);
  assert.equal('Game/FigureTest.kt' in files, false);
  const standardImages = (await readdir('assets/standard-images')).filter(name => name.endsWith('.png'));
  const standardSounds = (await readdir('assets/standard-sounds')).filter(name => name.endsWith('.wav'));
  assert.deepEqual(names.filter(name => name.startsWith('Game/images/')).map(name => name.slice(12)).sort(), [...new Set([...standardImages, ...(example.resources ?? []).map(resource => resource.path.slice(7))])].sort());
  assert.deepEqual(names.filter(name => name.startsWith('Game/sounds/')).map(name => name.slice(12)).sort(), [...standardSounds, 'music.mp3'].sort());
  assert.deepEqual(Buffer.from(files['Game/images/cat.png']), Buffer.from(customCat.split(',')[1], 'base64'), 'A project image replaces the standard image.');
  assert.deepEqual(Buffer.from(files['Game/images/dog.png']), await readFile('assets/standard-images/dog.png'));
  assert.deepEqual(Buffer.from(files['Game/sounds/explosion.wav']), await readFile('assets/standard-sounds/explosion.wav'));
  const targets = targetsOf(packageProperties(decoder.decode(files['Game/package.bluej'])));
  assert.deepEqual(targets.map(target => [target.name, target.type]), [
    ['BluePlayFunctions', 'KotlinFileTarget'], ['World', 'ClassTarget'], ['Actor', 'ClassTarget'], ['Image', 'ClassTarget'],
    ...example.files.map(file => [file.fileName.slice(0, -3), file.kind === 'functions' ? 'KotlinFileTarget' : 'ClassTarget']),
  ]);
  assert.deepEqual(targets.find(target => target.name === 'World'), { name: 'World', type: 'ClassTarget', x: 300, y: 20 });
  assert.deepEqual(targets.find(target => target.name === 'Figure'), { name: 'Figure', type: 'ClassTarget', x: 600, y: 300 });

  // Importing the export again restores the BluePlay project; unchanged
  // standard media stay standard resources instead of becoming project files.
  const imported = blueJProjectFromEntries(asEntries(files));
  assert.deepEqual(imported.library, { id: 'blueplay', version: 1 });
  assert.deepEqual(imported.files.map(file => file.fileName), example.files.map(file => file.fileName).sort());
  for (const file of imported.files) assert.equal(file.source, example.files.find(candidate => candidate.fileName === file.fileName).source);
  const standardData = new Map(await Promise.all([...standardImages.map(name => ['images/' + name, `assets/standard-images/${name}`]), ...standardSounds.map(name => ['sounds/' + name, `assets/standard-sounds/${name}`])]
    .map(async ([path, file]) => [path, (await readFile(file)).toString('base64')])));
  const expected = project.resources.filter(resource => standardData.get(resource.path) !== resource.data.split(',')[1]).map(resource => resource.path).sort();
  assert.deepEqual(imported.resources.map(resource => resource.path).sort(), expected);
  assert.ok(expected.includes('images/cat.png') && expected.includes('sounds/music.mp3'));
  assert.equal(imported.resources.find(resource => resource.path === 'images/cat.png').data, customCat);
  assert.deepEqual(imported.cardPositions['Figure.kt'], { x: 600, y: 300 });
}

console.log('BlueJ export passed: Kotlin files, README.TXT, package.bluej targets and positions, BlueJ BluePlay library, all standard images/sounds with project overrides, omitted test classes, notice lists for test classes/MP3 and import round trips.');
