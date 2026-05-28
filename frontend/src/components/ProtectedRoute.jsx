import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return (
      <section className="panel mx-auto max-w-3xl p-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent-600">
          Authenticating
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">Preparing your review console</h1>
        <p className="mt-3 text-sm text-slate-600">
          Validating the HTTP-only session and loading the protected workspace.
        </p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
