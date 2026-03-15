"use client";

import ResultDashboard from "@/components/soundsoil/ResultDashboard";

export default function SoundSoilPage() {
  return (
    <div className="min-h-screen bg-[#081a0b] flex items-center justify-center overflow-auto p-4">
      <div className="relative w-[1146px] h-[928px] shrink-0">
        <ResultDashboard />
      </div>
    </div>
  );
}
