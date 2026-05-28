import { useState } from "react";

import CSVUploader from "../components/CSVUploader";
import { apiFetch } from "../lib/api";

function SubmissionSummary({ result }) {
  if (!result) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
        <span>{result.created_count} created</span>
        <span>{result.flagged_count} flagged</span>
        <span>{result.error_count} errors</span>
      </div>
      <p className="mt-2 text-sm text-emerald-950">
        Pipeline accepted the payload.
      </p>
    </div>
  );
}

export default function IngestionView() {
  const [travelPayload, setTravelPayload] = useState(`[
  {
    "trip_id": "TRIP-1001",
    "travel_mode": "Air",
    "distance": 1580,
    "unit": "miles",
    "travel_date": "2026-05-27",
    "scope": "Scope 3"
  }
]`);
  const [travelState, setTravelState] = useState({
    error: "",
    isSubmitting: false,
    result: null,
  });

  const submitTravelPipeline = async () => {
    setTravelState({
      error: "",
      isSubmitting: true,
      result: null,
    });

    try {
      const parsedPayload = JSON.parse(travelPayload);
      const result = await apiFetch("/api/emissions/upload/travel/", {
        body: parsedPayload,
        method: "POST",
      });

      setTravelState({
        error: "",
        isSubmitting: false,
        result,
      });
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? "Travel payload must be valid JSON before it can be submitted."
          : error.message;

      setTravelState({
        error: message,
        isSubmitting: false,
        result: null,
      });
    }
  };

  return (
    <section className="space-y-8">
      <div className="panel overflow-hidden">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.4fr_0.9fr] lg:px-8">
          <div className="space-y-5">
            <div className="status-chip border-accent-200 bg-accent-50 text-accent-700">
              Prototype Intake Console
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950">
                Push scrambled emissions data into a clean analyst review pipeline.
              </h1>
             
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50/80 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Flow Snapshot
            </p>
            <div className="mt-5 space-y-4">
              {[
                "1. Upload raw files or paste travel JSON.",
                "2. Django parses, normalizes, and flags suspect rows.",
                "3. Analysts review exceptions inside the protected dashboard.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white bg-white px-4 py-4 text-sm font-medium text-slate-700 shadow-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <div className="panel h-full">
            <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent-600">
                SAP Pipeline
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">ERP CSV Intake</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload a raw SAP export with quantity and unit columns..
              </p>
            </div>
            <div className="space-y-5 px-6 py-6">
              <CSVUploader
                expectedHeaders={["Quantity", "Unit", "Material", "Date"]}
                uploadUrl="/api/emissions/upload/sap/"
              />
            </div>
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="panel h-full">
            <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent-600">
                Utility Pipeline
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">Portal Export Intake</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload electricity, gas, or utility portal extracts. This route is designed for
                the uneven CSV formats that usually arrive from vendor dashboards.
              </p>
            </div>
            <div className="space-y-5 px-6 py-6">
              <CSVUploader
                expectedHeaders={["Meter Number", "Start Date", "End Date", "Consumption", "Unit"]}
                uploadUrl="/api/emissions/upload/utility/"
              />
            </div>
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="panel h-full">
            <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent-600">
                Corporate Travel
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">JSON Payload Intake</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Paste a Concur or Navan-style JSON response. 
              </p>
            </div>
            <div className="space-y-5 px-6 py-6">
              <div>
                <label className="field-label" htmlFor="travel-payload">
                  Travel JSON Payload
                </label>
                <textarea
                  id="travel-payload"
                  rows={12}
                  className="field resize-y font-mono text-xs leading-6"
                  value={travelPayload}
                  onChange={(event) => setTravelPayload(event.target.value)}
                />
              </div>

              {travelState.error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {travelState.error}
                </div>
              ) : null}
              <SubmissionSummary result={travelState.result} />
            </div>
            <div className="border-t border-slate-200 bg-white px-6 py-5">
              <button
                type="button"
                className="primary-button w-full"
                disabled={travelState.isSubmitting}
                onClick={submitTravelPipeline}
              >
                {travelState.isSubmitting ? "Submitting..." : "Submit Pipeline"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
