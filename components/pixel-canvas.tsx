"use client";

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
  { key: "birds"        as const, label: "Birds",        color: "#22D3EE", emoji: "🐦" },
  { key: "insects"      as const, label: "Insects",      color: "#818CF8", emoji: "🦋" },
  { key: "rain"         as const, label: "Rain / Wind",  color: "#38BDF8", emoji: "🌧️" },
  { key: "traffic"      as const, label: "Traffic",      color: "#F43F5E", emoji: "🚗" },
  { key: "music"        as const, label: "Music",        color: "#A78BFA", emoji: "🎵" },
  { key: "construction" as const, label: "Construction", color: "#FBBF24", emoji: "🔨" },
  { key: "silence"      as const, label: "Silence",      color: "#94A3B8", emoji: "🌫️" },
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
      <div className="relative w-full overflow-hidden rounded-none sm:rounded-xl sm:border border-[rgba(139,92,246,0.08)] bg-[#080B14]">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ imageRendering: "pixelated", aspectRatio: "2 / 1" }}
        />



      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Demo controls                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-3 sm:px-0 mt-3 space-y-3">
        {/* Demo sliders (hidden when real classification is provided) */}
        {isDemoMode && (
          <div className="rounded-lg border border-[rgba(139,92,246,0.09)] bg-[#0D1117] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/60">
                Live — drag to simulate environment
              </span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {CAT_CONFIG.filter((c) => c.key !== "silence").map(({ key, label, color, emoji }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-[#F1F5F9]">
                    <span style={{ color }}>{emoji}</span> {label}
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
                  <span className="w-7 text-right font-mono text-[10px] text-[#6B7280]">
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
