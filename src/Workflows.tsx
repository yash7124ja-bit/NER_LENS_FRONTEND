import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, request, segmentName, type Corridor, type Segment, type Session } from "./api";
import "./workflows.css";

type Capability = { allowed: boolean; reason: string };
type Report = { field_report_id: string; observed_at: string; status_claim: string; note: string; review_state: string };
type Mission = { mission_id: string; cargo_class: string; priority: string; state: string; deadline_state: string; delivery_window: { end: string }; last_fix_age_seconds: number | null };
type Comparison = { mode: string; routes: { route_id: string; reason: string; score_components: { travel_minutes: number } }[] };
const readable = (s: string) => s.replaceAll("_", " ");
const date = (s: string) => new Date(s).toLocaleString();
export default function Workflows({ session, corridor, segments, onChange }: {
  session: Session; corridor: Corridor; segments: Segment[]; onChange: () => void;
}) {
  const [tab, setTab] = useState("reports");
  const [capabilities, setCapabilities] = useState<Record<string, Capability>>({});
  const [segmentId, setSegmentId] = useState(segments[0]?.segment_id ?? "");
  const [reports, setReports] = useState<Report[]>([]);
  const [assignees, setAssignees] = useState<{actor_id: string; display_name: string}[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [evidence, setEvidence] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(new Map<string, {key: string; body: Record<string, unknown>}>());
  const allowed = (action: string) => capabilities[action]?.allowed === true;
  const canReports = allowed("review_evidence") || allowed("create_field_report") || allowed("publish_status");
  useEffect(() => {
    const controller = new AbortController();
    request<{ actions: Record<string, Capability> }>(`/v1/corridors/${corridor.corridor_id}/capabilities`, controller.signal)
      .then(r => setCapabilities(r.actions)).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [corridor.corridor_id, session.user.actor_id]);
  useEffect(() => {
    const controller = new AbortController();
    if (allowed("create_mission")) request<{actors: {actor_id: string; display_name: string}[]}>(`/v1/mission-assignees?corridor_id=${encodeURIComponent(corridor.corridor_id)}`, controller.signal)
      .then(r => setAssignees(r.actors)).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    if (canReports && segmentId) request<{ reports: Report[] }>(`/v1/field-reports?segment_id=${encodeURIComponent(segmentId)}`, controller.signal)
      .then(r => setReports(r.reports)).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    if (allowed("view_mission") || allowed("submit_gps")) request<{ missions: Mission[] }>(`/v1/missions?corridor_id=${encodeURIComponent(corridor.corridor_id)}`, controller.signal)
      .then(r => setMissions(r.missions)).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [capabilities, segmentId, revision, corridor.corridor_id]);
  async function mutate(path: string, body: Record<string, unknown> = {}) {
    const logical = structuredClone(body);
    delete logical.effective_at; delete logical.departure_at;
    if (logical.delivery_window) delete (logical.delivery_window as Record<string, unknown>).start;
    if (logical.gps_consent) delete (logical.gps_consent as Record<string, unknown>).recorded_at;
    const signature = path + JSON.stringify(logical);
    const operation = pending.current.get(signature) ?? { key: crypto.randomUUID(), body };
    pending.current.set(signature, operation);
    const key = operation.key;
    const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(operation.body), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new ApiError(response.status);
    pending.current.delete(signature);
    return response.json();
  }
  async function act(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await work(); setMessage(success); setRevision(r => r + 1); onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : "The action could not be completed. Retry with the same information."); }
    finally { setBusy(false); }
  }
  async function capturePosition(mission: Mission) {
    await act(async () => {
      if (!navigator.geolocation) throw new Error("This browser does not support location capture.");
      const fix = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
      const sequence = Date.now();
      const result = await mutate(`/v1/missions/${mission.mission_id}/positions`, { device_id: `browser-${session.user.actor_id}`, sequence_start: sequence, points: [{ sequence, captured_at: new Date(fix.timestamp).toISOString(), geometry: { type: "Point", coordinates: [fix.coords.longitude, fix.coords.latitude] }, accuracy_m: fix.coords.accuracy }] });
      if (result.rejected?.length) throw new Error("Location rejected. Check the mission corridor and capture time.");
    }, "Location submitted. Location outside the mission corridor is rejected; this button does not track you continuously.");
  }
  const chooseSegment = <label>Road segment<select value={segmentId} onChange={e => { setSegmentId(e.target.value); setEvidence(""); setReports([]); }}>
    {segments.map(s => <option key={s.segment_id} value={s.segment_id}>{segmentName(s)}</option>)}</select></label>;
  const gate = (role: string, description: string) => <div className="access-note"><strong>{role} access required</strong><p>{description}</p><p>Signed in as {session.user.display_name}: {session.user.roles.map(readable).join(", ")}. An administrator must assign the role for this corridor.</p></div>;
  function submitMission(event: FormEvent<HTMLFormElement>, routeOnly: boolean) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const origin = segments.find(s => s.segment_id === data.get("origin"))!;
    const destination = segments.find(s => s.segment_id === data.get("destination"))!;
    const start = new Date().toISOString();
    const end = new Date(String(data.get("deadline"))).toISOString();
    const points = { origin: { type: "Point", coordinates: origin.geometry.coordinates[0] },
      destination: { type: "Point", coordinates: destination.geometry.coordinates.at(-1) } };
    void act(async () => {
      if (routeOnly) setComparison(await mutate("/v1/routes/compare", { ...points, corridor_id: corridor.corridor_id,
        graph_version_id: corridor.graph_version, vehicle_profile: data.get("vehicle"), departure_at: start, deadline_at: end, alternative_limit: 3 }));
      else await mutate("/v1/missions", { ...points, corridor_id: corridor.corridor_id, cargo_class: data.get("cargo"),
        priority: data.get("priority"), vehicle_profile: data.get("vehicle"), delivery_window: { start, end },
        gps_consent: { basis: "explicit_consent", recorded_at: start }, assigned_actor_ids: data.getAll("assignees"), route_id: null });
    }, routeOnly ? "Route comparison saved. Read its limitations before planning." : "Mission saved. Start it from the mission board when ready.");
  }
  const planForm = (routeOnly: boolean) => <form className="workflow-form" onSubmit={e => submitMission(e, routeOnly)}>
    <p className="workflow-caution">Replay corridor: locations use the selected synthetic band endpoints. This is a workflow demonstration, not navigation clearance.</p>
    <div className="form-grid">
      <label>Origin band<select name="origin" required>{segments.map(s => <option key={s.segment_id} value={s.segment_id}>{segmentName(s)}</option>)}</select></label>
      <label>Destination band<select name="destination" required defaultValue={segments.at(-1)?.segment_id}>{segments.map(s => <option key={s.segment_id} value={s.segment_id}>{segmentName(s)}</option>)}</select></label>
      <label>Vehicle profile<select name="vehicle"><option value="light_goods">Light goods vehicle</option><option value="rigid_truck">Rigid truck</option><option value="emergency">Emergency vehicle</option></select></label>
      <label>Delivery deadline<input name="deadline" type="datetime-local" required /></label>
      {!routeOnly && <><label>Cargo<input name="cargo" placeholder="e.g. essential medicines" required maxLength={128} /></label><label>Priority<select name="priority"><option value="routine">Routine</option><option value="high">High</option><option value="emergency">Emergency</option></select></label></>}
    </div>
    {!routeOnly && <label>Assigned field reporters<select name="assignees" multiple>{assignees.map(a => <option key={a.actor_id} value={a.actor_id}>{a.display_name}</option>)}</select><span>{assignees.length ? "Select reporters who have agreed to this assignment." : "No field reporters provisioned in this corridor. A dispatcher can still manage the delivery without GPS."}</span></label>}
    {!routeOnly && <label className="consent"><input type="checkbox" required /> I have consent to create this mission. GPS is not collected by creating it.</label>}
    <button disabled={busy}>{busy ? "Saving…" : routeOnly ? "Compare baseline routes" : "Create mission"}</button>
  </form>;
  return <section id="operations" className="card operations-console">
    <header className="card-hd"><div><p className="eyebrow">OPERATIONS DESK</p><h2>From field evidence to delivery</h2><p>Capture → review → publish status → plan → complete. Every saved action is recorded in the database.</p></div><span className="pill">Replay workspace</span></header>
    <nav className="workflow-tabs" aria-label="Operational workflows">{[["reports", "01", "Evidence & review"], ["status", "02", "Road decisions"], ["routes", "03", "Route planning"], ["missions", "04", "Mission board"]].map(([id, n, label]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setError(""); setMessage(""); }}><small>{n}</small>{label}</button>)}</nav>
    <div className="card-bd">
      {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="workflow-success" role="status">{message}</p>}
      {tab === "reports" && <><div className="workflow-heading"><div><h3>Evidence inbox</h3><p>Reports are claims until reviewed. Accepting evidence does not automatically open a road.</p></div><a href="#field-reports">Capture a field report ↓</a></div>{chooseSegment}
        {!canReports ? gate("Field reporter or reviewer", "Field reporters see their submissions; reviewers can assess reports for their assigned corridor.") : <>{reports.length === 0 && <div className="workflow-empty"><strong>No reports for this segment</strong><p>Submit a report using Field reports below, then refresh this inbox.</p></div>}
        {reports.map(r => <article className="report-row" key={r.field_report_id}><div><span className="status-tag">{readable(r.review_state)}</span><h4>{readable(r.status_claim)} reported · {date(r.observed_at)}</h4><p>{r.note || "No additional note supplied."}</p><small>Report {r.field_report_id}</small></div>
          {allowed("review_evidence") && <form onSubmit={e => { e.preventDefault(); const d = new FormData(e.currentTarget); void act(() => mutate(`/v1/reviews/${r.field_report_id}`, { action: d.get("action"), note: d.get("note") }), "Review recorded."); }}><label>Decision<select name="action"><option value="accept">Accept evidence</option><option value="reject">Reject evidence</option><option value="needs_clarification">Request clarification</option></select></label><label>Reason<textarea name="note" required maxLength={4000} /></label><button disabled={busy}>Save review</button></form>}</article>)}<button disabled={busy} onClick={() => setRevision(r => r + 1)}>Refresh inbox</button></>}
      </>}
      {tab === "status" && <><h3>Publish a road decision</h3><p className="help">Only an assigned district authority can publish. Decisions expire; an expired road status becomes unknown.</p>{!allowed("publish_status") ? gate("District officer with status authority", "Publishing requires both a district role and an active authority assignment in the database.") : <form className="workflow-form" onSubmit={e => { e.preventDefault(); const d = new FormData(e.currentTarget); void act(() => mutate("/v1/status-decisions", { segment_id: segmentId, status: d.get("status"), vehicle_scope: [d.get("vehicle")], direction: "both", reason_code: d.get("reason"), evidence_ids: String(d.get("evidence") ?? "").split(",").map(s => s.trim()).filter(Boolean), effective_at: new Date().toISOString(), valid_until: new Date(String(d.get("expiry"))).toISOString(), note: d.get("note") }), "Authority decision published. Corridor overview has been refreshed."); }}>{chooseSegment}<div className="form-grid"><label>Road status<select name="status"><option value="unknown">Unknown</option><option value="restricted">Restricted</option><option value="closed">Closed</option><option value="open">Open</option></select></label><label>Applies to<select name="vehicle"><option value="all">All vehicles</option><option value="light_goods">Light goods</option><option value="rigid_truck">Rigid truck</option><option value="emergency">Emergency</option></select></label><label>Valid until<input name="expiry" type="datetime-local" required /></label></div><label>Decision basis<select name="reason"><option value="authority_order">Authority order</option><option value="landslide">Reviewed landslide evidence</option><option value="flooded">Reviewed flood evidence</option><option value="damage">Reviewed damage evidence</option><option value="reopened">Reviewed reopening evidence</option></select></label><label>Accepted evidence IDs (comma separated)<input name="evidence" value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Copy the accepted report IDs from Evidence & review" /></label>{reports.some(r => r.review_state === "accept") && <div className="evidence-options"><span>Accepted reports for this segment:</span>{reports.filter(r => r.review_state === "accept").map(r => <button key={r.field_report_id} type="button" onClick={() => setEvidence(r.field_report_id)}>{readable(r.status_claim)} · {date(r.observed_at)}</button>)}</div>}<label>Order reference or decision explanation<textarea name="note" required maxLength={4000} /></label><p className="help">Evidence-based decisions require accepted reports for this segment. Authority orders require an order reference in the explanation. Both are preserved in the audit trail.</p><button disabled={busy}>Publish decision</button></form>}</>}
      {tab === "routes" && <><h3>Compare a baseline route</h3><p className="help">Travel-time baseline only. Vehicle legality, hazard coverage, and routing policy are not verified; no safe-route recommendation is issued.</p>{!allowed("compare_routes") ? gate("Dispatcher", "Dispatchers can request and save route comparisons for this corridor.") : planForm(true)}{comparison && <div className="route-result"><span className="status-tag">{readable(comparison.mode)}</span>{comparison.routes.length === 0 ? <p>No verified feasible candidate was returned. Do not interpret this as road clearance.</p> : comparison.routes.map(r => <article key={r.route_id}><strong>{Math.round(r.score_components.travel_minutes)} min baseline</strong><p>{r.reason}</p></article>)}</div>}</>}
      {tab === "missions" && <><div className="workflow-heading"><div><h3>Medicine mission board</h3><p>Plan a delivery, start it, and record completion. ETA remains unavailable without a verified route.</p></div><button disabled={busy} onClick={() => setRevision(r => r + 1)}>Refresh board</button></div>
        {allowed("create_mission") ? <details><summary>Create a delivery mission</summary>{planForm(false)}</details> : gate("Dispatcher to create; assigned field reporter to track", "Mission access follows the owner and explicit field assignments.")}
        {(allowed("view_mission") || allowed("submit_gps")) && <>{!missions.length && <div className="workflow-empty"><strong>No missions assigned to this account</strong><p>Create a mission or ask the dispatcher to assign you to an existing delivery.</p></div>}{missions.map(m => <article className="mission-row" key={m.mission_id}><div><span className="status-tag">{m.state}</span><h4>{m.cargo_class}</h4><p>{readable(m.priority)} priority · Due {date(m.delivery_window.end)}</p><small>{readable(m.deadline_state)} · {m.last_fix_age_seconds === null ? "No GPS fix received" : `Last GPS fix ${Math.round(m.last_fix_age_seconds / 60)} min ago`}</small></div><div>{m.state === "planned" && <button disabled={busy} onClick={() => void act(() => mutate(`/v1/missions/${m.mission_id}/start`), "Mission started.")}>Start mission</button>}{m.state === "active" && allowed("submit_gps") && <button disabled={busy} onClick={() => void capturePosition(m)}>Share current location once</button>}{m.state === "active" && <button disabled={busy} onClick={() => void act(() => mutate(`/v1/missions/${m.mission_id}/complete`), "Delivery completion recorded.")}>Mark delivered</button>}</div></article>)}</>}
      </>}
    </div>
  </section>;
}
