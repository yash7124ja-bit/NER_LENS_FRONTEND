import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

test("proxy preserves origin/cookie, replaces trust headers, and disables caching", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://backend.example/v1/auth/session");
    assert.equal(options.headers.get("x-ner-lens-proxy"), "test-secret");
    assert.equal(options.headers.get("x-ner-lens-client"), "192.0.2.1");
    assert.equal(options.headers.get("origin"), "https://frontend.example");
    assert.equal(options.headers.get("cookie"), "session=test");
    assert.equal(options.headers.get("x-forwarded-host"), null);
    assert.equal(options.redirect, "manual");
    return new Response("{}", {headers: {"Set-Cookie": "session=new; Secure; HttpOnly"}});
  };
  try {
    const response = await worker.fetch(new Request("https://frontend.example/v1/auth/session", {
      headers: {origin: "https://frontend.example", cookie: "session=test", "x-ner-lens-proxy": "forged", "x-forwarded-host": "forged", "cf-connecting-ip": "192.0.2.1"},
    }), {BACKEND_ORIGIN: "https://backend.example", PROXY_SECRET: "test-secret"});
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    const unavailable = await worker.fetch(new Request("https://frontend.example/v1/auth/session"), {});
    assert.equal(unavailable.status, 503);
  } finally {
    globalThis.fetch = original;
  }
});

test("scheduled check rejects a cold-start HTML page", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({status: "ready"});
    await worker.scheduled({}, {BACKEND_ORIGIN: "https://backend.example"});
    globalThis.fetch = async () => new Response("<html>Loading</html>");
    await assert.rejects(worker.scheduled({}, {BACKEND_ORIGIN: "https://backend.example"}));
  } finally {
    globalThis.fetch = original;
  }
});
