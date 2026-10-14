
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  Sparkles,
  Thermometer,
  Waves,
  Zap,
  ArrowRight,
  Layers3,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";

import { api } from "../services/api";

const THRESHOLD = 2;

const COLORS = {
  cyan: "#42d9e8",
  blue: "#5798ff",
  green: "#53dfb0",
  red: "#ff7085",
  orange: "#ffb86b",
  purple: "#b39aff",
};

function number(value, digits = 2) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return "—";

  return parsed.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function compact(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return "—";

  return parsed.toLocaleString("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function readValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) {
      const parsed = Number(row[key]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function getRows(result) {
  if (Array.isArray(result)) return result;

  return (
    result?.observations ??
    result?.records ??
    result?.data ??
    []
  );
}

function getTimestamp(row, index) {
  return (
    row.observation_time ??
    row.time ??
    row.timestamp ??
    row.date ??
    `Sample ${index + 1}`
  );
}

function formatSampleTime(value) {
  if (!value) return "Unknown time";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function MetricCard({
  icon: Icon,
  title,
  value,
  suffix,
  description,
  tone,
  index,
}) {
  return (
    <article
      className={`db-metric-card db-tone-${tone}`}
      style={{ "--db-index": index }}
    >
      <div className="db-metric-top">
        <span className="db-metric-title">{title}</span>

        <span className="db-metric-icon">
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>

      <div className="db-metric-number">
        {value}
        {suffix && <span className="db-metric-suffix">{suffix}</span>}
      </div>

      <p className="db-metric-description">{description}</p>

      <div className="db-metric-glow" />
    </article>
  );
}

function PanelHeader({ eyebrow, title, description, right }) {
  return (
    <div className="db-panel-header">
      <div>
        <div className="db-eyebrow-small">
          <span />
          {eyebrow}
        </div>

        <h2>{title}</h2>

        {description && <p>{description}</p>}
      </div>

      {right}
    </div>
  );
}

export default function Dashboard({
  refreshKey = 0,
  theme,
  onThemeChange,
}) {
  const [summary, setSummary] = useState(null);
  const [observations, setObservations] = useState([]);
  const [anomalySummary, setAnomalySummary] = useState(null);
  const [databaseStatus, setDatabaseStatus] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const lightMode = theme
  ? theme === "light"
  : false;
  const [chartMode, setChartMode] = useState("temperature");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const results = await Promise.allSettled([
        api.dashboardSummary(),
        api.observations(100, 0),
        api.anomalySummary(),
        api.databaseStatus(),
      ]);

      const [summaryResult, observationsResult, anomalyResult, databaseResult] =
        results;

      const failed = results.filter(
        (result) => result.status === "rejected"
      );

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      }

      if (observationsResult.status === "fulfilled") {
        setObservations(getRows(observationsResult.value));
      }

      if (anomalyResult.status === "fulfilled") {
        setAnomalySummary(anomalyResult.value);
      }

      if (databaseResult.status === "fulfilled") {
        setDatabaseStatus(databaseResult.value);
      }

      if (failed.length === results.length) {
        throw new Error(
          "All dashboard API requests failed. Check the backend connection."
        );
      }

      if (failed.length > 0) {
        setError(
          "Some dashboard information could not be refreshed. Available data is still displayed."
        );
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err?.message || "Unable to load dashboard information."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshKey]);

  const totalObservations = Number(
    summary?.total_observations ??
      databaseStatus?.observations ??
      0
  );

  const averageSST = Number(summary?.average_sst_celsius);

  const averageAnomaly = Number(
    summary?.average_temperature_anomaly_celsius
  );

  const totalFlags = Number(
    summary?.anomaly_count ??
      anomalySummary?.anomaly_count ??
      0
  );

  const anomalyShare =
    totalObservations > 0
      ? (totalFlags / totalObservations) * 100
      : 0;

  const datasetCount = Number(summary?.dataset_count ?? 0);

  const processingJobs = Number(summary?.processing_jobs ?? 0);

  const trendData = useMemo(() => {
    return observations
      .map((row, index) => {
        const temperature = readValue(row, [
          "sea_surface_temperature",
          "sst",
          "temperature",
        ]);

        const anomaly = readValue(row, [
          "temperature_anomaly",
          "anom",
          "anomaly",
        ]);

        return {
          sample: index + 1,
          label: `#${index + 1}`,
          timestamp: getTimestamp(row, index),
          date: formatSampleTime(getTimestamp(row, index)),
          temperature,
          anomaly,
          latitude: readValue(row, ["latitude", "lat"]),
          longitude: readValue(row, ["longitude", "lon"]),
        };
      })
      .filter(
        (row) =>
          row.temperature !== null || row.anomaly !== null
      );
  }, [observations]);

  const validTemperatures = useMemo(
    () => trendData.filter((row) => row.temperature !== null),
    [trendData]
  );

  const validAnomalies = useMemo(
    () => trendData.filter((row) => row.anomaly !== null),
    [trendData]
  );

  const distributionData = useMemo(() => {
    const normal = Math.max(0, totalObservations - totalFlags);

    return [
      {
        name: "Below ±2°C threshold",
        value: normal,
        color: COLORS.cyan,
      },
      {
        name: "Threshold flags",
        value: Math.min(totalObservations, totalFlags),
        color: COLORS.red,
      },
    ];
  }, [totalObservations, totalFlags]);

  const sampledFlagCounts = useMemo(() => {
    return observations.reduce(
      (result, row) => {
        const anomaly = readValue(row, [
          "temperature_anomaly",
          "anom",
          "anomaly",
        ]);

        if (anomaly === null) return result;

        if (anomaly >= THRESHOLD) result.positive += 1;
        else if (anomaly <= -THRESHOLD) result.negative += 1;

        return result;
      },
      { positive: 0, negative: 0 }
    );
  }, [observations]);

  const sampleStats = useMemo(() => {
    const values = validTemperatures.map((row) => row.temperature);

    if (!values.length) {
      return { minimum: null, maximum: null };
    }

    return {
      minimum: Math.min(...values),
      maximum: Math.max(...values),
    };
  }, [validTemperatures]);

  const hasData = summary !== null || observations.length > 0;

  if (loading) {
    return (
      <div className={`dashboard-pro ${lightMode ? "db-light" : ""}`}>
        <style>{DASHBOARD_CSS}</style>

        <div className="db-loading-screen">
          <div className="db-loading-orb">
            <Waves size={34} />
          </div>

          <h2>Initializing OceanMind</h2>

          <p>Synchronizing ocean observation data…</p>

          <div className="db-loading-track">
            <span />
          </div>

          <div className="db-loading-cards">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-pro ${lightMode ? "db-light" : ""}`}>
      <style>{DASHBOARD_CSS}</style>

      {/* Premium dashboard header */}
      <header className="db-hero">
        <div className="db-hero-background">
          <div className="db-hero-grid" />
          <div className="db-orb db-orb-one" />
          <div className="db-orb db-orb-two" />
          <div className="db-hero-wave" />
        </div>

        <div className="db-hero-content">
          <div className="db-hero-eyebrow">
            <span className="db-live-dot" />
            OCEANMIND / MISSION CONTROL
          </div>

          <div className="db-hero-heading">
            <div>
              <h1>
                Ocean <span>Intelligence</span>
              </h1>

              <p>
                Discover the patterns behind our oceans. Monitor
                sea-surface temperatures, explore anomaly screening,
                and track your dataset processing pipeline.
              </p>
            </div>

            <div className="db-hero-actions">
             <button
  className="db-button db-button-glass"
  onClick={() =>
    onThemeChange?.(lightMode ? "dark" : "light")
  }
  aria-label={
    lightMode ? "Switch to dark theme" : "Switch to light theme"
  }
>
  <Sparkles size={16} />
  {lightMode ? "Ocean theme" : "Light theme"}
</button>

              <button
                className="db-button db-button-primary"
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "db-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>

          <div className="db-hero-footer">
            <div className="db-status-chip">
              <span className="db-status-indicator" />
              {databaseStatus?.status === "connected"
                ? "Database connected"
                : "Dashboard data"}
            </div>

            <span className="db-hero-meta">
              <Clock3 size={14} />
              {lastUpdated
                ? `Last synced ${lastUpdated.toLocaleTimeString("en-IN")}`
                : "Waiting for data"}
            </span>

            <span className="db-hero-meta">
              <Database size={14} />
              {observations.length.toLocaleString("en-IN")} chart samples loaded
            </span>
          </div>
        </div>
      </header>

      {error && (
        <div className="db-error-banner">
          <AlertTriangle size={18} />

          <div>
            <strong>Dashboard data notice</strong>
            <p>{error}</p>
          </div>

          <button
            className="db-small-icon-button"
            onClick={() => loadDashboard(true)}
            aria-label="Retry"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      {!hasData && (
        <div className="db-empty-banner">
          <Database size={20} />
          <div>
            <strong>No dashboard data available</strong>
            <p>
              Start the FastAPI backend and verify the database
              status before refreshing this page.
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <section className="db-metrics-grid">
        <MetricCard
          icon={Database}
          title="Total observations"
          value={compact(totalObservations)}
          description={`${totalObservations.toLocaleString("en-IN")} records in the database`}
          tone="cyan"
          index={0}
        />

        <MetricCard
          icon={Thermometer}
          title="Average sea temperature"
          value={number(averageSST)}
          suffix="°C"
          description="Dataset-wide average reported by the API"
          tone="blue"
          index={1}
        />

        <MetricCard
          icon={AlertTriangle}
          title="Threshold flags"
          value={compact(totalFlags)}
          description={`Absolute temperature anomaly ≥ ${THRESHOLD}°C`}
          tone="red"
          index={2}
        />

        <MetricCard
          icon={Activity}
          title="Flagged share"
          value={number(anomalyShare)}
          suffix="%"
          description="Flags divided by total observations"
          tone="purple"
          index={3}
        />
      </section>

      {/* Overview strip */}
      <section className="db-overview-strip">
        <div className="db-overview-heading">
          <div className="db-overview-icon">
            <Layers3 size={19} />
          </div>

          <div>
            <strong>Dataset processing overview</strong>
            <p>Current backend-reported pipeline status</p>
          </div>
        </div>

        <div className="db-overview-item">
          <span>Datasets</span>
          <strong>{datasetCount.toLocaleString("en-IN")}</strong>
        </div>

        <div className="db-overview-item">
          <span>Processing jobs</span>
          <strong>{processingJobs.toLocaleString("en-IN")}</strong>
        </div>

        <div className="db-overview-item">
          <span>Mean temperature anomaly</span>
          <strong>
            {Number.isFinite(averageAnomaly)
              ? `${number(averageAnomaly)}°C`
              : "—"}
          </strong>
        </div>

        <div className="db-overview-status">
          <CheckCircle2 size={15} />
          <span>
            {databaseStatus?.status === "connected"
              ? "Database online"
              : "Status not confirmed"}
          </span>
        </div>
      </section>

      {/* Main charts */}
      <section className="db-main-grid">
        <article className="db-panel db-temperature-panel">
          <PanelHeader
            eyebrow="OCEAN OBSERVATIONS"
            title={
              chartMode === "temperature"
                ? "Sea surface temperature"
                : "Temperature anomaly profile"
            }
            description={
              chartMode === "temperature"
                ? "Measurements from the observations returned by your API."
                : "Anomaly measurements from the same loaded observation sample."
            }
            right={
              <div className="db-chart-switcher">
                <button
                  className={chartMode === "temperature" ? "active" : ""}
                  onClick={() => setChartMode("temperature")}
                >
                  SST
                </button>

                <button
                  className={chartMode === "anomaly" ? "active" : ""}
                  onClick={() => setChartMode("anomaly")}
                >
                  Anomaly
                </button>
              </div>
            }
          />

          <div className="db-chart-summary">
            {chartMode === "temperature" ? (
              <>
                <div>
                  <span>Dataset average</span>
                  <strong>
                    {Number.isFinite(averageSST)
                      ? `${number(averageSST)}°C`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>Sample minimum</span>
                  <strong>
                    {sampleStats.minimum !== null
                      ? `${number(sampleStats.minimum)}°C`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>Sample maximum</span>
                  <strong>
                    {sampleStats.maximum !== null
                      ? `${number(sampleStats.maximum)}°C`
                      : "—"}
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>Mean anomaly</span>
                  <strong>
                    {Number.isFinite(averageAnomaly)
                      ? `${number(averageAnomaly)}°C`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>Positive flags in sample</span>
                  <strong className="db-red-text">
                    {sampledFlagCounts.positive.toLocaleString("en-IN")}
                  </strong>
                </div>

                <div>
                  <span>Negative flags in sample</span>
                  <strong className="db-blue-text">
                    {sampledFlagCounts.negative.toLocaleString("en-IN")}
                  </strong>
                </div>
              </>
            )}
          </div>

          <div className="db-main-chart">
            {chartMode === "temperature" ? (
              validTemperatures.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={validTemperatures}
                    margin={{ top: 12, right: 8, left: -14, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient
                        id="dbSstGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={COLORS.cyan}
                          stopOpacity={0.38}
                        />
                        <stop
                          offset="90%"
                          stopColor={COLORS.cyan}
                          stopOpacity={0.015}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="var(--db-grid)"
                      strokeDasharray="4 6"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="label"
                      stroke="var(--db-muted)"
                      tick={{ fill: "var(--db-muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />

                    <YAxis
                      stroke="var(--db-muted)"
                      tick={{ fill: "var(--db-muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${value}°`}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "var(--db-tooltip-bg)",
                        border: "1px solid var(--db-border)",
                        borderRadius: 12,
                        color: "var(--db-text)",
                      }}
                      labelStyle={{
                        color: "var(--db-muted)",
                        marginBottom: 5,
                      }}
                      formatter={(value) => [
                        `${number(value)}°C`,
                        "Sea surface temperature",
                      ]}
                      labelFormatter={(label, payload) => {
                        const row = payload?.[0]?.payload;
                        return row
                          ? `${label} · ${row.timestamp}`
                          : label;
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="temperature"
                      name="Sea surface temperature"
                      stroke={COLORS.cyan}
                      strokeWidth={2.4}
                      fill="url(#dbSstGradient)"
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: "var(--db-panel-solid)",
                      }}
                      dot={false}
                      isAnimationActive
                      animationDuration={1100}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="db-chart-empty">
                  No valid temperature measurements were returned.
                </div>
              )
            ) : validAnomalies.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={validAnomalies}
                  margin={{ top: 12, right: 8, left: -14, bottom: 4 }}
                >
                  <defs>
                    <linearGradient
                      id="dbAnomalyGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={COLORS.purple}
                        stopOpacity={0.32}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS.purple}
                        stopOpacity={0.015}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="var(--db-grid)"
                    strokeDasharray="4 6"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    stroke="var(--db-muted)"
                    tick={{ fill: "var(--db-muted)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />

                  <YAxis
                    stroke="var(--db-muted)"
                    tick={{ fill: "var(--db-muted)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${value}°`}
                  />

                  <ReferenceLine
                    y={0}
                    stroke="var(--db-muted)"
                    strokeDasharray="4 4"
                  />

                  <ReferenceLine
                    y={THRESHOLD}
                    stroke={COLORS.red}
                    strokeDasharray="5 5"
                  />

                  <ReferenceLine
                    y={-THRESHOLD}
                    stroke={COLORS.blue}
                    strokeDasharray="5 5"
                  />

                  <Tooltip
                    contentStyle={{
                      background: "var(--db-tooltip-bg)",
                      border: "1px solid var(--db-border)",
                      borderRadius: 12,
                      color: "var(--db-text)",
                    }}
                    formatter={(value) => [
                      `${number(value)}°C`,
                      "Temperature anomaly",
                    ]}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload;
                      return row
                        ? `${label} · ${row.timestamp}`
                        : label;
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="anomaly"
                    name="Temperature anomaly"
                    stroke={COLORS.purple}
                    strokeWidth={2.3}
                    fill="url(#dbAnomalyGradient)"
                    activeDot={{ r: 5 }}
                    dot={false}
                    isAnimationActive
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="db-chart-empty">
                No valid anomaly measurements were returned.
              </div>
            )}
          </div>

          <div className="db-chart-footnote">
            <span className="db-footnote-dot" />
            {chartMode === "temperature"
              ? `Chart uses ${validTemperatures.length} temperature measurements from the loaded API sample.`
              : "Dashed lines show the ±2°C threshold screening levels."}
          </div>
        </article>

        <article className="db-panel db-distribution-panel">
          <PanelHeader
            eyebrow="DATASET COMPOSITION"
            title="Observation classification"
            description="Threshold screening across the full dataset."
          />

          <div className="db-donut-container">
            {totalObservations > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius="66%"
                      outerRadius="87%"
                      paddingAngle={3}
                      stroke="none"
                      isAnimationActive
                      animationDuration={1000}
                    >
                      {distributionData.map((item) => (
                        <Cell
                          key={item.name}
                          fill={item.color}
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      contentStyle={{
                        background: "var(--db-tooltip-bg)",
                        border: "1px solid var(--db-border)",
                        borderRadius: 12,
                        color: "var(--db-text)",
                      }}
                      formatter={(value, name) => [
                        Number(value).toLocaleString("en-IN"),
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="db-donut-center">
                  <span>TOTAL RECORDS</span>
                  <strong>{compact(totalObservations)}</strong>
                  <small>observations</small>
                </div>
              </>
            ) : (
              <div className="db-chart-empty">
                Dataset summary is unavailable.
              </div>
            )}
          </div>

          <div className="db-distribution-legend">
            <div>
              <span className="db-legend-swatch db-swatch-normal" />
              <div>
                <strong>Below ±2°C threshold</strong>
                <span>Not flagged by this rule</span>
              </div>
              <b>{compact(distributionData[0].value)}</b>
            </div>

            <div>
              <span className="db-legend-swatch db-swatch-flagged" />
              <div>
                <strong>Threshold flags</strong>
                <span>Absolute anomaly ≥ 2°C</span>
              </div>
              <b>{compact(distributionData[1].value)}</b>
            </div>
          </div>

          <div className="db-distribution-progress">
            <div>
              <span>Flagged share</span>
              <strong>{number(anomalyShare)}%</strong>
            </div>

            <div className="db-progress-track">
              <span
                style={{
                  width: `${Math.min(100, Math.max(0, anomalyShare))}%`,
                }}
              />
            </div>
          </div>

          <p className="db-chart-disclaimer">
            The chart is calculated from the database-wide summary.
            “Below threshold” does not necessarily mean the ocean
            measurement is scientifically normal or risk-free.
          </p>
        </article>
      </section>

      {/* Sample anomaly bar chart */}
      <section className="db-panel db-sample-panel">
        <PanelHeader
          eyebrow="SAMPLE INSPECTION"
          title="Temperature anomaly samples"
          description={`Measurements from the first ${observations.length} observations returned by the API.`}
          right={
            <span className="db-sample-count">
              {validAnomalies.length} valid values
            </span>
          }
        />

        <div className="db-sample-chart">
          {validAnomalies.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={validAnomalies}
                margin={{ top: 12, right: 10, left: -14, bottom: 4 }}
              >
                <CartesianGrid
                  stroke="var(--db-grid)"
                  strokeDasharray="4 6"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  stroke="var(--db-muted)"
                  tick={{ fill: "var(--db-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />

                <YAxis
                  stroke="var(--db-muted)"
                  tick={{ fill: "var(--db-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}°`}
                />

                <ReferenceLine
                  y={0}
                  stroke="var(--db-muted)"
                  strokeDasharray="4 4"
                />

                <ReferenceLine
                  y={THRESHOLD}
                  stroke={COLORS.red}
                  strokeDasharray="5 5"
                />

                <ReferenceLine
                  y={-THRESHOLD}
                  stroke={COLORS.blue}
                  strokeDasharray="5 5"
                />

                <Tooltip
                  contentStyle={{
                    background: "var(--db-tooltip-bg)",
                    border: "1px solid var(--db-border)",
                    borderRadius: 12,
                    color: "var(--db-text)",
                  }}
                  formatter={(value) => [
                    `${number(value)}°C`,
                    "Temperature anomaly",
                  ]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    return row
                      ? `${label} · ${row.timestamp}`
                      : label;
                  }}
                />

                <Bar
                  dataKey="anomaly"
                  name="Temperature anomaly"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive
                  animationDuration={1000}
                  animationEasing="ease-out"
                >
                  {validAnomalies.map((row, index) => (
                    <Cell
                      key={`${row.label}-${index}`}
                      fill={
                        row.anomaly >= THRESHOLD
                          ? COLORS.red
                          : row.anomaly <= -THRESHOLD
                            ? COLORS.blue
                            : COLORS.cyan
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="db-chart-empty">
              No anomaly values available in the loaded sample.
            </div>
          )}
        </div>

        <div className="db-sample-legend">
          <span>
            <i className="db-legend-swatch db-swatch-normal" />
            Below threshold
          </span>

          <span>
            <i className="db-legend-swatch db-swatch-flagged" />
            Positive flag ≥ +2°C
          </span>

          <span>
            <i className="db-legend-swatch db-swatch-negative" />
            Negative flag ≤ −2°C
          </span>
        </div>
      </section>

      {/* Bottom insight panels */}
      <section className="db-bottom-grid">
        <article className="db-insight-card db-insight-cyan">
          <div className="db-insight-icon">
            <Waves size={21} />
          </div>

          <div>
            <span className="db-insight-kicker">DATA EXPLORATION</span>
            <h3>Explore ocean observations</h3>
            <p>
              Investigate measurement values, locations, and patterns
              from the imported dataset.
            </p>
          </div>

          <div className="db-insight-footer">
            <span>
              {observations.length.toLocaleString("en-IN")} loaded samples
            </span>
            <ArrowRight size={17} />
          </div>
        </article>

        <article className="db-insight-card db-insight-red">
          <div className="db-insight-icon">
            <AlertTriangle size={21} />
          </div>

          <div>
            <span className="db-insight-kicker">ANOMALY SCREENING</span>
            <h3>Review threshold flags</h3>
            <p>
              Inspect measurements outside the selected temperature
              anomaly threshold.
            </p>
          </div>

          <div className="db-insight-footer">
            <span>
              {totalFlags.toLocaleString("en-IN")} database flags
            </span>
            <ArrowRight size={17} />
          </div>
        </article>

        <article className="db-insight-card db-insight-purple">
          <div className="db-insight-icon">
            <Zap size={21} />
          </div>

          <div>
            <span className="db-insight-kicker">SYSTEM OPERATIONS</span>
            <h3>Monitor processing status</h3>
            <p>
              Check database connectivity and the latest processing
              summary from the backend.
            </p>
          </div>

          <div className="db-insight-footer">
            <span>
              {datasetCount.toLocaleString("en-IN")} datasets ·{" "}
              {processingJobs.toLocaleString("en-IN")} jobs
            </span>
            <ArrowRight size={17} />
          </div>
        </article>
      </section>

      <footer className="db-footer">
        <div className="db-footer-left">
          <span className="db-footer-mark">
            <Waves size={17} />
          </span>

          <div>
            <strong>OCEANMIND</strong>
            <span>Ocean data intelligence platform</span>
          </div>
        </div>

        <div className="db-footer-right">
          <span>
            <i />
            {databaseStatus?.status === "connected"
              ? "Database connected"
              : "Connection status unconfirmed"}
          </span>

          <span>Screening threshold: ±2°C</span>
        </div>
      </footer>
    </div>
  );
}

const DASHBOARD_CSS = `
.dashboard-pro {
  --db-bg: #07111f;
  --db-panel: rgba(13,26,43,.88);
  --db-panel-solid: #0d1a2b;
  --db-panel-hover: #12243a;
  --db-border: rgba(142,173,208,.15);
  --db-text: #eaf3ff;
  --db-muted: #8da2bb;
  --db-cyan: #42d9e8;
  --db-blue: #5798ff;
  --db-green: #53dfb0;
  --db-red: #ff7085;
  --db-purple: #b39aff;
  --db-grid: rgba(142,173,208,.12);
  --db-tooltip-bg: #0b1727;
  color: var(--db-text);
  font-family: inherit;
  min-width: 0;
  padding-bottom: 28px;
  animation: db-page-enter .65s cubic-bezier(.2,.75,.25,1) both;
}
.dashboard-pro * { box-sizing: border-box; }
.dashboard-pro button { font: inherit; -webkit-tap-highlight-color: transparent; }
.dashboard-pro button:focus-visible {
  outline: 2px solid var(--db-cyan);
  outline-offset: 3px;
}
.db-light {
  --db-bg: #f1f6fc;
  --db-panel: rgba(255,255,255,.95);
  --db-panel-solid: #fff;
  --db-panel-hover: #f3f8ff;
  --db-border: rgba(31,63,100,.13);
  --db-text: #14273d;
  --db-muted: #647991;
  --db-cyan: #087f98;
  --db-blue: #276dc4;
  --db-green: #13845d;
  --db-red: #d94461;
  --db-purple: #7554c8;
  --db-grid: rgba(31,63,100,.12);
  --db-tooltip-bg: #fff;
}
@keyframes db-page-enter {
  from { opacity:0; transform:translateY(10px); }
  to { opacity:1; transform:translateY(0); }
}
@keyframes db-float {
  0%,100% { transform:translate3d(0,0,0) scale(1); }
  50% { transform:translate3d(12px,-14px,0) scale(1.04); }
}
@keyframes db-wave {
  from { transform:translateX(0); }
  to { transform:translateX(-45px); }
}
@keyframes db-pulse {
  0% { box-shadow:0 0 0 0 rgba(83,223,176,.6); }
  70% { box-shadow:0 0 0 7px rgba(83,223,176,0); }
  100% { box-shadow:0 0 0 0 rgba(83,223,176,0); }
}
@keyframes db-card-enter {
  from { opacity:0; transform:translateY(14px) scale(.985); }
  to { opacity:1; transform:translateY(0) scale(1); }
}
@keyframes db-spin { to { transform:rotate(360deg); } }
@keyframes db-loading {
  from { transform:translateX(-110%); }
  to { transform:translateX(220%); }
}

.db-hero {
  position:relative; isolation:isolate; overflow:hidden;
  border:1px solid rgba(91,186,222,.18); border-radius:24px;
  padding:clamp(24px,3.2vw,42px); margin-bottom:22px;
  background:
    radial-gradient(ellipse at 85% 5%,rgba(24,115,174,.23),transparent 38%),
    linear-gradient(115deg,#091726 0%,#0a1b2f 52%,#0b2439 100%);
  box-shadow:0 18px 55px rgba(0,0,0,.15);
}
.db-hero-background { position:absolute; inset:0; z-index:-1; pointer-events:none; }
.db-hero-grid {
  position:absolute; inset:0;
  background-image:
    linear-gradient(rgba(92,191,222,.055) 1px,transparent 1px),
    linear-gradient(90deg,rgba(92,191,222,.055) 1px,transparent 1px);
  background-size:38px 38px;
  mask-image:linear-gradient(90deg,black,transparent 95%);
}
.db-orb {
  position:absolute; border-radius:50%;
  animation:db-float 9s ease-in-out infinite;
}
.db-orb-one {
  width:260px; height:260px; right:7%; top:-175px;
  background:radial-gradient(circle,rgba(66,217,232,.17),transparent 70%);
}
.db-orb-two {
  width:230px; height:230px; right:28%; bottom:-205px;
  background:radial-gradient(circle,rgba(87,152,255,.15),transparent 70%);
  animation-delay:-4s;
}
.db-hero-wave {
  position:absolute; right:-5%; bottom:-40px; width:65%; height:90px;
  border-top:1px solid rgba(66,217,232,.25); border-radius:50%;
  box-shadow:0 -12px 0 -11px rgba(66,217,232,.15),
             0 -25px 0 -24px rgba(66,217,232,.12);
  animation:db-wave 7s ease-in-out infinite alternate;
}
.db-hero-content { position:relative; z-index:1; }
.db-hero-eyebrow {
  display:flex; align-items:center; gap:10px; margin-bottom:22px;
  color:#89c9dd; font-size:10px; font-weight:800; letter-spacing:2px;
}
.db-live-dot {
  display:inline-block; flex:none; width:7px; height:7px;
  border-radius:50%; background:#53dfb0;
  box-shadow:0 0 12px rgba(83,223,176,.4);
  animation:db-pulse 2.1s infinite;
}
.db-hero-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:28px; }
.db-hero h1 {
  margin:0; color:#f0f7ff; font-size:clamp(31px,4vw,46px);
  line-height:1.12; font-weight:760; letter-spacing:-1.7px;
}
.db-hero h1 span {
  background:linear-gradient(100deg,#62e4e7,#76b9ff);
  background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent;
}
.db-hero-heading p { max-width:700px; color:#a4b8ce; font-size:13px; line-height:1.85; margin:15px 0 0; }
.db-hero-actions { display:flex; flex-wrap:wrap; gap:9px; }
.db-button {
  display:inline-flex; justify-content:center; align-items:center; gap:8px;
  min-height:39px; border:1px solid transparent; border-radius:11px;
  padding:9px 13px; cursor:pointer; font-size:11px!important; font-weight:700;
  white-space:nowrap; transition:transform .2s ease,background .2s ease,box-shadow .2s ease;
}
.db-button:hover:not(:disabled) { transform:translateY(-2px); }
.db-button:disabled { opacity:.45; cursor:not-allowed; }
.db-button-primary {
  color:#04131d; background:linear-gradient(115deg,#54dce8,#72b9ff);
  box-shadow:0 6px 22px rgba(66,217,232,.13);
}
.db-button-primary:hover:not(:disabled) { box-shadow:0 8px 26px rgba(66,217,232,.25); }
.db-button-glass { color:#d2e5f5; background:rgba(255,255,255,.045); border-color:rgba(255,255,255,.13); }
.db-button-glass:hover { background:rgba(255,255,255,.09); }
.db-hero-footer {
  display:flex; align-items:center; flex-wrap:wrap; gap:17px;
  margin-top:26px; padding-top:18px; border-top:1px solid rgba(180,215,240,.12);
}
.db-status-chip {
  display:inline-flex; align-items:center; gap:7px; padding:7px 10px;
  border:1px solid rgba(83,223,176,.2); border-radius:8px;
  color:#8be8c7; background:rgba(83,223,176,.06); font-size:10px; font-weight:700;
}
.db-status-indicator { width:6px; height:6px; background:#53dfb0; border-radius:50%; }
.db-hero-meta { display:inline-flex; align-items:center; gap:7px; color:#92abc3; font-size:10px; }
.db-hero-meta svg { color:#5ecddf; }
.db-spin { animation:db-spin 1s linear infinite; }

.db-error-banner,.db-empty-banner {
  display:flex; align-items:center; gap:13px; padding:15px 17px;
  margin-bottom:18px; border-radius:13px; border:1px solid var(--db-border);
  background:var(--db-panel);
}
.db-error-banner { color:var(--db-red); border-color:rgba(255,112,133,.32); background:rgba(255,112,133,.06); }
.db-error-banner > div,.db-empty-banner > div { flex:1; min-width:0; }
.db-error-banner strong,.db-empty-banner strong { font-size:12px; }
.db-error-banner p,.db-empty-banner p { color:var(--db-muted); font-size:11px; line-height:1.6; margin:5px 0 0; }
.db-empty-banner { color:var(--db-cyan); }
.db-small-icon-button {
  display:grid; place-items:center; width:35px; height:35px;
  color:var(--db-text); background:var(--db-panel-solid);
  border:1px solid var(--db-border); border-radius:10px; cursor:pointer;
}

.db-metrics-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-bottom:20px; }
.db-metric-card {
  position:relative; overflow:hidden; min-width:0; padding:19px;
  border:1px solid var(--db-border); border-radius:17px; background:var(--db-panel);
  box-shadow:0 7px 24px rgba(0,0,0,.06);
  animation:db-card-enter .55s cubic-bezier(.2,.75,.25,1) both;
  animation-delay:calc(var(--db-index,0) * 90ms);
  transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease;
}
.db-metric-card:hover { transform:translateY(-4px); border-color:rgba(66,217,232,.35); box-shadow:0 15px 34px rgba(0,0,0,.12); }
.db-metric-top { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.db-metric-title { color:var(--db-muted); font-size:11px; font-weight:600; line-height:1.5; }
.db-metric-icon {
  display:grid; place-items:center; flex:none; width:35px; height:35px;
  border:1px solid rgba(66,217,232,.13); border-radius:11px;
  color:var(--db-cyan); background:rgba(66,217,232,.1);
}
.db-tone-blue .db-metric-icon { color:var(--db-blue); background:rgba(87,152,255,.1); border-color:rgba(87,152,255,.16); }
.db-tone-red .db-metric-icon { color:var(--db-red); background:rgba(255,112,133,.1); border-color:rgba(255,112,133,.16); }
.db-tone-purple .db-metric-icon { color:var(--db-purple); background:rgba(179,154,255,.1); border-color:rgba(179,154,255,.16); }
.db-metric-number {
  position:relative; z-index:1; margin:17px 0 6px;
  font-size:clamp(23px,2.3vw,30px); line-height:1.1; font-weight:760;
  letter-spacing:-.9px; overflow-wrap:anywhere; font-variant-numeric:tabular-nums;
}
.db-metric-suffix { margin-left:5px; font-size:.58em; font-weight:650; letter-spacing:0; }
.db-metric-description { position:relative; z-index:1; margin:0; color:var(--db-muted); font-size:10px; line-height:1.65; }
.db-metric-glow {
  position:absolute; width:100px; height:100px; right:-50px; bottom:-65px;
  border-radius:50%; background:rgba(66,217,232,.08); filter:blur(12px); transition:transform .35s ease;
}
.db-metric-card:hover .db-metric-glow { transform:scale(1.7); }

.db-overview-strip {
  display:flex; align-items:center; flex-wrap:wrap; gap:20px;
  padding:17px 19px; margin-bottom:21px;
  border:1px solid var(--db-border); border-radius:15px; background:var(--db-panel);
}
.db-overview-heading { display:flex; align-items:center; gap:11px; flex:1 1 225px; min-width:0; }
.db-overview-icon { display:grid; place-items:center; flex:none; width:38px; height:38px; border-radius:11px; color:var(--db-cyan); background:rgba(66,217,232,.09); }
.db-overview-heading strong { display:block; font-size:11px; }
.db-overview-heading p { margin:5px 0 0; color:var(--db-muted); font-size:9px; }
.db-overview-item { display:flex; flex-direction:column; gap:6px; min-width:100px; }
.db-overview-item span { color:var(--db-muted); font-size:9px; }
.db-overview-item strong { font-size:15px; font-variant-numeric:tabular-nums; }
.db-overview-status { display:flex; align-items:center; gap:6px; color:var(--db-green); font-size:9px; font-weight:700; }

.db-main-grid { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(280px,.9fr); gap:17px; margin-bottom:21px; }
.db-panel { min-width:0; overflow:hidden; border:1px solid var(--db-border); border-radius:18px; background:var(--db-panel); box-shadow:0 8px 28px rgba(0,0,0,.055); }
.db-temperature-panel,.db-distribution-panel,.db-sample-panel { padding:22px; }
.db-panel-header { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
.db-eyebrow-small { display:flex; align-items:center; gap:7px; color:var(--db-cyan); font-size:9px; font-weight:800; letter-spacing:1.3px; margin-bottom:10px; }
.db-eyebrow-small > span { width:6px; height:6px; border-radius:50%; background:var(--db-cyan); }
.db-panel-header h2 { margin:0; color:var(--db-text); font-size:17px; line-height:1.35; font-weight:730; letter-spacing:-.35px; }
.db-panel-header p { margin:7px 0 0; color:var(--db-muted); font-size:10px; line-height:1.7; }
.db-chart-switcher { display:flex; flex:none; padding:3px; gap:2px; border:1px solid var(--db-border); border-radius:10px; background:var(--db-panel-solid); }
.db-chart-switcher button {
  border:0; border-radius:7px; padding:7px 10px; cursor:pointer;
  color:var(--db-muted); background:transparent; font-size:10px; font-weight:700;
  transition:background .2s ease,color .2s ease;
}
.db-chart-switcher button.active { color:var(--db-cyan); background:rgba(66,217,232,.1); }
.db-chart-summary { display:flex; gap:22px; flex-wrap:wrap; margin-top:22px; }
.db-chart-summary > div { display:flex; flex-direction:column; gap:5px; }
.db-chart-summary span { color:var(--db-muted); font-size:9px; }
.db-chart-summary strong { color:var(--db-text); font-size:15px; font-variant-numeric:tabular-nums; }
.db-red-text { color:var(--db-red)!important; }
.db-blue-text { color:var(--db-blue)!important; }
.db-main-chart { width:100%; height:280px; margin-top:14px; }
.db-chart-empty { display:flex; align-items:center; justify-content:center; min-height:210px; padding:25px; text-align:center; color:var(--db-muted); font-size:11px; }
.db-chart-footnote { display:flex; align-items:center; gap:8px; margin-top:10px; color:var(--db-muted); font-size:9px; line-height:1.6; }
.db-footnote-dot { flex:none; width:6px; height:6px; border-radius:50%; background:var(--db-cyan); }

.db-donut-container { height:250px; position:relative; margin-top:7px; }
.db-donut-center { pointer-events:none; position:absolute; left:50%; top:46%; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; text-align:center; width:130px; }
.db-donut-center span { color:var(--db-muted); font-size:8px; font-weight:800; letter-spacing:1px; }
.db-donut-center strong { font-size:29px; line-height:1.4; letter-spacing:-.8px; font-variant-numeric:tabular-nums; }
.db-donut-center small { color:var(--db-muted); font-size:9px; }
.db-distribution-legend { display:grid; gap:16px; margin-top:4px; }
.db-distribution-legend > div { display:flex; align-items:center; gap:10px; }
.db-legend-swatch { display:inline-block; width:8px; height:8px; border-radius:50%; flex:none; }
.db-swatch-normal { background:var(--db-cyan); }
.db-swatch-flagged { background:var(--db-red); }
.db-swatch-negative { background:var(--db-blue); }
.db-distribution-legend > div > div { display:flex; flex-direction:column; gap:4px; flex:1; min-width:0; }
.db-distribution-legend strong { color:var(--db-text); font-size:10px; }
.db-distribution-legend span:not(.db-legend-swatch) { color:var(--db-muted); font-size:9px; }
.db-distribution-legend b { font-size:13px; font-variant-numeric:tabular-nums; }
.db-distribution-progress { margin-top:21px; padding-top:16px; border-top:1px solid var(--db-border); }
.db-distribution-progress > div:first-child { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
.db-distribution-progress span { color:var(--db-muted); font-size:10px; }
.db-distribution-progress strong { color:var(--db-red); font-size:12px; }
.db-progress-track { height:5px; overflow:hidden; border-radius:6px; background:var(--db-border); }
.db-progress-track span { display:block; height:100%; border-radius:6px; background:linear-gradient(90deg,var(--db-red),#ffb86b); transition:width .8s ease; }
.db-chart-disclaimer { color:var(--db-muted); font-size:9px; line-height:1.7; margin:14px 0 0; }

.db-sample-panel { margin-bottom:21px; }
.db-sample-count { flex:none; padding:7px 9px; border:1px solid var(--db-border); border-radius:8px; color:var(--db-cyan); background:rgba(66,217,232,.06); font-size:9px; font-weight:700; }
.db-sample-chart { height:255px; margin-top:17px; }
.db-sample-legend { display:flex; flex-wrap:wrap; gap:17px; margin-top:12px; }
.db-sample-legend > span { display:inline-flex; align-items:center; gap:7px; color:var(--db-muted); font-size:9px; }

.db-bottom-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin-bottom:23px; }
.db-insight-card {
  display:flex; flex-direction:column; align-items:flex-start; min-width:0;
  padding:19px; border:1px solid var(--db-border); border-radius:16px;
  background:var(--db-panel); transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease;
}
.db-insight-card:hover { transform:translateY(-4px); border-color:rgba(66,217,232,.32); box-shadow:0 14px 30px rgba(0,0,0,.09); }
.db-insight-icon { display:grid; place-items:center; width:39px; height:39px; border-radius:12px; margin-bottom:16px; color:var(--db-cyan); background:rgba(66,217,232,.09); }
.db-insight-red .db-insight-icon { color:var(--db-red); background:rgba(255,112,133,.09); }
.db-insight-purple .db-insight-icon { color:var(--db-purple); background:rgba(179,154,255,.09); }
.db-insight-kicker { color:var(--db-muted); font-size:8px; font-weight:800; letter-spacing:1.1px; }
.db-insight-card h3 { color:var(--db-text); font-size:13px; margin:8px 0; line-height:1.5; }
.db-insight-card p { color:var(--db-muted); font-size:10px; line-height:1.8; margin:0; }
.db-insight-footer { display:flex; justify-content:space-between; align-items:center; gap:10px; width:100%; margin-top:auto; padding-top:17px; color:var(--db-cyan); font-size:9px; }
.db-insight-red .db-insight-footer { color:var(--db-red); }
.db-insight-purple .db-insight-footer { color:var(--db-purple); }

.db-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; padding:16px 2px 0; border-top:1px solid var(--db-border); }
.db-footer-left { display:flex; align-items:center; gap:10px; }
.db-footer-mark { display:grid; place-items:center; width:34px; height:34px; color:var(--db-cyan); background:rgba(66,217,232,.09); border-radius:10px; }
.db-footer-left > div { display:flex; flex-direction:column; gap:4px; }
.db-footer-left strong { font-size:10px; letter-spacing:1.2px; }
.db-footer-left span:not(.db-footer-mark) { color:var(--db-muted); font-size:9px; }
.db-footer-right { display:flex; flex-wrap:wrap; gap:15px; }
.db-footer-right span { display:flex; align-items:center; gap:6px; color:var(--db-muted); font-size:9px; }
.db-footer-right i { width:6px; height:6px; background:var(--db-green); border-radius:50%; }

.db-loading-screen { min-height:480px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px 12px; text-align:center; }
.db-loading-orb { display:grid; place-items:center; width:70px; height:70px; color:var(--db-cyan); border:1px solid rgba(66,217,232,.3); border-radius:24px; background:rgba(66,217,232,.08); box-shadow:0 0 55px rgba(66,217,232,.1); animation:db-float 3s ease-in-out infinite; }
.db-loading-screen h2 { margin:23px 0 8px; font-size:18px; }
.db-loading-screen p { color:var(--db-muted); font-size:11px; }
.db-loading-track { width:min(300px,80%); height:3px; overflow:hidden; margin-top:16px; border-radius:5px; background:var(--db-border); }
.db-loading-track span { display:block; width:45%; height:100%; border-radius:5px; background:var(--db-cyan); animation:db-loading 1.5s ease-in-out infinite; }
.db-loading-cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; width:min(100%,900px); margin-top:40px; }
.db-loading-cards div { height:100px; border:1px solid var(--db-border); border-radius:14px; background:linear-gradient(100deg,var(--db-panel) 25%,var(--db-panel-hover) 45%,var(--db-panel) 65%); background-size:220% 100%; animation:db-loading 1.6s linear infinite; }

@media (min-width:1500px) {
  .db-metrics-grid { gap:18px; }
  .db-metric-card { padding:22px; }
  .db-temperature-panel,.db-distribution-panel,.db-sample-panel { padding:26px; }
  .db-main-chart { height:320px; }
  .db-donut-container { height:280px; }
}
@media (max-width:1100px) {
  .db-hero-heading { flex-direction:column; }
  .db-main-grid { grid-template-columns:minmax(0,1fr); }
  .db-overview-strip { gap:16px; }
}
@media (max-width:760px) {
  .db-hero { border-radius:18px; padding:23px 18px; }
  .db-hero h1 { font-size:31px; letter-spacing:-1px; }
  .db-hero-actions { width:100%; }
  .db-hero-actions .db-button { flex:1; }
  .db-hero-footer { gap:11px; }
  .db-hero-meta { font-size:9px; }
  .db-metrics-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .db-metric-card { padding:15px; border-radius:14px; }
  .db-metric-title { font-size:10px; }
  .db-metric-icon { width:31px; height:31px; }
  .db-metric-number { margin-top:14px; font-size:24px; }
  .db-metric-description { font-size:9px; }
  .db-overview-strip { gap:15px; padding:15px; }
  .db-overview-heading { flex-basis:100%; }
  .db-overview-item { flex:1 1 30%; min-width:0; }
  .db-overview-item strong { font-size:13px; }
  .db-overview-status { flex-basis:100%; }
  .db-temperature-panel,.db-distribution-panel,.db-sample-panel { padding:17px; }
  .db-panel-header h2 { font-size:15px; }
  .db-panel-header p { font-size:9px; }
  .db-chart-switcher button { padding:7px 8px; font-size:9px; }
  .db-chart-summary { gap:15px; }
  .db-chart-summary strong { font-size:13px; }
  .db-main-chart { height:250px; }
  .db-donut-container { height:245px; }
  .db-sample-chart { height:230px; }
  .db-bottom-grid { grid-template-columns:minmax(0,1fr); gap:10px; }
  .db-insight-card { padding:16px; }
  .db-insight-icon { margin-bottom:11px; }
  .db-insight-footer { padding-top:13px; }
  .db-footer { align-items:flex-start; flex-direction:column; }
}
@media (max-width:430px) {
  .db-hero-heading p { font-size:12px; }
  .db-hero-meta { flex-basis:100%; }
  .db-metric-card { padding:12px; }
  .db-metric-title { max-width:110px; }
  .db-metric-number { font-size:22px; }
  .db-chart-summary { gap:11px; }
  .db-chart-summary > div { min-width:75px; }
  .db-chart-summary span { font-size:8px; }
  .db-chart-summary strong { font-size:12px; }
  .db-panel-header { gap:8px; }
  .db-chart-switcher button { padding:6px; }
  .db-footer-right { flex-direction:column; gap:9px; }
}
@media (prefers-reduced-motion:reduce) {
  .dashboard-pro *, .dashboard-pro *::before, .dashboard-pro *::after {
    animation-duration:.01ms!important;
    animation-iteration-count:1!important;
    scroll-behavior:auto!important;
    transition-duration:.01ms!important;
  }
}
`;
