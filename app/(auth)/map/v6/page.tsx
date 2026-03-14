"use client";

import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { useMemo } from "react";
import { PixelOverlay, type OverlaySound } from "@/components/map/PixelOverlay";
import { MapBackButton } from "@/components/map/MapBackButton";

const MAP_ID = "soundsoil-dark";

export default function Page() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const center = useMemo(() => ({ lat: 10.7769, lng: 106.7009 }), []);
  const sounds = useMemo<OverlaySound[]>(
    () => [
      { id: "hcmc-1", lat: 10.7769, lng: 106.7009, likeCount: 4 },
      { id: "hcmc-2", lat: 10.7810, lng: 106.6950, likeCount: 14 },
      { id: "hcmc-3", lat: 10.7740, lng: 106.7060, likeCount: 33 },
      { id: "hcmc-4", lat: 10.7825, lng: 106.7030, likeCount: 8 },
      { id: "hcmc-5", lat: 10.7795, lng: 106.6990, likeCount: 21 },
      { id: "hcmc-6", lat: 10.7732, lng: 106.7040, likeCount: 2 },
    ],
    [],
  );

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
        <PixelOverlay sounds={sounds} />
      </APIProvider>
    </div>
  );
}

