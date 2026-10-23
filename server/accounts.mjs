import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
import { HttpError, body, record } from "./http.mjs";
const derive = promisify(scrypt);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const day = 86400000;
const secure = process.env.BLUEK_COOKIE_SECURE !== "0";
const cookieName = secure ? "__Host-bluek_session" : "bluek_session";
const sameSite = process.env.BLUEK_COOKIE_SAMESITE === "None" ? "None" : "Lax";
if (!secure && sameSite === "None")
  throw new Error("SameSite=None requires secure cookies.");

export function createAccounts(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
  CREATE TABLE IF NOT EXISTS login_attempts (
    username TEXT PRIMARY KEY, failures INTEGER NOT NULL, next_at INTEGER NOT NULL, last_at INTEGER NOT NULL
  );`);
  const busy = new Set();
  let hashing = 0;
  async function passwordHash(password, encoded) {
    if (hashing >= 4) throw new HttpError(503, "busy");
    hashing++;
    try {
      const salt = encoded
        ? encoded.split(":")[1]
        : randomBytes(16).toString("hex");
      // OWASP's scrypt N=2^15, r=8, p=3 profile; asynchronous bounded KDF.
      const key = await derive(password, salt, 64, {
        N: 32768,
        r: 8,
        p: 3,
        maxmem: 64 * 1024 * 1024,
      });
      return `scrypt-v1:${salt}:${key.toString("hex")}`;
    } finally {
      hashing--;
    }
  }
  const dummy = `scrypt-v1:${randomBytes(16).toString("hex")}:${randomBytes(64).toString("hex")}`;
  function credentials(value) {
    if (!record(value)) throw new HttpError(400, "credentials-format");
    const username =
      typeof value.username === "string"
        ? value.username.trim().toLowerCase()
        : "";
    if (
      !/^[a-z0-9_-]{3,32}$/.test(username) ||
      typeof value.password !== "string" ||
      value.password.length < 12 ||
      value.password.length > 128
    )
      throw new HttpError(400, "credentials-format");
    return { username, password: value.password };
  }
  function setCookie(response, token, age = 7 * 86400) {
    response.setHeader(
      "Set-Cookie",
      `${cookieName}=${token}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=${sameSite}; Max-Age=${age}`,
    );
  }
  function tokenHash(request) {
    const token = String(request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    return token && /^[a-f0-9]{64}$/.test(token) ? hash(token) : "";
  }
  function session(request, required = true) {
    const token = tokenHash(request);
    const now = Date.now();
    const user = database
      .prepare(
        `SELECT accounts.*, sessions.token_hash, sessions.expires_at, sessions.last_used_at AS session_used
      FROM sessions JOIN accounts ON accounts.id = sessions.account_id WHERE token_hash = ?`,
      )
      .get(token);
    if (
      !user ||
      user.expires_at <= now ||
      user.session_used <= now - day ||
      user.blocked
    ) {
      if (token)
        database
          .prepare("DELETE FROM sessions WHERE token_hash = ?")
          .run(token);
      if (required)
        throw new HttpError(
          user?.blocked ? 403 : 401,
          user?.blocked ? "account-blocked" : "authentication",
        );
      return null;
    }
    database
      .prepare("UPDATE sessions SET last_used_at = ? WHERE token_hash = ?")
      .run(now, token);
    database
      .prepare("UPDATE accounts SET last_used_at = ? WHERE id = ?")
      .run(now, user.id);
    return user;
  }
  function issue(response, user) {
    const token = randomBytes(32).toString("hex");
    database
      .prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)")
      .run(hash(token), user.id, Date.now() + 7 * day, Date.now());
    setCookie(response, token);
  }
  function requireWrite(request) {
    // Custom header + exact CORS allowlist prevents form and cross-origin CSRF,
    // including attacks from untrusted sibling domains. Cookies are host-only.
    if (request.headers["x-bluek-request"] !== "1")
      throw new HttpError(403, "origin");
  }
  async function handle(request, response, path) {
    if (!path.startsWith("/api/account")) return null;
    if (request.method === "GET" && path === "/api/account") {
      const user = session(request, false);
      return { user: user ? { id: user.id, username: user.username } : null };
    }
    requireWrite(request);
    if (request.method === "POST" && path === "/api/account/logout") {
      database
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .run(tokenHash(request));
      setCookie(response, "", 0);
      return { ok: true };
    }
    if (
      request.method === "POST" &&
      ["/api/account/register", "/api/account/login"].includes(path)
    ) {
      const { username, password } = credentials(await body(request, 4096));
      if (busy.has(username))
        throw new HttpError(429, "login-wait", { retryAfter: 1 });
      const attempt = database
        .prepare("SELECT * FROM login_attempts WHERE username = ?")
        .get(username);
      if (attempt?.next_at > Date.now())
        throw new HttpError(429, "login-wait", {
          retryAfter: Math.ceil((attempt.next_at - Date.now()) / 1000),
        });
      busy.add(username);
      try {
        let user = database
          .prepare("SELECT * FROM accounts WHERE username = ?")
          .get(username);
        if (path.endsWith("/register")) {
          if (user) throw new HttpError(409, "username-taken");
          const encoded = await passwordHash(password);
          user = { id: randomUUID(), username };
          database
            .prepare(
              "INSERT INTO accounts (id, username, password_hash, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)",
            )
            .run(user.id, username, encoded, Date.now(), Date.now());
        } else {
          const encoded = await passwordHash(
            password,
            user?.password_hash || dummy,
          );
          // Re-read after KDF: a concurrent administrative block or password
          // change must not issue a valid session with stale credentials.
          const current = database
            .prepare("SELECT * FROM accounts WHERE username = ?")
            .get(username);
          if (
            !user ||
            !current ||
            current.password_hash !== user.password_hash ||
            !timingSafeEqual(
              Buffer.from(encoded),
              Buffer.from(user.password_hash),
            )
          ) {
            const failures =
              attempt && attempt.last_at > Date.now() - 15 * 60000
                ? attempt.failures + 1
                : 1;
            const delay = Math.min(
              30000,
              1000 * 2 ** Math.min(failures - 1, 5),
            );
            database
              .prepare(
                "INSERT OR REPLACE INTO login_attempts VALUES (?, ?, ?, ?)",
              )
              .run(username, failures, Date.now() + delay, Date.now());
            throw new HttpError(401, "login-failed", {
              retryAfter: delay / 1000,
            });
          }
          if (current.blocked) throw new HttpError(403, "account-blocked");
          user = current;
        }
        database
          .prepare("DELETE FROM login_attempts WHERE username = ?")
          .run(username);
        database
          .prepare("UPDATE accounts SET last_used_at = ? WHERE id = ?")
          .run(Date.now(), user.id);
        // Rotate the session used for this browser; do not accumulate login cookies.
        database
          .prepare("DELETE FROM sessions WHERE token_hash = ?")
          .run(tokenHash(request));
        issue(response, user);
        return { user: { id: user.id, username: user.username } };
      } finally {
        busy.delete(username);
      }
    }
    if (request.method === "POST" && path === "/api/account/password") {
      const user = session(request);
      const input = await body(request, 4096);
      if (!record(input)) throw new HttpError(400, "credentials-format");
      const attempt = database
        .prepare("SELECT * FROM login_attempts WHERE username = ?")
        .get(user.username);
      if (attempt?.next_at > Date.now())
        throw new HttpError(429, "login-wait", {
          retryAfter: Math.ceil((attempt.next_at - Date.now()) / 1000),
        });
      credentials({ username: user.username, password: input.newPassword });
      if (typeof input.password !== "string" || input.password.length > 128)
        throw new HttpError(400, "credentials-format");
      if (busy.has(user.username))
        throw new HttpError(429, "login-wait", { retryAfter: 1 });
      busy.add(user.username);
      try {
        const encoded = await passwordHash(input.password, user.password_hash);
        if (
          !timingSafeEqual(
            Buffer.from(encoded),
            Buffer.from(user.password_hash),
          )
        ) {
          const failures =
            attempt && attempt.last_at > Date.now() - 15 * 60000
              ? attempt.failures + 1
              : 1;
          const delay = Math.min(30000, 1000 * 2 ** Math.min(failures - 1, 5));
          database
            .prepare(
              "INSERT OR REPLACE INTO login_attempts VALUES (?, ?, ?, ?)",
            )
            .run(user.username, failures, Date.now() + delay, Date.now());
          throw new HttpError(401, "login-failed");
        }
        const replacement = await passwordHash(input.newPassword);
        session(request); // Revalidate after awaits (logout, expiry or block).
        if (
          database
            .prepare("SELECT password_hash FROM accounts WHERE id = ?")
            .get(user.id)?.password_hash !== user.password_hash
        )
          throw new HttpError(401, "authentication");
        database.transaction(() => {
          database
            .prepare("UPDATE accounts SET password_hash = ? WHERE id = ?")
            .run(replacement, user.id);
          database
            .prepare("DELETE FROM login_attempts WHERE username = ?")
            .run(user.username);
          database
            .prepare("DELETE FROM sessions WHERE account_id = ?")
            .run(user.id);
        })();
        issue(response, user);
        return { ok: true };
      } finally {
        busy.delete(user.username);
      }
    }
    throw new HttpError(404, "not-found");
  }
  function cleanup() {
    const now = Date.now();
    database
      .prepare(
        "DELETE FROM sessions WHERE expires_at <= ? OR last_used_at <= ?",
      )
      .run(now, now - day);
    database
      .prepare("DELETE FROM login_attempts WHERE last_at < ?")
      .run(now - 15 * 60000);
    const cutoff = new Date(now);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    database
      .prepare("DELETE FROM accounts WHERE last_used_at < ?")
      .run(cutoff.getTime());
  }
  return { handle, session, requireWrite, cleanup };
}
