"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Trophy, Music, ChevronDown, ChevronUp, Loader2, Sprout } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardUser {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  uploadCount: number;
  totalLikes: number;
  totalListens: number;
  score: number;
}

interface RecentUpload {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  locationLabel: string | null;
  dominantClass: string | null;
  likeCount: number;
  listenCount: number;
  biodiversityScore: number | null;
  durationSeconds: number | null;
  createdAt: number;
  lat: number | null;
  lon: number | null;
}

interface PopupCoords {
  x: number; // left edge of popup (fixed)
  y: number; // top edge of popup (fixed)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLASS_EMOJI: Record<string, string> = {
  birds: "🐦",
  insects: "🦟",
  traffic: "🚗",
  wind: "💨",
  construction: "🏗️",
  silence: "🤫",
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Fixed-position Popups ────────────────────────────────────────────────────
// Popup floats above the cursor with a bottom-left arrow pointing at the hover spot.
// Uses fixed positioning so parent overflow-hidden never clips it.

const POPUP_WIDTH = 216;


function UserPopup({ user, coords }: { user: LeaderboardUser; coords: PopupCoords }) {
  return (
    <div
      style={{ position: "fixed", top: coords.y, left: coords.x, width: POPUP_WIDTH, zIndex: 9999 }}
      className="bg-[#0C0F1A] border border-[rgba(147,197,253,0.12)] rounded-lg p-3 shadow-2xl pointer-events-none text-xs"
    >
      <div className="flex items-center gap-2 mb-2">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#1C2535] flex items-center justify-center text-[#DDE4F0] font-semibold">
            {user.name[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div>
          <div className="text-[#DDE4F0] font-medium">{user.name}</div>
          {user.username && <div className="text-[#5C6A82]">@{user.username}</div>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="bg-[#0B0E18] rounded p-1">
          <div className="text-[#7DD3FC] font-semibold">{user.uploadCount}</div>
          <div className="text-[#5C6A82]">uploads</div>
        </div>
        <div className="bg-[#0B0E18] rounded p-1">
          <div className="text-[#F87171] font-semibold">{user.totalLikes}</div>
          <div className="text-[#5C6A82]">likes</div>
        </div>
        <div className="bg-[#0B0E18] rounded p-1">
          <div className="text-[#93C5FD] font-semibold">{user.totalListens}</div>
          <div className="text-[#5C6A82]">plays</div>
        </div>
      </div>
    </div>
  );
}

function UploadPopup({ upload, coords }: { upload: RecentUpload; coords: PopupCoords }) {
  const emoji = CLASS_EMOJI[upload.dominantClass ?? ""] ?? "🎵";
  return (
    <div
      style={{ position: "fixed", top: coords.y, left: coords.x, width: POPUP_WIDTH, zIndex: 9999 }}
      className="bg-[#0C0F1A] border border-[rgba(147,197,253,0.12)] rounded-lg p-3 shadow-2xl pointer-events-none text-xs"
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg">{emoji}</span>
        <div>
          <div className="text-[#DDE4F0] font-medium leading-tight">{upload.title}</div>
          {upload.locationLabel && (
            <div className="text-[#5C6A82] mt-0.5">{upload.locationLabel}</div>
          )}
        </div>
      </div>
      {upload.description && (
        <div className="text-[#5C6A82] mb-2 italic line-clamp-2">{upload.description}</div>
      )}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="bg-[#0B0E18] rounded p-1">
          <div className="text-[#F87171] font-semibold">{upload.likeCount}</div>
          <div className="text-[#5C6A82]">likes</div>
        </div>
        <div className="bg-[#0B0E18] rounded p-1">
          <div className="text-[#93C5FD] font-semibold">{upload.listenCount}</div>
          <div className="text-[#5C6A82]">plays</div>
        </div>
        {upload.biodiversityScore != null && (
          <div className="bg-[#0B0E18] rounded p-1">
            <div className="text-[#7DD3FC] font-semibold">{Math.round(upload.biodiversityScore)}</div>
            <div className="text-[#5C6A82]">bio</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Popup floats above the cursor; bottom-left arrow (at left:14) aligns with cursor.
// x is offset so arrow tip is roughly under cursor x.
// y is above cursor with enough room for the popup content.
function getPopupCoords(e: React.MouseEvent): PopupCoords {
  const POPUP_HEIGHT_ESTIMATE = 140;
  const ARROW_HEIGHT = 9;
  const ARROW_LEFT_OFFSET = 14; // arrow tip is 14px from popup's left edge
  return {
    x: e.clientX - ARROW_LEFT_OFFSET,
    y: Math.max(8, e.clientY - POPUP_HEIGHT_ESTIMATE - ARROW_HEIGHT),
  };
}

// ─── Leaderboard Tab ──────────────────────────────────────────────────────────

export function LeaderboardTab() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<{ user: LeaderboardUser; coords: PopupCoords } | null>(null);

  useEffect(() => {
    fetch("/api/users/leaderboard?limit=20")
      .then((r) => r.json())
      .then((d) => setUsers(d.leaderboard ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleMouseEnter = useCallback((user: LeaderboardUser, e: React.MouseEvent<HTMLDivElement>) => {
    setHovered({ user, coords: getPopupCoords(e) });
  }, []);

  const handleMouseLeave = useCallback(() => setHovered(null), []);

  const visible = expanded ? users : users.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[rgba(147,197,253,0.09)] bg-[#0B0E18]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(147,197,253,0.09)]">
          <Trophy size={14} className="text-yellow-400" />
          <span className="text-sm font-semibold text-[#DDE4F0]">Leaderboard</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={16} className="animate-spin text-[#5C6A82]" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center text-[#3D4A5C] text-xs py-10">
            No activity yet — use the Seed button to add test data.
          </div>
        ) : (
          <>
            {visible.map((user, i) => (
              <div
                key={user.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(147,197,253,0.06)] last:border-0 hover:bg-[rgba(147,197,253,0.04)] cursor-default transition-colors"
                onMouseEnter={(e) => handleMouseEnter(user, e)}
                onMouseLeave={handleMouseLeave}
              >
                <span className="w-6 text-center font-bold text-sm">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (
                    <span className="text-[#3D4A5C]">{i + 1}</span>
                  )}
                </span>

                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={user.name} className="w-7 h-7 rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#1C2535] flex items-center justify-center text-[#B0BDD0] text-xs font-semibold flex-shrink-0">
                    {user.name[0]?.toUpperCase() ?? "?"}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-[#DDE4F0] text-sm font-medium truncate">{user.name}</div>
                  {user.username && (
                    <div className="text-[#3D4A5C] text-xs truncate">@{user.username}</div>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-[#7DD3FC] text-sm font-semibold">{user.score} pts</div>
                </div>
              </div>
            ))}

            {users.length > 5 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs text-[#5C6A82] hover:text-[#B0BDD0] transition-colors border-t border-[rgba(147,197,253,0.09)]"
              >
                {expanded
                  ? <><ChevronUp size={12} /> Show less</>
                  : <><ChevronDown size={12} /> Show {users.length - 5} more</>
                }
              </button>
            )}
          </>
        )}
      </div>

      <SeedPanel />

      {/* Fixed popup rendered outside any overflow-hidden container */}
      {hovered && <UserPopup user={hovered.user} coords={hovered.coords} />}
    </div>
  );
}

// ─── Recordings Tab ───────────────────────────────────────────────────────────

export function RecordingsTab() {
  const router = useRouter();
  const [uploads, setUploads] = useState<RecentUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<{ upload: RecentUpload; coords: PopupCoords } | null>(null);

  useEffect(() => {
    fetch("/api/uploads/recent?limit=10")
      .then((r) => r.json())
      .then((d) => setUploads(d.uploads ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleMouseEnter = useCallback((upload: RecentUpload, e: React.MouseEvent<HTMLDivElement>) => {
    setHovered({ upload, coords: getPopupCoords(e) });
  }, []);

  const handleMouseLeave = useCallback(() => setHovered(null), []);

  const handleClick = useCallback((upload: RecentUpload) => {
    const params = new URLSearchParams({ upload: upload.id });
    if (upload.lat != null) params.set("lat", String(upload.lat));
    if (upload.lon != null) params.set("lon", String(upload.lon));
    router.push(`/map?${params.toString()}`);
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[rgba(147,197,253,0.09)] bg-[#0B0E18]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(147,197,253,0.09)]">
          <Music size={14} className="text-[#7DD3FC]" />
          <span className="text-sm font-semibold text-[#DDE4F0]">Recent Recordings</span>
          <span className="ml-auto text-xs text-[#3D4A5C]">latest 10</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={16} className="animate-spin text-[#5C6A82]" />
          </div>
        ) : uploads.length === 0 ? (
          <div className="text-center text-[#3D4A5C] text-xs py-10">
            No recordings yet — go to Leaderboard and seed some data.
          </div>
        ) : (
          uploads.map((upload) => {
            const emoji = CLASS_EMOJI[upload.dominantClass ?? ""] ?? "🎵";
            return (
              <div
                key={upload.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(147,197,253,0.06)] last:border-0 hover:bg-[rgba(147,197,253,0.04)] cursor-pointer transition-colors"
                onMouseEnter={(e) => handleMouseEnter(upload, e)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(upload)}
              >
                <span className="text-base w-5 text-center flex-shrink-0">{emoji}</span>

                <div className="flex-1 min-w-0">
                  <div className="text-[#DDE4F0] text-sm font-medium truncate">{upload.title}</div>
                  <div className="text-[#3D4A5C] text-xs truncate">
                    {upload.locationLabel ?? "Unknown location"} · {timeAgo(upload.createdAt)}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#5C6A82] flex-shrink-0">
                  <span>❤️ {upload.likeCount}</span>
                  <span>▶ {upload.listenCount}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <SeedPanel />

      {hovered && <UploadPopup upload={hovered.upload} coords={hovered.coords} />}
    </div>
  );
}

// ─── Seed Panel ───────────────────────────────────────────────────────────────

function SeedPanel() {
  const { data: session } = authClient.useSession();
  const seedMutation = useMutation(api.seed.seedTestUploads);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [count, setCount] = useState(0);

  const handleSeed = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setStatus("loading");
    try {
      const n = await seedMutation({ userId });
      setCount(n);
      setStatus("done");
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="rounded-xl border border-[rgba(147,197,253,0.09)] bg-[#0B0E18] px-4 py-3 flex items-center gap-3">
      <Sprout size={14} className="text-[#93C5FD] flex-shrink-0" />
      <div className="flex-1">
        <div className="text-xs font-medium text-[#5C6A82]">Seed test data</div>
        <div className="text-xs text-[#3D4A5C]">Inserts 15 realistic Melbourne recordings under your account</div>
      </div>
      <button
        onClick={handleSeed}
        disabled={status === "loading" || status === "done" || !session?.user?.id}
        className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(147,197,253,0.12)] text-[#B0BDD0] hover:bg-[#0F1422] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
      >
        {status === "loading" && <Loader2 size={10} className="animate-spin" />}
        {status === "done"
          ? `✓ Seeded ${count} uploads`
          : status === "error"
          ? "Error — try again"
          : "Seed now"}
      </button>
    </div>
  );
}
