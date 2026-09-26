const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function queue(state, api) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/syncQueue.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const storage = {
    getCachedMissions: async () => state.missions,
    saveCachedMissions: async (_, value) => { state.missions = value; },
    getCachedAlerts: async () => state.alerts,
    saveCachedAlerts: async (_, value) => { state.alerts = value; },
    getFieldReports: async () => state.reports,
    saveFieldReports: async (_, value) => { state.reports = value; },
    getGpsQueue: async () => state.gps,
    saveGpsQueue: async (_, value) => { state.gps = value; },
  };
  vm.runInNewContext(code, {
    module, exports: module.exports, Date, console,
    require(id) {
      if (id === 'expo-crypto') return { randomUUID: () => 'test-uuid' };
      if (id === '@react-native-community/netinfo') return {
        fetch: async () => ({ isConnected: true }), addEventListener: () => () => {},
      };
      if (id === './storage') return storage;
      if (id === './api') return { ApiClient: api };
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return module.exports.SyncQueueManager;
}

test('a failed replay keeps actions, alert decisions, reports and GPS points on device', async () => {
  const state = {
    missions: [{ mission_id: 'm1', state: 'accepted', pending: [{ action: 'accept', idempotency_key: 'a1', state: 'saved_on_device' }] }],
    alerts: [{ alert_id: 'r1', pending_decision: 'accept', idempotency_key: 'r1', sync_state: 'saved_on_device' }],
    reports: [{ client_report_id: 'f1', sync_state: 'saved_on_device' }],
    gps: [{ mission_id: 'm1', owner: 'driver', state: 'saved_on_device', retry_count: 0,
      points: [{ sequence: 1 }] }],
  };
  const fail = async () => { throw new Error('Network unavailable'); };
  const manager = queue(state, { acknowledgeAlert: fail, sendDriverAction: fail,
    submitFieldReport: fail, sendGpsBatch: fail });
  await manager.syncAll('driver');
  assert.equal(state.missions[0].pending.length, 1);
  assert.equal(state.alerts[0].acknowledgment, undefined);
  assert.equal(state.reports[0].sync_state, 'saved_on_device');
  assert.equal(state.gps.length, 1);
  assert.equal(await manager.getPendingCount('driver'), 4);
});
