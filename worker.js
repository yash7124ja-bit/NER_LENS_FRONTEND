function backendURL(env, path) {
  const origin = new URL(env.BACKEND_ORIGIN);
  if (origin.protocol !== "https:" || origin.username || origin.password) {
    throw new Error("Invalid backend configuration");
  }
  return new URL(path, origin.origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/v1/") && !url.pathname.startsWith("/health/")) {
      return env.ASSETS.fetch(request);
    }
    try {
      if (!env.PROXY_SECRET) throw new Error("Proxy is not configured");
      const target = backendURL(env, url.pathname + url.search);
      const headers = new Headers(request.headers);
      for (const name of ["host", "forwarded", "x-forwarded-host", "x-forwarded-for", "x-forwarded-proto"]) {
        headers.delete(name);
      }
      headers.set("X-Ner-Lens-Proxy", env.PROXY_SECRET);
      headers.set("X-Ner-Lens-Client", request.headers.get("CF-Connecting-IP") || "unknown");
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "manual",
        signal: AbortSignal.timeout(25000),
      });
      const result = new Response(response.body, response);
      result.headers.set("Cache-Control", "no-store");
      return result;
    } catch {
      return Response.json({error: {code: "degraded", message: "Backend is starting or unavailable. Please retry.", details: [], retryable: true, request_id: crypto.randomUUID()}}, {status: 503, headers: {"Cache-Control": "no-store"}});
    }
  },
  async scheduled(_event, env) {
    const response = await fetch(backendURL(env, "/health/ready"), {signal: AbortSignal.timeout(30000)});
    if (!response.ok || (await response.json()).status !== "ready") {
      throw new Error("Backend health check failed");
    }
  },
};
