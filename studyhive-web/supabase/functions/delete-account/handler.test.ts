import { handleRequest, requireRecentPassword } from "./handler.ts";
const origin = "http://localhost:5173";
const userId = "11111111-1111-4111-8111-111111111111";
for (
  const [key, value] of Object.entries({
    APP_ORIGIN: origin,
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service",
    SUPABASE_ANON_KEY: "test-anon",
    STRIPE_SECRET_KEY: "sk_test_mock",
  })
) Deno.env.set(key, value);
const assert = (value: unknown, message = "Assertion failed") => {
  if (!value) throw new Error(message);
};
const jwt = (
  method = "password",
  timestamp = Date.now() / 1000,
  sub = userId,
) =>
  "header." + btoa(JSON.stringify({ sub, amr: [{ method, timestamp }] })) +
  ".signature";
const request = (body: object, token = jwt(), requestOrigin = origin) =>
  new Request(origin, {
    method: "POST",
    headers: {
      origin: requestOrigin,
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

Deno.test("recent password is bound to the verified token, not last sign-in or a refreshed iat", () => {
  requireRecentPassword(jwt(), userId);
  for (
    const token of [
      jwt("recovery"),
      jwt("password", Date.now() / 1000 - 301),
      jwt("password", Date.now() / 1000 + 60),
      jwt("password", Date.now() / 1000, "other"),
      "broken",
    ]
  ) {
    let rejected = false;
    try {
      requireRecentPassword(token, userId);
    } catch {
      rejected = true;
    }
    assert(rejected);
  }
});

async function fixture(
  options: {
    fail?: string;
    deletedCustomer?: boolean;
    wrongOwner?: boolean;
    invalidAuth?: boolean;
  } = {},
  run: (calls: string[]) => Promise<void>,
) {
  const original = globalThis.fetch;
  const calls: string[] = [];
  let files = true;
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url,
    );
    const method = init?.method ||
      (input instanceof Request ? input.method : "GET");
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    const key = method + " " + url.pathname;
    calls.push(key);
    const reply = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (options.fail === key) {
      return reply({ message: "Simulated unavailable service" }, 503);
    }
    if (url.pathname === "/auth/v1/user") {
      return options.invalidAuth
        ? reply({ message: "invalid token" }, 401)
        : reply({
          id: userId,
          email: "test@example.test",
          email_confirmed_at: "2026-01-01",
        });
    }
    if (url.pathname === "/rest/v1/users") {
      return reply({
        id: 7,
        subscription_tier: "premium",
        deletion_requested_at: null,
      });
    }
    if (url.pathname === "/rest/v1/account_deletions") return reply([]);
    if (url.pathname === "/rest/v1/rpc/begin_account_deletion") {
      assert(body.owner_ref === 7, "must ignore forged owner");
      return reply("cus_owned");
    }
    if (url.pathname === "/v1/customers/cus_owned") {
      if (method === "DELETE") return reply({ id: "cus_owned", deleted: true });
      return reply(
        options.deletedCustomer ? { id: "cus_owned", deleted: true } : {
          id: "cus_owned",
          livemode: false,
          metadata: { studyhive_user_id: options.wrongOwner ? "8" : "7" },
        },
      );
    }
    if (url.pathname === "/rest/v1/rpc/deletion_file_batch") {
      assert(body.owner_ref === 7);
      return reply(
        files ? [{ name: "7/ai/retained.txt" }, { name: "7/note.txt" }] : [],
      );
    }
    if (url.pathname === "/storage/v1/object/study-files") {
      assert(method === "DELETE");
      assert(body.prefixes.join(",") === "7/ai/retained.txt,7/note.txt");
      files = false;
      return reply([]);
    }
    if (url.pathname === "/auth/v1/admin/users/" + userId) {
      assert(!files, "auth must be last");
      return reply({ id: userId });
    }
    throw new Error("Unexpected fetch: " + key);
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test("deletion verifies password, cancels owned billing, removes all files, then deletes only the caller", () =>
  fixture({}, async (calls) => {
    const result = await handleRequest(
      request({
        action: "delete",
        confirmation: "DELETE",
        userId: "victim",
        profileId: 8,
      }),
    );
    assert(result.status === 200, await result.text());
    assert(
      calls.indexOf("DELETE /v1/customers/cus_owned") <
        calls.indexOf("DELETE /storage/v1/object/study-files"),
    );
    assert(calls.includes("DELETE /auth/v1/admin/users/" + userId));
  }));
Deno.test("confirmation, fresh password, verified identity and origin are required before mutations", async () => {
  for (
    const req of [
      request({ action: "delete", confirmation: "no" }),
      request({ action: "delete", confirmation: "DELETE" }, jwt("recovery")),
      request(
        { action: "delete", confirmation: "DELETE" },
        jwt(),
        "https://evil.test",
      ),
    ]
  ) {
    await fixture({}, async (calls) => {
      const result = await handleRequest(req);
      assert(result.status >= 400);
      assert(
        !calls.some((c) =>
          c.includes("begin_account_deletion") || c.startsWith("DELETE")
        ),
      );
    });
  }
  await fixture({ invalidAuth: true }, async (calls) => {
    assert(
      (await handleRequest(
        request({ action: "delete", confirmation: "DELETE" }),
      )).status === 401,
    );
    assert(!calls.some((c) => c.includes("begin_account_deletion")));
  });
});
Deno.test("billing, storage and Auth failures preserve retry state and never skip cleanup stages", async () => {
  for (
    const fail of [
      "DELETE /v1/customers/cus_owned",
      "DELETE /storage/v1/object/study-files",
      "DELETE /auth/v1/admin/users/" + userId,
    ]
  ) {
    await fixture({ fail }, async (calls) => {
      const result = await handleRequest(
        request({ action: "delete", confirmation: "DELETE" }),
      );
      assert(result.status >= 400);
      if (!fail.includes("/auth/")) {
        assert(
          !calls.some((c) => c === "DELETE /auth/v1/admin/users/" + userId),
        );
      }
      assert(
        calls.includes("PATCH /rest/v1/account_deletions"),
        "release deletion lease for retry",
      );
    });
  }
});
Deno.test("retry after completed cancellation tolerates a deleted Stripe customer", () =>
  fixture({ deletedCustomer: true }, async (calls) => {
    assert(
      (await handleRequest(
        request({ action: "delete", confirmation: "DELETE" }),
      )).status === 200,
    );
    assert(!calls.includes("DELETE /v1/customers/cus_owned"));
  }));
Deno.test("mismatched billing ownership fails before any provider deletion", () =>
  fixture({ wrongOwner: true }, async (calls) => {
    assert(
      (await handleRequest(
        request({ action: "delete", confirmation: "DELETE" }),
      )).status === 409,
    );
    assert(!calls.some((c) => c.startsWith("DELETE")));
  }));
