
from pathlib import Path

import pandas as pd

from database import get_connection
from dataset_service import read_dataset


def import_csv_dataset(file_path: str) -> dict:
    path = Path(file_path)
    df = read_dataset(str(path))

    if df.empty:
        raise ValueError("The dataset contains no valid observations.")

    records = []

    for row in df.itertuples(index=False, name=None):
        (
            observation_time,
            latitude,
            longitude,
            sea_surface_temperature,
            temperature_anomaly,
        ) = row[:5]

        def clean_number(value):
            if pd.isna(value):
                return None
            return float(value)

        anomaly_value = clean_number(temperature_anomaly)

        is_anomaly = (
            anomaly_value is not None
            and abs(anomaly_value) >= 2.0
        )

        # Add each observation exactly once.
        records.append(
            (
                str(observation_time),
                float(latitude),
                float(longitude),
                clean_number(sea_surface_temperature),
                anomaly_value,
                path.name,
                int(is_anomaly),
            )
        )

    anomaly_count = sum(record[6] for record in records)

    with get_connection() as connection:
        connection.executemany(
            """
            INSERT INTO observations (
                observation_time,
                latitude,
                longitude,
                sea_surface_temperature,
                temperature_anomaly,
                source,
                is_anomaly
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            records,
        )

        connection.execute(
            """
            INSERT INTO processing_history (
                filename,
                records_processed,
                anomalies_found,
                status
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                path.name,
                len(records),
                anomaly_count,
                "completed",
            ),
        )

        connection.commit()

    return {
        "status": "completed",
        "filename": path.name,
        "records_imported": len(records),
        "anomalies_found": anomaly_count,
        "anomaly_rule": (
            "Absolute temperature anomaly >= 2.0 degrees"
        ),
        "message": "Dataset imported successfully.",
    }
