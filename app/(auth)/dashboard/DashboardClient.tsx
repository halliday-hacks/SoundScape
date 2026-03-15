"use client";

import { useState } from "react";
import { PixelCanvas } from "@/components/pixel-canvas";
import { LeaderboardTab, RecordingsTab } from "./SocialTab";

type Tab = "soundsoil" | "leaderboard" | "recordings";

export function DashboardClient() {
  const [activeTab, setActiveTab] = useState<Tab>("soundsoil");

  return (
    <div className="space-y-3">
      {/* Chrome-style tab bar */}
      <div className="flex items-end gap-0.5 border-b border-neutral-800">
        <TabButton label="SoundSoil" active={activeTab === "soundsoil"} onClick={() => setActiveTab("soundsoil")} />
        <TabButton label="Leaderboard" active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")} />
        <TabButton label="Recordings" active={activeTab === "recordings"} onClick={() => setActiveTab("recordings")} />
      </div>

      {/* Tab content */}
      {activeTab === "soundsoil" && (
        <div className="space-y-1">
          <span className="text-xs text-neutral-500 italic">Listen to the Earth. Watch it Grow.</span>
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
            ? "bg-neutral-900 border-neutral-700 text-neutral-100"
            : "bg-transparent border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40"
        }
      `}
    >
      {label}
    </button>
  );
}
