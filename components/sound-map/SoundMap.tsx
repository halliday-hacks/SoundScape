"use client";

import dynamic from "next/dynamic";

// Leaflet requires browser APIs — must be loaded client-side only
const SoundMap = dynamic(() => import("./SoundMapInner"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#050e05",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Courier New', monospace",
        color: "#22c55e",
        fontSize: 14,
        letterSpacing: 3,
        border: "3px solid #22c55e",
        boxShadow: "4px 4px 0 #000",
      }}
    >
      ▓▓▓ LOADING MAP... ▓▓▓
    </div>
  ),
});

export default SoundMap;
