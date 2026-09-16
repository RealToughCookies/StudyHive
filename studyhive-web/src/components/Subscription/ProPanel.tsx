import { useEffect, useState } from "react";
import { cloudClient } from "../../services/cloud/client";
import { isPro, proRequest } from "../../services/pro";
import { useStore } from "../../store";
import { assertActiveAccount } from "../../services/studyMaterials";
import { User } from "../../types";

type Membership = {
  enabled: boolean | null;
  user: User;
  allowance: { limit: number; used: number } | null;
  billingError?: string;
};

export async function loadMembership(userId: number, client = cloudClient): Promise<Membership> {
  if (!client) throw new Error("Cloud sign-in is required.");
  const [info, profile, usage] = await Promise.all([
    proRequest({ action: "billing-info" }, client).then(
      info => ({ enabled: Boolean(info.enabled), billingError: "" }),
      error => ({ enabled: null, billingError: error instanceof Error ? error.message : "Billing is unavailable." }),
    ),
    client.from("users").select("*").eq("id", userId).single(),
    client.rpc("ai_allowance"),
  ]);
  assertActiveAccount(userId);
  if (profile.error) throw profile.error;
  return {
    enabled: info.enabled,
    billingError: info.billingError,
    user: profile.data as User,
    allowance: usage.error ? null : usage.data as { limit: number; used: number },
  };
}

export default function ProPanel({ onClose, billingReturn, load = loadMembership }: {
  onClose: () => void;
  billingReturn?: "success" | "cancelled";
  load?: typeof loadMembership;
}) {
  const user = useStore((s) => s.currentUser);
  const userId = user?.id;
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [allowance, setAllowance] = useState<{
      limit: number;
      used: number;
    } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setLoading(true);
    setError("");
    async function refresh() {
      if (!userId) { setLoading(false); return; }
      try {
        const result = await load(userId);
        if (cancelled) return;
        assertActiveAccount(userId);
        if (result.user.id !== userId) throw new Error("Membership belongs to a different account.");
        setEnabled(result.enabled);
        useStore.getState().setUser(result.user);
        setAllowance(result.allowance);
        setError(result.billingError || "");
        // A redirect is only a cue to read the server-owned entitlement.
        // Give Stripe's webhook time to arrive, then offer a manual retry.
        if (billingReturn === "success" && !isPro() && ++attempts < 6) {
          timer = setTimeout(() => void refresh(), 2000);
          return;
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Pro services are unavailable.");
      }
      setLoading(false);
    }
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId, billingReturn, retry, load]);
  async function billing(action: "checkout" | "portal") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await proRequest({
        action,
        requestId: crypto.randomUUID(),
      });
      const url = new URL(result.url);
      if (
        url.protocol !== "https:" ||
        !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
      )
        throw new Error("Invalid payment destination.");
      location.assign(url.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing unavailable.");
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-title"
        className="bg-white rounded-2xl p-8 max-w-lg space-y-4"
      >
        <h2 id="pro-title" className="text-2xl font-bold">
          StudyHive Pro
        </h2>
        <p>
          AI notes from uploaded documents, generated flashcards and quizzes,
          study guides, and optional spaced repetition.
        </p>
        <p className="font-medium">
          {isPro()
            ? "Your Pro membership is active."
            : "Your free notes, classes, timers and manual flashcards remain available."}
        </p>
        {loading && <p role="status">Checking your membership…</p>}
        {billingReturn === "success" && !loading && !error && !isPro() && (
          <p role="status">Pro activation is still pending. Wait a moment, then refresh your membership. You do not need to check out again.</p>
        )}
        {billingReturn === "cancelled" && <p>Checkout was cancelled. You can try again when you are ready.</p>}
        {allowance && (
          <p>
            AI generations this month: {allowance.used} / {allowance.limit}.
            Failed generations do not use your allowance.
          </p>
        )}
        <p className="text-sm text-amber-800">
          Billing is in test mode. Do not enter real payment details. Public
          pricing has not been finalized.
        </p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {enabled === false && !loading && <p>Checkout is not configured yet.</p>}
        <div className="flex flex-wrap gap-3">
          {!isPro() && billingReturn !== "success" && (
            <button
              className="btn-primary px-4 py-3"
              disabled={!enabled || busy || loading}
              onClick={() => billing("checkout")}
            >
              Test Pro checkout
            </button>
          )}
          <button
            className="btn-secondary"
            disabled={!enabled || busy || loading}
            onClick={() => billing("portal")}
          >
            Manage subscription
          </button>
          <button
            className="btn-secondary"
            disabled={busy || loading}
            onClick={() => {
              setError("");
              setRetry(value => value + 1);
            }}
          >
            Refresh membership
          </button>
          <button className="btn-secondary" disabled={busy} onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
