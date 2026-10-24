import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const exampleRoot = new URL("../../integrations/inf-schule/", import.meta.url);
const example = JSON.parse(
  await readFile(new URL("example.bluek.json", exampleRoot), "utf8"),
);
type SourceWindow = Window & {
  handoffChild: Window;
  handoffURL: string;
  readyCount: number;
};

async function provider(
  context: BrowserContext,
  baseURL: string,
  options: {
    project?: unknown;
    pending?: Promise<void>;
    failed?: boolean;
    claimedSender?: string;
  } = {},
) {
  const html = (await readFile(new URL("example.html", exampleRoot), "utf8"))
    .replaceAll("https://beta.bluek.online/", baseURL + "/")
    .replaceAll("http://127.0.0.1:5173/", baseURL + "/");
  const helper = await readFile(
    new URL("bluek-handoff.js", exampleRoot),
    "utf8",
  );
  await context.addInitScript(
    (options: { claimedSender?: string }) => {
      const originalOpen = window.open.bind(window);
      window.open = (...args: Parameters<typeof window.open>) => {
        if (options.claimedSender && args[0]) {
          const url = new URL(String(args[0]));
          url.searchParams.set("sender", options.claimedSender);
          args[0] = url.href;
        }
        const child = originalOpen(...args);
        Object.assign(window, {
          handoffChild: child,
          handoffURL: String(args[0]),
        });
        return child;
      };
      Object.assign(window, { readyCount: 0 });
      window.addEventListener("message", (event) => {
        if (event.data?.type === "bluek:handoff:ready")
          (window as SourceWindow).readyCount++;
      });
    },
    { claimedSender: options.claimedSender },
  );
  await context.route(
    /https?:\/\/(inf-schule\.de|www\.inf-schule\.de|dev\.inf-schule\.de|inf-schule\.de\.example|dev\.inf-schule\.de\.example|localhost:5287)\/handoff-example\//,
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("bluek-handoff.js"))
        return route.fulfill({ contentType: "text/javascript", body: helper });
      if (path.endsWith("example.bluek.json")) {
        await options.pending;
        return options.failed
          ? route.fulfill({ status: 404, body: "Not found" })
          : route.fulfill({ json: options.project ?? example });
      }
      return route.fulfill({ contentType: "text/html", body: html });
    },
  );
  // Account status may fail; the transfer must never upload to or depend on the API.
  await context.route("**/api/**", (route) => route.abort());
}

async function open(page: Page, origin = "https://inf-schule.de") {
  await page.goto(origin + "/handoff-example/example.html");
  const popup = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: "In BlueK öffnen", exact: true })
    .click();
  return popup;
}

async function send(page: Page, data: unknown) {
  await page.evaluate((value) => {
    const source = window as SourceWindow;
    source.handoffChild.postMessage(value, new URL(source.handoffURL).origin);
  }, data);
}

const envelope = (project: unknown) => ({
  type: "bluek:handoff:project",
  version: 1,
  project,
});

test.describe("inf-schule handoff", () => {
  test("HANDOFF-01 the real example opens an editable project without a working API or cross-origin JSON request", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!);
    const writes: string[] = [];
    const projectRequests: string[] = [];
    context.on("request", (request) => {
      if (request.method() !== "GET") writes.push(request.url());
      if (request.url().endsWith("example.bluek.json"))
        projectRequests.push(request.url());
    });
    const child = await open(page);
    await expect(child.getByLabel("Project name")).toHaveValue(
      example.projectName,
    );
    await expect(page.getByRole("status")).toContainText(
      "Das Projekt ist in BlueK geöffnet.",
    );
    expect(
      new URL(await page.evaluate(() => (window as SourceWindow).handoffURL))
        .search,
    ).toBe("?import=inf-schule&sender=https%3A%2F%2Finf-schule.de");
    expect(child.url()).toBe(baseURL + "/");
    expect(projectRequests).toEqual([
      "https://inf-schule.de/handoff-example/example.bluek.json",
    ]);
    expect(writes).toEqual([]);
    // Import uses the normal runtime, and never runs student code automatically.
    await expect(
      child.getByRole("button", { name: "Start main", exact: true }),
    ).toBeDisabled();
    await child.getByRole("button", { name: "Compile", exact: true }).click();
    await expect(
      child.getByRole("button", { name: "Start main", exact: true }),
    ).toBeEnabled();
    await child
      .getByRole("button", { name: "Start main", exact: true })
      .click();
    await expect(child.locator(".terminal-output")).toContainText(
      "Hallo von inf-schule!",
    );
    // One handoff is consumed once; an unsolicited replacement cannot follow.
    await send(page, envelope({ ...example, projectName: "Replay" }));
    await expect(child.getByLabel("Project name")).toHaveValue(
      example.projectName,
    );
    await child.reload();
    await expect(child.getByLabel("Project name")).toHaveValue(
      example.projectName,
    );
  });

  test("HANDOFF-02 another frame, unsupported versions and malformed envelopes cannot supply the project", async ({
    page,
    context,
    baseURL,
  }) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await provider(context, baseURL!, { pending });
    const child = await open(page, "https://www.inf-schule.de");
    await expect(child.getByRole("status")).toContainText(
      "Waiting for the project",
    );
    await page.evaluate(
      (project) => {
        const frame = document.createElement("iframe");
        frame.srcdoc = `<script>parent.handoffChild.postMessage(${JSON.stringify({ type: "bluek:handoff:project", version: 1, project })}, new URL(parent.handoffURL).origin)<\/script>`;
        document.body.append(frame);
      },
      { ...example, projectName: "Wrong window" },
    );
    await send(page, { ...envelope(example), version: 2 });
    await send(page, { ...envelope(example), extra: true });
    await send(page, {
      type: "unrelated-message",
      version: 1,
      project: example,
    });
    await expect(child.getByLabel("Project name")).toHaveValue("");
    release();
    await expect(child.getByLabel("Project name")).toHaveValue(
      example.projectName,
    );
    await expect
      .poll(() => page.evaluate(() => (window as SourceWindow).readyCount))
      .toBe(1);
  });

  test("HANDOFF-03 the correct opener on an untrusted lookalike origin is ignored and times out", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!, {
      claimedSender: "https://inf-schule.de",
    });
    const child = await open(page, "https://inf-schule.de.example");
    await child.clock.install();
    await expect(child.getByRole("status")).toContainText(
      "Waiting for the project",
    );
    await send(page, envelope(example));
    await expect(child.getByLabel("Project name")).toHaveValue("");
    await expect
      .poll(() => page.evaluate(() => (window as SourceWindow).readyCount))
      .toBe(0);
    await child.clock.fastForward(31_000);
    await expect(child.getByRole("alert")).toContainText("did not arrive");
    await send(page, envelope(example));
    await expect(child.getByLabel("Project name")).toHaveValue("");
  });

  test("HANDOFF-04 edits made during a delayed transfer are retained", async ({
    page,
    context,
    baseURL,
  }) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await provider(context, baseURL!, { pending });
    const child = await open(page);
    await expect(child.getByRole("status")).toContainText(
      "Waiting for the project",
    );
    await child.getByLabel("Project name").fill("My work while waiting");
    release();
    await expect(child.getByRole("alert")).toContainText(
      "Your work has been kept",
    );
    await expect(child.getByLabel("Project name")).toHaveValue(
      "My work while waiting",
    );
    await expect(page.getByRole("status")).toContainText(
      "konnte das Projekt nicht übernehmen",
    );
  });

  test("HANDOFF-05 invalid project data is rejected without replacing the current draft", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!, {
      project: {
        ...example,
        files: [{ fileName: "bad.js", source: "alert(1)" }],
      },
    });
    await context.addInitScript(
      (project) => {
        if (location.hostname !== "127.0.0.1") return;
        const id = "existing-project";
        sessionStorage.setItem("bluek.tab-draft.v1", id);
        localStorage.setItem(
          "bluek.project-draft.v1." + id,
          JSON.stringify({ id, updatedAt: Date.now(), project }),
        );
      },
      { ...example, projectName: "Current project" },
    );
    const child = await open(page);
    await expect(child.getByRole("alert")).toContainText(
      "not a valid BlueK project",
    );
    await expect(child.getByLabel("Project name")).toHaveValue(
      "Current project",
    );
    await expect(page.getByRole("status")).toContainText(
      "konnte das Projekt nicht übernehmen",
    );
  });

  test("HANDOFF-06 replacing a restored project can be cancelled", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!);
    await context.addInitScript(
      (project) => {
        if (location.hostname !== "127.0.0.1") return;
        const id = "existing-project";
        sessionStorage.setItem("bluek.tab-draft.v1", id);
        localStorage.setItem(
          "bluek.project-draft.v1." + id,
          JSON.stringify({ id, updatedAt: Date.now(), project }),
        );
      },
      { ...example, projectName: "Keep this project" },
    );
    context.on("page", (child) =>
      child.on("dialog", (dialog) => dialog.dismiss()),
    );
    const child = await open(page);
    await expect(page.getByRole("status")).toContainText(
      "Die Übergabe wurde abgebrochen.",
    );
    await expect(child.getByLabel("Project name")).toHaveValue(
      "Keep this project",
    );
  });

  test("HANDOFF-07 failed source downloads and missing openers have a useful fallback", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!, { failed: true });
    const child = await open(page);
    await expect(child.getByRole("alert")).toContainText(
      "could not transfer the project",
    );
    await expect(page.getByRole("status")).toContainText(
      "Projektdatei konnte nicht geladen werden",
    );
    await page.goto(
      baseURL + "/?import=inf-schule&sender=https%3A%2F%2Finf-schule.de",
    );
    await expect(page.getByRole("alert")).toContainText(
      "connection to inf-schule is missing",
    );
    await page.goto(
      baseURL + "/?import=inf-schule&project=https://example.org/project.json",
    );
    await expect(page.getByRole("alert")).toContainText(
      "transfer link is invalid",
    );
  });

  test("HANDOFF-08 ordinary BlueK tabs ignore unsolicited project messages", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!);
    await page.goto("https://inf-schule.de/handoff-example/example.html");
    const popup = page.waitForEvent("popup");
    await page.evaluate((url) => {
      const child = window.open(url, "_blank");
      Object.assign(window, { handoffChild: child, handoffURL: url });
    }, baseURL + "/");
    const child = await popup;
    await expect(child.getByLabel("Project name")).toHaveValue("");
    await send(page, envelope(example));
    await expect(child.getByLabel("Project name")).toHaveValue("");
    await expect
      .poll(() => page.evaluate(() => (window as SourceWindow).readyCount))
      .toBe(0);
  });

  test("HANDOFF-09 complete editorial JSON keeps local media, positions and test metadata without the API size limit", async ({
    page,
    context,
    baseURL,
  }) => {
    const complete = {
      ...example,
      library: { id: "blueplay", version: 1 },
      readme: "Editorial notes\n".repeat(75_000),
      files: [
        ...example.files,
        {
          fileName: "MainTest.kt",
          source: "class MainTest {}",
          kind: "class",
          isTestClass: true,
        },
      ],
      defaultTestClass: "MainTest",
      cardPositions: { "Main.kt": { x: 42, y: 84 } },
      resources: [
        {
          path: "images/editorial.png",
          data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=",
        },
      ],
    };
    expect(Buffer.byteLength(JSON.stringify(complete))).toBeGreaterThan(
      1_048_576,
    );
    await provider(context, baseURL!, { project: complete });
    const child = await open(page);
    await expect(child.getByLabel("Project name")).toHaveValue(
      example.projectName,
    );
    await child.getByRole("button", { name: "Save", exact: true }).click();
    const download = child.waitForEvent("download");
    await child
      .getByRole("button", { name: /^Download BlueK project file/ })
      .click();
    const exported = JSON.parse(
      await readFile((await (await download).path())!, "utf8"),
    );
    expect(exported.library).toEqual(complete.library);
    expect(exported.readme).toBe(complete.readme);
    expect(exported.resources).toEqual(complete.resources);
    expect(exported.files).toEqual(complete.files);
    expect(exported.defaultTestClass).toBe("MainTest");
    expect(exported.cardPositions["Main.kt"]).toEqual({ x: 42, y: 84 });
  });
  test("HANDOFF-10 a local inf-schule page uses relative project paths without changing the script", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!);
    const child = await open(page, "http://localhost:5287");
    await expect(child.getByLabel("Project name")).toHaveValue(
      example.projectName,
    );
    await expect(page.getByRole("status")).toContainText(
      "Das Projekt ist in BlueK geöffnet.",
    );
  });

  test("HANDOFF-11 a blocked popup leaves a download fallback and the link can be retried", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!);
    await page.goto("https://inf-schule.de/handoff-example/example.html");
    await page.evaluate(() => {
      const original = window.open;
      window.open = () => {
        window.open = original;
        return null;
      };
    });
    const link = page.getByRole("link", {
      name: "In BlueK öffnen",
      exact: true,
    });
    await link.click();
    await expect(page.getByRole("status")).toContainText(
      "Erlaube das Öffnen eines neuen Tabs",
    );
    await expect(link).not.toHaveAttribute("aria-busy", "true");
    await expect(
      page.getByRole("link", { name: "Projekt als JSON herunterladen" }),
    ).toHaveAttribute("href", "./example.bluek.json");
    const popup = page.waitForEvent("popup");
    await link.focus();
    await page.keyboard.press("Enter");
    const child = await popup;
    await expect(child.getByLabel("Project name")).toHaveValue(
      example.projectName,
    );
  });

  test("HANDOFF-12 an untrusted sender parameter is rejected before starting a transfer", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!);
    const child = await open(page, "https://inf-schule.de.example");
    await expect(child.getByRole("alert")).toContainText(
      "transfer link is invalid",
    );
    await send(page, envelope(example));
    await expect(child.getByLabel("Project name")).toHaveValue("");
    await expect
      .poll(() => page.evaluate(() => (window as SourceWindow).readyCount))
      .toBe(0);
  });
  test("HANDOFF-13 the editorial dev.inf-schule.de site can transfer projects without sender changes", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!);
    const child = await open(page, "https://dev.inf-schule.de");
    await expect(child.getByLabel("Project name")).toHaveValue(
      example.projectName,
    );
    await expect(page.getByRole("status")).toContainText(
      "Das Projekt ist in BlueK geöffnet.",
    );
  });

  test("HANDOFF-14 a dev-domain lookalike cannot transfer projects", async ({
    page,
    context,
    baseURL,
  }) => {
    await provider(context, baseURL!);
    const child = await open(page, "https://dev.inf-schule.de.example");
    await expect(child.getByRole("alert")).toContainText(
      "transfer link is invalid",
    );
    await send(page, envelope(example));
    await expect(child.getByLabel("Project name")).toHaveValue("");
    await expect
      .poll(() => page.evaluate(() => (window as SourceWindow).readyCount))
      .toBe(0);
  });
});
