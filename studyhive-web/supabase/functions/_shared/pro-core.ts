export type Kind = "notes" | "guide" | "flashcards" | "quiz";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function validId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
export function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export const FILE_LIMIT = 2 * 1024 * 1024;
export function fileType(path: string, bytes: Uint8Array) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!bytes.length || bytes.length > FILE_LIMIT)
    throw new HttpError(400, "Choose a nonempty file no larger than 2 MB.");
  if (ext === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-")
    return "application/pdf";
  if (
    ext === "docx" &&
    bytes[0] === 80 &&
    bytes[1] === 75 &&
    bytes[2] === 3 &&
    bytes[3] === 4
  )
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "txt") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (!text.trim() || text.includes("\0") || text.length > 60000)
        throw Error();
      return "text/plain";
    } catch {
      throw new HttpError(
        400,
        "Choose a UTF-8 text file with at most 60,000 characters.",
      );
    }
  }
  throw new HttpError(400, "Choose a valid PDF, DOCX, or UTF-8 TXT file.");
}
const short = (x: unknown, max: number) =>
  typeof x === "string" && x.trim().length > 0 && x.length <= max;
export function validateGeneration(kind: Kind, value: any) {
  if (!value || !short(value.title, 200))
    throw new HttpError(
      502,
      "AI returned an invalid title. No allowance was used.",
    );
  if (kind === "notes" || kind === "guide") {
    if (!short(value.body, 50000))
      throw new HttpError(
        502,
        "No usable notes were generated. No allowance was used.",
      );
    // Generated text is escaped before it enters the rich-text editor; never trust model HTML.
    return {
      title: value.title,
      body: "<p>" + escapeHtml(value.body).replace(/\n/g, "<br>") + "</p>",
      items: null,
    };
  }
  const items = kind === "flashcards" ? value.cards : value.questions;
  if (
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > (kind === "flashcards" ? 30 : 20)
  )
    throw new HttpError(
      502,
      "AI returned invalid study materials. No allowance was used.",
    );
  for (const item of items) {
    if (
      kind === "flashcards"
        ? !short(item?.front, 2000) || !short(item?.back, 4000)
        : !short(item?.question, 2000) ||
          !Array.isArray(item?.options) ||
          item.options.length !== 4 ||
          !item.options.every((v: unknown) => short(v, 1000)) ||
          !Number.isInteger(item.correct) ||
          item.correct < 0 ||
          item.correct > 3
    )
      throw new HttpError(
        502,
        "AI returned invalid study materials. No allowance was used.",
      );
  }
  return { title: value.title, body: "", items };
}
export function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function schemaFor(kind: Kind) {
  const str = { type: "string" };
  const obj = (properties: any) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });
  if (kind === "notes" || kind === "guide")
    return obj({ title: str, body: str });
  return obj(
    kind === "flashcards"
      ? {
          title: str,
          cards: { type: "array", items: obj({ front: str, back: str }) },
        }
      : {
          title: str,
          questions: {
            type: "array",
            items: obj({
              question: str,
              options: { type: "array", items: str },
              correct: { type: "integer" },
            }),
          },
        },
  );
}
export async function readLimited(
  request: Pick<Request, "body" | "headers">,
  limit: number,
) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return new TextDecoder().decode(bytes);
}
export async function verifyStripeSignature(
  raw: string,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!header) throw new HttpError(400, "Missing webhook signature");
  const fields = header.split(",").map((x) => x.split("="));
  const stamp = fields.find((x) => x[0] === "t")?.[1];
  if (
    !stamp ||
    !/^\d+$/.test(stamp) ||
    Math.abs(now / 1000 - Number(stamp)) > 300
  )
    throw new HttpError(400, "Expired webhook signature");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  for (const [, signature] of fields.filter((x) => x[0] === "v1")) {
    if (!/^[a-f0-9]{64}$/.test(signature)) continue;
    const bytes = Uint8Array.from(signature.match(/../g)!, (s) =>
      parseInt(s, 16),
    );
    if (
      await crypto.subtle.verify(
        "HMAC",
        key,
        bytes,
        new TextEncoder().encode(stamp + "." + raw),
      )
    )
      return;
  }
  throw new HttpError(400, "Invalid webhook signature");
}
export function subscriptionExpiry(
  subscriptions: any[],
  priceId: string,
  live: boolean,
) {
  let end = 0;
  for (const sub of subscriptions) {
    if (sub.livemode !== live || !["active", "trialing"].includes(sub.status))
      continue;
    for (const item of sub.items?.data || []) {
      if (
        item.price?.id === priceId &&
        Number.isFinite(item.current_period_end)
      )
        end = Math.max(end, item.current_period_end);
    }
  }
  return end ? new Date(end * 1000).toISOString() : null;
}
