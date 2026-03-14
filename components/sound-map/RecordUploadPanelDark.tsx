"use client";

/**
 * Dark-themed record/upload panel — matches Map V1's dark glass aesthetic.
 * Same functionality as RecordUploadPanel.tsx but with inverted colour scheme.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "record" | "file";
type Step =
  | "idle"
  | "locating"
  | "ready"
  | "recording"
  | "preview"
  | "uploading"
  | "success";

interface Location { lat: number; lon: number; label: string; }

export interface UploadResult {
  lat: number; lon: number;
  title: string; dominantClass: string;
}

interface Props {
  onClose: () => void;
  onSuccess: (result: UploadResult) => void;
}

const SOUND_TYPES = [
  { value: "birds",        label: "Birds",        icon: "🐦" },
  { value: "insects",      label: "Insects",      icon: "🦋" },
  { value: "rain",         label: "Rain / Wind",  icon: "🌧️" },
  { value: "traffic",      label: "Traffic",      icon: "🚗" },
  { value: "music",        label: "Music",        icon: "🎵" },
  { value: "construction", label: "Construction", icon: "🏗️" },
  { value: "silence",      label: "Silence",      icon: "🌫️" },
];

// ─── Style helpers ────────────────────────────────────────────────────────────

const D = {
  bg:         "rgba(8,8,8,.97)",
  surface:    "rgba(255,255,255,.04)",
  border:     "rgba(255,255,255,.1)",
  borderFaint:"rgba(255,255,255,.06)",
  textMain:   "#f8fafc",
  textMid:    "rgba(255,255,255,.55)",
  textMuted:  "rgba(255,255,255,.3)",
  accent:     "#22c55e",
  accentBg:   "rgba(34,197,94,.12)",
  accentBord: "rgba(34,197,94,.35)",
  inputBg:    "rgba(255,255,255,.05)",
  red:        "#f87171",
  redBg:      "rgba(248,113,113,.12)",
  redBord:    "rgba(248,113,113,.3)",
};

const inp: React.CSSProperties = {
  background: D.inputBg,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  padding: "9px 11px",
  fontSize: 13,
  color: D.textMain,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecordUploadPanelDark({ onClose, onSuccess }: Props) {
  const { data: session } = authClient.useSession();
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const createUpload      = useMutation(api.uploads.create);

  const [mode, setMode]   = useState<Mode>("record");
  const [step, setStep]   = useState<Step>("idle");
  const [error, setError] = useState("");

  const [location, setLocation]             = useState<Location | null>(null);
  const [customQuery, setCustomQuery]       = useState("");
  const [suggestions, setSuggestions]       = useState<{ lat: number; lon: number; display_name: string }[]>([]);
  const [showSug, setShowSug]               = useState(false);

  const [recordingTime, setRecordingTime]   = useState(0);
  const [audioBlob, setAudioBlob]           = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl]             = useState<string | null>(null);

  const [selectedFile, setSelectedFile]     = useState<File | null>(null);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const [title, setTitle]                   = useState("");
  const [description, setDescription]      = useState("");
  const [dominantClass, setDominantClass]   = useState("birds");

  const mrRef    = useRef<MediaRecorder | null>(null);
  const chunks   = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Geolocation ──────────────────────────────────────────────────────────

  const fetchLocation = useCallback(async () => {
    setStep("locating"); setError("");
    if (!navigator.geolocation) { setError("Geolocation not supported."); setStep("idle"); return; }
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 12000 })
      );
      const { latitude: lat, longitude: lon } = pos.coords;
      let label = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      try {
        const r = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
        if (r.ok) { const d = await r.json(); if (d.label) label = d.label; }
      } catch { /* keep coords */ }
      setLocation({ lat, lon, label });
      setStep("ready");
    } catch (e: unknown) {
      const ge = e as GeolocationPositionError;
      setError(ge?.code === 1 ? "Location permission denied." : "Unable to get location.");
      setStep("idle");
    }
  }, []);

  // ── Location search ───────────────────────────────────────────────────────

  const searchLocation = useCallback(async () => {
    if (!customQuery.trim()) return;
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(customQuery)}`);
      const d = await r.json();
      setSuggestions(d.results ?? []);
      setShowSug(true);
    } catch { setSuggestions([]); }
  }, [customQuery]);

  const pickSuggestion = (s: { lat: number; lon: number; display_name: string }) => {
    setLocation({ lat: s.lat, lon: s.lon, label: s.display_name.split(",").slice(0, 2).join(", ") });
    setCustomQuery(s.display_name.split(",").slice(0, 2).join(", "));
    setShowSug(false);
  };

  // ── Recording ─────────────────────────────────────────────────────────────

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ["audio/webm;codecs=opus","audio/webm","audio/ogg","audio/mp4"].find(m => MediaRecorder.isTypeSupported(m)) ?? "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mrRef.current = mr;
      chunks.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: mime || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        setStep("preview");
      };
      mr.start(100);
      setStep("recording");
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { setError("Microphone access denied."); }
  };

  const stopRecording = () => {
    mrRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const discardRecording = () => {
    setAudioBlob(null);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    setRecordingTime(0);
    setStep("ready");
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!session?.user) { setError("Please sign in to upload."); return; }
    const file = mode === "record" ? audioBlob : selectedFile;
    if (!file) { setError("No audio selected."); return; }
    if (!title.trim()) { setError("Please enter a title."); return; }

    setStep("uploading"); setError("");
    try {
      const uploadUrl = await generateUploadUrl();
      const r = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "audio/webm" },
        body: file,
      });
      if (!r.ok) throw new Error(`Upload failed (${r.status})`);
      const { storageId } = await r.json();

      await createUpload({
        userId: session.user.id,
        storageId,
        title: title.trim(),
        description: description.trim() || undefined,
        durationSeconds: mode === "record" ? recordingTime : undefined,
        lat: location?.lat,
        lon: location?.lon,
        locationLabel: location?.label || undefined,
        dominantClass,
        tags: [dominantClass],
      });

      setStep("success");
      if (location) onSuccess({ lat: location.lat, lon: location.lon, title: title.trim(), dominantClass });
      setTimeout(onClose, 2000);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "Upload failed.");
      setStep("preview");
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const canSubmit = ((mode === "record" && audioBlob) || (mode === "file" && selectedFile)) && title.trim().length > 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", pointerEvents: "none" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", pointerEvents: "all" }} />

      {/* Panel */}
      <div style={{ position: "relative", pointerEvents: "all", width: 360, maxWidth: "100vw", height: "100%", background: D.bg, backdropFilter: "blur(32px)", borderLeft: `1px solid ${D.border}`, display: "flex", flexDirection: "column", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 14px", borderBottom: `1px solid ${D.borderFaint}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: D.textMain }}>Add a Sound</div>
            <div style={{ fontSize: 11, color: D.textMuted, marginTop: 2 }}>Record live or upload a file</div>
          </div>
          <button onClick={onClose} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: D.textMid, fontSize: 16 }}>×</button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", padding: "12px 20px 0", gap: 8, flexShrink: 0 }}>
          {(["record", "file"] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setStep("idle"); setError(""); setAudioBlob(null); if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); } setSelectedFile(null); setLocation(null); }}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${mode === m ? D.accentBord : D.border}`, background: mode === m ? D.accentBg : D.surface, color: mode === m ? D.accent : D.textMid, fontWeight: mode === m ? 600 : 400, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .15s" }}>
              <span>{m === "record" ? "🎙" : "📁"}</span>
              <span>{m === "record" ? "Record Live" : "Upload File"}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>

          {/* ── RECORD mode ── */}
          {mode === "record" && (
            <>
              {(step === "idle" || step === "locating") && (
                <div style={{ textAlign: "center", padding: "36px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
                  <div style={{ color: D.textMain, fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                    {step === "locating" ? "Getting your location…" : "Start with your location"}
                  </div>
                  <div style={{ color: D.textMuted, fontSize: 12, marginBottom: 24 }}>We'll pin your recording exactly where you are</div>
                  <button onClick={fetchLocation} disabled={step === "locating"}
                    style={{ background: step === "locating" ? D.surface : D.accent, color: step === "locating" ? D.textMuted : "#000", border: "none", borderRadius: 10, padding: "12px 28px", fontWeight: 700, fontSize: 14, cursor: step === "locating" ? "not-allowed" : "pointer" }}>
                    {step === "locating" ? "Locating…" : "Use My Location"}
                  </button>
                </div>
              )}

              {step === "ready" && location && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ background: D.accentBg, border: `1px solid ${D.accentBord}`, borderRadius: 10, padding: "10px 14px", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📍</span>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: D.accent }}>{location.label}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{location.lat.toFixed(5)}, {location.lon.toFixed(5)}</div>
                    </div>
                    <button onClick={fetchLocation} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: D.textMuted }}>↺</button>
                  </div>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>🎙</div>
                  <div style={{ color: D.textMain, fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Ready to record</div>
                  <div style={{ color: D.textMuted, fontSize: 12, marginBottom: 24 }}>Tap the button to start</div>
                  <button onClick={startRecording}
                    style={{ background: D.accent, color: "#000", border: "none", borderRadius: "50%", width: 72, height: 72, fontSize: 28, cursor: "pointer", boxShadow: "0 4px 24px rgba(34,197,94,.35)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>⏺</button>
                </div>
              )}

              {step === "recording" && (
                <div style={{ textAlign: "center", padding: "36px 0" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: 16 }}>
                    <div style={{ position: "absolute", width: 96, height: 96, borderRadius: "50%", background: "rgba(239,68,68,.1)", animation: "dpRipple 1.4s ease-out infinite" }} />
                    <div style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", background: "rgba(239,68,68,.15)", animation: "dpRipple 1.4s ease-out .4s infinite" }} />
                    <button onClick={stopRecording}
                      style={{ position: "relative", background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 64, height: 64, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(239,68,68,.5)", zIndex: 1 }}>⏹</button>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#ef4444", letterSpacing: 2, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{fmt(recordingTime)}</div>
                  <div style={{ color: D.textMuted, fontSize: 12 }}>Tap to stop</div>
                  {location && <div style={{ marginTop: 16, fontSize: 11, color: D.textMuted }}>📍 {location.label}</div>}
                </div>
              )}

              {step === "preview" && audioUrl && (
                <div>
                  <div style={{ background: D.accentBg, border: `1px solid ${D.accentBord}`, borderRadius: 12, padding: "14px", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>🎙</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: D.accent }}>Recording preview</div>
                        <div style={{ fontSize: 11, color: D.textMuted }}>{fmt(recordingTime)} recorded</div>
                      </div>
                      <button onClick={discardRecording}
                        style={{ marginLeft: "auto", background: D.redBg, border: `1px solid ${D.redBord}`, borderRadius: 6, padding: "4px 8px", color: D.red, fontSize: 11, cursor: "pointer" }}>Discard</button>
                    </div>
                    <audio src={audioUrl} controls style={{ width: "100%", height: 36 }} />
                  </div>

                  {location && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                      <span style={{ fontSize: 14 }}>📍</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: D.textMain }}>{location.label}</div>
                        <div style={{ fontSize: 10, color: D.textMuted }}>{location.lat.toFixed(5)}, {location.lon.toFixed(5)}</div>
                      </div>
                    </div>
                  )}

                  <MetaForm title={title} setTitle={setTitle} desc={description} setDesc={setDescription} dc={dominantClass} setDc={setDominantClass} />
                </div>
              )}
            </>
          )}

          {/* ── FILE mode ── */}
          {mode === "file" && (
            <>
              <div onClick={() => fileInputRef.current?.click()}
                style={{ border: `2px dashed ${selectedFile ? D.accentBord : D.border}`, borderRadius: 12, padding: "20px", textAlign: "center", cursor: "pointer", background: selectedFile ? D.accentBg : D.surface, marginBottom: 16, transition: "all .15s" }}>
                <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: "none" }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setSelectedFile(f);
                    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
                  }} />
                {selectedFile ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>🎵</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.accent }}>{selectedFile.name}</div>
                    <div style={{ fontSize: 11, color: D.textMuted, marginTop: 2 }}>{(selectedFile.size / 1024).toFixed(0)} KB · Tap to change</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.textMain }}>Select audio file</div>
                    <div style={{ fontSize: 11, color: D.textMuted, marginTop: 2 }}>MP3, WAV, WebM, OGG</div>
                  </>
                )}
              </div>

              {/* Location */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: D.textMid, letterSpacing: .6, marginBottom: 8 }}>LOCATION</div>
                {location && (
                  <div style={{ background: D.accentBg, border: `1px solid ${D.accentBord}`, borderRadius: 8, padding: "8px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: D.accent }}>{location.label}</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>{location.lat.toFixed(5)}, {location.lon.toFixed(5)}</div>
                    </div>
                    <button onClick={() => setLocation(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: D.textMuted }}>×</button>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={fetchLocation} disabled={step === "locating"}
                    style={{ background: D.accent, color: "#000", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: step === "locating" ? "not-allowed" : "pointer", opacity: step === "locating" ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    {step === "locating" ? "…" : "📍 GPS"}
                  </button>
                  <div style={{ flex: 1, position: "relative" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input type="text" placeholder="Search a place…" value={customQuery}
                        onChange={e => { setCustomQuery(e.target.value); setShowSug(false); }}
                        onKeyDown={e => { if (e.key === "Enter") searchLocation(); }}
                        style={{ ...inp, padding: "8px 10px", boxSizing: "border-box" }} />
                      <button onClick={searchLocation}
                        style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, padding: "0 10px", fontSize: 14, cursor: "pointer", color: D.textMid, flexShrink: 0 }}>🔍</button>
                    </div>
                    {showSug && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "rgba(10,10,10,.98)", border: `1px solid ${D.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.4)", zIndex: 100, maxHeight: 180, overflowY: "auto" }}>
                        {suggestions.length === 0
                          ? <div style={{ padding: "10px 12px", fontSize: 12, color: D.textMuted }}>No results found</div>
                          : suggestions.map((s, i) => (
                            <button key={i} onClick={() => pickSuggestion(s)}
                              style={{ width: "100%", background: "none", border: "none", borderBottom: i < suggestions.length - 1 ? `1px solid ${D.borderFaint}` : "none", padding: "9px 12px", textAlign: "left", cursor: "pointer", fontSize: 12, color: D.textMid, lineHeight: 1.4 }}>
                              📍 {s.display_name.split(",").slice(0, 3).join(", ")}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(selectedFile || location) && (
                <MetaForm title={title} setTitle={setTitle} desc={description} setDesc={setDescription} dc={dominantClass} setDc={setDominantClass} />
              )}
            </>
          )}

          {/* Success */}
          {step === "success" && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: D.textMain, marginBottom: 4 }}>Uploaded!</div>
              <div style={{ fontSize: 13, color: D.textMuted }}>Your sound is now on the map.</div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: D.redBg, border: `1px solid ${D.redBord}`, borderRadius: 8, padding: "10px 12px", marginTop: 12, fontSize: 12, color: D.red, display: "flex", alignItems: "center", gap: 6 }}>
              <span>⚠️</span><span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === "preview" || (mode === "file" && selectedFile)) && step !== "success" && step !== "uploading" && (
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${D.borderFaint}`, flexShrink: 0 }}>
            <button onClick={handleSubmit} disabled={!canSubmit}
              style={{ width: "100%", background: canSubmit ? D.accent : D.surface, color: canSubmit ? "#000" : D.textMuted, border: "none", borderRadius: 10, padding: "13px", fontWeight: 700, fontSize: 14, cursor: canSubmit ? "pointer" : "not-allowed", transition: "all .15s" }}>
              {session?.user ? "Submit to Map" : "Sign in to Submit"}
            </button>
          </div>
        )}

        {step === "uploading" && (
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${D.borderFaint}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: D.accent, fontSize: 13, fontWeight: 600 }}>
            <Spinner /> Uploading…
          </div>
        )}

        <style>{`
          @keyframes dpRipple { 0%{opacity:.6;transform:scale(.6)} 100%{opacity:0;transform:scale(1.4)} }
          @keyframes dpSpin   { to{transform:rotate(360deg)} }
        `}</style>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaForm({
  title, setTitle, desc, setDesc, dc, setDc,
}: {
  title: string; setTitle: (v: string) => void;
  desc: string;  setDesc:  (v: string) => void;
  dc: string;    setDc:    (v: string) => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.4)", letterSpacing: .6, display: "block", marginBottom: 5 }}>TITLE *</label>
        <input type="text" placeholder="e.g. Morning birds at the park" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} style={inp} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.4)", letterSpacing: .6, display: "block", marginBottom: 5 }}>DESCRIPTION</label>
        <textarea placeholder="What do you hear?" value={desc} onChange={e => setDesc(e.target.value)} rows={2} maxLength={400}
          style={{ ...inp, resize: "none" }} />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.4)", letterSpacing: .6, display: "block", marginBottom: 8 }}>SOUND TYPE</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SOUND_TYPES.map(t => (
            <button key={t.value} onClick={() => setDc(t.value)}
              style={{ background: dc === t.value ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.04)", border: `1px solid ${dc === t.value ? "rgba(34,197,94,.4)" : "rgba(255,255,255,.1)"}`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: dc === t.value ? "#22c55e" : "rgba(255,255,255,.5)", fontWeight: dc === t.value ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all .12s" }}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 16, height: 16, border: "2px solid rgba(34,197,94,.25)", borderTopColor: "#22c55e", borderRadius: "50%", animation: "dpSpin .7s linear infinite", flexShrink: 0 }} />;
}
