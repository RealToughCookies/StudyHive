import { handleRequest } from "./handler.ts";
const origin = "http://localhost:5173";
for (const [k, v] of Object.entries({
  APP_ORIGIN: origin,
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  SUPABASE_ANON_KEY: "test-anon-key",
  OPENAI_API_KEY: "test-ai-key",
  OPENAI_MODEL: "test-model",
}))
  Deno.env.set(k, v);
const assert = (v: unknown, message: string) => {
  if (!v) throw Error(message);
};
const req = (input: unknown, token = "valid") =>
  new Request(origin, {
    method: "POST",
    headers: {
      origin,
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
Deno.test(
  "handler rejects untrusted origins and missing authentication before touching providers",
  async () => {
    const old = globalThis.fetch;
    globalThis.fetch = () => {
      throw Error("Unexpected provider access");
    };
    try {
      assert(
        (
          await handleRequest(
            new Request(origin, {
              method: "POST",
              headers: { origin: "https://evil.test" },
            }),
          )
        ).status === 403,
        "origin must be blocked",
      );
      assert(
        (
          await handleRequest(
            new Request(origin, { method: "POST", headers: { origin } }),
          )
        ).status === 401,
        "missing token must be blocked",
      );
    } finally {
      globalThis.fetch = old;
    }
  },
);
Deno.test(
  "AI HTTP flow uses the verified owner, validates output and commits a completed artifact",
  async () => {
    const old = globalThis.fetch;
    let finish = 0,
      openai = 0;
    globalThis.fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      const reply = (value: unknown, status = 200) =>
        Promise.resolve(
          new Response(JSON.stringify(value), {
            status,
            headers: { "content-type": "application/json" },
          }),
        );
      if (url.pathname === "/auth/v1/user")
        return reply({
          id: "11111111-1111-4111-8111-111111111111",
          email: "test@example.test",
          email_confirmed_at: "2026-01-01",
        });
      if (url.pathname === "/rest/v1/users")
        return reply({
          id: 7,
          subscription_tier: "premium",
          subscription_expires_at: "2099-01-01",
        });
      if (url.pathname === "/rest/v1/notes")
        return reply({
          id: 9,
          title: "Study",
          content: "Force equals mass times acceleration.",
          class_id: null,
        });
      const body = JSON.parse(String(init?.body || "{}"));
      if (url.pathname === "/rest/v1/rpc/reserve_ai_job") {
        assert(body.owner_ref === 7, "forged owner must be ignored");
        return reply({ id, status: "pending" });
      }
      if (url.hostname === "api.openai.com") {
        openai++;
        assert(body.store === false, "provider storage must be disabled");
        assert(!body.tools, "no tool execution from documents");
        return reply({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    title: "Guide",
                    body: "<b>Force</b> = mass × acceleration",
                  }),
                },
              ],
            },
          ],
        });
      }
      if (url.pathname === "/rest/v1/rpc/finish_ai_job") {
        finish++;
        assert(body.owner_ref === 7, "wrong owner");
        assert(
          body.result_body.includes("&lt;b&gt;"),
          "generated HTML was not escaped",
        );
        return reply({
          id,
          status: "completed",
          artifact_id: 42,
          artifact_type: "note",
        });
      }
      throw Error("Unexpected provider route: " + url.pathname);
    };
    try {
      const response = await handleRequest(
        req({
          action: "generate",
          kind: "guide",
          noteId: 9,
          userId: 999,
          requestId: id,
        }),
      );
      assert(response.status === 200, await response.clone().text());
      assert((await response.json()).artifact_id === 42, "missing artifact");
      assert(finish === 1 && openai === 1, "duplicate provider execution");
    } finally {
      globalThis.fetch = old;
    }
  },
);
Deno.test("free users cannot spend AI budget", async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/auth/v1/user"))
      return Response.json({
        id: "11111111-1111-4111-8111-111111111111",
        email_confirmed_at: "2026-01-01",
      });
    if (url.includes("/rest/v1/users"))
      return Response.json({
        id: 7,
        subscription_tier: "free",
        subscription_expires_at: null,
      });
    throw Error("Free user reached paid provider");
  };
  try {
    assert(
      (
        await handleRequest(
          req({ action: "generate", kind: "guide", noteId: 9, requestId: id }),
        )
      ).status === 403,
      "free user was not blocked",
    );
  } finally {
    globalThis.fetch = old;
  }
});

Deno.test('Free-account cleanup uses verified ownership and removes bytes only through Storage', async () => {
  const old=globalThis.fetch;
  let claims=0,removals=0,failRemoval=false;
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    const reply=(value:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}}));
    if(url.pathname==='/auth/v1/user') return reply({id:'11111111-1111-4111-8111-111111111111',email_confirmed_at:'2026-01-01'});
    if(url.pathname==='/rest/v1/users') return reply({id:7,subscription_tier:'free'});
    if(url.pathname==='/rest/v1/rpc/claim_unused_uploads') {
      claims++;assert(JSON.parse(String(init?.body)).owner_ref===7,'caller owner must not be trusted');
      return reply([{path:'7/ai/old.txt'}]);
    }
    if(url.pathname==='/storage/v1/object/study-files') {
      removals++;assert(init?.method==='DELETE','must call byte-removal API');
      assert(JSON.stringify(JSON.parse(String(init?.body)).prefixes)==='["7/ai/old.txt"]','only claimed paths');
      return failRemoval?reply({message:'unavailable'},503):reply([{name:'7/ai/old.txt'}]);
    }
    throw Error('Unexpected request '+url.pathname);
  };
  try {
    const denied=await handleRequest(req({action:'cleanup-uploads',userId:999}));
    assert(denied.status===400 && claims===0,'confirmation required before claim');
    const response=await handleRequest(req({action:'cleanup-uploads',userId:999,confirmation:'REMOVE UNUSED UPLOADS'}));
    assert(response.status===200 && (await response.json()).removed===1,'verified free owner cleanup');
    failRemoval=true;
    const failed=await handleRequest(req({action:'cleanup-uploads',confirmation:'REMOVE UNUSED UPLOADS'}));
    assert(failed.status===502 && removals===2,'failed deletion must not claim success');
  } finally {globalThis.fetch=old;}
});
