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
    <div className="min-h-screen flex flex-col bg-[#07090E] text-[#DDE4F0]">
      {/* Nav */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="wordmark text-xl text-[#DDE4F0]">
            Sound<span className="text-[#93C5FD]">Scape</span>
          </span>
          <span className="hidden sm:inline text-xs text-[#5C6A82] tracking-widest uppercase">
            Listen · Visualise · Map
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-[#5C6A82] hover:text-[#DDE4F0] hover:bg-[rgba(147,197,253,0.06)]"
          >
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-[#93C5FD] text-[#07090E] hover:bg-[#BFDBFE] border-0 shadow-none font-medium"
          >
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </div>
      </header>

      {/* Canvas hero */}
      <main className="flex-1 flex flex-col">
        <div className="w-full sm:max-w-5xl sm:mx-auto sm:px-6">
          <PixelCanvas />
        </div>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4 pb-8">
          <p className="text-sm text-[#5C6A82] max-w-md text-center sm:text-left leading-relaxed">
            Real-time environmental audio classification that turns your neighbourhood
            soundscape into a living pixel world.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-transparent border-[rgba(147,197,253,0.15)] text-[#5C6A82] hover:text-[#93C5FD] hover:bg-[rgba(147,197,253,0.06)] hover:border-[rgba(147,197,253,0.3)] shadow-none transition-all"
            >
              <Link href="/map">Sound Map</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-transparent border-[rgba(147,197,253,0.15)] text-[#5C6A82] hover:text-[#DDE4F0] hover:bg-[rgba(147,197,253,0.06)] shadow-none"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="bg-[#93C5FD] text-[#07090E] hover:bg-[#BFDBFE] border-0 shadow-none font-medium"
            >
              <Link href="/sign-up">Start Listening →</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
