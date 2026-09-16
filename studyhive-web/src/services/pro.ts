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
export async function proRequest(body: Record<string, unknown>, client = cloudClient) {
  if (!client) throw new Error("Cloud sign-in is required.");
  const id = useStore.getState().currentUser?.id;
  if (!id) throw new Error("Sign in first.");
  const { data, error } = await client.functions.invoke("pro-service", {
    body,
  });
  assertActiveAccount(id);
  if (error) {
    const status = error.context?.status;
    let message = "Pro services could not complete this request. Please try again.";
    if (error.name === "FunctionsFetchError") {
      message = "Could not reach Pro services. Check your connection and that you opened StudyHive at its configured address, then retry.";
    } else if (status === 401) {
      message = "Pro services rejected your session (HTTP 401). Save your work, then sign out and sign in again.";
    } else if (status === 403) {
      message = "Pro services denied this request (HTTP 403). Check your account access and the StudyHive address you opened.";
    } else if (typeof status === "number") {
      message = `Pro services returned HTTP ${status}. Please retry; if this continues, report this status.`;
    }
    try {
      const result = await error.context?.json();
      if (typeof result?.error === "string" && result.error.trim()) {
        message = result.error + (typeof status === "number" ? ` (HTTP ${status})` : "");
      }
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
