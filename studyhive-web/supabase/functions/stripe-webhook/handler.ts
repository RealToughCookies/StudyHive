import { admin, check, env, json, stripe } from "../_shared/runtime.ts";
import {
  HttpError,
  readLimited,
  subscriptionExpiry,
  verifyStripeSignature,
} from "../_shared/pro-core.ts";
export async function handleRequest(req: Request) {
  try {
    if (req.method !== "POST") throw new HttpError(405, "Use POST");
    const raw = await readLimited(req, 262144);
    await verifyStripeSignature(
      raw,
      req.headers.get("stripe-signature"),
      env("STRIPE_WEBHOOK_SECRET"),
    );
    const event = JSON.parse(raw);
    if (event.livemode !== false)
      throw new HttpError(400, "Only test events are accepted");
    if (
      ![
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "checkout.session.completed",
        "invoice.paid",
        "invoice.payment_failed",
      ].includes(event.type)
    )
      return json({ received: true });
    const customer = event.data?.object?.customer;
    if (typeof customer !== "string" || !customer.startsWith("cus_"))
      throw new HttpError(400, "Invalid customer");
    const db = admin();
    const mapping = check(
      await db
        .from("billing_customers")
        .select("user_id")
        .eq("customer_id", customer)
        .maybeSingle(),
    );
    if (!mapping) return json({ received: true });
    const token = crypto.randomUUID();
    const acquired = check(
      await db.rpc("claim_billing_sync", {
        customer_ref: customer,
        token_ref: token,
      }),
    );
    if (!acquired) throw new HttpError(409, "Subscription sync busy; retry");
    // Read the current provider state under a lease. Duplicate/out-of-order events cannot restore stale access.
    const subscriptions = await stripe(
      "subscriptions?customer=" +
        encodeURIComponent(customer) +
        "&status=all&limit=100",
    );
    if (subscriptions.has_more)
      throw new HttpError(
        503,
        "Subscription reconciliation requires pagination",
      );
    const until = subscriptionExpiry(
      subscriptions.data,
      env("STRIPE_PRICE_ID"),
      false,
    );
    check(
      await db.rpc("apply_billing_sync", {
        customer_ref: customer,
        token_ref: token,
        pro_until: until,
      }),
    );
    return json({ received: true });
  } catch (error) {
    return json(
      {
        error:
          error instanceof HttpError ? error.message : "Webhook failed; retry",
      },
      error instanceof HttpError ? error.status : 500,
    );
  }
}
