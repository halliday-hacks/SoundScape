"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { authClient } from "@/lib/auth-client";

const UserProfile = () => {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  return (
    <div className="flex items-center gap-3">
      {user?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt={user.name}
          width={36}
          height={36}
          className="rounded-full ring-1 ring-[rgba(139,92,246,0.2)]"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.15)] flex items-center justify-center text-[#8B5CF6] font-semibold text-sm">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div>
        <p className="font-medium text-sm text-[#F1F5F9] leading-none">{user?.name ?? ""}</p>
        <p className="text-xs text-[#6B7280] mt-0.5">{user?.email ?? ""}</p>
      </div>
    </div>
  );
};

export const Header = () => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/");
        },
      },
    });
  };

  return (
    <header className="flex items-center justify-between py-1">
      {/* Left: wordmark + tagline */}
      <div className="flex flex-col gap-1">
        <span className="wordmark text-2xl text-[#F1F5F9]">
          Sound<span style={{ color: "#60a5fa" }}>Scape</span>
        </span>
        <span className="text-[10px] text-[#6B7280] tracking-[0.2em] uppercase">
          Listen · Visualise · Map
        </span>
      </div>

      {/* Right: Sound Map + user + menu */}
      <div className="flex items-center gap-3 ml-auto">
        {/* User + hamburger */}
        <div className="flex items-center gap-2 pl-3 border-l border-[rgba(139,92,246,0.09)]">
          <UserProfile />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-md text-[#6B7280] hover:text-[#F1F5F9] hover:bg-[rgba(139,92,246,0.06)] transition-colors"
            >
              <Menu size={16} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border border-[rgba(139,92,246,0.1)] bg-[#0D1117] shadow-xl py-1 z-50">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#6B7280] hover:text-[#F1F5F9] hover:bg-[rgba(139,92,246,0.05)] transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#6B7280] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.05)] transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
