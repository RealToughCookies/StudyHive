import { useEffect, useState } from "react";
import { cloudClient } from "../../services/cloud/client";
import { isPro, proRequest } from "../../services/pro";
import { useStore } from "../../store";
import { assertActiveAccount } from "../../services/studyMaterials";
export default function ProPanel({ onClose }: { onClose: () => void }) {
  const user = useStore((s) => s.currentUser);
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [allowance, setAllowance] = useState<{
      limit: number;
      used: number;
    } | null>(null);
  async function refresh() {
    if (!user || !cloudClient) return;
    try {
      const info = await proRequest({ action: "billing-info" });
      setEnabled(info.enabled);
      const [profile, usage] = await Promise.all([
        cloudClient.from("users").select("*").eq("id", user.id).single(),
        cloudClient.rpc("ai_allowance"),
      ]);
      assertActiveAccount(user.id);
      if (profile.error) throw profile.error;
      useStore.getState().setUser(profile.data);
      if (!usage.error) setAllowance(usage.data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Pro services are unavailable.",
      );
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
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
        {!enabled && <p>Checkout is not configured yet.</p>}
        <div className="flex flex-wrap gap-3">
          {!isPro() && (
            <button
              className="btn-primary px-4 py-3"
              disabled={!enabled || busy}
              onClick={() => billing("checkout")}
            >
              Test Pro checkout
            </button>
          )}
          <button
            className="btn-secondary"
            disabled={!enabled || busy}
            onClick={() => billing("portal")}
          >
            Manage subscription
          </button>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              void refresh();
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
