
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from database import DATABASE_PATH, get_connection, initialize_database
from import_service import import_csv_dataset
from enhancements import router as enhancements_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    print(f"OceanMind database ready: {DATABASE_PATH}")
    yield


app = FastAPI(
    title="OceanMind API",
    description="Ocean intelligence and anomaly analysis platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(enhancements_router)


# CORS: Allow local development and the deployed Netlify frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://luxury-lebkuchen-eb14b9.netlify.app",
        "https://yellaboinadevipriya-wq.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "project": "OceanMind",
        "message": "OceanMind backend is running",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "OceanMind API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/database/status")
def database_status():
    with get_connection() as connection:
        observation_count = connection.execute(
            "SELECT COUNT(*) FROM observations"
        ).fetchone()[0]

        history_count = connection.execute(
            "SELECT COUNT(*) FROM processing_history"
        ).fetchone()[0]

    return {
        "status": "connected",
        "database": DATABASE_PATH.name,
        "observations": observation_count,
        "processing_jobs": history_count,
    }


@app.post("/database/import-default-dataset")
def import_default_dataset():
    dataset_path = Path.home() / "Downloads" / "Ocean_sst.csv"

    if not dataset_path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"Dataset not found: {dataset_path}",
        )

    try:
        return import_csv_dataset(str(dataset_path))
    except (ValueError, OSError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/dashboard/summary")
def dashboard_summary():
    with get_connection() as connection:
        stats = connection.execute("""
            SELECT
                COUNT(*) AS total_observations,
                AVG(sea_surface_temperature) AS average_sst,
                AVG(temperature_anomaly) AS average_anomaly,
                SUM(is_anomaly) AS anomaly_count,
                COUNT(DISTINCT source) AS dataset_count
            FROM observations
        """).fetchone()

        history_count = connection.execute(
            "SELECT COUNT(*) FROM processing_history"
        ).fetchone()[0]

    total = stats["total_observations"] or 0
    anomalies = stats["anomaly_count"] or 0

    return {
        "total_observations": total,
        "average_sst_celsius": (
            round(stats["average_sst"], 3)
            if stats["average_sst"] is not None
            else None
        ),
        "average_temperature_anomaly_celsius": (
            round(stats["average_anomaly"], 3)
            if stats["average_anomaly"] is not None
            else None
        ),
        "anomaly_count": anomalies,
        "anomaly_percentage": (
            round(anomalies * 100 / total, 2) if total else 0
        ),
        "dataset_count": stats["dataset_count"] or 0,
        "processing_jobs": history_count,
    }


@app.get("/database/observations")
def list_observations(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                id,
                observation_time,
                latitude,
                longitude,
                sea_surface_temperature,
                temperature_anomaly,
                source,
                is_anomaly
            FROM observations
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        """, (limit, offset)).fetchall()

        total = connection.execute(
            "SELECT COUNT(*) FROM observations"
        ).fetchone()[0]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "observations": [dict(row) for row in rows],
    }


@app.get("/database/map-observations")
def map_observations(
    limit: int = Query(default=1000, ge=1, le=5000),
):
    """Return observations sampled across geographic grid cells."""
    with get_connection() as connection:
        rows = connection.execute("""
            WITH ranked_observations AS (
                SELECT
                    id,
                    observation_time,
                    latitude,
                    longitude,
                    sea_surface_temperature,
                    temperature_anomaly,
                    source,
                    is_anomaly,
                    ROW_NUMBER() OVER (
                        PARTITION BY
                            CAST((latitude + 90) / 10 AS INTEGER),
                            CAST((longitude + 180) / 10 AS INTEGER)
                        ORDER BY id
                    ) AS location_rank
                FROM observations
                WHERE latitude BETWEEN -90 AND 90
                  AND longitude BETWEEN -180 AND 180
            )
            SELECT
                id,
                observation_time,
                latitude,
                longitude,
                sea_surface_temperature,
                temperature_anomaly,
                source,
                is_anomaly
            FROM ranked_observations
            WHERE location_rank = 1
            ORDER BY
                CAST((latitude + 90) / 10 AS INTEGER),
                CAST((longitude + 180) / 10 AS INTEGER)
            LIMIT ?
        """, (limit,)).fetchall()

    return {
        "total": len(rows),
        "sampling_method": (
            "One observation per 10-degree geographic grid cell"
        ),
        "observations": [dict(row) for row in rows],
    }


@app.get("/anomalies/summary")
def anomaly_summary():
    with get_connection() as connection:
        result = connection.execute("""
            SELECT
                COUNT(*) AS total,
                AVG(ABS(temperature_anomaly))
                    AS average_absolute_anomaly,
                MAX(ABS(temperature_anomaly))
                    AS maximum_absolute_anomaly
            FROM observations
            WHERE is_anomaly = 1
              AND ABS(temperature_anomaly) >= 2.0
        """).fetchone()

    return {
        "anomaly_count": result["total"] or 0,
        "average_flagged_anomaly_celsius": (
            round(result["average_absolute_anomaly"], 3)
            if result["average_absolute_anomaly"] is not None
            else None
        ),
        "maximum_absolute_anomaly_celsius": (
            round(result["maximum_absolute_anomaly"], 3)
            if result["maximum_absolute_anomaly"] is not None
            else None
        ),
        "method": "Absolute temperature anomaly >= 2.0°C",
    }


@app.get("/anomalies/records")
def anomaly_records(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                id,
                observation_time,
                latitude,
                longitude,
                sea_surface_temperature,
                temperature_anomaly,
                source
            FROM observations
            WHERE is_anomaly = 1
            ORDER BY ABS(temperature_anomaly) DESC
            LIMIT ? OFFSET ?
        """, (limit, offset)).fetchall()

        total = connection.execute(
            "SELECT COUNT(*) FROM observations WHERE is_anomaly = 1"
        ).fetchone()[0]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "anomalies": [dict(row) for row in rows],
    }


@app.get("/admin/processing-history")
def processing_history(
    limit: int = Query(default=50, ge=1, le=500),
):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                id,
                filename,
                records_processed,
                anomalies_found,
                status,
                created_at
            FROM processing_history
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

    return {"jobs": [dict(row) for row in rows]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
