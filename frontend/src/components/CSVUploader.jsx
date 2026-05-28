import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";

import { apiFetch } from "../lib/api";


const initialRequestState = {
  error: "",
  isSubmitting: false,
  result: null,
};

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
        Pipeline accepted the payload and returned a normalized ingestion summary.
      </p>
    </div>
  );
}

function normalizeHeader(header) {
  return String(header || "").trim();
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => resolve(results),
      error: (error) => reject(error),
      header: true,
      skipEmptyLines: true,
    });
  });
}

export default function CSVUploader({ expectedHeaders, uploadUrl }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [mapping, setMapping] = useState({});
  const [parsedRows, setParsedRows] = useState([]);
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [unmappedHeaders, setUnmappedHeaders] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestState, setRequestState] = useState(initialRequestState);

  const expectedHeaderSet = useMemo(
    () => new Set(expectedHeaders.map((header) => normalizeHeader(header))),
    [expectedHeaders],
  );

  const resetResult = () => {
    setRequestState(initialRequestState);
  };

  const uploadCsvBlob = async (csvBlob, filename) => {
    const formData = new FormData();
    formData.append("file", csvBlob, filename);

    const result = await apiFetch(uploadUrl, {
      body: formData,
      method: "POST",
    });

    setRequestState({
      error: "",
      isSubmitting: false,
      result,
    });
  };

  const handleUploadError = (error) => {
    setRequestState({
      error: error.message || "The CSV could not be processed.",
      isSubmitting: false,
      result: null,
    });
  };

  const handleSubmit = async () => {
    if (!file) {
      setRequestState({
        error: "Select a CSV file before submitting the pipeline.",
        isSubmitting: false,
        result: null,
      });
      return;
    }

    setRequestState({
      error: "",
      isSubmitting: true,
      result: null,
    });

    try {
      const results = await parseCsvFile(file);
      const sourceHeaders = results.meta.fields || [];
      const headers = sourceHeaders.map(normalizeHeader).filter(Boolean);
      const unknownHeaders = headers.filter((header) => !expectedHeaderSet.has(header));
      const normalizedRows = results.data.map((row) =>
        sourceHeaders.reduce((nextRow, sourceHeader, index) => {
          const normalizedHeader = headers[index];

          if (normalizedHeader) {
            nextRow[normalizedHeader] = row[sourceHeader];
          }

          return nextRow;
        }, {}),
      );

      if (results.errors?.length) {
        throw new Error(results.errors[0].message || "The CSV could not be parsed.");
      }

      if (!headers.length || !results.data.length) {
        throw new Error("The CSV must include headers and at least one data row.");
      }

      if (unknownHeaders.length) {
        setParsedRows(normalizedRows);
        setParsedHeaders(headers);
        setUnmappedHeaders(unknownHeaders);
        setMapping(
          unknownHeaders.reduce(
            (nextMapping, header) => ({
              ...nextMapping,
              [header]: "",
            }),
            {},
          ),
        );
        setRequestState({
          error: "",
          isSubmitting: false,
          result: null,
        });
        setIsModalOpen(true);
        return;
      }

      await uploadCsvBlob(file, file.name);
    } catch (error) {
      handleUploadError(error);
    }
  };

  const handleConfirmMapping = async () => {
    const selectedTargets = unmappedHeaders.map((header) => mapping[header]).filter(Boolean);
    const existingExpectedHeaders = parsedHeaders.filter(
      (header) => expectedHeaderSet.has(header) && !unmappedHeaders.includes(header),
    );
    const hasMissingTargets = selectedTargets.length !== unmappedHeaders.length;
    const hasDuplicateTargets = new Set(selectedTargets).size !== selectedTargets.length;
    const hasExistingTargetCollision = selectedTargets.some((target) =>
      existingExpectedHeaders.includes(target),
    );

    if (hasMissingTargets) {
      setRequestState({
        error: "Map every unmatched column before uploading.",
        isSubmitting: false,
        result: null,
      });
      return;
    }

    if (hasDuplicateTargets) {
      setRequestState({
        error: "Each unmatched column must map to a different expected header.",
        isSubmitting: false,
        result: null,
      });
      return;
    }

    if (hasExistingTargetCollision) {
      setRequestState({
        error: "Mapped columns cannot overwrite an expected column that already exists in the CSV.",
        isSubmitting: false,
        result: null,
      });
      return;
    }

    setRequestState({
      error: "",
      isSubmitting: true,
      result: null,
    });

    try {
      const transformedRows = parsedRows.map((row) => {
        const transformedRow = {};

        for (const header of parsedHeaders) {
          const targetHeader = mapping[header] || header;
          transformedRow[targetHeader] = row[header];
        }

        return transformedRow;
      });
      const csv = Papa.unparse(transformedRows);
      const mappedFile = new Blob([csv], { type: "text/csv;charset=utf-8" });

      await uploadCsvBlob(mappedFile, `mapped-${file?.name || "upload.csv"}`);
      setIsModalOpen(false);
    } catch (error) {
      handleUploadError(error);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="field-label" htmlFor={`csv-upload-${uploadUrl}`}>
          CSV File
        </label>
        <input
          ref={fileInputRef}
          id={`csv-upload-${uploadUrl}`}
          type="file"
          accept=".csv,text/csv"
          className="field file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            resetResult();
          }}
        />
        <p className="mt-2 text-xs text-slate-500">
          Expected columns: {expectedHeaders.join(", ")}
        </p>
      </div>

      {requestState.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {requestState.error}
        </div>
      ) : null}
      <SubmissionSummary result={requestState.result} />

      <button
        type="button"
        className="primary-button w-full"
        disabled={requestState.isSubmitting}
        onClick={handleSubmit}
      >
        {requestState.isSubmitting ? "Submitting..." : "Submit Pipeline"}
      </button>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-panel">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-600">
                Column Mapping Required
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-950">
                Match source columns to the pipeline schema.
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                These headers are not in the expected whitelist. Map each one before uploading.
              </p>
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
              {unmappedHeaders.map((header) => (
                <div
                  key={header}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1.2fr] sm:items-center"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Source Header
                    </p>
                    <p className="mt-1 font-semibold text-slate-950">{header}</p>
                  </div>
                  <select
                    className="field py-2.5"
                    value={mapping[header] || ""}
                    onChange={(event) =>
                      setMapping((currentMapping) => ({
                        ...currentMapping,
                        [header]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select expected header</option>
                    {expectedHeaders.map((expectedHeader) => (
                      <option key={expectedHeader} value={expectedHeader}>
                        {expectedHeader}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-6 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={requestState.isSubmitting}
                onClick={handleConfirmMapping}
              >
                {requestState.isSubmitting ? "Uploading..." : "Confirm Mapping & Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
