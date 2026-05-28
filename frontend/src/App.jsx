import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import IngestionView from "./views/IngestionView";
import Login from "./views/Login";

const Dashboard = lazy(() => import("./views/Dashboard"));

function AppLayout() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Suspense
          fallback={
            <section className="panel mx-auto max-w-3xl p-10 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent-600">
                Loading
              </p>
              <h1 className="mt-3 text-2xl font-bold text-slate-950">Preparing the console</h1>
              <p className="mt-3 text-sm text-slate-600">
                Loading the requested workspace and supporting UI modules.
              </p>
            </section>
          }
        >
          <Routes>
            <Route path="/" element={<IngestionView />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
