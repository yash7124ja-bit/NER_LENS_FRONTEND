import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ReportStore, savePhoto, saveReport, syncPhotos, syncReports, observationSchema, saveOfflineContext, loadOfflineContext, clearOfflineContext } from "./offline.ts";
import { cacheRouteAlerts, cachedRouteAlerts, queueRouteAlertDecision, syncRouteAlertDecisions } from "./alertQueue.ts";
import { cacheDriverMissions, cachedDriverMissions, prepareDriverAccount, queueDriverAction, syncDriverActions } from "./driverQueue.ts";
import type { Session, Catalog, State } from "./api.ts";
const observation = { segment_id: "authorized-segment", observed_at: "2026-09-01T00:00:00Z", geometry: { type: "Point" as const, coordinates: [92, 26] as [number, number] }, accuracy_m: 10, status_claim: "unknown" as const, condition_code: "obstruction", note: "Observed obstruction requiring review" };
const acknowledgement = (body: { client_report_id: string }) => Response.json({ client_report_id: body.client_report_id, field_report_id: `server-${body.client_report_id}`, sync_state: "accepted_for_review" });
test("driver mission actions survive restart and replay in order with the same idempotency keys", async () => {
  const name = crypto.randomUUID();
  let db = new ReportStore(name);
  const snapshot = { mission_id: "mission-1", corridor_id: "corridor-1", driver_actor_id: "alice",
    state: "planned", cargo_class: "medicine", priority: "high",
    delivery_window: { end: new Date(Date.now() + 600000).toISOString() },
    receiving_facility: "Clinic", vehicle_id: "vehicle-1" };
  await cacheDriverMissions("alice", "corridor-1", [snapshot], db);
  await assert.rejects(queueDriverAction("bob", "mission-1", "accept", db));
  await queueDriverAction("alice", "mission-1", "accept", db);
  await queueDriverAction("alice", "mission-1", "start", db);
  await queueDriverAction("alice", "mission-1", "declare-delivery", db);
  const keys = (await cachedDriverMissions("alice", "corridor-1", db))[0].pending.map(item => item.idempotency_key);
  db.close();
  db = new ReportStore(name);
  assert.deepEqual((await cachedDriverMissions("alice", "corridor-1", db))[0].pending.map(item => item.idempotency_key), keys);
  assert.deepEqual(await cachedDriverMissions("bob", "corridor-1", db), []);
  const seen: string[] = [];
  let loseResponse = true;
  const send: typeof fetch = async (url, init) => {
    const action = String(url).split("/").at(-1)!;
    seen.push(`${action}:${new Headers(init?.headers).get("Idempotency-Key")}`);
    if (loseResponse) { loseResponse = false; throw Error("response lost after server commit"); }
    return Response.json({ mission_id: "mission-1", state: { accept: "accepted", start: "active", "declare-delivery": "delivered" }[action], request_id: crypto.randomUUID() });
  };
  await syncDriverActions("alice", "corridor-1", db, send);
  assert.equal((await cachedDriverMissions("alice", "corridor-1", db))[0].pending[0].state, "retry_pending");
  await syncDriverActions("alice", "corridor-1", db, send);
  const saved = (await cachedDriverMissions("alice", "corridor-1", db))[0];
  assert.equal(saved.state, "delivered");
  assert.equal(saved.pending.length, 0);
  assert.deepEqual(seen, [`accept:${keys[0]}`, `accept:${keys[0]}`, `start:${keys[1]}`, `declare-delivery:${keys[2]}`]);
  await db.delete();
});

test("driver action conflicts stop later queued actions and expired trips cannot start", async () => {
  const db = new ReportStore(crypto.randomUUID());
  const snapshot = { mission_id: "mission-2", corridor_id: "corridor-1", driver_actor_id: "alice",
    state: "planned", cargo_class: "medicine", priority: "high",
    delivery_window: { end: new Date(Date.now() + 600000).toISOString() },
    receiving_facility: null, vehicle_id: null };
  await cacheDriverMissions("alice", "corridor-1", [snapshot], db);
  await queueDriverAction("alice", "mission-2", "accept", db);
  await queueDriverAction("alice", "mission-2", "start", db);
  let calls = 0;
  await syncDriverActions("alice", "corridor-1", db, async () => { calls++; return new Response(null, { status: 409 }); });
  assert.equal(calls, 1);
  assert.equal((await cachedDriverMissions("alice", "corridor-1", db))[0].pending[0].state, "conflict");
  await assert.rejects(queueDriverAction("alice", "mission-2", "declare-delivery", db));
  await cacheDriverMissions("alice", "corridor-1", [{ ...snapshot, mission_id: "mission-3", state: "accepted",
    delivery_window: { end: new Date(Date.now() - 1000).toISOString() } }], db);
  await assert.rejects(queueDriverAction("alice", "mission-3", "start", db), /delivery window/);
  await db.delete();
});
test("account switch clears old trip summaries but retains original-owner pending actions", async () => {
  const name = crypto.randomUUID();
  let db = new ReportStore(name);
  const snapshot = { mission_id: "mission-4", corridor_id: "corridor-1", driver_actor_id: "alice",
    state: "planned", cargo_class: "medicine", priority: "high",
    delivery_window: { end: new Date(Date.now() + 600000).toISOString() },
    receiving_facility: "Clinic", vehicle_id: "vehicle-1" };
  await prepareDriverAccount("alice", db);
  await cacheDriverMissions("alice", "corridor-1", [snapshot, { ...snapshot, mission_id: "mission-5" }], db);
  const queued = await queueDriverAction("alice", "mission-4", "accept", db);
  await prepareDriverAccount("bob", db);
  assert.deepEqual(await cachedDriverMissions("alice", "corridor-1", db), []);
  assert.deepEqual(await cachedDriverMissions("bob", "corridor-1", db), []);
  assert.equal(await db.missions.get("alice:mission-5"), undefined);
  const retained = await db.missions.get("alice:mission-4");
  assert.equal(retained?.cargo_class, "");
  assert.equal(retained?.receiving_facility, null);
  assert.equal(retained?.pending[0].idempotency_key, queued.pending[0].idempotency_key);
  db.close();
  db = new ReportStore(name);
  await prepareDriverAccount("alice", db);
  await syncDriverActions("alice", "corridor-1", db, async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), queued.pending[0].idempotency_key);
    return Response.json({ mission_id: "mission-4", state: "accepted", request_id: "receipt-4" });
  });
  await cacheDriverMissions("alice", "corridor-1", [{ ...snapshot, state: "accepted" }], db);
  assert.equal((await cachedDriverMissions("alice", "corridor-1", db))[0].state, "accepted");
  await db.delete();
});
test("route alert decision survives restart, stays with its owner, and retries the same key", async () => {
  const name = crypto.randomUUID();
  let db = new ReportStore(name);
  const alert = { alert_id: crypto.randomUUID(), mission_id: "mission-1", route_id: "route-2",
    message: "Review candidate", reason: "Authority restriction", created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 600000).toISOString(), delivery_state: "delivered_in_app",
    acknowledgment: null };
  await cacheRouteAlerts("alice", [alert], db);
  await assert.rejects(queueRouteAlertDecision("bob", alert.alert_id, "accept", db));
  const queued = await queueRouteAlertDecision("alice", alert.alert_id, "accept", db);
  db.close();
  db = new ReportStore(name);
  assert.equal((await cachedRouteAlerts("alice", db))[0].idempotency_key, queued.idempotency_key);
  assert.deepEqual(await cachedRouteAlerts("bob", db), []);
  let calls = 0;
  const send: typeof fetch = async (_url, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), queued.idempotency_key);
    if (calls === 1) throw Error("Response lost after commit");
    return Response.json({ alert_id: alert.alert_id, decision: "accept", selection_id: "selected-2" });
  };
  await syncRouteAlertDecisions("alice", db, send);
  assert.equal((await cachedRouteAlerts("alice", db))[0].sync_state, "retry_pending");
  await syncRouteAlertDecisions("alice", db, send);
  assert.equal((await cachedRouteAlerts("alice", db))[0].acknowledgment?.selection_id, "selected-2");
  await syncRouteAlertDecisions("alice", db, send);
  assert.equal(calls, 2);
  await db.delete();
});
test("photos bind to local report, survive restart, and retry the same checksum after lost acknowledgement", async () => {
  const name = crypto.randomUUID();
  let db = new ReportStore(name);
  const report = await saveReport("alice", observation, db);
  const other = await saveReport("bob", observation, db);
  await savePhoto("alice", report.client_report_id, 0, new Blob(["photo bytes"], { type: "image/png" }), db);
  await savePhoto("bob", other.client_report_id, 0, new Blob(["other bytes"], { type: "image/png" }), db);
  await assert.rejects(savePhoto("bob", report.client_report_id, 1, new Blob(["wrong owner"], { type: "image/png" }), db));
  db.close();
  db = new ReportStore(name);
  const photo = (await db.media.where("owner").equals("alice").first())!;
  assert.equal(photo.reportId, report.client_report_id);
  assert.equal(photo.blob.size, 11);
  assert.equal(photo.sha256.length, 64);
  let calls = 0;
  await syncPhotos("alice", db, async () => { calls++; throw Error("not canonical yet"); });
  assert.equal(calls, 0);
  await syncReports("alice", db, async (_url, init) => acknowledgement(JSON.parse(String(init?.body))));
  const upload: typeof fetch = async (url, init) => {
    assert.equal(String(url), `/v1/field-reports/server-${report.client_report_id}/media/0`);
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), photo.sha256);
    calls++;
    if (calls === 1) throw Error("ack lost after server commit");
    return Response.json({ field_report_id: `server-${report.client_report_id}`, slot: 0,
      sha256: photo.sha256, upload_state: "received" });
  };
  await syncPhotos("alice", db, upload);
  assert.equal((await db.media.get(photo.key))?.state, "retry_pending");
  await syncPhotos("alice", db, upload);
  assert.equal(await db.media.get(photo.key), undefined);
  assert.equal(calls, 2);
  assert.equal(await db.media.where("owner").equals("bob").count(), 1);
  await db.delete();
});
test("photo upload keeps bytes under the original account through expired login and uncertain response", async () => {
  const db = new ReportStore(crypto.randomUUID());
  const report = await saveReport("alice", observation, db);
  await savePhoto("alice", report.client_report_id, 0, new Blob(["evidence"], { type: "image/png" }), db);
  await syncReports("alice", db, async (_url, init) => acknowledgement(JSON.parse(String(init?.body))));
  await syncPhotos("alice", db, async () => new Response(null, { status: 401 }));
  const queued = (await db.media.where("owner").equals("alice").first())!;
  assert.equal(queued.state, "reauth_required");
  assert.equal(queued.blob.size, 8);
  await syncPhotos("bob", db, async () => { throw Error("cross-account upload"); });
  assert.equal(await db.media.count(), 1);
  await syncPhotos("alice", db, async () => Response.json({ field_report_id: "wrong" }));
  assert.equal((await db.media.get(queued.key))?.state, "retry_pending");
  assert.equal(await db.media.count(), 1);
  await db.delete();
});
test("100 reports survive restart, partial delivery and lost acknowledgements without duplicate logical writes", async () => {
  const name = crypto.randomUUID();
  let db = new ReportStore(name);
  const saved = await Promise.all(Array.from({ length: 100 }, () => saveReport("alice", observation, db)));
  assert.equal(new Set(saved.map(row => row.client_sequence)).size, 100);
  const device = saved[0].device_id;
  db.close();
  db = new ReportStore(name);
  assert.equal(await db.reports.count(), 100);
  assert.equal((await db.reports.toArray())[0].device_id, device);
  const accepted = new Set<string>();
  let calls = 0;
  const transport: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), body.client_report_id);
    accepted.add(body.client_report_id);
    calls++;
    if (calls % 7 === 0) throw new Error("Response lost after server commit");
    return acknowledgement(body);
  };
  await syncReports("alice", db, transport);
  assert.equal(await db.reports.where("state").equals("accepted_for_review").count(), 6);
  assert.equal(await db.reports.count(), 100);
  for (let retry = 0; retry < 30; retry++) await syncReports("alice", db, transport);
  assert.equal(accepted.size, 100);
  assert.equal(await db.reports.where("state").equals("accepted_for_review").count(), 100);
  assert.ok(calls > 100);
  const before = calls;
  await syncReports("alice", db, transport);
  assert.equal(calls, before);
  await db.delete();
});
test("expired authentication preserves original IDs and other accounts; retry resumes only owner queue", async () => {
  const db = new ReportStore(crypto.randomUUID());
  const first = await saveReport("alice", observation, db);
  await saveReport("alice", observation, db);
  await saveReport("bob", observation, db);
  await syncReports("alice", db, async () => new Response(null, { status: 401 }));
  assert.equal((await db.reports.get(first.client_report_id))?.state, "reauth_required");
  assert.equal(await db.reports.count(), 3);
  await syncReports("alice", db, async (_url, init) => acknowledgement(JSON.parse(String(init?.body))));
  assert.equal((await db.reports.get(first.client_report_id))?.state, "accepted_for_review");
  assert.equal((await db.reports.where("owner").equals("bob").first())?.attempts, 0);
  await db.delete();
});
test("conflict and invalid writes remain visible; transient failure pauses remainder", async () => {
  const db = new ReportStore(crypto.randomUUID());
  const rows = [];
  for (let i = 0; i < 4; i++) rows.push(await saveReport("alice", observation, db));
  const responses = [409, 422, 503];
  await syncReports("alice", db, async () => new Response(null, { status: responses.shift()! }));
  assert.deepEqual((await db.reports.orderBy("client_report_id").toArray()).map(row => row.state).sort(), ["conflict", "failed", "retry_pending", "saved_on_device"].sort());
  assert.equal((await db.reports.get(rows[3].client_report_id))?.attempts, 0);
  assert.equal(await db.reports.count(), 4);
  await db.delete();
});
test("invalid server acknowledgements stay retryable and input rejects invalid coordinates and future capture", async () => {
  assert.equal(observationSchema.safeParse({ ...observation, geometry: { type: "Point", coordinates: [181, 0] } }).success, false);
  assert.equal(observationSchema.safeParse({ ...observation, observed_at: "2026-09-01T00:00:00" }).success, false);
  assert.equal(observationSchema.safeParse({ ...observation, observed_at: new Date(Date.now() + 3600000).toISOString() }).success, false);
  const db = new ReportStore(crypto.randomUUID());
  const row = await saveReport("alice", observation, db);
  await syncReports("alice", db, async () => acknowledgement({ client_report_id: "wrong-id" }));
  assert.equal((await db.reports.get(row.client_report_id))?.state, "retry_pending");
  await db.delete();
});
test("offline snapshot retains minimal last-account context; logout clears context without deleting account outboxes", async () => {
  const db = new ReportStore(crypto.randomUUID());
  const alice: Session = { user: { actor_id: "alice", display_name: "Alice", email: "private@example.com", roles: ["field_reporter"], jurisdiction_ids: ["district"] }, expires_at: "2026-12-01T00:00:00Z" };
  const catalog = { corridors: [{ corridor_id: "corridor" }] } as Catalog;
  const state = { corridor_id: "corridor", segments: [] } as unknown as State;
  await saveReport("alice", observation, db);
  await saveOfflineContext(alice, catalog, state, db);
  const restored = await loadOfflineContext(db);
  assert.equal(restored?.profile.actor_id, "alice");
  assert.equal("email" in restored!.profile, false);
  assert.equal("expires_at" in restored!, false);
  const bob = { ...alice, user: { ...alice.user, actor_id: "bob", roles: ["regional_viewer"] } };
  await saveOfflineContext(bob, catalog, state, db);
  assert.equal(await db.contexts.count(), 1);
  assert.equal((await loadOfflineContext(db))?.profile.actor_id, "bob");
  assert.deepEqual((await loadOfflineContext(db))?.profile.roles, ["regional_viewer"]);
  await assert.rejects(saveOfflineContext(bob, catalog, { ...state, corridor_id: "other" }, db));
  await clearOfflineContext(db);
  assert.equal(await loadOfflineContext(db), undefined);
  assert.equal(await db.reports.where("owner").equals("alice").count(), 1);
  assert.equal(await db.reports.where("owner").equals("bob").count(), 0);
  await db.delete();
});
