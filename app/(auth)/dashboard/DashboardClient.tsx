"use client";

import { useState } from "react";
import Link from "next/link";
import { Map } from "lucide-react";
import { PixelCanvas } from "@/components/pixel-canvas";
import { LeaderboardTab, RecordingsTab } from "./SocialTab";

type Tab = "soundscape" | "leaderboard" | "recordings";

export function DashboardClient() {
  const [activeTab, setActiveTab] = useState<Tab>("soundscape");

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex items-end justify-between border-b border-[rgba(139,92,246,0.09)]">
        <div className="flex items-end gap-0.5">
          <TabButton label="SoundScape" active={activeTab === "soundscape"} onClick={() => setActiveTab("soundscape")} />
          <TabButton label="Leaderboard" active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")} />
          <TabButton label="Recordings" active={activeTab === "recordings"} onClick={() => setActiveTab("recordings")} />
        </div>
        <Link
          href="/map"
          className="mb-1 flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white/90 tracking-wide transition-opacity hover:opacity-80"
          style={{
            border: "1px solid transparent",
            background: "linear-gradient(#0D1117,#0D1117) padding-box, linear-gradient(135deg, #3b82f6, #60a5fa, #93c5fd, #3b82f6) border-box",
          }}
        >
          <Map size={14} />
          Sound Map →
        </Link>
      </div>

      {/* Tab content */}
      {activeTab === "soundscape" && (
        <div className="space-y-1">
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
            ? "bg-[#0D1117] border-[rgba(139,92,246,0.12)] text-[#F1F5F9]"
            : "bg-transparent border-transparent text-[#6B7280] hover:text-[#8B5CF6] hover:bg-[rgba(139,92,246,0.05)]"
        }
      `}
    >
      {label}
    </button>
  );
}
