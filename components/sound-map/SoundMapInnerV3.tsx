"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type SoundType = "birds" | "traffic" | "music" | "rain" | "construction" | "insects" | "silence";

interface Pin {
  id: number; lat: number; lng: number; type: SoundType;
  label: string; species: string | null; intensity: number;
  db: number; time: string; ago: string; likes: number;
  listens: number; bio: number; user: string; duration: string;
}

const CFG: Record<SoundType, { color: string; light: string; label: string; icon: string }> = {
  birds:        { color: "#86efac", light: "#dcfce7", label: "Birds",        icon: "🐦" },
  traffic:      { color: "#cbd5e1", light: "#f1f5f9", label: "Traffic",      icon: "🚗" },
  music:        { color: "#d8b4fe", light: "#f3e8ff", label: "Music",        icon: "🎵" },
  rain:         { color: "#93c5fd", light: "#dbeafe", label: "Rain",         icon: "🌧️" },
  construction: { color: "#fdba74", light: "#ffedd5", label: "Construction", icon: "🏗️" },
  insects:      { color: "#bef264", light: "#f7fee7", label: "Insects",      icon: "🦋" },
  silence:      { color: "#e2e8f0", light: "#f8fafc", label: "Silence",      icon: "🌫️" },
};

const PINS: Pin[] = [
  { id: 1,  lat: 10.7769, lng: 106.7009, type: "birds",        label: "Spotted Dove",         species: "Spilopelia chinensis",  intensity: 0.72, db: 48, time: "14:23", ago: "2m ago",  likes: 14, listens: 47, bio: 78, user: "Linh N.",   duration: "0:42" },
  { id: 2,  lat: 10.7810, lng: 106.6950, type: "traffic",      label: "Rush Hour Traffic",    species: null,                    intensity: 0.91, db: 76, time: "14:21", ago: "4m ago",  likes: 3,  listens: 22, bio: 12, user: "Minh T.",   duration: "1:15" },
  { id: 3,  lat: 10.7740, lng: 106.7060, type: "music",        label: "Street Performer",     species: null,                    intensity: 0.55, db: 61, time: "14:18", ago: "7m ago",  likes: 31, listens: 89, bio: 35, user: "Hana V.",   duration: "2:03" },
  { id: 4,  lat: 10.7825, lng: 106.7030, type: "rain",         label: "Light Drizzle",        species: null,                    intensity: 0.38, db: 39, time: "14:15", ago: "10m ago", likes: 8,  listens: 33, bio: 55, user: "Tran K.",   duration: "3:20" },
  { id: 5,  lat: 10.7748, lng: 106.6975, type: "construction", label: "Building Site",        species: null,                    intensity: 0.93, db: 89, time: "14:12", ago: "13m ago", likes: 1,  listens: 18, bio: 8,  user: "Duc N.",    duration: "0:58" },
  { id: 6,  lat: 10.7760, lng: 106.7085, type: "birds",        label: "Red-whiskered Bulbul", species: "Pycnonotus jocosus",    intensity: 0.68, db: 52, time: "14:09", ago: "16m ago", likes: 22, listens: 61, bio: 82, user: "Phuong L.", duration: "1:34" },
  { id: 7,  lat: 10.7795, lng: 106.6990, type: "insects",      label: "Evening Cicadas",      species: null,                    intensity: 0.61, db: 57, time: "14:06", ago: "19m ago", likes: 17, listens: 44, bio: 71, user: "Nam H.",    duration: "0:31" },
  { id: 8,  lat: 10.7732, lng: 106.7040, type: "silence",      label: "Quiet Garden",         species: null,                    intensity: 0.18, db: 28, time: "14:03", ago: "22m ago", likes: 29, listens: 73, bio: 63, user: "Mai P.",    duration: "4:12" },
  { id: 9,  lat: 10.7780, lng: 106.7055, type: "birds",        label: "Common Myna Colony",   species: "Acridotheres tristis",  intensity: 0.80, db: 64, time: "14:00", ago: "25m ago", likes: 11, listens: 38, bio: 76, user: "Bao T.",    duration: "1:07" },
  { id: 10, lat: 10.7715, lng: 106.7015, type: "traffic",      label: "Intersection Rush",    species: null,                    intensity: 0.88, db: 82, time: "13:57", ago: "28m ago", likes: 2,  listens: 15, bio: 9,  user: "Khoa N.",   duration: "2:45" },
];

function makePin(type: SoundType, selected: boolean): L.DivIcon {
  const { color } = CFG[type];
  const s = selected ? 20 : 14;
  return L.divIcon({
    className: "",
    iconSize: [s, s], iconAnchor: [s/2, s/2],
    html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${color};border:${selected?3:2}px solid #1a0e05;box-shadow:0 2px 8px rgba(0,0,0,.5)${selected?`,0 0 0 4px ${color}44`:""};"></div>`,
  });
}

function MapStyles() {
  useMap();
  useEffect(() => {
    const id = "v3-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      .leaflet-tile { filter:sepia(.55) hue-rotate(-10deg) saturate(.7) brightness(.78) contrast(1.05) !important; }
      .leaflet-container { background:#0e0b06 !important; }
      .leaflet-control-zoom a { background:#1a1208 !important; color:#c8a96a !important; border:1px solid #3a2a12 !important; border-radius:4px !important; box-shadow:0 2px 8px rgba(0,0,0,.4) !important; }
      .leaflet-control-zoom a:hover { background:#2a1e0a !important; }
      .leaflet-control-attribution { background:rgba(0,0,0,.5) !important; color:rgba(200,169,106,.25) !important; font-size:9px !important; }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

function BioMeter({ score }: { score: number }) {
  const color = score >= 70 ? "#86efac" : score >= 40 ? "#fde68a" : score >= 20 ? "#fdba74" : "#fca5a5";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,.08)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 700, minWidth: 20 }}>{score}</span>
    </div>
  );
}

export default function SoundMapInnerV3() {
  const [selected, setSelected] = useState<Pin | null>(null);
  const [filter, setFilter] = useState("all");
  const [playing, setPlaying] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const visible = filter === "all" ? PINS : PINS.filter(p => p.type === filter);
  const S = selected ? CFG[selected.type] : null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#0e0b06", fontFamily: "Georgia, 'Times New Roman', serif" }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <div style={{
        width: sidebarOpen ? 292 : 0,
        minWidth: sidebarOpen ? 292 : 0,
        overflow: "hidden",
        transition: "width .3s ease, min-width .3s ease",
        background: "#100d07",
        borderRight: "1px solid #2a1e0a",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ width: 292, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Sidebar header */}
          <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #2a1e0a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>🌱</span>
              <div>
                <div style={{ color: "#c8a96a", fontWeight: 700, fontSize: 14 }}>SoundSoil</div>
                <div style={{ color: "rgba(200,169,106,.4)", fontSize: 9, letterSpacing: 1 }}>FIELD JOURNAL</div>
              </div>
            </div>
            {/* Search */}
            <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid #2a1e0a", borderRadius: 6, padding: "7px 10px", display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "rgba(200,169,106,.35)", fontSize: 12 }}>🔍</span>
              <span style={{ color: "rgba(200,169,106,.25)", fontSize: 12 }}>Search recordings…</span>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ padding: "10px 16px 6px", borderBottom: "1px solid #1e1508", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", "birds", "insects", "rain", "traffic"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? "rgba(200,169,106,.12)" : "transparent",
                border: `1px solid ${filter === f ? "rgba(200,169,106,.3)" : "rgba(200,169,106,.1)"}`,
                borderRadius: 4, padding: "3px 8px",
                color: filter === f ? "#c8a96a" : "rgba(200,169,106,.4)",
                fontSize: 10, cursor: "pointer", fontFamily: "Georgia, serif",
                textTransform: "capitalize",
              }}>
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>

          {/* Entries list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            <div style={{ padding: "6px 16px 4px", color: "rgba(200,169,106,.3)", fontSize: 9, letterSpacing: 1.5, fontFamily: "monospace" }}>
              {visible.length} ENTRIES — TODAY
            </div>
            {visible.map((pin, i) => {
              const c = CFG[pin.type];
              const isSel = selected?.id === pin.id;
              return (
                <div key={pin.id}
                  onClick={() => setSelected(p => p?.id === pin.id ? null : pin)}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid rgba(255,255,255,.03)",
                    cursor: "pointer",
                    background: isSel ? "rgba(200,169,106,.07)" : "transparent",
                    borderLeft: isSel ? `3px solid ${c.color}` : "3px solid transparent",
                    transition: "all .15s ease",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13 }}>{c.icon}</span>
                      <span style={{ color: "#c8a96a", fontSize: 12, fontWeight: 600 }}>{pin.label}</span>
                    </div>
                    <span style={{ color: "rgba(200,169,106,.3)", fontSize: 9, fontFamily: "monospace" }}>#{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  {pin.species && <div style={{ color: "rgba(200,169,106,.4)", fontSize: 10, fontStyle: "italic", marginBottom: 4 }}>{pin.species}</div>}
                  <div style={{ marginBottom: 4 }}>
                    <BioMeter score={pin.bio} />
                  </div>
                  <div style={{ display: "flex", gap: 8, color: "rgba(200,169,106,.3)", fontSize: 9, fontFamily: "monospace" }}>
                    <span>{pin.ago}</span>
                    <span>·</span>
                    <span>{pin.db} dB</span>
                    <span>·</span>
                    <span>♥ {pin.likes}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded sound card */}
          {selected && S && (
            <div style={{ borderTop: "1px solid #2a1e0a", padding: "14px 16px", background: "#0c0a05" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: "#c8a96a", fontSize: 11, fontWeight: 600 }}>▶ PLAYING</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPlaying(p => !p)} style={{ background: S.color, border: "none", borderRadius: "50%", width: 28, height: 28, color: "#000", fontSize: 11, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {playing ? "⏸" : "▶"}
                  </button>
                  <button onClick={() => setSelected(null)} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: "50%", width: 28, height: 28, color: "rgba(200,169,106,.4)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              </div>
              {/* Waveform (fake bars) */}
              <div style={{ display: "flex", alignItems: "center", gap: 2, height: 32, marginBottom: 8 }}>
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} style={{ width: 3, background: S.color, borderRadius: 1, opacity: .6,
                    height: `${20 + Math.abs(Math.sin(i * .6 + 1)) * 75}%`,
                    animation: `v3wave ${.7 + (i%4)*.15}s ease-in-out infinite alternate`,
                    animationDelay: `${i*.04}s` }} />
                ))}
              </div>
              <div style={{ color: "rgba(200,169,106,.3)", fontSize: 9, fontFamily: "monospace", textAlign: "right" }}>
                {selected.duration} · {selected.user}
              </div>
              <button style={{ marginTop: 8, width: "100%", background: `${S.color}14`, border: `1px solid ${S.color}30`, borderRadius: 4, color: S.color, padding: "7px", cursor: "pointer", fontSize: 10, fontFamily: "Georgia, serif" }}>
                View Landscape →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MAP ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={[10.7769, 106.7009]} zoom={14}
          style={{ width: "100%", height: "100%", background: "#0e0b06" }}
          zoomControl={true}>
          <MapStyles />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
          {visible.map(pin => (
            <Marker key={pin.id} position={[pin.lat, pin.lng]}
              icon={makePin(pin.type, selected?.id === pin.id)}
              eventHandlers={{ click: () => setSelected(p => p?.id === pin.id ? null : pin) }} />
          ))}
        </MapContainer>

        {/* Toggle sidebar button */}
        <button onClick={() => setSidebarOpen(o => !o)} style={{ position: "absolute", top: 14, left: 14, zIndex: 1000, background: "rgba(14,11,6,.85)", border: "1px solid #2a1e0a", borderRadius: 6, color: "#c8a96a", fontSize: 12, padding: "7px 10px", cursor: "pointer", fontFamily: "Georgia, serif" }}>
          {sidebarOpen ? "‹ Hide Log" : "› Field Log"}
        </button>

        {/* Compass / location chip */}
        <div style={{ position: "absolute", top: 14, right: 14, zIndex: 1000, background: "rgba(14,11,6,.85)", border: "1px solid #2a1e0a", borderRadius: 6, padding: "7px 12px", color: "#c8a96a", fontSize: 10, fontFamily: "monospace", lineHeight: 1.8 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>10°46′N 106°42′E</div>
          <div style={{ color: "rgba(200,169,106,.4)" }}>Hồ Chí Minh City</div>
        </div>

        {/* Bottom coord bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000, background: "rgba(14,11,6,.88)", borderTop: "1px solid #1e1508", padding: "6px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "rgba(200,169,106,.4)", fontSize: 10, fontFamily: "monospace" }}>
            {selected ? `Selected: ${selected.label} · ${selected.lat.toFixed(4)}°N ${selected.lng.toFixed(4)}°E` : "No selection — click a pin to record an entry"}
          </span>
          <span style={{ color: "rgba(200,169,106,.3)", fontSize: 10, fontFamily: "monospace" }}>
            {PINS.length} entries · {Math.round(PINS.reduce((a, b) => a + b.bio, 0) / PINS.length)} avg bio
          </span>
        </div>
      </div>

      <style>{`
        @keyframes v3wave { from{transform:scaleY(.4)} to{transform:scaleY(1)} }
      `}</style>
    </div>
  );
}
