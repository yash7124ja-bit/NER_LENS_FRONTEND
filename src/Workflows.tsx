import ReportMedia from "./ReportMedia";
import ReportHistory from "./ReportHistory";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, request, segmentName, type Corridor, type Segment, type Session } from "./api";
import type { Workspace } from "./workspace";
import "./workflows.css";

type Capability = { allowed: boolean; reason: string };
type Report = { field_report_id: string; observed_at: string; status_claim: string; note: string; review_state: string };
type Mission = { mission_id: string; cargo_class: string; priority: string; state: string; deadline_state: string; origin: {type: string; coordinates: number[]}; destination: {type: string; coordinates: number[]}; delivery_window: { end: string }; vehicle_profile: string; vehicle_id: string | null; driver_actor_id: string | null; receiving_facility: string | null; receiving_contact?: string | null; confirmation?: {basis: string; note: string}; state_history?: {action: string; actor_id: string; at: string}[]; last_fix_age_seconds: number | null };
type Vehicle = { vehicle_id: string; alias: string; profile: string };
type Assignee = { actor_id: string; display_name: string };
type Comparison = { comparison_id: string; mission_id: string; impact_id: string | null; blocking_constraints: {segment_id: string; reason: string}[]; warnings: string[]; provider: string; retrieved_at: string; vehicle_profile: string; vehicle_entitlement: string; mode: string; routes: { route_id: string; reason: string; segment_ids: string[]; key_evidence_ids: string[]; uncertainty_score: number | null; score_components: { travel_minutes: number } }[] };
type DecisionHistory = { decision_id: string; status: string; vehicle_scope: string[]; direction: string; note: string; actor_id: string; created_at: string; valid_until: string; expired: boolean; supersedes_decision_id?: string | null; order_reference?: string | null };
type MissionImpact = { impact_id: string; mission_id: string; segment_id: string; status: string; state: string; decision_id: string; decision_valid_until: string; assessment_basis: string };
type RouteAlertSummary = {delivery_state: string; reason: string; route_id: string; vehicle_profile: string | null; vehicle_entitlement: string | null; retrieved_at: string | null; uncertainty_score: number | null; linked_segment_count: number; acknowledgment: {decision: string; acknowledged_at: string; selection_id: string | null} | null};
type SelectionRoute = {uncertainty_score: number | null; segment_ids: string[]; key_evidence_ids: string[]};
type SelectionSource = {provider: string; retrieved_at: string; vehicle_entitlement: string; vehicle_profile: string | null};
type SelectionDetail = {route_id: string; expires_at: string; status: string; route: SelectionRoute | null; source: SelectionSource | null};
const sourceAgeMinutes = (retrievedAt: string) => Math.max(0, Math.round((Date.now() - new Date(retrievedAt).getTime()) / 60000));
function AlertConstraints({ alert }: { alert: RouteAlertSummary }) {
  return <p className="help">Candidate {readable(alert.vehicle_profile ?? "unknown vehicle")} profile ({readable(alert.vehicle_entitlement ?? "entitlement unverified")}) · {alert.retrieved_at ? `Source age ${sourceAgeMinutes(alert.retrieved_at)} min` : "Source age unknown"} · Uncertainty {alert.uncertainty_score === null ? "not measured" : alert.uncertainty_score} · {alert.linked_segment_count} linked bands</p>;
}
function SelectionSummary({ selection }: { selection: SelectionDetail }) {
  return <p>Saved route {selection.route_id} · {readable(selection.status)} · Source expires {date(selection.expires_at)}
    {selection.source && ` · ${readable(selection.source.vehicle_profile ?? "unknown vehicle")} profile (${readable(selection.source.vehicle_entitlement)}) · Source age ${sourceAgeMinutes(selection.source.retrieved_at)} min`}
    {selection.route && ` · Uncertainty ${selection.route.uncertainty_score === null ? "not measured" : selection.route.uncertainty_score} · ${selection.route.segment_ids.length} linked bands`}</p>;
}
type MissionTimeline = {data_mode: string; events: {event_id: string; kind: string; at: string; actor_id: string | null; status: string; source_ids: Record<string, string | null>}[]};
const readable = (s: string) => s.replaceAll("_", " ");
const date = (s: string) => new Date(s).toLocaleString();
function MissionTimelineView({ timeline }: {timeline: MissionTimeline}) {
  return <section aria-label="Mission decision timeline">
    <h5>Decision timeline · {readable(timeline.data_mode)} records</h5>
    <ol>{timeline.events.map(event => <li key={`${event.kind}:${event.event_id}`}>
      <strong>{readable(event.kind)}: {readable(event.status)}</strong> · {date(event.at)}
      {event.actor_id && <span> · Actor {event.actor_id}</span>}
      <div className="help">{Object.entries(event.source_ids).filter(([, id]) => id).map(([key, id]) =>
        <span key={key}>{readable(key)} {id} · </span>)}</div>
    </li>)}</ol>
  </section>;
}
export default function Workflows({ session, corridor, segments, onChange, workspace }: {
  session: Session; corridor: Corridor; segments: Segment[]; onChange: () => void; workspace: Workspace;
}) {
  const tabs = workspace === "authority" ? ["reports", "status"] :
    workspace === "field" ? ["missions"] : ["missions", "routes"];
  const [tab, setTab] = useState(() => tabs.includes(window.location.hash.split(":")[1]) ? window.location.hash.split(":")[1] : tabs[0]);
  useEffect(() => {const change=()=>{const value=window.location.hash.split(":")[1]; if(tabs.includes(value))setTab(value);};
    window.addEventListener("hashchange",change); return()=>window.removeEventListener("hashchange",change);},[]);
  const [capabilities, setCapabilities] = useState<Record<string, Capability> | null>(null);
  const [segmentId, setSegmentId] = useState(segments[0]?.segment_id ?? "");
  const [reports, setReports] = useState<Report[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [drivers, setDrivers] = useState<Assignee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleProfile, setVehicleProfile] = useState("light_goods");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionDetail, setMissionDetail] = useState<Mission | null>(null);
  const [detailRouteSelection, setDetailRouteSelection] = useState<SelectionDetail | null>(null);
  const [detailRouteAlert, setDetailRouteAlert] = useState<RouteAlertSummary | null>(null);
  const [detailTimeline, setDetailTimeline] = useState<MissionTimeline | null>(null);
  const [evidence, setEvidence] = useState("");
  const [statusReason, setStatusReason] = useState("authority_order");
  const [decisionHistory, setDecisionHistory] = useState<DecisionHistory[] | null>(null);
  const [missionImpacts, setMissionImpacts] = useState<{assessments: MissionImpact[]; unassessed: {mission_id: string; reason: string}[]} | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [routeSelection, setRouteSelection] = useState<SelectionDetail | null>(null);
  const [routeChangeApproval, setRouteChangeApproval] = useState<{route_id: string; status: string; reason: string; expires_at: string} | null>(null);
  const [routeAlert, setRouteAlert] = useState<RouteAlertSummary | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(new Map<string, {key: string; body: Record<string, unknown>}>());
  const allowed = (action: string) => capabilities?.[action]?.allowed === true;
  const canReports = allowed("review_evidence") || allowed("create_field_report") || allowed("publish_status");
  useEffect(() => { setMissionDetail(null); setDetailRouteSelection(null); setDetailRouteAlert(null); setDetailTimeline(null); setVehicles([]); setDrivers([]); setSelectedVehicleId(""); setComparison(null); setSelectedMissionId(""); setRouteSelection(null); setRouteChangeApproval(null); setRouteAlert(null); setMissionImpacts(null); }, [corridor.corridor_id, session.user.actor_id]);
  useEffect(() => {
    const controller = new AbortController();
    setCapabilities(null);
    request<{ actions: Record<string, Capability> }>(`/v1/corridors/${corridor.corridor_id}/capabilities`, controller.signal)
      .then(r => setCapabilities(r.actions)).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [corridor.corridor_id, session.user.actor_id]);
  useEffect(() => {
    const controller = new AbortController();
    if (allowed("create_mission")) {
      request<{actors: Assignee[]; drivers: Assignee[]}>(`/v1/mission-assignees?corridor_id=${encodeURIComponent(corridor.corridor_id)}`, controller.signal)
        .then(r => { setAssignees(r.actors); setDrivers(r.drivers); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
      request<{vehicles: Vehicle[]}>(`/v1/vehicles?corridor_id=${encodeURIComponent(corridor.corridor_id)}`, controller.signal)
        .then(r => setVehicles(r.vehicles)).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    }
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
    if (!response.ok) throw await ApiError.fromResponse(response);
    pending.current.delete(signature);
    return response.json();
  }
  async function act(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await work(); setMissionDetail(null); setDetailRouteSelection(null); setDetailTimeline(null); setMessage(success); setRevision(r => r + 1); onChange(); }
    catch (e) { if (e instanceof ApiError && e.reason) setComparison(null); setError(e instanceof Error ? e.message : "The action could not be completed. Retry with the same information."); }
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
  const chooseSegment = <label>Road segment<select value={segmentId} onChange={e => { setSegmentId(e.target.value); setEvidence(""); setReports([]); setDecisionHistory(null); }}>
    {segments.map(s => <option key={s.segment_id} value={s.segment_id}>{segmentName(s)}</option>)}</select></label>;
  const gate = (role: string, description: string) => !capabilities ? <p className="help" role="status">Checking workspace permissions…</p> : <div className="access-note"><strong>{role} access required</strong><p>{description}</p><p>Signed in as {session.user.display_name}: {session.user.roles.map(readable).join(", ")}. An administrator must assign the role for this corridor.</p></div>;
  function submitMission(event: FormEvent<HTMLFormElement>, routeOnly: boolean) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (routeOnly) {
      const mission = missions.find(m => m.mission_id === selectedMissionId);
      if (!mission) { setError("Choose a mission first."); return; }
      const impact = mission.state === "planned" ? null : missionImpacts?.assessments.find(item => item.mission_id === mission.mission_id && item.state === "active");
      if (mission.state !== "planned" && !impact) { setError("Refresh the impact assessment and choose a mission with an active candidate impact."); return; }
      void act(async () => {
        setComparison(null);
        setComparison(await mutate("/v1/routes/compare", { origin: mission.origin, destination: mission.destination,
          corridor_id: corridor.corridor_id, graph_version_id: corridor.graph_version,
          mission_id: mission.mission_id, vehicle_profile: mission.vehicle_profile,
          ...(impact ? {impact_id: impact.impact_id} : {}),
          departure_at: new Date().toISOString(), deadline_at: mission.delivery_window.end, alternative_limit: 3 }));
      }, "Route comparison saved. This does not clear the road or vehicle.");
      return;
    }
    const origin = segments.find(s => s.segment_id === data.get("origin"))!;
    const destination = segments.find(s => s.segment_id === data.get("destination"))!;
    const start = new Date().toISOString();
    const end = new Date(String(data.get("deadline"))).toISOString();
    const points = { origin: { type: "Point", coordinates: origin.geometry.coordinates[0] },
      destination: { type: "Point", coordinates: destination.geometry.coordinates.at(-1) } };
    void act(async () => {
      await mutate("/v1/missions", { ...points, corridor_id: corridor.corridor_id, cargo_class: data.get("cargo"),
        priority: data.get("priority"), vehicle_profile: data.get("vehicle"), delivery_window: { start, end },
        vehicle_id: data.get("vehicle_id") || null, driver_actor_id: data.get("driver_actor_id") || null,
        receiving_facility: data.get("facility"), receiving_contact: data.get("contact"),
        gps_consent: { basis: "mission_assignment", recorded_at: start }, assigned_actor_ids: data.getAll("assignees"), route_id: null });
    }, "Mission saved. Start it from the mission board when ready.");
  }
  async function showMissionDetail(id: string) {
    setError("");
    try {
      const [detail, route, alert, timeline] = await Promise.all([
        request<Mission>(`/v1/missions/${id}`),
        request<{selection: SelectionDetail | null}>(`/v1/missions/${id}/route-selection`),
        request<{alert: RouteAlertSummary | null}>(`/v1/missions/${id}/route-alert`),
        request<MissionTimeline>(`/v1/missions/${id}/timeline`),
      ]);
      setMissionDetail(detail); setDetailRouteSelection(route.selection); setDetailRouteAlert(alert.alert); setDetailTimeline(timeline);
    } catch (e) { setError(e instanceof Error ? e.message : "Mission details are unavailable."); }
  }
  async function loadDecisionHistory() {
    try {
      const result = await request<{decisions: DecisionHistory[]}>(`/v1/status-decisions/history?segment_id=${encodeURIComponent(segmentId)}`);
      setDecisionHistory(result.decisions); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Decision history is unavailable."); }
  }
  async function loadMissionImpacts() {
    try {
      const result = await request<{assessments: MissionImpact[]; unassessed: {mission_id: string; reason: string}[]}>(`/v1/corridors/${encodeURIComponent(corridor.corridor_id)}/mission-impacts`);
      setMissionImpacts(result); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Mission impact assessment is unavailable."); }
  }
  async function loadRouteAlert(id: string) {
    const result = await request<{alert: RouteAlertSummary | null}>(`/v1/missions/${id}/route-alert`);
    setRouteAlert(result.alert);
  }
  const planForm = (routeOnly: boolean) => <form className="workflow-form" onSubmit={e => submitMission(e, routeOnly)}>
    <p className="workflow-caution">Replay corridor: locations use the selected synthetic band endpoints. This is a workflow demonstration, not navigation clearance.</p>
    {routeOnly ? <label>Mission<select required value={selectedMissionId} onChange={e => {
      const id = e.target.value;
      setSelectedMissionId(id); setComparison(null); setRouteSelection(null);
      setRouteChangeApproval(null); setRouteAlert(null);
      if (id) {
        void request<{selection: SelectionDetail | null}>(`/v1/missions/${id}/route-selection`).then(r => setRouteSelection(r.selection)).catch(err => setError(err.message));
        void request<{approval: {route_id: string; status: string; reason: string; expires_at: string} | null}>(`/v1/missions/${id}/route-change-approval`).then(r => setRouteChangeApproval(r.approval)).catch(err => setError(err.message));
        void loadRouteAlert(id).catch(err => setError(err.message));
      }
    }}><option value="">Choose a mission</option>{missions.filter(m=>new Date(m.delivery_window.end)>new Date() && (m.state==="planned" || (["accepted","active"].includes(m.state) && missionImpacts?.assessments.some(item=>item.mission_id===m.mission_id && item.state==="active")))).map(m=><option key={m.mission_id} value={m.mission_id}>{m.cargo_class} · {readable(m.state)} · due {date(m.delivery_window.end)}</option>)}</select></label> : <>
    <div className="form-grid">
      <label>Origin band<select name="origin" required>{segments.map(s => <option key={s.segment_id} value={s.segment_id}>{segmentName(s)}</option>)}</select></label>
      <label>Destination band<select name="destination" required defaultValue={segments.at(-1)?.segment_id}>{segments.map(s => <option key={s.segment_id} value={s.segment_id}>{segmentName(s)}</option>)}</select></label>
      <label>Vehicle profile<select name="vehicle" value={vehicleProfile} onChange={e=>{setVehicleProfile(e.target.value);setSelectedVehicleId("");}}><option value="light_goods">Light goods vehicle</option><option value="rigid_truck">Rigid truck</option><option value="emergency">Emergency vehicle</option></select></label>
      <label>Delivery deadline<input name="deadline" type="datetime-local" required /></label>
      {!routeOnly && <><label>Cargo<input name="cargo" placeholder="e.g. essential medicines" required maxLength={128} /></label><label>Priority<select name="priority"><option value="routine">Routine</option><option value="high">High</option><option value="emergency">Emergency</option></select></label>
        <label>Receiving facility<input name="facility" required maxLength={255} placeholder="Facility or receiving unit" /></label><label>Receiving contact<input name="contact" required maxLength={255} placeholder="Authorized desk or contact" /></label>
        <label>Registered vehicle<select name="vehicle_id" value={selectedVehicleId} onChange={e=>setSelectedVehicleId(e.target.value)}><option value="">Assign later</option>{vehicles.filter(v=>v.profile===vehicleProfile).map(v=><option key={v.vehicle_id} value={v.vehicle_id}>{v.alias}</option>)}</select></label>
        <label>Driver<select name="driver_actor_id" disabled={!selectedVehicleId}><option value="">Assign later</option>{drivers.map(d=><option key={d.actor_id} value={d.actor_id}>{d.display_name}</option>)}</select></label></>}
    </div>
    {!routeOnly && <label>Assigned field reporters<select name="assignees" multiple>{assignees.map(a => <option key={a.actor_id} value={a.actor_id}>{a.display_name}</option>)}</select><span>{assignees.length ? "Select reporters who have agreed to this assignment." : "No field reporters provisioned in this corridor. A dispatcher can still manage the delivery without GPS."}</span></label>}
    {!routeOnly && <label className="consent"><input type="checkbox" required /> I have consent to create this mission. GPS is not collected by creating it.</label>}
    </>}
    <button disabled={busy}>{busy ? "Saving…" : routeOnly ? "Compare baseline routes" : "Create mission"}</button>
  </form>;
  return <section id="operations" className="card operations-console">
    <header className="card-hd"><div><p className="eyebrow">{workspace === "authority" ? "AUTHORITY DESK" : workspace === "field" ? "FIELD MISSIONS" : "CONTROL DESK"}</p><h2>{workspace === "authority" ? "Evidence and road decisions" : workspace === "field" ? "Assigned missions" : "Delivery operations"}</h2><p>Every saved action is recorded in the database. Road status changes require authority; deliveries remain dispatcher decisions.</p></div><span className="pill">Replay workspace</span></header>
    <nav className="workflow-tabs" aria-label="Operational workflows">{[["reports", "01", "Evidence & review"], ["status", "02", "Road decisions"], ["routes", "03", "Route planning"], ["missions", "04", "Mission board"]].filter(([id]) => tabs.includes(id)).map(([id, n, label]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); window.history.replaceState(null,"",`#operations:${id}`); setError(""); setMessage(""); }}><small>{n}</small>{label}</button>)}</nav>
    <div className="card-bd">
      {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="workflow-success" role="status">{message}</p>}
      {tab === "reports" && <><div className="workflow-heading"><div><h3>Evidence inbox</h3><p>Reports are claims until reviewed. Accepting evidence does not automatically open a road.</p></div><span>Field reporters capture observations in NER LENS Field.</span></div>{chooseSegment}
        {!canReports ? gate("Field reporter or reviewer", "Field reporters see their submissions; reviewers can assess reports for their assigned corridor.") : <>{reports.length === 0 && <div className="workflow-empty"><strong>No reports for this segment</strong><p>Submit a report using Field reports below, then refresh this inbox.</p></div>}
        {reports.map(r => <article className="report-row" key={r.field_report_id}><div><span className="status-tag">{readable(r.review_state)}</span><h4>{readable(r.status_claim)} reported · {date(r.observed_at)}</h4><p>{r.note || "No additional note supplied."}</p><small>Report {r.field_report_id}</small></div>
          {allowed("review_evidence") && <ReportMedia reportId={r.field_report_id} owner={session.user.actor_id} />}{allowed("review_evidence") && <ReportHistory reportId={r.field_report_id} />}{allowed("review_evidence") && <form onSubmit={e => { e.preventDefault(); const d = new FormData(e.currentTarget); void act(() => mutate(`/v1/reviews/${r.field_report_id}`, { action: d.get("action"), note: d.get("note"), ...(d.get("action")==="merge" ? { merge_into_evidence_id: d.get("merge_into_evidence_id") } : {}) }), "Review recorded."); }}><label>Decision<select name="action"><option value="accept">Accept evidence</option><option value="reject">Reject evidence</option><option value="needs_clarification">Request clarification</option><option value="merge">Link duplicate to accepted report</option></select></label><label>Reason<textarea name="note" required maxLength={4000} /></label><label>Accepted report ID to link (for duplicate only)<input name="merge_into_evidence_id" /></label><button disabled={busy}>Save review</button></form>}</article>)}<button disabled={busy} onClick={() => setRevision(r => r + 1)}>Refresh inbox</button></>}
      </>}
      {tab === "status" && <><h3>Publish a road decision</h3><p className="help">Only an assigned district authority can publish. Decisions expire; an expired road status becomes unknown.</p>{!allowed("publish_status") ? gate("District officer with status authority", "Publishing requires both a district role and an active authority assignment in the database.") : <form className="workflow-form" onSubmit={e => { e.preventDefault(); const d = new FormData(e.currentTarget); void act(() => mutate("/v1/status-decisions", { segment_id: segmentId, status: d.get("status"), vehicle_scope: [d.get("vehicle")], direction: "both", reason_code: d.get("reason"), order_reference: d.get("order_reference") || null, evidence_ids: String(d.get("evidence") ?? "").split(",").map(s => s.trim()).filter(Boolean), effective_at: new Date().toISOString(), valid_until: new Date(String(d.get("expiry"))).toISOString(), note: d.get("note") }), "Authority decision published. Corridor overview has been refreshed."); }}>{chooseSegment}<div className="form-grid"><label>Road status<select name="status"><option value="unknown">Unknown</option><option value="restricted">Restricted</option><option value="closed">Closed</option><option value="open">Open</option></select></label><label>Applies to<select name="vehicle"><option value="all">All vehicles</option><option value="light_goods">Light goods</option><option value="rigid_truck">Rigid truck</option><option value="emergency">Emergency</option></select></label><label>Valid until<input name="expiry" type="datetime-local" required /></label></div><label>Decision basis<select name="reason" value={statusReason} onChange={e=>setStatusReason(e.target.value)}><option value="authority_order">Authority order</option><option value="landslide">Reviewed landslide evidence</option><option value="flooded">Reviewed flood evidence</option><option value="damage">Reviewed damage evidence</option><option value="reopened">Reviewed reopening evidence</option></select></label><label>Order reference {statusReason==="authority_order" && "(required)"}<input name="order_reference" required={statusReason==="authority_order"} maxLength={128} /></label><label>Accepted evidence IDs (comma separated)<input name="evidence" value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Copy the accepted report IDs from Evidence & review" /></label>{reports.some(r => r.review_state === "accept") && <div className="evidence-options"><span>Accepted reports for this segment:</span>{reports.filter(r => r.review_state === "accept").map(r => <button key={r.field_report_id} type="button" onClick={() => setEvidence(r.field_report_id)}>{readable(r.status_claim)} · {date(r.observed_at)}</button>)}</div>}<label>Order reference or decision explanation<textarea name="note" required maxLength={4000} /></label><p className="help">Evidence-based decisions require accepted reports for this segment. Authority orders require an order reference in the explanation. Both are preserved in the audit trail.</p><button disabled={busy}>Publish decision</button></form>}<button type="button" disabled={!segmentId} onClick={() => void loadDecisionHistory()}>Load decision history</button>{decisionHistory && <div><h4>Persisted decisions for this segment</h4>{decisionHistory.length===0 && <p>No authority decisions recorded.</p>}{decisionHistory.map(item=><p key={item.decision_id}><strong>{readable(item.status)}</strong> · {item.vehicle_scope.map(readable).join(", ")} · {readable(item.direction)} · recorded {date(item.created_at)} by {item.actor_id} · {item.expired ? "Expired" : `Valid until ${date(item.valid_until)}`}<br />{item.note}{item.order_reference && ` · Order ${item.order_reference}`}{item.supersedes_decision_id && ` · Supersedes ${item.supersedes_decision_id}`}</p>)}</div>}</>}
      {tab === "routes" && <>
        <h3>Compare a mission route</h3>
        <p className="help">Travel-time baseline only. Vehicle legality, hazard coverage, and routing policy are not verified; no safe-route recommendation is issued.</p>
        {allowed("compare_routes") ? <>
          <button type="button" disabled={busy} onClick={() => void loadMissionImpacts()}>Refresh affected missions</button>
          {missionImpacts && <p className="help">{missionImpacts.assessments.filter(item => item.state === "active").length} active candidate impacts. Only affected accepted or active missions appear below.</p>}
          {planForm(true)}
        </> : gate("Dispatcher", "Dispatchers can request and save route comparisons for this corridor.")}
        {routeSelection && <div className="notice"><SelectionSummary selection={routeSelection} /></div>}
        {routeChangeApproval && <p className="notice">Candidate route {routeChangeApproval.route_id} approved for review · {readable(routeChangeApproval.status)} · {routeChangeApproval.reason} · Approval source expires {date(routeChangeApproval.expires_at)}. {routeAlert?.acknowledgment?.selection_id ? "The driver accepted and the replay baseline changed." : "The driver route has not changed."}</p>}
        {routeAlert && <><p className="notice">Alert {readable(routeAlert.delivery_state)} · {routeAlert.acknowledgment ? `Driver ${routeAlert.acknowledgment.decision === "accept" ? "accepted" : "declined"} at ${date(routeAlert.acknowledgment.acknowledged_at)}` : "Awaiting driver acknowledgment"}. {routeAlert.acknowledgment?.selection_id ? "The candidate replay baseline is now selected." : "The selected driver route has not changed."}</p><AlertConstraints alert={routeAlert} /></>}
        {comparison && <div className="route-result">
          <p>Provider: {comparison.provider} · Retrieved {date(comparison.retrieved_at)} · Source age {Math.max(0, Math.round((Date.now() - new Date(comparison.retrieved_at).getTime()) / 60000))} min · Vehicle entitlement: {readable(comparison.vehicle_entitlement)}</p>
          <span className="status-tag">{readable(comparison.mode)}</span>
          {comparison.warnings.map((warning, i) => <p className="help" key={i}>{warning}</p>)}
          {comparison.blocking_constraints.map((blocked, i) => <p key={i} className="notice">Excluded: {segments.find(s => s.segment_id === blocked.segment_id) ? segmentName(segments.find(s => s.segment_id === blocked.segment_id)!) : blocked.segment_id} — {readable(blocked.reason)}</p>)}
          {comparison.routes.length === 0 ? <p>No feasible candidate was returned. Keep the current route under review; no road clearance is implied.</p> : comparison.routes.map(route => <article key={route.route_id}>
            <strong>{Math.round(route.score_components.travel_minutes)} min · {comparison.vehicle_entitlement === "unverified_car_baseline" ? "car baseline" : `${readable(comparison.vehicle_profile)} profile baseline`}</strong>
            <p>{route.reason}</p>
            <p className="help">{route.segment_ids.length} linked bands · {route.key_evidence_ids.length} cited evidence records · Uncertainty {route.uncertainty_score === null ? "not measured" : route.uncertainty_score}</p>
            {comparison.impact_id && routeSelection?.route_id === route.route_id ? <p className="help">This is the currently selected baseline. Choose a different candidate to propose a change.</p> : comparison.impact_id ? <form className="workflow-form" onSubmit={event => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); void act(async () => { const saved = await mutate(`/v1/missions/${comparison.mission_id}/route-change-approval`, { impact_id: comparison.impact_id, comparison_id: comparison.comparison_id, route_id: route.route_id, reason }); setRouteChangeApproval(saved as {route_id: string; status: string; reason: string; expires_at: string}); await loadRouteAlert(comparison.mission_id); }, "Candidate route approved. Driver acknowledgment and fresh checks are still required before a route change."); }}>
              <label>Reason for candidate route change<textarea name="reason" required minLength={10} maxLength={1000} /></label>
              <button disabled={busy || routeChangeApproval !== null}>Approve candidate for driver review</button>
            </form> : <button disabled={busy} onClick={() => void act(async () => { await mutate(`/v1/missions/${comparison.mission_id}/route-selection`, { comparison_id: comparison.comparison_id, route_id: route.route_id }); const saved = await request<{selection: SelectionDetail}>(`/v1/missions/${comparison.mission_id}/route-selection`); setRouteSelection(saved.selection); }, "Planning baseline saved for this mission. It is not road or vehicle clearance.")}>Save as planning baseline</button>}
          </article>)}
        </div>}
      </>}
      {tab === "missions" && <><div className="workflow-heading"><div><h3>Medicine mission board</h3><p>Plan and assign a delivery. A driver-assigned mission needs driver acceptance and a separate dispatcher confirmation. ETA remains unavailable without a verified route.</p></div><button disabled={busy} onClick={() => setRevision(r => r + 1)}>Refresh board</button></div>
        {workspace === "control" && allowed("compare_routes") && <details><summary>Assess disruption candidates</summary><p className="help">Checks selected route segments against current authority decisions. These are unverified replay-geometry candidates, not automatic reroutes or road clearance.</p><button type="button" onClick={() => void loadMissionImpacts()}>Refresh impact assessment</button>{missionImpacts && <div>{missionImpacts.assessments.length===0 && <p>No candidate impacts recorded for this corridor.</p>}{missionImpacts.assessments.map(item=><p key={item.impact_id}><strong>{item.state === "active" ? "Candidate impact" : "Resolved candidate"}</strong> · Mission {item.mission_id} · {segments.find(s=>s.segment_id===item.segment_id) ? segmentName(segments.find(s=>s.segment_id===item.segment_id)!) : item.segment_id} · {readable(item.status)} · Decision {item.decision_id} · expires {date(item.decision_valid_until)}</p>)}{missionImpacts.unassessed.map(item=><p className="help" key={item.mission_id}>Mission {item.mission_id}: {readable(item.reason)}; cannot assess against a selected current route.</p>)}</div>}</details>}
        {allowed("create_mission") ? <details><summary>Create a delivery mission</summary>{planForm(false)}</details> : workspace === "field" ? <p className="help">Dispatchers create missions. Your assigned missions appear below when available.</p> : gate("Dispatcher", "A dispatcher role is required to create delivery missions in this corridor.")}
        {(allowed("view_mission") || allowed("submit_gps")) && <>{!missions.length && <div className="workflow-empty"><strong>No missions assigned to this account</strong><p>{workspace === "field" ? "Ask the dispatcher to assign you to a delivery." : "Create a mission or ask the dispatcher to assign you to an existing delivery."}</p></div>}{missions.map(m => <article className="mission-row" key={m.mission_id}><div><span className="status-tag">{m.state}</span><h4>{m.cargo_class}</h4><p>{readable(m.priority)} priority · Due {date(m.delivery_window.end)}</p><p>Receiving: {m.receiving_facility || "not recorded"} · Vehicle: {vehicles.find(v=>v.vehicle_id===m.vehicle_id)?.alias || "assignment pending"} · Driver: {drivers.find(d=>d.actor_id===m.driver_actor_id)?.display_name || "assignment pending"}</p><small>{readable(m.deadline_state)} · {m.last_fix_age_seconds === null ? "No GPS fix received" : `Last GPS fix ${Math.round(m.last_fix_age_seconds / 60)} min ago`}</small>{m.driver_actor_id && m.state==="planned" && <p className="help">Awaiting driver acceptance.</p>}{m.state==="delivered" && <p className="help">Driver declared delivery; dispatcher confirmation is pending.</p>}{workspace === "control" && <p><button disabled={busy} onClick={() => void showMissionDetail(m.mission_id)}>View mission details</button></p>}{missionDetail?.mission_id===m.mission_id && <div><p>Receiving contact: {missionDetail.receiving_contact || "not recorded"}</p><p>ETA basis: unverified travel-time baseline; no operational ETA.</p>{detailRouteSelection ? <SelectionSummary selection={detailRouteSelection} /> : <p>No route baseline saved for this mission.</p>}{detailRouteAlert && <><p>Route alert {readable(detailRouteAlert.delivery_state)} · {detailRouteAlert.acknowledgment ? `Driver ${detailRouteAlert.acknowledgment.decision === "accept" ? "accepted" : "declined"} at ${date(detailRouteAlert.acknowledgment.acknowledged_at)}` : "Awaiting driver acknowledgment"}</p><AlertConstraints alert={detailRouteAlert} /></>}{missionDetail.confirmation && <p>Confirmed by {readable(missionDetail.confirmation.basis)}: {missionDetail.confirmation.note}</p>}{detailTimeline && <MissionTimelineView timeline={detailTimeline}/>}</div>}</div><div>{m.state === "planned" && !m.driver_actor_id && <button disabled={busy} onClick={() => void act(() => mutate(`/v1/missions/${m.mission_id}/start`), "Mission started.")}>Start mission</button>}{m.state === "active" && allowed("submit_gps") && <button disabled={busy} onClick={() => void capturePosition(m)}>Share current location once</button>}{m.state === "active" && !m.driver_actor_id && <button disabled={busy} onClick={() => void act(() => mutate(`/v1/missions/${m.mission_id}/complete`), "Delivery completion recorded.")}>Mark delivered</button>}{m.state === "delivered" && workspace === "control" && <form onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void act(()=>mutate(`/v1/missions/${m.mission_id}/confirm-delivery`,{basis:d.get("basis"),note:d.get("note")}),"Delivery confirmed separately from the driver declaration.");}}><label>Confirmation basis<select name="basis"><option value="dispatcher_observation">Dispatcher observed</option><option value="receiver_attestation">Receiver attestation recorded by dispatcher</option></select></label><label>Confirmation note<textarea name="note" required maxLength={1000}/></label><button disabled={busy}>Confirm delivery</button></form>}{workspace==="control" && ["planned","accepted","active","delivered"].includes(m.state) && <details><summary>Cancel mission</summary><form onSubmit={e=>{e.preventDefault();void act(()=>mutate(`/v1/missions/${m.mission_id}/cancel`,{reason:new FormData(e.currentTarget).get("reason")}),"Mission cancelled with reason recorded.");}}><label>Reason<textarea name="reason" required maxLength={1000}/></label><button disabled={busy}>Cancel mission</button></form></details>}</div></article>)}</>}
      </>}
    </div>
  </section>;
}
