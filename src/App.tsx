import Login from "./Login";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ApiError,
  projectSegments,
  request,
  segmentName,
  type Catalog,
  type State,
  type Session,
} from "./api";
const words = (value: string) => value.replaceAll("_", " ");
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
function SourceHealth() {
  const [data, setData] = useState<{sources: {source: string; status: string; reason: string;
    retrieved_at: string | null; record_count: number}[]; note: string} | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    request<NonNullable<typeof data>>("/health/sources", controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError("Source checks are unavailable. Try again."); });
    return () => controller.abort();
  }, [refresh]);
  return <Card title="External source access" subtitle="Latest provider retrievals">
    <div className="card-bd">
      {error && <p role="alert">{error}</p>}
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
      <button onClick={() => setRefresh(value => value + 1)}>Refresh source checks</button>
    </div>
  </Card>;
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
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

  const pageRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request<Session>("/v1/auth/session", controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSession(data);
      })
      .catch((err) => {
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
    const controller = new AbortController();
    fetch("/health/ready", { signal: controller.signal })
      .then((r) => setReady(r.ok ? "API ready" : "API not ready"))
      .catch(() => {
        if (!controller.signal.aborted) setReady("API unavailable");
      });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () => fail(new ApiError(401)),
      Math.max(0, new Date(session.expires_at).getTime() - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session]);
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
    if (!session) return;
    const controller = new AbortController();
    setCatalog(null);
    setState(null);
    setCorridorId("");
    setSelectedId("");
    setBusy(true);
    setError("");
    request<Catalog>("/v1/corridors", controller.signal)
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
  }, [session, refresh]);
  useEffect(() => {
    pageRequest.current?.abort();
    if (!session || !corridorId) return;
    const controller = new AbortController();
    setBusy(true);
    setState(null);
    setSelectedId("");
    setError("");
    request<State>(
      `/v1/corridors/${encodeURIComponent(corridorId)}/state?limit=200`,
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setState(data);
        setSelectedId(data.segments[0]?.segment_id ?? "");
      })
      .catch(fail)
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [session, corridorId]);
  async function logout() {
    setSigningOut(true);
    setError("");
    try {
      await request("/v1/auth/logout", undefined, {});
      pageRequest.current?.abort();
      setSession(null);
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
  const projected = projectSegments(visible);
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
            <span>Corridor control</span>
          </div>
          <div className="tools">
            <span className="stamp">{ready}</span>
            <button onClick={() => setRefresh((v) => v + 1)} disabled={busy}>
              Refresh
            </button>
            {session && (
              <>
                <span className="user-account">
                  <strong>{session.user.display_name}</strong>
                  <span>{session.user.roles.map(words).join(" · ")}</span>
                </span>
                <button onClick={logout} disabled={signingOut}>
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      {checking ? (
        <main id="main" className="session-check" role="status">
          Checking your session…
        </main>
      ) : !session ? (
        <Login
          message={error}
          onLogin={(data) => {
            setError("");
            setSession(data);
          }}
        />
      ) : (
        <main id="main" className="shell" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">NORTH EAST REGION · EVIDENCE EXPLORER</p>
              <h1>Corridor overview</h1>
              <p>Inspect the evidence behind every segment.</p>
            </div>
            <span className="pill">
              {state?.data_mode ?? catalog?.data_mode ?? "Read-only"}
              {state?.data_mode ? " data" : ""}
            </span>
          </div>
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
                  disabled={busy || !catalog?.corridors.length}
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
              <p className="stamp">
                {state
                  ? `Snapshot ${new Date(state.as_of).toLocaleString()}`
                  : "No snapshot loaded"}
              </p>
            </div>
            <div aria-live="polite" className="sr-only">
              {busy
                ? "Loading corridor data"
                : `${visible.length} segments shown`}
            </div>
            {busy && !state && (
              <div className="skeleton" aria-label="Loading corridor data" />
            )}
            {!busy && !state && !error && (
              <p className="notice">
                No corridor state is available. Select a corridor or refresh
                after the audited data is imported.
              </p>
            )}
            {state && (
              <div className="rows">
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
                <div className="split">
                  <Card
                    title="Geographic overview"
                    subtitle="Synthetic replay bands · not road navigation"
                  >
                    <p className="card-bd replay-note">
                      Hand-authored synthetic geometry, not a surveyed road
                      graph. No current passability is established. Snapshot
                      retrieval time records local import, not a live source
                      observation.
                    </p>
                    <div className="map">
                      <svg
                        viewBox="0 0 700 350"
                        role="img"
                        aria-label="Geographic overview of displayed corridor segments. Use the segment table below to select and inspect each band."
                      >
                        <defs>
                          <pattern
                            id="grid"
                            width="35"
                            height="35"
                            patternUnits="userSpaceOnUse"
                          >
                            <path
                              d="M 35 0 L 0 0 0 35"
                              fill="none"
                              stroke="#e7e7e1"
                              strokeWidth="0.6"
                            />
                          </pattern>
                        </defs>
                        <rect width="700" height="350" fill="url(#grid)" />
                        <text x="24" y="30" className="map-label">
                          N ↑
                        </text>
                        {projected.map((line, index) => (
                          <g key={line.id}>
                            <polyline
                              points={line.points
                                .map((p) => p.join(","))
                                .join(" ")}
                              fill="none"
                              stroke={
                                line.id === selectedId ? "#896020" : "#85857a"
                              }
                              strokeWidth={line.id === selectedId ? 5 : 3}
                              strokeLinecap="round"
                            />
                            {line.points[0] && (
                              <>
                                <circle
                                  cx={line.points[0][0]}
                                  cy={line.points[0][1]}
                                  r="4"
                                  fill="#f7f7f5"
                                  stroke="#54544b"
                                />
                                <text
                                  x={line.points[0][0] + 8}
                                  y={line.points[0][1] - 8}
                                  className="map-label"
                                >
                                  {index + 1}
                                </text>
                              </>
                            )}
                          </g>
                        ))}
                      </svg>
                      {!visible.length && (
                        <p className="map-empty">
                          No segments match your filters.
                        </p>
                      )}
                    </div>
                    <div className="map-footer">
                      <span>
                        <i className="legend-line" /> Synthetic band geometry
                      </span>
                      <span>
                        <i className="legend-line selected" /> Selected band
                      </span>
                      <a href="#segments">Explore in table ↓</a>
                    </div>
                  </Card>
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
                              selected.operational_status.valid_until,
                            evidence_age:
                              selected.evidence_age_seconds === null
                                ? null
                                : `${selected.evidence_age_seconds} seconds`,
                            source_health: selected.source_health,
                            prediction_horizon: `${selected.risk.horizon_seconds / 3600} hours`,
                            probability: selected.risk.probability,
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
                </div>
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
                            "Source health",
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
                              <span className="pill">
                                {words(s.operational_status.value)}
                              </span>
                            </td>
                            <td>
                              <span className="pill warning">
                                {words(s.risk.state)}
                              </span>
                            </td>
                            <td>
                              {s.source_health === "failed"
                                ? "Unavailable"
                                : words(s.source_health)}
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
                      <button disabled={busy} onClick={loadMore}>
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
                        External source retrievals are tracked separately. No
                        reviewed operational evidence is linked to these replay segments.
                      </p>
                      <ul>
                        {state.limitations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
                <SourceHealth />
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
