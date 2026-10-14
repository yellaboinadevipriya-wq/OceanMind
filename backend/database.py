
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "oceanmind.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                observation_time TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                sea_surface_temperature REAL,
                temperature_anomaly REAL,
                source TEXT NOT NULL DEFAULT 'manual',
                is_anomaly INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_observation_time
            ON observations(observation_time)
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_observation_location
            ON observations(latitude, longitude)
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS processing_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                records_processed INTEGER NOT NULL DEFAULT 0,
                anomalies_found INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'completed',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.commit()


if __name__ == "__main__":
    initialize_database()
    print("OceanMind database initialized successfully.")
    print(f"Database location: {DATABASE_PATH}")
