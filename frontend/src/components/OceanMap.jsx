
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

function FitMapToObservations({ observations }) {
  const map = useMap();

  useEffect(() => {
    const points = observations
      .filter((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);

        return (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        );
      })
      .map((item) => [
        Number(item.latitude),
        Number(item.longitude),
      ]);

    if (points.length > 0) {
      map.fitBounds(points, {
        padding: [30, 30],
        maxZoom: 5,
      });
    }
  }, [map, observations]);

  return null;
}

function getTemperatureColor(anomaly) {
  const value = Number(anomaly);

  if (value >= 2) return "#ff657a";
  if (value <= -2) return "#5798ff";
  return "#42d9e8";
}

export default function OceanMap({ observations = [] }) {
  const [filter, setFilter] = useState("all");

  const validObservations = useMemo(() => {
    return observations.filter((item) => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);

      return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      );
    });
  }, [observations]);

  const filteredObservations = useMemo(() => {
    return validObservations.filter((item) => {
      const anomaly = Number(item.temperature_anomaly);

      if (filter === "all") return true;
      if (!Number.isFinite(anomaly)) return false;
      if (filter === "positive") return anomaly >= 2;
      if (filter === "negative") return anomaly <= -2;
      if (filter === "normal") return anomaly > -2 && anomaly < 2;

      return true;
    });
  }, [validObservations, filter]);
  
const mapStatistics = useMemo(() => {
  let positive = 0;
  let negative = 0;
  let normal = 0;
  let unavailable = 0;

  validObservations.forEach((item) => {
    const anomaly = Number(item.temperature_anomaly);

    if (!Number.isFinite(anomaly)) {
      unavailable++;
    } else if (anomaly >= 2) {
      positive++;
    } else if (anomaly <= -2) {
      negative++;
    } else {
      normal++;
    }
  });

  return {
    total: validObservations.length,
    positive,
    negative,
    normal,
    unavailable,
  };
}, [validObservations]);


  return (
    <section className="panel ocean-map-panel">
      <div className="panel-header">
        <div>
          <h2>Ocean Observation Map</h2>
          <p>
            Explore geographic observations from the imported dataset.
          </p>
        </div>

        <span className="map-record-count">
          {filteredObservations.length} locations
        </span>
      </div>

      <div className="map-filter-controls">
        
<div className="map-statistics">
  <div className="map-stat-card">
    <span>Total mapped</span>
    <strong>{mapStatistics.total}</strong>
  </div>

  <div className="map-stat-card positive">
    <span>Positive anomalies</span>
    <strong>{mapStatistics.positive}</strong>
  </div>

  <div className="map-stat-card negative">
    <span>Negative anomalies</span>
    <strong>{mapStatistics.negative}</strong>
  </div>

  <div className="map-stat-card normal">
    <span>Other observations</span>
    <strong>{mapStatistics.normal}</strong>
  </div>
</div>

        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All observations
        </button>

        <button
          className={filter === "positive" ? "active" : ""}
          onClick={() => setFilter("positive")}
        >
          Positive anomalies
        </button>

        <button
          className={filter === "negative" ? "active" : ""}
          onClick={() => setFilter("negative")}
        >
          Negative anomalies
        </button>

        <button
          className={filter === "normal" ? "active" : ""}
          onClick={() => setFilter("normal")}
        >
          Normal observations
        </button>
      </div>

      <div className="ocean-map-container">
        <MapContainer
          center={[0, 0]}
          zoom={2}
          scrollWheelZoom
          className="ocean-map"
        >
          <MapResizeHandler />

          <FitMapToObservations
            observations={filteredObservations}
          />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredObservations.map((item, index) => {
            const anomaly = Number(item.temperature_anomaly);
            const color = getTemperatureColor(anomaly);

            const latitude = Number(item.latitude);
            const longitude = Number(item.longitude);
            const temperature = Number(
              item.sea_surface_temperature
            );

            return (
              <CircleMarker
                key={
                  item.id ??
                  `${latitude}-${longitude}-${index}`
                }
                center={[latitude, longitude]}
                radius={
                  Number.isFinite(anomaly) &&
                  Math.abs(anomaly) >= 2
                    ? 6
                    : 3
                }
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.75,
                  weight: 1,
                }}
              >
                <Popup>
                  <strong>Ocean Observation</strong>
                  <br />
                  Time: {item.observation_time ?? "Unavailable"}
                  <br />
                  Latitude: {latitude.toFixed(3)}
                  <br />
                  Longitude: {longitude.toFixed(3)}
                  <br />
                  Sea Surface Temperature:{" "}
                  {Number.isFinite(temperature)
                    ? `${temperature.toFixed(2)} °C`
                    : "Unavailable"}
                  <br />
                  Temperature Anomaly:{" "}
                  {Number.isFinite(anomaly)
                    ? `${anomaly.toFixed(2)} °C`
                    : "Unavailable"}
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="map-legend">
        <span>
          <i className="legend-dot legend-positive" />
          Positive anomaly ≥ +2°C
        </span>

        <span>
          <i className="legend-dot legend-negative" />
          Negative anomaly ≤ −2°C
        </span>

        <span>
          <i className="legend-dot legend-normal" />
          Other observations
        </span>
      </div>

      <p className="map-disclaimer">
        Anomaly categories use a ±2°C screening threshold. They do not
        independently confirm ocean hazards.
      </p>
    </section>
  );
}
