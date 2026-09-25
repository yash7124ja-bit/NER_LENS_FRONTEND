import { alerts, mission, reports, route } from './mockData';

// TODO: API — replace mock with real fetch() call to your backend
export async function loginUser(email, password) {
  return { token: 'demo-token', name: 'Rehan' };
}

// TODO: API — GET /missions/active
export async function getActiveMission(userId) {
  return mission;
}

// TODO: API — GET /routes/:missionId
export async function getRouteDetails(missionId) {
  return route;
}

// TODO: API — GET /risk-alerts?routeId=
export async function getRiskAlerts(routeId) {
  return alerts;
}

// TODO: API — POST /incidents
export async function submitIncidentReport(reportData) {
  return { success: true, queued: true };
}

// TODO: API — GET /reports/queued
export async function getQueuedReports() {
  return reports;
}

// TODO: API — POST /reports/sync
export async function syncReports() {
  return { synced: 3 };
}
