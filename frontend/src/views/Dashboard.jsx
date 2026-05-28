import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiFetch } from "../lib/api";


const STATUS_OPTIONS = [
  "PENDING_REVIEW",
  "APPROVED",
  "FLAGGED",
  "LOCKED",
];

const STATUS_LABELS = {
  APPROVED: "Approved",
  FLAGGED: "Flagged",
  LOCKED: "Locked",
  PENDING_REVIEW: "Pending Review",
};

const STATUS_STYLES = {
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FLAGGED: "border-amber-200 bg-amber-50 text-amber-700",
  LOCKED: "border-slate-300 bg-slate-100 text-slate-700",
  PENDING_REVIEW: "border-sky-200 bg-sky-50 text-sky-700",
};

const SCOPE_LABELS = {
  SCOPE_1: "Scope 1",
  SCOPE_2: "Scope 2",
  SCOPE_3: "Scope 3",
};

const CHART_COLORS = ["#0f8a5f", "#0f172a", "#94a3b8"];


function formatStatus(status) {
  return STATUS_LABELS[status] || status;
}


function formatNumber(value) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue)
    ? new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(numericValue)
    : value;
}


function formatDateTime(value) {
  if (!value) {
    return "Not reviewed";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}


function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}


function triggerDownload(filename, blob) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}


function StatusBadge({ status }) {
  return (
    <span className={`status-chip ${STATUS_STYLES[status] || STATUS_STYLES.PENDING_REVIEW}`}>
      {formatStatus(status)}
    </span>
  );
}


function rowGroupCellClass(rowIndex, rowCount, position, extraClasses = "") {
  const isFirstRow = rowIndex === 0;
  const isLastRow = rowIndex === rowCount - 1;

  return [
    "border-b border-slate-200 bg-white px-4 py-3 transition group-hover:bg-slate-50/70",
    isFirstRow ? "border-t" : "",
    position === "first" ? "border-l" : "",
    position === "last" ? "border-r" : "",
    isFirstRow && position === "first" ? "rounded-tl-2xl" : "",
    isFirstRow && position === "last" ? "rounded-tr-2xl" : "",
    isLastRow && position === "first" ? "rounded-bl-2xl" : "",
    isLastRow && position === "last" ? "rounded-br-2xl" : "",
    extraClasses,
  ]
    .filter(Boolean)
    .join(" ");
}


export default function Dashboard() {
  const chartRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLockingApprovedRows, setIsLockingApprovedRows] = useState(false);
  const [isAnalyticsVisible, setIsAnalyticsVisible] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isGraphExporting, setIsGraphExporting] = useState(false);
  const [savingRowIds, setSavingRowIds] = useState([]);

  useEffect(() => {
    const loadRecords = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiFetch("/api/emissions/");
        setRecords(Array.isArray(response) ? response : []);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecords();
  }, []);

  const analyticsReady =
    records.length > 0 &&
    records.every((record) => ["APPROVED", "LOCKED"].includes(record.status));

  useEffect(() => {
    if (!analyticsReady && isAnalyticsVisible) {
      setIsAnalyticsVisible(false);
    }
  }, [analyticsReady, isAnalyticsVisible]);

  const chartTotals = {};
  for (const record of records) {
    const scopeKey = record.scope_category || "UNSCOPED";
    const quantity = Number(record.normalized_quantity || 0);
    chartTotals[scopeKey] = (chartTotals[scopeKey] || 0) + (Number.isFinite(quantity) ? quantity : 0);
  }

  const chartData = Object.entries(chartTotals).map(([scope, total], index) => ({
    color: CHART_COLORS[index % CHART_COLORS.length],
    label: SCOPE_LABELS[scope] || scope,
    scope,
    total: Number(total.toFixed(2)),
  }));

  const totalRecords = records.length;
  const pendingCount = records.filter((record) => record.status === "PENDING_REVIEW").length;
  const approvedCount = records.filter((record) => record.status === "APPROVED").length;
  const flaggedCount = records.filter((record) => record.status === "FLAGGED").length;
  const lockedCount = records.filter((record) => record.status === "LOCKED").length;

  const handleStatusChange = async (recordId, nextStatus) => {
    setSavingRowIds((currentIds) => [...currentIds, recordId]);
    setError("");

    try {
      const updatedRecord = await apiFetch(`/api/emissions/${recordId}/status/`, {
        method: "PATCH",
        body: {
          status: nextStatus,
        },
      });

      setRecords((currentRecords) =>
        currentRecords.map((record) => (record.id === recordId ? updatedRecord : record)),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingRowIds((currentIds) => currentIds.filter((currentId) => currentId !== recordId));
    }
  };

  const handleLockApprovedRows = async () => {
    const approvableRows = records.filter((record) => record.status === "APPROVED");
    if (!approvableRows.length) {
      return;
    }

    setIsLockingApprovedRows(true);
    setError("");

    try {
      const updatedRows = await Promise.all(
        approvableRows.map((record) =>
          apiFetch(`/api/emissions/${record.id}/status/`, {
            method: "PATCH",
            body: {
              status: "LOCKED",
            },
          }),
        ),
      );

      const updatedRowMap = new Map(updatedRows.map((record) => [record.id, record]));
      setRecords((currentRecords) =>
        currentRecords.map((record) => updatedRowMap.get(record.id) || record),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLockingApprovedRows(false);
    }
  };

  const handleDownloadCsv = () => {
    const csvRows = [
      [
        "Source",
        "Record ID",
        "Activity Type",
        "Raw Quantity",
        "Raw Unit",
        "Normalized Quantity",
        "Normalized Unit",
        "Scope",
        "Status",
        "Reviewed By",
        "Reviewed At",
        "System Notes",
      ].join(","),
      ...records.map((record) =>
        [
          record.source_system,
          record.raw_record_id,
          record.activity_type,
          record.raw_quantity,
          record.raw_unit,
          record.normalized_quantity,
          record.normalized_unit,
          SCOPE_LABELS[record.scope_category] || record.scope_category,
          formatStatus(record.status),
          record.reviewed_by_display || "",
          record.reviewed_at || "",
          record.system_notes || "",
        ]
          .map(escapeCsvValue)
          .join(","),
      ),
    ];

    triggerDownload(
      `emissions-review-${new Date().toISOString().slice(0, 10)}.csv`,
      new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    setIsDownloadMenuOpen(false);
  };

  const handleDownloadGraph = async () => {
    if (!isAnalyticsVisible || !chartRef.current) {
      return;
    }

    setIsGraphExporting(true);
    setError("");

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const imageDataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imageDataUrl;
      link.download = `emissions-scope-breakdown-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setIsDownloadMenuOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Unable to export the chart right now.");
    } finally {
      setIsGraphExporting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="panel overflow-hidden">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div className="space-y-4">
            <div className="status-chip border-accent-200 bg-accent-50 text-accent-700">
              Analyst Review Console
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Audit, approve, and lock normalized emissions records.
              </h1>
              
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Pending Review",
                value: pendingCount,
                tone: "border-sky-200 bg-sky-50 text-sky-700",
              },
              {
                label: "Approved",
                value: approvedCount,
                tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
              },
              {
                label: "Flagged",
                value: flaggedCount,
                tone: "border-amber-200 bg-amber-50 text-amber-700",
              },
              {
                label: "Locked",
                value: lockedCount,
                tone: "border-slate-300 bg-slate-100 text-slate-700",
              },
            ].map((summary) => (
              <div
                key={summary.label}
                className={`rounded-3xl border px-5 py-4 ${summary.tone}`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em]">{summary.label}</p>
                <p className="mt-3 text-3xl font-bold">{summary.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel overflow-visible">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Review Actions
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {totalRecords} records loaded. Locked rows are immutable and excluded from further
              edits.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              className="secondary-button"
              onClick={handleLockApprovedRows}
              disabled={isLoading || isLockingApprovedRows || !approvedCount}
            >
              {isLockingApprovedRows ? "Locking Approved Rows..." : "Lock Approved Rows"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsAnalyticsVisible((visible) => !visible)}
              disabled={!analyticsReady}
            >
              {isAnalyticsVisible ? "Hide Analytics" : "View Analytics"}
            </button>

            <div className="relative">
              <button
                type="button"
                className="primary-button"
                onClick={() => setIsDownloadMenuOpen((open) => !open)}
              >
                Download
              </button>

              {isDownloadMenuOpen ? (
                <div className="absolute right-0 z-20 mt-3 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-panel">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    onClick={handleDownloadCsv}
                  >
                    <span>Download CSV</span>
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Table</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    onClick={handleDownloadGraph}
                    disabled={!isAnalyticsVisible || isGraphExporting}
                  >
                    <span>{isGraphExporting ? "Exporting Graph..." : "Download Graph"}</span>
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-400">PNG</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {!analyticsReady ? (
          <div className="border-b border-slate-200 bg-amber-50/80 px-6 py-4 text-sm text-amber-900">
            Analytics unlock only after every row is marked <strong>Approved</strong> or{" "}
            <strong>Locked</strong>.
          </div>
        ) : null}

        {error ? (
          <div className="mx-6 mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        {isAnalyticsVisible ? (
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-6">
            <div
              ref={chartRef}
              className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-600">
                  Scope Breakdown
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  Normalized emissions by scope category
                </h2>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value) => [formatNumber(value), "Normalized Quantity"]}
                        contentStyle={{
                          borderColor: "#e2e8f0",
                          borderRadius: 16,
                          boxShadow: "0 20px 50px -28px rgba(15, 23, 42, 0.3)",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="total" name="Normalized Quantity" radius={[14, 14, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell key={entry.scope} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={105}
                        innerRadius={58}
                        paddingAngle={4}
                      >
                        {chartData.map((entry) => (
                          <Cell key={`${entry.scope}-pie`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [formatNumber(value), "Normalized Quantity"]}
                        contentStyle={{
                          borderColor: "#e2e8f0",
                          borderRadius: 16,
                          boxShadow: "0 20px 50px -28px rgba(15, 23, 42, 0.3)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Source</th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Activity Type</th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Raw Data</th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                  Normalized Output
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                    Loading emissions records...
                  </td>
                </tr>
              ) : null}

              {!isLoading && !records.length ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                    No normalized emissions records are available yet.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? records.map((record, index) => {
                    const isLocked = record.status === "LOCKED";
                    const isSaving = savingRowIds.includes(record.id);

                    return (
                      <tr
                        key={record.id}
                        className="group align-top"
                      >
                        <td className={rowGroupCellClass(index, records.length, "first", "w-[19%]")}>
                          <div className="space-y-1.5">
                            <p className="text-sm font-semibold text-slate-900">
                              {record.source_system}
                            </p>
                            <p className="max-w-[13rem] truncate text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                              Record {record.raw_record_id}
                            </p>
                            <StatusBadge status={record.status} />
                          </div>
                        </td>

                        <td className={rowGroupCellClass(index, records.length, "middle", "w-[17%]")}>
                          <div className="space-y-1.5">
                            <p className="font-medium text-slate-900">{record.activity_type}</p>
                            <p className="text-xs text-slate-500">
                              {SCOPE_LABELS[record.scope_category] || record.scope_category}
                            </p>
                            <p className="text-xs text-slate-500">
                              Tenant: {record.tenant_name || "Unknown Tenant"}
                            </p>
                          </div>
                        </td>

                        <td className={rowGroupCellClass(index, records.length, "middle", "w-[27%]")}>
                          <div className="space-y-1.5">
                            <p className="font-medium text-slate-900">
                              {formatNumber(record.raw_quantity)} {record.raw_unit}
                            </p>
                           
                            <p
                              className="max-w-[21rem] text-xs leading-5 text-slate-500"
                              style={{
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 3,
                                display: "-webkit-box",
                                overflow: "hidden",
                              }}
                              title={record.system_notes || "No pipeline warnings."}
                            >
                              {record.system_notes || "No pipeline warnings."}
                            </p>
                          </div>
                        </td>

                        <td className={rowGroupCellClass(index, records.length, "middle", "w-[17%]")}>
                          <div className="space-y-1.5">
                            <p className="font-medium text-slate-900">
                              {formatNumber(record.normalized_quantity)} {record.normalized_unit}
                            </p>
                            <p className="text-xs text-slate-500">
                              Reviewed by: {record.reviewed_by_display || "Unassigned"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDateTime(record.reviewed_at)}
                            </p>
                          </div>
                        </td>

                        <td className={rowGroupCellClass(index, records.length, "last", "w-[20%]")}>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Current State
                            </label>
                            <select
                              className="field min-w-[12rem] py-2.5 text-sm"
                              disabled={isLocked || isSaving || isLockingApprovedRows}
                              value={record.status}
                              onChange={(event) => handleStatusChange(record.id, event.target.value)}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {formatStatus(status)}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-slate-500">
                              {isLocked
                                ? "Locked rows are immutable."
                                : isSaving
                                  ? "Saving status update..."
                                  : "Changes are written immediately to the audit log."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </section>
  );
}
