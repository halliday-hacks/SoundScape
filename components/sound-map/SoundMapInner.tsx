"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Map as MapLibre,
  MapControls,
  MapClusterLayer,
  type MapRef,
} from "@/components/ui/map";
import { useQuery, useMutation } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import RecordUploadPanelDark, {
  type UploadResult,
} from "./RecordUploadPanelDark";
import { useElasticMapSearch, useElasticFilterSearch, useElasticNearbySearch, VALID_SOUND_TYPES, formatAgo, formatDuration, parseDuration } from "@/hooks/use-elastic-search";
import {
  ScrubBarContainer,
  ScrubBarTrack,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTimeLabel,
} from "@/components/ui/scrub-bar";

// ─── Types ─────────────────────────────────────────────────────────────────────
type SoundType =
  | "birds"
  | "traffic"
  | "music"
  | "rain"
  | "construction"
  | "insects"
  | "silence";

interface Pin {
  id: string | number;
  lat: number;
  lng: number;
  type: SoundType;
  label: string;
  species: string | null;
  intensity: number;
  db: number;
  time: string;
  ago: string;
  likes: number;
  listens: number;
  user: string;
  duration: string;
  location: string;
  // Set for pins loaded from Convex — enables real audio playback
  storageId?: string;
  // Visual art fields
  gifStorageId?: string;
  videoStorageId?: string;
  gifStatus?: string;
  videoStatus?: string;
  uploadId?: string;
  userId?: string;
}


// ─── Config ────────────────────────────────────────────────────────────────────
const CFG: Record<SoundType, { color: string; label: string; icon: string }> = {
  birds: { color: "#22c55e", label: "Birds", icon: "🐦" },
  traffic: { color: "#64748b", label: "Traffic", icon: "🚗" },
  music: { color: "#a855f7", label: "Music", icon: "🎵" },
  rain: { color: "#3b82f6", label: "Rain", icon: "🌧️" },
  construction: { color: "#f97316", label: "Construction", icon: "🏗️" },
  insects: { color: "#84cc16", label: "Insects", icon: "🦋" },
  silence: { color: "#94a3b8", label: "Silence", icon: "🌫️" },
};


// ─── Convex / Elastic are the only pin sources ─────────────────────────────

// ─── Convex helpers ────────────────────────────────────────────────────────────

type ConvexUpload = {
  _id: string;
  _creationTime: number;
  userId: string;
  storageId: string;
  title: string;
  lat?: number;
  lon?: number;
  locationLabel?: string;
  dominantClass?: string;
  likeCount: number;
  listenCount: number;
  durationSeconds?: number;
  gifStorageId?: string;
  videoStorageId?: string;
  gifStatus?: string;
  videoStatus?: string;
};

function mapConvexUpload(u: ConvexUpload, idx: number): Pin {
  const type = (
    u.dominantClass && VALID_SOUND_TYPES.has(u.dominantClass)
      ? u.dominantClass
      : "silence"
  ) as SoundType;
  const d = new Date(u._creationTime);
  return {
    id: `cx-${idx}-${u._id}`,
    lat: u.lat ?? 0,
    lng: u.lon ?? 0,
    type,
    label: u.title,
    species: null,
    intensity: 0.5,
    db: 50,
    time: d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
    ago: formatAgo(u._creationTime),
    likes: u.likeCount,
    listens: u.listenCount,
    user: "Member",
    duration: u.durationSeconds ? formatDuration(u.durationSeconds) : "?:??",
    location: u.locationLabel ?? "Unknown location",
    storageId: u.storageId,
    gifStorageId: u.gifStorageId,
    videoStorageId: u.videoStorageId,
    gifStatus: u.gifStatus,
    videoStatus: u.videoStatus,
    uploadId: u._id,
    userId: u.userId,
  };
}

// Categories supported by the Elastic filter API (subset of UI sound types)
const ELASTIC_CATEGORIES = new Set(["birds", "traffic", "insects", "wind", "construction", "silence"]);

// ─── Search ───────────────────────────────────────────────────────────────────
function searchPins(pins: Pin[], query: string): Pin[] {
  const q = query.toLowerCase().trim();
  if (!q) return pins;
  const words = q.split(/\s+/);
  return pins
    .map((p) => {
      const hay = [
        p.label,
        p.location,
        p.type,
        CFG[p.type].label,
        p.species ?? "",
        p.user,
      ]
        .join(" ")
        .toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      const ll = p.label.toLowerCase(),
        loc = p.location.toLowerCase();
      const score =
        ll === q
          ? 100
          : ll.startsWith(q)
            ? 80
            : loc.startsWith(q)
              ? 70
              : loc.includes(q)
                ? 55
                : ll.includes(q)
                  ? 50
                  : 30;
      return { pin: p, score };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.score - a.score)
    .map((x: any) => x.pin);
}


// ─── Waveform ─────────────────────────────────────────────────────────────────
// When `amplitudes` is provided (0–1 per bar), bars respond to live audio levels.
// Without it, falls back to the decorative CSS animation.
function Waveform({ color, amplitudes }: { color: string; amplitudes?: number[] }) {
  const staticBars = [
    18, 42, 28, 58, 34, 66, 48, 30, 72, 44, 24, 60, 38, 52, 22, 64, 32, 50, 26, 62,
  ];
  const isLive = amplitudes != null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 40 }}>
      {staticBars.map((h, i) => {
        const amp = amplitudes?.[i] ?? 0;
        const liveH = isLive ? Math.max(5, amp * 100) : h;
        return (
          <div
            key={i}
            style={{
              width: 3,
              background: color,
              borderRadius: 3,
              height: `${liveH}%`,
              opacity: isLive ? 0.35 + amp * 0.65 : 0.8,
              transition: isLive ? "height 0.06s ease-out, opacity 0.06s ease-out" : "none",
              animationName: isLive ? "none" : `wv${i % 3}`,
              animationDuration: isLive ? "0s" : `${0.85 + (i % 5) * 0.12}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              animationDirection: "alternate",
              animationDelay: isLive ? "0s" : `${i * 0.05}s`,
            }}
          />
        );
      })}
    </div>
  );
}


// ─── Main ─────────────────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

export default function SoundMapInner() {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<Pin | null>(null);
  const [filter, setFilter] = useState<"all" | SoundType>("all");
  const [playing, setPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const [elasticFilters, setElasticFilters] = useState<{ category?: string; location?: string } | null>(null);
  const [nearMeLocation, setNearMeLocation] = useState<{ lat: number; lon: number; radius?: string } | null>(null);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  // Locally track deleted upload IDs so stale Elastic results are hidden immediately
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());

  const mapRef = useRef<MapRef | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const setMapRef = useCallback((node: MapRef | null) => {
    mapRef.current = node;
    setIsMapReady(!!node);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Deep-link: open a specific pin from ?upload=<uploadId> ──
  const searchParams = useSearchParams();
  const deepLinkUploadId = searchParams.get("upload");
  const deepLinkHandled = useRef(false);

  // ── Auth session ──
  const { data: session } = authClient.useSession();

  // ── Convex mutations ──
  const likeMutation = useMutation(api.uploads.like);
  const incrementListenMutation = useMutation(api.uploads.incrementListenCount);
  const deleteUploadMutation = useMutation(api.uploads.deleteUpload);

  // ── Load real uploads from Convex ──
  const convexUploads = useQuery(api.uploads.getRecent, { limit: 200 });

  // ── Elastic search with auto-refresh ──
  const {
    data: elasticData,
    isLoading: isRefreshing,
    lastRefresh,
    forceRefresh,
  } = useElasticMapSearch(mapBounds, {
    autoRefresh: true,
    refreshInterval: 30_000,
    limit: 200,
  });

  // ── Elastic filter search (fires when searchQuery or category filter changes) ──
  const { data: elasticFilterData } = useElasticFilterSearch(elasticFilters, {
    autoRefresh: false,
    limit: 100,
  });

  // ── Elastic nearby search (fires when "near me" is activated) ──
  const { data: elasticNearbyData } = useElasticNearbySearch(nearMeLocation, {
    autoRefresh: false,
    limit: 50,
  });

  // Convert Elastic hits to Pin format
  const elasticPins = useMemo<Pin[]>(() => {
    const hits = elasticData?.hits ?? [];
    return hits.map((hit: any, idx: number) => ({
      id: `elastic-${idx}-${hit.upload_id}`,
      lat: hit.geo?.lat ?? 0,
      lng: hit.geo?.lon ?? 0,
      type: (hit.dominant_class && VALID_SOUND_TYPES.has(hit.dominant_class)
        ? hit.dominant_class
        : "silence") as SoundType,
      label: hit.title,
      species: null,
      intensity: 0.5,
      db: 50,
      time: new Date(hit.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      ago: formatAgo(hit.timestamp),
      likes: hit.likes,
      listens: hit.listen_count,
      user: "Member",
      duration: hit.duration_seconds ? formatDuration(hit.duration_seconds) : "?:??",
      location: hit.location_name ?? "Unknown location",
      uploadId: hit.upload_id,
      userId: hit.user_id,
    }));
  }, [elasticData]);

  // Convert Elastic filter results to Pin format
  const elasticFilterPins = useMemo<Pin[]>(() => {
    const hits = (elasticFilterData?.hits ?? []).filter((h: any) => h.geo);
    return hits.map((hit: any, idx: number) => ({
      id: `ef-${idx}-${hit.upload_id}`,
      lat: hit.geo.lat,
      lng: hit.geo.lon,
      type: (hit.dominant_class && VALID_SOUND_TYPES.has(hit.dominant_class)
        ? hit.dominant_class
        : "silence") as SoundType,
      label: hit.title,
      species: null,
      intensity: 0.5,
      db: 50,
      time: new Date(hit.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      ago: formatAgo(hit.timestamp),
      likes: hit.likes,
      listens: hit.listen_count,
      user: "Member",
      duration: hit.duration_seconds ? formatDuration(hit.duration_seconds) : "?:??",
      location: hit.location_name ?? "Unknown location",
      uploadId: hit.upload_id,
      userId: hit.user_id,
    }));
  }, [elasticFilterData]);

  // Convert Elastic nearby results to Pin format
  const elasticNearbyPins = useMemo<Pin[]>(() => {
    const hits = (elasticNearbyData?.hits ?? []).filter((h: any) => h.geo);
    return hits.map((hit: any, idx: number) => ({
      id: `en-${idx}-${hit.upload_id}`,
      lat: hit.geo.lat,
      lng: hit.geo.lon,
      type: (hit.dominant_class && VALID_SOUND_TYPES.has(hit.dominant_class)
        ? hit.dominant_class
        : "silence") as SoundType,
      label: hit.title,
      species: null,
      intensity: 0.5,
      db: 50,
      time: new Date(hit.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      ago: formatAgo(hit.timestamp),
      likes: hit.likes,
      listens: hit.listen_count,
      user: "Member",
      duration: hit.duration_seconds ? formatDuration(hit.duration_seconds) : "?:??",
      location: hit.location_name ?? "Unknown location",
      uploadId: hit.upload_id,
      userId: hit.user_id,
    }));
  }, [elasticNearbyData]);

  // Update map bounds when map moves
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    const updateBounds = () => {
      const bounds = map.getBounds();
      setMapBounds({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    };
    
    // Initial bounds
    updateBounds();
    
    // Listen for map movements
    map.on("moveend", updateBounds);
    map.on("zoomend", updateBounds);
    
    return () => {
      map.off("moveend", updateBounds);
      map.off("zoomend", updateBounds);
    };
  }, [isMapReady]);

  // Debounce: fire Elastic filter search 400ms after user stops typing / changing category
  useEffect(() => {
    const timer = setTimeout(() => {
      const category = filter !== "all" && ELASTIC_CATEGORIES.has(filter) ? filter : undefined;
      const location = searchQuery.trim() || undefined;
      if (category || location) {
        setElasticFilters({ category, location });
      } else {
        setElasticFilters(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, filter]);

  // Toggle "near me" — requests geolocation then activates nearby search
  const handleNearMe = useCallback(() => {
    if (nearMeLocation) {
      setNearMeLocation(null);
      return;
    }
    if (!navigator.geolocation) return;
    setNearMeLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setNearMeLocation({ lat, lon, radius: "5km" });
        setNearMeLoading(false);
        mapRef.current?.flyTo({ center: [lon, lat], zoom: 13, duration: 1200 });
      },
      () => setNearMeLoading(false),
    );
  }, [nearMeLocation]);

  // Merge: Convex uploads + Elastic results
  const allPins = useMemo<Pin[]>(() => {
    const fromConvex = (convexUploads ?? [])
      .filter((u) => u.lat !== undefined && u.lon !== undefined)
      .map((u, i) => mapConvexUpload(u as ConvexUpload, i));

    // Convex is the source of truth for real uploads.
    // Any Elastic hit whose uploadId is not in this set is stale (deleted from Convex
    // but not yet purged from the Elastic index) and must be suppressed.
    const convexIds = new Set(
      fromConvex.map((p) => p.uploadId).filter(Boolean) as string[]
    );
    const isLivePin = (p: Pin) => !p.uploadId || convexIds.has(p.uploadId);

    const combined = [
      ...fromConvex,
      ...elasticPins.filter(isLivePin),
      ...elasticFilterPins.filter(isLivePin),
      ...elasticNearbyPins.filter(isLivePin),
    ];

    // Deduplicate by canonical upload ID (everything after the second dash).
    const uniqueMap = new globalThis.Map<string, Pin>();
    combined.forEach((pin) => {
      const idStr = pin.id.toString();
      const parts = idStr.split("-");
      const key = parts.length >= 3 ? parts.slice(2).join("-") : idStr;
      if (!uniqueMap.has(key)) uniqueMap.set(key, pin);
    });

    // Belt-and-suspenders: also hide IDs deleted in this session before Convex
    // reactivity has had a chance to propagate.
    return Array.from(uniqueMap.values()).filter((pin) => {
      const parts = pin.id.toString().split("-");
      const uploadId = parts.length >= 3 ? parts.slice(2).join("-") : pin.id.toString();
      return !deletedIds.has(uploadId);
    });
  }, [convexUploads, elasticPins, elasticFilterPins, elasticNearbyPins, deletedIds]);

  const FILTER_TYPES: ("all" | SoundType)[] = [
    "all",
    "birds",
    "insects",
    "rain",
    "music",
    "traffic",
    "construction",
    "silence",
  ];

  const categoryPins = useMemo(
    () =>
      filter === "all" ? allPins : allPins.filter((p) => p.type === filter),
    [filter, allPins],
  );
  const visiblePins = useMemo(
    () => searchPins(categoryPins, searchQuery),
    [categoryPins, searchQuery],
  );

  // Convert visible pins to GeoJSON for MapClusterLayer
  const geojsonData = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: visiblePins.map((pin) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [pin.lng, pin.lat],
        },
        properties: {
          id: pin.id.toString(),
          type: pin.type,
        },
      })),
    }),
    [visiblePins],
  );

  // ── Live data for the selected pin (real-time likes / listens) ──
  const liveUpload = useQuery(
    api.uploads.getById,
    selected?.uploadId ? { uploadId: selected.uploadId as Id<"uploads"> } : "skip",
  );
  const userHasLiked = useQuery(
    api.uploads.hasLiked,
    selected?.uploadId && session?.user?.id
      ? { uploadId: selected.uploadId as Id<"uploads">, userId: session.user.id }
      : "skip",
  );

  const S = selected ? CFG[selected.type] : null;
  const panelOpen = selected !== null;

  const closePanel = () => {
    setSelected(null);
  };

  // ── Smooth flyTo on pin/cluster selection ──
  const selectPin = useCallback((pin: Pin) => {
    setSelected((p) => (p?.id === pin.id ? null : pin));
    mapRef.current?.flyTo({
      center: [pin.lng, pin.lat],
      zoom: Math.max(mapRef.current.getZoom(), 12),
      duration: 1200,
    });
  }, []);

  // Handle point click from MapClusterLayer
  const handlePointClick = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point>, _coordinates: [number, number]) => {
      const pinId = feature.properties?.id;
      const pin = visiblePins.find((p) => p.id.toString() === pinId);
      if (pin) selectPin(pin);
    },
    [visiblePins, selectPin],
  );

  // ── Auto-select pin from deep-link (?upload=<uploadId>) ──
  useEffect(() => {
    if (!deepLinkUploadId || deepLinkHandled.current || allPins.length === 0) return;
    const target = allPins.find((p) => p.uploadId === deepLinkUploadId);
    if (!target) return;
    deepLinkHandled.current = true;
    selectPin(target);
  }, [deepLinkUploadId, allPins, selectPin]);


  // Called after a successful upload — Convex query auto-refreshes so the pin
  // will appear once the query refetches (or immediately if optimistic)
  const handleUploadSuccess = useCallback((_result: UploadResult) => {
    setShowUpload(false);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const hasSearch = searchQuery.length > 0;
  const hasFilter = filter !== "all";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#111",
        overflow: "hidden",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      }}
    >
      {/* MAP */}
      <MapLibre
        ref={setMapRef}
        center={[144.9631, -37.8136]}
        zoom={10}
        minZoom={2}
        maxZoom={18}
        theme="dark"
        className="w-full h-full"
      >
        <MapClusterLayer
          data={geojsonData}
          clusterRadius={60}
          clusterMaxZoom={14}
          clusterColors={["#4A9B3F", "#eab308", "#ef4444"]}
          clusterThresholds={[5, 15]}
          pointColor="#3b82f6"
          onPointClick={handlePointClick}
        />
        <MapControls
          position="bottom-right"
          showZoom
          showCompass
          showLocate
        />
      </MapLibre>

      {/* ── SEARCH BAR (only top UI element) ── */}
      <div
        style={{
          position: "absolute",
          top: isMobile ? 56 : 20,
          left: isMobile ? 12 : "50%",
          right: isMobile ? 12 : "auto",
          transform: isMobile ? "none" : "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        {/* Search + dropdown wrapper */}
        <div ref={dropdownRef} style={{ width: isMobile ? "100%" : 400 }}>
          {/* Input row */}
          <div
            style={{
              background: "rgba(12,12,12,.92)",
              backdropFilter: "blur(24px)",
              border: `1px solid ${dropdownOpen ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.13)"}`,
              borderRadius: dropdownOpen ? "14px 14px 0 0" : 14,
              padding: "0 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 44,
              transition: "border-color .15s",
            }}
          >
            {/* Search icon */}
            <svg
              width={14}
              height={14}
              fill="none"
              stroke="rgba(255,255,255,.35)"
              strokeWidth={2.2}
              style={{ flexShrink: 0 }}
            >
              <circle cx={6} cy={6} r={5} />
              <line x1={10} y1={10} x2={14} y2={14} />
            </svg>

            {/* Active filter chip */}
            {hasFilter && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setFilter("all")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: CFG[filter].color,
                  border: "none",
                  borderRadius: 8,
                  padding: "3px 8px 3px 6px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 11 }}>{CFG[filter].icon}</span>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>
                  {CFG[filter].label}
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,.75)",
                    fontSize: 13,
                    lineHeight: 1,
                    marginLeft: 1,
                  }}
                >
                  ×
                </span>
              </button>
            )}

            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              placeholder={
                hasFilter
                  ? `Search in ${CFG[filter].label}…`
                  : "Search sounds, locations, species…"
              }
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#f1f5f9",
                fontSize: 13,
                minWidth: 0,
              }}
            />

            {/* Result count / clear */}
            {hasSearch && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "rgba(255,255,255,.3)", fontSize: 11 }}>
                  {visiblePins.length}
                </span>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearchQuery("");
                    inputRef.current?.focus();
                  }}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,.12)",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(255,255,255,.6)",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Dropdown: filter pills */}
          {dropdownOpen && (
            <div
              style={{
                background: "rgba(12,12,12,.96)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,.13)",
                borderTop: "1px solid rgba(255,255,255,.06)",
                borderRadius: "0 0 14px 14px",
                padding: "10px 12px 12px",
              }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,.22)",
                  fontSize: 10,
                  letterSpacing: 1.2,
                  fontWeight: 600,
                  marginBottom: 8,
                  paddingLeft: 2,
                }}
              >
                FILTER BY TYPE
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {FILTER_TYPES.map((f) => {
                  const active = f === filter;
                  const col = f === "all" ? "#e2e8f0" : CFG[f].color;
                  const count =
                    f === "all"
                      ? allPins.length
                      : allPins.filter((p) => p.type === f).length;
                  return (
                    <button
                      key={f}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setFilter(f);
                        setSearchQuery("");
                        inputRef.current?.focus();
                      }}
                      style={{
                        background: active ? col : "rgba(255,255,255,.06)",
                        border: `1px solid ${active ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.09)"}`,
                        borderRadius: 20,
                        padding: "5px 12px",
                        color: active ? "#000" : "rgba(255,255,255,.55)",
                        fontSize: 12,
                        fontWeight: active ? 700 : 400,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        transition: "all .15s",
                      }}
                    >
                      {f !== "all" && (
                        <span style={{ fontSize: 12 }}>{CFG[f].icon}</span>
                      )}
                      <span>{f === "all" ? "All sounds" : CFG[f].label}</span>
                      <span
                        style={{
                          background: active
                            ? "rgba(0,0,0,.15)"
                            : "rgba(255,255,255,.08)",
                          borderRadius: 8,
                          padding: "0 5px",
                          fontSize: 10,
                          color: active
                            ? "rgba(0,0,0,.6)"
                            : "rgba(255,255,255,.3)",
                          fontWeight: 600,
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {/* end search+dropdown wrapper */}

        {/* Refresh button */}
        <button
          onClick={forceRefresh}
          disabled={isRefreshing}
          title="Refresh from Elastic"
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            background: "rgba(12,12,12,.92)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,.15)",
            borderRadius: 14,
            cursor: isRefreshing ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            transition: "all .15s",
            opacity: isRefreshing ? 0.6 : 1,
          }}
        >
          <span style={{
            display: "inline-block",
            animation: isRefreshing ? "spin 1s linear infinite" : "none",
          }}>↻</span>
        </button>

        {/* Near me button */}
        <button
          onClick={handleNearMe}
          disabled={nearMeLoading}
          title={nearMeLocation ? "Showing sounds near you — click to clear" : "Find sounds near me"}
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            background: nearMeLocation
              ? "rgba(59,130,246,.18)"
              : "rgba(12,12,12,.92)",
            backdropFilter: "blur(24px)",
            border: `1px solid ${nearMeLocation ? "rgba(59,130,246,.55)" : "rgba(255,255,255,.15)"}`,
            borderRadius: 14,
            cursor: nearMeLoading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            transition: "all .15s",
            opacity: nearMeLoading ? 0.6 : 1,
          }}
        >
          {nearMeLoading ? (
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>↻</span>
          ) : (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={nearMeLocation ? "#60a5fa" : "rgba(255,255,255,.6)"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={12} cy={12} r={3} />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          )}
        </button>

        {/* Upload button */}
        <button
          onClick={() => setShowUpload(true)}
          title="Record or upload a sound"
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            background: "rgba(12,12,12,.92)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(34,197,94,.4)",
            borderRadius: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            transition: "all .15s",
          }}
        >
          🎙
        </button>
      </div>

      {/* ── REFRESH INDICATOR ── */}
      {lastRefresh && (
        <div
          style={{
            position: "absolute",
            left: isMobile ? 12 : 20,
            bottom: isMobile ? 12 : 24,
            zIndex: 998,
            background: "rgba(12,12,12,.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 8,
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isRefreshing ? "#fbbf24" : "#22c55e",
            animation: isRefreshing ? "pulse 1s ease-in-out infinite" : "none",
          }} />
          <span style={{
            color: "rgba(255,255,255,.5)",
            fontSize: 10,
            fontFamily: "monospace",
          }}>
            {isRefreshing ? "Refreshing..." : `Updated ${lastRefresh.toLocaleTimeString()}`}
          </span>
        </div>
      )}

      {/* ── SIDE PANEL ── */}
      <div
        style={{
          position: "absolute",
          top: isMobile ? "auto" : 0,
          right: 0,
          bottom: 0,
          left: isMobile ? 0 : "auto",
          width: isMobile ? "100%" : 360,
          maxHeight: isMobile ? "70vh" : "none",
          background: "rgba(5,5,5,.97)",
          backdropFilter: "blur(32px)",
          borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,.08)",
          borderTop: isMobile ? "1px solid rgba(255,255,255,.08)" : "none",
          borderRadius: isMobile ? "16px 16px 0 0" : 0,
          zIndex: 999,
          transform: panelOpen
            ? "translate(0,0)"
            : isMobile
              ? "translateY(100%)"
              : "translateX(100%)",
          transition: "transform .32s cubic-bezier(.4,0,.2,1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Mobile drag handle */}
        {isMobile && panelOpen && (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,.2)" }} />
          </div>
        )}

        {/* Single pin panel */}
        {selected && S && (
          <>
            <div
              style={{
                padding: "22px 20px 18px",
                borderBottom: "1px solid rgba(255,255,255,.07)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h2
                    style={{
                      color: "#f8fafc",
                      fontSize: 19,
                      fontWeight: 700,
                      margin: "0 0 3px",
                      letterSpacing: -0.3,
                    }}
                  >
                    {selected.label}
                  </h2>
                  {selected.species && (
                    <p style={{ color: "rgba(255,255,255,.3)", fontSize: 12, fontStyle: "italic", margin: "0 0 4px" }}>
                      {selected.species}
                    </p>
                  )}
                  <p style={{ color: "rgba(255,255,255,.35)", fontSize: 12, margin: "0 0 4px" }}>
                    📍 {selected.location}
                  </p>
                  <p style={{ color: "rgba(255,255,255,.25)", fontSize: 11, margin: 0 }}>
                    by {selected.userId === session?.user?.id ? (session?.user?.name ?? "You") : "Member"}
                  </p>
                </div>
                <button onClick={closePanel} style={{ background: "none", border: "none", color: "rgba(255,255,255,.35)", cursor: "pointer", fontSize: 22, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>
                  ×
                </button>
              </div>
            </div>

            {/* ── Waveform / audio player ── */}
            <div style={{ margin: "16px 20px 0", padding: "14px 16px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12 }}>
              {selected.storageId ? (
                <AudioPlayerConvex
                  storageId={selected.storageId as Id<"_storage">}
                  color={S.color}
                  duration={selected.duration}
                  onFirstPlay={selected.uploadId ? () => {
                    incrementListenMutation({ uploadId: selected.uploadId! as Id<"uploads"> });
                  } : undefined}
                />
              ) : (
                <>
                  <Waveform color={S.color} />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                    <button
                      onClick={() => setPlaying((p) => !p)}
                      style={{ width: 36, height: 36, background: S.color, border: "none", borderRadius: "50%", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}
                    >
                      {playing ? "⏸" : "▶"}
                    </button>
                    <ScrubBarContainer
                      duration={parseDuration(selected.duration)}
                      value={0}
                      className="flex-1 gap-2"
                      style={{ "--soundmap-pin-color": S.color } as React.CSSProperties}
                    >
                      <ScrubBarTimeLabel time={0} className="text-[10px] w-7 shrink-0" style={{ color: "rgba(255,255,255,.45)" }} />
                      <ScrubBarTrack className="h-1.5 bg-white/[0.08]">
                        <ScrubBarProgress className="bg-transparent [&_[data-slot=progress-indicator]]:[background:var(--soundmap-pin-color)] rounded-full" />
                        <ScrubBarThumb className="h-3 w-3 bg-white" />
                      </ScrubBarTrack>
                      <ScrubBarTimeLabel time={parseDuration(selected.duration)} className="text-[10px] w-7 shrink-0 text-right" style={{ color: "rgba(255,255,255,.25)" }} />
                    </ScrubBarContainer>
                  </div>
                </>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {/* Visual art (GIF / Video) */}
            {(selected.gifStorageId || selected.videoStorageId || selected.gifStatus === "generating" || selected.videoStatus === "generating" || selected.gifStatus === "pending" || selected.videoStatus === "pending") && (
              <div
                style={{
                  margin: "12px 20px 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {selected.gifStorageId ? (
                  <MediaFromStorage
                    storageId={selected.gifStorageId as Id<"_storage">}
                    type="gif"
                  />
                ) : (selected.gifStatus === "generating" || selected.gifStatus === "pending") ? (
                  <div style={{ padding: "12px 16px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, color: "rgba(255,255,255,.4)", fontSize: 11, textAlign: "center" }}>
                    Generating pixel art GIF...
                  </div>
                ) : null}
                {selected.videoStorageId ? (
                  <MediaFromStorage
                    storageId={selected.videoStorageId as Id<"_storage">}
                    type="video"
                  />
                ) : (selected.videoStatus === "generating" || selected.videoStatus === "pending") ? (
                  <div style={{ padding: "12px 16px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, color: "rgba(255,255,255,.4)", fontSize: 11, textAlign: "center" }}>
                    Generating Veo video...
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Metadata grid ── */}
            <div style={{ padding: "14px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {/* Recorded */}
              <div style={{ padding: "10px 12px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10 }}>
                <div style={{ color: "rgba(255,255,255,.25)", fontSize: 10, marginBottom: 3 }}>Recorded</div>
                <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>{selected.time}</div>
              </div>
              {/* Duration */}
              <div style={{ padding: "10px 12px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10 }}>
                <div style={{ color: "rgba(255,255,255,.25)", fontSize: 10, marginBottom: 3 }}>Duration</div>
                <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>{selected.duration}</div>
              </div>
              {/* Likes — clickable, live count */}
              <button
                onClick={() => {
                  if (!selected.uploadId || !session?.user?.id) return;
                  likeMutation({ uploadId: selected.uploadId as Id<"uploads">, userId: session.user.id });
                }}
                style={{
                  padding: "10px 12px",
                  background: userHasLiked ? "rgba(239,68,68,.12)" : "rgba(255,255,255,.03)",
                  border: `1px solid ${userHasLiked ? "rgba(239,68,68,.35)" : "rgba(255,255,255,.06)"}`,
                  borderRadius: 10,
                  cursor: selected.uploadId && session?.user?.id ? "pointer" : "default",
                  textAlign: "left",
                  transition: "all .15s",
                }}
              >
                <div style={{ color: "rgba(255,255,255,.25)", fontSize: 10, marginBottom: 3 }}>Likes</div>
                <div style={{ color: userHasLiked ? "#f87171" : "#e2e8f0", fontSize: 14, fontWeight: 600 }}>
                  ♥ {liveUpload?.likeCount ?? selected.likes}
                </div>
              </button>
              {/* Listens — live count */}
              <div style={{ padding: "10px 12px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10 }}>
                <div style={{ color: "rgba(255,255,255,.25)", fontSize: 10, marginBottom: 3 }}>Listens</div>
                <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>▶ {liveUpload?.listenCount ?? selected.listens}</div>
              </div>
            </div>

            {/* ── Actions ── */}
            <div style={{ padding: "16px 20px", display: "flex", gap: 8, marginTop: "auto" }}>
              {/* View Landscape → Google Maps */}
              {selected.lat !== 0 && selected.lng !== 0 && (
                <a
                  href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 2,
                    background: S.color,
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    padding: "12px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: "center",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  View Landscape →
                </a>
              )}
              {/* Delete — only shown for own recordings */}
              {selected.uploadId && selected.userId === session?.user?.id && (
                <button
                  onClick={async () => {
                    if (!selected.uploadId) return;
                    // Optimistically hide the pin from all sources (Elastic is eventually consistent)
                    setDeletedIds((prev) => new Set(prev).add(selected.uploadId!));
                    closePanel();
                    await deleteUploadMutation({ uploadId: selected.uploadId as Id<"uploads"> });
                  }}
                  style={{
                    flex: 1,
                    background: "rgba(239,68,68,.08)",
                    border: "1px solid rgba(239,68,68,.25)",
                    borderRadius: 10,
                    color: "#f87171",
                    padding: "12px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Delete
                </button>
              )}
            </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes wv0 { from{transform:scaleY(.3)}  to{transform:scaleY(1)}   }
        @keyframes wv1 { from{transform:scaleY(.5)}  to{transform:scaleY(.88)} }
        @keyframes wv2 { from{transform:scaleY(.4)}  to{transform:scaleY(1.1)} }
        @keyframes spin { from{transform:rotate(0deg)}  to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        input::placeholder { color:rgba(255,255,255,.22); }
      `}</style>

      {/* ── UPLOAD PANEL ── */}
      {showUpload && (
        <RecordUploadPanelDark
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}

// ─── AudioPlayerConvex ────────────────────────────────────────────────────────
// Fetches the real audio URL from Convex storage and renders a scrub-bar player.
// Uses Web Audio AnalyserNode to drive a live-reactive waveform while playing.
function AudioPlayerConvex({
  storageId,
  color,
  duration,
  onFirstPlay,
}: {
  storageId: Id<"_storage">;
  color: string;
  duration: string;
  onFirstPlay?: () => void;
}) {
  const url = useQuery(api.uploads.getStorageUrl, { storageId });
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const scrubbingRef = useRef(false);
  const firstPlayFiredRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [playerTime, setPlayerTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);

  // Web Audio analyser state
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const BARS = 20;
  const [barAmplitudes, setBarAmplitudes] = useState<number[]>(() => Array(BARS).fill(0));

  useEffect(() => {
    if (!url) return;

    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    playerRef.current = audio;

    const onMeta = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) setPlayerDuration(d);
    };
    const onTime = () => {
      if (!scrubbingRef.current) setPlayerTime(audio.currentTime);
    };
    const onEnd = () => {
      setPlaying(false);
      setPlayerTime(0);
      setBarAmplitudes(Array(BARS).fill(0));
    };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ctxRef.current?.close();
      ctxRef.current = null;
      analyserRef.current = null;
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.src = "";
      playerRef.current = null;
      firstPlayFiredRef.current = false;
      setPlaying(false);
      setPlayerTime(0);
      setPlayerDuration(0);
      setBarAmplitudes(Array(BARS).fill(0));
    };
  }, [url]);

  // Set up analyser lazily on first play (AudioContext requires a user gesture)
  const setupAnalyser = () => {
    if (analyserRef.current || !playerRef.current) return;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins
      const source = ctx.createMediaElementSource(playerRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;

      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setBarAmplitudes(
          Array.from({ length: BARS }, (_, i) => {
            const bin = Math.floor((i / BARS) * bufLen);
            return data[bin] / 255;
          }),
        );
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext unavailable — static waveform fallback
    }
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) {
      playerRef.current.pause();
    } else {
      setupAnalyser();
      playerRef.current.play();
      if (!firstPlayFiredRef.current) {
        firstPlayFiredRef.current = true;
        onFirstPlay?.();
      }
    }
    setPlaying((p) => !p);
  };

  const handleScrub = (time: number) => {
    if (!playerRef.current) return;
    playerRef.current.currentTime = time;
    setPlayerTime(time);
  };

  const displayDuration = playerDuration || parseDuration(duration);

  if (!url) {
    return (
      <div style={{ color: "rgba(255,255,255,.3)", fontSize: 11, textAlign: "center", padding: "8px 0" }}>
        Loading audio…
      </div>
    );
  }

  return (
    <div>
      <Waveform color={color} amplitudes={playing ? barAmplitudes : undefined} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 12,
        }}
      >
        <button
          onClick={togglePlay}
          style={{
            width: 36,
            height: 36,
            background: color,
            border: "none",
            borderRadius: "50%",
            color: "#fff",
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <ScrubBarContainer
          duration={displayDuration}
          value={playerTime}
          onScrub={handleScrub}
          onScrubStart={() => { scrubbingRef.current = true; }}
          onScrubEnd={() => { scrubbingRef.current = false; }}
          className="flex-1 gap-2"
          style={{ "--soundmap-pin-color": color } as React.CSSProperties}
        >
          <ScrubBarTimeLabel
            time={playerTime}
            className="text-[10px] w-7 shrink-0"
            style={{ color: "rgba(255,255,255,.45)" }}
          />
          <ScrubBarTrack className="h-1.5 bg-white/[0.08]">
            <ScrubBarProgress className="bg-transparent [&_[data-slot=progress-indicator]]:[background:var(--soundmap-pin-color)] rounded-full" />
            <ScrubBarThumb className="h-3 w-3 bg-white" />
          </ScrubBarTrack>
          <ScrubBarTimeLabel
            time={displayDuration}
            className="text-[10px] w-7 shrink-0 text-right"
            style={{ color: "rgba(255,255,255,.25)" }}
          />
        </ScrubBarContainer>
      </div>
    </div>
  );
}

// ─── MediaFromStorage ─────────────────────────────────────────────────────────
// Resolves a Convex storageId and renders either a GIF or video.
function MediaFromStorage({
  storageId,
  type,
}: {
  storageId: Id<"_storage">;
  type: "gif" | "video";
}) {
  const url = useQuery(api.uploads.getStorageUrl, { storageId });

  if (!url) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "rgba(255,255,255,.03)",
          border: "1px solid rgba(255,255,255,.06)",
          borderRadius: 12,
          color: "rgba(255,255,255,.3)",
          fontSize: 11,
          textAlign: "center",
        }}
      >
        Loading {type === "gif" ? "GIF" : "video"}...
      </div>
    );
  }

  if (type === "gif") {
    return (
      <img
        src={url}
        alt="Pixel art visualization"
        style={{
          width: "100%",
          borderRadius: 12,
          imageRendering: "pixelated",
        }}
      />
    );
  }

  return (
    <video
      src={url}
      controls
      autoPlay
      loop
      muted
      playsInline
      style={{
        width: "100%",
        borderRadius: 12,
      }}
    />
  );
}
