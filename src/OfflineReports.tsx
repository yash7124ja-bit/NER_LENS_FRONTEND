import ReportMedia from "./ReportMedia";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import i18next from "i18next";
import { segmentName, type Segment, type Session } from "./api";
import { reportStore, saveReport, syncReports, type QueuedReport, type Observation } from "./offline";
import "./offline.css";

const language = i18next.createInstance();
void language.init({ lng: "en", fallbackLng: "en", resources: {
  en: { translation: { safety: "A field report is an unreviewed observation. It does not declare a road safe or change its operational status." } },
  as: { translation: { safety: "ক্ষেত্ৰ প্ৰতিবেদন এটা পৰ্যালোচনা নকৰা পৰ্যবেক্ষণ। ই পথটো নিৰাপদ বুলি ঘোষণা নকৰে।" } },
} });
type Fields = { segment_id: string; observed_at: string; latitude: string; longitude: string; accuracy_m: string; status_claim: Observation["status_claim"]; condition_code: string; note: string };
export default function OfflineReports({ session, segments, authenticated = true }: { session: Session; segments: Segment[]; authenticated?: boolean }) {
  const owner = session.user.actor_id;
  const saving = useRef(false);
  const [rows, setRows] = useState<QueuedReport[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [locale, setLocale] = useState("en");
  const { register, handleSubmit, reset } = useForm<Fields>({ defaultValues: { status_claim: "unknown" } });
  const refresh = useCallback(async () => setRows(await reportStore.reports.where("owner").equals(owner).sortBy("client_sequence")), [owner]);
  const synchronize = useCallback(async () => {
    if (!authenticated) { setMessage("Sign in again before sending saved reports."); return; }
    setBusy(true);
    try {
      if (navigator.locks) await navigator.locks.request("ner-lens-report-sync", () => syncReports(owner));
      else await syncReports(owner);
      await refresh();
    } catch { setMessage("Device storage could not be read. Reports have not been removed; retry or contact your administrator."); }
    finally { setBusy(false); }
  }, [owner, refresh, authenticated]);
  useEffect(() => {
    void refresh().catch(() => setMessage("Device storage is unavailable. Capture cannot be confirmed until storage works."));
    const connected = () => { setOnline(true); void synchronize(); };
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    if (navigator.onLine) void synchronize();
    return () => { window.removeEventListener("online", connected); window.removeEventListener("offline", disconnected); };
  }, [refresh, synchronize]);
  const capture = handleSubmit(async fields => {
    if (saving.current) return;
    saving.current = true;
    try {
      if (!segments.some(segment => segment.segment_id === fields.segment_id)) throw new Error("Choose an authorized segment");
      for (const value of [fields.latitude, fields.longitude, fields.accuracy_m]) if (!value.trim()) throw new Error("Coordinates and accuracy are required");
      const time = new Date(fields.observed_at);
      if (!Number.isFinite(time.getTime())) throw new Error("Capture time is required");
      await saveReport(owner, { segment_id: fields.segment_id, observed_at: time.toISOString(), geometry: { type: "Point", coordinates: [Number(fields.longitude), Number(fields.latitude)] }, accuracy_m: Number(fields.accuracy_m), status_claim: fields.status_claim, condition_code: fields.condition_code, note: fields.note });
      setMessage("Saved on device. Synchronize to send for human review.");
      reset();
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? `Not saved: ${error.message}` : "Not saved: device storage is unavailable or full."); }
    finally { saving.current = false; }
  });
  return <section className="card field-reports" aria-labelledby="field-reports-title">
    <header className="card-hd"><div><h2 id="field-reports-title">Offline field reports</h2><p>{online ? "Connected" : "Offline"} · {rows.filter(row => row.state !== "accepted_for_review").length} reports awaiting delivery or action</p></div></header>
    <label>Safety copy language <select value={locale} onChange={event => setLocale(event.target.value)}><option value="en">English</option><option value="as">Assamese draft — unreviewed</option></select></label>
    <p lang={locale}>{language.t("safety", { lng: locale })}</p>
    {locale === "as" && <p>Assamese draft v1 — not reviewed by a native speaker; use English for operational decisions.</p>}
    <p>Save the observation first, then attach photos after synchronization. Enter a known location and its accuracy; this form does not request GPS. Saved reports remain on this browser and may contain sensitive location data.</p>
    {!session.user.roles.includes("field_reporter") && <p className="access-note"><strong>Field reporter access required.</strong> This account cannot submit observations. An administrator must assign the field reporter role.</p>}
    {session.user.roles.includes("field_reporter") && <form onSubmit={capture}>
      <label>Road segment<select required {...register("segment_id")}><option value="">Choose segment</option>{segments.map(segment => <option key={segment.segment_id} value={segment.segment_id}>{segmentName(segment)}</option>)}</select></label>
      <label>Observed time (device local timezone)<input type="datetime-local" required {...register("observed_at")} /></label>
      <label>Latitude<input type="number" step="any" min="-90" max="90" required {...register("latitude")} /></label>
      <label>Longitude<input type="number" step="any" min="-180" max="180" required {...register("longitude")} /></label>
      <label>Location accuracy (metres)<input type="number" step="any" min="0" max="100000" required {...register("accuracy_m")} /></label>
      <label>Observed condition<select {...register("status_claim")}><option value="unknown">Unknown</option><option value="open">Appears passable — unverified</option><option value="restricted">Restricted</option><option value="blocked">Blocked</option><option value="closed">Closure observed — unverified</option></select></label>
      <label>Condition description<input required maxLength={100} {...register("condition_code")} /></label>
      <label className="field-wide">Evidence note<textarea required maxLength={4000} {...register("note")} /></label>
      <button type="submit" disabled={busy}>Save on device</button>
    </form>}
    <button type="button" disabled={!online || busy || !authenticated} onClick={() => void synchronize()}>{busy ? "Synchronizing…" : "Synchronize saved reports"}</button>
    <p role="status">{message}</p>
    <ul>{rows.map(row => <li key={row.client_report_id}><strong>{row.state.replaceAll("_", " ")}</strong> · {row.observation.note}<br /><small>{row.message} ID: {row.client_report_id}</small>{row.canonical_id && authenticated && <ReportMedia reportId={row.canonical_id} owner={owner} upload />}</li>)}</ul>
    {rows.some(row => ["failed", "conflict"].includes(row.state)) && <p>Failed and conflicting reports are preserved. Contact an authorized reviewer with the report ID; capture a new report if a correction is needed.</p>}
  </section>;
}

