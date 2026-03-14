"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Sound category definitions ───────────────────────────────────────────────
const SOUND_TYPES = {
  nature: { color: "#22c55e", border: "#14532d", label: "Nature",  icon: "🌿" },
  urban:  { color: "#94a3b8", border: "#1e293b", label: "Urban",   icon: "🏙️" },
  music:  { color: "#c084fc", border: "#581c87", label: "Music",   icon: "🎵" },
  alert:  { color: "#f87171", border: "#7f1d1d", label: "Alert",   icon: "⚠️" },
  water:  { color: "#38bdf8", border: "#0c4a6e", label: "Water",   icon: "💧" },
} as const;

type SoundType = keyof typeof SOUND_TYPES;

// ─── Demo pins (Ho Chi Minh City) ─────────────────────────────────────────────
const DEMO_PINS: {
  id: number;
  lat: number;
  lng: number;
  type: SoundType;
  label: string;
  intensity: number;
  db: number;
  time: string;
}[] = [
  { id: 1, lat: 10.7769, lng: 106.7009, type: "nature", label: "Bird Song",        intensity: 0.60, db: 45, time: "13:42" },
  { id: 2, lat: 10.7810, lng: 106.6950, type: "urban",  label: "Traffic Noise",    intensity: 0.85, db: 72, time: "13:44" },
  { id: 3, lat: 10.7740, lng: 106.7060, type: "music",  label: "Street Performer", intensity: 0.50, db: 58, time: "13:38" },
  { id: 4, lat: 10.7825, lng: 106.7030, type: "water",  label: "Fountain",         intensity: 0.40, db: 40, time: "13:41" },
  { id: 5, lat: 10.7748, lng: 106.6975, type: "alert",  label: "Construction",     intensity: 0.92, db: 87, time: "13:45" },
  { id: 6, lat: 10.7760, lng: 106.7085, type: "nature", label: "Rain Drizzle",     intensity: 0.32, db: 36, time: "13:39" },
  { id: 7, lat: 10.7795, lng: 106.6990, type: "urban",  label: "Motorbikes",       intensity: 0.78, db: 68, time: "13:43" },
  { id: 8, lat: 10.7732, lng: 106.7040, type: "music",  label: "Café Jazz",        intensity: 0.45, db: 52, time: "13:37" },
];

// ─── Pixel art divIcon factory ─────────────────────────────────────────────────
function createPixelPin(type: SoundType, intensity: number): L.DivIcon {
  const { color, border, icon } = SOUND_TYPES[type];
  const body = Math.round(28 + intensity * 14); // 28–42 px
  const pulse = Math.round(body * 2.0);
  const speed = (2.2 - intensity * 1.0).toFixed(1);

  return L.divIcon({
    className: "",
    iconSize:   [body, body + 10],
    iconAnchor: [body / 2, body + 10],
    popupAnchor: [0, -(body + 14)],
    html: `
      <div style="position:relative;width:${body}px;height:${body + 10}px">
        <!-- sonar pulse ring -->
        <div style="
          position:absolute;
          top:${body / 2}px;left:${body / 2}px;
          width:${pulse}px;height:${pulse}px;
          margin-left:-${pulse / 2}px;margin-top:-${pulse / 2}px;
          border:3px solid ${color};
          background:${color}18;
          animation:ssPixelPulse ${speed}s ease-out infinite;
          image-rendering:pixelated;
          pointer-events:none;
        "></div>
        <!-- pin body (pixel art box) -->
        <div style="
          position:absolute;top:0;left:0;
          width:${body}px;height:${body}px;
          background:${color};
          border:3px solid ${border};
          box-shadow:3px 3px 0 ${border};
          display:flex;align-items:center;justify-content:center;
          font-size:${Math.round(body * 0.48)}px;
          image-rendering:pixelated;
          z-index:2;cursor:pointer;
        ">${icon}</div>
        <!-- pin tail -->
        <div style="
          position:absolute;bottom:0;left:50%;
          transform:translateX(-50%);
          width:6px;height:10px;
          background:${color};
          border:2px solid ${border};border-top:none;
          box-shadow:2px 2px 0 ${border};
          z-index:2;
        "></div>
      </div>`,
  });
}

// ─── Injects global CSS for tiles + UI ────────────────────────────────────────
function PixelMapStyles() {
  useMap(); // ensures we're inside MapContainer
  useEffect(() => {
    const id = "ss-pixel-map-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      /* Pixelate the map tiles */
      .leaflet-tile {
        image-rendering: pixelated !important;
        image-rendering: crisp-edges !important;
        filter: sepia(.45) hue-rotate(82deg) saturate(.65) brightness(.48) contrast(1.3) !important;
      }
      .leaflet-container {
        background: #050e05 !important;
        font-family: 'Courier New', Courier, monospace;
      }
      /* Popup chrome */
      .leaflet-popup-content-wrapper {
        background: #050e05 !important;
        border: 3px solid #22c55e !important;
        border-radius: 0 !important;
        box-shadow: 4px 4px 0 #000 !important;
        padding: 0 !important;
        color: #22c55e !important;
      }
      .leaflet-popup-tip { background: #22c55e !important; }
      .leaflet-popup-close-button {
        color: #22c55e !important;
        font-size: 18px !important;
        right: 4px !important; top: 2px !important;
      }
      .leaflet-popup-content { margin: 0 !important; }
      /* Zoom controls */
      .leaflet-control-zoom a {
        background: #050e05 !important;
        color: #22c55e !important;
        border: 2px solid #22c55e !important;
        border-radius: 0 !important;
        box-shadow: 2px 2px 0 #000 !important;
        font-family: 'Courier New', monospace !important;
        font-weight: bold !important;
      }
      .leaflet-control-zoom a:hover {
        background: #22c55e !important;
        color: #000 !important;
      }
      .leaflet-control-attribution {
        background: rgba(0,0,0,.75) !important;
        color: #22c55e44 !important;
        font-size: 8px !important;
      }
      /* Sonar pulse keyframe */
      @keyframes ssPixelPulse {
        0%   { opacity:.9; transform:scale(.25); }
        100% { opacity:0;  transform:scale(1);   }
      }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

// ─── dB bar meter ──────────────────────────────────────────────────────────────
function DbBar({ db }: { db: number }) {
  const filled = Math.round((db / 100) * 10);
  return (
    <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 8, height: 12,
            background: i < filled
              ? i >= 7 ? "#ef4444" : i >= 4 ? "#f59e0b" : "#22c55e"
              : "#0d1f0d",
            border: "1px solid #000",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function SoundMapInner() {
  const avgDb = Math.round(DEMO_PINS.reduce((a, b) => a + b.db, 0) / DEMO_PINS.length);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>

      <MapContainer
        center={[10.7769, 106.7009]}
        zoom={14}
        style={{ width: "100%", height: "100%", background: "#050e05" }}
        zoomControl
      >
        <PixelMapStyles />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          maxZoom={19}
        />
        {DEMO_PINS.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={createPixelPin(pin.type, pin.intensity)}
          >
            <Popup>
              <div style={{
                background: "#050e05",
                color: "#22c55e",
                fontFamily: "'Courier New', monospace",
                padding: "12px 14px",
                minWidth: 170,
                fontSize: 11,
                lineHeight: 1.7,
              }}>
                <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 6, color: SOUND_TYPES[pin.type].color }}>
                  {SOUND_TYPES[pin.type].icon}&nbsp;{pin.label}
                </div>
                <div style={{ color: "#4b7a4b" }}>TYPE&nbsp;&nbsp;: {SOUND_TYPES[pin.type].label.toUpperCase()}</div>
                <div>LEVEL : {pin.db} dB</div>
                <DbBar db={pin.db} />
                <div style={{ marginTop: 6, color: "#4b7a4b", fontSize: 10 }}>
                  TIME&nbsp;&nbsp;: {pin.time}<br />
                  [{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}]
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* ── HUD: Title ─────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 14, left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "rgba(5,14,5,.92)",
        border: "3px solid #22c55e",
        boxShadow: "4px 4px 0 #000",
        padding: "7px 22px",
        fontFamily: "'Courier New', monospace",
        fontSize: 13, letterSpacing: 3, fontWeight: "bold",
        color: "#22c55e", whiteSpace: "nowrap",
      }}>
        ♪ SOUNDSOIL MAP ♪
      </div>

      {/* ── HUD: Stats (top-right) ─────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 14, right: 14,
        zIndex: 1000,
        background: "rgba(5,14,5,.92)",
        border: "3px solid #22c55e",
        boxShadow: "4px 4px 0 #000",
        padding: "10px 14px",
        fontFamily: "'Courier New', monospace",
        fontSize: 11, color: "#22c55e",
        lineHeight: 1.8,
      }}>
        <div>📍 PINS &nbsp;: {DEMO_PINS.length}</div>
        <div>📊 AVG DB: {avgDb}</div>
        <div style={{ color: "#f87171", letterSpacing: 1 }}>● LIVE</div>
      </div>

      {/* ── HUD: Legend (bottom-left) ──────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 28, left: 14,
        zIndex: 1000,
        background: "rgba(5,14,5,.92)",
        border: "3px solid #22c55e",
        boxShadow: "4px 4px 0 #000",
        padding: "10px 14px",
        fontFamily: "'Courier New', monospace",
        fontSize: 11, color: "#22c55e",
      }}>
        <div style={{ fontWeight: "bold", marginBottom: 8, letterSpacing: 1 }}>◆ SOUND TYPES</div>
        {Object.entries(SOUND_TYPES).map(([key, val]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 12, height: 12, flexShrink: 0,
              background: val.color,
              border: "2px solid #000",
              boxShadow: "1px 1px 0 #000",
            }} />
            <span>{val.icon} {val.label}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
