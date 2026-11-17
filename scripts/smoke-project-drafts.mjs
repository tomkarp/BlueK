import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
const bundle = await rolldown({ input: 'frontend/src/projectDraftStorage.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { ProjectDraftStorage, DRAFT_PREFIX, TAB_DRAFT_KEY } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

class MemoryStorage {
  entries = new Map(); failure = null;
  get length() { return this.entries.size; }
  key(i) { return [...this.entries.keys()][i] ?? null; }
  getItem(key) { return this.entries.get(key) ?? null; }
  setItem(key, value) { if (this.failure) throw this.failure; this.entries.set(key, value); }
  removeItem(key) { this.entries.delete(key); }
}
function harness() {
  const local = new MemoryStorage(), owned = new Set();
  let serial = 0, now = 100;
  const locks = {
    async request(name, _options, callback) {
      if (owned.has(name)) return callback(null);
      owned.add(name);
      try { return await callback({ name }); }
      finally { owned.delete(name); }
    },
  };
  const make = (session = new MemoryStorage(), lockManager = locks) => ({
    session,
    store: new ProjectDraftStorage({
      local: () => local, session: () => session, locks: () => lockManager,
      newId: () => 'draft-' + ++serial, now: () => ++now,
    }),
  });
  const record = id => JSON.parse(local.getItem(DRAFT_PREFIX + id) || 'null');
  const records = () => [...local.entries.keys()].filter(key => key.startsWith(DRAFT_PREFIX));
  return { local, make, record, records };
}
const payload = { format: 'bluek-project', version: 1, projectName: 'Dogs', files: [{ fileName: 'Hund.kt', source: 'class Hund' }] };
const settle = () => new Promise(resolve => setImmediate(resolve));

// Live tabs keep independent copies; reload reuses the tab ID and timestamp.
{
  const { local, make, record, records } = harness();
  const first = make();
  await first.store.start();
  first.store.save({ format: 'bluek-project', version: 1, files: [] });
  assert.equal(records().length, 0, 'An untouched empty IDE is not a saved project');
  first.store.save(payload);
  const originalId = first.store.activeId;
  assert.equal(first.session.getItem(TAB_DRAFT_KEY), originalId);
  const savedAt = record(originalId).updatedAt;
  first.store.save(payload);
  assert.equal(record(originalId).updatedAt, savedAt, 'Unchanged data does not rewrite the timestamp');

  const cloneSession = new MemoryStorage();
  cloneSession.setItem(TAB_DRAFT_KEY, originalId);
  const duplicate = make(cloneSession);
  assert.equal((await duplicate.store.restore()).projectName, 'Dogs');
  assert.notEqual(duplicate.store.activeId, originalId, 'Copied sessions fork a live draft');
  duplicate.store.save({ ...payload, projectName: 'Duplicate' });
  assert.equal(records().length, 2);
  assert.equal(record(originalId).project.projectName, 'Dogs');

  const fresh = make();
  assert.equal(await fresh.store.restore(), null, 'A new tab does not take over another live tab');
  fresh.store.release();
  first.store.release();
  await settle();
  const reload = make(first.session);
  const restored = await reload.store.restore();
  assert.equal(restored.files[0].source, 'class Hund');
  assert.equal(reload.store.activeId, originalId, 'Reload keeps its tab ID');
  reload.store.save(restored);
  assert.equal(record(originalId).updatedAt, savedAt, 'Normalization does not rewrite unchanged restored data');
  reload.store.save({ ...payload, files: [] });
  assert.equal(record(originalId).project.files.length, 0, 'Deleting all files persists');
  local.setItem(DRAFT_PREFIX + 'broken', '{');
  await assert.rejects(() => reload.store.open('missing'), /no longer/);
  duplicate.store.release(); reload.store.release();
}

// Crash recovery picks the newest abandoned copy and removes older/corrupt ones.
{
  const { local, make, records } = harness();
  const first = make(), second = make();
  await first.store.start(); first.store.save(payload);
  await second.store.start(); second.store.save({ ...payload, projectName: 'Latest' });
  local.setItem(DRAFT_PREFIX + 'broken', '{');
  first.store.release(); second.store.release();
  await settle();
  const fresh = make();
  assert.equal((await fresh.store.restore()).projectName, 'Latest');
  assert.equal(fresh.store.activeId, second.store.activeId);
  assert.deepEqual(records(), [DRAFT_PREFIX + second.store.activeId], 'Only the recovered draft remains');
  fresh.store.release();
}

// Without Web Locks, normal reload recovery still uses the original session ID.
{
  const { local, make, record, records } = harness();
  const first = make(new MemoryStorage(), null);
  await first.store.start(); first.store.save(payload);
  const reload = make(first.session, null);
  assert.equal((await reload.store.restore()).projectName, 'Dogs');
  assert.equal(reload.store.activeId, first.store.activeId);
  const blockedSession = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const noSession = make(blockedSession, null);
  assert.equal((await noSession.store.restore()).projectName, 'Dogs', 'Missing session storage still permits crash recovery');
  noSession.store.save({ ...payload, projectName: 'Still editable' });
  assert.equal(record(noSession.store.activeId).project.projectName, 'Still editable');
  local.setItem('bluek.settings', 'keep');
  noSession.store.clearActive();
  assert.equal(records().length, 0);
  assert.equal(local.getItem('bluek.settings'), 'keep');
  reload.store.save(payload);
  reload.store.clearActive();
  assert.equal(reload.session.getItem(TAB_DRAFT_KEY), null, 'Explicit clearing releases the session pointer');
}

// Migration and storage failures preserve recoverable data and report their cause.
{
  const { local, make, records } = harness();
  const { store } = make();
  const legacy = JSON.stringify(payload);
  local.setItem('bluek.current-project.v1', legacy);
  local.failure = new DOMException('Storage full', 'QuotaExceededError');
  store.migrateLegacy();
  assert.equal(local.getItem('bluek.current-project.v1'), legacy, 'Failed migration preserves legacy data');
  local.failure = null;
  store.migrateLegacy();
  assert.equal(local.getItem('bluek.current-project.v1'), null);
  assert.equal(records().length, 1);
  assert.equal((await store.restore()).projectName, 'Dogs');
  local.failure = new DOMException('Storage full', 'QuotaExceededError');
  assert.throws(() => store.save({ ...payload, projectName: 'Unsaved' }), /Storage full/);
  assert.deepEqual(store.failure(local.failure, payload), { reason: 'quota', projectChars: JSON.stringify(payload).length });
  assert.deepEqual(store.failure(new DOMException('Blocked', 'SecurityError'), payload), { reason: 'blocked' });
  assert.deepEqual(store.failure(new TypeError('Disk unavailable'), payload), { reason: 'unknown', detail: 'TypeError: Disk unavailable' });
  store.release();
}

// Returning from the back/forward cache retains ownership or forks a busy draft.
{
  const { make, record } = harness();
  const cached = make();
  await cached.store.start(); cached.store.save(payload);
  const cachedId = cached.store.activeId, timestamp = record(cachedId).updatedAt;
  cached.store.release();
  await cached.store.reclaim();
  cached.store.save(payload);
  assert.equal(record(cachedId).updatedAt, timestamp, 'Unchanged bfcache return keeps its timestamp');
  cached.store.release();
  await settle();
  const elsewhere = make();
  await elsewhere.store.open(cachedId);
  elsewhere.store.save({ ...payload, projectName: 'Edited elsewhere' });
  await cached.store.reclaim();
  assert.notEqual(cached.store.activeId, cachedId);
  cached.store.save(payload);
  assert.equal(record(cachedId).project.projectName, 'Edited elsewhere');
  assert.equal(record(cached.store.activeId).project.projectName, 'Dogs', 'A fork persists cached work without another edit');
  cached.store.release(); elsewhere.store.release();
}
console.log('Project drafts passed: current tab recovery, duplicate forks, abandoned-copy cleanup, stable timestamps, empty projects, missing storage/locks, migration, storage failures and bfcache reclaim.');
