import { useEffect, useState } from "react";
import {
  Activity,
  RefreshCw,
  Waves,
  Sun,
  Moon,
} from "lucide-react";
import { api } from "../services/api";

export default function Topbar({
  activePage,
  onRefresh,
  theme = "dark",
  onThemeChange,
}) {
  const [backendOnline, setBackendOnline] = useState(false);
  const [checking, setChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  async function checkBackend() {
    setChecking(true);

    try {
      await api.health();
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    } finally {
      setLastChecked(new Date());
      setChecking(false);
    }
  }

  useEffect(() => {
    checkBackend();

    const intervalId = window.setInterval(checkBackend, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function handleRefresh() {
    await checkBackend();

    if (onRefresh) {
      onRefresh();
    }
  }

  function handleThemeToggle() {
    if (onThemeChange) {
      onThemeChange(theme === "dark" ? "light" : "dark");
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-page">
        <div className="topbar-breadcrumb">
          <Waves size={15} />
          <span>OceanMind</span>
          <span className="breadcrumb-divider">/</span>
          <span className="breadcrumb-current">{activePage}</span>
        </div>

        <p className="topbar-subtitle">
          Ocean intelligence and environmental observations
        </p>
      </div>

      <div className="topbar-actions">
        <div
          className={`backend-indicator ${
            backendOnline ? "online" : "offline"
          }`}
          title={
            lastChecked
              ? `Last checked: ${lastChecked.toLocaleTimeString()}`
              : "Checking backend"
          }
        >
          <span className="status-dot" />
          <span>
            {checking
              ? "Checking API"
              : backendOnline
                ? "API Connected"
                : "API Offline"}
          </span>
        </div>

        <button
          type="button"
          className="icon-button theme-toggle-button"
          onClick={handleThemeToggle}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? (
            <Sun size={17} />
          ) : (
            <Moon size={17} />
          )}
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={handleRefresh}
          title="Refresh connection and page data"
          aria-label="Refresh"
          disabled={checking}
        >
          <RefreshCw
            size={17}
            className={checking ? "refresh-spinning" : ""}
          />
        </button>

        <div className="topbar-profile" title="OceanMind workspace">
          <Activity size={19} />
        </div>
      </div>
    </header>
  );
}