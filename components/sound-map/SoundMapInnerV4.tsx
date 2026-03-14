"use client";

import { useState, useEffect, useRef } from "react";
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

const CFG: Record<SoundType, { color: string; label: string; icon: string; freq: number }> = {
  birds:        { color: "#4ade80", label: "BIRDS",        icon: "🐦", freq: 0.72 },
  traffic:      { color: "#f87171", label: "TRAFFIC",      icon: "🚗", freq: 0.88 },
  music:        { color: "#c084fc", label: "MUSIC",        icon: "🎵", freq: 0.55 },
  rain:         { color: "#60a5fa", label: "RAIN",         icon: "🌧️", freq: 0.38 },
  construction: { color: "#fb923c", label: "CONSTRUCT.",   icon: "🏗️", freq: 0.93 },
  insects:      { color: "#a3e635", label: "INSECTS",      icon: "🦋", freq: 0.61 },
  silence:      { color: "#64748b", label: "SILENCE",      icon: "🌫️", freq: 0.18 },
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

const TICKER_ITEMS = [
  "🐦 Spotted Dove detected — Tân Bình District",
  "🚗 High traffic noise — Bình Thạnh — 82 dB",
  "🦋 Cicada chorus detected — District 7",
  "🌧️ Rain approaching — Gò Vấp District",
  "🏗️ Construction alert — District 1 — 89 dB",
  "🐦 Red-whiskered Bulbul — Phú Nhuận",
  "🌿 Biodiversity score 82 recorded — highest today",
  "🚗 Rush hour detected — Quận 3 — above threshold",
  "🐦 Common Myna colony — Bình Tân — 3 individuals",
  "🌫️ Quiet zone identified — District 9 — bio 63",
];

function makePin(type: SoundType, selected: boolean): L.DivIcon {
  const { color } = CFG[type];
  return L.divIcon({
    className: "",
    iconSize: [12, 12], iconAnchor: [6, 6],
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:1px solid #000;box-shadow:0 0 6px ${color}88${selected?`,0 0 0 3px ${color}44`:""};"></div>`,
  });
}

function MapStyles() {
  useMap();
  useEffect(() => {
    const id = "v4-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      .leaflet-tile { filter:grayscale(.75) brightness(.48) contrast(1.25) !important; }
      .leaflet-container { background:#000 !important; }
      .leaflet-control-zoom { display:none !important; }
      .leaflet-control-attribution { background:rgba(0,0,0,.7) !important; color:rgba(255,255,255,.15) !important; font-size:8px !important; }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

// ─── Animated VU bar ──────────────────────────────────────────────────────────
function VuMeter({ type, value }: { type: SoundType; value: number }) {
  const { color, label } = CFG[type];
  const bars = 12;
  const filled = Math.round(value * bars);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ fontSize: 10, color, letterSpacing: .5, marginBottom: 1 }}>{CFG[type].icon}</div>
      <div style={{ display: "flex", flexDirection: "column-reverse", gap: 2, height: 80 }}>
        {Array.from({ length: bars }).map((_, i) => {
          const active = i < filled;
          const col = i >= 9 ? "#f87171" : i >= 6 ? "#fbbf24" : color;
          return (
            <div key={i} style={{
              width: 14, height: 5,
              background: active ? col : "rgba(255,255,255,.05)",
              borderRadius: 1,
              boxShadow: active ? `0 0 4px ${col}66` : "none",
              animation: active ? `vu${i % 3} ${.4 + (i % 3) * .15}s ease-in-out infinite alternate` : "none",
              animationDelay: `${i * .08}s`,
            }} />
          );
        })}
      </div>
      <div style={{ fontSize: 7, color: "rgba(255,255,255,.25)", letterSpacing: .5, textAlign: "center", marginTop: 2, maxWidth: 20, lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

// ─── Feed item ────────────────────────────────────────────────────────────────
function FeedItem({ pin, selected, onClick }: { pin: Pin; selected: boolean; onClick: () => void }) {
  const c = CFG[pin.type];
  return (
    <div onClick={onClick} style={{
      padding: "8px 10px",
      borderBottom: "1px solid rgba(255,255,255,.04)",
      cursor: "pointer",
      background: selected ? `${c.color}0c` : "transparent",
      borderLeft: `2px solid ${selected ? c.color : "transparent"}`,
      transition: "all .15s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10 }}>{c.icon}</span>
          <span style={{ color: c.color, fontSize: 10, fontWeight: 700, letterSpacing: .3 }}>{pin.label.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "v4blink 1.8s ease-in-out infinite" }} />
          <span style={{ color: "rgba(255,255,255,.2)", fontSize: 8, fontFamily: "monospace" }}>LIVE</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {/* mini level bar */}
        <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,.06)", borderRadius: 1, overflow: "hidden" }}>
          <div style={{ width: `${pin.intensity * 100}%`, height: "100%", background: c.color, borderRadius: 1 }} />
        </div>
        <span style={{ color: "rgba(255,255,255,.25)", fontSize: 8, fontFamily: "monospace", minWidth: 32 }}>{pin.db}dB</span>
      </div>
      <div style={{ color: "rgba(255,255,255,.2)", fontSize: 8, fontFamily: "monospace", marginTop: 2 }}>{pin.ago} · {pin.user}</div>
    </div>
  );
}

export default function SoundMapInnerV4() {
  const [selected, setSelected] = useState<Pin | null>(null);
  const tickerRef = useRef<HTMLDivElement>(null);

  const avgBio = Math.round(PINS.reduce((a, b) => a + b.bio, 0) / PINS.length);
  const sorted = [...PINS].sort((a, b) => b.db - a.db);

  // Aggregate signal levels per type
  const levels = (Object.keys(CFG) as SoundType[]).reduce((acc, t) => {
    const pins = PINS.filter(p => p.type === t);
    acc[t] = pins.length ? Math.max(...pins.map(p => p.intensity)) : 0.05;
    return acc;
  }, {} as Record<SoundType, number>);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#000", fontFamily: "'Courier New',Courier,monospace", overflow: "hidden" }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 44, background: "#000", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, letterSpacing: 1.5 }}>SOUNDSOIL</span>
          <span style={{ color: "#22c55e", fontSize: 9, letterSpacing: 2 }}>LIVE MONITORING</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", animation: "v4blink .8s ease-in-out infinite" }} />
            <span style={{ color: "#f87171", fontSize: 9, letterSpacing: 1 }}>ON AIR</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, color: "rgba(255,255,255,.3)", fontSize: 10 }}>
          <span>📍 {PINS.length} ACTIVE PINS</span>
          <span>🌿 AVG BIO <span style={{ color: "#4ade80" }}>{avgBio}</span></span>
          <span style={{ color: "rgba(255,255,255,.15)" }}>HCM CITY · 14:23 ICT</span>
        </div>
      </div>

      {/* ── MAIN ROW ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT: VU meters */}
        <div style={{ width: 148, background: "#000", borderRight: "1px solid rgba(255,255,255,.06)", display: "flex", flexDirection: "column", padding: "16px 0 16px" }}>
          <div style={{ color: "rgba(255,255,255,.2)", fontSize: 8, letterSpacing: 2, textAlign: "center", marginBottom: 12 }}>SIGNAL LEVELS</div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-around", padding: "0 10px" }}>
            {(Object.keys(CFG) as SoundType[]).map(t => (
              <VuMeter key={t} type={t} value={levels[t]} />
            ))}
          </div>
        </div>

        {/* CENTER: Map */}
        <div style={{ flex: 1, position: "relative" }}>
          {/* Map frame glow */}
          <div style={{ position: "absolute", inset: 6, border: "1px solid rgba(255,255,255,.06)", pointerEvents: "none", zIndex: 999 }} />
          <MapContainer center={[10.7769, 106.7009]} zoom={14}
            style={{ width: "100%", height: "100%", background: "#000" }}
            zoomControl={false}>
            <MapStyles />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
            {PINS.map(pin => (
              <Marker key={pin.id} position={[pin.lat, pin.lng]}
                icon={makePin(pin.type, selected?.id === pin.id)}
                eventHandlers={{ click: () => setSelected(p => p?.id === pin.id ? null : pin) }} />
            ))}
          </MapContainer>

          {/* Selected overlay */}
          {selected && (
            <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "rgba(0,0,0,.92)", border: `1px solid ${CFG[selected.type].color}50`, padding: "10px 16px", minWidth: 280, backdropFilter: "blur(12px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ color: CFG[selected.type].color, fontSize: 12, fontWeight: 700, letterSpacing: .5 }}>
                    {CFG[selected.type].icon} {selected.label.toUpperCase()}
                  </span>
                  {selected.species && <div style={{ color: "rgba(255,255,255,.3)", fontSize: 9, fontStyle: "italic", marginTop: 1 }}>{selected.species}</div>}
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.3)", fontSize: 14, cursor: "pointer" }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, color: "rgba(255,255,255,.35)", fontSize: 9 }}>
                <span>BIO <span style={{ color: CFG[selected.type].color }}>{selected.bio}</span></span>
                <span>{selected.db} dB</span>
                <span>♥ {selected.likes}</span>
                <span>👁 {selected.listens}</span>
                <span>{selected.ago}</span>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6 }}>
                {Array.from({ length: 22 }).map((_, i) => (
                  <div key={i} style={{ width: 3, height: `${12 + Math.abs(Math.sin(i * .7)) * 14}px`, background: CFG[selected.type].color, opacity: .6, borderRadius: 1 }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Feed list */}
        <div style={{ width: 200, background: "#000", borderLeft: "1px solid rgba(255,255,255,.06)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 10px 6px", borderBottom: "1px solid rgba(255,255,255,.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,.2)", fontSize: 8, letterSpacing: 2 }}>DETECTION FEED</span>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", animation: "v4blink 1.4s ease-in-out infinite" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {sorted.map(pin => (
              <FeedItem key={pin.id} pin={pin} selected={selected?.id === pin.id} onClick={() => setSelected(p => p?.id === pin.id ? null : pin)} />
            ))}
          </div>
          <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,.05)", color: "rgba(255,255,255,.15)", fontSize: 8 }}>
            AUTO-REFRESHING · 5s interval
          </div>
        </div>
      </div>

      {/* ── TICKER ──────────────────────────────────────────────────────────── */}
      <div style={{ height: 30, background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ background: "#22c55e", color: "#000", fontSize: 8, fontWeight: 700, padding: "0 10px", height: "100%", display: "flex", alignItems: "center", letterSpacing: 1, flexShrink: 0 }}>LIVE</div>
        <div ref={tickerRef} style={{ overflow: "hidden", flex: 1 }}>
          <div style={{ display: "flex", gap: 40, whiteSpace: "nowrap", animation: "v4ticker 28s linear infinite", color: "rgba(255,255,255,.45)", fontSize: 10 }}>
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
              <span key={i} style={{ paddingLeft: i === 0 ? 16 : 0 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes v4blink { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes v4ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes vu0 { from{opacity:.5} to{opacity:1} }
        @keyframes vu1 { from{opacity:.4} to{opacity:.9} }
        @keyframes vu2 { from{opacity:.6} to{opacity:1} }
      `}</style>
    </div>
  );
}
