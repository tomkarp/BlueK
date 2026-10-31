import { test, expect } from "@playwright/test";

const account = { id: "admin-id", username: "operator" };
const user = { id: "user-id", username: "learner", admin: 0, trusted: 0, blocked: 0, lastUsedAt: 1000000000, privateCount: 1, publicationCount: 1 };
const publication = { code: "abcd2345efgh", name: "Example", program: false, owner: "learner", expiresAt: "2027-10-30T00:00:00Z", size: 1024, blocked: 0, available: true };

test("ADMIN-01 administration shows actions, searches, previews public media and records changes", async ({ page }) => {
  let trusted = false;
  await page.route("**/api/account", route => route.fulfill({ json: { user: account } }));
  await page.route("**/api/private-projects", route => route.fulfill({ json: { projects: [] } }));
  await page.route("**/api/storage", route => route.fulfill({ json: { used: 0, limit: 5242880, publications: [], admin: true } }));
  await page.route("**/api/admin/accounts**", route => route.fulfill({ json: { accounts: [{ ...user, trusted: Number(trusted) }], more: false } }));
  await page.route("**/api/admin/publications", route => route.fulfill({ json: { publications: [publication], more: false } }));
  await page.route("**/api/admin/publications?*", route => route.fulfill({ json: { publications: [publication], more: false } }));
  await page.route("**/api/admin/publications/abcd2345efgh", route => route.fulfill({ json: { payload: { format: "bluek-project", projectName: "Example", files: [], resources: [{ path: "images/test.png", data: "data:image/png;base64,iVBORw0KGgo=" }] } } }));
  await page.route("**/api/admin/action", async route => { expect(route.request().postDataJSON()).toEqual({ action: "trust", target: "user-id" }); trusted = true; await route.fulfill({ json: { ok: true } }); });
  await page.route("**/api/admin/audit", route => route.fulfill({ json: { entries: [{ createdAt: 1000000000, actor: "operator", action: "trust", target: "learner" }] } }));
  await page.goto("/");
  await page.locator(".toolbar-account button").click();
  const accountDialog = page.getByRole("dialog", { name: "Account", exact: true });
  const accountActions = accountDialog.locator(".cloud-account-actions");
  await expect(accountActions.getByRole("button", { name: "Administration" })).toBeVisible();
  await expect(accountActions.getByRole("button").first()).toHaveText("Administration");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await accountDialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 850 });
  await accountActions.getByRole("button", { name: "Administration" }).click();
  await expect(accountDialog).toHaveCount(0);
  const admin = page.getByRole("dialog", { name: "Administration", exact: true });
  await expect(admin).toBeVisible();
  await expect(admin).toContainText("learner");
  await admin.getByRole("button", { name: "Grant trust", exact: true }).click();
  await expect(admin.getByRole("button", { name: "Revoke trust" })).toBeVisible();
  await admin.getByRole("button", { name: "Shared links" }).click();
  await expect(admin).toContainText("Example");
  await admin.getByRole("button", { name: "Show content" }).click();
  await expect(admin.getByRole("img", { name: "images/test.png" })).toBeVisible();
  await expect(admin).toContainText("Media data omitted");
  await admin.getByRole("button", { name: "Activity log" }).click();
  await expect(admin).toContainText("operator · Grant trust · learner");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await admin.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(admin).toHaveCount(0);
  await expect(accountDialog).toBeVisible();
  await accountDialog.getByRole("button", { name: "Administration" }).click();
  await page.getByRole("dialog", { name: "Administration", exact: true }).getByRole("button", { name: "Close" }).click();
  await expect(accountDialog).toBeVisible();
});

test("ADMIN-02 ordinary accounts do not see the administration", async ({ page }) => {
  await page.route("**/api/account", route => route.fulfill({ json: { user: account } }));
  await page.route("**/api/private-projects", route => route.fulfill({ json: { projects: [] } }));
  await page.route("**/api/storage", route => route.fulfill({ json: { used: 0, limit: 5242880, publications: [], admin: false } }));
  await page.goto("/");
  await page.locator(".toolbar-account button").click();
  await expect(page.getByRole("button", { name: "Administration" })).toHaveCount(0);
});
