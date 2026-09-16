import {
  appOrigin,
  body,
  check,
  json,
  stripe,
  userContext,
} from "../_shared/runtime.ts";
import { HttpError } from "../_shared/pro-core.ts";

// Call only AFTER getUser has verified this exact bearer token with Supabase Auth.
export function requireRecentPassword(
  token: string,
  userId: string,
  now = Date.now(),
) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(
      atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")),
    );
    if (
      claims.sub === userId && Array.isArray(claims.amr) &&
      claims.amr.some((entry: any) =>
        entry.method === "password" && Number.isFinite(entry.timestamp) &&
        entry.timestamp * 1000 <= now + 30000 &&
        entry.timestamp * 1000 >= now - 300000
      )
    ) return;
  } catch { /* malformed or missing claims fail closed */ }
  throw new HttpError(401, "Re-enter your password to delete your account.");
}

export async function handleRequest(req: Request) {
  let origin: string | undefined;
  try {
    origin = appOrigin();
    if (req.headers.get("origin") !== origin) {
      throw new HttpError(403, "Origin not allowed.");
    }
    if (req.method === "OPTIONS") return json({}, 200, origin);
    if (req.method !== "POST") throw new HttpError(405, "Use POST.");
    const { db, profile, user } = await userContext(req, true);
    const input = await body(req);
    if (input?.action === "status") {
      // Verifies migration availability as well as handler deployment.
      check(
        await db.from("account_deletions").select("user_id").eq(
          "user_id",
          profile.id,
        ),
      );
      return json(
        { available: true, pending: !!profile.deletion_requested_at },
        200,
        origin,
      );
    }
    if (input?.action !== "delete" || input.confirmation !== "DELETE") {
      throw new HttpError(400, "Type DELETE to confirm.");
    }
    requireRecentPassword(req.headers.get("authorization")!.slice(7), user.id);
    const token = crypto.randomUUID();
    const customer = check(
      await db.rpc("begin_account_deletion", {
        owner_ref: profile.id,
        token_ref: token,
      }),
    );
    try {
      if (customer) {
        const path = "customers/" + encodeURIComponent(customer);
        const existing = await stripe(path);
        if (existing.id !== customer) {
          throw new HttpError(
            502,
            "Billing account could not be verified. Retry deletion.",
          );
        }
        if (!existing.deleted) {
          if (
            existing.livemode !== false ||
            existing.metadata?.studyhive_user_id !== String(profile.id)
          ) {
            throw new HttpError(
              409,
              "Billing ownership could not be verified. Contact support before retrying.",
            );
          }
          // Deleting the dedicated customer immediately cancels all subscriptions and
          // prevents old checkout/portal sessions from creating a new subscription.
          const deleted = await stripe(path, "DELETE");
          if (deleted.id !== customer || deleted.deleted !== true) {
            throw new HttpError(
              502,
              "Subscription cancellation could not be confirmed. Retry deletion.",
            );
          }
        }
      }
      // Bound work per invocation; retrying resumes from remaining objects. Auth stays last.
      const deadline = Date.now() + 40000;
      for (let batch = 0; batch < 20; batch++) {
        const files = check(
          await db.rpc("deletion_file_batch", {
            owner_ref: profile.id,
            token_ref: token,
          }),
        );
        if (!Array.isArray(files)) throw new Error("Invalid file inventory");
        if (!files.length) {
          const { error } = await db.auth.admin.deleteUser(user.id);
          if (error) {
            throw new HttpError(
              503,
              "Account cleanup could not finish. Retry deletion in Settings.",
            );
          }
          return json({ deleted: true }, 200, origin);
        }
        const paths = files.map((file: { name: string }) => file.name);
        if (
          paths.some((name: string) =>
            !name.startsWith(profile.id + "/") || name.split("/").includes("..")
          )
        ) throw new Error("Invalid file inventory");
        check(await db.storage.from("study-files").remove(paths));
        if (Date.now() > deadline) break;
      }
      return json(
        {
          deleted: false,
          pending: true,
          message: "Some files remain. Retry deletion to finish cleanup.",
        },
        202,
        origin,
      );
    } finally {
      await db.from("account_deletions").update({
        lease_token: null,
        lease_until: null,
      }).eq("user_id", profile.id).eq("lease_token", token);
    }
  } catch (error) {
    return json(
      {
        error: error instanceof HttpError
          ? error.message
          : "Account deletion could not finish. Retry in Settings; your account may already be scheduled for deletion.",
      },
      error instanceof HttpError ? error.status : 500,
      origin,
    );
  }
}
