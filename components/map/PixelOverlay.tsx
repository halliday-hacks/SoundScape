"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

export type OverlaySound = {
  id: string;
  lat: number;
  lng: number;
  likeCount?: number;
  dominantClass?: string | null;
};

type Props = {
  sounds: OverlaySound[];
};

type RGB = { r: number; g: number; b: number };

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

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

function cssRgb(c: RGB) {
  return `rgb(${c.r} ${c.g} ${c.b})`;
}

function cssRgba(c: RGB, a: number) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

function getDevicePixelRatio() {
  if (typeof window === "undefined") return 1;
  return window.devicePixelRatio || 1;
}

export function PixelOverlay({ sounds }: Props) {
  const map = useMap();
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // SoundScape UI tokens (flat)
  const tokens = useMemo(() => {
    return {
      surface: { r: 30, g: 33, b: 24 }, // #1E2118
      primary: { r: 74, g: 155, b: 63 }, // #4A9B3F
      text: { r: 237, g: 232, b: 220 }, // #EDE8DC
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    class CanvasOverlay extends google.maps.OverlayView {
      private raf: number | null = null;

      onAdd() {
        const canvas = document.createElement("canvas");
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.pointerEvents = "none";
        canvasRef.current = canvas;

        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(canvas);
      }

      draw() {
        // Map provides this projection after onAdd
        const projection = this.getProjection();
        const div = map.getDiv();
        const canvas = canvasRef.current;
        if (!projection || !div || !canvas) return;

        const w = div.clientWidth;
        const h = div.clientHeight;
        const dpr = getDevicePixelRatio();

        // resize only when needed (keeps draw cheap)
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
        ctx.imageSmoothingEnabled = false;

        // Simple sanity marker at map center (Step 2 checkpoint)
        const c = map.getCenter();
        if (c) {
          const p = projection.fromLatLngToDivPixel(c);
          if (p) {
            ctx.fillStyle = cssRgba(tokens.text, 0.75);
            ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
          }
        }

        // Step 3: draw "pixel pins" for sounds
        for (const s of sounds) {
          const p = projection.fromLatLngToDivPixel(new google.maps.LatLng(s.lat, s.lng));
          if (!p) continue;
          if (p.x < -32 || p.y < -32 || p.x > w + 32 || p.y > h + 32) continue;

          const like = Math.max(0, s.likeCount ?? 0);
          const t = clamp01(like / 50); // 0..50 likes => 0..1
          const color = mix(tokens.primary, tokens.text, 0.20 - 0.12 * t);
          const size = 6 + Math.round(10 * t); // 6..16px

          // Flat dot, crisp pixels
          ctx.fillStyle = cssRgb(color);
          const x0 = Math.round(p.x - size / 2);
          const y0 = Math.round(p.y - size / 2);
          ctx.fillRect(x0, y0, size, size);

          // Thin outline for contrast (protocol border alpha)
          ctx.strokeStyle = "rgba(255,255,255,0.22)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x0 - 0.5, y0 - 0.5, size + 1, size + 1);
        }
      }

      onRemove() {
        if (this.raf) {
          cancelAnimationFrame(this.raf);
          this.raf = null;
        }
        const canvas = canvasRef.current;
        if (canvas?.parentElement) canvas.parentElement.removeChild(canvas);
        canvasRef.current = null;
      }
    }

    const overlay = new CanvasOverlay();
    overlayRef.current = overlay;
    overlay.setMap(map);

    const listeners: google.maps.MapsEventListener[] = [
      map.addListener("bounds_changed", () => overlay.draw()),
      map.addListener("idle", () => overlay.draw()),
    ];

    return () => {
      listeners.forEach((l) => l.remove());
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map, sounds, tokens]);

  return null;
}

