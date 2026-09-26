import { useRef, useState, type FormEvent } from "react";
import { ApiError, request } from "./api";

type Entry = { id: string; kind: string; action?: string; note: string; actor_id: string; at: string; merge_into_evidence_id?: string | null };
type History = { review_state: string; can_respond: boolean; history: Entry[] };

export default function ReportHistory({ reportId }: { reportId: string }) {
  const [data, setData] = useState<History | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ note: string; key: string } | null>(null);
  async function refresh() {
    try { setData(await request<History>(`/v1/field-reports/${reportId}/history`)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "History is unavailable."); }
  }
  async function respond(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    if (!note) return;
    setBusy(true); setError("");
    try {
      if (pending.current?.note !== note) pending.current = { note, key: crypto.randomUUID() };
      const response = await fetch(`/v1/field-reports/${reportId}/clarifications`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pending.current.key },
        body: JSON.stringify({ note }), signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw await ApiError.fromResponse(response);
      pending.current = null;
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Response was not sent. Retry with the same note."); }
    finally { setBusy(false); }
  }
  return <details onToggle={event => { if (event.currentTarget.open && !data) void refresh(); }}>
    <summary>Review and clarification history</summary>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh history</button>
    {data && <><p>Review state: {data.review_state.replaceAll("_", " ")}</p>
      {data.history.length === 0 && <p>No review yet.</p>}
      {data.history.map(entry => <p key={entry.id}><strong>{entry.kind === "review" ? entry.action?.replaceAll("_", " ") : "Reporter clarification"}</strong> · {new Date(entry.at).toLocaleString()} · {entry.actor_id}<br />{entry.note}{entry.merge_into_evidence_id && <> · Linked to {entry.merge_into_evidence_id}</>}</p>)}
      {data.can_respond && <form onSubmit={event => void respond(event)}><label>Reply to reviewer<textarea name="note" required maxLength={4000} /></label><button disabled={busy}>Send clarification</button></form>}
    </>}
  </details>;
}
