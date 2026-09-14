import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fileType,
  validateGeneration,
  verifyStripeSignature,
  subscriptionExpiry,
  readLimited,
} from "../supabase/functions/_shared/pro-core";

test("AI outputs are escaped and malformed answers are rejected before saving", () => {
  const output = validateGeneration("notes", {
    title: "Notes",
    body: "<script>alert(1)</script>\nA & B",
  });
  assert.equal(
    output.body,
    "<p>&lt;script&gt;alert(1)&lt;/script&gt;<br>A &amp; B</p>",
  );
  assert.throws(() =>
    validateGeneration("quiz", {
      title: "Quiz",
      questions: [{ question: "Q", options: ["a", "b", "c", "d"], correct: 4 }],
    }),
  );
  assert.throws(() =>
    validateGeneration("flashcards", { title: "Deck", cards: [] }),
  );
  assert.throws(() =>
    validateGeneration("notes", { title: "Notes", body: "" }),
  );
});
test("document input requires supported signatures, UTF-8 and bounded size", () => {
  assert.equal(
    fileType("a.pdf", new TextEncoder().encode("%PDF-1.7")),
    "application/pdf",
  );
  assert.throws(() => fileType("a.pdf", new TextEncoder().encode("fake")));
  assert.throws(() => fileType("a.txt", new Uint8Array([255])));
  assert.throws(() => fileType("a.txt", new Uint8Array(2 * 1024 * 1024 + 1)));
  assert.throws(() => fileType("a.exe", new Uint8Array([1])));
});
test("Stripe signatures reject modified payloads and replayed timestamps", async () => {
  const raw = '{"type":"customer.subscription.updated"}',
    stamp = "1700000000",
    secret = "whsec_test";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(stamp + "." + raw),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  await verifyStripeSignature(
    raw,
    `t=${stamp},v1=${signature}`,
    secret,
    1700000000000,
  );
  await assert.rejects(
    verifyStripeSignature(
      raw + " ",
      `t=${stamp},v1=${signature}`,
      secret,
      1700000000000,
    ),
  );
  await assert.rejects(
    verifyStripeSignature(
      raw,
      `t=${stamp},v1=${signature}`,
      secret,
      1700000400000,
    ),
  );
});
test("only the configured price and provider mode grant current subscription access", () => {
  const sub = {
    status: "active",
    livemode: false,
    items: {
      data: [{ price: { id: "price_pro" }, current_period_end: 1800000000 }],
    },
  };
  assert.equal(
    subscriptionExpiry([sub], "price_pro", false),
    new Date(1800000000000).toISOString(),
  );
  assert.equal(
    subscriptionExpiry([{ ...sub, status: "past_due" }], "price_pro", false),
    null,
  );
  assert.equal(subscriptionExpiry([sub], "price_other", false), null);
  assert.equal(subscriptionExpiry([sub], "price_pro", true), null);
});
test("request size limits count actual bytes, not just content-length", async () => {
  await assert.rejects(
    readLimited(
      new Request("https://example.test", {
        method: "POST",
        body: "too large",
      }),
      3,
    ),
  );
  assert.equal(
    await readLimited(
      new Request("https://example.test", { method: "POST", body: "ok" }),
      3,
    ),
    "ok",
  );
});
