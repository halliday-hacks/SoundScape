"use client";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/sound-map/SoundMapInnerV3"), {
  ssr: false,
  loading: () => <div style={{ width: "100vw", height: "100vh", background: "#100d07" }} />,
});

export default function Page() {
  return <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}><Map /></div>;
}
