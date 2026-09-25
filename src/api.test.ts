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
