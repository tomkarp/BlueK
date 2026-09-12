import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundle = await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8');
vm.runInThisContext(bundle, { filename: 'bluek-kotlite-browser.js' });
const api = globalThis['bluek-kotlite-browser'];
const session = api.bluekCreateKotliteSession();
const files = ['Image.kt', 'Actor.kt', 'World.kt', 'BluePlayFunctions.kt', 'Figure.kt', 'MyWorld.kt', 'Main.kt'];
const sources = await Promise.all(files.map(file => readFile(new URL(`../examples/blueplay/${file}`, import.meta.url), 'utf8')));
const expectOk = (json, label) => {
  if (json.kind === 'error') throw new Error(`${label}: ${json.display}`);
  return json;
};
const evaluate = (source, label) => expectOk(JSON.parse(session.evaluate('<BluePlay smoke>', source)), label);

expectOk(JSON.parse(session.load('<BluePlay project>', sources.join('\n\n'))), 'project load');
evaluate('main()', 'main');
const initialStage = JSON.parse(session.takeStage());
if (initialStage.stage.objects[0].x !== 100) throw new Error('BluePlay actor was not placed by main().');
if (evaluate('val initializedWorld = MyWorld(); initializedWorld.initialized', 'init block').display !== 'true') throw new Error('MyWorld init block did not run.');
evaluate('step()', 'first step');
const movedStage = JSON.parse(session.takeStage());
if (movedStage.stage.objects[0].x !== 101) throw new Error('Actor act() did not update its position.');
evaluate('start()', 'start');
const runningStage = JSON.parse(session.takeStage());
if (runningStage.stage.running !== true) throw new Error('BluePlay start() did not set running state.');
evaluate('stop()', 'stop');
const stoppedStage = JSON.parse(session.takeStage());
if (stoppedStage.stage.running !== false) throw new Error('BluePlay stop() did not clear running state.');
evaluate('val clickedActor = Figure(); val clickedWorld = MyWorld(); clickedWorld.addObject(clickedActor, 7, 9)', 'click setup');
expectOk(JSON.parse(session.setClick(7, 9)), 'actor click');
if (evaluate('clickedActor.isClicked', 'actor click query').display !== 'true') throw new Error('BluePlay actor click was not delivered to the student object.');
expectOk(JSON.parse(session.setClick(12, 13)), 'world click');
if (evaluate('clickedWorld.isClicked', 'world click query').display !== 'true') throw new Error('BluePlay world click was not delivered to the student object.');

console.log('BluePlay browser smoke test passed.');
