import Login from "./Login";
import Workflows from "./Workflows";
import Administration from "./Administration";
import OfflineReports from "./OfflineReports";
import CorridorMap from "./CorridorMap";
import { ArrowClockwise, ArrowRight, ArrowUpRight, MapTrifold } from "@phosphor-icons/react";
import { permittedWorkspaces, workspaceFromPath, workspaces } from "./workspace";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { saveOfflineContext, loadOfflineContext, clearOfflineContext } from "./offline";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ApiError,
  request,
  segmentName,
  type Catalog,
  type State,
  type Session,
} from "./api";
const words = (value: string) => value === "system_admin" ? "Super Admin" : value.replaceAll("_", " ");
function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <header className="card-hd">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
function Details({ value }: { value: Record<string, unknown> }) {
  return (
    <dl className="details">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt>{words(key)}</dt>
          <dd>
            {item === null
              ? "Not available"
              : typeof item === "object"
                ? JSON.stringify(item)
                : String(item)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function SourceHealth({ owner }: { owner: string }) {
  const { data, error, refetch, isFetching } = useQuery({ queryKey: ["source-health", owner],
    queryFn: ({ signal }) => request<{ sources: { source: string; status: string; reason: string; retrieved_at: string | null; record_count: number }[]; note: string }>("/health/sources", signal), retry: false });
  return <Card title="External source access" subtitle="Latest provider retrievals">
    <div className="card-bd">
      {error && <p role="alert">Source checks are unavailable. Try again.</p>}
      {!data && !error && <p role="status">Loading source checks…</p>}
      {data && <><p className="help">{data.note}</p><div className="tw"><table>
        <thead><tr>{["Provider", "Status", "Result", "Records", "Checked"].map(label =>
          <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{data.sources.map(source => <tr key={source.source}>
          <th scope="row">{words(source.source)}</th><td>{words(source.status)}</td>
          <td>{words(source.reason)}</td><td>{source.record_count}</td>
          <td>{source.retrieved_at ? new Date(source.retrieved_at).toLocaleString() : "Not checked"}</td>
        </tr>)}</tbody>
      </table></div></>}
      <button disabled={isFetching} onClick={() => void refetch()}>Refresh source checks</button>
    </div>
  </Card>;
}
function ModelReadiness() {
  const {data,error}=useQuery({queryKey:["model-readiness"],queryFn:({signal})=>request<Record<string,unknown>>("/v1/models/current",signal),retry:false});
  return <section id="model-readiness" className="card"><header className="card-hd"><div><h2>Prediction readiness</h2><p>Check model approval before relying on a prediction.</p></div></header><div className="card-bd">
    {error&&<p role="alert">{error.message}</p>}
    {!data&&!error&&<p>Loading model card…</p>}
    {data&&<><p>{data.approved_for_operations ? "Approved for operations" : "No model is approved for operational decisions."}</p><Details value={data}/></>}
  </div></section>;
}
export default function App() {
  const requestedWorkspace = workspaceFromPath(window.location.pathname);
  const workspace = requestedWorkspace ?? "control";
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [draftOnly, setDraftOnly] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [connected, setConnected] = useState(navigator.onLine);
  const [checking, setChecking] = useState(true),
    [signingOut, setSigningOut] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [corridorId, setCorridorId] = useState("");
  const [state, setState] = useState<State | null>(null),
    [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [ready, setReady] = useState("Checking service");
  const availableWorkspaces = permittedWorkspaces(session?.user.roles ?? []);
  const authorized = availableWorkspaces.includes(workspace);
  const adminOnly = workspace === "authority" && Boolean(session?.user.roles.includes("system_admin")) &&
    !session?.user.roles.some(role => ["regional_viewer", "dispatcher", "reviewer", "district_officer", "field_reporter"].includes(role));

  useEffect(() => {
    if (session && !requestedWorkspace && availableWorkspaces.length) {
      window.location.replace(`/${availableWorkspaces[0]}/`);
    }
  }, [session, requestedWorkspace, availableWorkspaces.join(",")]);

  useEffect(() => {
    const navigate=()=>{const id=window.location.hash.slice(1).split(":")[0]; if(id)document.getElementById(id)?.scrollIntoView({behavior:"smooth"});};
    window.addEventListener("hashchange",navigate);return()=>window.removeEventListener("hashchange",navigate);
  },[]);
  const pageRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request<Session>("/v1/auth/session", controller.signal)
      .then(async (data) => {
        await clearOfflineContext();
        if (!controller.signal.aborted) setSession(data);
      })
      .catch(async (err) => {
        if (!controller.signal.aborted && !(err instanceof ApiError)) {
          try {
            const cached = await loadOfflineContext();
            if (cached && !controller.signal.aborted) {
              setDraftOnly(true);
              setSavedAt(cached.saved_at);
              setSession({ user: { ...cached.profile, email: null }, expires_at: "1970-01-01T00:00:00Z" });
              setCatalog(cached.catalog); setState(cached.state);
              setCorridorId(cached.state.corridor_id);
              setSelectedId(cached.state.segments[0]?.segment_id ?? "");
              return;
            }
          } catch { /* Local storage unavailable: show sign-in instead. */ }
        }
        if (
          !controller.signal.aborted &&
          !(err instanceof ApiError && err.status === 401)
        )
          setError("Unable to restore your session. Sign in to try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const update = () => setConnected(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    if (session && catalog && state && !draftOnly) void saveOfflineContext(session, catalog, state)
      .catch(() => setError("Offline snapshot could not be saved. Device storage may be unavailable or full."));
  }, [session, catalog, state, draftOnly]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/health/ready", { signal: controller.signal })
      .then((r) => setReady(r.ok ? "API ready" : "API not ready"))
      .catch(() => {
        if (!controller.signal.aborted) setReady("API unavailable");
      });
    return () => controller.abort();
  }, [refresh, session]);
  useEffect(() => {
    if (!session || draftOnly) return;
    const timer = window.setTimeout(
      () => {
        if (!navigator.onLine && state) { setDraftOnly(true); setSavedAt(state.as_of); }
        else fail(new ApiError(401));
      },
      Math.max(0, new Date(session.expires_at).getTime() - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session, draftOnly, state]);
  function fail(err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    setError(
      err instanceof ApiError
        ? err.message
        : "Could not load corridor data. Check your connection and retry.",
    );
    if (err instanceof ApiError && err.status === 401) {
      pageRequest.current?.abort();
      setSession(null);
      setCatalog(null);
      setState(null);
    }
  }
  useEffect(() => {
    if (!session || draftOnly || !authorized) return;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    request<Catalog>(adminOnly ? "/v1/admin/corridors" : "/v1/corridors", controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setCatalog(data);
        setCorridorId((current) =>
          data.corridors.some((c) => c.corridor_id === current)
            ? current
            : (data.corridors[0]?.corridor_id ?? ""),
        );
        if (!data.corridors.length) setBusy(false);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          fail(err);
          setBusy(false);
        }
      });
    return () => controller.abort();
  }, [session, refresh, draftOnly, authorized, adminOnly]);
  useEffect(() => {
    pageRequest.current?.abort();
    if (!session || !corridorId || draftOnly || !authorized || adminOnly) return;
    const controller = new AbortController();
    setBusy(true);
    setState(current => current?.corridor_id === corridorId ? current : null);
    setError("");
    request<State>(
      `/v1/corridors/${encodeURIComponent(corridorId)}/state?limit=200`,
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setState(data);
        setSelectedId(current => data.segments.some(s => s.segment_id === current) ? current : data.segments[0]?.segment_id ?? "");
      })
      .catch(fail)
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [session, corridorId, draftOnly, refresh, authorized, adminOnly]);
  async function logout() {
    setSigningOut(true);
    setError("");
    try {
      if (!draftOnly) await request("/v1/auth/logout", undefined, {});
      await clearOfflineContext();
      queryClient.clear();
      pageRequest.current?.abort();
      setSession(null);
      setDraftOnly(false);
      setCatalog(null);
      setState(null);
      setCorridorId("");
      setSelectedId("");
      setQuery("");
      setFilter("all");
      setBusy(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) fail(err);
      else
        setError(
          "Sign out could not be confirmed. Your session may still be active. Please retry.",
        );
    } finally {
      setSigningOut(false);
    }
  }
  async function loadMore() {
    if (!state?.next_cursor || busy) return;
    const controller = new AbortController();
    pageRequest.current = controller;
    setBusy(true);
    setError("");
    try {
      const data = await request<State>(
        `/v1/corridors/${encodeURIComponent(corridorId)}/state?limit=200&cursor=${encodeURIComponent(state.next_cursor)}`,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setState((current) =>
        current?.corridor_id === data.corridor_id
          ? { ...data, segments: [...current.segments, ...data.segments] }
          : current,
      );
    } catch (err) {
      fail(err);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const corridor = catalog?.corridors.find((c) => c.corridor_id === corridorId);
  const segments = state?.segments ?? [];
  const visible = segments.filter(
    (s) =>
      (filter === "all" || s.operational_status.value === filter) &&
      `${segmentName(s)} ${s.segment_id}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selected = segments.find((s) => s.segment_id === selectedId);
  const attention = segments.filter(s => s.operational_status.value !== "open" || s.risk.state === "insufficient_evidence");
  return (
    <>
      <a className="skip" href="#main">
        Skip to corridor content
      </a>
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              N
            </span>
            <strong>NER LENS</strong>
            <span className="sep">/</span>
            <span>{workspaces[workspace].name}</span>
          </div>
          <div className="tools">
            <span className="environment-label">{ready}</span>
            <button onClick={() => setRefresh((v) => v + 1)} disabled={busy || draftOnly || !connected}>
              <ArrowClockwise size={14} /> Refresh
            </button>
            {session && (
              <>
                <span className="user-account">
                  <strong>{session.user.display_name}</strong>
                  <span>{session.user.roles.map(words).join(" · ")}</span>
                </span>
                <button onClick={logout} disabled={signingOut}>
                  {signingOut ? "Signing out…" : draftOnly ? "Lock offline view" : "Sign out"}
                </button>
              </>
            )}
          </div>
        </div>
        {session && authorized && <nav className="topbar-nav" aria-label="Applications">{availableWorkspaces.map(id => <a key={id} href={`/${id}/`} aria-current={workspace === id ? "page" : undefined}>{workspaces[id].name}</a>)}</nav>}
      </header>
      {checking || (session && !requestedWorkspace && availableWorkspaces.length > 0) ? (
        <main id="main" className="session-check" role="status">
          Checking your session…
        </main>
      ) : !session ? (
        <Login
          message={error}
          workspaceName={workspaces[workspace].name}
          onLogin={async (data) => {
            setError("");
            setDraftOnly(false);
            setCatalog(null); setState(null);
            queryClient.clear();
            await clearOfflineContext();
            setSession(data);
          }}
        />
      ) : !authorized ? (
        <main id="main" className="shell" tabIndex={-1}>
          <section className="card"><header className="card-hd"><div><h1>Workspace access required</h1><p>Your account does not have the role for NER LENS {workspaces[workspace].name}.</p></div></header>
            <div className="card-bd"><p>Ask an administrator for the appropriate corridor role, or open a workspace already assigned to you.</p>
              {availableWorkspaces.map(id => <p key={id}><a href={`/${id}/`}>Open NER LENS {workspaces[id].name}</a></p>)}
              {!availableWorkspaces.length && <p>No application role is assigned to this account.</p>}
              <button onClick={logout} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
            </div></section>
        </main>
      ) : (
        <main id="main" className="shell" tabIndex={-1}>
          {(draftOnly || !connected) && <div className="notice" role="status">
            Offline / stale snapshot{savedAt ? ` saved ${new Date(savedAt).toLocaleString()}` : ""}. Capture drafts only; displayed road conditions are not current.
            {draftOnly && <><p>This device profile is not an authenticated session. Sign in again to synchronize.</p><button onClick={() => { setSession(null); setCatalog(null); setState(null); setDraftOnly(false); }}>Sign in again</button></>}
          </div>}
          <div className="page-heading">
            <div>
              <p className="eyebrow">NORTH EAST REGION · {workspaces[workspace].name.toUpperCase()}</p>
              <h1>NER LENS {workspaces[workspace].name}</h1>
              <p>{workspaces[workspace].description}</p>
            </div>
            <span className="pill">
              {state?.data_mode ?? catalog?.data_mode ?? "Read-only"}
              {state?.data_mode ? " data" : ""}
            </span>
          </div>
          <div className="workspace-status"><strong>SIH MVP · Replay workspace</strong><p>{workspace === "field" ? "Save observations on this device, then synchronize after signing in. The corridor geometry is synthetic and does not establish road safety." : "Provider connection status is shown below. The corridor geometry is synthetic, and route safety and prediction accuracy are not validated. Your account permissions determine which operations you can perform."}</p></div>
          <nav className="workspace-nav" aria-label="Workspace sections">
            {!adminOnly && <a href="#segments">Corridor conditions</a>}
            {workspace === "control" && <><a href="#operations:missions">Deliveries</a><a href="#operations:routes">Route planning</a><a href="#sources">Source connections</a></>}
            {workspace === "authority" && <>{!adminOnly && <><a href="#operations:reports">Evidence review</a><a href="#operations:status">Road decisions</a></>}{session.user.roles.includes("system_admin") && <a href="#administration">People & access</a>}{!adminOnly && <a href="#sources">Source connections</a>}</>}
            {workspace === "field" && <><a href="#field-reports">Field reports & offline queue</a><a href="#operations:missions">Assigned missions</a></>}
            {!adminOnly && <a href="#user-stories">SIH user stories</a>}
          </nav>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <>
            <div className="toolbar">
              <div>
                <label htmlFor="corridor">Corridor</label>
                <select
                  id="corridor"
                  value={corridorId}
                  onChange={(e) => setCorridorId(e.target.value)}
                  disabled={busy || draftOnly || !catalog?.corridors.length}
                >
                  {!catalog?.corridors.length && (
                    <option value="">No corridors available</option>
                  )}
                  {catalog?.corridors.map((c) => (
                    <option key={c.corridor_id} value={c.corridor_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="stamp">{adminOnly ? "Administration scope" : state
                ? `Snapshot ${new Date(state.as_of).toLocaleString()}` : "No snapshot loaded"}</p>
            </div>
            <div aria-live="polite" className="sr-only">
              {busy
                ? "Loading corridor data"
                : `${visible.length} segments shown`}
            </div>
            {busy && !state && !adminOnly && (
              <div className="skeleton" aria-label="Loading corridor data" />
            )}
            {!busy && !state && !error && !adminOnly && (
              <p className="notice">
                No corridor state is available. Select a corridor or refresh
                after the audited data is imported.
              </p>
            )}
            {adminOnly && !draftOnly && corridorId && <Administration key={"admin-" + corridorId + session.user.actor_id} session={session} corridorId={corridorId} manageUsers />}
            {workspace === "field" && state && <div id="field-reports"><OfflineReports session={session} segments={segments} authenticated={!draftOnly} /></div>}
            {state && (
              <div className="rows">
                <section className="brief-band" aria-label="Corridor brief">
                  <span className="brief-symbol"><MapTrifold size={20} weight="duotone" /></span>
                  <div>
                    <p className="eyebrow">CORRIDOR BRIEF · {state.data_mode} snapshot</p>
                    <p><strong>{segments.length} segments loaded. {segments.filter(s => s.operational_status.value === "unknown").length} have unknown operational status.</strong> Review the map and published decisions before dispatch. Unknown does not mean passable.</p>
                  </div>
                  {workspace === "control" && <a href="#operations:routes" className="brief-action">Plan a route <ArrowUpRight size={15} /></a>}
                </section>
                <ul className="context-strip" aria-label="Corridor context">
                  <li><b>{corridor?.name ?? "Selected corridor"}</b></li>
                  <li><b>{segments.length}</b> loaded bands</li>
                  <li><b>{segments.filter(s => s.source_health === "reviewed_evidence").length}</b> with reviewed evidence</li>
                  <li>Snapshot {new Date(state.as_of).toLocaleString()}</li>
                </ul>
                <div className="split command-grid">
                  <Card title="Geographic overview" subtitle="Mappls road route · corridor assessment bands">
                    <p className="card-bd replay-note">The blue road layer comes from Mappls. Assessment bands define the reporting area; their road status comes from published authority decisions. Select a band to inspect evidence or capture a report.</p>
                    <CorridorMap corridorId={corridorId} segments={visible} selectedId={selectedId} onSelect={setSelectedId} />
                    <div className="map-footer"><span><i className="legend-line" /> Synthetic band geometry</span><span><i className="legend-line selected" /> Selected band</span><a href="#segments">Explore in table ↓</a></div>
                  </Card>
                  <section className="card attention-panel" aria-label="Decision queue">
                    <header className="card-hd"><div><p className="eyebrow">DECISION QUEUE</p><h2>Requires attention <span className="queue-count">{attention.length}</span></h2><p>Loaded bands needing a status or evidence check</p></div><a href="#segments" aria-label="View all operational segments"><ArrowUpRight size={17} /></a></header>
                    <div className="priority-feed">{!attention.length && <p className="card-bd">No loaded bands currently need a status or evidence check.</p>}{attention.slice(0, 5).map(s => <article key={s.segment_id}>
                      <div className="priority-top"><span className={`pill road-${s.operational_status.value}`}>{words(s.operational_status.value)}</span><span className="mono">{s.source_health === "reviewed_evidence" ? "Reviewed evidence" : "Evidence pending"}</span></div>
                      <button className="priority-title" onClick={() => {setSelectedId(s.segment_id); document.getElementById("segment-detail")?.scrollIntoView({behavior:"smooth"});}}>{segmentName(s)} <ArrowUpRight size={14} /></button>
                      <p>{s.operational_status.value === "unknown" ? "Passability has not been established." : `Published status: ${words(s.operational_status.value)}.`} {s.risk.state === "insufficient_evidence" ? "Prediction abstained." : ""}</p>
                    </article>)}</div>
                    <a className="queue-footer" href="#segments">View all segments <ArrowRight size={14} /></a>
                  </section>
                </div>
                <section className="kpis" aria-label="Loaded corridor summary">
                  {[
                    [
                      segments.length,
                      "Segments loaded",
                      state.next_cursor
                        ? "More segments available"
                        : "Complete snapshot",
                    ],
                    [
                      segments.filter(
                        (s) => s.operational_status.value === "unknown",
                      ).length,
                      "Unknown status",
                      "No verified passability",
                    ],
                    [
                      segments.filter(
                        (s) => s.risk.state === "insufficient_evidence",
                      ).length,
                      "Insufficient evidence",
                      "Risk assessment abstained",
                    ],
                    [
                      segments.filter((s) => s.evidence_age_seconds !== null)
                        .length,
                      "With evidence age",
                      "Of the loaded segments",
                    ],
                  ].map(([value, label, note]) => (
                    <article className="kpi" key={label}>
                      <p>{label}</p>
                      <div className="val">{value}</div>
                      <p className="foot">{note}</p>
                    </article>
                  ))}
                </section>
                <section id="segment-detail">
                  <Card
                    title="Segment detail"
                    subtitle={
                      selected
                        ? segmentName(selected)
                        : "Select a band in the table"
                    }
                  >
                    {selected ? (
                      <div className="card-bd">
                        <div className="status-pair">
                          <div>
                            <p className="eyebrow">OPERATIONAL STATUS</p>
                            <span className="pill">
                              {words(selected.operational_status.value)}
                            </span>
                          </div>
                          <div>
                            <p className="eyebrow">RISK OUTLOOK</p>
                            <span className="pill warning">
                              {words(selected.risk.state)}
                            </span>
                          </div>
                        </div>
                        <p className="notice">
                          {selected.risk.abstention_reason
                            ? words(selected.risk.abstention_reason)
                            : "No abstention reason supplied."}
                        </p>
                        <Details
                          value={{
                            segment_id: selected.segment_id,
                            direction: selected.direction,
                            segment_type: selected.segment_type,
                            vehicle_scope:
                              selected.operational_status.vehicle_scope.join(
                                ", ",
                              ),
                            status_valid_until:
                              selected.operational_status.valid_until ?? "No current authority decision",
                            evidence_age:
                              selected.evidence_age_seconds === null
                                ? "No reviewed field observation"
                                : `${selected.evidence_age_seconds} seconds`,
                            source_health: selected.source_health,
                            prediction_horizon: `${selected.risk.horizon_seconds / 3600} hours`,
                            probability: selected.risk.probability ?? "Model has not issued a prediction",
                          }}
                        />
                        <p className="notice">
                          Vehicle restrictions below are hand-authored synthetic
                          fixtures, not verified legal or physical limits.
                        </p>
                        <details>
                          <summary>Vehicle constraints and references</summary>
                          <Details value={selected.vehicle_constraints} />
                          <Details
                            value={{ external_refs: selected.external_refs }}
                          />
                        </details>
                      </div>
                    ) : (
                      <p className="card-bd">
                        Choose a segment to inspect its status and evidence.
                      </p>
                    )}
                  </Card>
                </section>
                <section className="card" id="segments">
                  <header className="card-hd">
                    <div>
                      <h2>Operational segments</h2>
                      <p>
                        Map alternative · select a segment to inspect its
                        evidence
                      </p>
                    </div>
                    <span className="stamp">
                      {visible.length} of {segments.length}
                    </span>
                  </header>
                  <div className="filters">
                    <div>
                      <label htmlFor="search">Find a segment</label>
                      <input
                        id="search"
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name or segment ID"
                      />
                    </div>
                    <div>
                      <label htmlFor="status">Operational status</label>
                      <select
                        id="status"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All statuses</option>
                        {["unknown", "open", "restricted", "closed"].map(
                          (s) => (
                            <option key={s} value={s}>
                              {words(s)}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>
                  <div
                    className="tw"
                    tabIndex={0}
                    role="region"
                    aria-label="Scrollable operational segment table"
                  >
                    <table>
                      <caption className="sr-only">
                        Loaded corridor segments with separate operational and
                        risk states
                      </caption>
                      <thead>
                        <tr>
                          {[
                            "Band",
                            "Segment",
                            "Direction",
                            "Operational status",
                            "Risk outlook",
                            "Reviewed field evidence",
                          ].map((h) => (
                            <th key={h} scope="col">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((s, i) => (
                          <tr
                            key={s.segment_id}
                            className={
                              s.segment_id === selectedId ? "selected-row" : ""
                            }
                          >
                            <td className="mono">
                              {String(i + 1).padStart(2, "0")}
                            </td>
                            <th scope="row">
                              <button
                                className="text-button"
                                aria-pressed={selectedId === s.segment_id}
                                onClick={() => setSelectedId(s.segment_id)}
                              >
                                {segmentName(s)}
                              </button>
                            </th>
                            <td>{words(s.direction)}</td>
                            <td>
                              <span className={`pill road-${s.operational_status.value}`}>
                                {words(s.operational_status.value)}
                              </span>
                            </td>
                            <td>
                              <span className="pill warning">
                                {words(s.risk.state)}
                              </span>
                            </td>
                            <td>
                              {s.source_health === "reviewed_evidence" ? "Reviewed evidence received" : "Awaiting field report"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!visible.length && (
                    <p className="card-bd">
                      No matching segments. Clear the search or choose all
                      statuses.
                    </p>
                  )}
                  <footer className="table-footer">
                    <span>
                      Unknown status is not confirmation that a road is open.
                    </span>
                    {state.next_cursor && (
                      <button disabled={busy || draftOnly || !connected} onClick={loadMore}>
                        {busy ? "Loading…" : "Load more segments"}
                      </button>
                    )}
                  </footer>
                </section>
                <Card
                  title="Provenance & limitations"
                  subtitle="What this snapshot can support"
                >
                  <div className="provenance">
                    <div>
                      <h3>Source record</h3>
                      <Details
                        value={{
                          graph_version: corridor?.graph_version ?? null,
                          corridor_version_id: state.corridor_version_id,
                          ...state.provenance,
                        }}
                      />
                    </div>
                    <div>
                      <h3>Evidence boundary</h3>
                      <p className="help">
                        External source retrievals are tracked separately. Provider access alone does not establish road passability. Published authority decisions appear in the corridor status.
                      </p>
                      <ul>
                        {state.limitations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
                {!draftOnly && corridor && <Workflows key={corridor.corridor_id + session.user.actor_id} session={session} corridor={corridor} segments={segments} onChange={() => setRefresh(r => r + 1)} workspace={workspace} />}
                {!draftOnly && corridor && <Administration key={"admin-" + corridor.corridor_id + session.user.actor_id} session={session} corridorId={corridor.corridor_id} manageUsers={workspace === "authority"} />}
                {!draftOnly && workspace === "control" && <ModelReadiness />}{!draftOnly && workspace !== "field" && <div id="sources"><SourceHealth owner={session.user.actor_id} /></div>}
              </div>
            )}
          </>

          <footer className="site-footer">
            <span>NER LENS / Corridor intelligence</span>
            <span>Developed by Team NER-LENS.</span>
          </footer>
        </main>
      )}
      {!session && (
        <footer className="login-credit">Developed by Team NER-LENS.</footer>
      )}
    </>
  );
}

