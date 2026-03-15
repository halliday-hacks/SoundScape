"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Mic, FolderOpen } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "record" | "file";
type Step =
  | "idle"          // initial state
  | "locating"      // waiting for GPS
  | "ready"         // have location, ready to record
  | "recording"     // actively recording
  | "preview"       // recording done, showing audio preview + form
  | "uploading"     // sending to backend
  | "success"       // done
  | "error";        // something went wrong

interface Location {
  lat: number;
  lon: number;
  label: string;
}

export interface UploadResult {
  lat: number;
  lon: number;
  title: string;
  dominantClass: string;
}

interface Props {
  onClose: () => void;
  onSuccess: (result: UploadResult) => void;
}

// ─── Sound type options ───────────────────────────────────────────────────────

const SOUND_TYPES = [
  { value: "birds",        label: "Birds",        icon: "🐦" },
  { value: "insects",      label: "Insects",      icon: "🦋" },
  { value: "rain",         label: "Rain / Wind",  icon: "🌧️" },
  { value: "traffic",      label: "Traffic",      icon: "🚗" },
  { value: "music",        label: "Music",        icon: "🎵" },
  { value: "construction", label: "Construction", icon: "🏗️" },
  { value: "silence",      label: "Silence",      icon: "🌫️" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecordUploadPanel({ onClose, onSuccess }: Props) {
  const { data: session } = authClient.useSession();
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const createUpload = useMutation(api.uploads.create);

  const [mode, setMode] = useState<Mode>("record");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");

  // ── Location ──────────────────────────────────────────────────────────────
  const [location, setLocation] = useState<Location | null>(null);
  const [customLocationQuery, setCustomLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<
    { lat: number; lon: number; display_name: string }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Recording ─────────────────────────────────────────────────────────────
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── File upload ───────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Metadata ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dominantClass, setDominantClass] = useState("birds");

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Geolocation ─────────────────────────────────────────────────────────

  const fetchLocation = useCallback(async () => {
    setStep("locating");
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setStep("idle");
      return;
    }
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000,
        })
      );
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      // Reverse geocode via our server route
      let label = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
        if (res.ok) {
          const data = await res.json();
          if (data.label) label = data.label;
        }
      } catch {
        // fallback to coords
      }

      setLocation({ lat, lon, label });
      setStep("ready");
    } catch (err: unknown) {
      const geolocationError = err as GeolocationPositionError;
      if (geolocationError?.code === 1) {
        setError("Location permission denied. Please allow location access and try again.");
      } else {
        setError("Unable to get your location. Please try again.");
      }
      setStep("idle");
    }
  }, []);

  // ─── Location search (for file upload mode) ───────────────────────────────

  const searchLocation = useCallback(async () => {
    if (!customLocationQuery.trim()) return;
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(customLocationQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setLocationSuggestions(data.results ?? []);
        setShowSuggestions(true);
      } else {
        setLocationSuggestions([]);
        setShowSuggestions(true);
      }
    } catch {
      setLocationSuggestions([]);
    }
  }, [customLocationQuery]);

  const selectSuggestion = (s: { lat: number; lon: number; display_name: string }) => {
    setLocation({ lat: s.lat, lon: s.lon, label: s.display_name.split(",").slice(0, 2).join(", ") });
    setCustomLocationQuery(s.display_name.split(",").slice(0, 2).join(", "));
    setShowSuggestions(false);
  };

  // ─── Recording ────────────────────────────────────────────────────────────

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick the best supported MIME type
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"].find(
        (m) => MediaRecorder.isTypeSupported(m)
      ) ?? "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        setStep("preview");
      };

      mr.start(100);
      setStep("recording");
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone and try again.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const discardRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setStep("ready");
  };

  // ─── File picker ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    // Auto-fill title from filename
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!session?.user) {
      setError("Please sign in to upload.");
      return;
    }
    const fileToUpload = mode === "record" ? audioBlob : selectedFile;
    if (!fileToUpload) {
      setError("No audio selected.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }

    setStep("uploading");
    setError("");

    try {
      // 1) Get a short-lived upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // 2) POST the audio file directly to Convex storage
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": fileToUpload.type || "audio/webm" },
        body: fileToUpload,
      });
      if (!uploadRes.ok) throw new Error(`Storage upload failed (${uploadRes.status})`);
      const { storageId } = await uploadRes.json();

      // 3) Create the upload record in Convex DB
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
      if (location) {
        onSuccess({ lat: location.lat, lon: location.lon, title: title.trim(), dominantClass });
      }
      setTimeout(onClose, 2000);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error?.message ?? "Upload failed. Please try again.");
      setStep("preview");
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const canSubmit =
    ((mode === "record" && audioBlob) || (mode === "file" && selectedFile)) &&
    title.trim().length > 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        pointerEvents: "none",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.18)",
          pointerEvents: "all",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          pointerEvents: "all",
          width: 360,
          maxWidth: "100vw",
          height: "100%",
          background: "#fff",
          boxShadow: "-4px 0 32px rgba(0,0,0,0.14)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Add a Sound</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
              Record live or upload a file
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "50%",
              width: 30,
              height: 30,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        {/* Mode tabs */}
        <div
          style={{
            display: "flex",
            padding: "12px 20px 0",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {(["record", "file"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setStep("idle");
                setError("");
                setAudioBlob(null);
                if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
                setSelectedFile(null);
                setLocation(null);
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 8,
                border: `1px solid ${mode === m ? "#86efac" : "#e5e7eb"}`,
                background: mode === m ? "#dcfce7" : "#f9fafb",
                color: mode === m ? "#166534" : "#6b7280",
                fontWeight: mode === m ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span>{m === "record" ? <Mic size={16} /> : <FolderOpen size={16} />}</span>
              <span>{m === "record" ? "Record Live" : "Upload File"}</span>
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>

          {/* ── RECORD MODE ── */}
          {mode === "record" && (
            <>
              {/* Step: idle / locating / ready */}
              {(step === "idle" || step === "locating") && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
                  <div style={{ color: "#374151", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                    {step === "locating" ? "Getting your location…" : "Start with your location"}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 24 }}>
                    We&apos;ll pin your recording exactly where you are
                  </div>
                  <button
                    onClick={fetchLocation}
                    disabled={step === "locating"}
                    style={{
                      background: step === "locating" ? "#f3f4f6" : "#166534",
                      color: step === "locating" ? "#9ca3af" : "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 28px",
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: step === "locating" ? "not-allowed" : "pointer",
                    }}
                  >
                    {step === "locating" ? "Locating…" : "Use My Location"}
                  </button>
                </div>
              )}

              {/* Step: ready — show location + record button */}
              {step === "ready" && location && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 10,
                      padding: "10px 14px",
                      marginBottom: 24,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📍</span>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#166534" }}>{location.label}</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>
                        {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
                      </div>
                    </div>
                    <button
                      onClick={fetchLocation}
                      title="Refresh location"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#6b7280" }}
                    >
                      ↺
                    </button>
                  </div>

                  <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><Mic size={56} color="#22c55e" /></div>
                  <div style={{ color: "#374151", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                    Ready to record
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 24 }}>
                    Tap the button and capture sounds around you
                  </div>
                  <button
                    onClick={startRecording}
                    style={{
                      background: "#166534",
                      color: "#fff",
                      border: "none",
                      borderRadius: 40,
                      width: 72,
                      height: 72,
                      fontSize: 28,
                      cursor: "pointer",
                      boxShadow: "0 4px 20px rgba(22,101,52,0.35)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ⏺
                  </button>
                </div>
              )}

              {/* Step: recording */}
              {step === "recording" && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  {/* Animated ring */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        width: 96,
                        height: 96,
                        borderRadius: "50%",
                        background: "rgba(22,101,52,0.1)",
                        animation: "ripple 1.4s ease-out infinite",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        background: "rgba(22,101,52,0.15)",
                        animation: "ripple 1.4s ease-out 0.4s infinite",
                      }}
                    />
                    <button
                      onClick={stopRecording}
                      style={{
                        position: "relative",
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: 64,
                        height: 64,
                        fontSize: 22,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 16px rgba(220,38,38,0.4)",
                        zIndex: 1,
                      }}
                    >
                      ⏹
                    </button>
                  </div>

                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: "#dc2626",
                      letterSpacing: 2,
                      marginBottom: 4,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmt(recordingTime)}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>Tap to stop recording</div>

                  {location && (
                    <div style={{ marginTop: 20, fontSize: 11, color: "#9ca3af" }}>
                      📍 {location.label}
                    </div>
                  )}
                </div>
              )}

              {/* Step: preview */}
              {step === "preview" && audioUrl && (
                <div>
                  {/* Audio player */}
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 12,
                      padding: "14px",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Mic size={18} color="#166534" />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#166534" }}>Recording preview</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{fmt(recordingTime)} recorded</div>
                      </div>
                      <button
                        onClick={discardRecording}
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: "1px solid #fca5a5",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#dc2626",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        Discard
                      </button>
                    </div>
                    <audio
                      src={audioUrl}
                      controls
                      style={{ width: "100%", height: 36, borderRadius: 6 }}
                    />
                  </div>

                  {location && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: "8px 12px",
                        marginBottom: 14,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>📍</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{location.label}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>
                          {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
                        </div>
                      </div>
                    </div>
                  )}

                  <MetadataForm
                    title={title}
                    setTitle={setTitle}
                    description={description}
                    setDescription={setDescription}
                    dominantClass={dominantClass}
                    setDominantClass={setDominantClass}
                  />
                </div>
              )}
            </>
          )}

          {/* ── FILE UPLOAD MODE ── */}
          {mode === "file" && (
            <>
              {/* File picker */}
              <div
                style={{
                  border: `2px dashed ${selectedFile ? "#86efac" : "#e5e7eb"}`,
                  borderRadius: 12,
                  padding: "20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: selectedFile ? "#f0fdf4" : "#fafafa",
                  marginBottom: 16,
                  transition: "all 0.15s",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                {selectedFile ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>🎵</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>{selectedFile.name}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      {(selectedFile.size / 1024).toFixed(0)} KB · Tap to change
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Select an audio file</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                      MP3, WAV, WebM, OGG supported
                    </div>
                  </>
                )}
              </div>

              {/* Location for file upload */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  📍 Location
                </div>

                {location && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 8,
                      padding: "8px 12px",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#166534" }}>{location.label}</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>
                        {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
                      </div>
                    </div>
                    <button
                      onClick={() => setLocation(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#9ca3af" }}
                    >
                      ×
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={fetchLocation}
                    disabled={step === "locating"}
                    style={{
                      background: "#166534",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: step === "locating" ? "not-allowed" : "pointer",
                      opacity: step === "locating" ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step === "locating" ? "Locating…" : "📍 Use GPS"}
                  </button>
                  <div style={{ flex: 1, position: "relative" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input
                        type="text"
                        placeholder="Search a place…"
                        value={customLocationQuery}
                        onChange={(e) => {
                          setCustomLocationQuery(e.target.value);
                          setShowSuggestions(false);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") searchLocation(); }}
                        style={inputStyle}
                      />
                      <button
                        onClick={searchLocation}
                        style={{
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: "0 10px",
                          fontSize: 14,
                          cursor: "pointer",
                          color: "#374151",
                          flexShrink: 0,
                        }}
                      >
                        🔍
                      </button>
                    </div>
                    {showSuggestions && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                          zIndex: 100,
                          maxHeight: 180,
                          overflowY: "auto",
                        }}
                      >
                        {locationSuggestions.length === 0 ? (
                          <div style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af" }}>
                            No results found
                          </div>
                        ) : (
                          locationSuggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => selectSuggestion(s)}
                              style={{
                                width: "100%",
                                background: "none",
                                border: "none",
                                borderBottom: i < locationSuggestions.length - 1 ? "1px solid #f3f4f6" : "none",
                                padding: "9px 12px",
                                textAlign: "left",
                                cursor: "pointer",
                                fontSize: 12,
                                color: "#374151",
                                lineHeight: 1.4,
                              }}
                            >
                              📍 {s.display_name.split(",").slice(0, 3).join(", ")}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata */}
              {(selectedFile || location) && (
                <MetadataForm
                  title={title}
                  setTitle={setTitle}
                  description={description}
                  setDescription={setDescription}
                  dominantClass={dominantClass}
                  setDominantClass={setDominantClass}
                />
              )}
            </>
          )}

          {/* Success */}
          {step === "success" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#111827", marginBottom: 4 }}>
                Uploaded!
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Your sound is now on the map.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 8,
                padding: "10px 12px",
                marginTop: 12,
                fontSize: 12,
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(step === "preview" || (mode === "file" && selectedFile)) && step !== "success" && step !== "uploading" && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #f3f4f6",
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: "100%",
                background: canSubmit ? "#166534" : "#e5e7eb",
                color: canSubmit ? "#fff" : "#9ca3af",
                border: "none",
                borderRadius: 10,
                padding: "13px",
                fontWeight: 700,
                fontSize: 14,
                cursor: canSubmit ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
            >
              {session?.user ? "Submit to Map" : "Sign in to Submit"}
            </button>
          </div>
        )}

        {step === "uploading" && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #f3f4f6",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "#166534",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <LoadingSpinner />
              Uploading to map…
            </div>
          </div>
        )}

        {/* CSS animations */}
        <style>{`
          @keyframes ripple {
            0% { opacity: 0.6; transform: scale(0.6); }
            100% { opacity: 0; transform: scale(1.3); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  color: "#111827",
  outline: "none",
  width: "100%",
  minWidth: 0,
};

function MetadataForm({
  title, setTitle,
  description, setDescription,
  dominantClass, setDominantClass,
}: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  dominantClass: string; setDominantClass: (v: string) => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
          Title <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Morning birds at the park"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
          Description
        </label>
        <textarea
          placeholder="What do you hear? Any interesting details…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={400}
          style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "none", fontFamily: "inherit" }}
        />
      </div>

      <div style={{ marginBottom: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
          Sound type
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SOUND_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setDominantClass(t.value)}
              style={{
                background: dominantClass === t.value ? "#dcfce7" : "#f9fafb",
                border: `1px solid ${dominantClass === t.value ? "#86efac" : "#e5e7eb"}`,
                borderRadius: 20,
                padding: "5px 10px",
                fontSize: 12,
                color: dominantClass === t.value ? "#166534" : "#6b7280",
                fontWeight: dominantClass === t.value ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.12s",
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        border: "2px solid #bbf7d0",
        borderTopColor: "#166534",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}
