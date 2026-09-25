import { useEffect, useRef, useState } from "react";
import {
  CaretDown,
  CheckCircle,
  Clock,
  MapPin,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react";
import "./routeplanner.css";
const routeCards = [
  {
    title: "Route B: Balanced Safety Corridor",
    subtitle: "Via NH-6 (Lower exposure to active hazard alerts)",
    time: "9h 15m",
    distance: "410 km",
    risk: "Low Risk",
    recommended: true,
    reason: "Bypasses active IMD high-rainfall alert zone near Jowai segment.",
  },
  {
    title: "Route A: Direct Shortest",
    subtitle: "High hazard exposure",
    time: "8h 20m",
    distance: "380 km",
    risk: "High Risk",
    recommended: false,
    reason: "",
  },
];

type Option = { value: string; label: string };

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="mock-field-group" ref={wrapperRef}>
      <label>{label}</label>
      <div className={`mock-select-control ${open ? "open" : ""}`}>
        <button
          type="button"
          className="mock-select-button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selected.label}</span>
          <CaretDown size={16} />
        </button>

        {open && (
          <div className="mock-select-menu" role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`mock-select-option ${option.value === value ? "selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoutePlanner() {
  const [origin, setOrigin] = useState("guwahati");
  const [destination, setDestination] = useState("aizawl");
  const [vehicleType, setVehicleType] = useState("diesel-truck");
  const [riskPreference, setRiskPreference] = useState("avoid-landslides");

  return (
    <div className="mock-shell">
      <header className="mock-topbar">
        <div className="mock-brand-wrap">
          <div className="mock-brand-mark">N</div>
          <div className="mock-brand-copy">
            <div className="mock-brand-name">NER-LENS</div>
            <div className="mock-brand-sub">SIH2600Z • Team Digital Yodha</div>
          </div>
        </div>

        <nav className="mock-nav" aria-label="Main navigation">
          <button type="button" className="mock-nav-item active">
            Route Planner
          </button>
          <button type="button" className="mock-nav-item">
            Offline Reports
          </button>
          <button type="button" className="mock-nav-item">
            Source Health
          </button>
        </nav>

        <button type="button" className="mock-alert-button">
          <Warning size={14} weight="fill" />
          Mon Weather Watch
        </button>
      </header>

      <main className="mock-main">
        <section className="mock-left-panel">
          <div className="mock-form-card">
            <div className="mock-select-row">
              <span className="mock-toggle-dot" aria-hidden="true" />
              <span className="mock-select-label">Select Corridor</span>
            </div>

            <SelectField
              label="ORIGIN"
              value={origin}
              onChange={setOrigin}
              options={[
                { value: "guwahati", label: "Guwahati (Hub A)" },
                { value: "jowai", label: "Jowai" },
                { value: "shillong", label: "Shillong" },
              ]}
            />

            <SelectField
              label="DESTINATION"
              value={destination}
              onChange={setDestination}
              options={[
                { value: "aizawl", label: "Aizawl (Hub B)" },
                { value: "dibrugarh", label: "Dibrugarh" },
                { value: "dimapur", label: "Dimapur" },
              ]}
            />

            <div className="mock-two-col">
              <SelectField
                label="VEHICLE TYPE"
                value={vehicleType}
                onChange={setVehicleType}
                options={[
                  { value: "diesel-truck", label: "16T Diesel Truck" },
                  { value: "mini-truck", label: "8T Mini Truck" },
                  { value: "fuel-tanker", label: "Fuel Tanker" },
                ]}
              />

              <SelectField
                label="RISK PREFERENCE"
                value={riskPreference}
                onChange={setRiskPreference}
                options={[
                  { value: "avoid-landslides", label: "Avoid Landslides" },
                  { value: "avoid-floods", label: "Avoid Floods" },
                  { value: "minimum-time", label: "Minimum Time" },
                ]}
              />
            </div>
          </div>

          <div className="mock-route-list">
            <h3>EVALUATED ROUTE OPTIONS</h3>

            {routeCards.map((route) => (
              <div
                key={route.title}
                className={`mock-route-card ${route.recommended ? "recommended" : ""}`}
              >
                {route.recommended && <span className="mock-badge">RECOMMENDED</span>}

                <div className="mock-route-header">
                  <div className="mock-route-title-wrap">
                    <h4>{route.title}</h4>
                    <p>{route.subtitle}</p>
                  </div>
                  {route.recommended && <div className="mock-risk-text">{route.risk}</div>}
                  {!route.recommended && <div className="mock-risk-text danger">{route.risk}</div>}
                </div>

                <div className="mock-meta-row">
                  <span>
                    <Clock size={14} />
                    {route.time}
                  </span>
                  <span>
                    <MapPin size={14} />
                    {route.distance}
                  </span>
                  {route.recommended ? (
                    <span className="mock-risk-pill safe">Low Risk</span>
                  ) : (
                    <span className="mock-risk-pill danger">High Risk</span>
                  )}
                </div>

                {route.recommended && (
                  <div className="mock-route-reason">
                    <CheckCircle size={15} weight="fill" />
                    <span>
                      Why this route? {route.reason}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mock-right-panel">
          <div className="mock-map-header">
            <div className="mock-map-status">
              <span className="mock-status-dot" aria-hidden="true" />
              Live GIS Overlays Active
            </div>
            <div className="mock-route-label">Guwahati → Aizawl Corridor</div>
          </div>

          <div className="mock-map-area">
            <div className="mock-map-alert">
              <div className="mock-alert-title">
                <Warning size={14} weight="fill" />
                <span>Segment Status: Restricted</span>
              </div>

              <h5>Jalukbari - Nagaon Corridor</h5>
              <p>
                Heavy precipitation warning issued by IMD. Landslide probability
                moderate per GSI Bhusanket data.
              </p>

              <button type="button" className="mock-inspect-btn">
                Inspect Evidence
              </button>
            </div>
          </div>

          <div className="mock-panel-footer">
            <div className="mock-legend-row">
              <span className="legend-pill safe">Safe</span>
              <span className="legend-pill warn">Warning</span>
              <span className="legend-pill block">Blocked</span>
            </div>
            <div className="mock-footer-meta">Data: OpenStreetMap, IMD, SACHET</div>
          </div>

          <div className="mock-signal-card">
            <div className="mock-signal-header">
              <ShieldCheck size={18} weight="fill" />
              <span>Signal Provenance & Data Freshness</span>
            </div>

            <div className="mock-signal-grid">
              <div className="mock-signal-item">
                <div className="mock-item-label">WEATHER WARNING</div>
                <div className="mock-item-value">IMD Weather API</div>
                <div className="mock-item-sub">Updated 12 mins ago</div>
              </div>

              <div className="mock-signal-item">
                <div className="mock-item-label">DISASTER ALERTS</div>
                <div className="mock-item-value">SACHET NDMA</div>
                <div className="mock-item-sub">Verified Active Signal</div>
              </div>

              <div className="mock-signal-item">
                <div className="mock-item-label">LANDSLIDE SUSCEPTIBILITY</div>
                <div className="mock-item-value">GSI Bhusanket</div>
                <div className="mock-item-sub">Layer V2.1 Sync</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
