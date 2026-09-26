const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('server alert refresh removes withdrawn cards but preserves unsent decisions', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/alertCache.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Set });
  const cached = [
    { alert_id: 'withdrawn' },
    { alert_id: 'queued', pending_decision: 'accept' },
    { alert_id: 'still-live', pending_decision: 'decline' },
  ];
  const fetched = [{ alert_id: 'still-live', message: 'fresh' }, { alert_id: 'new' }];
  const merged = module.exports.reconcileAlerts(fetched, cached);
  assert.deepEqual(Array.from(merged, alert => alert.alert_id), ['still-live', 'new', 'queued']);
  assert.equal(merged[0].pending_decision, 'decline');
  assert.equal(merged.find(alert => alert.alert_id === 'queued').pending_decision, 'accept');
});

test('server mission refresh retains an unsent action when an assignment disappears', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/missionCache.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Set });
  const cached = [
    { mission_id: 'withdrawn', pending: [] },
    { mission_id: 'queued', state: 'accepted', pending: [{ action: 'accept' }] },
  ];
  const merged = module.exports.reconcileMissions([], cached);
  assert.deepEqual(Array.from(merged, mission => mission.mission_id), ['queued']);
  assert.equal(merged[0].pending[0].action, 'accept');
});
