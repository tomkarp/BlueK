import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = await mkdtemp(join(tmpdir(), 'bluek-cloud-test-'));
const databasePath = join(directory, 'projects.sqlite');
const port = 18787;
const base = `http://127.0.0.1:${port}`;
const origin = 'https://bluek.online';
const project = { format: 'bluek-project', version: 1, projectName: 'Private', files: [{ fileName: 'Main.kt', kind: 'functions', source: 'fun main() { println("Hello") }' }] };
const media = [{ path: 'images/standard.png', data: 'data:image/png;base64,AAAA' }];
const legacy = { ...project, resources: media };
let db = new Database(databasePath);
db.exec('CREATE TABLE projects (code TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, size_bytes INTEGER NOT NULL, project_json TEXT NOT NULL)');
const legacyExpiry = new Date(Date.now() + 29 * 86400000).toISOString();
db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?)').run('green-lamp-river', new Date().toISOString(), legacyExpiry, 100, JSON.stringify(legacy));
db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?)').run('past-past-past', '2020', '2020-01-01', 100, JSON.stringify(legacy));
db.close();
const env = { ...process.env, BLUEK_SHARE_PORT: String(port), BLUEK_SHARE_DB: databasePath, BLUEK_COOKIE_SECURE: '0', BLUEK_FEEDBACK_TOKEN: '', BLUEK_FEEDBACK_TOKEN_FILE: '' };
let child;
async function start() {
  child = spawn(process.execPath, ['server/share-server.mjs'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    if (child.exitCode !== null) throw new Error('API exited during startup.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('API did not start.');
}
async function stop() { if (child && child.exitCode === null) { const closed = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await closed; } }
async function request(path, { method = 'GET', value, cookie, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { Origin: origin, 'content-type': 'application/json', 'x-bluek-request': '1', ...(cookie ? { cookie } : {}), ...headers }, ...(value !== undefined ? { body: JSON.stringify(value) } : {}) });
  return { response, status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const post = (path, value, cookie) => request(path, { method: 'POST', value, cookie });
const readProject = code => request(`/api/projects/${code}`);
const readProgram = code => request(`/api/programs/${code}`);
function admin(...args) {
  const result = spawnSync(process.execPath, ['server/admin.mjs', ...args], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
try {
  await start(); db = new Database(databasePath);
  // Additive migration: old payload, including old media, and deadline survive.
  assert.deepEqual((await readProject('GREEN-LAMP-RIVER')).data.project, legacy);
  assert.equal((await readProject('green-lamp-river')).data.expiresAt, legacyExpiry);
  assert.equal((await readProject('past-past-past')).status, 410);
  assert.ok(db.prepare('SELECT code FROM public_codes WHERE code = ?').get('past-past-past'));
  assert.equal((await readProject('bad')).status, 400);
  assert.equal((await readProject('aaaa-bbbb-cccc')).status, 404);

  const anonymous = await post('/api/projects', project);
  assert.equal(anonymous.status, 201);
  assert.match(anonymous.data.code, /^[23456789a-hjkmnp-z]{12}$/);
  assert.ok(Math.abs(Date.parse(anonymous.data.expiresAt) - Date.now() - 7 * 86400000) < 5000);
  assert.deepEqual((await readProject(anonymous.data.code)).data.project, project);
  assert.equal((await readProgram(anonymous.data.code)).status, 409);
  assert.equal((await request(`/api/projects/${anonymous.data.code}`, { method: 'DELETE' })).status, 404, 'No anonymous withdrawal endpoint');
  assert.deepEqual(Object.keys(anonymous.data).sort(), ['code', 'expiresAt']);
  const program = { format: 'bluek-program', version: 1, mainFile: 'Main.kt', blueKUrl: 'https://bluek.online/', project, allowBlueK: false, allowDownload: false, autoRun: true, showProjectName: false, showControls: false, showSpeed: false };
  const playable = await post('/api/programs', program);
  assert.equal(playable.status, 201);
  assert.deepEqual((await readProgram(playable.data.code)).data.program, program);
  assert.equal((await readProject(playable.data.code)).status, 403);

  // Every public ingress enforces the closed media schema, including nested programs.
  for (const payload of [
    { ...project, resources: media },
    { ...project, resources: [{ path: 'images/bluej.png', data: 'data:image/png;base64,ZmFrZQ==' }] },
    { ...project, images: media }, { ...project, sounds: ['https://example.org/a.wav'] },
    { ...project, library: { id: 'blueplay', version: 1, resources: media } },
    { ...project, resources: [{ path: 'images/x.png', data: 'https://example.org/x.png' }] },
    { ...project, files: [{ ...project.files[0], resources: media }] },
  ]) {
    assert.ok([400, 422].includes((await post('/api/projects', payload)).status));
    assert.ok([400, 422].includes((await post('/api/programs', { ...program, project: payload })).status));
  }
  // Direct API copies of real standards are content-verified and referenced.
  const apple = { path: 'images/apple.png', data: 'data:image/png;base64,' + (await readFile('assets/standard-images/apple.png')).toString('base64') };
  const standardProject = { ...project, library: { id: 'blueplay', version: 1 }, resources: [apple] };
  const standardSaved = await post('/api/projects', standardProject);
  assert.equal(standardSaved.status, 201);
  assert.deepEqual((await readProject(standardSaved.data.code)).data.project.resources, []);
  const standardProgram = await post('/api/programs', { ...program, project: standardProject });
  assert.equal(standardProgram.status, 201);
  assert.deepEqual((await readProgram(standardProgram.data.code)).data.program.project.resources, []);
  assert.equal(standardProject.resources[0].data, apple.data, 'Published normalization leaves input intact');
  for (let index = 0; index < 15; index++) assert.equal((await post('/api/projects', project)).status, 201, 'No publication-frequency limit on a shared school IP');
  const mediaError = await post('/api/projects', { ...project, resources: media });
  assert.deepEqual(mediaError.data.resources, ['images/standard.png']);
  assert.equal((await post('/api/programs', { ...program, resources: media })).status, 400);
  const unicode = { ...project, readme: '😀'.repeat(270000) };
  assert.equal((await post('/api/projects', unicode)).status, 413, 'UTF-8 bytes, not UTF-16 length');
  assert.equal((await post('/api/programs', { ...program, project: unicode })).status, 413);

  // Actual authentication and account isolation, without trusting frontend checks.
  assert.equal((await request('/api/private-projects')).status, 401);
  const credentials = { username: 'student_one', password: 'a-unique-test-password' };
  const register = await post('/api/account/register', credentials);
  assert.equal(register.status, 200);
  const cookie = register.cookie;
  assert.ok(cookie);
  assert.match(register.response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(register.response.headers.get('set-cookie'), /SameSite=Lax/);
  const stored = db.prepare('SELECT * FROM accounts WHERE username = ?').get(credentials.username);
  assert.match(stored.password_hash, /^scrypt-v1:/);
  assert.ok(!stored.password_hash.includes(credentials.password));
  assert.ok(!db.prepare('SELECT token_hash FROM sessions').all().some(row => cookie.includes(row.token_hash)));
  assert.equal((await post('/api/account/register', credentials)).status, 409);
  assert.equal((await post('/api/account/register', { username: 'short', password: 'tiny' })).status, 400);
  assert.equal((await post('/api/account/register', { username: 'nine_chars', password: '123456789' })).status, 400, 'Nine-character passwords are rejected');
  assert.equal((await post('/api/account/register', { username: 'ten_chars', password: '1234567890' })).status, 200, 'Ten-character passwords are accepted');
  const second = await post('/api/account/register', { username: 'student.two', password: 'another-unique-password' });
  assert.equal(second.status, 200, 'Usernames may contain periods');
  const renameAccount = await post('/api/account/register', { username: 'rename_user', password: 'a-unique-test-password' });
  const renameProject = await post('/api/private-projects', project, renameAccount.cookie);
  const takenUsername = await request('/api/account/username', {
    method: 'POST', cookie: renameAccount.cookie,
    value: { password: 'a-unique-test-password', newUsername: 'STUDENT.TWO' },
  });
  assert.equal(takenUsername.status, 409, 'Username changes reject a case-insensitive collision');
  const usernameChanged = await request('/api/account/username', {
    method: 'POST', cookie: renameAccount.cookie,
    value: { password: 'a-unique-test-password', newUsername: 'Renamed.User' },
  });
  assert.equal(usernameChanged.status, 200);
  assert.deepEqual(usernameChanged.data.user, { id: renameAccount.data.user.id, username: 'renamed.user' });
  assert.deepEqual((await request('/api/account', { cookie: renameAccount.cookie })).data.user, usernameChanged.data.user, 'Rename preserves the current session');
  assert.equal((await request('/api/private-projects', { cookie: renameAccount.cookie })).data.projects[0].id, renameProject.data.id, 'Rename preserves account projects');
  assert.equal((await post('/api/account/login', { username: 'RENAMED.USER', password: 'a-unique-test-password' })).data.user.username, 'renamed.user', 'Sign-in normalizes case after rename');
  const wrongCurrentPassword = await request('/api/account/username', {
    method: 'POST', cookie: renameAccount.cookie,
    value: { password: 'wrong-current-password', newUsername: 'another.name' },
  });
  assert.equal(wrongCurrentPassword.status, 401);
  assert.equal(wrongCurrentPassword.data.error, 'current-password');
  const privateSaved = await post('/api/private-projects', { ...project, resources: media }, cookie);
  assert.equal(privateSaved.status, 201, 'Private media permitted');
  const privatePath = `/api/private-projects/${privateSaved.data.id}`;
  assert.equal((await request(privatePath)).status, 401);
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) assert.equal((await request(privatePath, { method, cookie: second.cookie, ...(['PUT', 'PATCH'].includes(method) ? { value: method === 'PATCH' ? { name: 'Not yours' } : project } : {}), ...(method === 'PATCH' ? { headers: { 'if-match': '1' } } : {}) })).status, 404);
  assert.equal((await readProject(privateSaved.data.id)).status, 400, 'Private IDs are not public share IDs');
  assert.equal((await request(privatePath, { cookie })).data.project.resources[0].data, media[0].data);
  const renamed = await request(privatePath, { method: 'PATCH', cookie, value: { name: 'Renamed private project' }, headers: { 'if-match': '1' } });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.id, privateSaved.data.id);
  assert.equal(renamed.data.name, 'Renamed private project');
  assert.equal(renamed.data.revision, 2);
  assert.ok(Number.isFinite(renamed.data.updatedAt));
  assert.equal((await request('/api/private-projects', { cookie })).data.projects.find(item => item.id === privateSaved.data.id).name, 'Renamed private project');
  assert.equal((await request(privatePath, { cookie })).data.project.projectName, 'Renamed private project');
  assert.equal((await request(privatePath, { method: 'PATCH', cookie, value: { name: 'Stale rename' }, headers: { 'if-match': '1' } })).status, 409);
  assert.equal((await request(privatePath, { method: 'PATCH', cookie, value: { name: ' ' }, headers: { 'if-match': '2' } })).status, 400);
  assert.equal((await post('/api/private-projects', unicode, cookie)).status, 413);
  const publicSaved = await post('/api/projects', project, cookie);
  const changed = await request(privatePath, { method: 'PUT', cookie, value: { ...project, projectName: 'Renamed private project', readme: 'changed' }, headers: { 'if-match': '2' } });
  assert.equal(changed.status, 200);
  assert.equal((await request(privatePath, { method: 'PUT', cookie, value: project, headers: { 'if-match': '1' } })).status, 409);
  assert.equal((await readProject(publicSaved.data.code)).data.project.readme, undefined, 'Public copy is immutable');
  assert.equal((await request(privatePath, { method: 'DELETE', cookie })).status, 200);
  assert.equal((await readProject(publicSaved.data.code)).status, 200, 'Deleting original preserves publication');
  assert.equal((await post('/api/projects', { ...project, resources: media }, cookie)).status, 422);
  assert.equal((await post('/api/programs', { ...program, project: { ...project, resources: media } }, cookie)).status, 422);

  // CSRF and exact credentialed CORS. No wildcard or school-IP throttling.
  const preflight = await fetch(`${base}/api/private-projects`, { method: 'OPTIONS', headers: { Origin: origin } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  assert.equal((await request('/api/private-projects', { cookie, headers: { Origin: 'https://evil.bluek.online' } })).status, 403);
  assert.equal((await request('/api/account/logout', { method: 'POST', cookie, headers: { 'x-bluek-request': '' } })).status, 403);
  assert.equal((await request('/api/account', { cookie })).data.user.username, credentials.username);

  const login2 = await post('/api/account/login', credentials);
  assert.equal(login2.status, 200);
  assert.equal((await post('/api/account/password', { password: credentials.password, newPassword: '123456789' }, cookie)).status, 400, 'Nine-character replacement passwords are rejected');
  assert.equal((await post('/api/account/password', { password: credentials.password, newPassword: '1234567890' }, cookie)).status, 200, 'Ten-character replacement passwords are accepted');
  assert.equal((await request('/api/private-projects', { cookie })).status, 401, 'Password change revokes old session');
  assert.equal((await request('/api/private-projects', { cookie: login2.cookie })).status, 401, 'Password change revokes other sessions');
  const fresh = await post('/api/account/login', { ...credentials, password: '1234567890' });
  assert.equal(fresh.status, 200);
  assert.equal((await post('/api/account/logout', undefined, fresh.cookie)).status, 200);
  assert.equal((await request('/api/private-projects', { cookie: fresh.cookie })).status, 401);
  assert.equal((await post('/api/projects', project, fresh.cookie)).status, 201, 'A stale cookie must not disable anonymous publication');
  assert.equal((await post('/api/account/login', credentials)).status, 401);
  const attempt = db.prepare('SELECT * FROM login_attempts WHERE username = ?').get(credentials.username);
  assert.equal((await post('/api/account/login', credentials)).status, 429);
  assert.equal(db.prepare('SELECT next_at FROM login_attempts WHERE username = ?').get(credentials.username).next_at, attempt.next_at, 'Blocked retries never extend wait');
  assert.equal((await post('/api/account/login', { username: 'student.two', password: 'another-unique-password' })).status, 200, 'A dotted username can sign in');
  db.prepare('UPDATE login_attempts SET next_at = 0').run();
  assert.equal((await post('/api/account/login', credentials)).status, 401);
  assert.equal(db.prepare('SELECT failures FROM login_attempts WHERE username = ?').get(credentials.username).failures, 2);
  db.prepare('UPDATE login_attempts SET next_at = 0').run();
  const session = await post('/api/account/login', { ...credentials, password: '1234567890' });
  assert.equal(session.status, 200);
  assert.equal(db.prepare('SELECT * FROM login_attempts WHERE username = ?').get(credentials.username), undefined);
  db.prepare('UPDATE sessions SET expires_at = 0 WHERE account_id = ?').run(stored.id);
  assert.equal((await request('/api/private-projects', { cookie: session.cookie })).status, 401);

  assert.equal((await post('/api/content-reports', { code: playable.data.code, reason: 'This endpoint has been removed.' })).status, 404, 'Content reporting endpoint is removed');
  assert.ok(admin('inspect', playable.data.code).includes('bluek-program'));
  admin('block', playable.data.code);
  assert.equal((await readProgram(playable.data.code)).status, 451);
  assert.equal((await readProject(playable.data.code)).status, 451, 'Block applies before developer-link policy');
  admin('block', 'green-lamp-river');
  assert.equal((await readProject('green-lamp-river')).status, 451, 'Legacy records are moderatable');
  admin('block-account', 'student.two');
  assert.equal((await request('/api/private-projects', { cookie: second.cookie })).status, 401);
  assert.equal((await post('/api/account/login', { username: 'student.two', password: 'another-unique-password' })).status, 403);
  admin('unblock-account', 'student.two');
  assert.equal((await post('/api/account/login', { username: 'student.two', password: 'another-unique-password' })).status, 200);

  const deletionCredentials = { username: 'delete.me', password: 'account-delete-password' };
  const deletionAccount = await post('/api/account/register', deletionCredentials);
  assert.equal(deletionAccount.status, 200);
  const deletionPrivate = await post('/api/private-projects', project, deletionAccount.cookie);
  const deletionPublic = await post('/api/projects', project, deletionAccount.cookie);
  const rejectedDeletion = await request('/api/account', {
    method: 'DELETE', cookie: deletionAccount.cookie,
    value: { password: 'wrong-delete-password' },
  });
  assert.equal(rejectedDeletion.status, 401, 'Account deletion requires the correct current password');
  assert.ok(db.prepare('SELECT id FROM accounts WHERE id = ?').get(deletionAccount.data.user.id));
  db.prepare('UPDATE login_attempts SET next_at = 0 WHERE username = ?').run(deletionCredentials.username);
  const deletedAccount = await request('/api/account', {
    method: 'DELETE', cookie: deletionAccount.cookie,
    value: { password: deletionCredentials.password },
  });
  assert.equal(deletedAccount.status, 200);
  assert.match(deletedAccount.response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(db.prepare('SELECT id FROM accounts WHERE id = ?').get(deletionAccount.data.user.id), undefined);
  assert.equal(db.prepare('SELECT id FROM private_projects WHERE id = ?').get(deletionPrivate.data.id), undefined, 'Account deletion cascades private projects');
  assert.equal(db.prepare('SELECT token_hash FROM sessions WHERE account_id = ?').get(deletionAccount.data.user.id), undefined, 'Account deletion revokes every session');
  assert.equal(db.prepare('SELECT code FROM public_codes WHERE code = ? AND owner_id IS NULL').get(deletionPublic.data.code)?.code, deletionPublic.data.code, 'Public copy ownership is cleared');
  assert.equal((await readProject(deletionPublic.data.code)).status, 200, 'Published copy remains available until expiry');
  assert.equal((await request('/api/private-projects', { cookie: deletionAccount.cookie })).status, 401);

  // Deadlines are enforced on every read, independently of physical cleanup.
  db.prepare('UPDATE projects SET expires_at = ? WHERE code = ?').run('2020-01-01T00:00:00.000Z', anonymous.data.code);
  assert.equal((await readProject(anonymous.data.code)).status, 410);
  assert.ok(db.prepare('SELECT code FROM projects WHERE code = ?').get(anonymous.data.code), 'Physical cleanup may lag');
  const timestamp = Date.now() - 366 * 86400000;
  db.prepare('UPDATE accounts SET last_used_at = ? WHERE id = ?').run(timestamp, stored.id);
  await readProject(publicSaved.data.code);
  assert.equal(db.prepare('SELECT last_used_at FROM accounts WHERE id = ?').get(stored.id).last_used_at, timestamp, 'Public fetch does not count as account use');
  db.prepare('INSERT INTO private_projects VALUES (?, ?, ?, ?, 1, ?)').run('cleanup-project', stored.id, 'old', timestamp, JSON.stringify(project));
  await stop(); await start();
  assert.equal(db.prepare('SELECT code FROM projects WHERE code = ?').get(anonymous.data.code), undefined);
  assert.ok(db.prepare('SELECT code FROM public_codes WHERE code = ?').get(anonymous.data.code), 'Identifier never reused after deletion/restart');
  assert.equal((await readProject(anonymous.data.code)).status, 410);
  assert.equal(db.prepare('SELECT id FROM accounts WHERE id = ?').get(stored.id), undefined);
  assert.equal(db.prepare('SELECT id FROM private_projects WHERE owner_id = ?').get(stored.id), undefined);
  assert.equal((await readProject(publicSaved.data.code)).status, 200, 'Account cleanup does not delete immutable public copy early');
  assert.equal((await request('/api/feedback/config')).status, 200, 'Technical feedback endpoint preserved');
  await stop(); env.BLUEK_COOKIE_SECURE = '1'; await start();
  const secureSession = await post('/api/account/register', { username: 'secure_cookie_test', password: 'a-secure-cookie-password' });
  assert.equal(secureSession.status, 200);
  assert.match(secureSession.response.headers.get('set-cookie'), /^__Host-bluek_session=/);
  assert.match(secureSession.response.headers.get('set-cookie'), /; Secure;/);
  assert.doesNotMatch(secureSession.response.headers.get('set-cookie'), /Domain=/i);
  console.log('Cloud API passed: legacy migration, IDs, seven-day deadlines, media guards, UTF-8 limits, accounts/sessions, owner ACL, revision conflicts, copies, CSRF/CORS, throttling, removed content-report endpoint, admin blocks, retention and restart.');
} finally {
  await stop(); if (db?.open) db.close(); await rm(directory, { recursive: true, force: true });
}
