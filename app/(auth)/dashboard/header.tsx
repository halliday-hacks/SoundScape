"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut, Map, Menu, Settings } from "lucide-react";
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
          className="rounded-full ring-1 ring-[rgba(147,197,253,0.2)]"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[rgba(147,197,253,0.08)] border border-[rgba(147,197,253,0.15)] flex items-center justify-center text-[#93C5FD] font-semibold text-sm">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div>
        <p className="font-medium text-sm text-[#DDE4F0] leading-none">{user?.name ?? ""}</p>
        <p className="text-xs text-[#5C6A82] mt-0.5">{user?.email ?? ""}</p>
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
        <span className="wordmark text-2xl text-[#DDE4F0]">
          Sound<span className="text-[#93C5FD]">Scape</span>
        </span>
        <span className="text-[10px] text-[#5C6A82] tracking-[0.2em] uppercase">
          Listen · Visualise · Map
        </span>
      </div>

      {/* Right: Sound Map + user + menu */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Sound Map — gradient border pill */}
        <Link
          href="/map"
          className="relative flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-[#93C5FD] rounded-full transition-colors hover:text-white"
          style={{
            background: "linear-gradient(#07090E, #07090E) padding-box, linear-gradient(135deg, #93C5FD, #A5B4FC, #818CF8) border-box",
            border: "1px solid transparent",
          }}
        >
          <Map size={14} />
          Sound Map
        </Link>

        {/* User + hamburger */}
        <div className="flex items-center gap-2 pl-3 border-l border-[rgba(147,197,253,0.09)]">
          <UserProfile />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-md text-[#5C6A82] hover:text-[#DDE4F0] hover:bg-[rgba(147,197,253,0.06)] transition-colors"
            >
              <Menu size={16} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border border-[rgba(147,197,253,0.1)] bg-[#0B0E18] shadow-xl py-1 z-50">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#5C6A82] hover:text-[#DDE4F0] hover:bg-[rgba(147,197,253,0.05)] transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#5C6A82] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.05)] transition-colors"
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
