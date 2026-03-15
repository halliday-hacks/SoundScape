"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut, Map, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const UserProfile = () => {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  return (
    <div className="flex items-center gap-4">
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
      <div className="flex flex-col gap-0.5">
        <span className="wordmark text-xl text-[#DDE4F0]">
          Sound<span className="text-[#93C5FD]">Scape</span>
        </span>
        <span className="text-[11px] text-[#5C6A82] tracking-widest uppercase">
          Listen · Visualise · Map
        </span>
      </div>

      {/* Right: nav + user */}
      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-[#5C6A82] hover:text-[#93C5FD] hover:bg-[rgba(147,197,253,0.06)] gap-1.5 transition-colors"
        >
          <Link href="/map">
            <Map size={15} />
            Sound Map
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-[#5C6A82] hover:text-[#DDE4F0] hover:bg-[rgba(147,197,253,0.06)] gap-1.5 transition-colors"
        >
          <Link href="/settings">
            <Settings size={15} />
            Settings
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-[#5C6A82] hover:text-[#DDE4F0] hover:bg-[rgba(147,197,253,0.06)] gap-1.5 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </Button>
        <div className="ml-3 pl-3 border-l border-[rgba(147,197,253,0.09)]">
          <UserProfile />
        </div>
      </div>
    </header>
  );
};
