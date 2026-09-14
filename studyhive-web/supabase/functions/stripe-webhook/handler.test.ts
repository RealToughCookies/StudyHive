import { handleRequest } from "./handler.ts";
const secret = "whsec_test";
for (const [k, v] of Object.entries({
  STRIPE_WEBHOOK_SECRET: secret,
  STRIPE_SECRET_KEY: "sk_test_placeholder",
  STRIPE_PRICE_ID: "price_pro",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-test-key",
}))
  Deno.env.set(k, v);
async function request(event: unknown) {
  const raw = JSON.stringify(event),
    stamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = Array.from(
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
  return new Request(
    "https://project.supabase.co/functions/v1/stripe-webhook",
    {
      method: "POST",
      body: raw,
      headers: { "stripe-signature": `t=${stamp},v1=${sig}` },
    },
  );
}
Deno.test(
  "webhook refuses unsigned input without touching billing state",
  async () => {
    const res = await handleRequest(
      new Request("https://test", { method: "POST", body: "{}" }),
    );
    if (res.status !== 400) throw Error("Unsigned webhook accepted");
  },
);
Deno.test(
  "out-of-order signed events reconcile the current Stripe state, not event claims",
  async () => {
    const old = globalThis.fetch;
    let applied = false;
    globalThis.fetch = async (input, init) => {
      const url = String(input),
        payload = JSON.parse(String(init?.body || "{}"));
      if (url.includes("/rest/v1/billing_customers"))
        return Response.json({ user_id: 7 });
      if (url.includes("/rpc/claim_billing_sync")) return Response.json(true);
      if (url.includes("api.stripe.com/v1/subscriptions"))
        return Response.json({
          has_more: false,
          data: [
            {
              livemode: false,
              status: "canceled",
              items: {
                data: [
                  {
                    price: { id: "price_pro" },
                    current_period_end: 2000000000,
                  },
                ],
              },
            },
          ],
        });
      if (url.includes("/rpc/apply_billing_sync")) {
        if (payload.pro_until !== null)
          throw Error("Old event restored access");
        applied = true;
        return Response.json(null);
      }
      throw Error("Unexpected request");
    };
    try {
      const res = await handleRequest(
        await request({
          type: "customer.subscription.updated",
          livemode: false,
          data: { object: { customer: "cus_test", status: "active" } },
        }),
      );
      if (res.status !== 200 || !applied) throw Error(await res.text());
    } finally {
      globalThis.fetch = old;
    }
  },
);
Deno.test(
  "validly signed live events cannot enable payments in the test build",
  async () => {
    const res = await handleRequest(
      await request({
        type: "customer.subscription.created",
        livemode: true,
        data: { object: { customer: "cus_test" } },
      }),
    );
    if (res.status !== 400) throw Error("Live event accepted");
  },
);
