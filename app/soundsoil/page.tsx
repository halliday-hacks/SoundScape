"use client";

import { useRef, useState } from "react";

type Step = 1 | 2 | 3;
type Mode = "gif" | "veo";

interface ProgressState {
  step: Step;
  label: string;
  detail?: string;
  frameProgress?: number;
}

export default function SoundSoilPage() {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [gif, setGif] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("gif");
  const inputRef = useRef<HTMLInputElement>(null);

  const GIF_STEPS = [
    { n: 1, label: "YAMNet" },
    { n: 2, label: "Claude" },
    { n: 3, label: "GIF" },
  ] as const;

  const VEO_STEPS = [
    { n: 1, label: "YAMNet" },
    { n: 2, label: "Gemini" },
    { n: 3, label: "Veo" },
  ] as const;

  const STEPS = mode === "veo" ? VEO_STEPS : GIF_STEPS;

  async function run(file: File) {
    setGif(null);
    setVideo(null);
    setError(null);
    setFilename(file.name);
    setProgress({ step: 1, label: "Starting…" });

    const form = new FormData();
    form.append("audio", file);
    form.append("mode", mode);

    const res = await fetch("/api/soundsoil", { method: "POST", body: form });
    if (!res.body) {
      setError("No response stream");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const messages = buf.split("\n\n");
      buf = messages.pop() ?? "";

      for (const msg of messages) {
        const eventLine = msg.match(/^event: (\w+)/m)?.[1];
        const dataLine = msg.match(/^data: (.+)/m)?.[1];
        if (!eventLine || !dataLine) continue;

        const data = JSON.parse(dataLine);
        if (eventLine === "progress") setProgress(data);
        if (eventLine === "done") {
          if (data.gif) setGif(data.gif);
          if (data.video) setVideo(data.video);
          setProgress(null);
        }
        if (eventLine === "error") {
          setError(data.message);
          setProgress(null);
        }
      }
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) run(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) run(file);
  }

  function reset() {
    setGif(null);
    setVideo(null);
    setFilename(null);
    setError(null);
  }

  const currentStep = progress?.step ?? (gif || video ? 3 : 0);
  const overallProgress =
    gif || video
      ? 100
      : currentStep === 1
        ? 15
        : currentStep === 2
          ? 45
          : currentStep === 3
            ? 65 + (progress?.frameProgress ?? 0) * 35
            : 0;

  const result = gif ?? video;
  const isVideo = !!video;
  const stem = filename?.replace(/\.[^.]+$/, "");

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">SoundSoil</h1>
        <p className="text-sm text-zinc-500">Upload audio → visual art</p>
      </div>

      {/* Mode toggle */}
      {!progress && !result && (
        <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 text-sm">
          <button
            onClick={() => setMode("gif")}
            className={`px-4 py-1.5 rounded-md transition-colors font-medium ${
              mode === "gif"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Pixel Art GIF
          </button>
          <button
            onClick={() => setMode("veo")}
            className={`px-4 py-1.5 rounded-md transition-colors font-medium ${
              mode === "veo"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Veo Video
          </button>
        </div>
      )}

      {/* Mode description */}
      {!progress && !result && (
        <p className="text-xs text-zinc-600 -mt-4 max-w-xs text-center">
          {mode === "gif"
            ? "Fast · pixel-art animation via Claude + canvas"
            : "Slower · cinematic 8s video with audio via Veo 3.1"}
        </p>
      )}

      {/* Upload zone */}
      {!progress && !result && (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={`w-full max-w-md border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-colors
            ${dragging ? "border-white bg-zinc-900" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-950"}`}
        >
          <div className="text-4xl">{mode === "veo" ? "🎬" : "🎵"}</div>
          <p className="text-sm text-zinc-400 text-center">
            Drop a <span className="text-white">.wav</span> or{" "}
            <span className="text-white">.mp3</span> here, or click to browse
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1">
            <p className="text-sm text-zinc-400">{filename}</p>
            <p className="text-base font-medium">{progress.label}</p>
            {progress.detail && (
              <p className="text-xs text-zinc-500">{progress.detail}</p>
            )}
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                      ${
                        currentStep > s.n
                          ? "bg-green-500 text-black"
                          : currentStep === s.n
                            ? "bg-white text-black"
                            : "bg-zinc-800 text-zinc-500"
                      }`}
                  >
                    {currentStep > s.n ? "✓" : s.n}
                  </div>
                  <span
                    className={`text-xs ${currentStep >= s.n ? "text-white" : "text-zinc-600"}`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 mb-5 transition-colors ${currentStep > s.n ? "bg-green-500" : "bg-zinc-700"}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="w-full max-w-lg space-y-4">
          <div className="text-center space-y-1">
            <p className="text-sm text-zinc-500">{filename}</p>
            <p className="text-xs text-green-500">Done</p>
          </div>

          {isVideo ? (
            <video
              src={result}
              controls
              autoPlay
              loop
              className="w-full rounded-xl"
            />
          ) : (
            <img
              src={result}
              alt="Generated pixel art"
              className="w-full rounded-xl"
              style={{ imageRendering: "pixelated" }}
            />
          )}

          <div className="flex gap-3">
            <a
              href={result}
              download={
                isVideo ? `soundsoil-${stem}.mp4` : `soundsoil-${stem}.gif`
              }
              className="flex-1 text-center text-sm py-2 rounded-lg bg-white text-black font-medium hover:bg-zinc-200 transition-colors"
            >
              Download {isVideo ? "MP4" : "GIF"}
            </a>
            <button
              onClick={reset}
              className="flex-1 text-sm py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              Try another
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="w-full max-w-md space-y-3">
          <div className="rounded-lg bg-red-950 border border-red-800 p-4 text-sm text-red-300">
            {error}
          </div>
          <button
            onClick={() => {
              setError(null);
              setFilename(null);
            }}
            className="w-full text-sm py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-900"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
