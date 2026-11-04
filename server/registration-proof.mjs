import { randomBytes, randomInt } from "node:crypto";
import { createChallenge, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { HttpError, record } from "./http.mjs";

// A restart invalidates pending challenges. Accepted challenges survive restarts.
export function createRegistrationProof(database) {
  database.exec(
    "CREATE TABLE IF NOT EXISTS used_registration_proofs (signature TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)",
  );
  const secret = randomBytes(32).toString("hex");
  const keySecret = randomBytes(32).toString("hex");
  const cost = 5000;
  const configured = Number(process.env.BLUEK_REGISTRATION_WORK || 10000);
  if (!Number.isInteger(configured) || configured < 1 || configured > 100000)
    throw new Error("Invalid BLUEK_REGISTRATION_WORK");
  let active = 0;
  async function bounded(fn) {
    if (active >= 4) throw new HttpError(503, "busy");
    active++;
    try {
      return await fn();
    } finally {
      active--;
    }
  }
  async function challenge() {
    return bounded(() =>
      createChallenge({
        algorithm: "PBKDF2/SHA-256",
        cost,
        deriveKey,
        counter: randomInt(
          Math.max(1, Math.floor(configured / 2)),
          configured + 1,
        ),
        expiresAt: new Date(Date.now() + 20 * 60000),
        hmacSignatureSecret: secret,
        hmacKeySignatureSecret: keySecret,
      }),
    );
  }
  async function consume(proof) {
    if (!record(proof) || !record(proof.challenge) || !record(proof.solution))
      throw new HttpError(400, "registration-proof");
    const c = proof.challenge;
    if (
      typeof c.signature !== "string" ||
      !/^[a-f0-9]{64}$/.test(c.signature) ||
      !record(c.parameters) ||
      c.parameters.algorithm !== "PBKDF2/SHA-256" ||
      c.parameters.cost !== cost ||
      !Number.isInteger(c.parameters.expiresAt)
    )
      throw new HttpError(400, "registration-proof");
    const result = await bounded(async () => {
      try {
        return await verifySolution({
          challenge: c,
          solution: proof.solution,
          deriveKey,
          hmacSignatureSecret: secret,
          hmacKeySignatureSecret: keySecret,
        });
      } catch {
        return { verified: false };
      }
    });
    if (!result.verified) throw new HttpError(400, "registration-proof");
    const inserted = database
      .prepare("INSERT OR IGNORE INTO used_registration_proofs VALUES (?, ?)")
      .run(c.signature, c.parameters.expiresAt * 1000);
    if (!inserted.changes) throw new HttpError(400, "registration-proof");
  }
  function cleanup() {
    database
      .prepare("DELETE FROM used_registration_proofs WHERE expires_at < ?")
      .run(Date.now());
  }
  return { challenge, consume, cleanup };
}
