
import {
  Activity,
  Waves,
  LayoutDashboard,
  Globe2,
  AlertTriangle,
  Database,
  Settings2,
  ChevronRight,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Ocean Explorer", icon: Globe2 },
  { label: "Anomalies", icon: AlertTriangle },
  { label: "Data Center", icon: Database },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Waves size={25} strokeWidth={2.2} />
        </div>

        <div className="brand-copy">
          <h2>OceanMind</h2>
          <span>OCEAN INTELLIGENCE</span>
        </div>
      </div>

      <div className="sidebar-section-label">WORKSPACE</div>

      <nav className="sidebar-navigation" aria-label="Main navigation">
        {navigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={`nav-item ${
              activePage === label ? "active" : ""
            }`}
            onClick={() => onNavigate(label)}
            aria-current={activePage === label ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
            {activePage === label && (
              <ChevronRight className="nav-chevron" size={16} />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="system-card">
          <div className="system-card-heading">
            <Activity size={16} />
            <span>System overview</span>
          </div>

          <div className="system-status">
            <span className="status-dot" />
            <span>Workspace ready</span>
          </div>

          <p>Satellite data intelligence workspace</p>
        </div>

        <button
          type="button"
          className={`nav-item settings-item ${
            activePage === "System Status" ? "active" : ""
          }`}
          onClick={() => onNavigate("System Status")}
        >
          <Settings2 size={19} strokeWidth={1.8} />
          <span>System Status</span>
        </button>

        <div className="sidebar-footer">
          <span className="footer-indicator" />
          OceanMind · Development
        </div>
      </div>
    </aside>
  );
}
