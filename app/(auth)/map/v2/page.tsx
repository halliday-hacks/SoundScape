"use client";

import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef, useState } from "react";
import { PixelOverlay, type OverlaySound } from "@/components/map/PixelOverlay";
import { MapBackButton } from "@/components/map/MapBackButton";
import { BiomeOverlay } from "@/components/map/BiomeOverlay";

const MAP_ID = "soundsoil-dark";

export default function Page() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const center = useMemo(() => ({ lat: 10.7769, lng: 106.7009 }), []);
  const [sounds, setSounds] = useState<OverlaySound[]>([]);

  if (!apiKey) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#0D0F0A", color: "#EDE8DC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "var(--font-inter, system-ui)" }}>
        <MapBackButton />
        <div style={{ maxWidth: 560, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Missing Google Maps API key</div>
          <div style={{ color: "#9E9B8E", fontSize: 13 }}>
            Set <code style={{ color: "#EDE8DC" }}>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in{" "}
            <code style={{ color: "#EDE8DC" }}>.env.local</code>, then restart the dev server.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0D0F0A" }}>
      <MapBackButton />
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI
          mapId={MAP_ID}
          style={{ width: "100%", height: "100%" }}
        />
        <ElasticSoundFetcher onUpdate={setSounds} />
        <PixelOverlay sounds={sounds} />
        <BiomeOverlay sounds={sounds} />
      </APIProvider>
    </div>
  );
}

type FetcherProps = {
  onUpdate: (sounds: OverlaySound[]) => void;
};

function ElasticSoundFetcher({ onUpdate }: FetcherProps) {
  const map = useMap();
  const inFlight = useRef<AbortController | null>(null);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!map) return;

    const fetchForBounds = () => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const north = ne.lat();
      const east = ne.lng();
      const south = sw.lat();
      const west = sw.lng();

      const key = [
        north.toFixed(3),
        south.toFixed(3),
        east.toFixed(3),
        west.toFixed(3),
      ].join(":");
      if (key === lastKey.current) return;
      lastKey.current = key;

      if (inFlight.current) {
        inFlight.current.abort();
      }
      const ac = new AbortController();
      inFlight.current = ac;

      const params = new URLSearchParams({
        top_left_lat: north.toString(),
        top_left_lon: west.toString(),
        bottom_right_lat: south.toString(),
        bottom_right_lon: east.toString(),
        limit: "200",
      });

      fetch(`/api/search/map?${params.toString()}`, { signal: ac.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !Array.isArray(data.hits)) {
            onUpdate([]);
            return;
          }
          const mapped: OverlaySound[] = data.hits
            .filter(
              (h: any) =>
                h.geo &&
                typeof h.geo.lat === "number" &&
                typeof h.geo.lon === "number",
            )
            .map((h: any) => ({
              id: h.upload_id ?? `${h.geo.lat},${h.geo.lon}`,
              lat: h.geo.lat,
              lng: h.geo.lon,
              likeCount: typeof h.likes === "number" ? h.likes : 0,
              dominantClass: h.dominant_class ?? null,
            }));
          onUpdate(mapped);
        })
        .catch((err) => {
          if ((err as any)?.name === "AbortError") return;
          console.error("[ElasticSoundFetcher] map fetch error", err);
          onUpdate([]);
        });
    };

    // initial fetch once map is ready
    fetchForBounds();
    const idleListener = map.addListener("idle", fetchForBounds);

    return () => {
      idleListener.remove();
      if (inFlight.current) {
        inFlight.current.abort();
      }
    };
  }, [map, onUpdate]);

  return null;
}
