"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { OverlaySound } from "./PixelOverlay";

type Props = {
  sounds: OverlaySound[];
};

// ── Biome palettes (exact values from design doc) ─────────────────────────────
type Pal = { sky: number[]; veg: number[]; ground: number[]; dirt: number[] };

const BIOMES: Record<string, Pal> = {
  lush:     { sky: [0x5B,0x8E,0xE6], veg: [0x2D,0x8B,0x2D], ground: [0x5C,0xB8,0x5C], dirt: [0x8B,0x69,0x14] },
  moderate: { sky: [0x8B,0xA4,0xC4], veg: [0x5A,0x8A,0x5A], ground: [0x7C,0xA8,0x7C], dirt: [0x9C,0x80,0x42] },
  degraded: { sky: [0x8C,0x8C,0x8C], veg: [0x6B,0x7C,0x5A], ground: [0x7C,0x7C,0x6B], dirt: [0x8C,0x7C,0x5A] },
  dead:     { sky: [0x6B,0x6B,0x6B], veg: [0x5A,0x5A,0x4A], ground: [0x6B,0x6B,0x5A], dirt: [0x6B,0x60,0x50] },
};

function lerpRGB(a: number[], b: number[], t: number): number[] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function lerpPal(a: Pal, b: Pal, t: number): Pal {
  return {
    sky:    lerpRGB(a.sky,    b.sky,    t),
    veg:    lerpRGB(a.veg,    b.veg,    t),
    ground: lerpRGB(a.ground, b.ground, t),
    dirt:   lerpRGB(a.dirt,   b.dirt,   t),
  };
}

function getPal(score: number): Pal {
  if (score <= 10)  return BIOMES.dead;
  if (score <= 40)  return lerpPal(BIOMES.dead,     BIOMES.degraded, (score - 10) / 30);
  if (score <= 70)  return lerpPal(BIOMES.degraded, BIOMES.moderate, (score - 40) / 30);
  return             lerpPal(BIOMES.moderate, BIOMES.lush,     Math.min(1, (score - 70) / 30));
}

function rgb(c: number[], a = 1): string {
  return a < 1
    ? `rgba(${c[0]},${c[1]},${c[2]},${a})`
    : `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ── Biodiversity score ────────────────────────────────────────────────────────
const POSITIVE = ["bird","kookaburra","magpie","rosella","cricket","insect","frog","water","stream","forest","wind","singing","chirp","nature","leaf","flower"];
const NEGATIVE = ["traffic","car","truck","engine","construction","drill","jackhammer","siren","horn","industrial","machine","noise"];

function calcScore(sounds: OverlaySound[]): number {
  if (!sounds.length) return 50;
  let pos = 0, neg = 0;
  for (const s of sounds) {
    const k = (s.dominantClass ?? "").toLowerCase();
    if (POSITIVE.some(l => k.includes(l))) pos++;
    else if (NEGATIVE.some(l => k.includes(l))) neg++;
  }
  return Math.round(Math.max(0, Math.min(100, 50 + ((pos - neg) / sounds.length) * 50)));
}

function hasRain(sounds: OverlaySound[]): boolean {
  return sounds.some(s => {
    const k = (s.dominantClass ?? "").toLowerCase();
    return k.includes("rain") || k.includes("storm");
  });
}

// ── Pixel tree ────────────────────────────────────────────────────────────────
// S = logical pixel block size in canvas pixels
// baseY = y of the trunk base (pin location)
function drawTree(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number, S: number,
  veg: number[], alpha: number,
) {
  ctx.globalAlpha = alpha;

  // Trunk: 2 blocks wide, 4 blocks tall, brown
  ctx.fillStyle = rgb([0x8B, 0x5E, 0x3C]);
  ctx.fillRect(Math.round(cx - S), Math.round(baseY - 4 * S), 2 * S, 4 * S);

  // Canopy: 4 layers — [1, 3, 5, 7] wide (narrow top → wide base)
  // Bottom of canopy sits at baseY - 4*S (flush with trunk top)
  const layers = [1, 3, 5, 7];
  for (let i = 0; i < layers.length; i++) {
    const w = layers[i] * S;
    // i=0 is top (narrowest), i=3 is bottom (widest)
    const layerY = Math.round(baseY - 4 * S - (layers.length - i) * S);
    // Slightly darken upper layers for depth
    const dark = 1 - i * 0.07;
    const c = veg.map(v => Math.round(v * dark));
    ctx.fillStyle = rgb(c);
    ctx.fillRect(Math.round(cx - w / 2), layerY, w, S + 1); // +1 avoids subpixel gaps
  }

  ctx.globalAlpha = 1;
}

// ── Particles ─────────────────────────────────────────────────────────────────
type Particle = { x: number; y: number; phase: number; speed: number };

function mkFireflies(n: number, w: number, h: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    x: Math.random() * w,
    y: Math.random() * h * 0.65,
    phase: (i / n) * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.5,
  }));
}

function mkRain(n: number, w: number, h: number): Particle[] {
  return Array.from({ length: n }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    phase: 0,
    speed: 4 + Math.random() * 3,
  }));
}

function mkDust(n: number, w: number, h: number): Particle[] {
  return Array.from({ length: n }, () => ({
    x: Math.random() * w,
    y: h * 0.3 + Math.random() * h * 0.7,
    phase: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.6,
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BiomeOverlay({ sounds }: Props) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const [score, setScore] = useState(50);

  // All mutable render-loop state in one ref to avoid stale closures
  const S = useRef({
    sounds,
    score: 50,
    tick: 0,
    fireflies: [] as Particle[],
    rain:      [] as Particle[],
    dust:      [] as Particle[],
    rafId:     0,
    projection: null as google.maps.MapCanvasProjection | null,
  });

  // Keep sounds + score in sync with props
  useEffect(() => {
    const ns = calcScore(sounds);
    S.current.sounds = sounds;
    S.current.score  = ns;
    setScore(ns);
  }, [sounds]);

  // Setup overlay + RAF loop once map is available
  useEffect(() => {
    if (!map) return;
    const mapRef = map; // capture narrowed reference for closures
    const state = S.current;

    class BiomeCanvas extends google.maps.OverlayView {
      onAdd() {
        const canvas = document.createElement("canvas");
        canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none";
        canvasRef.current = canvas;
        this.getPanes()?.overlayLayer.appendChild(canvas);

        const div = mapRef.getDiv() as HTMLElement;
        const w = div.clientWidth;
        const h = div.clientHeight;
        state.fireflies = mkFireflies(12, w, h);
        state.rain      = mkRain(20, w, h);
        state.dust      = mkDust(15, w, h);

        const loop = () => {
          state.tick++;
          this.render();
          state.rafId = requestAnimationFrame(loop);
        };
        state.rafId = requestAnimationFrame(loop);
      }

      // Maps calls draw() on bounds/zoom change — update projection
      draw() {
        state.projection = this.getProjection();
      }

      render() {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const div = mapRef.getDiv() as HTMLElement;
        const w = div.clientWidth;
        const h = div.clientHeight;
        const dpr = window.devicePixelRatio || 1;

        // Resize backing store only when needed
        const bw = Math.max(1, Math.floor(w * dpr));
        const bh = Math.max(1, Math.floor(h * dpr));
        if (canvas.width !== bw || canvas.height !== bh) {
          canvas.width  = bw;
          canvas.height = bh;
          canvas.style.width  = `${w}px`;
          canvas.style.height = `${h}px`;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);

        const sc  = state.score;
        const pal = getPal(sc);
        const t   = state.tick;
        const rain = hasRain(state.sounds);

        // ── 1. Sky gradient (top 28% of screen) ─────────────────────────────
        const skyH = Math.round(h * 0.28);
        const skyGrad = ctx.createLinearGradient(0, 0, 0, skyH);
        skyGrad.addColorStop(0,   rgb(pal.sky, 0.60));
        skyGrad.addColorStop(0.7, rgb(pal.sky, 0.20));
        skyGrad.addColorStop(1,   rgb(pal.sky, 0));
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, skyH);

        // ── 2. Ground strip (bottom 14% of screen) ──────────────────────────
        const groundH = Math.round(h * 0.14);
        const groundGrad = ctx.createLinearGradient(0, h - groundH, 0, h);
        groundGrad.addColorStop(0,   rgb(pal.ground, 0));
        groundGrad.addColorStop(0.3, rgb(pal.ground, 0.55));
        groundGrad.addColorStop(1,   rgb(pal.dirt,   0.75));
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, h - groundH, w, groundH);

        // Pixel "grass" row just above the ground fade-in — 1-block checkerboard
        const grassY = h - groundH;
        const S_G = 4; // grass block size
        for (let gx = 0; gx < w; gx += S_G * 2) {
          ctx.fillStyle = rgb(pal.ground, 0.45);
          ctx.fillRect(gx, grassY, S_G, S_G);
        }

        // ── 3. Pixel trees at sound pin locations ────────────────────────────
        const proj = state.projection;
        const zoom = mapRef.getZoom() ?? 13;
        // S scales with zoom so trees feel anchored to geography
        const TREE_S = Math.max(3, Math.min(9, Math.round(zoom - 8)));
        const treeAlpha = Math.min(0.95, 0.55 + (sc / 100) * 0.4);

        if (proj) {
          let drawn = 0;
          for (const snd of state.sounds) {
            if (drawn >= 80) break; // GPU budget cap
            const p = proj.fromLatLngToDivPixel(
              new google.maps.LatLng(snd.lat, snd.lng)
            );
            if (!p) continue;
            // Cull aggressively — skip off-screen trees
            if (p.x < -TREE_S * 8 || p.x > w + TREE_S * 8) continue;
            if (p.y < -TREE_S * 12 || p.y > h + TREE_S * 6) continue;

            drawTree(ctx, p.x, p.y, TREE_S, pal.veg, treeAlpha);
            drawn++;
          }
        }

        // ── 4. Particles ─────────────────────────────────────────────────────
        if (rain) {
          ctx.strokeStyle = rgb([0xA0, 0xC8, 0xE8], 0.55);
          ctx.lineWidth = 1;
          for (const drop of state.rain) {
            drop.y += drop.speed;
            drop.x -= drop.speed * 0.25;
            if (drop.y > h + 8)  { drop.y = -8;  drop.x = Math.random() * w; }
            if (drop.x < -8)     { drop.x = w;   }
            ctx.beginPath();
            ctx.moveTo(Math.round(drop.x),     Math.round(drop.y));
            ctx.lineTo(Math.round(drop.x - 3), Math.round(drop.y + 9));
            ctx.stroke();
          }
        } else if (sc >= 55) {
          // Fireflies: gentle sine-wave drift, flicker
          for (const ff of state.fireflies) {
            const ph = ff.phase + t * ff.speed * 0.025;
            const fx = ((ff.x + Math.sin(ph * 0.7) * 35) % w + w) % w;
            const fy = ((ff.y + Math.sin(ph * 0.5) * 18) % (h * 0.7) + h * 0.7) % (h * 0.7);
            const flicker = 0.25 + 0.75 * Math.abs(Math.sin(ph * 1.8));
            ctx.fillStyle = rgb([0xFF, 0xEE, 0x33], flicker * 0.85);
            ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
          }
        } else if (sc < 40) {
          // Smog/dust drifting upward
          const dustAlpha = sc < 20 ? 0.40 : 0.22;
          for (const d of state.dust) {
            d.y  -= d.speed * 0.35;
            d.x  += Math.sin(d.phase + t * 0.018) * 0.6;
            if (d.y < -4) { d.y = h; d.x = Math.random() * w; }
            ctx.fillStyle = rgb([0xA0, 0x80, 0x60], dustAlpha);
            ctx.fillRect(Math.round(d.x), Math.round(d.y), 2, 2);
          }
          // Extra smog veil for dead/degraded
          if (sc < 30) {
            ctx.fillStyle = rgb([0x70, 0x70, 0x60], (30 - sc) / 80);
            ctx.fillRect(0, 0, w, h);
          }
        }
      }

      onRemove() {
        cancelAnimationFrame(state.rafId);
        const canvas = canvasRef.current;
        if (canvas?.parentElement) canvas.parentElement.removeChild(canvas);
        canvasRef.current = null;
        state.projection = null;
      }
    }

    const overlay = new BiomeCanvas();
    overlayRef.current = overlay;
    overlay.setMap(mapRef);

    // Trigger draw() after map idles so projection is ready
    const idleListener = mapRef.addListener("idle", () => overlay.draw());

    return () => {
      idleListener.remove();
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]); // only on map mount/unmount

  // ── Biodiversity score HUD ────────────────────────────────────────────────
  const SEGMENTS = 10;
  const filled = Math.round((score / 100) * SEGMENTS);
  const biomeLabel =
    score >= 70 ? "LUSH"
    : score >= 40 ? "MODERATE"
    : score >= 10 ? "DEGRADED"
    : "DEAD";
  const scoreColor = score >= 70 ? "#4A9B3F" : score >= 40 ? "#C47D0A" : "#C03A2A";

  return (
    <div
      aria-live="polite"
      aria-label={`Biodiversity score ${score}. Biome: ${biomeLabel}. ${sounds.length} recordings.`}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 20,
        background: "#171A12",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: "12px 16px",
        fontFamily: "'Courier New', Courier, monospace",
        pointerEvents: "none",
        minWidth: 156,
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: 9, color: "#9E9B8E", letterSpacing: "0.15em", marginBottom: 6 }}>
        BIO SCORE
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: scoreColor,
          letterSpacing: "0.04em",
          marginBottom: 8,
          lineHeight: 1,
          transition: "color 600ms ease-out",
        }}
      >
        {score}
      </div>

      {/* 10-segment bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div
            key={i}
            style={{
              width: 11,
              height: 5,
              background: i < filled ? scoreColor : "rgba(255,255,255,0.10)",
              transition: "background 600ms ease-out",
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: 9, color: scoreColor, letterSpacing: "0.15em", transition: "color 600ms ease-out" }}>
        {biomeLabel}
      </div>
      <div style={{ fontSize: 9, color: "#9E9B8E", marginTop: 4, letterSpacing: "0.05em" }}>
        {sounds.length} recording{sounds.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
