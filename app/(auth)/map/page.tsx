"use client";

import Link from "next/link";

const DESIGNS = [
  {
    id: 1,
    name: "Field Station",
    tag: "Dark · Glass Morphism",
    desc: "Full-screen dark map with floating glass UI. Filter pills, animated waveform, biodiversity ring gauge, and a smooth slide-in sound panel — no popups.",
    accent: "#4ade80",
    bg: "#080808",
    textMuted: "rgba(255,255,255,.45)",
    textMain: "#f4f4f5",
    border: "rgba(255,255,255,.1)",
    preview: ["🌑 Dark map fills screen", "🎛️ Glass filter pills", "⟶ Panel slides in on pin tap", "🌿 Biodiversity ring gauge"],
  },
  {
    id: 2,
    name: "The Duality",
    tag: "Split Screen · Pixel + Map",
    desc: "Left half: pixel art biome that transforms live when you select a pin. Right half: the Leaflet map. The concept made physical — sound becomes landscape.",
    accent: "#a3e635",
    bg: "#050a05",
    textMuted: "rgba(255,255,255,.45)",
    textMain: "#f4f4f5",
    border: "rgba(255,255,255,.1)",
    preview: ["🎮 Pixel biome reacts to pins", "🗺️ 40/60 split layout", "🌿→🏙️ Watch biome degrade & grow", "🎨 Pixel art scanline overlay"],
  },
  {
    id: 3,
    name: "Expedition Log",
    tag: "Earthy · Field Journal",
    desc: "Warm dark forest aesthetic. A collapsible journal sidebar lists all recordings as log entries. Click an entry or a pin to expand the sound card at the bottom.",
    accent: "#c8a96a",
    bg: "#100d07",
    textMuted: "rgba(200,169,106,.45)",
    textMain: "#c8a96a",
    border: "#2a1e0a",
    preview: ["📖 Field journal sidebar", "🟤 Warm sepia map tiles", "📍 Coordinate display bar", "🎼 Inline waveform player"],
  },
  {
    id: 4,
    name: "Mission Control",
    tag: "Black · Broadcast Dashboard",
    desc: "Pure black. Cinematic. VU meters on the left, map in the center, live detection feed on the right. Scrolling event ticker at the bottom. Like watching NASA.",
    accent: "#f87171",
    bg: "#000",
    textMuted: "rgba(255,255,255,.3)",
    textMain: "#e2e8f0",
    border: "rgba(255,255,255,.06)",
    preview: ["📺 Three-column layout", "📊 Animated VU level meters", "📡 Live detection feed", "📰 Scrolling event ticker"],
  },
  {
    id: 5,
    name: "Park Guide",
    tag: "Light · Nature App",
    desc: "Warm off-white, light map tiles, rounded corners everywhere. A clean sidebar with category toggles and a bottom sheet that slides up for each recording.",
    accent: "#166534",
    bg: "#fff",
    textMuted: "#6b7280",
    textMain: "#111827",
    border: "#e5e7eb",
    preview: ["☀️ Light warm mode", "🍃 Category filter toggles", "⬆️ Bottom sheet slide-up", "🌿 Leaf biodiversity meter"],
  },
];

export default function MapPickerPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", padding: "32px 24px 48px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ maxWidth: 960, margin: "0 auto 36px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>🗺️</span>
          <div>
            <h1 style={{ color: "#f4f4f5", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -.3 }}>Sound Map — Choose a Design</h1>
            <p style={{ color: "rgba(255,255,255,.35)", fontSize: 13, margin: "4px 0 0" }}>5 different UI approaches. Pick the one you want to ship.</p>
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.07)" }} />
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
        {DESIGNS.map(d => (
          <Link key={d.id} href={`/map/v${d.id}`} style={{ textDecoration: "none" }}>
            <div style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 14,
              overflow: "hidden",
              cursor: "pointer",
              transition: "all .2s ease",
              height: "100%",
              display: "flex", flexDirection: "column",
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.border = `1px solid ${d.accent}44`;
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${d.accent}18`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,255,255,.08)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              {/* Colour preview swatch */}
              <div style={{ height: 64, background: d.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                {/* Subtle gradient overlay */}
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 120%, ${d.accent}22 0%, transparent 70%)` }} />
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.accent, boxShadow: `0 0 12px ${d.accent}` }} />
                  <span style={{ color: d.textMain, fontSize: 12, fontWeight: 600, opacity: .7 }}>/map/v{d.id}</span>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <h2 style={{ color: "#f4f4f5", fontSize: 15, fontWeight: 700, margin: 0 }}>{d.name}</h2>
                  <span style={{ background: `${d.accent}18`, border: `1px solid ${d.accent}35`, color: d.accent, fontSize: 9, padding: "2px 7px", borderRadius: 10, fontWeight: 600, letterSpacing: .3, whiteSpace: "nowrap", marginLeft: 8 }}>
                    {d.id === 1 ? "Popular" : d.id === 5 ? "Clean" : ""}
                  </span>
                </div>

                <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginBottom: 8, letterSpacing: .3 }}>{d.tag}</div>

                <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12, lineHeight: 1.6, margin: "0 0 12px", flex: 1 }}>{d.desc}</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                  {d.preview.map(p => (
                    <div key={p} style={{ color: "rgba(255,255,255,.3)", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "rgba(255,255,255,.15)", fontSize: 10 }}>›</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: `${d.accent}12`, border: `1px solid ${d.accent}30`, borderRadius: 8, padding: "8px 14px", color: d.accent, fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                  Open Design {d.id} →
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <div style={{ maxWidth: 960, margin: "32px auto 0", textAlign: "center", color: "rgba(255,255,255,.18)", fontSize: 11 }}>
        All designs use the same 10 demo pins over Hồ Chí Minh City · Click any pin to interact
      </div>
    </div>
  );
}
