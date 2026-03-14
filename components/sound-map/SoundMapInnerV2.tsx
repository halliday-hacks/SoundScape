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

const CFG: Record<SoundType, { color: string; label: string; icon: string; skyA: string; skyB: string; groundColor: string }> = {
  birds:        { color: "#4ade80", label: "Birds",        icon: "🐦", skyA: "#0b2518", skyB: "#071510", groundColor: "#1d3d1d" },
  traffic:      { color: "#94a3b8", label: "Traffic",      icon: "🚗", skyA: "#141414", skyB: "#080808", groundColor: "#252525" },
  music:        { color: "#c084fc", label: "Music",        icon: "🎵", skyA: "#1a0a30", skyB: "#0d0520", groundColor: "#1e0a3a" },
  rain:         { color: "#60a5fa", label: "Rain",         icon: "🌧️", skyA: "#0a1520", skyB: "#06090e", groundColor: "#0e1f2e" },
  construction: { color: "#fb923c", label: "Construction", icon: "🏗️", skyA: "#1e1005", skyB: "#0e0802", groundColor: "#2a1808" },
  insects:      { color: "#a3e635", label: "Insects",      icon: "🦋", skyA: "#0f1e05", skyB: "#080e02", groundColor: "#1a2e08" },
  silence:      { color: "#cbd5e1", label: "Silence",      icon: "🌫️", skyA: "#10101a", skyB: "#08080e", groundColor: "#16161e" },
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

// ─── Pixel biome canvas ────────────────────────────────────────────────────────
function BiomeCanvas({ pin }: { pin: Pin | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const type: SoundType = pin?.type ?? "silence";
    const c = CFG[type];
    const GY = Math.floor(H * 0.60); // ground y

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, GY);
    grad.addColorStop(0, c.skyA);
    grad.addColorStop(1, c.skyB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, GY);

    // Ground
    ctx.fillStyle = c.groundColor;
    ctx.fillRect(0, GY, W, H - GY);

    // ── type-specific overlays ──────────────────────────────────────────────
    if (type === "birds" || type === "insects") {
      // Stars
      ctx.fillStyle = "rgba(255,255,255,.55)";
      [[12,8],[40,18],[75,5],[108,22],[145,10],[180,28],[220,6],[260,20],[295,12],[340,8],[370,22]].forEach(([sx,sy]) => ctx.fillRect(sx,sy,2,2));

      // Trees
      const trees = type === "birds" ? [28, 90, 160, 240, 310] : [55, 130, 210, 285];
      trees.forEach(x => {
        const h = 28 + Math.floor(Math.random() * 0) + (type === "birds" ? 20 : 12);
        ctx.fillStyle = "#4a2e14"; ctx.fillRect(x + 6, GY - h, 5, h);
        ctx.fillStyle = "#1a4a22"; ctx.fillRect(x, GY - h - 14, 17, 10);
        ctx.fillStyle = "#226630"; ctx.fillRect(x + 3, GY - h - 24, 11, 12);
        ctx.fillStyle = "#2e8040"; ctx.fillRect(x + 5, GY - h - 34, 7, 12);
      });
    }

    if (type === "insects") {
      // Flowers
      [[65,GY-10],[135,GY-10],[215,GY-10],[290,GY-10]].forEach(([fx,fy],i) => {
        const cols = ["#e84a7f","#f5c842","#a855f7","#38bdf8"];
        ctx.fillStyle = "#3a6e1a"; ctx.fillRect(fx+3, fy-12, 2, 12);
        ctx.fillStyle = cols[i]; ctx.fillRect(fx, fy-18, 8, 6);
        ctx.fillStyle = "#fff"; ctx.fillRect(fx+2, fy-16, 4, 4);
      });
    }

    if (type === "traffic") {
      ctx.fillStyle = "#303030"; ctx.fillRect(0, GY, W, H - GY);
      // Cracks
      ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 1;
      [[20,GY,55,GY+35],[90,GY+5,115,GY+42],[180,GY,210,GY+28],[280,GY+8,300,GY+38]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });
      // Smog
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = `rgba(90,90,90,${.12 + i*.015})`;
        ctx.fillRect(i*38+5, GY-22+i%3*6, 32, 16);
      }
    }

    if (type === "rain") {
      // Rain streaks
      ctx.fillStyle = "#4a8abf";
      for (let i = 0; i < 50; i++) {
        const rx = (i * 77 + 13) % W, ry = (i * 43 + 7) % H;
        ctx.fillRect(rx, ry, 1, 5);
      }
      // Puddles
      ctx.fillStyle = "#1e5577";
      [[45,GY+7,28,5],[130,GY+10,18,4],[230,GY+6,32,6],[320,GY+9,22,5]].forEach(([x,y,w,h]) => ctx.fillRect(x,y,w,h));
    }

    if (type === "construction") {
      ctx.fillStyle = "#2a1e0e"; ctx.fillRect(0, GY, W, H - GY);
      const cols2 = ["#6a4a1e","#4a3010","#7a5a24"];
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = cols2[i % 3];
        ctx.fillRect(20 + i * 52, GY - 15 + (i % 3) * 4, 42, 18);
      }
      // Dust
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(200,160,80,.25)`;
        ctx.fillRect((i * 23 + 5) % W, GY - 40 + (i % 4) * 8, 5, 5);
      }
    }

    if (type === "silence") {
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = `rgba(140,140,170,${.04 + i*.003})`;
        ctx.fillRect(i * 17, H * .28 + (i % 4) * 14, 24, 14);
      }
    }

    if (type === "music") {
      ctx.fillStyle = "#8b5cf6"; ctx.font = "bold 14px monospace";
      [["♪",30,80],["♫",110,55],["♩",200,90],["♬",280,65],["♪",350,75]].forEach(([n,x,y]) => ctx.fillText(n as string, x as number, y as number));
    }

    // Scanline overlay for pixel feel
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = "rgba(0,0,0,.12)";
      ctx.fillRect(0, y, W, 1);
    }
  }, [pin]);

  return (
    <canvas ref={ref} width={400} height={260}
      style={{ width: "100%", height: "100%", imageRendering: "pixelated", display: "block" }} />
  );
}

// ─── Map tile styler ───────────────────────────────────────────────────────────
function MapStyles() {
  useMap();
  useEffect(() => {
    const id = "v2-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      .leaflet-tile { image-rendering:pixelated !important; filter:sepia(.4) hue-rotate(80deg) saturate(.65) brightness(.72) contrast(1.1) !important; }
      .leaflet-container { background:#060e06 !important; font-family:monospace; }
      .leaflet-control-zoom a { background:#060e06 !important; color:#4ade80 !important; border:2px solid #22c55e !important; border-radius:0 !important; box-shadow:2px 2px 0 #000 !important; }
      .leaflet-control-zoom a:hover { background:#22c55e !important; color:#000 !important; }
      .leaflet-control-attribution { background:rgba(0,0,0,.6) !important; color:#4ade8044 !important; font-size:8px !important; }
      .leaflet-popup-content-wrapper { background:#060e06 !important; border:2px solid #22c55e !important; border-radius:0 !important; box-shadow:3px 3px 0 #000 !important; }
      .leaflet-popup-tip { background:#22c55e !important; }
      .leaflet-popup-content-wrapper, .leaflet-popup-content { color:#4ade80 !important; font-family:monospace !important; font-size:11px !important; }
      @keyframes v2pulse { 0%{opacity:.9;transform:scale(.2)} 100%{opacity:0;transform:scale(1)} }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

// ─── Pin factory ───────────────────────────────────────────────────────────────
function makePin(type: SoundType, selected: boolean): L.DivIcon {
  const { color, icon } = CFG[type];
  const s = selected ? 44 : 34;
  return L.divIcon({
    className: "",
    iconSize: [s, s], iconAnchor: [s/2, s/2],
    html: `<div style="
      width:${s}px;height:${s}px;
      background:${color};border:3px solid #000;
      box-shadow:3px 3px 0 #000${selected ? `,0 0 0 3px ${color}` : ""};
      display:flex;align-items:center;justify-content:center;
      font-size:${s * .45}px;image-rendering:pixelated;cursor:pointer;
    ">${icon}
      <div style="position:absolute;width:${s*2.2}px;height:${s*2.2}px;border:2px solid ${color};top:-${s*.6}px;left:-${s*.6}px;animation:v2pulse 2.2s ease-out infinite;pointer-events:none;"></div>
    </div>`,
  });
}

// ─── Bio score bar ─────────────────────────────────────────────────────────────
function BioBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3, transition: "width .7s ease" }} />
      </div>
      <span style={{ color, fontSize: 13, fontWeight: 700, minWidth: 28 }}>{score}</span>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function SoundMapInnerV2() {
  const [selected, setSelected] = useState<Pin | null>(null);
  const [playing, setPlaying] = useState(false);

  const S = selected ? CFG[selected.type] : CFG.birds;

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#050a05", overflow: "hidden" }}>

      {/* ── LEFT: BIOME PANEL ───────────────────────────────────────────────── */}
      <div style={{ width: "42%", minWidth: 320, display: "flex", flexDirection: "column", borderRight: "2px solid rgba(255,255,255,.06)", position: "relative" }}>

        {/* Top header */}
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.05)", background: "#050a05" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🌱</span>
            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>SoundSoil</span>
          </div>
          <span style={{ background: "#22c55e18", border: "1px solid #22c55e40", color: "#4ade80", fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 700, letterSpacing: 1 }}>● LIVE</span>
        </div>

        {/* Biome label */}
        <div style={{ padding: "10px 18px 8px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>{S.icon}</span>
          <span style={{ color: S.color, fontFamily: "'Courier New',monospace", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            {selected ? `${selected.label.toUpperCase()} · ${S.label.toUpperCase()}` : "IDLE · SELECT A PIN"}
          </span>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <BiomeCanvas pin={selected} />
          {/* CRT frame */}
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 40px rgba(0,0,0,.6)", pointerEvents: "none" }} />
          {/* Scanline */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.08) 3px,rgba(0,0,0,.08) 4px)", pointerEvents: "none" }} />
        </div>

        {/* Info panel — appears when pin selected */}
        <div style={{
          padding: selected ? "16px 18px" : "0 18px",
          maxHeight: selected ? 220 : 0,
          overflow: "hidden",
          transition: "max-height .4s ease, padding .4s ease",
          borderTop: "1px solid rgba(255,255,255,.05)",
          background: "#060c06",
        }}>
          {selected && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <h3 style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 700, margin: 0 }}>{selected.label}</h3>
                  {selected.species && <p style={{ color: "rgba(255,255,255,.35)", fontSize: 10, fontStyle: "italic", margin: "2px 0 0" }}>{selected.species}</p>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPlaying(p => !p)} style={{ width: 32, height: 32, background: S.color, border: "none", borderRadius: "50%", color: "#000", fontSize: 12, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {playing ? "⏸" : "▶"}
                  </button>
                  <button onClick={() => setSelected(null)} style={{ width: 32, height: 32, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: "50%", color: "rgba(255,255,255,.4)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginBottom: 4 }}>BIODIVERSITY SCORE</div>
                <BioBar score={selected.bio} color={S.color} />
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[`🕐 ${selected.ago}`, `📊 ${selected.db} dB`, `♥ ${selected.likes}`, `👁 ${selected.listens}`, `⏱ ${selected.duration}`].map(t => (
                  <span key={t} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 4, padding: "3px 8px", color: "rgba(255,255,255,.5)", fontSize: 10 }}>{t}</span>
                ))}
              </div>

              <button style={{ marginTop: 12, width: "100%", background: `${S.color}18`, border: `1px solid ${S.color}40`, borderRadius: 8, color: S.color, padding: "9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                View Full Landscape →
              </button>
            </>
          )}
        </div>

        {/* Hint when no selection */}
        {!selected && (
          <div style={{ padding: "16px 18px", borderTop: "1px solid rgba(255,255,255,.04)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "v2blink 1.4s ease-in-out infinite" }} />
            <span style={{ color: "rgba(255,255,255,.25)", fontSize: 11 }}>Tap a pin on the map to watch the biome transform</span>
          </div>
        )}
      </div>

      {/* ── RIGHT: MAP ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={[10.7769, 106.7009]} zoom={14}
          style={{ width: "100%", height: "100%", background: "#060e06" }}
          zoomControl={true}>
          <MapStyles />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
          {PINS.map(pin => (
            <Marker key={pin.id} position={[pin.lat, pin.lng]}
              icon={makePin(pin.type, selected?.id === pin.id)}
              eventHandlers={{ click: () => setSelected(p => p?.id === pin.id ? null : pin) }} />
          ))}
        </MapContainer>

        {/* Map label */}
        <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "rgba(6,14,6,.85)", border: "2px solid #22c55e", boxShadow: "3px 3px 0 #000", padding: "6px 18px", fontFamily: "'Courier New',monospace", color: "#4ade80", fontSize: 11, letterSpacing: 2, fontWeight: "bold", whiteSpace: "nowrap" }}>
          ♪ HỒ CHÍ MINH CITY ♪
        </div>

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 20, right: 14, zIndex: 1000, background: "rgba(6,14,6,.85)", border: "2px solid rgba(34,197,94,.3)", padding: "10px 12px" }}>
          {(Object.keys(CFG) as SoundType[]).map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 10, color: "rgba(74,222,128,.7)", fontFamily: "monospace" }}>
              <div style={{ width: 10, height: 10, background: CFG[t].color, border: "1px solid #000", boxShadow: "1px 1px 0 #000" }} />
              <span>{CFG[t].icon} {CFG[t].label}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes v2blink { 0%,100%{opacity:.3} 50%{opacity:1} }
      `}</style>
    </div>
  );
}
