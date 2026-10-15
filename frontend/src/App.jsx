
import { useCallback, useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

import Dashboard from "./pages/Dashboard";
import OceanExplorer from "./pages/OceanExplorer";
import SatelliteImagery from "./pages/SatelliteImagery";
import Anomalies from "./pages/Anomalies";
import DataCenter from "./pages/DataCenter";
import SystemStatus from "./pages/SystemStatus";

import "./styles/global.css";

const PAGES = {
  Dashboard,
  "Ocean Explorer": OceanExplorer,
  "Satellite Imagery": SatelliteImagery,
  Anomalies,
  "Data Center": DataCenter,
  "System Status": SystemStatus,
};

export default function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("oceanmind-theme") || "dark";
    } catch {
      return "dark";
    }
  });
  const [pageVisible, setPageVisible] = useState(true);

  const PageComponent = PAGES[activePage] || Dashboard;

  const handleRefresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const handleNavigate = useCallback((page) => {
    if (!PAGES[page] || page === activePage) return;

    setPageVisible(false);

    // Reduced-motion users still receive a reliable page change.
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setActivePage(page);
      setPageVisible(true);
      return;
    }

    // A brief CSS transition, without a third-party animation dependency.
    setTimeout(() => {
      setActivePage(page);
      setPageVisible(true);
    }, 120);
  }, [activePage]);

  
const handleThemeChange = useCallback((nextTheme) => {
  setTheme((current) => {
    if (nextTheme === "light" || nextTheme === "dark") {
      return nextTheme;
    }

    return current === "dark" ? "light" : "dark";
  });
}, []);


  useEffect(() => {
    document.documentElement.dataset.oceanmindTheme = theme;

    try {
      localStorage.setItem("oceanmind-theme", theme);
    } catch {
      // Theme still works for this session if storage is unavailable.
    }
  }, [theme]);

  return (
    <div className={`app-shell oceanmind-app theme-${theme}`}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
      />

      <main className="main-layout">
        <Topbar
          activePage={activePage}
          onRefresh={handleRefresh}
          theme={theme}
          onThemeChange={handleThemeChange}
        />

        <div className="page-container main-content">
          <section className="welcome-section app-welcome">
            <div>
              <div className="eyebrow">
                OCEANMIND <span className="welcome-divider">/</span> WORKSPACE
              </div>

              <h1 key={activePage} className="welcome-title">
                {activePage}
              </h1>

              <p className="welcome-description">
                Explore ocean observations, environmental patterns,
                and data-driven anomaly insights.
              </p>
            </div>

            <div className="workspace-badge">
              <span className="status-dot" />
              Ocean intelligence workspace
            </div>
          </section>

          <div
            key={activePage}
            className={`app-page-transition ${
              pageVisible ? "page-visible" : "page-exiting"
            }`}
          >
            <PageComponent
              refreshKey={refreshKey}
              theme={theme}
              onThemeChange={handleThemeChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
