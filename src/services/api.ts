import type { Session, CachedMission, DriverAction, CachedRouteAlert, FieldReport, PositionPoint, Corridor, ReportSegment, RouteSelection } from '../types';
import { getSettings } from './storage';

type Point = { type: 'Point'; coordinates: [number, number] };
type MissionWire = {
  mission_id: string; corridor_id: string; state: CachedMission['state']; cargo_class: string;
  priority: 'routine' | 'high' | 'emergency'; origin: Point; destination: Point;
  delivery_window: { start: string; end: string }; receiving_facility: string | null;
  receiving_contact?: string; vehicle_id: string | null;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { serverUrl } = await getSettings();
  const response = await fetch(`${serverUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) {
    const reason = response.status === 401 || response.status === 403 ? 'Unauthorized'
      : response.status === 409 ? 'Conflict'
      : response.status === 429 ? 'Rate limited'
      : `Server rejected request (${response.status})`;
    throw new Error(reason);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const point = (coordinates: [number, number]): Point => ({ type: 'Point', coordinates });

export class ApiClient {
  static async login(email: string, password: string): Promise<Session> {
    await request<Session>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    // A protected read proves the device retained the HTTP-only session cookie.
    return request<Session>('/auth/session');
  }

  static session(): Promise<Session> { return request<Session>('/auth/session'); }
  static logout(): Promise<void> { return request<void>('/auth/logout', { method: 'POST' }); }

  static async fetchCorridors(): Promise<Corridor[]> {
    const data = await request<{ corridors: Corridor[] }>('/corridors');
    return data.corridors;
  }

  static async fetchMissions(owner: string, corridorId: string): Promise<CachedMission[]> {
    const data = await request<{ missions: MissionWire[] }>(`/missions?corridor_id=${encodeURIComponent(corridorId)}`);
    return data.missions.map(m => ({
      key: `${owner}:${m.mission_id}`, owner, mission_id: m.mission_id, corridor_id: m.corridor_id,
      from_location: m.origin.coordinates.join(', '), to_location: m.destination.coordinates.join(', '),
      state: m.state, cargo_class: m.cargo_class,
      priority: m.priority === 'emergency' ? 'critical' : m.priority === 'routine' ? 'normal' : 'high',
      delivery_window_start: m.delivery_window.start, delivery_window_end: m.delivery_window.end,
      receiving_facility: m.receiving_facility, receiving_contact: m.receiving_contact,
      vehicle_id: m.vehicle_id, saved_at: new Date().toISOString(), pending: [],
    }));
  }

  static async fetchAssignedMissions(owner: string): Promise<CachedMission[]> {
    const corridors = await this.fetchCorridors();
    const results = await Promise.all(corridors.map(c => this.fetchMissions(owner, c.corridor_version_id)));
    return results.flat();
  }

  static async fetchReportSegments(corridorIds: string[]): Promise<ReportSegment[]> {
    const results = await Promise.all(corridorIds.map(async corridorId => {
      const data = await request<{ segments: Array<{ segment_id: string; external_refs: Array<{ id: string }> }> }>(
        `/corridors/${encodeURIComponent(corridorId)}/state?limit=200`,
      );
      return data.segments.map(s => ({ segment_id: s.segment_id, corridor_id: corridorId,
        label: s.external_refs[0]?.id || s.segment_id }));
    }));
    return results.flat();
  }

  static async fetchRouteSelection(missionId: string): Promise<RouteSelection | null> {
    const data = await request<{ selection: RouteSelection | null }>(
      `/missions/${encodeURIComponent(missionId)}/route-selection`,
    );
    return data.selection;
  }

  static sendDriverAction(missionId: string, action: DriverAction, idempotencyKey: string): Promise<unknown> {
    return request(`/missions/${encodeURIComponent(missionId)}/${action}`, {
      method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: '{}',
    });
  }

  static async fetchAlerts(owner: string): Promise<CachedRouteAlert[]> {
    const data = await request<{ alerts: Array<Omit<CachedRouteAlert, 'owner' | 'candidate_route_id'>> }>('/alerts');
    return data.alerts.map(a => ({ ...a, owner, candidate_route_id: a.route_id }));
  }

  static acknowledgeAlert(alertId: string, decision: 'accept' | 'decline', idempotencyKey: string): Promise<unknown> {
    return request(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ decision }),
    });
  }

  static submitFieldReport(report: FieldReport): Promise<{ field_report_id: string }> {
    const status_claim = report.condition === 'impassable' ? 'blocked' : 'restricted';
    return request('/field-reports', {
      method: 'POST', headers: { 'Idempotency-Key': report.client_report_id },
      body: JSON.stringify({
        client_report_id: report.client_report_id, client_sequence: report.sequence,
        observed_at: report.observed_time, segment_id: report.segment_id,
        geometry: point(report.coordinates), accuracy_m: report.accuracy_m,
        status_claim, condition_code: report.incident_type, note: report.note, device_id: report.device_id,
      }),
    });
  }

  static async uploadReportMedia(reportId: string, clientReportId: string, slot: number, uri: string): Promise<void> {
    const { File } = await import('expo-file-system');
    const { fetch: uploadFetch } = await import('expo/fetch');
    const Crypto = await import('expo-crypto');
    const file = new File(uri);
    const bytes = await file.bytes();
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('Photo is empty or exceeds the 8 MB upload limit');
    const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
      : bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png'
      : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' ? 'image/webp' : null;
    if (!mime) throw new Error('Photo format is not supported by the server');
    const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
    const sha256 = Array.from(new Uint8Array(hash)).map(n => n.toString(16).padStart(2, '0')).join('');
    const { serverUrl } = await getSettings();
    const response = await uploadFetch(`${serverUrl.replace(/\/$/, '')}/field-reports/${encodeURIComponent(reportId)}/media/${slot}`, {
      method: 'PUT', credentials: 'include', body: file,
      headers: { 'Idempotency-Key': `${clientReportId}-${slot}`, 'X-Media-SHA256': sha256,
        'Content-Type': mime, 'Content-Length': String(bytes.length) },
    });
    if (!response.ok) throw new Error(`Photo upload rejected (${response.status})`);
  }

  static async fetchReportMediaState(reportId: string): Promise<string> {
    const data = await request<{ media_state: string }>(`/field-reports/${encodeURIComponent(reportId)}/media`);
    return data.media_state;
  }

  static async sendGpsBatch(missionId: string, deviceId: string, sequenceStart: number, points: PositionPoint[]): Promise<unknown> {
    const receipt = await request<{ accepted: number[]; duplicate: number[]; rejected: number[] }>(
      `/missions/${encodeURIComponent(missionId)}/positions`, {
        method: 'POST', headers: { 'Idempotency-Key': `${deviceId}-${missionId}-${sequenceStart}` },
        body: JSON.stringify({ device_id: deviceId, sequence_start: sequenceStart,
          points: points.map(p => ({ sequence: p.sequence, captured_at: p.captured_at,
            geometry: point(p.coordinates), accuracy_m: p.accuracy_m,
            speed_mps: p.speed_mps, heading_deg: p.heading_deg })) }),
      },
    );
    if (receipt.rejected.length || receipt.accepted.length + receipt.duplicate.length !== points.length) {
      throw new Error('GPS batch needs review: server did not accept every point');
    }
    return receipt;
  }
}
