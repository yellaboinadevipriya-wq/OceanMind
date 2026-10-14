
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  HardDrive,
  Layers3,
  LoaderCircle,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Thermometer,
  Upload,
  Waves,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../services/api";

const PAGE_SIZE = 10;

const formatNumber = (value, digits = 0) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-IN", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })
    : "—";
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
};

const getObservations = (result) => {
  if (Array.isArray(result)) return result;
  return (
    result?.observations ||
    result?.records ||
    result?.data ||
    result?.items ||
    []
  );
};

const getTemperature = (row) =>
  Number(
    row?.sea_surface_temperature ??
      row?.sst ??
      row?.temperature ??
      row?.sea_surface_temperature_celsius
  );

const getAnomaly = (row) =>
  Number(
    row?.temperature_anomaly ??
      row?.anom ??
      row?.anomaly ??
      row?.temperature_anomaly_celsius
  );

const getTime = (row) =>
  row?.observation_time ?? row?.time ?? row?.timestamp ?? row?.date;

const getJobRows = (result) => {
  if (Array.isArray(result)) return result;
  return (
    result?.processing_history ||
    result?.history ||
    result?.jobs ||
    result?.records ||
    result?.data ||
    []
  );
};

export default function DataCenter({
  theme = "dark",
  onThemeChange,
}) {
  const [summary, setSummary] = useState(null);
  const [database, setDatabase] = useState(null);
  const [observations, setObservations] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [anomalyFilter, setAnomalyFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("observations");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const results = await Promise.allSettled([
        api.dashboardSummary(),
        api.databaseStatus(),
        api.observations(500, 0),
        api.processingHistory(50),
      ]);

      const labels = [
        "dashboard summary",
        "database status",
        "observations",
        "processing history",
      ];

      const failures = results
        .map((result, index) =>
          result.status === "rejected"
            ? `${labels[index]}: ${result.reason?.message || "Request failed"}`
            : null
        )
        .filter(Boolean);

      if (results[0].status === "fulfilled") {
        setSummary(results[0].value);
      }

      if (results[1].status === "fulfilled") {
        setDatabase(results[1].value);
      }

      if (results[2].status === "fulfilled") {
        setObservations(getObservations(results[2].value));
      }

      if (results[3].status === "fulfilled") {
        setHistory(getJobRows(results[3].value));
      }

      if (failures.length === results.length) {
        throw new Error(failures.join(" | "));
      }

      if (failures.length) {
        setNotice(`Some information could not be loaded: ${failures.join(" | ")}`);
      }
    } catch (err) {
      setError(err?.message || "Unable to load Data Center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleImport = async () => {
    setImporting(true);
    setError("");
    setNotice("");

    try {
      const result = await api.importDefaultDataset();
      setNotice(
        result?.message ||
          result?.detail ||
          "Import request completed. Refreshing database information."
      );
      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "Dataset import failed. Check that the backend is running."
      );
    } finally {
      setImporting(false);
    }
  };

  const validTemperatureRows = useMemo(
    () =>
      observations.filter((row) =>
        Number.isFinite(getTemperature(row))
      ),
    [observations]
  );

  const quality = useMemo(() => {
    const total = observations.length;
    const validSst = observations.filter((row) =>
      Number.isFinite(getTemperature(row))
    ).length;
    const validAnomaly = observations.filter((row) =>
      Number.isFinite(getAnomaly(row))
    ).length;
    const validCoordinates = observations.filter((row) => {
      const lat = Number(row.latitude ?? row.lat);
      const lon = Number(row.longitude ?? row.lon ?? row.long);
      return (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
      );
    }).length;

    const complete = observations.filter((row) => {
      const lat = Number(row.latitude ?? row.lat);
      const lon = Number(row.longitude ?? row.lon ?? row.long);
      return (
        Number.isFinite(getTemperature(row)) &&
        Number.isFinite(getAnomaly(row)) &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Boolean(getTime(row))
      );
    }).length;

    return {
      total,
      validSst,
      validAnomaly,
      validCoordinates,
      complete,
      completeness: total ? (complete / total) * 100 : 0,
    };
  }, [observations]);

  const averageSst = Number(summary?.average_sst_celsius);
  const totalObservations = Number(
    summary?.total_observations ?? database?.observations ?? 0
  );
  const flaggedCount = Number(summary?.anomaly_count ?? 0);

  const distribution = useMemo(() => {
    const bands = [
      { name: "< 0°C", min: -Infinity, max: 0, count: 0 },
      { name: "0–10°C", min: 0, max: 10, count: 0 },
      { name: "10–20°C", min: 10, max: 20, count: 0 },
      { name: "20–25°C", min: 20, max: 25, count: 0 },
      { name: "25–30°C", min: 25, max: 30, count: 0 },
      { name: "30°C+", min: 30, max: Infinity, count: 0 },
    ];

    validTemperatureRows.forEach((row) => {
      const temperature = getTemperature(row);
      const band = bands.find(
        (item) => temperature >= item.min && temperature < item.max
      );
      if (band) band.count += 1;
    });

    return bands;
  }, [validTemperatureRows]);

  const trendData = useMemo(() => {
    const sorted = [...validTemperatureRows].reverse();

    return sorted.map((row, index) => ({
      label: getTime(row)
        ? formatDate(getTime(row))
        : `Sample ${index + 1}`,
      temperature: getTemperature(row),
      anomaly: Number.isFinite(getAnomaly(row))
        ? getAnomaly(row)
        : null,
    }));
  }, [validTemperatureRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return observations.filter((row) => {
      const anomaly = getAnomaly(row);
      const positive = Number.isFinite(anomaly) && anomaly >= 2;
      const negative = Number.isFinite(anomaly) && anomaly <= -2;

      if (anomalyFilter === "positive" && !positive) return false;
      if (anomalyFilter === "negative" && !negative) return false;
      if (anomalyFilter === "flagged" && !positive && !negative) return false;

      if (!query) return true;

      return [
        getTime(row),
        row.latitude,
        row.longitude,
        row.sea_surface_temperature,
        row.sst,
        row.temperature_anomaly,
        row.anom,
      ]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [observations, search, anomalyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const resetFilters = () => {
    setSearch("");
    setAnomalyFilter("all");
    setPage(1);
  };

  const exportCSV = () => {
    if (!filteredRows.length) {
      setNotice("There are no rows to export with the current filters.");
      return;
    }

    const columns = [
      ["observation_time", (row) => getTime(row)],
      ["latitude", (row) => row.latitude ?? row.lat],
      ["longitude", (row) => row.longitude ?? row.lon ?? row.long],
      ["sea_surface_temperature_celsius", getTemperature],
      ["temperature_anomaly_celsius", getAnomaly],
    ];

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
      columns.map(([heading]) => escapeCSV(heading)).join(","),
      ...filteredRows.map((row) =>
        columns.map(([, getter]) => escapeCSV(getter(row))).join(",")
      ),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "oceanmind-observations.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`dc-page ${theme === "light" ? "dc-light" : ""}`}>
      <style>{DATA_CENTER_CSS}</style>

      <header className="dc-topbar">
        <div className="dc-breadcrumb">
          <span className="dc-breadcrumb-muted">OceanMind</span>
          <ChevronRight size={14} />
          <span>Data Center</span>
        </div>

        <div className="dc-top-actions">
          <span className="dc-live">
            <span className="dc-live-dot" />
            Data workspace
          </span>
          <button
            className="dc-icon-button"
           onClick={() =>
  onThemeChange?.(theme === "dark" ? "light" : "dark")
}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            className="dc-icon-button"
            onClick={loadData}
            disabled={loading}
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw size={17} className={loading ? "dc-spinning" : ""} />
          </button>
        </div>
      </header>

      <main className="dc-main">
        <section className="dc-hero">
          <div className="dc-hero-orb dc-orb-one" />
          <div className="dc-hero-orb dc-orb-two" />

          <div className="dc-hero-copy">
            <div className="dc-eyebrow">
              <Database size={14} />
              OCEAN DATA INFRASTRUCTURE
            </div>
            <h1>Data Center<span>.</span></h1>
            <p>
              Manage observations, inspect data quality, and explore the
              temperature patterns behind your ocean intelligence system.
            </p>
            <div className="dc-hero-actions">
              <button
                className="dc-primary-button"
                onClick={handleImport}
                disabled={importing || loading}
              >
                {importing ? (
                  <LoaderCircle size={17} className="dc-spinning" />
                ) : (
                  <Upload size={17} />
                )}
                {importing ? "Importing dataset..." : "Import default dataset"}
              </button>
              <button className="dc-secondary-button" onClick={exportCSV}>
                <Download size={17} />
                Export filtered CSV
              </button>
            </div>
          </div>

          <div className="dc-hero-graphic" aria-hidden="true">
            <div className="dc-graphic-ring dc-ring-one" />
            <div className="dc-graphic-ring dc-ring-two" />
            <div className="dc-graphic-ring dc-ring-three" />
            <div className="dc-graphic-center">
              <Waves size={37} />
            </div>
            <span className="dc-graphic-point dc-point-one" />
            <span className="dc-graphic-point dc-point-two" />
            <span className="dc-graphic-point dc-point-three" />
          </div>
        </section>

        {error && (
          <div className="dc-alert dc-alert-error">
            <AlertCircle size={18} />
            <div>
              <strong>Could not complete the request</strong>
              <p>{error}</p>
              <button onClick={loadData}>Try again</button>
            </div>
          </div>
        )}

        {notice && (
          <div className="dc-alert dc-alert-info">
            <CheckCircle2 size={18} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Dismiss notice">
              ×
            </button>
          </div>
        )}

        <section className="dc-metrics-grid">
          <MetricCard
            icon={<Database size={19} />}
            label="Total observations"
            value={loading ? "…" : formatNumber(totalObservations)}
            detail={`${formatNumber(observations.length)} loaded for this workspace`}
            color="cyan"
          />
          <MetricCard
            icon={<Thermometer size={19} />}
            label="Average sea temperature"
            value={
              Number.isFinite(averageSst)
                ? `${formatNumber(averageSst, 2)}°C`
                : "—"
            }
            detail="Dataset-wide average from API"
            color="blue"
          />
          <MetricCard
            icon={<Activity size={19} />}
            label="Threshold flags"
            value={loading ? "…" : formatNumber(flaggedCount)}
            detail="Absolute anomaly ≥ 2°C"
            color="rose"
          />
          <MetricCard
            icon={<CheckCircle2 size={19} />}
            label="Loaded data completeness"
            value={
              observations.length
                ? `${quality.completeness.toFixed(1)}%`
                : "—"
            }
            detail="Required fields present in loaded rows"
            color="green"
          />
        </section>

        <section className="dc-section-heading">
          <div>
            <div className="dc-eyebrow">OBSERVABILITY</div>
            <h2>Dataset intelligence</h2>
            <p>Visual summaries calculated from the observations currently loaded.</p>
          </div>
          <div className="dc-loaded-badge">
            <span className="dc-live-dot" />
            {loading ? "Updating" : "Workspace status"}
          </div>
        </section>

        <section className="dc-chart-grid">
          <article className="dc-panel dc-chart-panel dc-trend-panel">
            <div className="dc-panel-heading">
              <div>
                <div className="dc-panel-icon"><Activity size={17} /></div>
                <h3>Sea surface temperature</h3>
                <p>Temperature across the loaded observation sample</p>
              </div>
              <span className="dc-chart-unit">°C</span>
            </div>

            <div className="dc-chart-legend">
              <span className="dc-legend-dot cyan" />
              Sea surface temperature
            </div>

            <div className="dc-chart-area">
              {loading ? (
                <ChartSkeleton />
              ) : trendData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trendData}
                    margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="dcSstGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#42d9e8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#42d9e8" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--dc-grid)"
                      strokeDasharray="4 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--dc-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={30}
                      tickFormatter={(value) =>
                        String(value).length > 11
                          ? String(value).slice(0, 10)
                          : value
                      }
                    />
                    <YAxis
                      tick={{ fill: "var(--dc-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}°`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--dc-tooltip)",
                        border: "1px solid var(--dc-border)",
                        borderRadius: 12,
                        color: "var(--dc-text)",
                        fontSize: 12,
                      }}
                      formatter={(value) => [`${formatNumber(value, 2)}°C`, "SST"]}
                      labelFormatter={(label) => `Observation: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="temperature"
                      stroke="#42d9e8"
                      strokeWidth={2}
                      fill="url(#dcSstGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#42d9e8", stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty text="No valid temperature records are available." />
              )}
            </div>
            <div className="dc-chart-footnote">
              <span><Waves size={14} /> {formatNumber(validTemperatureRows.length)} valid temperature samples</span>
              <span>Sample, not full time-series aggregation</span>
            </div>
          </article>

          <article className="dc-panel dc-chart-panel">
            <div className="dc-panel-heading">
              <div>
                <div className="dc-panel-icon blue"><Layers3 size={17} /></div>
                <h3>Temperature distribution</h3>
                <p>Count of loaded records by temperature range</p>
              </div>
            </div>
            <div className="dc-chart-area dc-distribution-chart">
              {loading ? (
                <ChartSkeleton />
              ) : validTemperatureRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={distribution}
                    margin={{ top: 12, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="var(--dc-grid)"
                      strokeDasharray="4 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "var(--dc-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--dc-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--dc-tooltip)",
                        border: "1px solid var(--dc-border)",
                        borderRadius: 12,
                        color: "var(--dc-text)",
                        fontSize: 12,
                      }}
                      formatter={(value) => [formatNumber(value), "Observations"]}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive
                      animationDuration={850}
                    >
                      {distribution.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={["#5798ff", "#668cff", "#42b9e8", "#42d9e8", "#53dfb0", "#ffb86b"][index]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty text="Temperature distribution will appear after data is loaded." />
              )}
            </div>
            <div className="dc-chart-footnote">
              <span><Database size={14} /> Based on loaded records only</span>
            </div>
          </article>
        </section>

        <section className="dc-section-heading dc-table-heading">
          <div>
            <div className="dc-eyebrow">DATA EXPLORER</div>
            <h2>Observation registry</h2>
            <p>Search, filter, inspect, and export the observations retrieved from your API.</p>
          </div>
          <button className="dc-secondary-button" onClick={exportCSV}>
            <Download size={16} />
            Export CSV
          </button>
        </section>

        <section className="dc-panel dc-table-panel">
          <div className="dc-tabs">
            <button
              className={activeTab === "observations" ? "active" : ""}
              onClick={() => setActiveTab("observations")}
            >
              <Database size={15} />
              Observations
              <span>{formatNumber(observations.length)}</span>
            </button>
            <button
              className={activeTab === "history" ? "active" : ""}
              onClick={() => setActiveTab("history")}
            >
              <Clock3 size={15} />
              Processing history
              <span>{formatNumber(history.length)}</span>
            </button>
          </div>

          {activeTab === "observations" ? (
            <>
              <div className="dc-table-toolbar">
                <div className="dc-search">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search time, coordinates, temperature..."
                    aria-label="Search observations"
                  />
                  {search && (
                    <button onClick={() => { setSearch(""); setPage(1); }}>
                      Clear
                    </button>
                  )}
                </div>

                <div className="dc-filter">
                  <Filter size={15} />
                  <select
                    value={anomalyFilter}
                    onChange={(event) => {
                      setAnomalyFilter(event.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter observations"
                  >
                    <option value="all">All observations</option>
                    <option value="flagged">All threshold flags</option>
                    <option value="positive">Positive ≥ +2°C</option>
                    <option value="negative">Negative ≤ −2°C</option>
                  </select>
                </div>

                <button className="dc-icon-button" onClick={resetFilters} title="Reset filters">
                  <RefreshCw size={15} />
                </button>
              </div>

              <div className="dc-table-meta">
                <span>
                  Showing <strong>{formatNumber(pageRows.length)}</strong> of{" "}
                  <strong>{formatNumber(filteredRows.length)}</strong> matching loaded records
                </span>
                <span className="dc-table-note">API sample: up to 500 records</span>
              </div>

              <div className="dc-table-scroll">
                <table className="dc-table">
                  <thead>
                    <tr>
                      <th>Observation time</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Sea temperature</th>
                      <th>Anomaly</th>
                      <th>Classification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="dc-table-state">
                          <LoaderCircle className="dc-spinning" size={19} />
                          Loading observations…
                        </td>
                      </tr>
                    ) : pageRows.length ? (
                      pageRows.map((row, index) => {
                        const anomaly = getAnomaly(row);
                        const positive = Number.isFinite(anomaly) && anomaly >= 2;
                        const negative = Number.isFinite(anomaly) && anomaly <= -2;

                        return (
                          <tr key={`${getTime(row) || "row"}-${index}`}>
                            <td className="dc-time-cell">{formatDate(getTime(row))}</td>
                            <td>{formatNumber(row.latitude ?? row.lat, 3)}</td>
                            <td>{formatNumber(row.longitude ?? row.lon ?? row.long, 3)}</td>
                            <td className="dc-temp-cell">
                              {Number.isFinite(getTemperature(row))
                                ? `${formatNumber(getTemperature(row), 2)}°C`
                                : "—"}
                            </td>
                            <td>
                              <span className={`dc-anomaly-value ${positive ? "positive" : negative ? "negative" : ""}`}>
                                {Number.isFinite(anomaly)
                                  ? `${anomaly > 0 ? "+" : ""}${formatNumber(anomaly, 2)}°C`
                                  : "—"}
                              </span>
                            </td>
                            <td>
                              {positive ? (
                                <span className="dc-status-pill positive">Positive flag</span>
                              ) : negative ? (
                                <span className="dc-status-pill negative">Negative flag</span>
                              ) : Number.isFinite(anomaly) ? (
                                <span className="dc-status-pill normal">Below threshold</span>
                              ) : (
                                <span className="dc-status-pill neutral">Unavailable</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="dc-table-state">
                          <FileSpreadsheet size={23} />
                          <strong>No matching observations</strong>
                          <span>Try another search or reset the filters.</span>
                          <button className="dc-secondary-button" onClick={resetFilters}>
                            Reset filters
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="dc-pagination">
                <span>
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>
                <div>
                  <button
                    className="dc-icon-button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    className="dc-icon-button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="dc-history-content">
              <div className="dc-history-intro">
                <div>
                  <h3>Import and processing activity</h3>
                  <p>Recent jobs returned by the backend processing-history endpoint.</p>
                </div>
                <button className="dc-secondary-button" onClick={loadData} disabled={loading}>
                  <RefreshCw size={15} />
                  Refresh history
                </button>
              </div>

              {loading ? (
                <ChartSkeleton />
              ) : history.length ? (
                <div className="dc-history-list">
                  {history.map((job, index) => (
                    <div className="dc-history-item" key={job.id ?? job.job_id ?? index}>
                      <div className="dc-history-icon">
                        <FileSpreadsheet size={17} />
                      </div>
                      <div className="dc-history-detail">
                        <strong>
                          {job.dataset_name ||
                            job.filename ||
                            job.source ||
                            job.job_type ||
                            job.operation ||
                            "Dataset processing"}
                        </strong>
                        <span>
                          {formatDate(
                            job.started_at ||
                              job.created_at ||
                              job.processed_at ||
                              job.timestamp ||
                              job.created_on
                          )}
                        </span>
                      </div>
                      <div className="dc-history-count">
                        {formatNumber(
                          job.records_imported ??
                            job.imported_records ??
                            job.row_count ??
                            job.records_processed ??
                            job.records ??
                            0
                        )}
                        <span>records</span>
                      </div>
                      <span className="dc-status-pill normal">
                        {job.status || "Recorded"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dc-empty-history">
                  <Clock3 size={25} />
                  <strong>No processing history returned</strong>
                  <span>Import a dataset or refresh to check again.</span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="dc-quality-grid">
          <article className="dc-panel dc-quality-panel">
            <div className="dc-quality-heading">
              <div className="dc-panel-icon green"><CheckCircle2 size={17} /></div>
              <div>
                <h3>Data quality checks</h3>
                <p>Validation results for the currently loaded sample</p>
              </div>
            </div>
            <QualityRow
              label="Valid sea temperatures"
              value={quality.validSst}
              total={quality.total}
            />
            <QualityRow
              label="Valid anomaly values"
              value={quality.validAnomaly}
              total={quality.total}
            />
            <QualityRow
              label="Valid coordinates"
              value={quality.validCoordinates}
              total={quality.total}
            />
            <QualityRow
              label="Complete required fields"
              value={quality.complete}
              total={quality.total}
            />
            <div className="dc-quality-note">
              <AlertCircle size={14} />
              Quality metrics describe the loaded sample, not all database records.
            </div>
          </article>

          <article className="dc-panel dc-storage-panel">
            <div className="dc-quality-heading">
              <div className="dc-panel-icon blue"><HardDrive size={17} /></div>
              <div>
                <h3>Database status</h3>
                <p>Connection information from your backend</p>
              </div>
            </div>
            <div className="dc-storage-status">
              <span className="dc-storage-pulse" />
              <div>
                <strong>{database?.status || (loading ? "Checking…" : "Unknown")}</strong>
                <span>Database connection</span>
              </div>
            </div>
            <div className="dc-storage-row">
              <span>Database file</span>
              <strong>{database?.database || "Not reported"}</strong>
            </div>
            <div className="dc-storage-row">
              <span>Database observations</span>
              <strong>{formatNumber(database?.observations ?? totalObservations)}</strong>
            </div>
            <div className="dc-storage-row">
              <span>Processing jobs</span>
              <strong>
                {formatNumber(
                  summary?.processing_jobs ??
                    database?.processing_jobs ??
                    database?.processing_jobs_count
                )}
              </strong>
            </div>
            <div className="dc-storage-footer">
              <Clock3 size={14} />
              Use refresh to request the latest backend status.
            </div>
          </article>
        </section>

        <footer className="dc-footer">
          <div className="dc-footer-brand">
            <Waves size={17} />
            <strong>OceanMind</strong>
            <span>Data Intelligence Platform</span>
          </div>
          <span>Visualizations reflect API responses and loaded records.</span>
        </footer>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, color }) {
  return (
    <article className="dc-metric-card">
      <div className={`dc-metric-icon ${color}`}>{icon}</div>
      <span className="dc-metric-label">{label}</span>
      <strong className="dc-metric-value">{value}</strong>
      <span className="dc-metric-detail">{detail}</span>
      <div className={`dc-metric-accent ${color}`} />
    </article>
  );
}

function QualityRow({ label, value, total }) {
  const percentage = total ? Math.min(100, (value / total) * 100) : 0;

  return (
    <div className="dc-quality-row">
      <div className="dc-quality-row-top">
        <span>{label}</span>
        <strong>
          {formatNumber(value)} <small>/ {formatNumber(total)}</small>
        </strong>
      </div>
      <div className="dc-quality-track">
        <div style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="dc-chart-skeleton">
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
    </div>
  );
}

function ChartEmpty({ text }) {
  return (
    <div className="dc-chart-empty">
      <Database size={24} />
      <span>{text}</span>
    </div>
  );
}

const DATA_CENTER_CSS = `
.dc-page {
  --dc-bg: #07111f;
  --dc-panel: #0d1a2b;
  --dc-panel-raised: #102138;
  --dc-border: #20344b;
  --dc-text: #e8f1fb;
  --dc-muted: #8da2bb;
  --dc-grid: rgba(141, 162, 187, .15);
  --dc-tooltip: #102138;
  --dc-cyan: #42d9e8;
  --dc-blue: #5798ff;
  --dc-green: #53dfb0;
  --dc-red: #ff6b81;
  min-height: 100%;
  color: var(--dc-text);
  background: var(--dc-bg);
  border-radius: 18px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  animation: dcFadeIn .45s ease both;
  overflow: hidden;
}
.dc-page * { box-sizing: border-box; }
.dc-light {
  --dc-bg: #f2f6fb;
  --dc-panel: #ffffff;
  --dc-panel-raised: #f6f9fd;
  --dc-border: #dce6f1;
  --dc-text: #14243a;
  --dc-muted: #61758d;
  --dc-grid: rgba(72, 97, 126, .14);
  --dc-tooltip: #ffffff;
}
.dc-page button, .dc-page input, .dc-page select { font: inherit; }
.dc-page button { cursor: pointer; }
.dc-page button:disabled { opacity: .48; cursor: not-allowed; }
.dc-topbar {
  display: flex; justify-content: space-between; align-items: center;
  gap: 16px; padding: 18px 28px;
  border-bottom: 1px solid var(--dc-border);
  background: var(--dc-panel);
}
.dc-breadcrumb, .dc-top-actions { display: flex; align-items: center; gap: 12px; }
.dc-breadcrumb { font-size: 12px; font-weight: 650; }
.dc-breadcrumb-muted { color: var(--dc-muted); font-weight: 500; }
.dc-top-actions { gap: 10px; }
.dc-live, .dc-loaded-badge {
  display: inline-flex; align-items: center; gap: 8px;
  color: var(--dc-muted); font-size: 11px; font-weight: 650;
}
.dc-live-dot, .dc-storage-pulse {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--dc-green); box-shadow: 0 0 12px rgba(83,223,176,.45);
  animation: dcPulse 2.2s infinite;
}
.dc-icon-button {
  width: 36px; height: 36px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dc-border); color: var(--dc-muted);
  background: var(--dc-panel-raised); transition: all .2s ease;
}
.dc-icon-button:hover:not(:disabled) {
  color: var(--dc-cyan); border-color: var(--dc-cyan);
  transform: translateY(-1px);
}
.dc-main { padding: 26px 28px 22px; max-width: 1800px; margin: 0 auto; }
.dc-hero {
  min-height: 248px; position: relative; overflow: hidden;
  display: flex; justify-content: space-between; align-items: center;
  gap: 20px; padding: 32px 36px; border-radius: 20px;
  border: 1px solid rgba(66,217,232,.21);
  background: linear-gradient(118deg, #102a42 0%, #0b1c31 54%, #112947 100%);
  box-shadow: 0 16px 42px rgba(0,0,0,.12);
}
.dc-light .dc-hero {
  background: linear-gradient(118deg, #e1f7fb 0%, #e9f1ff 60%, #f0eaff 100%);
  border-color: #c8e7ef;
}
.dc-hero-copy { position: relative; z-index: 2; max-width: 690px; }
.dc-eyebrow {
  display: flex; align-items: center; gap: 8px;
  color: var(--dc-cyan); font-size: 10px; letter-spacing: 1.8px;
  font-weight: 800; margin-bottom: 13px;
}
.dc-hero h1 {
  font-size: clamp(29px, 3vw, 43px); letter-spacing: -1.6px;
  line-height: 1.12; margin: 0; font-weight: 800;
}
.dc-hero h1 span { color: var(--dc-cyan); }
.dc-hero p {
  max-width: 600px; margin: 14px 0 20px;
  color: var(--dc-muted); font-size: 13px; line-height: 1.8;
}
.dc-hero-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.dc-primary-button, .dc-secondary-button {
  min-height: 39px; display: inline-flex; align-items: center;
  justify-content: center; gap: 9px; border-radius: 10px;
  padding: 0 14px; font-size: 11px !important; font-weight: 750 !important;
  transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
}
.dc-primary-button {
  border: 1px solid #42d9e8; background: #42d9e8; color: #06202b;
}
.dc-primary-button:hover:not(:disabled) {
  transform: translateY(-2px); box-shadow: 0 7px 22px rgba(66,217,232,.2);
}
.dc-secondary-button {
  border: 1px solid var(--dc-border); color: var(--dc-text);
  background: var(--dc-panel-raised);
}
.dc-secondary-button:hover:not(:disabled) {
  border-color: var(--dc-cyan); transform: translateY(-1px);
}
.dc-hero-graphic {
  position: relative; flex: 0 0 210px; width: 210px; height: 190px;
  display: grid; place-items: center; margin-right: 24px;
}
.dc-graphic-ring {
  position: absolute; border-radius: 50%; border: 1px solid rgba(66,217,232,.24);
  animation: dcOrbit 18s linear infinite;
}
.dc-ring-one { width: 174px; height: 174px; }
.dc-ring-two { width: 135px; height: 135px; border-style: dashed; animation-direction: reverse; animation-duration: 24s; }
.dc-ring-three { width: 95px; height: 95px; border-color: rgba(87,152,255,.5); }
.dc-graphic-center {
  width: 68px; height: 68px; display: grid; place-items: center;
  border: 1px solid rgba(66,217,232,.5); border-radius: 22px;
  color: var(--dc-cyan); background: rgba(66,217,232,.1);
  box-shadow: 0 0 35px rgba(66,217,232,.13);
}
.dc-graphic-point { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: var(--dc-cyan); box-shadow: 0 0 15px var(--dc-cyan); }
.dc-point-one { top: 14px; left: 104px; }
.dc-point-two { right: 8px; bottom: 57px; background: #5798ff; box-shadow: 0 0 15px #5798ff; }
.dc-point-three { left: 29px; bottom: 36px; background: #53dfb0; box-shadow: 0 0 15px #53dfb0; }
.dc-hero-orb { position: absolute; border-radius: 50%; filter: blur(1px); pointer-events: none; }
.dc-orb-one { width: 280px; height: 280px; right: -70px; top: -180px; background: radial-gradient(circle, rgba(66,217,232,.13), transparent 70%); }
.dc-orb-two { width: 260px; height: 260px; right: 120px; bottom: -220px; background: radial-gradient(circle, rgba(87,152,255,.12), transparent 70%); }
.dc-metrics-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 14px; margin: 20px 0 30px; }
.dc-metric-card {
  position: relative; min-width: 0; overflow: hidden; padding: 19px;
  border: 1px solid var(--dc-border); border-radius: 15px;
  background: var(--dc-panel); display: flex; flex-direction: column; gap: 10px;
  transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease;
  animation: dcSlideUp .5s ease both;
}
.dc-metric-card:nth-child(2) { animation-delay: .06s; }
.dc-metric-card:nth-child(3) { animation-delay: .12s; }
.dc-metric-card:nth-child(4) { animation-delay: .18s; }
.dc-metric-card:hover { transform: translateY(-3px); border-color: rgba(66,217,232,.48); box-shadow: 0 12px 28px rgba(0,0,0,.08); }
.dc-metric-icon, .dc-panel-icon {
  width: 37px; height: 37px; border-radius: 11px; display: grid; place-items: center;
  color: var(--dc-cyan); background: rgba(66,217,232,.1);
}
.dc-metric-icon.blue, .dc-panel-icon.blue { color: #78a9ff; background: rgba(87,152,255,.12); }
.dc-metric-icon.rose { color: #ff8295; background: rgba(255,107,129,.11); }
.dc-metric-icon.green, .dc-panel-icon.green { color: var(--dc-green); background: rgba(83,223,176,.1); }
.dc-metric-label { color: var(--dc-muted); font-size: 11px; font-weight: 650; }
.dc-metric-value { font-size: clamp(22px,2vw,29px); letter-spacing: -.7px; line-height: 1.15; font-weight: 800; overflow-wrap: anywhere; }
.dc-metric-detail { color: var(--dc-muted); font-size: 10px; line-height: 1.5; }
.dc-metric-accent { position: absolute; right: -20px; top: -25px; width: 80px; height: 80px; border-radius: 50%; background: rgba(66,217,232,.045); }
.dc-metric-accent.blue { background: rgba(87,152,255,.06); }
.dc-metric-accent.rose { background: rgba(255,107,129,.05); }
.dc-metric-accent.green { background: rgba(83,223,176,.05); }
.dc-section-heading { display: flex; justify-content: space-between; align-items: end; gap: 16px; margin: 26px 0 15px; }
.dc-section-heading .dc-eyebrow { margin-bottom: 7px; }
.dc-section-heading h2 { font-size: 20px; letter-spacing: -.55px; margin: 0; font-weight: 800; }
.dc-section-heading p { margin: 7px 0 0; color: var(--dc-muted); font-size: 11px; line-height: 1.65; }
.dc-loaded-badge { padding: 8px 11px; border: 1px solid var(--dc-border); border-radius: 9px; white-space: nowrap; }
.dc-chart-grid { display: grid; grid-template-columns: minmax(0,1.45fr) minmax(0,1fr); gap: 15px; }
.dc-panel { min-width: 0; border: 1px solid var(--dc-border); border-radius: 15px; background: var(--dc-panel); }
.dc-chart-panel { padding: 20px; animation: dcSlideUp .55s ease both; }
.dc-panel-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.dc-panel-heading > div:first-child { position: relative; padding-left: 47px; min-height: 37px; }
.dc-panel-icon { position: absolute; left: 0; top: 0; width: 35px; height: 35px; }
.dc-panel-heading h3, .dc-quality-heading h3 { margin: 1px 0 5px; font-size: 13px; font-weight: 800; }
.dc-panel-heading p, .dc-quality-heading p { margin: 0; color: var(--dc-muted); font-size: 10px; line-height: 1.55; }
.dc-chart-unit { color: var(--dc-muted); font-size: 11px; }
.dc-chart-legend { display: flex; align-items: center; gap: 8px; margin: 20px 0 0 2px; color: var(--dc-muted); font-size: 10px; }
.dc-legend-dot { width: 7px; height: 7px; border-radius: 50%; }
.dc-legend-dot.cyan { background: var(--dc-cyan); box-shadow: 0 0 8px rgba(66,217,232,.4); }
.dc-chart-area { width: 100%; height: 240px; margin-top: 10px; }
.dc-distribution-chart { height: 276px; margin-top: 22px; }
.dc-chart-footnote { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding-top: 12px; margin-top: 8px; border-top: 1px solid var(--dc-border); color: var(--dc-muted); font-size: 9px; }
.dc-chart-footnote span { display: inline-flex; align-items: center; gap: 6px; }
.dc-chart-skeleton { height: 100%; display: flex; align-items: end; gap: 10px; padding: 15px 12px; }
.dc-chart-skeleton div { flex: 1; height: 35%; border-radius: 7px 7px 0 0; background: linear-gradient(180deg, rgba(66,217,232,.16), rgba(66,217,232,.025)); animation: dcSkeleton 1.2s ease-in-out infinite alternate; }
.dc-chart-skeleton div:nth-child(2) { height: 63%; animation-delay: .1s; }
.dc-chart-skeleton div:nth-child(3) { height: 48%; animation-delay: .2s; }
.dc-chart-skeleton div:nth-child(4) { height: 82%; animation-delay: .3s; }
.dc-chart-skeleton div:nth-child(5) { height: 58%; animation-delay: .4s; }
.dc-chart-skeleton div:nth-child(6) { height: 70%; animation-delay: .5s; }
.dc-chart-empty { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; color: var(--dc-muted); font-size: 11px; text-align: center; padding: 25px; }
.dc-table-heading { margin-top: 34px; }
.dc-table-panel { overflow: hidden; }
.dc-tabs { display: flex; gap: 23px; padding: 0 20px; border-bottom: 1px solid var(--dc-border); }
.dc-tabs button { display: flex; align-items: center; gap: 8px; position: relative; padding: 17px 0; border: 0; background: none; color: var(--dc-muted); font-size: 11px; font-weight: 700; }
.dc-tabs button.active { color: var(--dc-cyan); }
.dc-tabs button.active::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; border-radius: 3px; background: var(--dc-cyan); }
.dc-tabs button span { border-radius: 6px; background: var(--dc-panel-raised); padding: 3px 6px; font-size: 9px; }
.dc-table-toolbar { display: flex; align-items: center; gap: 10px; padding: 17px 20px 13px; }
.dc-search { flex: 1; min-width: 150px; display: flex; align-items: center; gap: 9px; height: 38px; padding: 0 11px; border: 1px solid var(--dc-border); border-radius: 9px; color: var(--dc-muted); background: var(--dc-panel-raised); }
.dc-search:focus-within { border-color: var(--dc-cyan); box-shadow: 0 0 0 3px rgba(66,217,232,.07); }
.dc-search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--dc-text); font-size: 10px; }
.dc-search input::placeholder { color: var(--dc-muted); }
.dc-search button { border: 0; color: var(--dc-cyan); background: none; font-size: 10px; }
.dc-filter { display: flex; align-items: center; gap: 7px; padding: 0 9px; height: 38px; border: 1px solid var(--dc-border); border-radius: 9px; color: var(--dc-muted); background: var(--dc-panel-raised); }
.dc-filter select { max-width: 175px; border: 0; outline: 0; background: transparent; color: var(--dc-text); font-size: 10px; }
.dc-filter option { background: var(--dc-panel); color: var(--dc-text); }
.dc-table-meta { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 0 20px 13px; color: var(--dc-muted); font-size: 10px; }
.dc-table-meta strong { color: var(--dc-text); }
.dc-table-scroll { width: 100%; overflow-x: auto; }
.dc-table { width: 100%; border-collapse: collapse; text-align: left; white-space: nowrap; }
.dc-table thead { background: var(--dc-panel-raised); }
.dc-table th { padding: 13px 16px; color: var(--dc-muted); font-size: 9px; font-weight: 750; text-transform: uppercase; letter-spacing: .6px; border-top: 1px solid var(--dc-border); border-bottom: 1px solid var(--dc-border); }
.dc-table td { padding: 14px 16px; color: var(--dc-text); font-size: 10px; border-bottom: 1px solid var(--dc-border); }
.dc-table tbody tr { transition: background .2s ease; animation: dcFadeIn .35s ease both; }
.dc-table tbody tr:hover { background: rgba(66,217,232,.035); }
.dc-table tbody tr:last-child td { border-bottom: 0; }
.dc-time-cell { color: var(--dc-muted) !important; }
.dc-temp-cell { font-weight: 750; }
.dc-anomaly-value { font-weight: 750; color: var(--dc-muted); }
.dc-anomaly-value.positive { color: #ff8295; }
.dc-anomaly-value.negative { color: #78a9ff; }
.dc-status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 6px; font-size: 9px; font-weight: 750; border: 1px solid transparent; }
.dc-status-pill.positive { color: #ff8798; background: rgba(255,107,129,.09); border-color: rgba(255,107,129,.2); }
.dc-status-pill.negative { color: #8ab8ff; background: rgba(87,152,255,.1); border-color: rgba(87,152,255,.22); }
.dc-status-pill.normal { color: var(--dc-green); background: rgba(83,223,176,.08); border-color: rgba(83,223,176,.2); }
.dc-status-pill.neutral { color: var(--dc-muted); background: var(--dc-panel-raised); border-color: var(--dc-border); }
.dc-table-state { height: 180px; text-align: center !important; color: var(--dc-muted) !important; }
.dc-table-state svg { vertical-align: middle; margin-right: 8px; }
.dc-table-state strong, .dc-table-state span { display: block; margin: 8px 0; }
.dc-table-state .dc-secondary-button { margin-top: 8px; }
.dc-pagination { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 20px; border-top: 1px solid var(--dc-border); color: var(--dc-muted); font-size: 10px; }
.dc-pagination > div { display: flex; gap: 7px; }
.dc-pagination strong { color: var(--dc-text); }
.dc-history-content { padding: 20px; }
.dc-history-intro { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; }
.dc-history-intro h3 { margin: 0 0 6px; font-size: 13px; }
.dc-history-intro p { margin: 0; color: var(--dc-muted); font-size: 10px; line-height: 1.6; }
.dc-history-list { display: flex; flex-direction: column; }
.dc-history-item { display: flex; align-items: center; gap: 13px; padding: 14px 0; border-bottom: 1px solid var(--dc-border); }
.dc-history-item:last-child { border-bottom: 0; }
.dc-history-icon { width: 36px; height: 36px; flex: 0 0 36px; display: grid; place-items: center; border: 1px solid var(--dc-border); border-radius: 10px; color: var(--dc-cyan); background: var(--dc-panel-raised); }
.dc-history-detail { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.dc-history-detail strong { font-size: 11px; overflow-wrap: anywhere; }
.dc-history-detail span, .dc-history-count span { color: var(--dc-muted); font-size: 9px; }
.dc-history-count { text-align: right; font-size: 11px; font-weight: 750; }
.dc-history-count span { display: block; margin-top: 3px; font-weight: 500; }
.dc-empty-history { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 45px 15px; color: var(--dc-muted); text-align: center; font-size: 11px; }
.dc-empty-history strong { color: var(--dc-text); }
.dc-quality-grid { display: grid; grid-template-columns: minmax(0,1.15fr) minmax(0,1fr); gap: 15px; margin-top: 17px; }
.dc-quality-panel, .dc-storage-panel { padding: 21px; }
.dc-quality-heading { position: relative; min-height: 37px; padding-left: 47px; margin-bottom: 22px; }
.dc-quality-heading .dc-panel-icon { left: 0; top: 0; }
.dc-quality-row { margin-bottom: 17px; }
.dc-quality-row-top { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; color: var(--dc-muted); font-size: 10px; }
.dc-quality-row-top strong { color: var(--dc-text); font-weight: 750; }
.dc-quality-row-top small { color: var(--dc-muted); font-weight: 500; }
.dc-quality-track { height: 5px; border-radius: 10px; overflow: hidden; background: var(--dc-panel-raised); }
.dc-quality-track div { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #42b9e8, #53dfb0); transition: width .8s ease; }
.dc-quality-note { display: flex; gap: 7px; align-items: flex-start; margin-top: 20px; padding: 11px; border: 1px solid var(--dc-border); border-radius: 9px; color: var(--dc-muted); font-size: 9px; line-height: 1.6; }
.dc-quality-note svg { flex: 0 0 14px; color: var(--dc-cyan); }
.dc-storage-status { display: flex; align-items: center; gap: 11px; padding: 14px; margin: 3px 0 15px; border-radius: 11px; background: var(--dc-panel-raised); }
.dc-storage-status .dc-storage-pulse { width: 9px; height: 9px; }
.dc-storage-status > div { display: flex; flex-direction: column; gap: 4px; }
.dc-storage-status strong { text-transform: capitalize; font-size: 12px; }
.dc-storage-status span:not(.dc-storage-pulse) { color: var(--dc-muted); font-size: 10px; }
.dc-storage-row { display: flex; justify-content: space-between; gap: 15px; padding: 12px 0; border-bottom: 1px solid var(--dc-border); font-size: 10px; }
.dc-storage-row span { color: var(--dc-muted); }
.dc-storage-row strong { max-width: 60%; text-align: right; overflow-wrap: anywhere; }
.dc-storage-footer { display: flex; align-items: center; gap: 7px; color: var(--dc-muted); font-size: 9px; margin-top: 16px; line-height: 1.5; }
.dc-footer { display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap; padding: 22px 2px 3px; color: var(--dc-muted); font-size: 9px; }
.dc-footer-brand { display: flex; align-items: center; gap: 8px; }
.dc-footer-brand svg { color: var(--dc-cyan); }
.dc-footer-brand strong { color: var(--dc-text); font-size: 11px; }
.dc-alert { display: flex; align-items: flex-start; gap: 11px; padding: 13px 15px; margin-top: 15px; border-radius: 10px; font-size: 11px; line-height: 1.6; }
.dc-alert-error { border: 1px solid rgba(255,107,129,.3); color: #ff9aaa; background: rgba(255,107,129,.07); }
.dc-alert-info { align-items: center; border: 1px solid rgba(83,223,176,.25); color: var(--dc-green); background: rgba(83,223,176,.06); }
.dc-alert p { margin: 4px 0; overflow-wrap: anywhere; }
.dc-alert button { border: 0; background: transparent; color: inherit; margin-left: auto; font-size: 11px; }
.dc-spinning { animation: dcSpin 1s linear infinite; }
@keyframes dcFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes dcSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dcPulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
@keyframes dcOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes dcSpin { to { transform: rotate(360deg); } }
@keyframes dcSkeleton { from { opacity: .45; } to { opacity: 1; } }
@media (max-width: 1100px) {
  .dc-hero-graphic { margin-right: 0; transform: scale(.85); }
  .dc-main { padding: 20px; }
  .dc-metrics-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .dc-chart-grid { grid-template-columns: minmax(0,1fr); }
  .dc-chart-area { height: 250px; }
  .dc-distribution-chart { height: 250px; }
}
@media (max-width: 650px) {
  .dc-topbar { padding: 13px 15px; }
  .dc-live { display: none; }
  .dc-main { padding: 14px; }
  .dc-hero { padding: 23px 20px; min-height: 0; }
  .dc-hero-graphic { display: none; }
  .dc-hero h1 { font-size: 30px; }
  .dc-hero p { font-size: 12px; }
  .dc-hero-actions { flex-direction: column; align-items: stretch; }
  .dc-metrics-grid { gap: 9px; margin: 14px 0 25px; }
  .dc-metric-card { padding: 13px; gap: 8px; }
  .dc-metric-value { font-size: 22px; }
  .dc-metric-detail { font-size: 9px; }
  .dc-section-heading { align-items: flex-start; flex-direction: column; }
  .dc-section-heading h2 { font-size: 18px; }
  .dc-chart-panel { padding: 15px; }
  .dc-chart-area, .dc-distribution-chart { height: 220px; }
  .dc-table-toolbar { flex-wrap: wrap; padding: 13px; }
  .dc-search { flex-basis: 100%; }
  .dc-filter { flex: 1; }
  .dc-filter select { flex: 1; max-width: none; min-width: 0; }
  .dc-tabs { gap: 15px; padding: 0 13px; }
  .dc-tabs button { gap: 6px; font-size: 10px; }
  .dc-history-content { padding: 14px; }
  .dc-history-intro { align-items: flex-start; flex-direction: column; }
  .dc-history-item { flex-wrap: wrap; }
  .dc-history-count { margin-left: 48px; text-align: left; }
  .dc-quality-grid { grid-template-columns: minmax(0,1fr); }
  .dc-quality-panel, .dc-storage-panel { padding: 16px; }
  .dc-footer { flex-direction: column; align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .dc-page *, .dc-page *::before, .dc-page *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}
`;
