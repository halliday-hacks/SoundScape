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
          className="rounded-full ring-1 ring-[rgba(34,211,238,0.2)]"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[rgba(34,211,238,0.1)] border border-[rgba(34,211,238,0.2)] flex items-center justify-center text-[#22D3EE] font-semibold text-sm">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div>
        <p className="font-medium text-sm text-[#E2E8F0] leading-none">{user?.name ?? ""}</p>
        <p className="text-xs text-[#64748B] mt-0.5">{user?.email ?? ""}</p>
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
      <UserProfile />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-[#64748B] hover:text-[#22D3EE] hover:bg-[rgba(34,211,238,0.06)] gap-1.5 transition-colors"
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
          className="text-[#64748B] hover:text-[#E2E8F0] hover:bg-[rgba(34,211,238,0.06)] gap-1.5 transition-colors"
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
          className="text-[#64748B] hover:text-[#E2E8F0] hover:bg-[rgba(34,211,238,0.06)] gap-1.5 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </Button>
      </div>
    </header>
  );
};
