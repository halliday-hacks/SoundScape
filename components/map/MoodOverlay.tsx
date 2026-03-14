"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { OverlaySound } from "./PixelOverlay";

type Props = {
  sounds: OverlaySound[];
};

type RGB = { r: number; g: number; b: number };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

function cssRgba(c: RGB, a: number) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

function getDevicePixelRatio() {
  if (typeof window === "undefined") return 1;
  return window.devicePixelRatio || 1;
}

export function MoodOverlay({ sounds }: Props) {
  const map = useMap();
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const palette = useMemo(
    () => ({
      surface: { r: 13, g: 15, b: 10 }, // #0D0F0A
      lush: { r: 74, g: 155, b: 63 }, // primary green
      rain: { r: 160, g: 200, b: 232 }, // rain particle
      smog: { r: 112, g: 112, b: 96 }, // smog overlay
    }),
    [],
  );

  useEffect(() => {
    if (!map) return;

    class MoodCanvas extends google.maps.OverlayView {
      onAdd() {
        const canvas = document.createElement("canvas");
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.pointerEvents = "none";
        canvasRef.current = canvas;
        this.getPanes()?.overlayLayer.appendChild(canvas);
      }

      draw() {
        const div = map.getDiv();
        const canvas = canvasRef.current;
        if (!div || !canvas) return;

        const w = div.clientWidth;
        const h = div.clientHeight;
        const dpr = getDevicePixelRatio();

        const nextW = Math.max(1, Math.floor(w * dpr));
        const nextH = Math.max(1, Math.floor(h * dpr));
        if (canvas.width !== nextW || canvas.height !== nextH) {
          canvas.width = nextW;
          canvas.height = nextH;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const bounds = map.getBounds();
        if (!bounds || sounds.length === 0) return;

        const mood = pickMood(sounds);
        if (!mood) return;

        if (mood === "rain") {
          // Light rain streaks, subtle
          ctx.fillStyle = cssRgba(palette.rain, 0.08);
          for (let x = 0; x < w; x += 18) {
            for (let y = -20; y < h; y += 40) {
              ctx.fillRect(x, y, 1, 24);
            }
          }
        } else if (mood === "smog") {
          const c = mix(palette.surface, palette.smog, 0.4);
          ctx.fillStyle = cssRgba(c, 0.32);
          ctx.fillRect(0, 0, w, h);
        } else if (mood === "lush") {
          const c = mix(palette.surface, palette.lush, 0.25);
          ctx.fillStyle = cssRgba(c, 0.22);
          const gradient = ctx.createRadialGradient(
            w / 2,
            h * 0.9,
            h * 0.1,
            w / 2,
            h * 0.9,
            h * 0.8,
          );
          gradient.addColorStop(0, cssRgba(c, 0.65));
          gradient.addColorStop(1, cssRgba(c, 0));
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, w, h);
        }
      }

      onRemove() {
        const canvas = canvasRef.current;
        if (canvas?.parentElement) canvas.parentElement.removeChild(canvas);
        canvasRef.current = null;
      }
    }

    const overlay = new MoodCanvas();
    overlayRef.current = overlay;
    overlay.setMap(map);

    const idle = map.addListener("idle", () => overlay.draw());
    return () => {
      idle.remove();
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map, sounds, palette]);

  return null;
}

function pickMood(sounds: OverlaySound[]): "lush" | "rain" | "smog" | null {
  if (!sounds.length) return null;

  const counts: Record<string, number> = {};
  for (const s of sounds) {
    const kind = (s.dominantClass ?? "").toLowerCase();
    if (!kind) continue;
    counts[kind] = (counts[kind] || 0) + 1;
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const [top] = entries;
  const k = top[0];

  if (k.includes("rain") || k.includes("storm")) return "rain";
  if (k.includes("traffic") || k.includes("construction") || k.includes("smog"))
    return "smog";
  if (k.includes("bird") || k.includes("insect")) return "lush";

  return null;
}

