const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  health: () => request("/health"),
  databaseStatus: () => request("/database/status"),
  dashboardSummary: () => request("/dashboard/summary"),

  observations: (limit = 100, offset = 0) =>
    request(`/database/observations?limit=${limit}&offset=${offset}`),

  mapObservations: (limit = 1000) =>
    request(`/database/map-observations?limit=${limit}`),

  observation: async (id) => {
    const result = await request(
      `/database/observations/${encodeURIComponent(id)}`
    );
    return result.observation;
  },

  anomalySummary: () => request("/anomalies/summary"),

  anomalies: (limit = 100, offset = 0) =>
    request(`/anomalies/records?limit=${limit}&offset=${offset}`),

  processingHistory: (limit = 50) =>
    request(`/admin/processing-history?limit=${limit}`),

  importDefaultDataset: () =>
    request("/database/import-default-dataset", { method: "POST" }),

  visionStatus: () => request("/analysis/status"),

  analyzeImage: async (file) => {
    const form = new FormData();
    form.append("file", file);

    return request("/analysis/image", {
      method: "POST",
      body: form,
    });
  },
};
