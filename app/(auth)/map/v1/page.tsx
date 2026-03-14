"use client";
import dynamic from "next/dynamic";
import { MapBackButton } from "@/components/map/MapBackButton";

const Map = dynamic(() => import("@/components/sound-map/SoundMapInnerV1"), {
  ssr: false,
  loading: () => <div style={{ width: "100vw", height: "100vh", background: "#080808" }} />,
});

export default function Page() {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <MapBackButton />
      <Map />
    </div>
  );
}
