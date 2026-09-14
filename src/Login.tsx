import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, request, type Session } from "./api";
export default function Login({
  onLogin,
  message,
}: {
  onLogin: (session: Session) => void;
  message: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const passwordInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailInput.current?.focus();
  }, []);
  useEffect(() => {
    if (error && !busy) passwordInput.current?.focus();
  }, [error, busy]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await request<Session>("/v1/auth/login", undefined, {
        email: email.trim(),
        password,
      });
      setPassword("");
      onLogin(session);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Email or password is incorrect. Please try again."
          : err instanceof ApiError && err.status === 403
            ? "Sign-in was blocked. Refresh this page and try again."
          : err instanceof ApiError && err.status === 429
            ? "Too many sign-in attempts. Please wait before trying again."
          : err instanceof ApiError
            ? err.message
            : "Unable to sign in. Check your connection and try again.",
      );
      setPassword("");
      passwordInput.current?.focus();
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page" id="main" tabIndex={-1}>
      <section className="login-story">
        <p className="eyebrow">NORTH EAST REGION / CORRIDOR INTELLIGENCE</p>
        <h1>
          Evidence for{" "}
          <br />
          the road ahead.
        </h1>
        <p className="login-lead">
          A shared view of corridor conditions, source evidence, and what still
          needs verification.
        </p>
        <div className="login-illustration" aria-hidden="true">
          <svg viewBox="0 0 420 160">
            <path
              d="M10 120L75 120L140 55L220 55L275 105L340 105L405 35"
              fill="none"
              stroke="#c9c7bc"
              strokeWidth="2"
            />
            <path
              d="M140 55L190 125L295 125L340 105"
              fill="none"
              stroke="#dddace"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            {[
              [10, 120],
              [140, 55],
              [220, 55],
              [340, 105],
              [405, 35],
            ].map(([x, y]) => (
              <g key={x}>
                <circle cx={x} cy={y} r="9" fill="#f7f7f5" stroke="#d4d0c3" />
                <circle cx={x} cy={y} r="3" fill="#83704a" />
              </g>
            ))}
          </svg>
          <span>OBSERVE</span>
          <span>VERIFY</span>
          <span>UNDERSTAND</span>
        </div>
        <p className="login-caption">
          Illustrative network · not a navigable route
        </p>
        <div className="login-principle">
          <span className="mono">01 /</span>
          <p>
            <strong>Keep certainty visible.</strong>
            <br />
            Operational status and risk outlook remain separate.
          </p>
        </div>
      </section>
      <section className="login-card card">
        <div className="login-card-heading">
          <span className="eyebrow">AUTHORIZED ACCESS</span>
          <h2>Welcome to NER LENS</h2>
          <p>Sign in with your organization account.</p>
        </div>
        <form onSubmit={submit} className="login-form" aria-busy={busy}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            ref={emailInput}
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              ref={passwordInput}
              id="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={1024}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? "Hide" : "Show"}
            </button>
          </div>
          {(error || message) && (
            <p className="notice error" role="alert">
              {error || message}
            </p>
          )}
          <button className="primary login-submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <span aria-hidden="true">→</span>
          </button>
          <p className="login-help">
            Access is assigned by your administrator. Contact them if you need
            an account or help signing in.
          </p>
        </form>
        <div className="login-card-footer">
          <span className="security-dot" /> Organization-managed access
        </div>
      </section>
    </main>
  );
}
