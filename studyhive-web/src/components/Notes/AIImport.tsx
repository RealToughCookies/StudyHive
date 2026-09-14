import { useState, useRef } from "react";
import { cloudClient } from "../../services/cloud/client";
import { useStore } from "../../store";
import { isPro, proRequest } from "../../services/pro";
import { Class } from "../../types";
export default function AIImport({
  classes,
  onCreated,
  onClose,
}: {
  classes: Class[];
  onCreated: (id: number) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [classId, setClassId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const retry = useRef<{
    file: File;
    classId: string;
    requestId: string;
    path: string;
  } | null>(null);
  async function generate() {
    if (busy || !file) return;
    setError("");
    setBusy(true);
    try {
      const user = useStore.getState().currentUser;
      if (!cloudClient || !user || !isPro())
        throw new Error("Pro is required to turn files into notes.");
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (
        !["pdf", "docx", "txt"].includes(ext || "") ||
        file.size === 0 ||
        file.size > 2 * 1024 * 1024
      )
        throw new Error("Choose a PDF, DOCX or TXT file up to 2 MB.");
      if (
        !retry.current ||
        retry.current.file !== file ||
        retry.current.classId !== classId
      ) {
        const requestId = crypto.randomUUID();
        const path = `${user.id}/ai/${requestId}.${ext}`;
        const mime =
          ext === "pdf"
            ? "application/pdf"
            : ext === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "text/plain";
        const { error } = await cloudClient.storage
          .from("study-files")
          .upload(path, file, { contentType: mime, upsert: false });
        if (error) throw error;
        retry.current = { file, classId, requestId, path };
      }
      const result = await proRequest({
        action: "generate",
        kind: "notes",
        filePath: retry.current.path,
        classId: classId ? Number(classId) : null,
        requestId: retry.current.requestId,
      });
      await cloudClient.storage
        .from("study-files")
        .remove([retry.current.path]);
      retry.current = null;
      onCreated(result.artifact_id);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not create notes.";
      setError(message);
      if (message.includes("Previous attempt failed")) retry.current = null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
    >
      <section className="bg-white p-8 rounded-2xl max-w-lg w-full space-y-4">
        <h2 id="import-title" className="text-2xl font-bold">
          Turn a file into notes
        </h2>
        <p>
          Pro creates editable notes from a text-based PDF, DOCX or TXT file (up
          to 2 MB). Scans and handwritten pages are not supported.
        </p>
        <p className="text-sm text-gray-600">
          Your file is stored privately and sent to OpenAI to generate notes.
          Check the result for accuracy before studying.
        </p>
        <input
          aria-label="Source document"
          type="file"
          accept=".pdf,.docx,.txt"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <label className="block">
          Class
          <select
            className="input-field"
            value={classId}
            disabled={busy}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">No class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            disabled={busy || !file || !isPro()}
            className="btn-primary px-4 py-3"
            onClick={generate}
          >
            {busy ? "Creating notes…" : "Create notes with AI"}
          </button>
          <button disabled={busy} className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {!isPro() && <p>Upgrade to Pro to use this feature.</p>}
      </section>
    </div>
  );
}
