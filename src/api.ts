export type Session = {
  user: {
    actor_id: string;
    email: string | null;
    display_name: string;
    roles: string[];
    jurisdiction_ids: string[];
  };
  expires_at: string;
};
export type Segment = {
  segment_id: string;
  external_refs: { source: string; id: string }[];
  geometry: { type: "LineString"; coordinates: [number, number][] };
  segment_type: string;
  direction: string;
  operational_status: {
    value: string;
    vehicle_scope: string[];
    valid_until: string | null;
  };
  risk: {
    state: string;
    probability: number | null;
    horizon_seconds: number;
    abstention_reason: string | null;
  };
  evidence_age_seconds: number | null;
  source_health: string;
  vehicle_constraints: Record<string, unknown>;
};
export type Corridor = {
  corridor_id: string;
  corridor_version_id: string;
  name: string;
  graph_version: string;
  data_mode: string;
};
export type State = {
  corridor_id: string;
  corridor_version_id: string;
  segments: Segment[];
  as_of: string;
  next_cursor: string | null;
  data_mode: string;
  provenance: Record<string, unknown>;
  limitations: string[];
};
export type Catalog = {
  corridors: Corridor[];
  data_mode: string;
  provenance: Record<string, unknown>;
  limitations: string[];
};
export class ApiError extends Error {
  status: number;
  constructor(status: number) {
    super(
      status === 401
        ? "Your session has expired or been revoked. Please sign in again."
        : status === 403
          ? "This account cannot view corridor data."
          : status === 404
            ? "No audited corridor data is available. Ask your administrator to run the replay bootstrap, then refresh."
            : status === 503
              ? "The service is not ready. Check the database and try again."
              : `Request failed (${status}). Please try again.`,
    );
    this.status = status;
  }
}
export async function request<T>(
  path: string,

  signal?: AbortSignal,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
export function segmentName(segment: Segment): string {
  const name =
    segment.external_refs.find((ref) => ref.source !== "osm")?.id ??
    segment.external_refs[0]?.id ??
    segment.segment_id;
  return /^band_\d+_/.test(name)
    ? name
        .replace(/^band_\d+_/, "")
        .split("_")
        .map((place) => place.charAt(0).toUpperCase() + place.slice(1))
        .join(" – ")
    : name;
}
export function projectSegments(segments: Segment[]) {
  const points = segments.flatMap((segment) => segment.geometry.coordinates);
  if (!points.length) return [];
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const longitudeScale = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const width = (maxX - minX) * longitudeScale,
    height = maxY - minY;
  const scale = Math.min(600 / (width || 1), 280 / (height || 1));
  return segments.map((segment) => ({
    id: segment.segment_id,
    points: segment.geometry.coordinates.map(([x, y]) => [
      50 + (600 - width * scale) / 2 + (x - minX) * longitudeScale * scale,
      35 + (280 - height * scale) / 2 + (maxY - y) * scale,
    ]),
  }));
}
