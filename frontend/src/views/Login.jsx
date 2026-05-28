import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authError, clearAuthError, isAuthenticated, isAuthBusy, isAuthReady, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (isAuthReady && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const destination = location.state?.from?.pathname || "/dashboard";

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearAuthError();

    const popup = window.open(
      "",
      "analyst-review-console",
      "popup=yes,width=1480,height=960,resizable=yes,scrollbars=yes",
    );

    if (popup) {
      popup.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>Opening Analyst Review Console</title>
            <style>
              body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                font-family: Segoe UI, sans-serif;
                background: #f8fafc;
                color: #0f172a;
              }
              .card {
                border: 1px solid #e2e8f0;
                border-radius: 24px;
                padding: 32px;
                background: white;
                box-shadow: 0 20px 60px -28px rgba(15, 23, 42, 0.22);
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.28em;color:#0f8a5f;text-transform:uppercase;">Auditor Access</p>
              <h1 style="margin:0 0 10px;font-size:28px;">Opening Analyst Review Console</h1>
              <p style="margin:0;color:#475569;">Your secure dashboard will load here after sign-in completes.</p>
            </div>
          </body>
        </html>
      `);
      popup.document.close();
    }

    try {
      await login({ password, username });
      const dashboardUrl = new URL(destination, window.location.origin).toString();

      if (popup && !popup.closed) {
        popup.location.replace(dashboardUrl);
      }

      navigate(destination, { replace: true });
    } catch {
      if (popup && !popup.closed) {
        popup.close();
      }
      // The auth context already captures and exposes the backend error.
    }
  };

  return (
    <section className="mx-auto flex min-h-[72vh] max-w-3xl items-center">
      <div className="panel w-full overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-6 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent-600">
            Auditor Access
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Sign in to review normalized emissions records.
          </h1>
         
        </div>

        <form className="space-y-5 px-6 py-6 sm:px-8 sm:py-8" onSubmit={handleSubmit}>
          <div>
            <label className="field-label" htmlFor="username">
              Username or Email
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              className="field"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="auditor@example.com"
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="field"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {authError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {authError}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="submit" className="primary-button sm:min-w-40" disabled={isAuthBusy}>
              {isAuthBusy ? "Signing in..." : "Sign In"}
            </button>
            <p className="text-sm text-slate-500">
              Opens the protected analyst dashboard in a new window after sign-in.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
