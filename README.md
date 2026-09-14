# NER LENS web

Read-only corridor evidence explorer for the S-M1 API foundation. The previously empty frontend repository now contains a React + TypeScript/Vite application, styled from `../logistics-network-control.html`.

## Run

Requires Node 22.12+ (validated with Node 24.11), npm and the sibling backend checkout.

1. Follow `../NER_LENS/README.md` to start the API on `127.0.0.1:8000` and bootstrap audited replay geography using `python -m ner_lens.replay`.
2. `npm ci`
3. `npm run dev`
4. Open the displayed local URL and sign in using your administrator-provisioned email and password. Follow the backend README for account provisioning. No account or password is embedded in the frontend.

Vite proxies `/v1` and `/health` to the local API. A future hosted build will need HTTPS
and a same-origin reverse proxy after the backend deployment/identity gate passes.
The current backend accepts loopback hosts and SQLite replay only; public hosting is
not supported by this checkpoint. The Vite preview server only previews the static
build; it is not the API proxy. No credential belongs in a `VITE_*` environment variable.

## Validate

- `npm test` — runnable Node tests for the actual API transport (same-origin cookies, no-store, JSON POST, 204 logout and 401 rejection) and geographic projection, including empty and degenerate extents.
- `npm run build` — strict TypeScript check and production bundle.
- `npm audit` — dependency vulnerability check.

## Integration and scope

Authentication uses `POST /v1/auth/login` with `{email,password}`, `GET /v1/auth/session` to restore a session after reload, and `POST /v1/auth/logout` with `{}` to revoke it. The browser manages the server's HttpOnly cookie; JavaScript never reads or stores a session token. The response provides the database user's display name, roles and expiry. Expiry and 401 responses clear protected content; logout failures remain visible without claiming the server session has ended. Requests time out after 15 seconds and can be retried. The form supports password managers, keyboard input, password visibility, loading and error states.

The screen uses public `GET /health/ready`, authenticated `GET /v1/corridors`, and `GET /v1/corridors/{id}/state?limit=200` with cursor pagination. All displayed counts derive from loaded segments. Search/status filters and selection work across the SVG overview and semantic table. The map uses API LineString coordinates with a local longitude correction and explicitly represents hand-authored synthetic bands, not a surveyed road graph or navigation map. Table buttons provide keyboard selection; the map does not require pointer input.

Unknown operational status, unavailable evidence age, failed source health and risk abstention remain separate and visible. `failed` currently means no operational feed is configured. Both geometry and vehicle restrictions are synthetic fixtures, not verified road observations or legal limits. These limitations are displayed next to the map and constraint details. Provenance retains fixture hash, local import time (not source observation time), graph and policy versions. Replay is labelled throughout. The app does not infer passability from geography, offer routes, generate model scores or create missions.

The implemented scope is the read-only S-M1 integration, not the complete product. Follow the backend milestone plan for evidence ingestion/review, verified routing, missions/GPS, offline report queue/synchronization, and reviewed multilingual alerts. MapLibre, server-state caching, offline storage and service workers should be introduced with those workflows rather than exposing unsupported controls now. npm lockfile is used here because this repository had no pre-existing package manager setup.

Accessibility uses semantic headings, labelled inputs, status/error announcements, visible focus, a skip link, responsive layouts and a table alternative. These structural checks do not establish screen-reader or WCAG conformance; user testing remains required.

## Browser validation — 14 September 2026

Before the email/password change, against the real API through the Vite proxy, Chromium checks confirmed token login,
six-segment loading, selection/details, search/status empty states, logout clearing
data and returning focus to the token field, invalid-session announcements, and
offline refresh clearing stale rows followed by online recovery. Browser local and
session storage remained empty. Desktop 1440px and mobile 390px screenshots showed
no document overflow; the labelled table region remains separately scrollable and
keyboard-focusable. Local screenshots are in ignored `output/playwright/`.

Updated browser validation passed: the provisioned account signs in through Vite, loads six segments, restores after reload, and signs out to the empty form. JavaScript cannot read the HttpOnly cookie; browser local/session storage remain empty. Desktop 1440x1000 and mobile 390x844 login screenshots were inspected. The development proxy explicitly preserves Host so origin protection remains enabled.

## Cloudflare hosted replay

The owner authorized hosting on 14 September 2026. `worker.js` serves the Vite
assets and proxies /v1/* and /health/* to the backend configured by BACKEND_ORIGIN.
Set that binding and PROXY_SECRET using `npx wrangler secret put NAME`; the proxy
secret must match the Render environment. Never put credentials in VITE variables.
Deploy with `npm run deploy`. Workers account email verification is required.

The Worker preserves browser Origin and HttpOnly cookies, overwrites trust headers,
and sends the verified Cloudflare client IP for per-client failure throttling.
The backend also enforces role/district scope; direct API access requires the proxy
secret. A ten-minute Cron Trigger checks backend readiness independently of this PC.
Free-tier quota/expiration limits still apply.

Hosted verification passed on 14 September 2026 at
https://ner-lens.ner-lens-web.workers.dev, backed by
https://ner-lens-api.onrender.com and Render Postgres. Login, six-segment loading,
reload restoration and logout were checked in Chromium. The proxy is configured
with secret bindings and the ten-minute Cron Trigger is installed. JavaScript
cannot read the cookie, and browser local/session storage are empty. The backend
repository's docs/DEPLOYMENT.md records deployment IDs and free-tier limits.
