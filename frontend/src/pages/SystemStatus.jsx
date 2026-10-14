
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  Sun,
  Moon,
  Waves,
  Wifi,
  WifiOff,
  Zap,
  ArrowUpRight,
  Cpu,
  Layers3,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { api } from "../services/api";

const STATUS_COLORS = {
  healthy: "#53dfb0",
  warning: "#ffb86b",
  error: "#ff6b81",
  unknown: "#8da2bb",
};

function firstValue(object, keys, fallback = null) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null) {
      return object[key];
    }
  }
  return fallback;
}

function toRows(response) {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== "object") return [];

  for (const key of [
    "history",
    "jobs",
    "processing_history",
    "processingHistory",
    "records",
    "results",
    "items",
  ]) {
    if (Array.isArray(response[key])) return response[key];
  }

  return [];
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value) {
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString("en-IN")
    : "—";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatus(value) {
  const status = String(value ?? "").toLowerCase();

  if (
    ["healthy", "ok", "connected", "success", "successful", "completed", "ready", "running"].some(
      (item) => status.includes(item)
    )
  ) {
    return "healthy";
  }

  if (
    ["warning", "degraded", "partial", "pending", "queued"].some(
      (item) => status.includes(item)
    )
  ) {
    return "warning";
  }

  if (
    ["error", "failed", "failure", "disconnected", "unhealthy", "offline"].some(
      (item) => status.includes(item)
    )
  ) {
    return "error";
  }

  return "unknown";
}

function StatusPill({ status, children }) {
  return (
    <span className={`ss-pill ${status}`}>
      <span className="ss-pill-dot" />
      {children}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, detail, status, delay = 0 }) {
  return (
    <article
      className="ss-metric ss-animate"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="ss-metric-top">
        <span className="ss-icon-box">
          <Icon size={19} />
        </span>
        <StatusPill status={status || "unknown"}>
          {status === "healthy"
            ? "Operational"
            : status === "warning"
              ? "Attention"
              : status === "error"
                ? "Issue detected"
                : "Checking"}
        </StatusPill>
      </div>

      <div className="ss-metric-label">{label}</div>
      <div className="ss-metric-value">{value}</div>
      <div className="ss-metric-detail">{detail}</div>
    </article>
  );
}

const SYSTEM_STATUS_CSS = `
.ss-page {
  --ss-bg: #07111f;
  --ss-panel: #0d1a2b;
  --ss-panel-2: #101f33;
  --ss-border: #1d3048;
  --ss-text: #e8f1fb;
  --ss-muted: #8da2bb;
  --ss-cyan: #42d9e8;
  --ss-blue: #5798ff;
  --ss-green: #53dfb0;
  --ss-orange: #ffb86b;
  --ss-red: #ff6b81;
  background: var(--ss-bg);
  color: var(--ss-text);
  min-height: 100%;
  padding: 26px;
  border-radius: 18px;
  font-family: inherit;
  transition: background .25s ease, color .25s ease;
}

.ss-page.ss-light {
  --ss-bg: #f2f6fc;
  --ss-panel: #ffffff;
  --ss-panel-2: #f7faff;
  --ss-border: #dce5f0;
  --ss-text: #17263c;
  --ss-muted: #667b95;
  --ss-cyan: #078b9a;
  --ss-blue: #326fce;
  --ss-green: #168b67;
  --ss-orange: #ad6818;
  --ss-red: #d7475d;
}

.ss-page * { box-sizing: border-box; }

.ss-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.ss-breadcrumb {
  color: var(--ss-muted);
  font-size: 12px;
  margin-bottom: 7px;
  letter-spacing: .04em;
}

.ss-breadcrumb strong { color: var(--ss-text); }

.ss-actions {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
}

.ss-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 39px;
  border: 1px solid var(--ss-border);
  background: var(--ss-panel);
  color: var(--ss-text);
  border-radius: 10px;
  padding: 9px 13px;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: transform .2s ease, border-color .2s ease, background .2s ease;
}

.ss-btn:hover {
  transform: translateY(-2px);
  border-color: var(--ss-cyan);
}

.ss-btn:disabled { opacity: .55; cursor: wait; transform: none; }

.ss-title {
  margin: 0;
  font-size: clamp(25px, 3vw, 35px);
  font-weight: 780;
  letter-spacing: -.04em;
  line-height: 1.2;
}

.ss-subtitle {
  color: var(--ss-muted);
  font-size: 13px;
  line-height: 1.7;
  max-width: 700px;
  margin: 10px 0 0;
}

.ss-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid var(--ss-border);
  border-radius: 20px;
  padding: 27px;
  background:
    radial-gradient(ellipse at 90% 10%, rgba(66,217,232,.14), transparent 37%),
    radial-gradient(ellipse at 5% 100%, rgba(87,152,255,.12), transparent 38%),
    var(--ss-panel);
  margin-bottom: 20px;
}

.ss-hero::after {
  content: "";
  position: absolute;
  width: 220px;
  height: 220px;
  right: -65px;
  top: -115px;
  border: 1px solid rgba(66,217,232,.2);
  border-radius: 50%;
  box-shadow: 0 0 0 24px rgba(66,217,232,.025),
              0 0 0 48px rgba(66,217,232,.025);
  animation: ss-orbit 18s linear infinite;
  z-index: -1;
}

.ss-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ss-cyan);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .13em;
  font-weight: 800;
  margin-bottom: 13px;
}

.ss-hero-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 22px;
  padding-top: 17px;
  border-top: 1px solid var(--ss-border);
}

.ss-last-check {
  color: var(--ss-muted);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 7px;
}

.ss-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.ss-metric {
  min-width: 0;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--ss-border);
  background: var(--ss-panel);
  transition: transform .23s ease, border-color .23s ease, box-shadow .23s ease;
}

.ss-metric:hover {
  transform: translateY(-4px);
  border-color: rgba(66,217,232,.42);
  box-shadow: 0 12px 28px rgba(0,0,0,.08);
}

.ss-metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 19px;
  flex-wrap: wrap;
}

.ss-icon-box {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  color: var(--ss-cyan);
  border: 1px solid var(--ss-border);
  background: var(--ss-panel-2);
  border-radius: 12px;
}

.ss-metric-label { color: var(--ss-muted); font-size: 12px; }
.ss-metric-value { font-size: clamp(23px, 2.4vw, 31px); font-weight: 780; margin: 7px 0; letter-spacing: -.035em; overflow-wrap: anywhere; }
.ss-metric-detail { color: var(--ss-muted); font-size: 11px; line-height: 1.6; }

.ss-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  border-radius: 999px;
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 750;
  border: 1px solid var(--ss-border);
  background: var(--ss-panel-2);
  color: var(--ss-muted);
}

.ss-pill-dot {
  width: 6px;
  height: 6px;
  display: inline-block;
  border-radius: 50%;
  background: currentColor;
}

.ss-pill.healthy { color: var(--ss-green); border-color: rgba(83,223,176,.25); }
.ss-pill.warning { color: var(--ss-orange); border-color: rgba(255,184,107,.25); }
.ss-pill.error { color: var(--ss-red); border-color: rgba(255,107,129,.25); }
.ss-pill.unknown { color: var(--ss-muted); }

.ss-section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -.015em;
}

.ss-section-subtitle {
  margin: 6px 0 0;
  color: var(--ss-muted);
  font-size: 11px;
  line-height: 1.6;
}

.ss-grid-two {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr);
  gap: 16px;
  margin-bottom: 18px;
}

.ss-panel {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--ss-border);
  border-radius: 17px;
  background: var(--ss-panel);
  animation: ss-rise .5s ease both;
}

.ss-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.ss-chart { width: 100%; height: 240px; }
.ss-chart-tall { height: 275px; }

.ss-legend {
  display: flex;
  gap: 13px;
  flex-wrap: wrap;
  color: var(--ss-muted);
  font-size: 10px;
  margin-top: 10px;
}

.ss-legend span { display: inline-flex; align-items: center; gap: 6px; }
.ss-legend i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }

.ss-services { display: grid; gap: 12px; }

.ss-service {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px;
  border: 1px solid var(--ss-border);
  background: var(--ss-panel-2);
  border-radius: 13px;
  transition: border-color .2s ease, transform .2s ease;
}

.ss-service:hover { transform: translateX(3px); border-color: var(--ss-cyan); }

.ss-service-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border: 1px solid var(--ss-border);
  border-radius: 11px;
  color: var(--ss-cyan);
}

.ss-service-copy { flex: 1; min-width: 0; }
.ss-service-name { font-size: 12px; font-weight: 720; }
.ss-service-desc { color: var(--ss-muted); font-size: 10px; margin-top: 5px; line-height: 1.5; }
.ss-service-right { text-align: right; }

.ss-mini-value { font-size: 12px; font-weight: 750; margin-top: 6px; }

.ss-progress {
  height: 5px;
  background: var(--ss-border);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 12px;
}

.ss-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--ss-cyan), var(--ss-blue));
  transition: width .7s ease;
}

.ss-db-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 10px;
  margin-top: 14px;
}

.ss-db-stat {
  border: 1px solid var(--ss-border);
  background: var(--ss-panel-2);
  padding: 13px;
  border-radius: 12px;
  min-width: 0;
}

.ss-db-stat-label { color: var(--ss-muted); font-size: 10px; }
.ss-db-stat-value { font-size: 17px; font-weight: 780; margin-top: 7px; overflow-wrap: anywhere; }

.ss-table-wrap { overflow-x: auto; }
.ss-table { width: 100%; border-collapse: collapse; min-width: 600px; }
.ss-table th {
  text-align: left;
  color: var(--ss-muted);
  font-size: 10px;
  font-weight: 750;
  padding: 12px 10px;
  border-bottom: 1px solid var(--ss-border);
  text-transform: uppercase;
  letter-spacing: .055em;
}
.ss-table td {
  padding: 13px 10px;
  border-bottom: 1px solid var(--ss-border);
  font-size: 11px;
  vertical-align: middle;
}
.ss-table tbody tr { transition: background .2s ease; }
.ss-table tbody tr:hover { background: rgba(66,217,232,.045); }
.ss-table tbody tr:last-child td { border-bottom: 0; }

.ss-job-name { font-weight: 700; }
.ss-muted { color: var(--ss-muted); }

.ss-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--ss-muted);
  font-size: 12px;
  line-height: 1.7;
}

.ss-notice {
  border: 1px solid var(--ss-border);
  background: var(--ss-panel-2);
  color: var(--ss-muted);
  border-radius: 12px;
  padding: 13px 15px;
  font-size: 11px;
  line-height: 1.7;
  margin-top: 17px;
}

.ss-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--ss-muted);
  font-size: 10px;
  margin-top: 20px;
  padding: 14px 2px 0;
}

.ss-live-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ss-green);
  box-shadow: 0 0 0 0 rgba(83,223,176,.55);
  animation: ss-pulse 2s infinite;
}

.ss-error {
  color: var(--ss-red);
  font-size: 12px;
  line-height: 1.6;
  padding: 12px 14px;
  border: 1px solid rgba(255,107,129,.25);
  background: rgba(255,107,129,.06);
  border-radius: 11px;
  margin-bottom: 15px;
}

.ss-spin { animation: ss-spin 1.1s linear infinite; }

.ss-skeleton {
  height: 12px;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--ss-panel-2), var(--ss-border), var(--ss-panel-2));
  background-size: 200% 100%;
  animation: ss-shimmer 1.4s infinite linear;
}

@keyframes ss-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ss-orbit { to { transform: rotate(360deg); } }
@keyframes ss-pulse {
  0% { box-shadow: 0 0 0 0 rgba(83,223,176,.5); }
  70% { box-shadow: 0 0 0 7px rgba(83,223,176,0); }
  100% { box-shadow: 0 0 0 0 rgba(83,223,176,0); }
}
@keyframes ss-spin { to { transform: rotate(360deg); } }
@keyframes ss-shimmer { to { background-position: -200% 0; } }

.ss-animate { animation: ss-rise .45s ease both; }

@media(max-width:1100px) {
  .ss-metrics { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .ss-grid-two { grid-template-columns: 1fr; }
}
@media(max-width:650px) {
  .ss-page { padding: 14px; border-radius: 12px; }
  .ss-hero { padding: 19px; }
  .ss-panel { padding: 15px; }
  .ss-metrics { gap: 10px; }
  .ss-metric { padding: 13px; }
  .ss-metric-top { align-items: flex-start; }
  .ss-db-stats { grid-template-columns: 1fr; }
  .ss-actions { width: 100%; }
  .ss-actions .ss-btn { flex: 1; }
}
@media(prefers-reduced-motion:reduce) {
  .ss-page *, .ss-page *::before, .ss-page *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}
`;

export default function SystemStatus({
  theme: globalTheme = "dark",
  onThemeChange,
}) {
  const theme = globalTheme;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [health, setHealth] = useState(null);
  const [database, setDatabase] = useState(null);
  const [history, setHistory] = useState([]);
  const [checkResults, setCheckResults] = useState({
    api: "unknown",
    database: "unknown",
    history: "unknown",
  });
  const [errorMessage, setErrorMessage] = useState("");

  const loadSystemStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setErrorMessage("");

    const [healthResult, databaseResult, historyResult] =
      await Promise.allSettled([
        api.health(),
        api.databaseStatus(),
        api.processingHistory(50),
      ]);

    const nextChecks = {
      api: "unknown",
      database: "unknown",
      history: "unknown",
    };

    if (healthResult.status === "fulfilled") {
      setHealth(healthResult.value);
      nextChecks.api = getStatus(
        firstValue(healthResult.value, ["status", "health"], "unknown")
      );
      if (
        nextChecks.api === "unknown" &&
        healthResult.value &&
        typeof healthResult.value === "object"
      ) {
        nextChecks.api = "healthy";
      }
    } else {
      setHealth(null);
      nextChecks.api = "error";
    }

    if (databaseResult.status === "fulfilled") {
      setDatabase(databaseResult.value);
      nextChecks.database = getStatus(
        firstValue(databaseResult.value, ["status", "database_status"], "unknown")
      );

      if (
        nextChecks.database === "unknown" &&
        databaseResult.value &&
        typeof databaseResult.value === "object"
      ) {
        nextChecks.database = "healthy";
      }
    } else {
      setDatabase(null);
      nextChecks.database = "error";
    }

    if (historyResult.status === "fulfilled") {
      const rows = toRows(historyResult.value);
      setHistory(rows);
      nextChecks.history = "healthy";
    } else {
      setHistory([]);
      nextChecks.history = "error";
    }

    setCheckResults(nextChecks);
    setLastChecked(new Date());

    if (
      healthResult.status === "rejected" &&
      databaseResult.status === "rejected" &&
      historyResult.status === "rejected"
    ) {
      setErrorMessage(
        "OceanMind could not reach its backend endpoints. Check that the FastAPI server is running at http://127.0.0.1:8000."
      );
    } else if (
      healthResult.status === "rejected" ||
      databaseResult.status === "rejected" ||
      historyResult.status === "rejected"
    ) {
      setErrorMessage(
        "Some system checks failed. The page is showing the results that were successfully retrieved."
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadSystemStatus();
  }, [loadSystemStatus]);

  const totalObservations = asNumber(
    firstValue(database, [
      "observations",
      "total_observations",
      "observation_count",
      "records",
    ])
  );

  const processingJobs = asNumber(
    firstValue(database, [
      "processing_jobs",
      "total_jobs",
      "job_count",
      "processing_history_count",
    ])
  );

  const databaseName = firstValue(
    database,
    ["database", "database_name", "name"],
    "OceanMind database"
  );

  const healthyServices = Object.values(checkResults).filter(
    (status) => status === "healthy"
  ).length;

  const serviceChartData = useMemo(
    () => [
      { name: "Operational", value: healthyServices, color: STATUS_COLORS.healthy },
      {
        name: "Attention",
        value: Object.values(checkResults).filter((s) => s === "warning").length,
        color: STATUS_COLORS.warning,
      },
      {
        name: "Unavailable",
        value: Object.values(checkResults).filter((s) => s === "error").length,
        color: STATUS_COLORS.error,
      },
      {
        name: "Not verified",
        value: Object.values(checkResults).filter((s) => s === "unknown").length,
        color: STATUS_COLORS.unknown,
      },
    ].filter((item) => item.value > 0),
    [checkResults, healthyServices]
  );

  const jobsChartData = useMemo(() => {
    return [...history]
      .slice(0, 8)
      .reverse()
      .map((job, index) => {
        const count = asNumber(
          firstValue(job, [
            "records_imported",
            "rows_imported",
            "records_processed",
            "row_count",
            "records",
            "count",
          ])
        );

        return {
          name: String(
            firstValue(job, ["dataset_name", "dataset", "job_name", "name", "operation"], `Job ${index + 1}`)
          ).slice(0, 18),
          records: count ?? 0,
        };
      });
  }, [history]);

  const successfulChecks = Object.values(checkResults).filter(
    (status) => status === "healthy"
  ).length;

  const checkPercentage = Math.round((successfulChecks / 3) * 100);

  const services = [
    {
      name: "Backend API",
      description: "FastAPI health endpoint",
      icon: Server,
      status: checkResults.api,
      detail:
        health && typeof health === "object"
          ? firstValue(health, ["message", "service", "version"], "Health endpoint responded")
          : "No successful health response",
    },
    {
      name: "Database",
      description: "SQLite connectivity and storage",
      icon: Database,
      status: checkResults.database,
      detail: databaseName,
    },
    {
      name: "Processing history",
      description: "Dataset import and job history endpoint",
      icon: Layers3,
      status: checkResults.history,
      detail:
        checkResults.history === "healthy"
          ? `${formatNumber(history.length)} recent entries retrieved`
          : "History endpoint could not be verified",
    },
  ];

  const jobStatusCounts = useMemo(() => {
    const counts = { completed: 0, failed: 0, other: 0 };

    for (const job of history) {
      const raw = String(
        firstValue(job, ["status", "state", "result"], "")
      ).toLowerCase();

      if (["completed", "complete", "success", "successful"].some((s) => raw.includes(s))) {
        counts.completed += 1;
      } else if (["failed", "failure", "error"].some((s) => raw.includes(s))) {
        counts.failed += 1;
      } else {
        counts.other += 1;
      }
    }

    return counts;
  }, [history]);

  return (
    <>
      <style>{SYSTEM_STATUS_CSS}</style>

      <main className={`ss-page ${theme === "light" ? "ss-light" : ""}`}>
        <header className="ss-topbar">
          <div>
            <div className="ss-breadcrumb">
              OceanMind <span> / </span> <strong>System Status</strong>
            </div>
            <h1 className="ss-title">System Status</h1>
            <p className="ss-subtitle">
              Monitor backend availability, database connectivity, and recent
              data-processing activity from your OceanMind environment.
            </p>
          </div>

          <div className="ss-actions">
           <button
  className="ss-btn"
  onClick={() =>
    onThemeChange?.(theme === "dark" ? "light" : "dark")
  }
  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
>
  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
  {theme === "dark" ? "Light theme" : "Dark theme"}
</button>
            <button
              className="ss-btn"
              onClick={() => loadSystemStatus(true)}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? "ss-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh status"}
            </button>
          </div>
        </header>

        <section className="ss-hero">
          <div className="ss-eyebrow">
            <Activity size={14} />
            Infrastructure overview
          </div>
          <h2 className="ss-title" style={{ fontSize: "clamp(22px, 2.5vw, 30px)" }}>
            Your ocean intelligence workspace
          </h2>
          <p className="ss-subtitle">
            A live view of the checks this page can perform against your running
            backend. Status is based on successful endpoint responses, not a
            simulated monitoring service.
          </p>

          <div className="ss-hero-bottom">
            <div className="ss-last-check">
              {loading ? (
                <>
                  <RefreshCw size={14} className="ss-spin" />
                  Checking system endpoints...
                </>
              ) : (
                <>
                  <span className="ss-live-dot" />
                  Last checked: {lastChecked ? lastChecked.toLocaleTimeString("en-IN") : "Not checked"}
                </>
              )}
            </div>
            <StatusPill
              status={
                successfulChecks === 3
                  ? "healthy"
                  : successfulChecks > 0
                    ? "warning"
                    : "error"
              }
            >
              {loading
                ? "Checking"
                : successfulChecks === 3
                  ? "All checks responded"
                  : `${successfulChecks}/3 checks responded`}
            </StatusPill>
          </div>
        </section>

        {errorMessage && (
          <div className="ss-error">
            <CircleAlert size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />
            {errorMessage}
          </div>
        )}

        <section className="ss-metrics">
          <MetricCard
            icon={Wifi}
            label="Backend API"
            value={
              loading
                ? "Checking..."
                : checkResults.api === "healthy"
                  ? "Online"
                  : checkResults.api === "warning"
                    ? "Degraded"
                    : checkResults.api === "error"
                      ? "Offline"
                      : "Unknown"
            }
            detail="GET /health"
            status={checkResults.api}
            delay={0}
          />
          <MetricCard
            icon={Database}
            label="Database"
            value={
              loading
                ? "Checking..."
                : checkResults.database === "healthy"
                  ? "Connected"
                  : checkResults.database === "error"
                    ? "Unavailable"
                    : "Unknown"
            }
            detail={String(databaseName)}
            status={checkResults.database}
            delay={70}
          />
          <MetricCard
            icon={Waves}
            label="Observations stored"
            value={loading ? "…" : formatNumber(totalObservations)}
            detail="Reported by the database status endpoint"
            status={totalObservations !== null ? "healthy" : "unknown"}
            delay={140}
          />
          <MetricCard
            icon={Activity}
            label="Processing jobs"
            value={
              loading
                ? "…"
                : processingJobs !== null
                  ? formatNumber(processingJobs)
                  : formatNumber(history.length)
            }
            detail={
              processingJobs !== null
                ? "Total jobs reported by the database"
                : "Entries returned by processing history"
            }
            status={checkResults.history}
            delay={210}
          />
        </section>

        <section className="ss-grid-two">
          <article className="ss-panel">
            <div className="ss-panel-head">
              <div>
                <h3 className="ss-section-title">Service availability</h3>
                <p className="ss-section-subtitle">
                  Breakdown of the three checks performed by this page
                </p>
              </div>
              <Gauge size={19} color="var(--ss-cyan)" />
            </div>

            <div className="ss-chart">
              {loading ? (
                <div className="ss-empty">Checking service availability…</div>
              ) : serviceChartData.length === 0 ? (
                <div className="ss-empty">No service status data is available yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={serviceChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={61}
                      outerRadius={91}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {serviceChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--ss-panel)",
                        border: "1px solid var(--ss-border)",
                        borderRadius: 10,
                        color: "var(--ss-text)",
                        fontSize: 11,
                      }}
                    />
                    <text
                      x="50%"
                      y="47%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--ss-text)"
                      fontSize="25"
                      fontWeight="750"
                    >
                      {successfulChecks}/3
                    </text>
                    <text
                      x="50%"
                      y="57%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--ss-muted)"
                      fontSize="10"
                    >
                      checks passed
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="ss-legend">
              {serviceChartData.map((item) => (
                <span key={item.name}>
                  <i style={{ background: item.color }} />
                  {item.name}: {item.value}
                </span>
              ))}
            </div>

            <div className="ss-progress">
              <span style={{ width: `${loading ? 0 : checkPercentage}%` }} />
            </div>
            <p className="ss-section-subtitle">
              {loading
                ? "Availability assessment in progress."
                : `${checkPercentage}% of checks returned a successful response.`}
            </p>
          </article>

          <article className="ss-panel">
            <div className="ss-panel-head">
              <div>
                <h3 className="ss-section-title">Service checks</h3>
                <p className="ss-section-subtitle">
                  Endpoint response status and supporting details
                </p>
              </div>
              <ShieldCheck size={19} color="var(--ss-cyan)" />
            </div>

            <div className="ss-services">
              {services.map((service) => {
                const Icon = service.icon;
                return (
                  <div className="ss-service" key={service.name}>
                    <div className="ss-service-icon">
                      <Icon size={18} />
                    </div>
                    <div className="ss-service-copy">
                      <div className="ss-service-name">{service.name}</div>
                      <div className="ss-service-desc">{service.description}</div>
                      <div className="ss-service-desc">{String(service.detail)}</div>
                    </div>
                    <div className="ss-service-right">
                      <StatusPill status={loading ? "unknown" : service.status}>
                        {loading
                          ? "Checking"
                          : service.status === "healthy"
                            ? "Healthy"
                            : service.status === "warning"
                              ? "Warning"
                              : service.status === "error"
                                ? "Failed"
                                : "Unknown"}
                      </StatusPill>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="ss-grid-two">
          <article className="ss-panel">
            <div className="ss-panel-head">
              <div>
                <h3 className="ss-section-title">Recent processing activity</h3>
                <p className="ss-section-subtitle">
                  Record counts from the latest history entries returned by the API
                </p>
              </div>
              <Zap size={19} color="var(--ss-cyan)" />
            </div>

            <div className="ss-chart ss-chart-tall">
              {loading ? (
                <div className="ss-empty">Loading processing history…</div>
              ) : jobsChartData.length === 0 ? (
                <div className="ss-empty">
                  <Clock3 size={22} style={{ marginBottom: 8 }} />
                  <div>No processing-history entries are available.</div>
                  <div>Import a dataset to create a processing record.</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={jobsChartData}
                    margin={{ top: 8, right: 8, left: -18, bottom: 5 }}
                  >
                    <CartesianGrid
                      stroke="var(--ss-border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "var(--ss-muted)", fontSize: 10 }}
                      axisLine={{ stroke: "var(--ss-border)" }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "var(--ss-muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--ss-panel)",
                        border: "1px solid var(--ss-border)",
                        borderRadius: 10,
                        color: "var(--ss-text)",
                        fontSize: 11,
                      }}
                    />
                    <Bar
                      dataKey="records"
                      name="Records processed"
                      fill="var(--ss-cyan)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={42}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="ss-legend">
              <span><i style={{ background: "var(--ss-cyan)" }} />Records reported per history entry</span>
            </div>
          </article>

          <article className="ss-panel">
            <div className="ss-panel-head">
              <div>
                <h3 className="ss-section-title">Processing outcome summary</h3>
                <p className="ss-section-subtitle">
                  Status labels found in the currently loaded history
                </p>
              </div>
              <Cpu size={19} color="var(--ss-cyan)" />
            </div>

            <div className="ss-services">
              <div className="ss-service">
                <div className="ss-service-icon" style={{ color: "var(--ss-green)" }}>
                  <CheckCircle2 size={18} />
                </div>
                <div className="ss-service-copy">
                  <div className="ss-service-name">Completed</div>
                  <div className="ss-service-desc">Entries labelled success or completed</div>
                </div>
                <strong className="ss-mini-value">{formatNumber(jobStatusCounts.completed)}</strong>
              </div>

              <div className="ss-service">
                <div className="ss-service-icon" style={{ color: "var(--ss-red)" }}>
                  <CircleAlert size={18} />
                </div>
                <div className="ss-service-copy">
                  <div className="ss-service-name">Failed</div>
                  <div className="ss-service-desc">Entries labelled failed or error</div>
                </div>
                <strong className="ss-mini-value">{formatNumber(jobStatusCounts.failed)}</strong>
              </div>

              <div className="ss-service">
                <div className="ss-service-icon" style={{ color: "var(--ss-orange)" }}>
                  <Clock3 size={18} />
                </div>
                <div className="ss-service-copy">
                  <div className="ss-service-name">Other / unclassified</div>
                  <div className="ss-service-desc">Other labels or entries without a recognized status</div>
                </div>
                <strong className="ss-mini-value">{formatNumber(jobStatusCounts.other)}</strong>
              </div>
            </div>

            <div className="ss-db-stats">
              <div className="ss-db-stat">
                <div className="ss-db-stat-label">Loaded entries</div>
                <div className="ss-db-stat-value">{formatNumber(history.length)}</div>
              </div>
              <div className="ss-db-stat">
                <div className="ss-db-stat-label">Database records</div>
                <div className="ss-db-stat-value">{formatNumber(totalObservations)}</div>
              </div>
              <div className="ss-db-stat">
                <div className="ss-db-stat-label">Storage name</div>
                <div className="ss-db-stat-value" style={{ fontSize: 12 }}>
                  {String(databaseName).slice(0, 22)}
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="ss-panel">
          <div className="ss-panel-head">
            <div>
              <h3 className="ss-section-title">Recent processing history</h3>
              <p className="ss-section-subtitle">
                Latest entries returned by the processing-history endpoint
              </p>
            </div>
            <button
              className="ss-btn"
              onClick={() => loadSystemStatus(true)}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? "ss-spin" : ""} />
              Reload history
            </button>
          </div>

          {loading ? (
            <div style={{ display: "grid", gap: 12, padding: 12 }}>
              <div className="ss-skeleton" />
              <div className="ss-skeleton" />
              <div className="ss-skeleton" />
            </div>
          ) : history.length === 0 ? (
            <div className="ss-empty">
              <HardDrive size={24} style={{ marginBottom: 9 }} />
              <div>No processing history was returned.</div>
              <div>
                This can mean the history is empty, or the backend uses a different
                response format.
              </div>
            </div>
          ) : (
            <div className="ss-table-wrap">
              <table className="ss-table">
                <thead>
                  <tr>
                    <th>Job / dataset</th>
                    <th>Operation</th>
                    <th>Records</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 10).map((job, index) => {
                    const name = firstValue(
                      job,
                      ["dataset_name", "dataset", "job_name", "name"],
                      `Processing job ${index + 1}`
                    );
                    const operation = firstValue(
                      job,
                      ["operation", "action", "job_type", "type"],
                      "—"
                    );
                    const records = firstValue(
                      job,
                      ["records_imported", "rows_imported", "records_processed", "row_count", "records"],
                      null
                    );
                    const rawStatus = firstValue(
                      job,
                      ["status", "state", "result"],
                      "Unknown"
                    );
                    const normalizedStatus = getStatus(rawStatus);
                    const timestamp = firstValue(
                      job,
                      ["created_at", "processed_at", "timestamp", "started_at", "date"],
                      null
                    );

                    return (
                      <tr key={firstValue(job, ["id", "job_id"], `${name}-${index}`)}>
                        <td>
                          <div className="ss-job-name">{String(name)}</div>
                        </td>
                        <td className="ss-muted">{String(operation)}</td>
                        <td>{records === null ? "—" : formatNumber(records)}</td>
                        <td>
                          <StatusPill status={normalizedStatus}>
                            {String(rawStatus)}
                          </StatusPill>
                        </td>
                        <td className="ss-muted">{formatDate(timestamp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="ss-notice">
          <CircleAlert size={14} style={{ verticalAlign: "middle", marginRight: 7 }} />
          <strong>Monitoring note:</strong> This page checks the API, database status,
          and processing-history endpoints when opened or refreshed. It is not a
          continuous background monitor. A successful HTTP response confirms that
          an endpoint responded; it does not independently verify every internal
          service or data-quality condition.
        </div>

        <footer className="ss-footer">
          <span>OceanMind · System observability</span>
          <span>
            <ArrowUpRight size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Data sourced from your configured backend
          </span>
        </footer>
      </main>
    </>
  );
}
