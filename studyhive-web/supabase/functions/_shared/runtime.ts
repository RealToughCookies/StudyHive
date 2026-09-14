import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { HttpError, readLimited } from "./pro-core.ts";
export function env(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new HttpError(503, "This service is not configured yet.");
  return v;
}
export const admin = () =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
export function appOrigin() {
  const url = new URL(env("APP_ORIGIN"));
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname))
  )
    throw new HttpError(503, "Invalid app origin configuration");
  return url.origin;
}
export function json(value: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers":
              "authorization, apikey, content-type, x-client-info",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            Vary: "Origin",
          }
        : {}),
    },
  });
}
export async function userContext(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer "))
    throw new HttpError(401, "Sign in to continue.");
  const db = admin();
  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user?.email_confirmed_at)
    throw new HttpError(401, "Sign in with a verified account.");
  const { data: profile, error: profileError } = await db
    .from("users")
    .select("id,subscription_tier,subscription_expires_at")
    .eq("auth_user_id", data.user.id)
    .single();
  if (profileError || !profile)
    throw new HttpError(401, "Account unavailable.");
  const scoped = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, scoped, profile, user: data.user };
}
export function check<T extends { error: any; data: any }>(
  result: T,
): T["data"] {
  if (result.error) throw new HttpError(400, result.error.message);
  return result.data;
}
export async function body(req: Request) {
  try {
    return JSON.parse(await readLimited(req, 8192));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid request.");
  }
}
export async function stripe(
  path: string,
  method = "GET",
  fields?: Record<string, string>,
  idempotency?: string,
) {
  const key = env("STRIPE_SECRET_KEY");
  if (!key.startsWith("sk_test_"))
    throw new HttpError(
      503,
      "Only Stripe test mode is enabled for this build.",
    );
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: {
      Authorization: "Bearer " + key,
      "Stripe-Version": "2025-06-30.basil",
      ...(fields
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok)
    throw new HttpError(502, "Payment provider unavailable. Please try again.");
  return await res.json();
}
