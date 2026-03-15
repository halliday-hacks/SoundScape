import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { PixelCanvas } from "@/components/pixel-canvas";

export default async function LandingPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0D0F0A] text-[#EDE8DC]">
      {/* Nav */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-[#EDE8DC]">SoundScape</span>
          <span className="hidden sm:inline text-xs text-[#9E9B8E] italic">
            Listen to the Earth. Watch it Grow.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-[#9E9B8E] hover:text-[#EDE8DC] hover:bg-[rgba(255,255,255,0.06)]"
          >
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-[#4A9B3F] text-[#EDE8DC] hover:bg-[#3d8434] border-0 shadow-none"
          >
            <Link href="/sign-up">Start Listening</Link>
          </Button>
        </div>
      </header>

      {/* Canvas hero — full bleed on mobile, max-width on desktop */}
      <main className="flex-1 flex flex-col">
        <div className="w-full sm:max-w-5xl sm:mx-auto sm:px-6">
          <PixelCanvas />
        </div>

        {/* CTA — 16px clearance below canvas */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4 pb-6">
          <p className="text-sm text-[#9E9B8E] max-w-md text-center sm:text-left">
            Real-time environmental audio classification that turns your neighbourhood
            soundscape into a living pixel world.
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-transparent border-[rgba(255,255,255,0.2)] text-[#9E9B8E] hover:text-[#EDE8DC] hover:bg-[rgba(255,255,255,0.06)] shadow-none"
            >
              <Link href="/map">🗺 Sound Map</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-transparent border-[rgba(255,255,255,0.2)] text-[#9E9B8E] hover:text-[#EDE8DC] hover:bg-[rgba(255,255,255,0.06)] shadow-none"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="bg-[#4A9B3F] text-[#EDE8DC] hover:bg-[#3d8434] border-0 shadow-none"
            >
              <Link href="/sign-up">Start Listening →</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
