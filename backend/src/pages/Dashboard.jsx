
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Database,
  Thermometer,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Waves,
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
} from "recharts";
import { api } from "../services/api";

const chartColors = ["#42d9e8", "#5798ff", "#53dfb0", "#ffb86b"];

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function formatDecimal(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
}

function StatCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <article className="stat-card panel">
      <div className="stat-card-top">
        <span className="stat-card-title">{title}</span>
        <span className={`stat-icon ${accent}`}>
          <Icon size={19} />
        </span>
      </div>

      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
    </article>
  );
}

export default function Dashboard({ refreshKey = 0 }) {
  const [summary, setSummary] = useState(null);
  const [observations, setObservations] = useState([]);
  const [anomalySummary, setAnomalySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [summaryData, observationData, anomalyData] =
        await Promise.all([
          api.dashboardSummary(),
          api.observations(100, 0),
          api.anomalySummary(),
        ]);

      setSummary(summaryData);

      const rows = Array.isArray(observationData)
        ? observationData
        : observationData.observations ?? observationData.records ?? [];

      setObservations(rows);
      setAnomalySummary(anomalyData);
    } catch (err) {
      setError(err.message || "Could not load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshKey]);

  const trendData = [...observations]
    .reverse()
    .map((row, index) => ({
      label: row.observation_time
        ? String(row.observation_time).slice(0, 10)
        : `Record ${index + 1}`,
      temperature: Number(
        row.sea_surface_temperature ??
          row.sst ??
          row.temperature ??
          0
      ),
      anomaly: Number(
        row.temperature_anomaly ?? row.anom ?? 0
      ),
    }))
    .filter((row) => Number.isFinite(row.temperature));

  const anomalyCount = Number(
    summary?.anomaly_count ??
      anomalySummary?.anomaly_count ??
      anomalySummary?.total_anomalies ??
      0
  );

  const totalCount = Number(summary?.total_observations ?? 0);

  const distributionData = [
    { name: "Normal by threshold", value: Math.max(0, totalCount - anomalyCount) },
    { name: "Flagged anomalies", value: anomalyCount },
  ];

  if (loading && !summary) {
    return (
      <div className="panel loading-state dashboard-message">
        <RefreshCw className="refresh-spinning" size={22} />
        <p>Loading ocean observations from the database…</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="panel dashboard-error">
        <AlertTriangle size={24} />
        <h2>Unable to load dashboard</h2>
        <p>{error}</p>
        <button className="primary-button" onClick={loadDashboard}>
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-content animate-in">
      {error && <div className="error-state">{error}</div>}

      <div className="dashboard-section-heading">
        <div>
          <div className="eyebrow">DATABASE OVERVIEW</div>
          <h2 className="section-heading-title">Ocean at a glance</h2>
          <p className="muted section-heading-description">
            Statistics calculated from your imported dataset.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadDashboard}
          disabled={loading}
        >
          <RefreshCw
            size={15}
            className={loading ? "refresh-spinning" : ""}
          />
          Refresh data
        </button>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Total observations"
          value={formatNumber(summary?.total_observations)}
          subtitle="Records stored in SQLite"
          icon={Database}
          accent="cyan"
        />

        <StatCard
          title="Average sea temperature"
          value={`${formatDecimal(summary?.average_sst_celsius)}°C`}
          subtitle="Mean of imported SST values"
          icon={Thermometer}
          accent="blue"
        />

        <StatCard
          title="Flagged anomalies"
          value={formatNumber(anomalyCount)}
          subtitle="Absolute temperature anomaly ≥ 2°C"
          icon={AlertTriangle}
          accent="orange"
        />

        <StatCard
          title="Anomaly share"
          value={`${formatDecimal(summary?.anomaly_percentage)}%`}
          subtitle="Share of all observations"
          icon={Activity}
          accent="green"
        />
      </div>

      <div className="dashboard-charts-grid">
        <section className="panel chart-panel">
          <div className="chart-heading">
            <div>
              <h3 className="panel-title">Sea surface temperature</h3>
              <p className="muted chart-subtitle">
                Latest returned observations
              </p>
            </div>
            <span className="chart-unit">°C</span>
          </div>

          {trendData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="temperatureGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#42d9e8"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="95%"
                        stopColor="#42d9e8"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#1d3048"
                    strokeDasharray="4 5"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#8da2bb", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />

                  <YAxis
                    tick={{ fill: "#8da2bb", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                  />

                  <Tooltip
                    contentStyle={{
                      background: "#0d1a2b",
                      border: "1px solid #1d3048",
                      borderRadius: 10,
                      color: "#e8f1fb",
                      fontSize: 12,
                    }}
                    formatter={(value) => [
                      `${Number(value).toFixed(2)}°C`,
                      "Temperature",
                    ]}
                  />

                  <Area
                    type="monotone"
                    dataKey="temperature"
                    stroke="#42d9e8"
                    strokeWidth={2}
                    fill="url(#temperatureGradient)"
                    activeDot={{ r: 4, fill: "#42d9e8" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              No temperature records are available.
            </div>
          )}

          <p className="chart-footnote">
            This chart uses the observations returned by the API; it is not
            a forecast.
          </p>
        </section>

        <section className="panel chart-panel distribution-panel">
          <div className="chart-heading">
            <div>
              <h3 className="panel-title">Observation classification</h3>
              <p className="muted chart-subtitle">
                Threshold-based screening
              </p>
            </div>
            <Waves size={19} color="#42d9e8" />
          </div>

          <div className="distribution-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={91}
                  paddingAngle={3}
                  stroke="none"
                >
                  {distributionData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={chartColors[index]}
                    />
                  ))}
                </Pie>

                <Tooltip
                  contentStyle={{
                    background: "#0d1a2b",
                    border: "1px solid #1d3048",
                    borderRadius: 10,
                    color: "#e8f1fb",
                    fontSize: 12,
                  }}
                  formatter={(value) => [formatNumber(value), "Records"]}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="distribution-center">
              <strong>{formatNumber(totalCount)}</strong>
              <span>Records</span>
            </div>
          </div>

          <div className="distribution-legend">
            {distributionData.map((item, index) => (
              <div className="legend-row" key={item.name}>
                <span
                  className="legend-swatch"
                  style={{ background: chartColors[index] }}
                />
                <span className="legend-name">{item.name}</span>
                <strong>{formatNumber(item.value)}</strong>
              </div>
            ))}
          </div>

          <p className="chart-footnote">
            A threshold flag is a screening result, not a confirmed ocean
            hazard or a trained ML prediction.
          </p>
        </section>
      </div>

      <section className="panel dataset-overview">
        <div className="dataset-overview-icon">
          <TrendingUp size={21} />
        </div>
        <div className="dataset-overview-copy">
          <h3 className="panel-title">Dataset processing overview</h3>
          <p className="muted">
            {formatNumber(summary?.total_observations)} observations loaded
            across {formatNumber(summary?.dataset_count)} dataset(s), with{" "}
            {formatNumber(summary?.processing_jobs)} processing job(s)
            recorded in the database.
          </p>
        </div>
        <div className="dataset-overview-status">
          <span className="status-dot" />
          Database statistics
        </div>
      </section>
    </div>
  );
}
