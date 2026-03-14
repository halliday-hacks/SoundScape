"use client";

import { useEffect, useRef, useState } from "react";
import { PixelWorldEngine, type Classification } from "@/lib/pixel-engine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULTS: Classification = {
  bird: 0.35,
  insect: 0.25,
  traffic: 0,
  construction: 0,
  wind: 0.1,
  silence: 0.3,
  biodiversityScore: 58,
  dominantClass: "bird",
};

const CAT_CONFIG = [
  { key: "bird"         as const, label: "Birds",        color: "#4CAF50", emoji: "🐦" },
  { key: "insect"       as const, label: "Insects",      color: "#8BC34A", emoji: "🦋" },
  { key: "traffic"      as const, label: "Traffic",      color: "#F44336", emoji: "🚗" },
  { key: "construction" as const, label: "Construction", color: "#FF9800", emoji: "🔨" },
  { key: "wind"         as const, label: "Wind / Rain",  color: "#42A5F5", emoji: "🌧️" },
  { key: "silence"      as const, label: "Silence",      color: "#9E9E9E", emoji: "🌫️" },
] as const;

type SliderKey = Exclude<keyof Classification, "biodiversityScore" | "dominantClass">;

function calcBioScore(c: Record<SliderKey, number>): number {
  return Math.max(
    0,
    Math.min(
      100,
      c.bird * 42 + c.insect * 28 + c.wind * 8 - c.traffic * 38 - c.construction * 26 + 20
    )
  );
}

function calcDominant(c: Record<SliderKey, number>): string {
  const keys: SliderKey[] = ["bird", "insect", "traffic", "construction", "wind", "silence"];
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
  const bioScore = Math.round(active.biodiversityScore);
  const bioSegments = Math.round(bioScore / 10);

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
      <div className="relative w-full overflow-hidden rounded-none sm:rounded-xl sm:border border-[rgba(255,255,255,0.08)] bg-[#0D0F0A]">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ imageRendering: "pixelated", aspectRatio: "2 / 1" }}
        />

        {/* Top-left: dominant class badge */}
        <div
          className="absolute top-2 left-2 flex items-center gap-1.5 rounded-sm bg-black/55 px-2 py-1 uppercase text-[#EDE8DC]"
          style={{ fontFamily: "var(--font-pixel)", fontSize: "7px", letterSpacing: "0.05em" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
            style={{
              backgroundColor:
                CAT_CONFIG.find((c) => c.key === active.dominantClass)?.color ?? "#9E9E9E",
            }}
          />
          {active.dominantClass}
        </div>

        {/* Top-right: 10-segment bio score bar */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1 bg-black/55 px-2 py-1 rounded-sm">
          <span style={{ fontFamily: "var(--font-pixel)", fontSize: "6px", color: "#9E9B8E" }}>
            BIO
          </span>
          <div className="flex items-center gap-[2px]">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                style={{
                  width: "6px",
                  height: "10px",
                  backgroundColor: i < bioSegments ? "#C47D0A" : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Bottom-right: demo label */}
        {isDemoMode && (
          <div
            className="absolute bottom-2 right-2 rounded-sm px-2 py-1 text-[#C47D0A] border border-[rgba(197,125,10,0.35)] bg-[rgba(197,125,10,0.12)]"
            style={{ fontFamily: "var(--font-pixel)", fontSize: "7px" }}
          >
            DEMO
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Classification bars + demo controls                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-3 sm:px-0 mt-3 space-y-3">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
          {CAT_CONFIG.map(({ key, label, color, emoji }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-[10px]">{emoji}</span>
                <span className="truncate text-[10px] text-[#9E9B8E]">{label}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${active[key] * 100}%`, backgroundColor: color }}
                />
              </div>
              <div className="font-mono text-[10px] text-[#9E9B8E]">
                {Math.round(active[key] * 100)}%
              </div>
            </div>
          ))}
        </div>

        {/* Demo sliders (hidden when real classification is provided) */}
        {isDemoMode && (
          <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#171A12] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C47D0A] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#9E9B8E]">
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
                  <span className="w-7 text-right font-mono text-[10px] text-[#9E9B8E]">
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
