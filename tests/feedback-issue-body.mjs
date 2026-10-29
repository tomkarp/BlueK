import assert from 'node:assert/strict';
import { renderFeedbackIssueBody } from '../server/feedback.mjs';

const imageId = '9b6edb79-9c65-4c88-bf62-8bc441aab301';
const report = {
  id: '530857f1-9d92-4835-b9bd-8cc149f6c801',
  description: `Button looks odd\n[[bluek-image:${imageId}]]`,
  expected: `Please align it\n[[bluek-image:${imageId}]]`,
  build: { version: 'test', revision: 'test', channel: 'main', builtAt: 'now' },
  environment: { browser: 'test', language: 'en', mode: 'web', origin: 'http://localhost' },
  context: {},
  attachments: [{ id: imageId, name: 'screenshot.png', type: 'image/png', data: 'aW1hZ2U=', displaySize: 'small' }],
};
const imageUrl = `../blob/main/reports/${report.id}-${imageId}.png?raw=true`;
const body = renderFeedbackIssueBody(report, 'https://github.com/example/reports/report.json.gz', new Map([[imageId, { url: imageUrl, size: 'small' }]]));
assert.match(body, /Button looks odd/);
assert.equal((body.match(/alt="Pasted image"/g) || []).length, 2);
assert.equal((body.match(/screenshot\.png/g) || []).length, 1);
assert.equal((body.match(new RegExp(`src="${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" width="240"`, 'g')) || []).length, 2);
assert.ok(body.includes(`[Complete report (JSON, gzip)]`));
console.log('Feedback issue body: inline pasted images render in description and expected behavior.');
