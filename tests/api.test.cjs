const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function client(fetch) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/api.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    fetch,
    Response,
    Date,
    URLSearchParams,
    require(id) {
      if (id === 'expo-crypto') return { randomUUID: () => 'test-uuid' };
      if (id === './storage') return { getSettings: async () => ({ serverUrl: 'https://api.example/v1' }) };
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return module.exports.ApiClient;
}

test('invalid login never creates a local session', async () => {
  const api = client(async () => new Response('{}', { status: 401 }));
  await assert.rejects(api.login('driver@example.org', 'wrong'));
});

test('login requires a protected session read after the cookie response', async () => {
  const paths = [];
  const api = client(async (url) => {
    paths.push(url);
    return paths.length === 1
      ? new Response(JSON.stringify({ user: { actor_id: 'driver-1' }, expires_at: '2026-09-27T00:00:00Z' }))
      : new Response('{}', { status: 401 });
  });
  await assert.rejects(api.login('driver@example.org', 'password'));
  assert.deepEqual(paths, ['https://api.example/v1/auth/login', 'https://api.example/v1/auth/session']);
});

test('failed mission action stays pending', async () => {
  const api = client(async () => new Response('{}', { status: 503 }));
  await assert.rejects(api.sendDriverAction('mission-1', 'accept', 'retry-key'));
});

test('missing assignments and failed alert acknowledgments never become mock data', async () => {
  const api = client(async (url) => url.endsWith('/corridors')
    ? new Response(JSON.stringify({ corridors: [] })) : new Response('{}', { status: 503 }));
  assert.equal((await api.fetchAssignedMissions('driver-1')).length, 0);
  await assert.rejects(api.acknowledgeAlert('alert-1', 'accept', 'retry-key'));
});

test('field report sends the server contract', async () => {
  let request;
  const api = client(async (_url, options) => {
    request = options;
    return new Response(JSON.stringify({ field_report_id: 'report-1' }), { status: 201 });
  });
  await api.submitFieldReport({
    client_report_id: 'client-1', sequence: 4, observed_time: '2026-09-26T00:00:00Z',
    segment_id: 'segment-1', coordinates: [91, 26], accuracy_m: 10,
    incident_type: 'landslide', condition: 'impassable', note: 'Blocked', device_id: 'device-1',
  });
  const body = JSON.parse(request.body);
  assert.equal(body.client_sequence, 4);
  assert.equal(body.observed_at, '2026-09-26T00:00:00Z');
  assert.deepEqual(body.geometry, { type: 'Point', coordinates: [91, 26] });
  assert.equal(body.status_claim, 'blocked');
  assert.equal(body.condition_code, 'landslide');
});

test('field reporter can load segments from authorized corridors without a driver mission', async () => {
  const paths = [];
  const api = client(async (url) => {
    paths.push(url);
    return new Response(JSON.stringify(url.endsWith('/corridors')
      ? { corridors: [{ corridor_version_id: 'version-1' }] }
      : { segments: [{ segment_id: 'segment-1', external_refs: [{ id: 'Road 1' }] }] }));
  });
  const corridors = await api.fetchCorridors();
  const segments = await api.fetchReportSegments(corridors.map(c => c.corridor_version_id));
  assert.deepEqual(paths, ['https://api.example/v1/corridors', 'https://api.example/v1/corridors/version-1/state?limit=200']);
  assert.equal(segments[0].segment_id, 'segment-1');
});

test('rejected GPS points are not acknowledged', async () => {
  const api = client(async () => new Response(JSON.stringify({ accepted: [], duplicate: [], rejected: [1], flagged: [] }), { status: 201 }));
  await assert.rejects(api.sendGpsBatch('mission-1', 'device-1', 1, [
    { sequence: 1, captured_at: '2026-09-26T00:00:00Z', coordinates: [91, 26], accuracy_m: 10 },
  ]));
});
