import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiError,
  projectSegments,
  request,
  segmentName,
  type Segment,
} from "./api.ts";
const segment = {
  segment_id: "band-1",
  external_refs: [{ source: "audit", id: "Guwahati–Nagaon" }],
  geometry: {
    type: "LineString",
    coordinates: [
      [91, 26],
      [92, 25],
    ],
  },
} as Segment;
test("route failures explain expiry and provider outage without exposing arbitrary server text", async () => {
  const expired = await ApiError.fromResponse(Response.json({error: {details: [{field: "route", reason: "source_snapshot_expired"}]}}, {status: 409}));
  assert.equal(expired.reason, "source_snapshot_expired");
  assert.match(expired.message, /source has expired.*Compare routes again/);
  const unavailable = await ApiError.fromResponse(Response.json({error: {details: [{field: "route", reason: "upstream_unavailable"}]}}, {status: 502}));
  assert.match(unavailable.message, /No fresh comparison/);
  for (const body of [{error: {message: "private-secret", details: [{field: "route", reason: "private-secret"}]}}, {error: {details: [null]}}]) {
    const error = await ApiError.fromResponse(Response.json(body, {status: 409}));
    assert.equal(error.reason, undefined);
    assert.equal(error.message, new ApiError(409).message);
  }
  const forbidden = await ApiError.fromResponse(Response.json({error: {details: [{field: "route", reason: "source_snapshot_expired"}]}}, {status: 403}));
  assert.equal(forbidden.reason, undefined);
  assert.equal(forbidden.message, new ApiError(403).message);
  assert.equal((await ApiError.fromResponse(new Response("bad gateway", {status: 502}))).message, new ApiError(502).message);
});
test("projection preserves north and east, fits the canvas and tolerates empty/point extents", () => {
  const [line] = projectSegments([segment]);
  assert.ok(line.points[0][0] < line.points[1][0]);
  assert.ok(line.points[0][1] < line.points[1][1]);
  for (const [x, y] of line.points)
    assert.ok(x >= 50 && x <= 650 && y >= 35 && y <= 315);
  assert.deepEqual(projectSegments([]), []);
  assert.ok(
    projectSegments([
      {
        ...segment,
        geometry: {
          type: "LineString",
          coordinates: [
            [91, 26],
            [91, 26],
          ],
        },
      },
    ])[0]
      .points.flat()
      .every(Number.isFinite),
  );
  assert.equal(segmentName(segment), "Guwahati–Nagaon");
  assert.equal(
    segmentName({
      ...segment,
      external_refs: [{ source: "audit", id: "band_1_jalukbari_nagaon" }],
    }),
    "Jalukbari – Nagaon",
  );
});
test("API uses same-origin cookies without readable credentials and handles JSON login/logout", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.credentials, "same-origin");
      assert.equal(options?.headers, undefined);
      assert.equal(options?.cache, "no-store");
      assert.equal(options?.method, "GET");
      return new Response('{"corridors":[]}', { status: 200 });
    };
    assert.deepEqual(await request("/v1/corridors"), { corridors: [] });
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.method, "POST");
      assert.equal(options?.credentials, "same-origin");
      assert.deepEqual(options?.headers, {
        "Content-Type": "application/json",
      });
      assert.equal(options?.body, "{}");
      return new Response(null, { status: 204 });
    };
    assert.equal(await request("/v1/auth/logout", undefined, {}), undefined);
    globalThis.fetch = async () => new Response("{}", { status: 401 });
    await assert.rejects(
      request("/v1/corridors"),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
  } finally {
    globalThis.fetch = original;
  }
});
