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
    <div className="min-h-screen flex flex-col bg-[#06080F] text-[#E2E8F0]">
      {/* Top ambient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#22D3EE33] to-transparent" />

      {/* Nav */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className="font-bold tracking-tight text-[#E2E8F0] text-lg"
            style={{ fontFamily: "var(--font-syne, sans-serif)", letterSpacing: "-0.02em" }}
          >
            Sound<span className="text-[#22D3EE]">Scape</span>
          </span>
          <span className="hidden sm:inline text-xs text-[#64748B] tracking-widest uppercase">
            Listen · Visualise · Map
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-[#64748B] hover:text-[#E2E8F0] hover:bg-[rgba(34,211,238,0.06)]"
          >
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-[#22D3EE] text-[#06080F] hover:bg-[#06B6D4] border-0 shadow-none font-semibold tracking-tight"
          >
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </div>
      </header>

      {/* Canvas hero — full bleed on mobile, max-width on desktop */}
      <main className="flex-1 flex flex-col">
        <div className="w-full sm:max-w-5xl sm:mx-auto sm:px-6">
          <PixelCanvas />
        </div>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4 pb-8">
          <p className="text-sm text-[#64748B] max-w-md text-center sm:text-left leading-relaxed">
            Real-time environmental audio classification that turns your neighbourhood
            soundscape into a living pixel world.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-transparent border-[rgba(34,211,238,0.2)] text-[#64748B] hover:text-[#22D3EE] hover:bg-[rgba(34,211,238,0.06)] hover:border-[rgba(34,211,238,0.4)] shadow-none transition-all"
            >
              <Link href="/map">Sound Map</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-transparent border-[rgba(34,211,238,0.2)] text-[#64748B] hover:text-[#E2E8F0] hover:bg-[rgba(34,211,238,0.06)] shadow-none"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="bg-[#22D3EE] text-[#06080F] hover:bg-[#06B6D4] border-0 shadow-none font-semibold"
            >
              <Link href="/sign-up">Start Listening →</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
