import type { BrowserContext } from '@playwright/test';
/** In-memory HTTP fixture for UI-only publication tests. Real-service and
 * security/retention behavior is tested separately in smoke-share-*.mjs. */
export async function mockPublications(context: BrowserContext) {
  const payloads = new Map<string, Record<string, unknown>>();
  let next = 0;
  await context.route(/\/api\/(projects|programs)(?:\/[^/?]+)?$/, async route => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/api\/(projects|programs)(?:\/([^/]+))?$/)!;
    if (route.request().method() === 'POST' && !match[2]) {
      const code = `7m4kr9wp${String(++next).padStart(4, '0')}`;
      payloads.set(code, route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { code, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() } });
    }
    const value = payloads.get(match[2]);
    if (!value) return route.continue();
    return route.fulfill({ json: match[1] === 'programs' ? { program: value } : { project: value.format === 'bluek-program' ? value.project : value } });
  });
}
