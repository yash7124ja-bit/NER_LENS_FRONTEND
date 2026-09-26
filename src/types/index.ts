export type UserRole = 
  | 'driver' 
  | 'field_reporter' 
  | 'district_officer' 
  | 'regional_viewer' 
  | 'system_admin';

export interface User {
  actor_id: string;
  email: string | null;
  display_name: string;
  roles: UserRole[];
  jurisdiction_ids: string[];
}

export interface Session {
  user: User;
  token?: string;
  expires_at: string;
}

export type MissionState = 'planned' | 'accepted' | 'active' | 'delivered' | 'rejected' | 'completed' | 'cancelled';
export type DriverAction = 'accept' | 'reject' | 'start' | 'declare-delivery';

export interface PendingDriverAction {
  action: DriverAction;
  idempotency_key: string;
  state: 'saved_on_device' | 'sending' | 'acknowledged' | 'conflict' | 'reauth_required';
  created_at: string;
  error_message?: string;
}

export interface CachedMission {
  key: string; // `${owner}:${mission_id}`
  owner: string;
  mission_id: string;
  corridor_id: string;
  corridor_name?: string;
  from_location?: string;
  to_location?: string;
  state: MissionState;
  cargo_class: string;
  cargo_weight_tonnes?: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  delivery_window_start?: string;
  delivery_window_end: string;
  receiving_facility: string | null;
  receiving_contact?: string;
  vehicle_id: string | null;
  vehicle_type?: string;
  saved_at: string;
  pending: PendingDriverAction[];
}

export interface PositionPoint {
  sequence: number;
  captured_at: string;
  coordinates: [number, number]; // [lon, lat]
  accuracy_m: number;
  speed_mps?: number;
  heading_deg?: number;
  altitude_m?: number;
}

export interface PositionBatchQueueItem {
  id: string;
  mission_id: string;
  owner: string;
  points: PositionPoint[];
  state: 'saved_on_device' | 'sending' | 'acknowledged' | 'failed';
  created_at: string;
  retry_count: number;
}

export interface CachedRouteAlert {
  alert_id: string;
  mission_id: string;
  owner: string;
  corridor_id?: string;
  message: string;
  reason: string;
  route_id: string;
  candidate_route_id: string;
  severity?: 'low' | 'moderate' | 'high' | 'critical';
  location_name?: string;
  distance_ahead_km?: number;
  expires_at: string;
  delivery_state: string;
  candidate_details?: {
    distance_km: number;
    eta_text: string;
    eta_diff_text: string;
    hazard_avoided: string;
    suitability: string;
  };
  acknowledgment?: {
    decision: 'accept' | 'decline';
    acknowledged_at: string;
    selection_id?: string;
  };
  pending_decision?: 'accept' | 'decline';
  idempotency_key?: string;
  sync_state?: 'saved_on_device' | 'sending' | 'acknowledged' | 'conflict';
}

export type IncidentType = 
  | 'landslide' 
  | 'road_blocked' 
  | 'heavy_rain' 
  | 'accident' 
  | 'bad_road' 
  | 'vehicle_problem' 
  | 'other';

export interface FieldReport {
  client_report_id: string;
  owner: string;
  mission_id?: string;
  sequence: number;
  observed_time: string;
  segment_id: string;
  coordinates: [number, number]; // [lon, lat]
  accuracy_m: number;
  incident_type: IncidentType;
  condition: 'passable_with_caution' | 'single_lane' | 'impassable';
  note: string;
  device_id: string;
  photo_uris: string[];
  photo_hashes?: string[];
  sync_state: 'saved_on_device' | 'sending' | 'acknowledged' | 'failed';
  created_at: string;
}

export interface Corridor {
  corridor_id: string;
  corridor_version_id: string;
  name: string;
  graph_version: string;
  data_mode: string;
}

export interface ReportSegment {
  segment_id: string;
  corridor_id: string;
  label: string;
}

export interface RouteSelection {
  selection_id: string;
  route_id: string;
  selected_at: string;
  expires_at: string;
  status: 'planning_baseline_only' | 'expired_baseline';
  route: null | {
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    segment_ids: string[];
    distance_m: number;
    travel_time_seconds: { p50: number | null; basis: string };
  };
  source: null | { provider: string; retrieved_at: string; vehicle_entitlement: string };
}

export interface Waypoint {
  id: string;
  name: string;
  km_mark: number;
  status: 'passed' | 'current' | 'upcoming';
  hazard?: string;
  is_checkpoint?: boolean;
}

export type LanguageCode = 'en' | 'as';
