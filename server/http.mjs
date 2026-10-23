export class HttpError extends Error {
  constructor(status, error, details = {}) {
    super(error);
    this.status = status;
    this.details = details;
  }
}
export function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}
export async function body(request, limit) {
  if (
    !String(request.headers["content-type"] || "").startsWith(
      "application/json",
    )
  )
    throw new HttpError(400, "invalid");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, "too-large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid");
  }
}
export const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
