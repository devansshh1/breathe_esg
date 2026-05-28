import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { isAuthenticated, isAuthBusy, logout, user } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-extrabold text-white shadow-lg shadow-slate-950/10">
            CE
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-600">
              Carbon Audit
            </p>
            <p className="text-base font-bold text-slate-950 sm:text-lg">
              Emissions Review Console
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="secondary-button">
                Review Dashboard
              </Link>
              <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 sm:block">
                {user?.username || "Auditor"}
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={logout}
                disabled={isAuthBusy}
              >
                {isAuthBusy ? "Signing out..." : "Logout"}
              </button>
            </>
          ) : (
            <Link to="/login" className="secondary-button">
              Auditor Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
