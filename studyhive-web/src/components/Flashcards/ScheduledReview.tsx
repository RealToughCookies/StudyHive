import { useEffect, useRef, useState } from "react";
import { cloudClient } from "../../services/cloud/client";
import { useStore } from "../../store";
import { assertActiveAccount } from "../../services/studyMaterials";
import { isPro } from "../../services/pro";
type DueCard = {
  id: number;
  front: string;
  back: string;
  reviewRevision: number;
};
export default function ScheduledReview({
  deckId,
  onExit,
}: {
  deckId: number;
  onExit: () => void;
}) {
  const [cards, setCards] = useState<DueCard[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [flipped, setFlipped] = useState(false),
    [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    const user = useStore.getState().currentUser;
    (async () => {
      try {
        if (!cloudClient || !user || !isPro())
          throw new Error("Pro is required for scheduled review.");
        const { data, error } = await cloudClient.rpc("due_flashcards", {
          deck_ref: deckId,
        });
        assertActiveAccount(user.id);
        if (error) throw error;
        if (active)
          setCards(
            (data || []).map((c: any) => ({
              ...c,
              reviewRevision: c.review_revision,
            })),
          );
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load review.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [deckId]);
  async function rate(rating: string) {
    if (inFlight.current || !cards[0]) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const user = useStore.getState().currentUser;
    try {
      const { error } = await cloudClient!.rpc("review_flashcard", {
        card_ref: cards[0].id,
        rating,
        expected_revision: cards[0].reviewRevision,
      });
      if (error) throw error;
      if (user) assertActiveAccount(user.id);
      setCards((c) => c.slice(1));
      setFlipped(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Review could not be saved. Reopen the review if this card changed.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="max-w-3xl mx-auto p-8 space-y-6">
      <button className="btn-secondary" disabled={busy} onClick={onExit}>
        Back to deck
      </button>
      <h1 className="text-2xl font-bold">Scheduled review</h1>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading due cards…</p>
      ) : cards.length ? (
        <>
          <p>{cards.length} cards due in this session</p>
          <div className="rounded-2xl border p-8 bg-white">
            <p className="text-xl whitespace-pre-wrap">{cards[0].front}</p>
            {flipped && (
              <p className="mt-6 border-t pt-6 whitespace-pre-wrap">
                {cards[0].back}
              </p>
            )}
          </div>
          {!flipped ? (
            <button
              className="btn-primary px-5 py-3"
              onClick={() => setFlipped(true)}
            >
              Show answer
            </button>
          ) : (
            <div className="flex flex-wrap gap-3">
              {["again", "hard", "good", "easy"].map((r) => (
                <button
                  key={r}
                  disabled={busy}
                  className="btn-secondary capitalize"
                  onClick={() => rate(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-500">
            Again returns in 10 minutes. Other ratings schedule your next review
            for a later day. Manual study is always available.
          </p>
        </>
      ) : (
        !error && (
          <p>No cards due right now. Come back later or use normal study.</p>
        )
      )}
    </section>
  );
}
