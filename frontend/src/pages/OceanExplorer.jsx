
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  Filter,
  MapPin,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Thermometer,
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
import OceanMap from "../components/OceanMap";
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

const getRows = (result) => {
  if (Array.isArray(result)) return result;
  return (
    result?.observations ||
    result?.records ||
    result?.data ||
    result?.items ||
    []
  );
};

const getSST = (row) =>
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

const getCoordinates = (row) => ({
  lat: Number(row?.latitude ?? row?.lat),
  lon: Number(row?.longitude ?? row?.lon ?? row?.long),
});

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
};

export default function OceanExplorer({
  theme = "dark",
  onThemeChange,
  refreshKey = 0,
}) {
  const [observations, setObservations] = useState([]);
  const [mapObservations, setMapObservations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [chartMode, setChartMode] = useState("temperature");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    const results = await Promise.allSettled([
      api.dashboardSummary(),
      api.observations(500, 0),
      api.mapObservations(1000),
    ]);

    const failures = [];

    if (results[0].status === "fulfilled") {
      setSummary(results[0].value);
    } else {
      failures.push(
        `Summary: ${results[0].reason?.message || "Could not load"}`
      );
    }

    if (results[1].status === "fulfilled") {
      setObservations(getRows(results[1].value));
    } else {
      failures.push(
        `Observations: ${results[1].reason?.message || "Could not load"}`
      );
    }

    if (results[2].status === "fulfilled") {
      setMapObservations(getRows(results[2].value));
    } else {
      failures.push(
        `Map locations: ${results[2].reason?.message || "Could not load"}`
      );
    }

    if (failures.length === results.length) {
      setError(failures.join(" | "));
    } else if (failures.length) {
      setNotice(failures.join(" | "));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const validRows = useMemo(
    () =>
      observations.filter((row) => {
        const coords = getCoordinates(row);
        return (
          Number.isFinite(getSST(row)) &&
          Number.isFinite(coords.lat) &&
          Number.isFinite(coords.lon)
        );
      }),
    [observations]
  );

  const averageSST = Number(summary?.average_sst_celsius);
  const averageAnomaly = Number(
    summary?.average_temperature_anomaly_celsius
  );
  const totalObservations = Number(
    summary?.total_observations ?? observations.length
  );
  const flaggedCount = Number(summary?.anomaly_count ?? 0);
  const flaggedPercentage = Number(summary?.anomaly_percentage);

  const localStats = useMemo(() => {
    const temperatures = validRows
      .map(getSST)
      .filter(Number.isFinite);

    const anomalies = validRows
      .map(getAnomaly)
      .filter(Number.isFinite);

    const positive = anomalies.filter((value) => value >= 2).length;
    const negative = anomalies.filter((value) => value <= -2).length;

    const meanTemperature = temperatures.length
      ? temperatures.reduce((sum, value) => sum + value, 0) /
        temperatures.length
      : null;

    const meanAnomaly = anomalies.length
      ? anomalies.reduce((sum, value) => sum + value, 0) /
        anomalies.length
      : null;

    return {
      meanTemperature,
      meanAnomaly,
      positive,
      negative,
      normal: anomalies.length - positive - negative,
      temperatureCount: temperatures.length,
      anomalyCount: anomalies.length,
    };
  }, [validRows]);

  const trendData = useMemo(
    () =>
      [...validRows].reverse().map((row, index) => ({
        index: index + 1,
        label: getTime(row) || `Sample ${index + 1}`,
        temperature: getSST(row),
        anomaly: getAnomaly(row),
      })),
    [validRows]
  );

  const distribution = useMemo(() => {
    const bins = [
      { range: "< 0°C", min: -Infinity, max: 0, count: 0 },
      { range: "0–10°C", min: 0, max: 10, count: 0 },
      { range: "10–20°C", min: 10, max: 20, count: 0 },
      { range: "20–25°C", min: 20, max: 25, count: 0 },
      { range: "25–30°C", min: 25, max: 30, count: 0 },
      { range: "30°C+", min: 30, max: Infinity, count: 0 },
    ];

    validRows.forEach((row) => {
      const value = getSST(row);
      const bin = bins.find(
        (item) => value >= item.min && value < item.max
      );
      if (bin) bin.count += 1;
    });

    return bins;
  }, [validRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return validRows.filter((row) => {
      const anomaly = getAnomaly(row);

      if (filter === "positive" && !(anomaly >= 2)) return false;
      if (filter === "negative" && !(anomaly <= -2)) return false;
      if (
        filter === "normal" &&
        !(Number.isFinite(anomaly) && anomaly > -2 && anomaly < 2)
      ) {
        return false;
      }

      if (!query) return true;

      const coords = getCoordinates(row);

      return [
        getTime(row),
        coords.lat,
        coords.lon,
        getSST(row),
        anomaly,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });
  }, [validRows, search, filter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const resetFilters = () => {
    setSearch("");
    setFilter("all");
    setPage(1);
  };

  return (
    <div className={`oe-page ${theme === "light" ? "oe-light" : ""}`}>
      <style>{OCEAN_EXPLORER_CSS}</style>

      <header className="oe-topbar">
        <div className="oe-breadcrumb">
          <span>OceanMind</span>
          <ChevronRight size={14} />
          <strong>Ocean Explorer</strong>
        </div>

        <div className="oe-top-actions">
          <span className="oe-workspace-status">
            <span className="oe-pulse-dot" />
            Exploration workspace
          </span>

         
<button
  className="oe-icon-button"
  onClick={() =>
    onThemeChange?.(theme === "dark" ? "light" : "dark")
  }
  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
  title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
>
  {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
</button>


          <button
            className="oe-icon-button"
            onClick={loadData}
            disabled={loading}
            aria-label="Refresh ocean data"
            title="Refresh data"
          >
            <RefreshCw
              size={17}
              className={loading ? "oe-spin" : ""}
            />
          </button>
        </div>
      </header>

      <main className="oe-main">
        <section className="oe-hero">
          <div className="oe-hero-glow oe-glow-one" />
          <div className="oe-hero-glow oe-glow-two" />

          <div className="oe-hero-copy">
            <div className="oe-eyebrow">
              <Compass size={14} />
              GEOSPATIAL INTELLIGENCE
            </div>
            <h1>Explore the <span>ocean.</span></h1>
            <p>
              Navigate ocean observation data, study sea-surface temperature,
              and screen temperature anomalies across the available dataset.
            </p>
            <div className="oe-hero-meta">
              <span><Database size={14} /> {formatNumber(totalObservations)} database records</span>
              <span><MapPin size={14} /> {formatNumber(mapObservations.length)} map locations</span>
            </div>
          </div>

          <div className="oe-hero-visual" aria-hidden="true">
            <div className="oe-globe-ring oe-globe-ring-one" />
            <div className="oe-globe-ring oe-globe-ring-two" />
            <div className="oe-globe-ring oe-globe-ring-three" />
            <div className="oe-globe-core"><Waves size={42} /></div>
            <span className="oe-globe-dot dot-a" />
            <span className="oe-globe-dot dot-b" />
            <span className="oe-globe-dot dot-c" />
          </div>
        </section>

        {error && (
          <div className="oe-alert oe-alert-error">
            <AlertTriangle size={18} />
            <div>
              <strong>Unable to load ocean data</strong>
              <p>{error}</p>
              <button onClick={loadData}>Retry loading</button>
            </div>
          </div>
        )}

        {notice && (
          <div className="oe-alert oe-alert-info">
            <Activity size={17} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>Dismiss</button>
          </div>
        )}

        <section className="oe-metric-grid">
          <MetricCard
            icon={<Database size={19} />}
            label="Database observations"
            value={loading ? "…" : formatNumber(totalObservations)}
            detail="Total records reported by API"
            color="cyan"
          />
          <MetricCard
            icon={<Thermometer size={19} />}
            label="Average sea temperature"
            value={Number.isFinite(averageSST) ? `${formatNumber(averageSST, 2)}°C` : "—"}
            detail="Full-dataset API summary"
            color="blue"
          />
          <MetricCard
            icon={<AlertTriangle size={19} />}
            label="Threshold flags"
            value={loading ? "…" : formatNumber(flaggedCount)}
            detail={
              Number.isFinite(flaggedPercentage)
                ? `${formatNumber(flaggedPercentage, 2)}% of observations`
                : "Absolute anomaly ≥ 2°C"
            }
            color="rose"
          />
          <MetricCard
            icon={<CheckCircle2 size={19} />}
            label="Valid loaded records"
            value={loading ? "…" : formatNumber(validRows.length)}
            detail={`From ${formatNumber(observations.length)} loaded rows`}
            color="green"
          />
        </section>

        <section className="oe-section-heading">
          <div>
            <div className="oe-eyebrow">GEOGRAPHIC VIEW</div>
            <h2>Ocean observation map</h2>
            <p>Explore sampled geographic cells returned by your backend.</p>
          </div>
          <div className="oe-map-badge">
            <span className="oe-pulse-dot" />
            {loading ? "Updating map" : `${formatNumber(mapObservations.length)} locations loaded`}
          </div>
        </section>

        <section className="oe-map-panel">
          <div className="oe-map-heading">
            <div className="oe-map-heading-icon"><MapPin size={18} /></div>
            <div>
              <h3>Global ocean explorer</h3>
              <p>Use the map filters to compare positive, negative, and below-threshold readings.</p>
            </div>
          </div>

          <div className="oe-map-container">
            {mapObservations.length ? (
              <OceanMap observations={mapObservations} />
            ) : loading ? (
              <div className="oe-map-loading">
                <div className="oe-map-loader"><Waves size={30} /></div>
                <strong>Loading ocean locations…</strong>
                <span>Retrieving geographic observations from the API</span>
              </div>
            ) : (
              <div className="oe-map-loading">
                <MapPin size={27} />
                <strong>No map observations available</strong>
                <span>Check the map-observations endpoint and refresh.</span>
              </div>
            )}
          </div>

          <div className="oe-map-footnote">
            <span><span className="oe-legend-dot cyan" /> Below threshold</span>
            <span><span className="oe-legend-dot red" /> Positive ≥ +2°C</span>
            <span><span className="oe-legend-dot blue" /> Negative ≤ −2°C</span>
            <span className="oe-map-disclaimer">
              Threshold flags are screening indicators, not confirmed hazards.
            </span>
          </div>
        </section>

        <section className="oe-section-heading">
          <div>
            <div className="oe-eyebrow">TEMPERATURE ANALYTICS</div>
            <h2>Understand the readings</h2>
            <p>Charts update from the observations retrieved by the backend.</p>
          </div>
          <div className="oe-segmented">
            <button
              className={chartMode === "temperature" ? "active" : ""}
              onClick={() => setChartMode("temperature")}
            >
              <Thermometer size={14} /> SST
            </button>
            <button
              className={chartMode === "anomaly" ? "active" : ""}
              onClick={() => setChartMode("anomaly")}
            >
              <Activity size={14} /> Anomaly
            </button>
          </div>
        </section>

        <section className="oe-chart-grid">
          <article className="oe-panel oe-chart-panel">
            <div className="oe-panel-heading">
              <div>
                <h3>
                  {chartMode === "temperature"
                    ? "Sea surface temperature trend"
                    : "Temperature anomaly trend"}
                </h3>
                <p>
                  {chartMode === "temperature"
                    ? "Temperature values across loaded records"
                    : "Deviation values across loaded records"}
                </p>
              </div>
              <span className="oe-unit-badge">
                {chartMode === "temperature" ? "°C" : "Δ °C"}
              </span>
            </div>

            <div className="oe-chart">
              {loading ? (
                <ChartSkeleton />
              ) : trendData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trendData}
                    margin={{ top: 12, right: 9, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="oeTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={chartMode === "temperature" ? "#42d9e8" : "#5798ff"}
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="100%"
                          stopColor={chartMode === "temperature" ? "#42d9e8" : "#5798ff"}
                          stopOpacity={0.015}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--oe-grid)"
                      strokeDasharray="4 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="index"
                      tick={{ fill: "var(--oe-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={32}
                      tickFormatter={(value) => `#${value}`}
                    />
                    <YAxis
                      tick={{ fill: "var(--oe-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}°`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--oe-tooltip)",
                        border: "1px solid var(--oe-border)",
                        borderRadius: 12,
                        color: "var(--oe-text)",
                        fontSize: 11,
                      }}
                      labelFormatter={(value, items) =>
                        items?.[0]?.payload?.label
                          ? `Time: ${items[0].payload.label}`
                          : `Sample #${value}`
                      }
                      formatter={(value) => [
                        Number.isFinite(Number(value))
                          ? `${formatNumber(value, 2)}°C`
                          : "—",
                        chartMode === "temperature" ? "SST" : "Anomaly",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey={chartMode}
                      stroke={chartMode === "temperature" ? "#42d9e8" : "#5798ff"}
                      strokeWidth={2}
                      fill="url(#oeTrendFill)"
                      dot={false}
                      activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                      connectNulls={false}
                      isAnimationActive
                      animationDuration={900}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty text="No observation data is available for this chart." />
              )}
            </div>
            <div className="oe-chart-footer">
              <span><Activity size={14} /> {formatNumber(trendData.length)} plotted records</span>
              <span>Sample index follows loaded row order</span>
            </div>
          </article>

          <article className="oe-panel oe-chart-panel">
            <div className="oe-panel-heading">
              <div>
                <h3>Temperature distribution</h3>
                <p>Loaded observations grouped into temperature ranges</p>
              </div>
              <span className="oe-unit-badge">°C</span>
            </div>
            <div className="oe-chart oe-distribution-chart">
              {loading ? (
                <ChartSkeleton />
              ) : validRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={distribution}
                    margin={{ top: 12, right: 3, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="var(--oe-grid)"
                      strokeDasharray="4 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="range"
                      tick={{ fill: "var(--oe-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--oe-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--oe-tooltip)",
                        border: "1px solid var(--oe-border)",
                        borderRadius: 12,
                        color: "var(--oe-text)",
                        fontSize: 11,
                      }}
                      formatter={(value) => [formatNumber(value), "Records"]}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive
                      animationDuration={850}
                    >
                      {distribution.map((item, index) => (
                        <Cell
                          key={item.range}
                          fill={["#5798ff", "#668cff", "#42b9e8", "#42d9e8", "#53dfb0", "#ffb86b"][index]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty text="No valid temperature readings to group." />
              )}
            </div>
            <div className="oe-chart-footer">
              <span><Database size={14} /> {formatNumber(validRows.length)} valid readings</span>
              <span>Based on loaded sample</span>
            </div>
          </article>
        </section>

        <section className="oe-local-stats">
          <div className="oe-local-stat">
            <span>Sample average SST</span>
            <strong>
              {Number.isFinite(localStats.meanTemperature)
                ? `${formatNumber(localStats.meanTemperature, 2)}°C`
                : "—"}
            </strong>
            <small>Calculated from loaded records</small>
          </div>
          <div className="oe-local-stat">
            <span>Sample average anomaly</span>
            <strong>
              {Number.isFinite(localStats.meanAnomaly)
                ? `${localStats.meanAnomaly > 0 ? "+" : ""}${formatNumber(localStats.meanAnomaly, 3)}°C`
                : "—"}
            </strong>
            <small>Calculated from valid anomaly values</small>
          </div>
          <div className="oe-local-stat">
            <span>Positive threshold flags</span>
            <strong className="oe-positive-text">{formatNumber(localStats.positive)}</strong>
            <small>Anomaly ≥ +2°C in loaded sample</small>
          </div>
          <div className="oe-local-stat">
            <span>Negative threshold flags</span>
            <strong className="oe-negative-text">{formatNumber(localStats.negative)}</strong>
            <small>Anomaly ≤ −2°C in loaded sample</small>
          </div>
        </section>

        <section className="oe-section-heading oe-table-section-heading">
          <div>
            <div className="oe-eyebrow">OBSERVATION REGISTRY</div>
            <h2>Explore individual records</h2>
            <p>Search and filter the loaded sample to inspect specific readings.</p>
          </div>
        </section>

        <section className="oe-panel oe-table-panel">
          <div className="oe-table-toolbar">
            <div className="oe-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search time, coordinates, temperature..."
                aria-label="Search ocean observations"
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }}>
                  Clear
                </button>
              )}
            </div>

            <div className="oe-filter-control">
              <Filter size={15} />
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(1);
                }}
                aria-label="Filter ocean observations"
              >
                <option value="all">All observations</option>
                <option value="positive">Positive ≥ +2°C</option>
                <option value="negative">Negative ≤ −2°C</option>
                <option value="normal">Below threshold</option>
              </select>
            </div>

            <button className="oe-icon-button" onClick={resetFilters} title="Reset filters">
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="oe-table-meta">
            <span>
              <strong>{formatNumber(filteredRows.length)}</strong> matching records
              <span className="oe-meta-separator">·</span>
              <strong>{formatNumber(observations.length)}</strong> loaded
            </span>
            <span>API request: up to 500 observations</span>
          </div>

          <div className="oe-table-scroll">
            <table className="oe-table">
              <thead>
                <tr>
                  <th>Observation time</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>SST</th>
                  <th>Anomaly</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="oe-table-empty">
                      <RefreshCw className="oe-spin" size={18} />
                      Loading ocean observations…
                    </td>
                  </tr>
                ) : pageRows.length ? (
                  pageRows.map((row, index) => {
                    const anomaly = getAnomaly(row);
                    const coords = getCoordinates(row);
                    const positive = Number.isFinite(anomaly) && anomaly >= 2;
                    const negative = Number.isFinite(anomaly) && anomaly <= -2;

                    return (
                      <tr key={`${getTime(row) || "observation"}-${index}`}>
                        <td className="oe-time-cell">{formatDate(getTime(row))}</td>
                        <td>{formatNumber(coords.lat, 3)}</td>
                        <td>{formatNumber(coords.lon, 3)}</td>
                        <td className="oe-temp-cell">
                          {Number.isFinite(getSST(row))
                            ? `${formatNumber(getSST(row), 2)}°C`
                            : "—"}
                        </td>
                        <td className={positive ? "oe-positive-text" : negative ? "oe-negative-text" : ""}>
                          {Number.isFinite(anomaly)
                            ? `${anomaly > 0 ? "+" : ""}${formatNumber(anomaly, 2)}°C`
                            : "—"}
                        </td>
                        <td>
                          <span className={`oe-status-pill ${positive ? "positive" : negative ? "negative" : Number.isFinite(anomaly) ? "normal" : "unknown"}`}>
                            {positive
                              ? "Positive flag"
                              : negative
                              ? "Negative flag"
                              : Number.isFinite(anomaly)
                              ? "Below threshold"
                              : "Unavailable"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="oe-table-empty">
                      <Search size={22} />
                      <strong>No matching observations</strong>
                      <span>Try a different search or reset the filters.</span>
                      <button className="oe-secondary-button" onClick={resetFilters}>
                        Reset filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="oe-pagination">
            <span>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <div>
              <button
                className="oe-icon-button"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                className="oe-icon-button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                aria-label="Next page"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </section>

        <div className="oe-disclaimer">
          <AlertTriangle size={15} />
          <span>
            Anomaly screening uses the current ±2°C threshold. These flags are
            data-screening indicators, not confirmed marine hazards or trained
            machine-learning predictions.
          </span>
        </div>

        <footer className="oe-footer">
          <div><Waves size={17} /><strong>OceanMind</strong><span>Ocean intelligence workspace</span></div>
          <span>Visualizations are based on API data available to this page.</span>
        </footer>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, color }) {
  return (
    <article className="oe-metric-card">
      <div className={`oe-metric-icon ${color}`}>{icon}</div>
      <span className="oe-metric-label">{label}</span>
      <strong className="oe-metric-value">{value}</strong>
      <span className="oe-metric-detail">{detail}</span>
      <div className={`oe-metric-glow ${color}`} />
    </article>
  );
}

function ChartSkeleton() {
  return (
    <div className="oe-chart-skeleton">
      {[35, 63, 48, 82, 57, 72].map((height, index) => (
        <div key={index} style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}

function ChartEmpty({ text }) {
  return (
    <div className="oe-chart-empty">
      <Database size={25} />
      <span>{text}</span>
    </div>
  );
}

const OCEAN_EXPLORER_CSS = `
.oe-page {
  --oe-bg: #07111f;
  --oe-panel: #0d1a2b;
  --oe-raised: #102138;
  --oe-border: #20344b;
  --oe-text: #e8f1fb;
  --oe-muted: #8da2bb;
  --oe-grid: rgba(141,162,187,.15);
  --oe-tooltip: #102138;
  --oe-cyan: #42d9e8;
  --oe-blue: #5798ff;
  --oe-green: #53dfb0;
  --oe-red: #ff6b81;
  min-height: 100%;
  color: var(--oe-text);
  background: var(--oe-bg);
  border-radius: 18px;
  overflow: hidden;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  animation: oeFade .4s ease both;
}
.oe-page * { box-sizing: border-box; }
.oe-light {
  --oe-bg: #f2f6fb;
  --oe-panel: #fff;
  --oe-raised: #f6f9fd;
  --oe-border: #dce6f1;
  --oe-text: #14243a;
  --oe-muted: #61758d;
  --oe-grid: rgba(72,97,126,.14);
  --oe-tooltip: #fff;
}
.oe-page button, .oe-page input, .oe-page select { font: inherit; }
.oe-page button { cursor: pointer; }
.oe-page button:disabled { opacity: .45; cursor: not-allowed; }
.oe-topbar { display:flex; justify-content:space-between; align-items:center; gap:14px; padding:17px 27px; background:var(--oe-panel); border-bottom:1px solid var(--oe-border); }
.oe-breadcrumb, .oe-top-actions { display:flex; align-items:center; gap:11px; }
.oe-breadcrumb { font-size:11px; color:var(--oe-muted); }
.oe-breadcrumb strong { color:var(--oe-text); }
.oe-top-actions { gap:9px; }
.oe-workspace-status { display:flex; align-items:center; gap:7px; color:var(--oe-muted); font-size:10px; font-weight:650; }
.oe-pulse-dot { width:7px; height:7px; border-radius:50%; background:var(--oe-green); box-shadow:0 0 11px rgba(83,223,176,.5); animation:oePulse 2s infinite; }
.oe-icon-button { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--oe-border); border-radius:10px; color:var(--oe-muted); background:var(--oe-raised); transition:all .2s ease; }
.oe-icon-button:hover:not(:disabled) { color:var(--oe-cyan); border-color:var(--oe-cyan); transform:translateY(-1px); }
.oe-main { max-width:1800px; margin:0 auto; padding:25px 27px 22px; }
.oe-hero { position:relative; display:flex; justify-content:space-between; align-items:center; gap:20px; min-height:230px; overflow:hidden; padding:31px 35px; border:1px solid rgba(66,217,232,.22); border-radius:20px; background:linear-gradient(115deg,#102a42,#0b1c31 56%,#112947); box-shadow:0 15px 40px rgba(0,0,0,.1); }
.oe-light .oe-hero { background:linear-gradient(115deg,#e1f7fb,#e9f1ff 60%,#f0eaff); border-color:#c8e7ef; }
.oe-hero-copy { position:relative; z-index:2; max-width:690px; }
.oe-eyebrow { display:flex; align-items:center; gap:8px; margin-bottom:9px; color:var(--oe-cyan); font-size:10px; font-weight:800; letter-spacing:1.65px; }
.oe-hero h1 { margin:0; font-size:clamp(30px,3.4vw,44px); line-height:1.14; letter-spacing:-1.6px; font-weight:850; }
.oe-hero h1 span { color:var(--oe-cyan); }
.oe-hero-copy > p { max-width:610px; margin:13px 0 17px; color:var(--oe-muted); font-size:12px; line-height:1.85; }
.oe-hero-meta { display:flex; flex-wrap:wrap; gap:17px; color:var(--oe-muted); font-size:10px; }
.oe-hero-meta span { display:flex; align-items:center; gap:7px; }
.oe-hero-visual { position:relative; flex:0 0 205px; width:205px; height:185px; display:grid; place-items:center; margin-right:18px; }
.oe-globe-ring { position:absolute; border:1px solid rgba(66,217,232,.22); border-radius:50%; animation:oeOrbit 20s linear infinite; }
.oe-globe-ring-one { width:174px; height:174px; }
.oe-globe-ring-two { width:137px; height:137px; border-style:dashed; animation-direction:reverse; animation-duration:26s; }
.oe-globe-ring-three { width:96px; height:96px; border-color:rgba(87,152,255,.55); }
.oe-globe-core { display:grid; place-items:center; width:68px; height:68px; color:var(--oe-cyan); border:1px solid rgba(66,217,232,.45); border-radius:22px; background:rgba(66,217,232,.1); box-shadow:0 0 35px rgba(66,217,232,.12); }
.oe-globe-dot { position:absolute; width:8px; height:8px; border-radius:50%; background:var(--oe-cyan); box-shadow:0 0 12px var(--oe-cyan); }
.oe-globe-dot.dot-a { top:10px; left:102px; }
.oe-globe-dot.dot-b { right:6px; bottom:52px; background:var(--oe-blue); box-shadow:0 0 12px var(--oe-blue); }
.oe-globe-dot.dot-c { left:24px; bottom:31px; background:var(--oe-green); box-shadow:0 0 12px var(--oe-green); }
.oe-hero-glow { position:absolute; border-radius:50%; pointer-events:none; }
.oe-glow-one { width:300px; height:300px; top:-190px; right:-70px; background:radial-gradient(circle,rgba(66,217,232,.13),transparent 70%); }
.oe-glow-two { width:280px; height:280px; bottom:-210px; right:130px; background:radial-gradient(circle,rgba(87,152,255,.12),transparent 70%); }
.oe-alert { display:flex; align-items:flex-start; gap:11px; padding:13px 15px; margin-top:15px; border-radius:10px; font-size:11px; line-height:1.6; }
.oe-alert-error { border:1px solid rgba(255,107,129,.3); color:#ff9aaa; background:rgba(255,107,129,.07); }
.oe-alert-info { align-items:center; color:var(--oe-green); border:1px solid rgba(83,223,176,.25); background:rgba(83,223,176,.06); }
.oe-alert p { margin:4px 0; overflow-wrap:anywhere; }
.oe-alert button { padding:0; border:0; background:none; color:inherit; font-size:10px; margin-left:auto; }
.oe-metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:13px; margin:19px 0 30px; }
.oe-metric-card { position:relative; display:flex; flex-direction:column; gap:9px; min-width:0; overflow:hidden; padding:18px; border:1px solid var(--oe-border); border-radius:15px; background:var(--oe-panel); animation:oeRise .5s ease both; transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease; }
.oe-metric-card:nth-child(2) { animation-delay:.06s; }
.oe-metric-card:nth-child(3) { animation-delay:.12s; }
.oe-metric-card:nth-child(4) { animation-delay:.18s; }
.oe-metric-card:hover { transform:translateY(-3px); border-color:rgba(66,217,232,.45); box-shadow:0 12px 28px rgba(0,0,0,.08); }
.oe-metric-icon { display:grid; place-items:center; width:36px; height:36px; border-radius:11px; color:var(--oe-cyan); background:rgba(66,217,232,.1); }
.oe-metric-icon.blue { color:#78a9ff; background:rgba(87,152,255,.12); }
.oe-metric-icon.rose { color:#ff8295; background:rgba(255,107,129,.11); }
.oe-metric-icon.green { color:var(--oe-green); background:rgba(83,223,176,.1); }
.oe-metric-label { color:var(--oe-muted); font-size:10px; font-weight:650; }
.oe-metric-value { font-size:clamp(22px,2vw,29px); letter-spacing:-.7px; line-height:1.2; font-weight:850; overflow-wrap:anywhere; }
.oe-metric-detail { color:var(--oe-muted); font-size:9px; line-height:1.55; }
.oe-metric-glow { position:absolute; width:78px; height:78px; top:-28px; right:-24px; border-radius:50%; background:rgba(66,217,232,.05); }
.oe-metric-glow.blue { background:rgba(87,152,255,.06); }
.oe-metric-glow.rose { background:rgba(255,107,129,.05); }
.oe-metric-glow.green { background:rgba(83,223,176,.05); }
.oe-section-heading { display:flex; justify-content:space-between; align-items:flex-end; gap:15px; margin:28px 0 14px; }
.oe-section-heading .oe-eyebrow { margin-bottom:7px; }
.oe-section-heading h2 { margin:0; font-size:20px; font-weight:820; letter-spacing:-.5px; }
.oe-section-heading p { margin:6px 0 0; color:var(--oe-muted); font-size:10px; line-height:1.7; }
.oe-map-badge { display:flex; align-items:center; gap:8px; white-space:nowrap; padding:8px 11px; border:1px solid var(--oe-border); border-radius:9px; color:var(--oe-muted); font-size:10px; }
.oe-map-panel, .oe-panel { min-width:0; border:1px solid var(--oe-border); border-radius:15px; background:var(--oe-panel); overflow:hidden; }
.oe-map-heading { display:flex; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid var(--oe-border); }
.oe-map-heading-icon { display:grid; place-items:center; width:37px; height:37px; border-radius:11px; color:var(--oe-cyan); background:rgba(66,217,232,.1); }
.oe-map-heading h3 { margin:0 0 5px; font-size:12px; font-weight:800; }
.oe-map-heading p { margin:0; color:var(--oe-muted); font-size:10px; line-height:1.6; }
.oe-map-container { width:100%; height:440px; background:var(--oe-raised); }
.oe-map-container > * { width:100%; height:100%; }
.oe-map-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:11px; width:100%; height:100%; color:var(--oe-muted); text-align:center; font-size:10px; }
.oe-map-loading strong { color:var(--oe-text); font-size:12px; }
.oe-map-loader { display:grid; place-items:center; width:65px; height:65px; color:var(--oe-cyan); border:1px solid rgba(66,217,232,.35); border-radius:50%; animation:oePulse 1.5s infinite; }
.oe-map-footnote { display:flex; align-items:center; flex-wrap:wrap; gap:15px; padding:13px 17px; border-top:1px solid var(--oe-border); color:var(--oe-muted); font-size:9px; }
.oe-map-footnote > span { display:flex; align-items:center; gap:7px; }
.oe-legend-dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
.oe-legend-dot.cyan { background:#42d9e8; }
.oe-legend-dot.red { background:#ff657a; }
.oe-legend-dot.blue { background:#5798ff; }
.oe-map-disclaimer { margin-left:auto; }
.oe-segmented { display:flex; gap:4px; padding:4px; border:1px solid var(--oe-border); border-radius:10px; background:var(--oe-panel); }
.oe-segmented button { display:flex; align-items:center; gap:6px; padding:8px 10px; border:0; border-radius:7px; background:transparent; color:var(--oe-muted); font-size:10px; font-weight:700; transition:all .2s ease; }
.oe-segmented button.active { color:var(--oe-cyan); background:rgba(66,217,232,.1); }
.oe-chart-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(0,1fr); gap:14px; }
.oe-chart-panel { padding:19px; animation:oeRise .5s ease both; }
.oe-panel-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.oe-panel-heading h3 { margin:0 0 6px; font-size:12px; font-weight:800; }
.oe-panel-heading p { margin:0; color:var(--oe-muted); font-size:10px; line-height:1.6; }
.oe-unit-badge { padding:5px 8px; border:1px solid var(--oe-border); border-radius:7px; color:var(--oe-muted); font-size:9px; }
.oe-chart { width:100%; height:255px; margin-top:20px; }
.oe-distribution-chart { height:285px; }
.oe-chart-footer { display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-top:10px; padding-top:12px; border-top:1px solid var(--oe-border); color:var(--oe-muted); font-size:9px; }
.oe-chart-footer span:first-child { display:flex; align-items:center; gap:6px; }
.oe-chart-skeleton { display:flex; align-items:flex-end; gap:9px; height:100%; padding:15px 10px; }
.oe-chart-skeleton div { flex:1; border-radius:6px 6px 0 0; background:linear-gradient(180deg,rgba(66,217,232,.2),rgba(66,217,232,.025)); animation:oeSkeleton 1.2s ease-in-out infinite alternate; }
.oe-chart-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; height:100%; padding:20px; text-align:center; color:var(--oe-muted); font-size:10px; }
.oe-local-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:15px; }
.oe-local-stat { display:flex; flex-direction:column; gap:8px; padding:17px; border:1px solid var(--oe-border); border-radius:13px; background:var(--oe-panel); }
.oe-local-stat > span { color:var(--oe-muted); font-size:10px; }
.oe-local-stat strong { font-size:22px; letter-spacing:-.4px; }
.oe-local-stat small { color:var(--oe-muted); font-size:9px; line-height:1.5; }
.oe-positive-text { color:#ff8295 !important; }
.oe-negative-text { color:#78a9ff !important; }
.oe-table-section-heading { margin-top:32px; }
.oe-table-panel { overflow:hidden; }
.oe-table-toolbar { display:flex; align-items:center; gap:10px; padding:15px 17px 12px; }
.oe-search { display:flex; align-items:center; gap:9px; flex:1; min-width:150px; height:38px; padding:0 11px; border:1px solid var(--oe-border); border-radius:9px; background:var(--oe-raised); color:var(--oe-muted); }
.oe-search:focus-within { border-color:var(--oe-cyan); box-shadow:0 0 0 3px rgba(66,217,232,.07); }
.oe-search input { flex:1; min-width:0; border:0; outline:none; background:transparent; color:var(--oe-text); font-size:10px; }
.oe-search input::placeholder { color:var(--oe-muted); }
.oe-search button { border:0; background:none; color:var(--oe-cyan); font-size:9px; }
.oe-filter-control { display:flex; align-items:center; gap:7px; height:38px; padding:0 10px; border:1px solid var(--oe-border); border-radius:9px; background:var(--oe-raised); color:var(--oe-muted); }
.oe-filter-control select { max-width:175px; border:0; outline:none; color:var(--oe-text); background:transparent; font-size:10px; }
.oe-filter-control option { background:var(--oe-panel); color:var(--oe-text); }
.oe-table-meta { display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:0 17px 13px; color:var(--oe-muted); font-size:9px; }
.oe-table-meta strong { color:var(--oe-text); }
.oe-meta-separator { margin:0 7px; }
.oe-table-scroll { width:100%; overflow-x:auto; }
.oe-table { width:100%; border-collapse:collapse; text-align:left; white-space:nowrap; }
.oe-table thead { background:var(--oe-raised); }
.oe-table th { padding:13px 15px; color:var(--oe-muted); font-size:9px; text-transform:uppercase; letter-spacing:.55px; font-weight:750; border-top:1px solid var(--oe-border); border-bottom:1px solid var(--oe-border); }
.oe-table td { padding:13px 15px; border-bottom:1px solid var(--oe-border); font-size:10px; color:var(--oe-text); }
.oe-table tbody tr { animation:oeFade .3s ease both; transition:background .2s ease; }
.oe-table tbody tr:hover { background:rgba(66,217,232,.035); }
.oe-table tbody tr:last-child td { border-bottom:0; }
.oe-time-cell { color:var(--oe-muted) !important; }
.oe-temp-cell { font-weight:750; }
.oe-status-pill { display:inline-flex; padding:5px 8px; border:1px solid transparent; border-radius:6px; font-size:9px; font-weight:750; }
.oe-status-pill.positive { color:#ff8798; background:rgba(255,107,129,.09); border-color:rgba(255,107,129,.2); }
.oe-status-pill.negative { color:#8ab8ff; background:rgba(87,152,255,.1); border-color:rgba(87,152,255,.22); }
.oe-status-pill.normal { color:var(--oe-green); background:rgba(83,223,176,.08); border-color:rgba(83,223,176,.2); }
.oe-status-pill.unknown { color:var(--oe-muted); background:var(--oe-raised); border-color:var(--oe-border); }
.oe-table-empty { height:160px; text-align:center !important; color:var(--oe-muted) !important; }
.oe-table-empty svg { vertical-align:middle; margin-right:8px; }
.oe-table-empty strong, .oe-table-empty span { display:block; margin:8px 0; }
.oe-table-empty .oe-secondary-button { margin-top:7px; }
.oe-pagination { display:flex; align-items:center; justify-content:space-between; padding:13px 17px; border-top:1px solid var(--oe-border); color:var(--oe-muted); font-size:10px; }
.oe-pagination strong { color:var(--oe-text); }
.oe-pagination > div { display:flex; gap:7px; }
.oe-secondary-button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:35px; padding:0 12px; border:1px solid var(--oe-border); border-radius:9px; color:var(--oe-text); background:var(--oe-raised); font-size:10px !important; font-weight:700 !important; transition:all .2s ease; }
.oe-secondary-button:hover { border-color:var(--oe-cyan); color:var(--oe-cyan); }
.oe-disclaimer { display:flex; align-items:flex-start; gap:9px; padding:12px 14px; margin-top:15px; border:1px solid var(--oe-border); border-radius:10px; color:var(--oe-muted); background:var(--oe-panel); font-size:9px; line-height:1.7; }
.oe-disclaimer svg { flex:0 0 15px; color:#ffb86b; margin-top:1px; }
.oe-footer { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:21px 2px 2px; color:var(--oe-muted); font-size:9px; }
.oe-footer > div { display:flex; align-items:center; gap:8px; }
.oe-footer svg { color:var(--oe-cyan); }
.oe-footer strong { color:var(--oe-text); font-size:11px; }
.oe-spin { animation:oeSpin 1s linear infinite; }
@keyframes oeFade { from { opacity:0; } to { opacity:1; } }
@keyframes oeRise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
@keyframes oePulse { 0%,100% { opacity:1; } 50% { opacity:.48; } }
@keyframes oeOrbit { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
@keyframes oeSpin { to { transform:rotate(360deg); } }
@keyframes oeSkeleton { from { opacity:.45; } to { opacity:1; } }
@media (max-width:1100px) {
  .oe-main { padding:20px; }
  .oe-metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .oe-chart-grid { grid-template-columns:minmax(0,1fr); }
  .oe-hero-visual { margin-right:0; transform:scale(.85); }
  .oe-local-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media (max-width:650px) {
  .oe-topbar { padding:13px 14px; }
  .oe-workspace-status { display:none; }
  .oe-main { padding:14px; }
  .oe-hero { min-height:0; padding:23px 19px; }
  .oe-hero-visual { display:none; }
  .oe-hero h1 { font-size:30px; }
  .oe-hero-copy > p { font-size:11px; }
  .oe-hero-meta { gap:10px; }
  .oe-metric-grid { gap:9px; margin:14px 0 24px; }
  .oe-metric-card { padding:13px; gap:8px; }
  .oe-metric-value { font-size:21px; }
  .oe-metric-detail { font-size:8px; }
  .oe-section-heading { align-items:flex-start; flex-direction:column; }
  .oe-section-heading h2 { font-size:18px; }
  .oe-map-container { height:350px; }
  .oe-map-footnote { gap:10px; }
  .oe-map-disclaimer { margin-left:0; flex-basis:100%; }
  .oe-chart-panel { padding:14px; }
  .oe-chart { height:225px; }
  .oe-distribution-chart { height:230px; }
  .oe-local-stats { gap:9px; }
  .oe-local-stat { padding:13px; }
  .oe-local-stat strong { font-size:20px; }
  .oe-table-toolbar { flex-wrap:wrap; padding:12px; }
  .oe-search { flex-basis:100%; }
  .oe-filter-control { flex:1; min-width:0; }
  .oe-filter-control select { flex:1; min-width:0; max-width:none; }
  .oe-footer { align-items:flex-start; flex-direction:column; }
}
@media (prefers-reduced-motion:reduce) {
  .oe-page *, .oe-page *::before, .oe-page *::after {
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
    scroll-behavior:auto !important;
  }
}
`;
