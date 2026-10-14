
const API_BASE_URL = "http://127.0.0.1:8000";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `OceanMind API error (${response.status}): ${message}`
    );
  }

  return response.json();
}

export const api = {
  health: () => request("/health"),

  databaseStatus: () => request("/database/status"),

  dashboardSummary: () => request("/dashboard/summary"),

  observations: (limit = 100, offset = 0) =>
    request(
      `/database/observations?limit=${limit}&offset=${offset}`
    ),
    mapObservations: (limit = 1000) =>
  request(`/database/map-observations?limit=${limit}`),

  anomalySummary: () => request("/anomalies/summary"),

  anomalies: (limit = 100, offset = 0) =>
    request(`/anomalies/records?limit=${limit}&offset=${offset}`),

  processingHistory: (limit = 50) =>
    request(`/admin/processing-history?limit=${limit}`),
    importDefaultDataset: () =>
    request("/database/import-default-dataset", {
      method: "POST",
    }),
};
