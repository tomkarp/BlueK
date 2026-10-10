import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const maxBytes = 10 * 1024 * 1024;
const maxAge = 30 * 24 * 60 * 60 * 1000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const categories = new Set(['bug', 'kotlin-support']);
const labelFor = { bug: 'bug', 'kotlin-support': 'kotlin-support' };
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);

function validReport(value) {
  return record(value) && value.format === 'bluek-feedback' && value.version === 1 &&
    typeof value.id === 'string' && uuid.test(value.id) && categories.has(value.category) &&
    text(value.summary, 160, true) && text(value.description, 10000, true) &&
    text(value.expected, 4000) && text(value.contact, 254) && record(value.build) &&
    ['version', 'revision', 'channel', 'builtAt'].every(key => text(value.build[key], 100)) &&
    record(value.environment) && text(value.environment.browser, 1000) &&
    text(value.environment.language, 100) && text(value.environment.origin, 300) &&
    ['offline', 'web'].includes(value.environment.mode) && record(value.context) &&
    (value.context.error === undefined || text(value.context.error, 20000)) &&
    (value.context.code === undefined || text(value.context.code, 20000)) &&
    (value.context.diagnostics === undefined || (Array.isArray(value.context.diagnostics) &&
      value.context.diagnostics.length <= 100 && value.context.diagnostics.every(diagnostic =>
        record(diagnostic) && text(diagnostic.message, 10000) &&
        (diagnostic.fileName === undefined || text(diagnostic.fileName, 300)) &&
        Number.isFinite(diagnostic.line) && Number.isFinite(diagnostic.column)))) &&
    (value.project === undefined || (record(value.project) && value.project.format === 'bluek-project' &&
      value.project.version === 1 && Array.isArray(value.project.files)));
}
function fence(value, language = '') {
  // User text is always fenced: descriptions cannot create mentions or links.
  const longest = (String(value).match(/`+/g) || []).reduce((max, item) => Math.max(max, item.length), 2);
  const ticks = '`'.repeat(longest + 1);
  return `${ticks}${language}\n${value}\n${ticks}`;
}
function issueBody(report, attachmentUrl) {
  const metadata = { build: report.build, environment: report.environment };
  const parts = [
    `<!-- bluek-feedback:${report.id} -->`,
    '## Description', fence(report.description),
    ...(report.expected ? ['## Expected behavior', fence(report.expected)] : []),
    ...(report.contact ? ['## Contact (private)', fence(report.contact)] : []),
    '## BlueK version and environment', fence(JSON.stringify(metadata, null, 2), 'json'),
    ...(report.context.code ? ['## Codepad input', fence(report.context.code, 'kotlin')] : []),
    ...(report.context.error ? ['## Error', fence(report.context.error)] : []),
    ...(report.context.diagnostics?.length ? ['## Diagnostics', fence(JSON.stringify(report.context.diagnostics, null, 2), 'json')] : []),
    '## Private attachment',
    `[Complete report${report.project ? ' and BlueK project' : ''} (JSON, gzip)](${attachmentUrl})`,
    report.project ? 'The reporter explicitly chose to include the project, including its resources.' : 'No project was attached.',
  ];
  const body = parts.join('\n\n');
  if (body.length <= 60000) return body;
  // GitHub issue bodies have a bounded length; the complete, unabridged
  // diagnostics remain in the private attachment.
  return [parts[0], '## Description', fence(report.description),
    '## BlueK version and environment', fence(JSON.stringify(metadata, null, 2), 'json'),
    '## Complete report', `[All details and diagnostics (JSON, gzip)](${attachmentUrl})`].join('\n\n');
}

/** Same process/database as project sharing; credentials remain server-only.
 * The SQLite outbox survives restarts and retries the same report id. */
export async function createFeedbackService(database) {
  const repository = process.env.BLUEK_FEEDBACK_REPOSITORY || 'tomkarp/BlueK-Feedback';
  const token = process.env.BLUEK_FEEDBACK_TOKEN_FILE
    ? (await readFile(process.env.BLUEK_FEEDBACK_TOKEN_FILE, 'utf8')).trim()
    : (process.env.BLUEK_FEEDBACK_TOKEN || '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Invalid feedback repository configuration.');
  const origins = new Set((process.env.BLUEK_FEEDBACK_ORIGINS ||
    'https://bluek.de,https://beta.bluek.de,https://tomkarp.github.io,http://127.0.0.1:5173,http://localhost:5173,null').split(','));
  database.exec(`CREATE TABLE IF NOT EXISTS feedback_reports (
    id TEXT PRIMARY KEY, body_hash TEXT NOT NULL, payload TEXT,
    created_at INTEGER NOT NULL, issue_number INTEGER, attachment_url TEXT,
    attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0
  ); CREATE INDEX IF NOT EXISTS feedback_due ON feedback_reports (next_attempt);`);
  const select = database.prepare('SELECT * FROM feedback_reports WHERE id = ?');
  const insert = database.prepare('INSERT INTO feedback_reports (id, body_hash, payload, created_at) VALUES (?, ?, ?, ?)');
  const finish = database.prepare('UPDATE feedback_reports SET issue_number = ?, payload = NULL WHERE id = ?');
  const attach = database.prepare('UPDATE feedback_reports SET attachment_url = ? WHERE id = ?');
  const defer = database.prepare('UPDATE feedback_reports SET attempts = attempts + 1, next_attempt = ? WHERE id = ?');
  const pending = database.prepare('SELECT id FROM feedback_reports WHERE issue_number IS NULL AND next_attempt <= ? ORDER BY created_at LIMIT 5');
  const recentCount = database.prepare('SELECT COUNT(*) AS count FROM feedback_reports WHERE created_at > ?');
  const prune = database.prepare('DELETE FROM feedback_reports WHERE issue_number IS NOT NULL AND created_at < ?');
  const ipSalt = randomBytes(32);
  const requests = new Map();
  let privateUntil = 0;
  let busy = false;
  let uploads = 0;
  let stopping = false;
  let nextCredentialCheck = 0;

  async function github(path, method = 'GET', body) {
    const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/json', 'User-Agent': 'BlueK-feedback' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`GitHub feedback request failed (${response.status}).`);
    return response.json();
  }
  async function isPrivate(fresh = false) {
    if (!token) return false;
    if (!fresh && privateUntil > Date.now()) return true;
    try {
      const repo = await github('');
      if (repo.private !== true || repo.has_issues !== true || repo.archived === true) return false;
      privateUntil = Date.now() + 60000;
      return true;
    } catch { return false; }
  }
  async function deliver(id) {
    const row = select.get(id);
    if (!row || row.issue_number) return;
    if (!(await isPrivate(true))) throw new Error('Private feedback repository is unavailable.');
    const report = JSON.parse(row.payload);
    // Reconcile a lost response before retrying an issue creation, including
    // retries after a long outage with more than one page of subsequent issues.
    if (row.attempts) {
      for (let page = 1; ; page++) {
        const issues = await github(`/issues?state=all&per_page=100&sort=created&direction=asc&since=${encodeURIComponent(new Date(row.created_at - 60000).toISOString())}&page=${page}`);
        const existing = issues.find(issue => !issue.pull_request && issue.body?.startsWith(`<!-- bluek-feedback:${id} -->`));
        if (existing) { finish.run(existing.number, id); return; }
        if (issues.length < 100) break;
      }
    }
    let attachmentUrl = row.attachment_url;
    const filePath = `/contents/reports/${id}.json.gz`;
    if (!attachmentUrl) {
      // If an upload succeeded but its HTTP response was lost, recover its
      // existing URL rather than attempting to overwrite the file.
      let uploaded;
      if (row.attempts) {
        try { uploaded = { content: await github(filePath) }; }
        catch { /* The upload may not have happened yet. */ }
      }
      uploaded ||= await github(filePath, 'PUT', {
        message: `Store private BlueK report ${id}`,
        content: gzipSync(JSON.stringify(report, null, 2)).toString('base64'),
      });
      attachmentUrl = uploaded.content.html_url;
      attach.run(attachmentUrl, id);
    }
    // Mark the attempt before sending: a process crash can happen after GitHub
    // creates the issue, but before SQLite receives its number.
    defer.run(Date.now() + 60000, id);
    const issue = await github('/issues', 'POST', {
      title: `[${report.category === 'bug' ? 'Bug' : 'Kotlin'}] ${report.summary.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').trim()}`,
      body: issueBody(report, attachmentUrl), labels: ['app-report', labelFor[report.category]],
    });
    finish.run(issue.number, id);
  }
  async function drain() {
    if (busy || !token || stopping) return;
    busy = true;
    try {
      // GitHub can revoke even non-expiring tokens after a year of inactivity.
      // Check the limited credential daily, including when there are no reports.
      if (nextCredentialCheck <= Date.now()) {
        nextCredentialCheck = Date.now() + 24 * 60 * 60 * 1000;
        if (!(await isPrivate(true))) console.warn('BlueK private feedback access is unavailable.');
      }
      for (const { id } of pending.all(Date.now())) {
        try { await deliver(id); }
        catch {
          const row = select.get(id);
          defer.run(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(row.attempts, 6)), id);
          console.warn(`BlueK feedback ${id} is queued for retry.`);
        }
      }
      prune.run(Date.now() - maxAge);
    } finally { busy = false; }
  }
  const timer = setInterval(() => { void drain(); }, 60000);
  timer.unref();
  void drain();
  function json(response, status, body) {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(body));
  }
  async function handle(request, response, path) {
    const statusId = path.startsWith('/api/feedback/') ? path.slice('/api/feedback/'.length) : '';
    if (path !== '/api/feedback' && path !== '/api/feedback/config' && !uuid.test(statusId)) return false;
    const origin = request.headers.origin;
    response.setHeader('Vary', 'Origin');
    if (origin && !origins.has(origin)) { json(response, 403, { error: 'origin' }); return true; }
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' });
      response.end(); return true;
    }
    if (request.method === 'GET' && path === '/api/feedback/config') {
      json(response, 200, { available: await isPrivate(), maxBytes }); return true;
    }
    if (request.method === 'GET' && uuid.test(statusId)) {
      const row = select.get(statusId);
      json(response, row ? 200 : 404, row ? {
        reference: statusId, queued: !row.issue_number,
        ...(row.issue_number ? { issueNumber: row.issue_number } : {}),
      } : { error: 'not-found' });
      return true;
    }
    if (request.method !== 'POST' || path !== '/api/feedback') { json(response, 405, { error: 'method' }); return true; }
    if (!token) { json(response, 503, { error: 'unavailable' }); return true; }
    if (!String(request.headers['content-type'] || '').startsWith('application/json')) {
      json(response, 400, { error: 'invalid' }); return true;
    }
    const remote = request.socket.remoteAddress || 'unknown';
    // Caddy is the sole production proxy and replaces untrusted forwarding
    // headers. Never trust a header from a non-loopback direct connection.
    const forwarded = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
      ? String(request.headers['x-forwarded-for'] || '').split(',').at(-1)?.trim() : '';
    const key = createHash('sha256').update(ipSalt).update(forwarded || remote).digest('hex');
    const now = Date.now();
    for (const [address, times] of requests) {
      const live = times.filter(time => time > now - 600000);
      if (live.length) requests.set(address, live); else requests.delete(address);
    }
    const times = requests.get(key) || [];
    if (times.length >= 10 || requests.size >= 10000) {
      json(response, 429, { error: 'rate-limit' }); return true;
    }
    requests.set(key, [...times, now]);
    const chunks = [];
    let size = 0;
    if (uploads >= 4) { json(response, 429, { error: 'rate-limit' }); return true; }
    uploads++;
    try {
      for await (const chunk of request) {
        size += chunk.length;
        if (size > maxBytes) { json(response, 413, { error: 'too-large' }); return true; }
        chunks.push(chunk);
      }
      const report = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!validReport(report)) { json(response, 400, { error: 'invalid' }); return true; }
      const body = JSON.stringify(report);
      const hash = createHash('sha256').update(body).digest('hex');
      let row = select.get(report.id);
      if (row && row.body_hash !== hash) { json(response, 409, { error: 'invalid' }); return true; }
      if (!row) {
        if (recentCount.get(now - 3600000).count >= 100) { json(response, 429, { error: 'rate-limit' }); return true; }
        if (!(await isPrivate())) { json(response, 503, { error: 'unavailable' }); return true; }
        // Availability check awaited I/O: another identical request may have
        // inserted the report meanwhile. Re-read before inserting.
        row = select.get(report.id);
        if (row && row.body_hash !== hash) { json(response, 409, { error: 'invalid' }); return true; }
        if (!row) {
          if (recentCount.get(now - 3600000).count >= 100) { json(response, 429, { error: 'rate-limit' }); return true; }
          insert.run(report.id, hash, body, now);
        }
      }
      void drain();
      row = select.get(report.id);
      json(response, row.issue_number ? 201 : 202, {
        reference: report.id, queued: !row.issue_number,
        ...(row.issue_number ? { issueNumber: row.issue_number } : {}),
      });
    } catch {
      // Do not expose GitHub responses, credentials or request content.
      json(response, 400, { error: 'invalid' });
    } finally {
      uploads--;
    }
    return true;
  }
  return { handle, close: async () => {
    stopping = true;
    clearInterval(timer);
    while (busy) await new Promise(resolve => setTimeout(resolve, 20));
  } };
}
