const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function buildApiUrl(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return configuredApiBaseUrl ? `${configuredApiBaseUrl}${normalizedPath}` : normalizedPath;
}

export function readCookie(name) {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
}

export async function ensureCsrfCookie() {
  await fetch(buildApiUrl("/api/auth/csrf/"), {
    credentials: "include",
    method: "GET",
  });

  return readCookie("csrftoken");
}

export async function apiFetch(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  let body = options.body;

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (body && !(body instanceof FormData) && typeof body !== "string") {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(body);
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = readCookie("csrftoken") || (await ensureCsrfCookie());

    if (csrfToken && !headers.has("X-CSRFToken")) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    body,
    credentials: "include",
    headers,
    method,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "string"
        ? !payload.trim()
          ? response.status >= 500
            ? "The Django backend is not reachable. Make sure it is running on port 8000."
            : "The request could not be completed."
          : payload.includes("<!DOCTYPE html>") || payload.includes("<html")
          ? response.status >= 500
            ? "The Django backend returned an internal server error."
            : "The backend returned an unexpected HTML response."
          : payload
        : payload?.detail ||
          payload?.error ||
          payload?.errors?.map((entry) => `Row ${entry.row}: ${entry.error}`).join(" ") ||
          "The request could not be completed.";

    const error = new Error(detail);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
