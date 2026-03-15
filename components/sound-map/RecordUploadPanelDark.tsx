"use client";

/**
 * RecordUploadPanelDark — dark-themed record / upload panel.
 *
 * Integrates:
 *  - Orb          → volume-reactive 3D sphere (reacts to actual mic input)
 *  - LiveWaveform → scrolling bar visualizer during recording
 *  - Waveform     → static bar visualizer of recorded audio in preview
 *  - ScrubBar     → custom audio scrub / seek player (replaces native <audio>)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { Orb } from "@/components/ui/orb";
import { Waveform } from "@/components/ui/waveform";
import {
  ScrubBarContainer,
  ScrubBarTrack,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTimeLabel,
} from "@/components/ui/scrub-bar";
import { audioFileToWav } from "@/lib/audio-to-wav";

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = "record" | "file";
type Step =
  | "ready"
  | "recording"
  | "preview"
  | "uploading"
  | "success";

interface Location {
  lat: number;
  lon: number;
  label: string;
}

export interface UploadResult {
  lat: number;
  lon: number;
}

interface Props {
  onClose: () => void;
  onSuccess: (result: UploadResult) => void;
}

const SOUND_TYPES = [
  { value: "birds", label: "Birds", icon: "🐦" },
  { value: "insects", label: "Insects", icon: "🦋" },
  { value: "rain", label: "Rain / Wind", icon: "🌧️" },
  { value: "traffic", label: "Traffic", icon: "🚗" },
  { value: "music", label: "Music", icon: "🎵" },
  { value: "construction", label: "Construction", icon: "🏗️" },
  { value: "silence", label: "Silence", icon: "🌫️" },
];

// ─── Palette ─────────────────────────────────────────────────────────────────

const C = {
  bg: "#030303",
  surface: "rgba(255,255,255,0.035)",
  surfaceHover: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.07)",
  borderFaint: "rgba(255,255,255,0.04)",
  text: "#e2e8f0",
  textMid: "rgba(255,255,255,0.50)",
  textMuted: "rgba(255,255,255,0.25)",
  accent: "#22c55e",
  accentDim: "rgba(34,197,94,0.12)",
  accentBorder: "rgba(34,197,94,0.30)",
  rec: "#f43f5e",
  recDim: "rgba(244,63,94,0.10)",
  recBorder: "rgba(244,63,94,0.30)",
  recGlow: "rgba(244,63,94,0.25)",
  warn: "#f97316",
  inputBg: "rgba(255,255,255,0.04)",
};

const inputStyle: React.CSSProperties = {
  background: C.inputBg,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: C.text,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function RecordUploadPanelDark({ onClose, onSuccess }: Props) {
  const { data: session } = authClient.useSession();
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const createUpload = useMutation(api.uploads.create);

  // ── Core state ──
  const [mode, setMode] = useState<Mode>("record");
  const [step, setStep] = useState<Step>("ready");
  const [error, setError] = useState("");

  // ── Location ──
  const [location, setLocation] = useState<Location | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [suggestions, setSuggestions] = useState<
    { lat: number; lon: number; display_name: string }[]
  >([]);
  const [showSug, setShowSug] = useState(false);

  // ── Recording ──
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // ── File upload ──
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDuration, setFileDuration] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Meta form ──
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dominantClass, setDominantClass] = useState("");
  const [tagging, setTagging] = useState(false);

  // ── Visual preview state ──
  type YAMNetResult = {
    dominantClass: string;
    yamnetLabel: string;
    confidence: number;
    topLabels: { label: string; score: number }[];
  };
  const [yamnetResult, setYamnetResult] = useState<YAMNetResult | null>(null);
  const [previewGifUrl, setPreviewGifUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewGifBlob, setPreviewGifBlob] = useState<Blob | null>(null);
  const [previewVideoBlob, setPreviewVideoBlob] = useState<Blob | null>(null);
  const [gifGenerating, setGifGenerating] = useState(false);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const gifAbortRef = useRef<AbortController | null>(null);
  const videoAbortRef = useRef<AbortController | null>(null);

  // ── Recording internals ──
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Orb volume analysis (drives the orb with actual mic levels) ──
  const orbVolumeRef = useRef(0);
  const orbAnalyserRef = useRef<AnalyserNode | null>(null);
  const orbAudioCtxRef = useRef<AudioContext | null>(null);
  const volumeRafRef = useRef<number>(0);

  // ── Audio player (preview) ──
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playerTime, setPlayerTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const scrubbingRef = useRef(false);
  // Stores the final recorded duration so the audio player can fall back to it
  // when MediaRecorder WebM blobs report Infinity for audio.duration.
  const knownDurationRef = useRef(0);

  // ── Waveform data extracted from audio blob ──
  const [waveformData, setWaveformData] = useState<number[]>([]);

  // ── Cleanup on unmount ──
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      cancelAnimationFrame(volumeRafRef.current);
      if (
        orbAudioCtxRef.current &&
        orbAudioCtxRef.current.state !== "closed"
      ) {
        orbAudioCtxRef.current.close();
      }
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.src = "";
      }
      gifAbortRef.current?.abort();
      videoAbortRef.current?.abort();
      if (previewGifUrl) URL.revokeObjectURL(previewGifUrl);
      if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Extract waveform data from recorded blob ──
  useEffect(() => {
    if (!audioBlob) {
      setWaveformData([]);
      return;
    }
    const ctx = new AudioContext();
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = await ctx.decodeAudioData(reader.result as ArrayBuffer);
        const raw = buffer.getChannelData(0);
        const bars = 200;
        const block = Math.floor(raw.length / bars);
        const out: number[] = [];
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < block; j++) sum += Math.abs(raw[i * block + j]);
          out.push(sum / block);
        }
        const peak = Math.max(...out, 0.001);
        setWaveformData(out.map((v) => v / peak));
      } catch {
        setWaveformData([]);
      }
      ctx.close();
    };
    reader.readAsArrayBuffer(audioBlob);
  }, [audioBlob]);

  // ── Audio player setup for preview ──
  useEffect(() => {
    if (!audioUrl) {
      setPlaying(false);
      setPlayerTime(0);
      setPlayerDuration(0);
      return;
    }
    const audio = new Audio(audioUrl);
    playerRef.current = audio;

    const onMeta = () => {
      const d = audio.duration;
      // MediaRecorder WebM blobs often report Infinity — fall back to the
      // recorded duration captured in knownDurationRef when that happens.
      setPlayerDuration(Number.isFinite(d) && d > 0 ? d : knownDurationRef.current);
    };
    const onTime = () => {
      if (!scrubbingRef.current) setPlayerTime(audio.currentTime);
    };
    const onEnd = () => {
      setPlaying(false);
      setPlayerTime(0);
    };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.src = "";
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleScrub = (time: number) => {
    if (!playerRef.current) return;
    playerRef.current.currentTime = time;
    setPlayerTime(time);
  };

  // ── Geolocation ──
  const [locating, setLocating] = useState(false);

  const fetchLocation = useCallback(async () => {
    setLocating(true);
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation not supported.");
      setLocating(false);
      return;
    }
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 12000,
        }),
      );
      const { latitude: lat, longitude: lon } = pos.coords;
      let label = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      try {
        const r = await fetch(
          `/api/geocode/reverse?lat=${lat}&lon=${lon}`,
        );
        if (r.ok) {
          const d = await r.json();
          if (d.label) label = d.label;
        }
      } catch {
        /* keep coords */
      }
      setLocation({ lat, lon, label });
    } catch (e: unknown) {
      const ge = e as GeolocationPositionError;
      setError(
        ge?.code === 1
          ? "Location permission denied."
          : "Unable to get location.",
      );
    } finally {
      setLocating(false);
    }
  }, []);

  // Auto-fetch GPS + pre-warm mic permission on mount
  useEffect(() => {
    fetchLocation();
    // Pre-request mic permission so the first record click doesn't flash
    navigator.mediaDevices?.getUserMedia({ audio: true }).then((s) => {
      s.getTracks().forEach((t) => t.stop());
    }).catch(() => {});
  }, [fetchLocation]);

  // ── Location search ──

  const searchLocation = useCallback(async () => {
    if (!customQuery.trim()) return;
    try {
      const r = await fetch(
        `/api/geocode?q=${encodeURIComponent(customQuery)}`,
      );
      const d = await r.json();
      setSuggestions(d.results ?? []);
      setShowSug(true);
    } catch {
      setSuggestions([]);
    }
  }, [customQuery]);

  const pickSuggestion = (s: {
    lat: number;
    lon: number;
    display_name: string;
  }) => {
    setLocation({
      lat: s.lat,
      lon: s.lon,
      label: s.display_name.split(",").slice(0, 2).join(", "),
    });
    setCustomQuery(s.display_name.split(",").slice(0, 2).join(", "));
    setShowSug(false);
  };

  // ── Recording ──

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime =
        [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg",
          "audio/mp4",
        ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

      const mr = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      mrRef.current = mr;
      chunks.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, {
          type: mime || "audio/webm",
        });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        setStep("preview");
        autoTag(blob);
      };

      // ── Set up AnalyserNode for Orb volume ──
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      orbAudioCtxRef.current = audioCtx;
      orbAnalyserRef.current = analyser;

      const readVolume = () => {
        const a = orbAnalyserRef.current;
        if (!a) return;
        const data = new Uint8Array(a.frequencyBinCount);
        a.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        orbVolumeRef.current = Math.min(
          1,
          (sum / data.length / 255) * 2.8,
        );
        volumeRafRef.current = requestAnimationFrame(readVolume);
      };
      readVolume();

      mr.start(100);
      setStep("recording");
      setRecordingTime(0);
      timerRef.current = setInterval(
        () => setRecordingTime((t) => t + 1),
        1000,
      );
    } catch {
      setError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    knownDurationRef.current = recordingTime;
    mrRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    // Clean up Orb analyser
    cancelAnimationFrame(volumeRafRef.current);
    orbAnalyserRef.current = null;
    if (
      orbAudioCtxRef.current &&
      orbAudioCtxRef.current.state !== "closed"
    ) {
      orbAudioCtxRef.current.close();
    }
    orbAudioCtxRef.current = null;
    orbVolumeRef.current = 0;
  };

  const discardRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setPlaying(false);
    setPlayerTime(0);
    setPlayerDuration(0);
    setWaveformData([]);
    setRecordingTime(0);
    // Clean up preview state
    gifAbortRef.current?.abort();
    videoAbortRef.current?.abort();
    if (previewGifUrl) URL.revokeObjectURL(previewGifUrl);
    if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
    setPreviewGifUrl(null);
    setPreviewVideoUrl(null);
    setPreviewGifBlob(null);
    setPreviewVideoBlob(null);
    setGifGenerating(false);
    setVideoGenerating(false);
    setYamnetResult(null);
    setTitle("");
    setDescription("");
    setStep("ready");
  };

  // ── Preview generation helpers ──

  const generatePreviewGif = useCallback(async (result: YAMNetResult) => {
    gifAbortRef.current?.abort();
    const controller = new AbortController();
    gifAbortRef.current = controller;
    setGifGenerating(true);
    if (previewGifUrl) URL.revokeObjectURL(previewGifUrl);
    setPreviewGifUrl(null);
    setPreviewGifBlob(null);
    try {
      const res = await fetch("/api/soundsoil/preview-gif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yamnetResult: result }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("GIF generation failed");
      const blob = await res.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      setPreviewGifBlob(blob);
      setPreviewGifUrl(url);
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error("GIF preview error:", e);
    } finally {
      if (!controller.signal.aborted) setGifGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generatePreviewVideo = useCallback(async (result: YAMNetResult) => {
    videoAbortRef.current?.abort();
    const controller = new AbortController();
    videoAbortRef.current = controller;
    setVideoGenerating(true);
    if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
    setPreviewVideoUrl(null);
    setPreviewVideoBlob(null);
    try {
      const res = await fetch("/api/soundsoil/preview-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yamnetResult: result }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Video generation failed");
      const blob = await res.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      setPreviewVideoBlob(blob);
      setPreviewVideoUrl(url);
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error("Video preview error:", e);
    } finally {
      if (!controller.signal.aborted) setVideoGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redoGif = useCallback(() => {
    if (yamnetResult) generatePreviewGif(yamnetResult);
  }, [yamnetResult, generatePreviewGif]);

  const redoVideo = useCallback(() => {
    if (yamnetResult) generatePreviewVideo(yamnetResult);
  }, [yamnetResult, generatePreviewVideo]);

  // ── Auto-tag via YAMNet ──

  const autoTag = useCallback(async (blob: Blob) => {
    setTagging(true);
    try {
      const wavBlob = await audioFileToWav(new File([blob], "audio.webm", { type: blob.type }));
      const fd = new FormData();
      fd.append("audio", wavBlob, "audio.wav");
      const res = await fetch("/api/yamnet-tag", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.dominantClass) setDominantClass(data.dominantClass);
        // Always set AI-generated title/description (overwrite any previous value)
        setTitle(data.suggestedTitle || "");
        setDescription(data.suggestedDescription || "");

        // Store result and kick off visual previews in parallel
        const result: YAMNetResult = {
          dominantClass: data.dominantClass,
          yamnetLabel: data.yamnetLabel,
          confidence: data.confidence,
          topLabels: data.topLabels,
        };
        setYamnetResult(result);
        generatePreviewGif(result);
        generatePreviewVideo(result);
      }
    } catch {
      // Auto-tag failed silently — user can still pick manually
    } finally {
      setTagging(false);
    }
  }, [generatePreviewGif, generatePreviewVideo]);

  // ── Submit ──

  const handleSubmit = async () => {
    if (!session?.user) {
      setError("Please sign in to upload.");
      return;
    }
    const file = mode === "record" ? audioBlob : selectedFile;
    if (!file) {
      setError("No audio selected.");
      return;
    }
    setStep("uploading");
    setError("");
    try {
      // Upload audio file
      const uploadUrl = await generateUploadUrl();
      const r = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": (file.type || "audio/webm").split(";")[0] },
        body: file,
      });
      if (!r.ok) throw new Error(`Upload failed (${r.status})`);
      const { storageId } = await r.json();

      // Upload GIF preview if available
      let gifStorageId: string | undefined;
      if (previewGifBlob) {
        const gifUrl = await generateUploadUrl();
        const gifRes = await fetch(gifUrl, {
          method: "POST",
          headers: { "Content-Type": "image/gif" },
          body: previewGifBlob,
        });
        if (gifRes.ok) {
          const gifData = await gifRes.json();
          gifStorageId = gifData.storageId;
        }
      }

      // Upload video preview if available
      let videoStorageId: string | undefined;
      if (previewVideoBlob) {
        const videoUrl = await generateUploadUrl();
        const videoRes = await fetch(videoUrl, {
          method: "POST",
          headers: { "Content-Type": "video/mp4" },
          body: previewVideoBlob,
        });
        if (videoRes.ok) {
          const videoData = await videoRes.json();
          videoStorageId = videoData.storageId;
        }
      }

      await createUpload({
        userId: session.user.id,
        storageId,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        durationSeconds: mode === "record" ? recordingTime : (mode === "file" && fileDuration > 0 ? fileDuration : undefined),
        lat: location?.lat,
        lon: location?.lon,
        locationLabel: location?.label || undefined,
        dominantClass,
        tags: [dominantClass],
        gifStorageId: gifStorageId as Parameters<typeof createUpload>[0]["gifStorageId"],
        videoStorageId: videoStorageId as Parameters<typeof createUpload>[0]["videoStorageId"],
        gifStatus: gifStorageId ? "done" : "pending",
        videoStatus: videoStorageId ? "done" : "pending",
        yamnetLabels: yamnetResult?.topLabels,
      });

      setStep("success");
      if (location)
        onSuccess({ lat: location.lat, lon: location.lon });
      setTimeout(onClose, 2200);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "Upload failed.");
      setStep("preview");
    }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const canSubmit =
    (mode === "record" && !!audioBlob) ||
    (mode === "file" && !!selectedFile);

  const resetMode = (m: Mode) => {
    setMode(m);
    setStep("ready");
    setError("");
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setSelectedFile(null);
    setPlaying(false);
    setPlayerTime(0);
    setPlayerDuration(0);
    setWaveformData([]);
    // Clean up preview state
    gifAbortRef.current?.abort();
    videoAbortRef.current?.abort();
    if (previewGifUrl) URL.revokeObjectURL(previewGifUrl);
    if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
    setPreviewGifUrl(null);
    setPreviewVideoUrl(null);
    setPreviewGifBlob(null);
    setPreviewVideoBlob(null);
    setGifGenerating(false);
    setVideoGenerating(false);
    setYamnetResult(null);
    setTitle("");
    setDescription("");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "stretch",
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
          background: "rgba(0,0,0,0.60)",
          backdropFilter: "blur(4px)",
          pointerEvents: "all",
          animation: "panelFadeIn .2s ease-out",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          pointerEvents: "all",
          width: "min(380px, 100vw)",
          height: "100%",
          background: `linear-gradient(180deg, #060606 0%, ${C.bg} 100%)`,
          borderLeft: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          fontFamily:
            "'SF Pro Text', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          animation: "panelSlideIn .25s cubic-bezier(.16,1,.3,1)",
          overflow: "hidden",
        }}
      >
        {/* ── Top accent line ── */}
        <div
          style={{
            height: 1,
            width: "100%",
            background:
              step === "recording"
                ? `linear-gradient(90deg, transparent 10%, ${C.recGlow}, transparent 90%)`
                : `linear-gradient(90deg, transparent 10%, ${C.accentBorder}, transparent 90%)`,
            transition: "background 0.6s ease",
            flexShrink: 0,
          }}
        />

        {/* ── Header ── */}
        <div
          style={{
            padding: "18px 20px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: C.text,
                letterSpacing: "-0.01em",
              }}
            >
              Add a Sound
            </div>
            <div
              style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}
            >
              {step === "recording"
                ? "Listening…"
                : step === "preview"
                  ? "Review your recording"
                  : "Record live or upload a file"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "50%",
              width: 28,
              height: 28,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.textMid,
              fontSize: 14,
              transition: "background .15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = C.surfaceHover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = C.surface)
            }
          >
            ×
          </button>
        </div>

        {/* ── Mode tabs (hidden while recording/preview/uploading/success) ── */}
        {step !== "recording" &&
          step !== "preview" &&
          step !== "uploading" &&
          step !== "success" && (
            <div
              style={{
                display: "flex",
                padding: "0 20px 12px",
                gap: 6,
                flexShrink: 0,
              }}
            >
              {(["record", "file"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => resetMode(m)}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    borderRadius: 8,
                    border: `1px solid ${mode === m ? C.accentBorder : C.border}`,
                    background:
                      mode === m ? C.accentDim : C.surface,
                    color: mode === m ? C.accent : C.textMid,
                    fontWeight: mode === m ? 600 : 400,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    transition: "all .15s",
                    letterSpacing: "0.01em",
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {m === "record" ? "●" : "◧"}
                  </span>
                  <span>
                    {m === "record" ? "Live Record" : "Upload"}
                  </span>
                </button>
              ))}
            </div>
          )}

        {/* ── Divider ── */}
        <div
          style={{
            height: 1,
            background: C.borderFaint,
            flexShrink: 0,
          }}
        />

        {/* ── Body ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px 80px",
            ...(step === "uploading" ? { display: "flex", alignItems: "center", justifyContent: "center" } : {}),
          }}
        >
          {/* ── Uploading (centered in body) ── */}
          {step === "uploading" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                color: C.accent,
                fontSize: 14,
                fontWeight: 600,
                animation: "stepFadeIn .25s ease-out",
              }}
            >
              <Spinner />
              Uploading…
            </div>
          )}

          {/* ═══════ RECORD MODE ═══════ */}
          {mode === "record" && step !== "uploading" && (
            <>
              {/* ── Ready ── */}
              {step === "ready" && (
                <div key="ready" style={{ textAlign: "center", padding: "20px 0", animation: "stepFadeIn .25s ease-out" }}>
                  {/* Location status */}
                  {locating ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: C.textMuted, fontSize: 12, marginBottom: 16 }}>
                      <Spinner /> Getting location...
                    </div>
                  ) : location ? (
                    <LocationBadge
                      location={location}
                      onRefresh={fetchLocation}
                    />
                  ) : null}

                  {/* Dormant Orb */}
                  <div
                    style={{
                      width: 140,
                      height: 140,
                      margin: "24px auto 20px",
                      position: "relative",
                    }}
                  >
                    <Orb
                      colors={[C.accent, "#6ee7b7"]}
                      agentState={null}
                      className="absolute inset-0"
                    />
                  </div>

                  <div
                    style={{
                      color: C.text,
                      fontWeight: 600,
                      fontSize: 14,
                      marginBottom: 4,
                    }}
                  >
                    Ready to capture
                  </div>
                  <div
                    style={{
                      color: C.textMuted,
                      fontSize: 12,
                      marginBottom: 28,
                    }}
                  >
                    Tap to start recording
                  </div>

                  {/* Record button — pill with pulsing dot */}
                  <button
                    onClick={startRecording}
                    style={{
                      background: C.recDim,
                      border: `1px solid ${C.recBorder}`,
                      borderRadius: 40,
                      padding: "12px 36px",
                      color: C.rec,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all .15s",
                      letterSpacing: "0.01em",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: C.rec,
                        animation:
                          "panelPulse 1.4s ease-in-out infinite",
                      }}
                    />
                    Start Recording
                  </button>
                </div>
              )}

              {/* ── Recording (immersive) ── */}
              {step === "recording" && (
                <div
                  key="recording"
                  style={{
                    textAlign: "center",
                    padding: "12px 0 0",
                    position: "relative",
                    animation: "stepFadeIn .25s ease-out",
                  }}
                >
                  {/* Location (compact) */}
                  {location && (
                    <div
                      style={{
                        fontSize: 11,
                        color: C.textMuted,
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill={C.accent}
                        stroke="none"
                      >
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
                      </svg>
                      {location.label}
                    </div>
                  )}

                  {/* Orb — volume reactive, the hero */}
                  <div
                    style={{
                      width: 180,
                      height: 180,
                      margin: "0 auto 16px",
                      position: "relative",
                    }}
                  >
                    <Orb
                      colors={["#f43f5e", "#fb923c"]}
                      agentState={null}
                      volumeMode="manual"
                      inputVolumeRef={orbVolumeRef}
                      getOutputVolume={() => 0.45}
                      className="absolute inset-0"
                    />
                    {/* Faint glow ring around orb */}
                    <div
                      style={{
                        position: "absolute",
                        inset: -8,
                        borderRadius: "50%",
                        border: `1px solid ${C.recGlow}`,
                        animation:
                          "panelPulse 2s ease-in-out infinite",
                        pointerEvents: "none",
                      }}
                    />
                  </div>

                  {/* Timer */}
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 300,
                      color: C.rec,
                      letterSpacing: 4,
                      fontVariantNumeric: "tabular-nums",
                      fontFamily:
                        "'SF Mono', 'Menlo', 'Consolas', monospace",
                      marginBottom: 4,
                    }}
                  >
                    {fmt(recordingTime)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textMuted,
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: C.rec,
                        animation:
                          "panelPulse 1s ease-in-out infinite",
                      }}
                    />
                    Recording
                  </div>

                  {/* Live scrolling waveform */}
                  <div
                    style={{
                      margin: "0 -20px",
                      padding: "0",
                    }}
                  >
                    <LiveWaveform
                      active
                      mode="scrolling"
                      height={56}
                      barWidth={2}
                      barGap={1}
                      barRadius={1}
                      barColor="rgba(244,63,94,0.7)"
                      sensitivity={1.8}
                      fadeEdges
                      fadeWidth={40}
                    />
                  </div>

                  {/* Stop button */}
                  <button
                    onClick={stopRecording}
                    style={{
                      marginTop: 24,
                      background: C.rec,
                      border: "none",
                      borderRadius: 12,
                      padding: "12px 40px",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      boxShadow: `0 4px 24px ${C.recGlow}`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all .15s",
                      letterSpacing: "0.01em",
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                    >
                      <rect
                        x="1"
                        y="1"
                        width="10"
                        height="10"
                        rx="2"
                      />
                    </svg>
                    Stop
                  </button>
                </div>
              )}

              {/* ── Preview ── */}
              {step === "preview" && audioUrl && (
                <div key="preview" style={{ animation: "stepFadeIn .25s ease-out" }}>
                  {/* Waveform + Player card */}
                  <div
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 14,
                      padding: "16px",
                      marginBottom: 16,
                    }}
                  >
                    {/* Header row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: C.text,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: C.accent,
                          }}
                        />
                        {fmt(recordingTime)} captured
                      </div>
                      <button
                        onClick={discardRecording}
                        style={{
                          background: C.recDim,
                          border: `1px solid ${C.recBorder}`,
                          borderRadius: 6,
                          padding: "3px 8px",
                          color: C.rec,
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all .15s",
                        }}
                      >
                        Discard
                      </button>
                    </div>

                    {/* Static waveform visualization */}
                    {waveformData.length > 0 && (
                      <div style={{ marginBottom: 12, margin: "0 -16px 12px", padding: "0 0" }}>
                        <Waveform
                          data={waveformData}
                          barColor={C.accent}
                          barWidth={3}
                          barGap={1}
                          barRadius={1}
                          height={56}
                          fadeEdges={false}
                        />
                      </div>
                    )}

                    {/* Player controls */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {/* Play / Pause button */}
                      <button
                        onClick={togglePlay}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: C.accent,
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "transform .1s",
                        }}
                        onMouseDown={(e) =>
                          (e.currentTarget.style.transform =
                            "scale(0.93)")
                        }
                        onMouseUp={(e) =>
                          (e.currentTarget.style.transform =
                            "scale(1)")
                        }
                      >
                        {playing ? (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="#000"
                          >
                            <rect
                              x="2"
                              y="1"
                              width="3"
                              height="10"
                              rx="0.5"
                            />
                            <rect
                              x="7"
                              y="1"
                              width="3"
                              height="10"
                              rx="0.5"
                            />
                          </svg>
                        ) : (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="#000"
                          >
                            <path d="M3 1.5v9l7.5-4.5L3 1.5z" />
                          </svg>
                        )}
                      </button>

                      {/* Scrub bar */}
                      <ScrubBarContainer
                        duration={playerDuration}
                        value={playerTime}
                        onScrub={handleScrub}
                        onScrubStart={() => {
                          scrubbingRef.current = true;
                        }}
                        onScrubEnd={() => {
                          scrubbingRef.current = false;
                        }}
                        className="flex-1 gap-2.5"
                      >
                        <ScrubBarTimeLabel
                          time={playerTime}
                          className="text-[10px] w-7 shrink-0"
                          style={{ color: C.textMid }}
                        />
                        <ScrubBarTrack className="h-1 rounded-full bg-white/[0.08]">
                          <ScrubBarProgress className="bg-transparent [&_[data-slot=progress-indicator]]:bg-emerald-500 rounded-full" />
                          <ScrubBarThumb className="h-3 w-3 bg-white shadow-md shadow-black/40" />
                        </ScrubBarTrack>
                        <ScrubBarTimeLabel
                          time={playerDuration}
                          className="text-[10px] w-7 shrink-0 text-right"
                          style={{ color: C.textMuted }}
                        />
                      </ScrubBarContainer>
                    </div>
                  </div>

                  {/* Editable location */}
                  <EditableLocation
                    location={location}
                    locating={locating}
                    onRefreshGps={fetchLocation}
                    onLocationChange={setLocation}
                    customQuery={customQuery}
                    setCustomQuery={setCustomQuery}
                    suggestions={suggestions}
                    showSug={showSug}
                    setShowSug={setShowSug}
                    searchLocation={searchLocation}
                    pickSuggestion={pickSuggestion}
                  />

                  {/* Meta form */}
                  <MetaForm
                    desc={description}
                    setDesc={setDescription}
                    dc={dominantClass}
                    tagging={tagging}
                  />

                  {/* Visual preview */}
                  {(gifGenerating || videoGenerating || previewGifUrl || previewVideoUrl) && (
                    <VisualPreview
                      gifUrl={previewGifUrl}
                      videoUrl={previewVideoUrl}
                      gifGenerating={gifGenerating}
                      videoGenerating={videoGenerating}
                      onRedoGif={redoGif}
                      onRedoVideo={redoVideo}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══════ FILE MODE ═══════ */}
          {mode === "file" && step !== "uploading" && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${selectedFile ? C.accentBorder : C.border}`,
                  borderRadius: 14,
                  padding: "24px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: selectedFile ? C.accentDim : C.surface,
                  marginBottom: 16,
                  transition: "all .15s",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setSelectedFile(f);

                    // Extract duration
                    const audio = new Audio(URL.createObjectURL(f));
                    audio.onloadedmetadata = () => {
                      setFileDuration(audio.duration);
                    };

                    autoTag(f);
                  }}
                />
                {selectedFile ? (
                  <>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        margin: "0 auto 8px",
                        borderRadius: "50%",
                        background: C.accentDim,
                        border: `1px solid ${C.accentBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={C.accent}
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.accent,
                      }}
                    >
                      {selectedFile.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.textMuted,
                        marginTop: 3,
                      }}
                    >
                      {(selectedFile.size / 1024).toFixed(0)} KB · Tap
                      to change
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        margin: "0 auto 8px",
                        borderRadius: "50%",
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={C.textMid}
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.text,
                      }}
                    >
                      Select audio file
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.textMuted,
                        marginTop: 3,
                      }}
                    >
                      MP3, WAV, WebM, OGG
                    </div>
                  </>
                )}
              </div>

              {/* Location — auto-detected, editable */}
              <EditableLocation
                location={location}
                locating={locating}
                onRefreshGps={fetchLocation}
                onLocationChange={setLocation}
                customQuery={customQuery}
                setCustomQuery={setCustomQuery}
                suggestions={suggestions}
                showSug={showSug}
                setShowSug={setShowSug}
                searchLocation={searchLocation}
                pickSuggestion={pickSuggestion}
              />

              {(selectedFile || location) && (
                <>
                  <MetaForm
                    title={title}
                    setTitle={setTitle}
                    desc={description}
                    setDesc={setDescription}
                    dc={dominantClass}
                    tagging={tagging}
                  />

                  {/* Visual preview */}
                  {(gifGenerating || videoGenerating || previewGifUrl || previewVideoUrl) && (
                    <VisualPreview
                      gifUrl={previewGifUrl}
                      videoUrl={previewVideoUrl}
                      gifGenerating={gifGenerating}
                      videoGenerating={videoGenerating}
                      onRedoGif={redoGif}
                      onRedoVideo={redoVideo}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* ── Success ── */}
          {step === "success" && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: "0 auto 16px",
                  borderRadius: "50%",
                  background: C.accentDim,
                  border: `1px solid ${C.accentBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "panelScaleIn .35s cubic-bezier(.16,1,.3,1)",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={C.accent}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                Uploaded
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                Your sound is now on the map
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div
              style={{
                background: C.recDim,
                border: `1px solid ${C.recBorder}`,
                borderRadius: 10,
                padding: "10px 12px",
                marginTop: 12,
                fontSize: 12,
                color: C.rec,
                display: "flex",
                alignItems: "center",
                gap: 8,
                lineHeight: 1.4,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {(step === "preview" ||
          (mode === "file" && selectedFile)) &&
          step !== "success" &&
          step !== "uploading" && (
            <div
              style={{
                padding: "14px 20px",
                borderTop: `1px solid ${C.borderFaint}`,
                flexShrink: 0,
              }}
            >
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  width: "100%",
                  background: canSubmit ? C.accent : C.surface,
                  color: canSubmit ? "#000" : C.textMuted,
                  border: canSubmit
                    ? "none"
                    : `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "12px",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "all .15s",
                  letterSpacing: "0.01em",
                }}
              >
                {session?.user ? "Submit to Map" : "Sign in to Submit"}
              </button>
            </div>
          )}


        {/* ── Animations ── */}
        <style>{`
          @keyframes panelSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
          @keyframes panelFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes stepFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes panelPulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.4; }
          }
          @keyframes panelScaleIn {
            from { transform: scale(0.5); opacity: 0; }
            to   { transform: scale(1);   opacity: 1; }
          }
          @keyframes panelSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LocationBadge({
  location,
  onRefresh,
  onDismiss,
  style: outerStyle,
}: {
  location: Location;
  onRefresh?: () => void;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.accentDim,
        border: `1px solid ${C.accentBorder}`,
        borderRadius: 10,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        ...outerStyle,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill={C.accent}
        stroke="none"
        style={{ flexShrink: 0 }}
      >
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.accent,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {location.label}
        </div>
        <div style={{ fontSize: 10, color: C.textMuted }}>
          {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
        </div>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            color: C.textMuted,
            padding: 2,
          }}
        >
          ↺
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            color: C.textMuted,
            padding: 2,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function EditableLocation({
  location,
  locating,
  onRefreshGps,
  onLocationChange,
  customQuery,
  setCustomQuery,
  suggestions,
  showSug,
  setShowSug,
  searchLocation,
  pickSuggestion,
}: {
  location: Location | null;
  locating: boolean;
  onRefreshGps: () => void;
  onLocationChange: (loc: Location) => void;
  customQuery: string;
  setCustomQuery: (v: string) => void;
  suggestions: { lat: number; lon: number; display_name: string }[];
  showSug: boolean;
  setShowSug: (v: boolean) => void;
  searchLocation: () => void;
  pickSuggestion: (s: { lat: number; lon: number; display_name: string }) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.textMid,
          letterSpacing: 0.6,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        Location
      </div>

      {/* Current location display */}
      {locating ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMuted, fontSize: 12, marginBottom: 8 }}>
          <Spinner /> Getting location...
        </div>
      ) : location ? (
        <LocationBadge
          location={location}
          onRefresh={onRefreshGps}
          style={{ marginBottom: 8 }}
        />
      ) : null}

      {/* Lat/Lon inputs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={location?.lat ?? ""}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat)) {
                onLocationChange({
                  lat,
                  lon: location?.lon ?? 0,
                  label: `${lat.toFixed(5)}, ${(location?.lon ?? 0).toFixed(5)}`,
                });
              }
            }}
            style={{ ...inputStyle, padding: "7px 10px", fontSize: 12 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={location?.lon ?? ""}
            onChange={(e) => {
              const lon = parseFloat(e.target.value);
              if (!isNaN(lon)) {
                onLocationChange({
                  lat: location?.lat ?? 0,
                  lon,
                  label: `${(location?.lat ?? 0).toFixed(5)}, ${lon.toFixed(5)}`,
                });
              }
            }}
            style={{ ...inputStyle, padding: "7px 10px", fontSize: 12 }}
          />
        </div>
      </div>

      {/* Place search */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            type="text"
            placeholder="Search a place..."
            value={customQuery}
            onChange={(e) => {
              setCustomQuery(e.target.value);
              setShowSug(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") searchLocation();
            }}
            style={{ ...inputStyle, padding: "7px 10px", fontSize: 12 }}
          />
          <button
            onClick={searchLocation}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "0 10px",
              fontSize: 13,
              cursor: "pointer",
              color: C.textMid,
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
        {showSug && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "rgba(8,8,8,0.98)",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              zIndex: 100,
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {suggestions.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 12, color: C.textMuted }}>
                No results found
              </div>
            ) : (
              suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => pickSuggestion(s)}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    borderBottom: i < suggestions.length - 1 ? `1px solid ${C.borderFaint}` : "none",
                    padding: "9px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 12,
                    color: C.textMid,
                    lineHeight: 1.4,
                  }}
                >
                  {s.display_name.split(",").slice(0, 3).join(", ")}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaForm({
  desc,
  setDesc,
  title,
  setTitle,
  dc,
  tagging,
}: {
  title?: string;
  setTitle?: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  dc: string;
  tagging?: boolean;
}) {
  const matchedType = SOUND_TYPES.find((t) => t.value === dc);
  return (
    <div>
      {/* Sound type — shown first, non-editable, detected by AI */}
      <div style={{ marginBottom: 14 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.textMid,
            letterSpacing: 0.6,
            display: "block",
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          Sound type{tagging && <span style={{ fontWeight: 400, opacity: 0.6, textTransform: "none", marginLeft: 6 }}>detecting...</span>}
        </label>
        {tagging ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMuted, fontSize: 12 }}>
            <Spinner /> Classifying audio...
          </div>
        ) : matchedType ? (
          <div
            style={{
              background: C.accentDim,
              border: `1px solid ${C.accentBorder}`,
              borderRadius: 20,
              padding: "6px 12px",
              fontSize: 12,
              color: C.accent,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              animation: "stepFadeIn .25s ease-out",
            }}
          >
            <span>{matchedType.icon}</span>
            <span>{matchedType.label}</span>
          </div>
        ) : null}
      </div>

      {/* Title — editable, AI-suggested */}
      <div style={{ marginBottom: 14, animation: title ? "stepFadeIn .25s ease-out" : undefined }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.textMid,
            letterSpacing: 0.6,
            display: "block",
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          Title
        </label>
        <input
          type="text"
          placeholder="Generating title..."
          value={title}
          onChange={(e) => setTitle?.(e.target.value)}
          disabled={tagging}
          maxLength={120}
          style={{ ...inputStyle, opacity: tagging ? 0.5 : 1, cursor: tagging ? "not-allowed" : undefined }}
        />
      </div>

      {/* Description — editable, AI-suggested */}
      <div style={{ marginBottom: 14, animation: desc ? "stepFadeIn .25s ease-out" : undefined }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.textMid,
            letterSpacing: 0.6,
            display: "block",
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          Description
        </label>
        <textarea
          placeholder="Generating description..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          disabled={tagging}
          rows={2}
          maxLength={400}
          style={{ ...inputStyle, resize: "none" as const, opacity: tagging ? 0.5 : 1, cursor: tagging ? "not-allowed" : undefined }}
        />
      </div>
    </div>
  );
}

function VisualPreview({
  gifUrl,
  videoUrl,
  gifGenerating,
  videoGenerating,
  onRedoGif,
  onRedoVideo,
}: {
  gifUrl: string | null;
  videoUrl: string | null;
  gifGenerating: boolean;
  videoGenerating: boolean;
  onRedoGif: () => void;
  onRedoVideo: () => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.textMid,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Visual Preview
      </div>

      {/* GIF card */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 12,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: gifUrl ? 8 : 0,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
            {gifGenerating && <Spinner />}
            <span>{gifGenerating ? "Generating GIF..." : gifUrl ? "Pixel Art GIF" : "GIF"}</span>
          </div>
          {gifUrl && (
            <button
              onClick={onRedoGif}
              disabled={gifGenerating}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "3px 8px",
                color: C.textMid,
                fontSize: 11,
                fontWeight: 500,
                cursor: gifGenerating ? "not-allowed" : "pointer",
                opacity: gifGenerating ? 0.5 : 1,
                transition: "all .15s",
              }}
            >
              Redo
            </button>
          )}
        </div>
        {gifUrl && (
          <img
            src={gifUrl}
            alt="Pixel art preview"
            style={{
              width: "100%",
              maxHeight: 160,
              objectFit: "cover",
              borderRadius: 8,
              imageRendering: "pixelated",
              display: "block",
            }}
          />
        )}
      </div>

      {/* Video card */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: videoUrl ? 8 : 0,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
            {videoGenerating && <Spinner />}
            <span>{videoGenerating ? "Generating video..." : videoUrl ? "Veo Video" : "Video"}</span>
          </div>
          {videoUrl && (
            <button
              onClick={onRedoVideo}
              disabled={videoGenerating}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "3px 8px",
                color: C.textMid,
                fontSize: 11,
                fontWeight: 500,
                cursor: videoGenerating ? "not-allowed" : "pointer",
                opacity: videoGenerating ? 0.5 : 1,
                transition: "all .15s",
              }}
            >
              Redo
            </button>
          )}
        </div>
        {videoUrl && (
          <video
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: "100%",
              maxHeight: 160,
              objectFit: "cover",
              borderRadius: 8,
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        border: `2px solid ${C.accentDim}`,
        borderTopColor: C.accent,
        borderRadius: "50%",
        animation: "panelSpin .7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}
