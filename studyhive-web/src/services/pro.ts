import { cloudClient } from "./cloud/client";
import { useStore } from "../store";
import { assertActiveAccount } from "./studyMaterials";
export function isPro() {
  const user = useStore.getState().currentUser;
  return (
    !!user &&
    user.subscription_tier === "premium" &&
    Date.parse(user.subscription_expires_at || "") > Date.now()
  );
}
export async function proRequest(body: Record<string, unknown>) {
  if (!cloudClient) throw new Error("Cloud sign-in is required.");
  const id = useStore.getState().currentUser?.id;
  if (!id) throw new Error("Sign in first.");
  const { data, error } = await cloudClient.functions.invoke("pro-service", {
    body,
  });
  assertActiveAccount(id);
  if (error) {
    let message = "Pro services are not available yet. Please try again later.";
    try {
      const result = await error.context?.json();
      if (result?.error) message = result.error;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
const pendingGenerations = new Map<string, string>();
export async function generateFromSavedNote(
  kind: "flashcards" | "quiz" | "guide",
  noteId: number,
) {
  if (!isPro()) throw new Error("Pro is required for AI generation.");
  const key = `${useStore.getState().currentUser?.id}:${kind}:${noteId}`;
  const requestId = pendingGenerations.get(key) || crypto.randomUUID();
  pendingGenerations.set(key, requestId);
  try {
    const result = await proRequest({
      action: "generate",
      kind,
      noteId,
      requestId,
    });
    pendingGenerations.delete(key);
    window.dispatchEvent(new CustomEvent("studyhive-data-updated"));
    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      /Previous attempt failed|identifier already used/.test(error.message)
    )
      pendingGenerations.delete(key);
    throw error;
  }
}
