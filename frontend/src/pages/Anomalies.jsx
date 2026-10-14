
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Thermometer,
  Waves,
  X,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from "recharts";

import { api } from "../services/api";

const PAGE_SIZE = 10;
const SAMPLE_LIMIT = 500;
const THRESHOLD = 2;

const CHART_COLORS = {
  positive: "#ff7085",
  negative: "#65a8ff",
  cyan: "#42d9e8",
  green: "#53dfb0",
};

function getAnomalyType(value) {
  const anomaly = Number(value);

  if (!Number.isFinite(anomaly)) return "unavailable";
  if (anomaly >= THRESHOLD) return "positive";
  if (anomaly <= -THRESHOLD) return "negative";

  return "other";
}

function formatNumber(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
}

function formatCoordinate(value, suffix) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${Math.abs(number).toFixed(3)}°${number < 0 ? (suffix === "N" ? "S" : "W") : suffix}`;
}

function downloadCSV(rows) {
  if (!rows.length) return;

  const columns = [
    "id",
    "observation_time",
    "latitude",
    "longitude",
    "sea_surface_temperature",
    "temperature_anomaly",
    "source",
  ];

  const escapeCSV = (value) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const content = [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => escapeCSV(row[column])).join(",")
    ),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "oceanmind-anomaly-records.csv";
  link.click();

  URL.revokeObjectURL(url);
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "cyan",
  index = 0,
}) {
  return (
    <article
      className={`an-stat-card an-tone-${tone}`}
      style={{ "--card-index": index }}
    >
      <div className="an-stat-top">
        <span className="an-stat-label">{label}</span>
        <span className="an-stat-icon">
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>

      <div className="an-stat-value">{value}</div>

      <div className="an-stat-detail">{detail}</div>

      <div className="an-stat-glow" />
    </article>
  );
}

function AnomalyBadge({ type }) {
  const config = {
    positive: {
      label: "Positive flag",
      icon: ArrowUpRight,
    },
    negative: {
      label: "Negative flag",
      icon: ArrowDownRight,
    },
    other: {
      label: "Below threshold",
      icon: CheckCircle2,
    },
    unavailable: {
      label: "Unavailable",
      icon: AlertTriangle,
    },
  };

  const item = config[type] || config.unavailable;
  const Icon = item.icon;

  return (
    <span className={`anomaly-badge ${type}`}>
      <Icon size={13} />
      {item.label}
    </span>
  );
}

export default function Anomalies({
  refreshKey = 0,
  theme,
  onThemeChange,
}) {
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
const lightMode = theme === "light";
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadAnomalies = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [summaryData, recordsData] = await Promise.all([
        api.anomalySummary(),
        api.anomalies(SAMPLE_LIMIT, 0),
      ]);

      const rows = Array.isArray(recordsData)
        ? recordsData
        : recordsData?.anomalies ??
          recordsData?.records ??
          recordsData?.observations ??
          [];

      setSummary(summaryData);
      setRecords(rows);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load anomaly records. Check that the backend is running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnomalies();
  }, [loadAnomalies, refreshKey]);

  const counts = useMemo(() => {
    return records.reduce(
      (result, row) => {
        const type = getAnomalyType(row.temperature_anomaly);

        if (type === "positive") result.positive += 1;
        else if (type === "negative") result.negative += 1;
        else if (type === "other") result.other += 1;
        else result.unavailable += 1;

        return result;
      },
      {
        positive: 0,
        negative: 0,
        other: 0,
        unavailable: 0,
      }
    );
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((row) => {
      const type = getAnomalyType(row.temperature_anomaly);

      const matchesFilter =
        filter === "all" ||
        (filter === "positive" && type === "positive") ||
        (filter === "negative" && type === "negative");

      const searchableText = [
        row.id,
        row.observation_time,
        row.latitude,
        row.longitude,
        row.sea_surface_temperature,
        row.temperature_anomaly,
        row.source,
      ]
        .filter((value) => value != null)
        .join(" ")
        .toLowerCase();

      return matchesFilter && searchableText.includes(query);
    });
  }, [records, search, filter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const pageRecords = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;

    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, safePage]);

  const chartRecords = useMemo(() => {
    return records
      .map((row, index) => ({
        ...row,
        sample: index + 1,
        anomaly: Number(row.temperature_anomaly),
        absoluteAnomaly: Math.abs(Number(row.temperature_anomaly)),
      }))
      .filter(
        (row) =>
          Number.isFinite(row.anomaly) &&
          (filter === "all" ||
            (filter === "positive" && row.anomaly >= THRESHOLD) ||
            (filter === "negative" && row.anomaly <= -THRESHOLD))
      )
      .slice(0, 40)
      .map((row) => ({
        sample: `#${row.sample}`,
        anomaly: Number(row.anomaly.toFixed(2)),
        magnitude: Number(row.absoluteAnomaly.toFixed(2)),
      }));
  }, [records, filter]);

  const distributionData = useMemo(
    () => [
      {
        name: "Positive",
        value: counts.positive,
        fill: CHART_COLORS.positive,
      },
      {
        name: "Negative",
        value: counts.negative,
        fill: CHART_COLORS.negative,
      },
    ],
    [counts]
  );

  const totalFlags = Number(summary?.anomaly_count ?? records.length);

  const averageFlagged = Number(
    summary?.average_flagged_anomaly_celsius
  );

  const maximumAnomaly = Number(
    summary?.maximum_absolute_anomaly_celsius
  );

  const changeFilter = (value) => {
    setFilter(value);
    setCurrentPage(1);
  };

  const changeSearch = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearch("");
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className={`anomalies-page ${lightMode ? "an-light" : ""}`}>
        <style>{ANOMALIES_CSS}</style>

        <div className="an-loading-screen">
          <div className="an-loading-orb">
            <Waves size={34} />
          </div>

          <h2>Initializing anomaly intelligence</h2>

          <p>Connecting to OceanMind data services…</p>

          <div className="an-loading-track">
            <span />
          </div>

          <div className="an-skeleton-grid">
            {[1, 2, 3, 4].map((item) => (
              <div className="an-skeleton" key={item} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`anomalies-page ${lightMode ? "an-light" : ""}`}>
      <style>{ANOMALIES_CSS}</style>

      {/* Header */}
      <header className="an-hero">
        <div className="an-hero-background">
          <div className="an-hero-grid" />
          <div className="an-hero-orb an-orb-one" />
          <div className="an-hero-orb an-orb-two" />
          <div className="an-hero-wave" />
        </div>

        <div className="an-hero-content">
          <div className="an-eyebrow">
            <span className="an-live-dot" />
            OCEANMIND / INTELLIGENCE CENTER
          </div>

          <div className="an-hero-heading-row">
            <div>
              <h1>
                Anomaly <span>Intelligence</span>
              </h1>

              <p className="an-hero-description">
                Explore unusual sea-surface temperature measurements,
                investigate flagged observations, and examine their
                geographic and temporal context.
              </p>
            </div>

            <div className="an-hero-actions">
             <button
  className="an-button an-button-ghost"
  onClick={() =>
    onThemeChange?.(lightMode ? "dark" : "light")
  }
  title={`Switch to ${lightMode ? "dark" : "light"} theme`}
  aria-label={`Switch to ${lightMode ? "dark" : "light"} theme`}
>
  <Sparkles size={16} />
  {lightMode ? "Ocean theme" : "Light theme"}
</button>

              <button
                className="an-button an-button-primary"
                onClick={() => loadAnomalies(true)}
                disabled={refreshing}
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "an-spin" : ""}
                />
                Refresh data
              </button>
            </div>
          </div>

          <div className="an-hero-meta">
            <span>
              <Database size={14} />
              Live backend data
            </span>

            <span>
              <Activity size={14} />
              Threshold: ±{THRESHOLD.toFixed(1)}°C
            </span>

            <span>
              <Clock3 size={14} />
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString("en-IN")}`
                : "Waiting for data"}
            </span>
          </div>
        </div>
      </header>

      {error && (
        <div className="an-error-banner">
          <AlertTriangle size={18} />

          <div>
            <strong>Data connection issue</strong>
            <p>{error}</p>
          </div>

          <button
            className="an-icon-button"
            onClick={() => loadAnomalies(true)}
            aria-label="Retry loading"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      {/* Metric cards */}
      <section className="an-stats-grid">
        <StatCard
          icon={Database}
          label="Database threshold flags"
          value={totalFlags.toLocaleString("en-IN")}
          detail="Total flags reported by the API"
          tone="cyan"
          index={0}
        />

        <StatCard
          icon={ArrowUpRight}
          label="Positive flags"
          value={counts.positive.toLocaleString("en-IN")}
          detail={`+${THRESHOLD.toFixed(1)}°C or higher in loaded sample`}
          tone="red"
          index={1}
        />

        <StatCard
          icon={ArrowDownRight}
          label="Negative flags"
          value={counts.negative.toLocaleString("en-IN")}
          detail={`−${THRESHOLD.toFixed(1)}°C or lower in loaded sample`}
          tone="blue"
          index={2}
        />

        <StatCard
          icon={Thermometer}
          label="Maximum absolute anomaly"
          value={
            Number.isFinite(maximumAnomaly)
              ? `${formatNumber(maximumAnomaly)}°C`
              : "—"
          }
          detail="Largest absolute value reported by the API"
          tone="purple"
          index={3}
        />
      </section>

      {/* Context banner */}
      <section className="an-method-banner">
        <div className="an-method-icon">
          <AlertTriangle size={20} />
        </div>

        <div className="an-method-copy">
          <strong>Threshold-based screening</strong>
          <p>
            A record is flagged when its temperature anomaly is at
            least +2°C or at most −2°C. These are screening indicators,
            not confirmed ocean hazards or trained ML predictions.
          </p>
        </div>

        <div className="an-method-value">
          <span>Screening rule</span>
          <strong>±2.0°C</strong>
        </div>
      </section>

      {/* Charts */}
      <section className="an-chart-grid">
        <article className="an-panel an-chart-panel">
          <div className="an-panel-header">
            <div>
              <div className="an-panel-kicker">
                <BarChart3 size={14} />
                RECORD ANALYSIS
              </div>

              <h2>Anomaly magnitude profile</h2>

              <p>
                Temperature anomalies from the first 40 matching
                records returned by the API.
              </p>
            </div>

            <span className="an-chart-tag">
              {chartRecords.length} samples
            </span>
          </div>

          <div className="an-chart-legend">
            <span>
              <i className="an-legend-dot positive-dot" />
              Positive anomaly
            </span>

            <span>
              <i className="an-legend-dot negative-dot" />
              Negative anomaly
            </span>
          </div>

          <div className="an-chart-canvas an-magnitude-chart">
            {chartRecords.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRecords}
                  margin={{
                    top: 12,
                    right: 8,
                    left: -14,
                    bottom: 2,
                  }}
                >
                  <CartesianGrid
                    stroke="var(--an-grid)"
                    strokeDasharray="4 6"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="sample"
                    stroke="var(--an-muted)"
                    tick={{ fill: "var(--an-muted)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />

                  <YAxis
                    stroke="var(--an-muted)"
                    tick={{ fill: "var(--an-muted)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}°`}
                  />

                  <ReferenceLine
                    y={0}
                    stroke="var(--an-muted)"
                    strokeDasharray="3 3"
                  />

                  <ReferenceLine
                    y={THRESHOLD}
                    stroke={CHART_COLORS.positive}
                    strokeDasharray="5 5"
                  />

                  <ReferenceLine
                    y={-THRESHOLD}
                    stroke={CHART_COLORS.negative}
                    strokeDasharray="5 5"
                  />

                  <Tooltip
                    cursor={{ fill: "var(--an-tooltip-cursor)" }}
                    contentStyle={{
                      background: "var(--an-tooltip-bg)",
                      border: "1px solid var(--an-border)",
                      borderRadius: 12,
                      color: "var(--an-text)",
                      boxShadow: "0 12px 40px #0002",
                    }}
                    labelStyle={{
                      color: "var(--an-muted)",
                      marginBottom: 6,
                    }}
                    formatter={(value) => [
                      `${formatNumber(value)}°C`,
                      "Temperature anomaly",
                    ]}
                  />

                  <Bar
                    dataKey="anomaly"
                    name="Temperature anomaly"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive
                    animationDuration={850}
                    animationEasing="ease-out"
                  >
                    {chartRecords.map((row, index) => (
                      <Cell
                        key={`${row.sample}-${index}`}
                        fill={
                          row.anomaly >= THRESHOLD
                            ? CHART_COLORS.positive
                            : row.anomaly <= -THRESHOLD
                              ? CHART_COLORS.negative
                              : CHART_COLORS.cyan
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="an-chart-empty">
                No matching anomaly measurements.
              </div>
            )}
          </div>

          <div className="an-chart-footnote">
            <span className="an-footnote-line" />
            <span>
              Dashed lines indicate the ±2°C screening thresholds.
            </span>
          </div>
        </article>

        <article className="an-panel an-distribution-panel">
          <div className="an-panel-header">
            <div>
              <div className="an-panel-kicker">
                <Activity size={14} />
                FLAG DISTRIBUTION
              </div>

              <h2>Positive vs negative</h2>

              <p>
                Classification of the loaded flagged-record sample.
              </p>
            </div>
          </div>

          <div className="an-donut-wrap">
            {records.length ? (
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
                      outerRadius="86%"
                      paddingAngle={5}
                      stroke="none"
                      isAnimationActive
                      animationDuration={1000}
                    >
                      {distributionData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.fill}
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      contentStyle={{
                        background: "var(--an-tooltip-bg)",
                        border: "1px solid var(--an-border)",
                        borderRadius: 12,
                        color: "var(--an-text)",
                      }}
                      formatter={(value, name) => [
                        Number(value).toLocaleString("en-IN"),
                        name,
                      ]}
                    />

                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{
                        fontSize: 11,
                        color: "var(--an-muted)",
                        paddingTop: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="an-donut-center">
                  <span>LOADED SAMPLE</span>
                  <strong>
                    {records.length.toLocaleString("en-IN")}
                  </strong>
                  <small>flagged records</small>
                </div>
              </>
            ) : (
              <div className="an-chart-empty">
                No records available.
              </div>
            )}
          </div>

          <div className="an-distribution-stats">
            <div>
              <span className="an-distribution-dot positive-dot" />
              <div>
                <span>Positive</span>
                <strong>
                  {counts.positive.toLocaleString("en-IN")}
                </strong>
              </div>
              <span className="an-distribution-percent">
                {records.length
                  ? `${((counts.positive / records.length) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>

            <div>
              <span className="an-distribution-dot negative-dot" />
              <div>
                <span>Negative</span>
                <strong>
                  {counts.negative.toLocaleString("en-IN")}
                </strong>
              </div>
              <span className="an-distribution-percent">
                {records.length
                  ? `${((counts.negative / records.length) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          </div>

          <div className="an-distribution-note">
            {Number.isFinite(averageFlagged) ? (
              <>
                <Thermometer size={15} />
                API-reported mean anomaly:{" "}
                <strong>{formatNumber(averageFlagged)}°C</strong>
              </>
            ) : (
              <>
                <Activity size={15} />
                Distribution is based on loaded records.
              </>
            )}
          </div>
        </article>
      </section>

      {/* Records table */}
      <section className="an-panel an-records-panel">
        <div className="an-records-heading">
          <div>
            <div className="an-panel-kicker">
              <Database size={14} />
              OBSERVATION EXPLORER
            </div>

            <h2>Flagged observations</h2>

            <p>
              Search measurements, inspect coordinates, and export
              the currently filtered results.
            </p>
          </div>

          <button
            className="an-button an-button-secondary"
            onClick={() => downloadCSV(filteredRecords)}
            disabled={!filteredRecords.length}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        <div className="an-table-toolbar">
          <div className="an-search-box">
            <Search size={17} />

            <input
              type="search"
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Search coordinates, dates, record ID…"
              aria-label="Search anomaly records"
            />

            {search && (
              <button
                className="an-clear-search"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="an-filter-group">
            <span className="an-filter-icon">
              <SlidersHorizontal size={15} />
              Filter
            </span>

            {[
              { value: "all", label: "All flagged records" },
              { value: "positive", label: "Positive ≥ +2°C" },
              { value: "negative", label: "Negative ≤ −2°C" },
            ].map((option) => (
              <button
                key={option.value}
                className={`an-filter-button ${
                  filter === option.value ? "active" : ""
                }`}
                onClick={() => changeFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="an-table-summary">
          <span>
            Showing{" "}
            <strong>{filteredRecords.length.toLocaleString("en-IN")}</strong>{" "}
            matching loaded records
          </span>

          <span>
            <i className="an-live-dot" />
            {records.length.toLocaleString("en-IN")} records loaded from API
          </span>
        </div>

        <div className="an-table-scroll">
          <table className="an-data-table">
            <thead>
              <tr>
                <th>Observation</th>
                <th>Coordinates</th>
                <th>Sea temperature</th>
                <th>Temperature anomaly</th>
                <th>Classification</th>
              </tr>
            </thead>

            <tbody>
              {pageRecords.map((row, index) => {
                const anomaly = Number(row.temperature_anomaly);
                const type = getAnomalyType(anomaly);
                const temperature = Number(
                  row.sea_surface_temperature
                );

                return (
                  <tr
                    key={row.id ?? `${row.observation_time}-${index}`}
                    style={{ "--row-index": index }}
                  >
                    <td>
                      <div className="an-observation-cell">
                        <span className="an-record-indicator">
                          <Waves size={15} />
                        </span>

                        <div>
                          <strong>
                            {row.id != null ? `OBS-${row.id}` : "Observation"}
                          </strong>

                          <span>{formatDate(row.observation_time)}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="an-coordinate-cell">
                        <span>
                          {formatCoordinate(row.latitude, "N")}
                        </span>
                        <span>
                          {formatCoordinate(row.longitude, "E")}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="an-temperature-value">
                        {Number.isFinite(temperature)
                          ? `${formatNumber(temperature)}°C`
                          : "—"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`an-anomaly-value ${type}`}
                      >
                        {Number.isFinite(anomaly)
                          ? `${anomaly > 0 ? "+" : ""}${formatNumber(anomaly)}°C`
                          : "—"}
                      </span>
                    </td>

                    <td>
                      <AnomalyBadge type={type} />
                    </td>
                  </tr>
                );
              })}

              {!pageRecords.length && (
                <tr>
                  <td colSpan={5}>
                    <div className="an-empty-state">
                      <Search size={25} />

                      <strong>No matching observations</strong>

                      <span>
                        Try a different search term or filter.
                      </span>

                      {(search || filter !== "all") && (
                        <button
                          className="an-button an-button-secondary"
                          onClick={() => {
                            clearSearch();
                            changeFilter("all");
                          }}
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="an-pagination">
          <span className="an-pagination-info">
            Page <strong>{safePage}</strong> of{" "}
            <strong>{totalPages}</strong>
          </span>

          <div className="an-pagination-actions">
            <button
              className="an-page-button"
              disabled={safePage <= 1}
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
              Previous
            </button>

            <button
              className="an-page-button"
              disabled={safePage >= totalPages}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1)
                )
              }
              aria-label="Next page"
            >
              Next
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* Methodology and source */}
      <footer className="an-footer">
        <div className="an-footer-icon">
          <CheckCircle2 size={17} />
        </div>

        <div>
          <strong>Data integrity & methodology</strong>

          <p>
            Source: imported Ocean_sst.csv dataset. The API reports
            {` ${totalFlags.toLocaleString("en-IN")} `}threshold flags.
            The table, filters, and distribution charts use the first{" "}
            {records.length.toLocaleString("en-IN")} flagged records
            returned by the current API request. Counts in this sample
            are not presented as full-dataset positive/negative totals.
          </p>
        </div>

        <span className="an-footer-status">
          <i />
          API-backed
        </span>
      </footer>
    </div>
  );
}

const ANOMALIES_CSS = `
.anomalies-page {
  --an-bg: #07111f;
  --an-panel: rgba(13, 26, 43, .88);
  --an-panel-solid: #0d1a2b;
  --an-panel-hover: #12243a;
  --an-border: rgba(142, 173, 208, .15);
  --an-text: #eaf3ff;
  --an-muted: #8da2bb;
  --an-cyan: #42d9e8;
  --an-blue: #65a8ff;
  --an-red: #ff7085;
  --an-green: #53dfb0;
  --an-purple: #b39aff;
  --an-grid: rgba(142, 173, 208, .12);
  --an-tooltip-bg: #0b1727;
  --an-tooltip-cursor: rgba(66, 217, 232, .07);
  color: var(--an-text);
  font-family: inherit;
  min-width: 0;
  padding: 0 0 28px;
  animation: an-page-enter .65s cubic-bezier(.2,.75,.25,1) both;
}

.anomalies-page * { box-sizing: border-box; }
.anomalies-page button,
.anomalies-page input { font: inherit; }
.anomalies-page button { -webkit-tap-highlight-color: transparent; }
.anomalies-page button:focus-visible,
.anomalies-page input:focus-visible {
  outline: 2px solid var(--an-cyan);
  outline-offset: 3px;
}

.an-light {
  --an-bg: #f1f6fc;
  --an-panel: rgba(255,255,255,.94);
  --an-panel-solid: #fff;
  --an-panel-hover: #f3f8ff;
  --an-border: rgba(31, 63, 100, .13);
  --an-text: #14273d;
  --an-muted: #647991;
  --an-cyan: #087f98;
  --an-blue: #276dc4;
  --an-red: #d94461;
  --an-green: #13845d;
  --an-purple: #7554c8;
  --an-grid: rgba(31, 63, 100, .12);
  --an-tooltip-bg: #fff;
  --an-tooltip-cursor: rgba(8,127,152,.06);
}

@keyframes an-page-enter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes an-orb-float {
  0%,100% { transform: translate3d(0,0,0) scale(1); }
  50% { transform: translate3d(12px,-15px,0) scale(1.04); }
}
@keyframes an-wave-drift {
  from { transform: translateX(0); }
  to { transform: translateX(-50px); }
}
@keyframes an-live-pulse {
  0% { box-shadow: 0 0 0 0 rgba(83,223,176,.6); }
  70% { box-shadow: 0 0 0 7px rgba(83,223,176,0); }
  100% { box-shadow: 0 0 0 0 rgba(83,223,176,0); }
}
@keyframes an-card-enter {
  from { opacity: 0; transform: translateY(14px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes an-loading {
  from { transform: translateX(-110%); }
  to { transform: translateX(220%); }
}
@keyframes an-spin { to { transform: rotate(360deg); } }

.an-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(91, 186, 222, .18);
  border-radius: 24px;
  padding: clamp(24px, 3.2vw, 42px);
  margin-bottom: 23px;
  background:
    radial-gradient(ellipse at 85% 5%, rgba(24, 115, 174, .23), transparent 38%),
    linear-gradient(115deg, #091726 0%, #0a1b2f 52%, #0b2439 100%);
  box-shadow: 0 18px 55px rgba(0,0,0,.15);
}
.an-hero-background { position:absolute; inset:0; z-index:-1; pointer-events:none; }
.an-hero-grid {
  position:absolute; inset:0;
  background-image:
    linear-gradient(rgba(92,191,222,.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(92,191,222,.055) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: linear-gradient(90deg, black, transparent 95%);
}
.an-hero-orb {
  position:absolute; border-radius:50%; filter:blur(1px);
  animation: an-orb-float 9s ease-in-out infinite;
}
.an-orb-one {
  width:260px; height:260px; right:7%; top:-175px;
  background:radial-gradient(circle, rgba(66,217,232,.17), transparent 70%);
}
.an-orb-two {
  width:230px; height:230px; right:28%; bottom:-205px;
  background:radial-gradient(circle, rgba(87,152,255,.15), transparent 70%);
  animation-delay:-4s;
}
.an-hero-wave {
  position:absolute; right:-5%; bottom:-40px; width:65%; height:90px;
  border-top:1px solid rgba(66,217,232,.25);
  border-radius:50%;
  box-shadow: 0 -12px 0 -11px rgba(66,217,232,.15),
              0 -25px 0 -24px rgba(66,217,232,.12);
  animation: an-wave-drift 7s ease-in-out infinite alternate;
}
.an-hero-content { position:relative; z-index:1; }
.an-eyebrow {
  display:flex; align-items:center; gap:10px;
  color:#89c9dd; font-size:10px; font-weight:800; letter-spacing:2px;
  margin-bottom:22px;
}
.an-live-dot {
  display:inline-block; flex:none; width:7px; height:7px;
  border-radius:50%; background:#53dfb0;
  box-shadow:0 0 12px rgba(83,223,176,.4);
  animation:an-live-pulse 2.1s infinite;
}
.an-hero-heading-row {
  display:flex; justify-content:space-between; align-items:flex-start;
  gap:28px;
}
.an-hero h1 {
  margin:0; font-size:clamp(30px, 4vw, 46px);
  line-height:1.12; font-weight:760; letter-spacing:-1.7px;
  color:#f0f7ff;
}
.an-hero h1 span {
  color:#59dce9;
  background:linear-gradient(100deg,#62e4e7,#76b9ff);
  background-clip:text; -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
}
.an-hero-description {
  max-width:690px; color:#a4b8ce; font-size:13px;
  line-height:1.85; margin:15px 0 0;
}
.an-hero-actions { display:flex; gap:9px; flex-wrap:wrap; }
.an-button {
  display:inline-flex; justify-content:center; align-items:center; gap:8px;
  min-height:39px; border:1px solid transparent; border-radius:11px;
  padding:9px 13px; cursor:pointer; font-size:11px!important;
  font-weight:700; white-space:nowrap;
  transition:transform .2s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.an-button:hover:not(:disabled) { transform:translateY(-2px); }
.an-button:disabled { opacity:.45; cursor:not-allowed; }
.an-button-primary {
  color:#04131d; background:linear-gradient(115deg,#54dce8,#72b9ff);
  box-shadow:0 6px 22px rgba(66,217,232,.13);
}
.an-button-primary:hover:not(:disabled) { box-shadow:0 8px 26px rgba(66,217,232,.25); }
.an-button-ghost {
  color:#d2e5f5; background:rgba(255,255,255,.045);
  border-color:rgba(255,255,255,.13);
}
.an-button-ghost:hover { background:rgba(255,255,255,.09); }
.an-button-secondary {
  color:var(--an-text); background:var(--an-panel-hover);
  border-color:var(--an-border);
}
.an-button-secondary:hover:not(:disabled) { border-color:var(--an-cyan); }
.an-spin { animation:an-spin 1s linear infinite; }
.an-hero-meta {
  display:flex; flex-wrap:wrap; gap:18px; margin-top:26px; padding-top:18px;
  border-top:1px solid rgba(180,215,240,.12);
}
.an-hero-meta span {
  display:inline-flex; align-items:center; gap:7px;
  color:#92abc3; font-size:10px;
}
.an-hero-meta svg { color:#5ecddf; }

.an-error-banner {
  display:flex; align-items:center; gap:14px; padding:15px 17px;
  margin-bottom:18px; border-radius:13px;
  border:1px solid rgba(255,112,133,.32);
  background:rgba(255,112,133,.07); color:var(--an-red);
}
.an-error-banner > div { flex:1; min-width:0; }
.an-error-banner strong { font-size:12px; }
.an-error-banner p { color:var(--an-muted); font-size:11px; margin:5px 0 0; overflow-wrap:anywhere; }
.an-icon-button {
  display:grid; place-items:center; width:35px; height:35px;
  color:var(--an-text); background:var(--an-panel);
  border:1px solid var(--an-border); border-radius:10px; cursor:pointer;
}

.an-stats-grid {
  display:grid; grid-template-columns:repeat(4,minmax(0,1fr));
  gap:14px; margin-bottom:20px;
}
.an-stat-card {
  position:relative; overflow:hidden; min-width:0;
  padding:19px 19px 17px; border:1px solid var(--an-border);
  border-radius:17px; background:var(--an-panel);
  box-shadow:0 7px 24px rgba(0,0,0,.06);
  animation:an-card-enter .55s cubic-bezier(.2,.75,.25,1) both;
  animation-delay:calc(var(--card-index,0) * 90ms);
  transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease;
}
.an-stat-card:hover {
  transform:translateY(-4px);
  border-color:rgba(66,217,232,.35);
  box-shadow:0 15px 34px rgba(0,0,0,.12);
}
.an-stat-top { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.an-stat-label { color:var(--an-muted); font-size:11px; line-height:1.5; font-weight:600; }
.an-stat-icon {
  width:35px; height:35px; flex:none; display:grid; place-items:center;
  border-radius:11px; color:var(--an-cyan);
  background:rgba(66,217,232,.10); border:1px solid rgba(66,217,232,.13);
}
.an-tone-red .an-stat-icon { color:var(--an-red); background:rgba(255,112,133,.1); border-color:rgba(255,112,133,.16); }
.an-tone-blue .an-stat-icon { color:var(--an-blue); background:rgba(101,168,255,.1); border-color:rgba(101,168,255,.16); }
.an-tone-purple .an-stat-icon { color:var(--an-purple); background:rgba(179,154,255,.1); border-color:rgba(179,154,255,.16); }
.an-stat-value {
  position:relative; z-index:1; margin:17px 0 6px;
  font-size:clamp(23px,2.3vw,30px); line-height:1.1;
  font-weight:760; letter-spacing:-.9px; overflow-wrap:anywhere;
  font-variant-numeric:tabular-nums;
}
.an-stat-detail { position:relative; z-index:1; color:var(--an-muted); font-size:10px; line-height:1.6; }
.an-stat-glow {
  position:absolute; width:100px; height:100px; right:-50px; bottom:-65px;
  border-radius:50%; background:rgba(66,217,232,.08); filter:blur(12px);
  transition:transform .35s ease;
}
.an-stat-card:hover .an-stat-glow { transform:scale(1.7); }

.an-method-banner {
  display:flex; align-items:center; gap:15px; padding:16px 19px;
  margin-bottom:21px; border:1px solid rgba(255,184,107,.2);
  border-radius:15px; background:linear-gradient(105deg,rgba(255,184,107,.07),rgba(255,184,107,.018));
}
.an-method-icon {
  flex:none; width:40px; height:40px; display:grid; place-items:center;
  color:#ffbf7e; background:rgba(255,184,107,.1); border-radius:12px;
}
.an-method-copy { flex:1; min-width:0; }
.an-method-copy strong { font-size:12px; }
.an-method-copy p { margin:5px 0 0; color:var(--an-muted); font-size:11px; line-height:1.7; }
.an-method-value {
  flex:none; text-align:right; padding-left:19px;
  border-left:1px solid var(--an-border);
}
.an-method-value span { display:block; color:var(--an-muted); font-size:9px; margin-bottom:5px; }
.an-method-value strong { color:#ffbf7e; font-size:17px; font-variant-numeric:tabular-nums; }

.an-chart-grid {
  display:grid; grid-template-columns:minmax(0,1.55fr) minmax(280px,.9fr);
  gap:17px; margin-bottom:21px;
}
.an-panel {
  min-width:0; overflow:hidden; border:1px solid var(--an-border);
  border-radius:18px; background:var(--an-panel);
  box-shadow:0 8px 28px rgba(0,0,0,.055);
}
.an-chart-panel,.an-distribution-panel { padding:22px; }
.an-panel-header {
  display:flex; align-items:flex-start; justify-content:space-between; gap:14px;
}
.an-panel-kicker {
  display:flex; align-items:center; gap:7px; color:var(--an-cyan);
  font-size:9px; font-weight:800; letter-spacing:1.3px; margin-bottom:10px;
}
.an-panel-header h2,.an-records-heading h2 {
  color:var(--an-text); margin:0; font-size:17px;
  line-height:1.35; font-weight:730; letter-spacing:-.35px;
}
.an-panel-header p,.an-records-heading p {
  margin:7px 0 0; color:var(--an-muted); font-size:10px; line-height:1.7;
}
.an-chart-tag {
  flex:none; color:var(--an-cyan); background:rgba(66,217,232,.08);
  border:1px solid rgba(66,217,232,.14); border-radius:8px;
  padding:6px 8px; font-size:9px; font-weight:700;
}
.an-chart-legend { display:flex; gap:16px; flex-wrap:wrap; margin-top:22px; }
.an-chart-legend span { display:inline-flex; align-items:center; gap:7px; color:var(--an-muted); font-size:10px; }
.an-legend-dot,.an-distribution-dot { display:inline-block; width:7px; height:7px; border-radius:50%; }
.positive-dot { background:var(--an-red); }
.negative-dot { background:var(--an-blue); }
.an-chart-canvas { width:100%; min-width:0; height:270px; margin-top:8px; }
.an-magnitude-chart { height:290px; }
.an-chart-footnote { display:flex; align-items:center; gap:9px; margin-top:10px; color:var(--an-muted); font-size:9px; line-height:1.6; }
.an-footnote-line { width:20px; border-top:1px dashed var(--an-muted); flex:none; }
.an-chart-empty {
  display:flex; align-items:center; justify-content:center;
  min-height:220px; padding:25px; text-align:center;
  color:var(--an-muted); font-size:12px;
}
.an-donut-wrap { height:260px; position:relative; margin-top:8px; }
.an-donut-center {
  pointer-events:none; position:absolute; left:50%; top:43%;
  transform:translate(-50%,-50%); display:flex; flex-direction:column;
  align-items:center; text-align:center; width:120px;
}
.an-donut-center span { color:var(--an-muted); font-size:8px; font-weight:800; letter-spacing:1px; }
.an-donut-center strong { font-size:26px; line-height:1.4; letter-spacing:-.8px; font-variant-numeric:tabular-nums; }
.an-donut-center small { color:var(--an-muted); font-size:9px; }
.an-distribution-stats { display:grid; gap:12px; margin-top:3px; }
.an-distribution-stats > div { display:flex; align-items:center; gap:10px; }
.an-distribution-stats > div > div { display:flex; flex:1; flex-direction:column; gap:3px; }
.an-distribution-stats > div > div span { color:var(--an-muted); font-size:10px; }
.an-distribution-stats strong { color:var(--an-text); font-size:14px; font-variant-numeric:tabular-nums; }
.an-distribution-percent { color:var(--an-muted); font-size:11px; font-variant-numeric:tabular-nums; }
.an-distribution-note {
  display:flex; align-items:center; flex-wrap:wrap; gap:7px;
  margin-top:17px; padding:12px; border-radius:10px;
  background:rgba(66,217,232,.055); border:1px solid var(--an-border);
  color:var(--an-muted); font-size:10px;
}
.an-distribution-note svg { color:var(--an-cyan); }
.an-distribution-note strong { color:var(--an-text); }

.an-records-panel { margin-bottom:20px; }
.an-records-heading {
  display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:23px 22px 18px;
}
.an-records-heading .an-button { flex:none; }
.an-table-toolbar {
  display:flex; flex-wrap:wrap; justify-content:space-between;
  align-items:center; gap:14px; padding:15px 22px;
  border-top:1px solid var(--an-border); border-bottom:1px solid var(--an-border);
  background:rgba(127,155,190,.025);
}
.an-search-box {
  display:flex; align-items:center; gap:9px; min-width:200px;
  width:min(100%,330px); min-height:39px; padding:0 11px;
  color:var(--an-muted); background:var(--an-panel-solid);
  border:1px solid var(--an-border); border-radius:10px;
  transition:border-color .2s ease,box-shadow .2s ease;
}
.an-search-box:focus-within {
  border-color:rgba(66,217,232,.6);
  box-shadow:0 0 0 3px rgba(66,217,232,.07);
}
.an-search-box input {
  width:100%; min-width:0; outline:none; border:0;
  color:var(--an-text); background:transparent; font-size:10px;
}
.an-search-box input::placeholder { color:var(--an-muted); opacity:.8; }
.an-search-box input:focus-visible { outline:none; }
.an-clear-search { display:grid; place-items:center; border:0; color:var(--an-muted); background:none; cursor:pointer; }
.an-filter-group { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.an-filter-icon { display:inline-flex; align-items:center; gap:6px; color:var(--an-muted); font-size:10px; margin-right:3px; }
.an-filter-button {
  min-height:33px; padding:7px 10px; border-radius:8px;
  color:var(--an-muted); border:1px solid transparent;
  background:transparent; font-size:9px!important; font-weight:650;
  cursor:pointer; transition:all .2s ease;
}
.an-filter-button:hover { color:var(--an-text); background:var(--an-panel-hover); }
.an-filter-button.active {
  color:var(--an-cyan); border-color:rgba(66,217,232,.25);
  background:rgba(66,217,232,.09);
}
.an-table-summary {
  display:flex; justify-content:space-between; align-items:center;
  flex-wrap:wrap; gap:9px; padding:14px 22px;
  color:var(--an-muted); font-size:10px;
}
.an-table-summary strong { color:var(--an-text); }
.an-table-summary > span:last-child { display:flex; align-items:center; gap:8px; }
.an-table-summary .an-live-dot { width:6px; height:6px; }
.an-table-scroll { overflow-x:auto; width:100%; }
.an-data-table { width:100%; border-collapse:separate; border-spacing:0; text-align:left; }
.an-data-table th {
  padding:13px 17px; color:var(--an-muted); font-size:9px;
  font-weight:750; white-space:nowrap; letter-spacing:.45px;
  background:rgba(127,155,190,.045); border-top:1px solid var(--an-border);
  border-bottom:1px solid var(--an-border);
}
.an-data-table th:first-child,.an-data-table td:first-child { padding-left:22px; }
.an-data-table th:last-child,.an-data-table td:last-child { padding-right:22px; }
.an-data-table td {
  padding:14px 17px; border-bottom:1px solid var(--an-border);
  color:var(--an-text); font-size:10px; vertical-align:middle;
}
.an-data-table tbody tr {
  animation:an-card-enter .35s ease both;
  animation-delay:calc(var(--row-index,0) * 25ms);
  transition:background .2s ease;
}
.an-data-table tbody tr:hover { background:rgba(66,217,232,.035); }
.an-data-table tbody tr:last-child td { border-bottom:0; }
.an-observation-cell { display:flex; align-items:center; gap:10px; min-width:170px; }
.an-record-indicator {
  display:grid; place-items:center; flex:none; width:32px; height:32px;
  color:var(--an-cyan); background:rgba(66,217,232,.08);
  border:1px solid rgba(66,217,232,.1); border-radius:9px;
}
.an-observation-cell > div { display:flex; flex-direction:column; gap:5px; }
.an-observation-cell strong { font-size:10px; font-weight:750; white-space:nowrap; }
.an-observation-cell span:not(.an-record-indicator) { color:var(--an-muted); font-size:9px; white-space:nowrap; }
.an-coordinate-cell { display:flex; flex-direction:column; gap:4px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.an-coordinate-cell span:first-child { color:var(--an-text); }
.an-coordinate-cell span:last-child { color:var(--an-muted); }
.an-temperature-value,.an-anomaly-value { font-size:11px; font-weight:700; white-space:nowrap; font-variant-numeric:tabular-nums; }
.an-anomaly-value.positive { color:var(--an-red); }
.an-anomaly-value.negative { color:var(--an-blue); }
.an-anomaly-value.other { color:var(--an-green); }
.an-anomaly-value.unavailable { color:var(--an-muted); }
.anomaly-badge {
  display:inline-flex; align-items:center; gap:5px; padding:6px 8px;
  border-radius:7px; white-space:nowrap; font-size:9px; font-weight:700;
}
.anomaly-badge.positive { color:var(--an-red); background:rgba(255,112,133,.09); border:1px solid rgba(255,112,133,.16); }
.anomaly-badge.negative { color:var(--an-blue); background:rgba(101,168,255,.09); border:1px solid rgba(101,168,255,.16); }
.anomaly-badge.other { color:var(--an-green); background:rgba(83,223,176,.08); border:1px solid rgba(83,223,176,.16); }
.anomaly-badge.unavailable { color:var(--an-muted); background:rgba(142,162,187,.08); border:1px solid var(--an-border); }
.an-empty-state {
  min-height:180px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:10px;
  color:var(--an-muted); text-align:center; padding:22px;
}
.an-empty-state > svg { color:var(--an-cyan); }
.an-empty-state strong { color:var(--an-text); font-size:12px; }
.an-empty-state span { font-size:10px; }
.an-empty-state .an-button { margin-top:4px; }
.an-pagination {
  display:flex; align-items:center; justify-content:space-between;
  gap:12px; padding:16px 22px; border-top:1px solid var(--an-border);
}
.an-pagination-info { color:var(--an-muted); font-size:10px; }
.an-pagination-info strong { color:var(--an-text); }
.an-pagination-actions { display:flex; gap:7px; }
.an-page-button {
  display:flex; align-items:center; justify-content:center; gap:6px;
  min-height:34px; padding:7px 10px; color:var(--an-text);
  background:var(--an-panel-solid); border:1px solid var(--an-border);
  border-radius:9px; font-size:10px!important; cursor:pointer;
  transition:border-color .2s ease,background .2s ease;
}
.an-page-button:hover:not(:disabled) { border-color:var(--an-cyan); background:var(--an-panel-hover); }
.an-page-button:disabled { opacity:.35; cursor:not-allowed; }

.an-footer {
  display:flex; align-items:flex-start; gap:12px; padding:17px 19px;
  border:1px solid var(--an-border); border-radius:14px;
  background:var(--an-panel);
}
.an-footer-icon {
  flex:none; display:grid; place-items:center; width:32px; height:32px;
  color:var(--an-green); background:rgba(83,223,176,.09); border-radius:9px;
}
.an-footer > div:nth-child(2) { flex:1; min-width:0; }
.an-footer strong { font-size:11px; }
.an-footer p { margin:6px 0 0; color:var(--an-muted); font-size:10px; line-height:1.75; }
.an-footer-status {
  display:inline-flex; align-items:center; gap:6px; flex:none;
  color:var(--an-green); font-size:9px; font-weight:700;
}
.an-footer-status i { width:6px; height:6px; background:var(--an-green); border-radius:50%; }

.an-loading-screen {
  min-height:480px; display:flex; flex-direction:column;
  align-items:center; justify-content:center; padding:30px 12px;
  text-align:center;
}
.an-loading-orb {
  display:grid; place-items:center; width:70px; height:70px;
  color:var(--an-cyan); border:1px solid rgba(66,217,232,.3);
  border-radius:24px; background:rgba(66,217,232,.08);
  box-shadow:0 0 55px rgba(66,217,232,.1);
  animation:an-orb-float 3s ease-in-out infinite;
}
.an-loading-screen h2 { margin:23px 0 8px; font-size:18px; }
.an-loading-screen p { color:var(--an-muted); font-size:11px; }
.an-loading-track { width:min(300px,80%); height:3px; overflow:hidden; margin-top:16px; border-radius:5px; background:var(--an-border); }
.an-loading-track span { display:block; width:45%; height:100%; border-radius:5px; background:var(--an-cyan); animation:an-loading 1.5s ease-in-out infinite; }
.an-skeleton-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; width:min(100%,900px); margin-top:40px; }
.an-skeleton {
  height:100px; border:1px solid var(--an-border); border-radius:14px;
  background:linear-gradient(100deg,var(--an-panel) 25%,var(--an-panel-hover) 45%,var(--an-panel) 65%);
  background-size:220% 100%; animation:an-loading 1.6s linear infinite;
}

@media (min-width:1500px) {
  .an-stats-grid { gap:18px; }
  .an-stat-card { padding:22px; }
  .an-chart-panel,.an-distribution-panel { padding:26px; }
  .an-chart-canvas { height:310px; }
  .an-magnitude-chart { height:330px; }
}
@media (max-width:1100px) {
  .an-hero-heading-row { flex-direction:column; }
  .an-chart-grid { grid-template-columns:minmax(0,1fr); }
  .an-distribution-panel { display:grid; grid-template-columns:minmax(0,1fr) minmax(220px,.85fr); column-gap:24px; }
  .an-distribution-panel .an-panel-header { grid-column:1/-1; }
  .an-distribution-panel .an-donut-wrap { grid-column:1; grid-row:2/4; }
  .an-distribution-panel .an-distribution-stats { grid-column:2; align-self:center; }
  .an-distribution-panel .an-distribution-note { grid-column:2; align-self:start; }
}
@media (max-width:760px) {
  .an-hero { border-radius:18px; padding:23px 18px; }
  .an-hero h1 { font-size:31px; letter-spacing:-1px; }
  .an-hero-meta { gap:11px; }
  .an-hero-meta span { font-size:9px; }
  .an-stats-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .an-stat-card { padding:15px; border-radius:14px; }
  .an-stat-label { font-size:10px; }
  .an-stat-icon { width:31px; height:31px; }
  .an-stat-value { margin-top:14px; font-size:24px; }
  .an-stat-detail { font-size:9px; }
  .an-method-banner { align-items:flex-start; padding:14px; gap:10px; }
  .an-method-icon { width:34px; height:34px; }
  .an-method-value { padding-left:10px; }
  .an-method-value strong { font-size:14px; }
  .an-method-copy p { font-size:10px; }
  .an-chart-panel,.an-distribution-panel { padding:17px; }
  .an-magnitude-chart { height:245px; }
  .an-distribution-panel { display:block; }
  .an-distribution-panel .an-donut-wrap { height:250px; }
  .an-distribution-panel .an-distribution-stats { margin-top:12px; }
  .an-records-heading { align-items:flex-start; padding:19px 16px 15px; }
  .an-records-heading .an-button { font-size:0!important; padding:10px; min-width:38px; }
  .an-records-heading .an-button svg { flex:none; }
  .an-table-toolbar { padding:13px 15px; }
  .an-search-box { width:100%; }
  .an-filter-group { width:100%; }
  .an-filter-button { flex:1 1 auto; }
  .an-table-summary { padding:12px 15px; }
  .an-data-table th:first-child,.an-data-table td:first-child { padding-left:15px; }
  .an-data-table th:last-child,.an-data-table td:last-child { padding-right:15px; }
  .an-pagination { padding:14px 15px; }
  .an-footer { padding:14px; }
  .an-footer-status { display:none; }
}
@media (max-width:430px) {
  .an-hero-actions { width:100%; }
  .an-hero-actions .an-button { flex:1; }
  .an-method-value { display:none; }
  .an-panel-header h2,.an-records-heading h2 { font-size:15px; }
  .an-chart-tag { font-size:8px; }
  .an-chart-legend { gap:10px; }
  .an-chart-legend span { font-size:9px; }
  .an-pagination-info { font-size:9px; }
  .an-page-button { padding:7px 8px; font-size:9px!important; }
}
@media (prefers-reduced-motion: reduce) {
  .anomalies-page *, .anomalies-page *::before, .anomalies-page *::after {
    animation-duration:.01ms!important;
    animation-iteration-count:1!important;
    scroll-behavior:auto!important;
    transition-duration:.01ms!important;
  }
}
`;
