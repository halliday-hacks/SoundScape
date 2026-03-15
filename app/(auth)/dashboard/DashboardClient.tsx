"use client";

import { useState } from "react";
import { PixelCanvas } from "@/components/pixel-canvas";
import { LeaderboardTab, RecordingsTab } from "./SocialTab";

type Tab = "soundscape" | "leaderboard" | "recordings";

export function DashboardClient() {
  const [activeTab, setActiveTab] = useState<Tab>("soundscape");

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex items-end gap-0.5 border-b border-[rgba(147,197,253,0.09)]">
        <TabButton label="SoundScape" active={activeTab === "soundscape"} onClick={() => setActiveTab("soundscape")} />
        <TabButton label="Leaderboard" active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")} />
        <TabButton label="Recordings" active={activeTab === "recordings"} onClick={() => setActiveTab("recordings")} />
      </div>

      {/* Tab content */}
      {activeTab === "soundscape" && (
        <div className="space-y-1">
          <span className="text-xs text-[#5C6A82] tracking-widest uppercase">Listen · Visualise · Map</span>
          <PixelCanvas />
        </div>
      )}
      {activeTab === "leaderboard" && <LeaderboardTab />}
      {activeTab === "recordings" && <RecordingsTab />}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-1.5 text-sm font-medium rounded-t-md border border-b-0 transition-colors
        ${
          active
            ? "bg-[#0B0E18] border-[rgba(147,197,253,0.12)] text-[#DDE4F0]"
            : "bg-transparent border-transparent text-[#5C6A82] hover:text-[#93C5FD] hover:bg-[rgba(147,197,253,0.05)]"
        }
      `}
    >
      {label}
    </button>
  );
}
