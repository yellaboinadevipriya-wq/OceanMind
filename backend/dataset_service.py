
import csv
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = {
    "time",
    "latitude",
    "longitude",
    "sst",
    "anom",
}


def inspect_dataset(file_path: str) -> dict:
    """Inspect a CSV file without importing all its rows."""

    path = Path(file_path)

    if not path.is_file():
        raise FileNotFoundError(f"Dataset not found: {path}")

    if path.suffix.lower() != ".csv":
        raise ValueError("Only CSV datasets are supported.")

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.reader(file)
        headers = next(reader, [])

    normalized_headers = {
        header.strip().lower() for header in headers
    }

    missing = sorted(REQUIRED_COLUMNS - normalized_headers)

    if missing:
        raise ValueError(
            "Missing required columns: " + ", ".join(missing)
        )

    sample = pd.read_csv(path, nrows=5)

    return {
        "filename": path.name,
        "size_bytes": path.stat().st_size,
        "columns": [str(column) for column in sample.columns],
        "required_columns_found": True,
        "sample_rows": sample.fillna("").to_dict(orient="records"),
    }


def read_dataset(file_path: str) -> pd.DataFrame:
    """Load and normalize the required ocean observation columns."""

    info = inspect_dataset(file_path)
    del info

    df = pd.read_csv(file_path)
    df.columns = [str(column).strip().lower() for column in df.columns]

    df = df.rename(
        columns={
            "time": "observation_time",
            "sst": "sea_surface_temperature",
            "anom": "temperature_anomaly",
        }
    )

    numeric_columns = [
        "latitude",
        "longitude",
        "sea_surface_temperature",
        "temperature_anomaly",
    ]

    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df["observation_time"] = df["observation_time"].astype("string").str.strip()

    df = df.dropna(
        subset=[
            "observation_time",
            "latitude",
            "longitude",
        ]
    )

    df = df[
        df["latitude"].between(-90, 90)
        & df["longitude"].between(-180, 180)
    ]

    df = df.replace({float("inf"): None, float("-inf"): None})

    return df[
        [
            "observation_time",
            "latitude",
            "longitude",
            "sea_surface_temperature",
            "temperature_anomaly",
        ]
    ]
