import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { useAuth } from "../auth/AuthContext";

type Mode = "login" | "signup";

type LocationState = { from?: { pathname?: string } };

export function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as LocationState | null)?.from?.pathname ?? "/chat";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(trimmedEmail, password);
      } else {
        await signup(trimmedEmail, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Brand to="/" />
        </div>

        <h1 className="auth-title">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="auth-sub">
          {mode === "login"
            ? "Log in to open the Meridian assistant."
            : "Sign up to start asking grounded medical questions."}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "signup" ? "At least 8 characters" : "Your password"
              }
              required
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Please wait…"
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>

        {mode === "signup" && (
          <p className="auth-note">
            New accounts start on the <strong>Explorer</strong> plan — all
            features, free.
          </p>
        )}

        <p className="auth-switch">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("login")}>
                Log in
              </button>
            </>
          )}
        </p>

        <p className="auth-back">
          <Link to="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
