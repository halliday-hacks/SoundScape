"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PixelWorldEngine, type Classification } from "@/lib/pixel-engine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULTS: Classification = {
  birds: 0.35,
  insects: 0.25,
  rain: 0.1,
  traffic: 0,
  music: 0,
  construction: 0,
  silence: 0.3,
  biodiversityScore: 58,
  dominantClass: "birds",
};

const CAT_CONFIG = [
  { key: "birds"        as const, label: "Birds",        color: "#7DD3FC", emoji: "🐦" },
  { key: "insects"      as const, label: "Insects",      color: "#A5B4FC", emoji: "🦋" },
  { key: "rain"         as const, label: "Rain / Wind",  color: "#93C5FD", emoji: "🌧️" },
  { key: "traffic"      as const, label: "Traffic",      color: "#F87171", emoji: "🚗" },
  { key: "music"        as const, label: "Music",        color: "#C4B5FD", emoji: "🎵" },
  { key: "construction" as const, label: "Construction", color: "#FBB040", emoji: "🔨" },
  { key: "silence"      as const, label: "Silence",      color: "#475569", emoji: "🌫️" },
] as const;

type SliderKey = Exclude<keyof Classification, "biodiversityScore" | "dominantClass">;

function calcBioScore(c: Record<SliderKey, number>): number {
  return Math.max(
    0,
    Math.min(
      100,
      c.birds * 42 + c.insects * 28 + c.rain * 8 - c.traffic * 38 - c.construction * 26 + 20
    )
  );
}

function calcDominant(c: Record<SliderKey, number>): string {
  const keys: SliderKey[] = ["birds", "insects", "rain", "traffic", "music", "construction", "silence"];
  return keys.reduce((a, b) => (c[a] >= c[b] ? a : b), "silence" as SliderKey);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PixelCanvasProps {
  /** Pass real classification from the audio pipeline. Omit for demo mode. */
  classification?: Classification;
}

export function PixelCanvas({ classification }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PixelWorldEngine | null>(null);
  const [demo, setDemo] = useState<Classification>(DEFAULTS);

  const active = classification ?? demo;
  // Boot engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new PixelWorldEngine(canvas);
    engineRef.current = engine;
    engine.start();
    return () => engine.destroy();
  }, []);

  // Push classification updates to engine
  useEffect(() => {
    engineRef.current?.setClassification(active);
  }, [active]);

  function handleSlider(key: SliderKey, value: number) {
    setDemo((prev) => {
      const next = { ...prev, [key]: value } as Record<SliderKey, number>;
      return {
        ...prev,
        ...next,
        biodiversityScore: calcBioScore(next),
        dominantClass: calcDominant(next),
      };
    });
  }

  const isDemoMode = !classification;

  return (
    <div>
      {/* ------------------------------------------------------------------ */}
      {/* Canvas                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative w-full overflow-hidden rounded-none sm:rounded-xl sm:border border-[rgba(147,197,253,0.08)] bg-[#07090E]">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ imageRendering: "pixelated", aspectRatio: "2 / 1" }}
        />

        {/* Top-left: dominant class badge */}
        <div
          className="absolute top-2 left-2 flex items-center gap-1.5 rounded-sm bg-black/60 px-2 py-1 uppercase text-[#DDE4F0]"
          style={{ fontFamily: "var(--font-pixel)", fontSize: "7px", letterSpacing: "0.05em" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
            style={{
              backgroundColor:
                CAT_CONFIG.find((c) => c.key === active.dominantClass)?.color ?? "#475569",
            }}
          />
          {active.dominantClass}
        </div>


        {/* Bottom-left: demo label */}
        {isDemoMode && (
          <div
            className="absolute bottom-2 left-2 rounded-sm px-2 py-1 text-[#93C5FD] border border-[rgba(147,197,253,0.25)] bg-[rgba(147,197,253,0.08)]"
            style={{ fontFamily: "var(--font-pixel)", fontSize: "7px" }}
          >
            DEMO
          </div>
        )}

        {/* Bottom-right: Sound Map button with rainbow gradient border */}
        <Link
          href="/map"
          className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-md text-white font-medium transition-opacity hover:opacity-90"
          style={{
            fontSize: "11px",
            background: "linear-gradient(#07090E, #07090E) padding-box, linear-gradient(135deg, #f87171, #fb923c, #fbbf24, #4ade80, #60a5fa, #c084fc) border-box",
            border: "1px solid transparent",
            backdropFilter: "blur(4px)",
            backgroundColor: "rgba(7,9,14,0.75)",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
            <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" /><path d="M9 3v15" /><path d="M15 6v15" />
          </svg>
          Sound Map
        </Link>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Demo controls                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-3 sm:px-0 mt-3 space-y-3">
        {/* Demo sliders (hidden when real classification is provided) */}
        {isDemoMode && (
          <div className="rounded-lg border border-[rgba(147,197,253,0.09)] bg-[#0B0E18] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#93C5FD] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#5C6A82]">
                Demo — drag to simulate environment
              </span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {CAT_CONFIG.filter((c) => c.key !== "silence").map(({ key, label, color, emoji }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs" style={{ color }}>
                    {emoji} {label}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={demo[key]}
                    onChange={(e) => handleSlider(key, parseFloat(e.target.value))}
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
                    style={{ accentColor: color }}
                  />
                  <span className="w-7 text-right font-mono text-[10px] text-[#5C6A82]">
                    {Math.round(demo[key] * 100)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
