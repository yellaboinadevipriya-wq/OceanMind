import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  ScaleControl,
  TileLayer,
  useMap,
} from "react-leaflet";
import { api } from "../services/api";
import "leaflet/dist/leaflet.css";

const LAYERS = {
  Terra: "MODIS_Terra_CorrectedReflectance_TrueColor",
  Aqua: "MODIS_Aqua_CorrectedReflectance_TrueColor",
  VIIRS: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
};

const REGIONS = {
  "Indian Ocean": { center: [-12, 78], zoom: 3 },
  "Arabian Sea": { center: [18, 64], zoom: 4 },
  "Bay of Bengal": { center: [14, 88], zoom: 4 },
  Global: { center: [10, 0], zoom: 2 },
};

function utcDate(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function MapView({ region }) {
  const map = useMap();

  useEffect(() => {
    const view = REGIONS[region] || REGIONS["Indian Ocean"];
    map.setView(view.center, view.zoom);
  }, [map, region]);

  return null;
}

function pointColor(point, colorMode) {
  if (colorMode === "anomaly") {
    return Number(point.is_anomaly) === 1 ? "#ff5364" : "#35d6a0";
  }

  const sst = point.sea_surface_temperature;
  if (sst == null || !Number.isFinite(Number(sst))) return "#aeb9ca";
  if (Number(sst) < 5) return "#508cff";
  if (Number(sst) < 15) return "#35d6d0";
  if (Number(sst) < 25) return "#ffb454";
  return "#ff5964";
}

function formatNumber(value, digits = 2) {
  return value == null || !Number.isFinite(Number(value))
    ? "Unavailable"
    : Number(value).toFixed(digits);
}

function downloadCsv(filename, rows) {
  if (!rows.length) {
    window.alert("There are no records to export.");
    return;
  }

  const columns = [
    "id",
    "observation_time",
    "latitude",
    "longitude",
    "sea_surface_temperature",
    "temperature_anomaly",
    "is_anomaly",
    "source",
  ];

  const escapeCell = (value) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((key) => escapeCell(row[key])).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ObservationMap({
  date,
  layer,
  region,
  points,
  colorMode,
  onRecord,
  title,
}) {
  const tileUrl =
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}` +
    `/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

  const view = REGIONS[region] || REGIONS["Indian Ocean"];

  return (
    <div className="om-map-card">
      <div className="om-map-heading">
        <div>
          <strong>{title}</strong>
          <div className="om-muted">{date} · {region}</div>
        </div>
        <span className="om-live-label">NASA GIBS</span>
      </div>

      <MapContainer
        center={view.center}
        zoom={view.zoom}
        scrollWheelZoom
        className="om-leaflet-map"
      >
        <MapView region={region} />
        <TileLayer
          attribution='Imagery: <a href="https://earthdata.nasa.gov/">NASA GIBS</a>'
          url={tileUrl}
          maxZoom={9}
        />
        <ScaleControl position="bottomleft" />

        {points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[Number(point.latitude), Number(point.longitude)]}
            radius={Number(point.is_anomaly) === 1 ? 7 : 4}
            pathOptions={{
              color: pointColor(point, colorMode),
              fillColor: pointColor(point, colorMode),
              fillOpacity: 0.82,
              weight: Number(point.is_anomaly) === 1 ? 2 : 1,
            }}
          >
            <Popup>
              <div className="om-popup">
                <strong>Observation #{point.id}</strong>
                <div>Date: {point.observation_time || "Unavailable"}</div>
                <div>Latitude: {formatNumber(point.latitude, 4)}</div>
                <div>Longitude: {formatNumber(point.longitude, 4)}</div>
                <div>SST: {formatNumber(point.sea_surface_temperature)} °C</div>
                <div>Anomaly: {formatNumber(point.temperature_anomaly)} °C</div>
                <div>Flagged: {Number(point.is_anomaly) === 1 ? "Yes" : "No"}</div>
                <div>Wave height: Unavailable in this dataset</div>
                <div>Source: {point.source || "Unavailable"}</div>
                <button
                  type="button"
                  className="om-small-button"
                  onClick={() => onRecord(point.id)}
                >
                  Load database record
                </button>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

const styles = `
.satellite-workspace{color:var(--text-primary,#e8edf7);display:grid;gap:18px}
.om-panel,.om-stat,.om-map-card{background:var(--surface-card,rgba(18,28,45,.82));border:1px solid var(--border-color,rgba(150,170,200,.2));border-radius:15px;padding:16px;min-width:0}
.om-controls{display:flex;flex-wrap:wrap;align-items:end;gap:12px}
.om-field{display:grid;gap:6px;min-width:140px;flex:1}
.om-field label,.om-muted{font-size:12px;color:var(--text-secondary,#a4b2c8)}
.om-field select,.om-field input{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid var(--border-color,#334155);background:var(--surface-input,#101a2a);color:inherit;padding:9px}
.om-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.om-button,.om-small-button{border:1px solid #3a8dba;background:#153f58;color:#e9f7ff;border-radius:8px;padding:9px 12px;cursor:pointer}
.om-small-button{padding:6px 8px;margin-top:7px;font-size:12px}
.om-button:disabled{opacity:.5;cursor:not-allowed}
.om-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.om-stat small{display:block;color:var(--text-secondary,#a4b2c8);margin-bottom:8px}
.om-stat strong{font-size:23px;overflow-wrap:anywhere}
.om-maps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.om-map-card{padding:0;overflow:hidden}
.om-map-heading{padding:12px 14px;display:flex;justify-content:space-between;gap:8px;align-items:center}
.om-map-heading strong{display:block;margin-bottom:4px}
.om-live-label{font-size:10px;letter-spacing:.08em;color:#5fe1b1}
.om-leaflet-map{height:380px;width:100%;background:#0c1728}
.om-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text-secondary,#a4b2c8)}
.om-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}
.om-alert{border-radius:9px;padding:10px 12px;background:rgba(50,130,170,.12);border:1px solid rgba(80,160,210,.28);font-size:13px;line-height:1.5}
.om-error{color:#ff939d}
.om-predictions{display:grid;gap:8px}
.om-prediction{display:flex;justify-content:space-between;gap:12px;padding:9px;border-radius:8px;background:rgba(100,130,170,.1)}
.om-bar{height:5px;background:#26384e;border-radius:9px;margin-top:5px;overflow:hidden}
.om-bar span{display:block;height:100%;background:#55d6ad}
.om-record{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:240px;overflow:auto}
.om-popup{font-size:12px;line-height:1.6;min-width:190px}
@media(max-width:900px){.om-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.om-maps{grid-template-columns:1fr}.om-leaflet-map{height:330px}}
@media print{
  .om-controls,.om-actions,.om-upload,.om-no-print,.om-small-button{display:none!important}
  .satellite-workspace{color:#111;gap:10px}
  .om-panel,.om-stat,.om-map-card{background:#fff!important;color:#111!important;border:1px solid #ccc;break-inside:avoid}
  .om-stats{grid-template-columns:repeat(4,minmax(0,1fr))}
  .om-maps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .om-leaflet-map{height:280px;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  .om-muted,.om-field label,.om-legend{color:#444!important}
  .leaflet-control-container{display:none}
}
`;

export default function SatelliteImagery() {
  const [dateA, setDateA] = useState(utcDate(3));
  const [dateB, setDateB] = useState(utcDate(1));
  const [layerName, setLayerName] = useState("Terra");
  const [region, setRegion] = useState("Indian Ocean");
  const [colorMode, setColorMode] = useState("anomaly");
  const [points, setPoints] = useState([]);
  const [anomalySummary, setAnomalySummary] = useState(null);
  const [visionStatus, setVisionStatus] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [record, setRecord] = useState(null);
  const [recordError, setRecordError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [sample, anomalyFirst, anomalySecond, summary, vision] =
        await Promise.all([
          api.mapObservations(1000),
          api.anomalies(1000, 0),
          api.anomalies(1000, 1000),
          api.anomalySummary(),
          api.visionStatus().catch(() => null),
        ]);

      const merged = new Map();

      for (const item of sample.observations || []) {
        merged.set(item.id, item);
      }

      for (const item of [
        ...(anomalyFirst.anomalies || []),
        ...(anomalySecond.anomalies || []),
      ]) {
        merged.set(item.id, { ...merged.get(item.id), ...item, is_anomaly: 1 });
      }

      setPoints([...merged.values()].filter((item) =>
        Number.isFinite(Number(item.latitude)) &&
        Number.isFinite(Number(item.longitude))
      ));
      setAnomalySummary(summary);
      setVisionStatus(vision);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Could not load observation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const layer = LAYERS[layerName];

  const stats = useMemo(() => {
    const temperatures = points
      .map((point) => Number(point.sea_surface_temperature))
      .filter((value) => Number.isFinite(value));

    const mean = temperatures.length
      ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
      : null;

    return {
      loaded: points.length,
      flagged: points.filter((point) => Number(point.is_anomaly) === 1).length,
      mean,
      numericTemperatures: temperatures.length,
    };
  }, [points]);

  const flaggedPoints = useMemo(
    () => points.filter((point) => Number(point.is_anomaly) === 1),
    [points]
  );

  async function loadRecord(id) {
    setRecord(null);
    setRecordError("");
    try {
      setRecord(await api.observation(id));
    } catch (err) {
      setRecordError(err.message || "Could not load that database record.");
    }
  }

  async function runImageAnalysis(event) {
    event.preventDefault();
    if (!imageFile) {
      setError("Choose a JPEG, PNG, or WEBP image first.");
      return;
    }

    setAnalyzing(true);
    setAnalysis(null);
    setError("");

    try {
      setAnalysis(await api.analyzeImage(imageFile));
    } catch (err) {
      setError(err.message || "Image analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  const reportTime = lastUpdated
    ? lastUpdated.toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="satellite-workspace">
      <style>{styles}</style>

      <section className="om-panel">
        <h2 style={{ marginTop: 0 }}>Satellite intelligence workspace</h2>
        <p className="om-muted">
          Compare NASA GIBS imagery, inspect recorded ocean observations,
          monitor database anomalies, and optionally submit an image to a
          configured vision model.
        </p>

        <div className="om-controls">
          <div className="om-field">
            <label htmlFor="om-date-a">Comparison date A</label>
            <input id="om-date-a" type="date" value={dateA}
              onChange={(event) => setDateA(event.target.value)} />
          </div>
          <div className="om-field">
            <label htmlFor="om-date-b">Comparison date B</label>
            <input id="om-date-b" type="date" value={dateB}
              onChange={(event) => setDateB(event.target.value)} />
          </div>
          <div className="om-field">
            <label htmlFor="om-layer">NASA imagery layer</label>
            <select id="om-layer" value={layerName}
              onChange={(event) => setLayerName(event.target.value)}>
              {Object.keys(LAYERS).map((name) =>
                <option key={name} value={name}>{name}</option>
              )}
            </select>
          </div>
          <div className="om-field">
            <label htmlFor="om-region">Map region</label>
            <select id="om-region" value={region}
              onChange={(event) => setRegion(event.target.value)}>
              {Object.keys(REGIONS).map((name) =>
                <option key={name} value={name}>{name}</option>
              )}
            </select>
          </div>
          <div className="om-field">
            <label htmlFor="om-color">Observation color</label>
            <select id="om-color" value={colorMode}
              onChange={(event) => setColorMode(event.target.value)}>
              <option value="anomaly">Anomaly flag</option>
              <option value="sst">Sea surface temperature</option>
            </select>
          </div>
        </div>

        <div className="om-actions om-no-print" style={{ marginTop: 14 }}>
          <button className="om-button" onClick={loadData} disabled={loading}>
            {loading ? "Loading data…" : "Refresh observations"}
          </button>
          <button className="om-button"
            onClick={() => downloadCsv("oceanmind-observations.csv", points)}>
            Export observation CSV
          </button>
          <button className="om-button"
            onClick={() => downloadCsv("oceanmind-anomalies.csv", flaggedPoints)}>
            Export anomaly CSV
          </button>
          <button className="om-button" onClick={() => window.print()}>
            Print / Save report as PDF
          </button>
        </div>

        {error && <p className="om-error" role="alert">{error}</p>}
        {lastUpdated && <p className="om-muted">Data loaded: {reportTime}</p>}
      </section>

      <section className="om-stats">
        <div className="om-stat">
          <small>Unique points loaded</small>
          <strong>{loading ? "…" : stats.loaded.toLocaleString()}</strong>
        </div>
        <div className="om-stat">
          <small>Database anomaly records</small>
          <strong>{anomalySummary?.anomaly_count?.toLocaleString?.() ?? "—"}</strong>
        </div>
        <div className="om-stat">
          <small>Mean SST of loaded points (°C)</small>
          <strong>{formatNumber(stats.mean)}</strong>
          <small>Based on {stats.numericTemperatures} numeric SST values</small>
        </div>
        <div className="om-stat">
          <small>Max flagged absolute anomaly (°C)</small>
          <strong>{formatNumber(anomalySummary?.maximum_absolute_anomaly_celsius)}</strong>
          <small>Backend anomaly rule: |anomaly| ≥ 2 °C</small>
        </div>
      </section>

      <section className="om-panel">
        <h3 style={{ marginTop: 0 }}>Satellite date comparison</h3>
        <p className="om-muted">
          These panels show imagery for the selected dates. The observation
          timestamps come from the dataset and may not match the imagery date.
          Historical observations are not automatically detected from these tiles.
        </p>
        <div className="om-maps">
          <ObservationMap title="Image A" date={dateA} layer={layer}
            region={region} points={points} colorMode={colorMode} onRecord={loadRecord} />
          <ObservationMap title="Image B" date={dateB} layer={layer}
            region={region} points={points} colorMode={colorMode} onRecord={loadRecord} />
        </div>
        <div className="om-legend" style={{ marginTop: 12 }}>
          <span><i className="om-dot" style={{ background: "#ff5364" }} />Flagged anomaly</span>
          <span><i className="om-dot" style={{ background: "#35d6a0" }} />Not flagged</span>
          <span><i className="om-dot" style={{ background: "#aeb9ca" }} />SST unavailable</span>
        </div>
        <p className="om-muted">
          Map markers combine the geographic sample from the database with
          flagged anomaly records. They are not all 192,000 database records.
          Wave height is not available in the current dataset.
        </p>
      </section>

      <section className="om-panel">
        <h3 style={{ marginTop: 0 }}>Anomaly monitoring</h3>
        <p>
          The backend reports <strong>{anomalySummary?.anomaly_count ?? "—"}</strong>
          {" "}records meeting its anomaly criteria.
          {` ${flaggedPoints.length.toLocaleString()} flagged points are currently available in the map dataset.`}
        </p>
        <p className="om-muted">
          Average absolute flagged anomaly:{" "}
          {formatNumber(anomalySummary?.average_flagged_anomaly_celsius)} °C.
          These flags originate from stored SST anomaly values, not from AI
          detection of the displayed satellite imagery.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Record", "Observation time", "Latitude", "Longitude", "SST °C", "Anomaly °C", "Source"].map((heading) =>
                  <th key={heading} style={{ textAlign: "left", padding: 9, borderBottom: "1px solid #405066" }}>{heading}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {flaggedPoints.slice(0, 12).map((point) =>
                <tr key={point.id}>
                  <td style={{ padding: 9 }}>{point.id}</td>
                  <td style={{ padding: 9 }}>{point.observation_time}</td>
                  <td style={{ padding: 9 }}>{formatNumber(point.latitude, 3)}</td>
                  <td style={{ padding: 9 }}>{formatNumber(point.longitude, 3)}</td>
                  <td style={{ padding: 9 }}>{formatNumber(point.sea_surface_temperature)}</td>
                  <td style={{ padding: 9 }}>{formatNumber(point.temperature_anomaly)}</td>
                  <td style={{ padding: 9 }}>{point.source || "—"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {flaggedPoints.length > 12 &&
          <p className="om-muted">Showing 12 of {flaggedPoints.length} flagged points loaded. Export the anomaly CSV for all loaded flagged points.</p>
        }
      </section>

      <section className="om-panel">
        <h3 style={{ marginTop: 0 }}>AI satellite-image classification</h3>
        <div className="om-alert">
          {visionStatus?.configured
            ? `Inference service configured. Model: ${visionStatus.model}. This is general-purpose classification, not a validated marine hazard detector.`
            : "Image inference requires the backend HF_TOKEN environment variable. The model is not reported as available until the backend confirms configuration."}
        </div>
        <form className="om-upload" onSubmit={runImageAnalysis} style={{ marginTop: 14 }}>
          <div className="om-controls">
            <div className="om-field">
              <label htmlFor="om-image">Choose image (JPEG, PNG, WEBP; max 10 MB)</label>
              <input id="om-image" type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  setImageFile(event.target.files?.[0] || null);
                  setAnalysis(null);
                }} />
            </div>
            <button className="om-button" type="submit" disabled={analyzing || !imageFile}>
              {analyzing ? "Analyzing…" : "Analyze image"}
            </button>
          </div>
        </form>

        {analysis && (
          <div style={{ marginTop: 14 }}>
            <h4>Actual model predictions · {analysis.model}</h4>
            <div className="om-alert">{analysis.notice}</div>
            <div className="om-predictions" style={{ marginTop: 10 }}>
              {analysis.predictions.map((prediction, index) =>
                <div className="om-prediction" key={`${prediction.label}-${index}`}>
                  <div style={{ flex: 1 }}>
                    <strong>{prediction.label}</strong>
                    <div className="om-bar">
                      <span style={{ width: `${prediction.score * 100}%` }} />
                    </div>
                  </div>
                  <strong>{(prediction.score * 100).toFixed(1)}%</strong>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {(record || recordError) && (
        <section className="om-panel">
          <div className="om-actions">
            <h3 style={{ margin: 0, flex: 1 }}>Database record details</h3>
            <button className="om-button om-no-print" onClick={() => { setRecord(null); setRecordError(""); }}>
              Close
            </button>
          </div>
          {recordError && <p className="om-error">{recordError}</p>}
          {record && <pre className="om-record">{JSON.stringify(record, null, 2)}</pre>}
        </section>
      )}

      <section className="om-panel">
        <h3 style={{ marginTop: 0 }}>Report notes and limitations</h3>
        <ul>
          <li>Imagery source: NASA GIBS WMTS true-colour layers.</li>
          <li>Database observations retain their own historical timestamps.</li>
          <li>Map sampling is geographic; it is not a complete display of the full dataset.</li>
          <li>Wave height is not included in the current database schema.</li>
          <li>AI results, when configured, are general-purpose image-classification output and are not scientific ocean measurements.</li>
          <li>Use Print / Save report as PDF and choose “Save as PDF” in your browser. Whether map tiles appear in the PDF depends on browser printing and tile loading.</li>
        </ul>
        <p className="om-muted">Report generated: {reportTime}</p>
      </section>
    </div>
  );
}
