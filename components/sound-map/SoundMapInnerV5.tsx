"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import RecordUploadPanel, { type UploadResult } from "./RecordUploadPanel";

type SoundType = "birds" | "traffic" | "music" | "rain" | "construction" | "insects" | "silence";

interface Pin {
  id: number; lat: number; lng: number; type: SoundType;
  label: string; species: string | null; intensity: number;
  db: number; time: string; ago: string; likes: number;
  listens: number; bio: number; user: string; duration: string;
}

const CFG: Record<SoundType, { color: string; bg: string; border: string; label: string; icon: string; desc: string }> = {
  birds:        { color: "#166534", bg: "#dcfce7", border: "#86efac", label: "Birds",        icon: "🐦", desc: "Natural birdsong" },
  traffic:      { color: "#374151", bg: "#f3f4f6", border: "#d1d5db", label: "Traffic",      icon: "🚗", desc: "Vehicle noise" },
  music:        { color: "#6b21a8", bg: "#f3e8ff", border: "#d8b4fe", label: "Music",        icon: "🎵", desc: "Music & performance" },
  rain:         { color: "#1e40af", bg: "#dbeafe", border: "#93c5fd", label: "Rain & Wind",  icon: "🌧️", desc: "Weather sounds" },
  construction: { color: "#9a3412", bg: "#ffedd5", border: "#fdba74", label: "Construction", icon: "🏗️", desc: "Building activity" },
  insects:      { color: "#365314", bg: "#f7fee7", border: "#bef264", label: "Insects",      icon: "🦋", desc: "Insect life" },
  silence:      { color: "#475569", bg: "#f8fafc", border: "#e2e8f0", label: "Silence",      icon: "🌫️", desc: "Quiet areas" },
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
  const { color, bg, border } = CFG[type];
  const s = selected ? 36 : 28;
  return L.divIcon({
    className: "",
    iconSize: [s, s + 8], iconAnchor: [s/2, s + 8],
    html: `<div style="position:relative;width:${s}px;height:${s+8}px;">
      <div style="width:${s}px;height:${s}px;border-radius:${s/2}px ${s/2}px ${s*.15}px ${s*.15}px;background:${bg};border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:${s*.4}px;box-shadow:0 4px 12px rgba(0,0,0,.18),0 0 0 ${selected?3:0}px ${border};transition:all .2s;">
      </div>
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:${s*.2}px solid transparent;border-right:${s*.2}px solid transparent;border-top:${s*.3}px solid ${border};"></div>
    </div>`,
  });
}

function MapStyles() {
  useMap();
  useEffect(() => {
    const id = "v5-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      .leaflet-tile { filter:saturate(.75) brightness(1.06) hue-rotate(-5deg) !important; }
      .leaflet-container { background:#f0ede6 !important; }
      .leaflet-control-zoom a { background:#fff !important; color:#374151 !important; border:1px solid #e5e7eb !important; border-radius:8px !important; box-shadow:0 2px 8px rgba(0,0,0,.1) !important; width:30px !important; height:30px !important; line-height:30px !important; }
      .leaflet-control-zoom a:hover { background:#f9fafb !important; }
      .leaflet-bar { border:none !important; box-shadow:none !important; }
      .leaflet-control-attribution { background:rgba(255,255,255,.7) !important; color:#9ca3af !important; font-size:9px !important; border-radius:4px !important; }
      @keyframes v5pulse { 0%{opacity:.7;transform:scale(.3)} 100%{opacity:0;transform:scale(1)} }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

function BioLeaves({ score }: { score: number }) {
  const total = 5;
  const filled = Math.round((score / 100) * total);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ fontSize: 14, opacity: i < filled ? 1 : 0.18 }}>🍃</span>
      ))}
    </div>
  );
}

// A new pin added by the user in this session (not yet from backend)
interface NewPin {
  id: string;
  lat: number;
  lng: number; // alias for lon, matches Pin shape for marker rendering
  type: SoundType;
  label: string;
  species: null;
  intensity: number;
  db: number;
  time: string;
  ago: string;
  likes: number;
  listens: number;
  bio: number;
  user: string;
  duration: string;
}

export default function SoundMapInnerV5() {
  const [selected, setSelected] = useState<Pin | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<SoundType>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [newPins, setNewPins] = useState<NewPin[]>([]);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  const toggle = (t: SoundType) => setActiveFilters(s => {
    const n = new Set(s);
    n.has(t) ? n.delete(t) : n.add(t);
    return n;
  });

  const handleUploadSuccess = (result: UploadResult) => {
    const soundType = (CFG[result.dominantClass as SoundType] ? result.dominantClass : "birds") as SoundType;
    const now = new Date();
    const newPin: NewPin = {
      id: `new-${Date.now()}`,
      lat: result.lat,
      lng: result.lon,
      type: soundType,
      label: result.title,
      species: null,
      intensity: 0.5,
      db: 50,
      time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`,
      ago: "just now",
      likes: 0,
      listens: 0,
      bio: 50,
      user: "You",
      duration: "0:00",
    };
    setNewPins(p => [...p, newPin]);
    setFlyTarget([result.lat, result.lon]);
  };

  const allPins: (Pin | NewPin)[] = [...PINS, ...newPins];
  const visible = activeFilters.size === 0 ? allPins : allPins.filter(p => activeFilters.has(p.type));
  const S = selected ? CFG[selected.type] : null;

  const counts = (Object.keys(CFG) as SoundType[]).reduce((acc, t) => {
    acc[t] = allPins.filter(p => p.type === t).length;
    return acc;
  }, {} as Record<SoundType, number>);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#f8f6f1", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflow: "hidden" }}>

      {/* ── LEFT SIDEBAR ────────────────────────────────────────────────────── */}
      <div style={{ width: 268, background: "#fff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, background: "#dcfce7", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌱</div>
            <div>
              <div style={{ color: "#111827", fontWeight: 700, fontSize: 15 }}>SoundSoil</div>
              <div style={{ color: "#9ca3af", fontSize: 10 }}>Community Sound Map</div>
            </div>
          </div>
          {/* Search + upload button row */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ flex: 1, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width={14} height={14} fill="none" stroke="#9ca3af" strokeWidth={2}><circle cx={6} cy={6} r={5} /><line x1={10} y1={10} x2={14} y2={14} /></svg>
              <span style={{ color: "#d1d5db", fontSize: 13 }}>Search places, species…</span>
            </div>
            <button
              onClick={() => setShowUploadPanel(true)}
              title="Record or upload a sound"
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                background: "#dcfce7",
                border: "1px solid #86efac",
                borderRadius: 10,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                transition: "all 0.15s",
              }}
            >
              🎙
            </button>
          </div>
        </div>

        {/* Location info */}
        <div style={{ padding: "12px 18px 10px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ color: "#111827", fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Hồ Chí Minh City</div>
          <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>Ho Chi Minh City, Vietnam</div>
          <BioLeaves score={Math.round(PINS.reduce((a, b) => a + b.bio, 0) / PINS.length)} />
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
            Avg biodiversity <strong style={{ color: "#166534" }}>{Math.round(PINS.reduce((a, b) => a + b.bio, 0) / PINS.length)}/100</strong>
          </div>
        </div>

        {/* Filter by sound type */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, letterSpacing: .5, marginBottom: 8 }}>FILTER BY SOUND TYPE</div>
          {(Object.keys(CFG) as SoundType[]).map(t => {
            const c = CFG[t];
            const active = activeFilters.has(t) || activeFilters.size === 0;
            return (
              <button key={t} onClick={() => toggle(t)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 10px", marginBottom: 3,
                background: activeFilters.has(t) ? c.bg : "transparent",
                border: `1px solid ${activeFilters.has(t) ? c.border : "transparent"}`,
                borderRadius: 8, cursor: "pointer", transition: "all .15s ease",
                opacity: active ? 1 : 0.45,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{c.icon}</span>
                  <span style={{ color: activeFilters.has(t) ? c.color : "#374151", fontSize: 12, fontWeight: activeFilters.has(t) ? 600 : 400 }}>{c.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: "#f3f4f6", borderRadius: 10, padding: "1px 6px", color: "#9ca3af", fontSize: 10 }}>{counts[t]}</span>
                  {activeFilters.has(t) && <span style={{ color: c.color, fontSize: 10 }}>✓</span>}
                </div>
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <button onClick={() => setActiveFilters(new Set())} style={{ width: "100%", background: "none", border: "none", color: "#9ca3af", fontSize: 11, cursor: "pointer", marginTop: 4, padding: "4px 0", textAlign: "center" }}>
              Clear filters ({activeFilters.size})
            </button>
          )}
        </div>

        {/* Recordings count + upload CTA */}
        <div style={{ padding: "10px 18px", marginTop: "auto", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>
            Showing <strong style={{ color: "#111827" }}>{visible.length}</strong> of {allPins.length} recordings
          </div>
          <button
            onClick={() => setShowUploadPanel(true)}
            style={{
              width: "100%",
              background: "#166534",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span>🎙</span>
            <span>Add Your Sound</span>
          </button>
        </div>
      </div>

      {/* ── MAP ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={[10.7769, 106.7009]} zoom={14}
          style={{ width: "100%", height: "100%", background: "#f0ede6" }}
          zoomControl={true}>
          <MapStyles />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          {flyTarget && <FlyToTarget target={flyTarget} onDone={() => setFlyTarget(null)} />}
          {visible.map(pin => (
            <Marker key={String(pin.id)} position={[pin.lat, pin.lng]}
              icon={makePin(pin.type, String(selected?.id) === String(pin.id))}
              eventHandlers={{ click: () => setSelected(p => String(p?.id) === String(pin.id) ? null : pin as Pin) }} />
          ))}
        </MapContainer>

        {/* Pill stats row - floating top */}
        <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 1000, display: "flex", gap: 6 }}>
          {[`📍 ${visible.length} spots`, `🌿 Avg bio ${Math.round(PINS.reduce((a, b) => a + b.bio, 0) / PINS.length)}`, `● Live`].map((t, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.92)", backdropFilter: "blur(8px)", border: "1px solid #e5e7eb", borderRadius: 20, padding: "6px 12px", color: i === 2 ? "#16a34a" : "#374151", fontSize: 12, fontWeight: 500, boxShadow: "0 1px 6px rgba(0,0,0,.08)", whiteSpace: "nowrap" }}>{t}</div>
          ))}
        </div>

        {/* ── BOTTOM SHEET ────────────────────────────────────────────────────── */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: "#fff",
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          boxShadow: "0 -4px 30px rgba(0,0,0,.12)",
          transform: selected ? "translateY(0)" : "translateY(100%)",
          transition: "transform .35s cubic-bezier(.4,0,.2,1)",
          padding: "0 0 16px",
          maxHeight: 300,
        }}>
          {/* Handle */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 6 }}>
            <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 2 }} />
          </div>

          {selected && S && (
            <div style={{ padding: "0 20px" }}>
              {/* Type badge + close */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 20, padding: "4px 12px", color: S.color, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{S.icon}</span><span>{S.label}</span>
                </span>
                <button onClick={() => setSelected(null)} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "50%", width: 28, height: 28, color: "#6b7280", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ color: "#111827", fontSize: 17, fontWeight: 700, margin: "0 0 2px" }}>{selected.label}</h3>
                  {selected.species && <p style={{ color: "#6b7280", fontSize: 12, fontStyle: "italic", margin: "0 0 8px" }}>{selected.species}</p>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {[`🕐 ${selected.ago}`, `📊 ${selected.db} dB`, `by ${selected.user}`].map(t => (
                      <span key={t} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 8px", color: "#6b7280", fontSize: 10 }}>{t}</span>
                    ))}
                  </div>
                  <BioLeaves score={selected.bio} />
                  <div style={{ color: "#6b7280", fontSize: 11, marginTop: 3 }}>Biodiversity score: <strong style={{ color: S.color }}>{selected.bio}</strong></div>
                </div>

                {/* Audio player */}
                <div style={{ marginLeft: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <button onClick={() => setPlaying(p => !p)} style={{ width: 48, height: 48, background: S.color === "#166534" ? "#dcfce7" : S.bg, border: `2px solid ${S.border}`, borderRadius: "50%", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {playing ? "⏸" : "▶"}
                  </button>
                  <span style={{ color: "#9ca3af", fontSize: 10 }}>{selected.duration}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button style={{ flex: 1, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, color: "#374151", padding: "9px", cursor: "pointer", fontSize: 12 }}>♥ {selected.likes}</button>
                <button style={{ flex: 2, background: S.color, border: "none", borderRadius: 10, color: "#fff", padding: "9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>View Landscape →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── UPLOAD PANEL ─────────────────────────────────────────────────────── */}
      {showUploadPanel && (
        <RecordUploadPanel
          onClose={() => setShowUploadPanel(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}

// ── FlyToTarget ───────────────────────────────────────────────────────────────
// Flies the map to a new location after a successful upload
function FlyToTarget({ target, onDone }: { target: [number, number]; onDone: () => void }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.flyTo(target, 15, { duration: 1.4 });
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return null;
}
