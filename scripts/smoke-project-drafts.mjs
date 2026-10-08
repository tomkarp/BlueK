import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
const bundle = await rolldown({ input: 'frontend/src/projectDraftStorage.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { ProjectDraftStorage, DRAFT_PREFIX, TAB_DRAFT_KEY } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
class MemoryStorage {
  entries = new Map(); fail = false;
  get length() { return this.entries.size; }
  key(i) { return [...this.entries.keys()][i] ?? null; }
  getItem(key) { return this.entries.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw new Error('quota'); this.entries.set(key, value); }
  removeItem(key) { this.entries.delete(key); }
}
const local = new MemoryStorage();
const owned = new Set();
const locks = {
  async request(name, _options, callback) {
    if (owned.has(name)) return callback(null);
    owned.add(name);
    try { return await callback({ name }); }
    finally { owned.delete(name); }
  },
};
let serial = 0, now = 100;
const make = (session = new MemoryStorage(), lockManager = locks) => ({ session, store: new ProjectDraftStorage({
  local: () => local, session: () => session, locks: () => lockManager,
  newId: () => 'draft-' + ++serial, now: () => ++now,
}) });
const payload = { format: 'bluek-project', version: 1, projectName: 'Dogs', files: [{ fileName: 'Hund.kt', source: 'class Hund' }] };
const first = make();
await first.store.start();
first.store.save({ format: 'bluek-project', version: 1, files: [] });
assert.equal(local.length, 0, 'An untouched empty IDE is not a saved project');
first.store.save(payload);
const originalId = first.session.getItem(TAB_DRAFT_KEY);
const savedAt = first.store.list()[0].updatedAt;
first.store.save(payload);
assert.equal(first.store.list()[0].updatedAt, savedAt, 'Unchanged data does not rewrite the timestamp');
const cloneSession = new MemoryStorage();
cloneSession.setItem(TAB_DRAFT_KEY, originalId);
const duplicate = make(cloneSession);
assert.equal((await duplicate.store.restore()).projectName, 'Dogs');
assert.notEqual(duplicate.session.getItem(TAB_DRAFT_KEY), originalId);
duplicate.store.save({ ...payload, projectName: 'Duplicate' });
assert.equal(first.store.list().length, 2);
assert.equal(first.store.list()[0].name, 'Duplicate');
first.store.release();
await new Promise(resolve => setImmediate(resolve));
const reload = make(first.session);
assert.equal((await reload.store.restore()).files[0].source, 'class Hund');
assert.equal(reload.session.getItem(TAB_DRAFT_KEY), originalId, 'Unowned restored draft keeps its ID');
const restoredTimestamp = reload.store.list().find(draft => draft.id === originalId).updatedAt;
reload.store.save(payload);
assert.equal(reload.store.list().find(draft => draft.id === originalId).updatedAt, restoredTimestamp, 'Parsing and reserializing an unchanged restored project does not update its timestamp');
reload.store.save({ ...payload, files: [] });
assert.equal(JSON.parse(local.getItem(DRAFT_PREFIX + originalId)).project.files.length, 0, 'Deleting all files persists');
local.setItem(DRAFT_PREFIX + 'broken', '{');
assert.equal(reload.store.list().length, 2, 'Corrupt drafts do not hide good drafts');
await assert.rejects(() => reload.store.open('missing'), /no longer/);
const legacy = JSON.stringify(payload);
local.setItem('bluek.current-project.v1', legacy);
local.fail = true;
reload.store.migrateLegacy();
assert.equal(local.getItem('bluek.current-project.v1'), legacy, 'Failed migration preserves legacy data');
assert.throws(() => reload.store.save({ ...payload, projectName: 'Unsaved' }), /quota/);
local.fail = false;
reload.store.migrateLegacy();
assert.equal(local.getItem('bluek.current-project.v1'), null);
assert.equal(reload.store.list().length, 3);
const noLocks = make(first.session, undefined);
// Explicitly unavailable locks must fork to preserve independent tabs.
noLocks.store = new ProjectDraftStorage({ local: () => local, session: () => noLocks.session,
  locks: () => undefined, newId: () => 'draft-' + ++serial, now: () => ++now });
await noLocks.store.restore();
assert.notEqual(noLocks.session.getItem(TAB_DRAFT_KEY), originalId);
const noSession = new ProjectDraftStorage({ local: () => local, session: () => { throw new Error('blocked'); },
  locks: () => undefined, newId: () => 'draft-' + ++serial, now: () => ++now });
await noSession.restore();
noSession.save(payload);
assert.equal(noSession.sessionAvailable, false);
first.store.release(); duplicate.store.release(); reload.store.release(); noLocks.store.release();
local.setItem('bluek.settings', 'keep');
reload.store.deleteAll();
assert.equal(reload.store.list().length, 0);
assert.equal(local.getItem('bluek.settings'), 'keep');
noSession.save(payload);
assert.equal(reload.store.list().length, 0, 'Closing unchanged deleted projects does not resurrect them');
noSession.save({ ...payload, projectName: 'Edited again' });
assert.equal(reload.store.list().length, 1, 'Further editing autosaves an open project again');
const cached = make();
await cached.store.start();
cached.store.save(payload);
const cachedId = cached.session.getItem(TAB_DRAFT_KEY);
const cachedTimestamp = cached.store.list().find(draft => draft.id === cachedId).updatedAt;
cached.store.release();
await cached.store.reclaim();
cached.store.save(payload);
assert.equal(cached.store.list().find(draft => draft.id === cachedId).updatedAt, cachedTimestamp, 'Returning from the back/forward cache keeps an unchanged timestamp');
cached.store.delete(cachedId);
cached.store.release();
await cached.store.reclaim();
cached.store.save(payload);
assert.equal(local.getItem(DRAFT_PREFIX + cachedId), null, 'Returning from the back/forward cache does not resurrect an unchanged deleted draft');
cached.store.save({ ...payload, projectName: 'Changed after returning' });
assert.equal(cached.store.list().find(draft => draft.id === cachedId).name, 'Changed after returning');
cached.store.release();
await new Promise(resolve => setImmediate(resolve));
const reclaimedElsewhere = make();
await reclaimedElsewhere.store.open(cachedId);
reclaimedElsewhere.store.save({ ...payload, projectName: 'Edited in another tab' });
await cached.store.reclaim();
assert.notEqual(cached.session.getItem(TAB_DRAFT_KEY), cachedId, 'A cached page forks if another tab owns its former draft');
cached.store.save({ ...payload, projectName: 'Changed after returning' });
assert.equal(cached.store.list().find(draft => draft.id === cachedId).name, 'Edited in another tab', 'A cached page cannot overwrite the other tab');
assert.equal(cached.store.list().find(draft => draft.id === cached.session.getItem(TAB_DRAFT_KEY)).name, 'Changed after returning', 'The fork persists the cached project even without another edit');
cached.store.release();
reclaimedElsewhere.store.release();
console.log('Project drafts passed: tab ownership, duplicate forks, unchanged timestamps, empty IDE, deletion, migration failures, corruption, quota, unavailable storage and locks.');
