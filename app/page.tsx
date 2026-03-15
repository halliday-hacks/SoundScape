import Link from "next/link";
import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { PixelCanvas } from "@/components/pixel-canvas";

export default async function LandingPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <div
      className="min-h-screen flex flex-col text-white overflow-hidden"
      style={{ background: "#050816" }}
    >
      {/* Background gradient orbs — fixed, decorative */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute"
          style={{
            top: "-10%", right: "-5%",
            width: "55vw", height: "55vw",
            background: "radial-gradient(circle, rgba(123,108,255,0.18) 0%, transparent 65%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: "5%", left: "-10%",
            width: "40vw", height: "40vw",
            background: "radial-gradient(circle, rgba(86,215,255,0.12) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* ── Nav ── thin, minimal */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 border-b border-white/[0.07]">
        <span className="wordmark text-lg tracking-tight">
          <span style={{ background: "linear-gradient(135deg, #f87171, #fb923c, #fbbf24, #4ade80, #60a5fa, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Sound</span>Scape
        </span>

        <nav className="flex items-center gap-6 text-[13px] text-white/45">
          <Link href="/sign-in" className="hover:text-white/80 transition-colors">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-1.5 text-[12px] font-medium tracking-wider uppercase text-white border border-white/20 hover:border-white/40 transition-colors"
            style={{ borderRadius: "3px" }}
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* ── Hero ── canvas-first layout */}
      <main className="relative z-10 flex-1 flex flex-col">
        <section className="max-w-7xl mx-auto w-full px-6 sm:px-10 pt-10 pb-6 flex flex-col gap-6">

          {/* Top row: headline left, CTA right */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[clamp(1.6rem,3.5vw,2.6rem)] font-bold leading-tight tracking-tight text-white/90">
                Your neighbourhood,<br />
                <span style={{ background: "linear-gradient(135deg, #f87171, #fb923c, #fbbf24, #4ade80, #60a5fa, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  alive in sound.
                </span>
              </h1>
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <Link
                href="/map"
                className="flex items-center gap-2 px-5 py-2 text-[12px] font-semibold text-white tracking-wide"
                style={{
                  background: "linear-gradient(#080B14,#080B14) padding-box, linear-gradient(135deg, #f87171,#fb923c,#fbbf24,#4ade80,#60a5fa,#c084fc) border-box",
                  border: "1.5px solid transparent",
                  borderRadius: "4px",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                  <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
                </svg>
                Sound Map →
              </Link>
            </div>
          </div>

          {/* Canvas — full width */}
          <div className="relative">
            <div
              className="absolute -inset-4 rounded-2xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 60% 40%, rgba(123,108,255,0.10), transparent 70%)" }}
            />
            <PixelCanvas />
          </div>

          {/* Leaderboard + Recent Recordings nav buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/dashboard?tab=leaderboard"
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.14] transition-colors group"
            >
              <span className="text-xl">🏆</span>
              <div>
                <div className="text-[13px] font-semibold text-white/80 group-hover:text-white transition-colors">Leaderboard</div>
                <div className="text-[11px] text-white/30">Top contributors</div>
              </div>
              <span className="ml-auto text-white/20 group-hover:text-white/40 transition-colors text-sm">→</span>
            </Link>
            <Link
              href="/dashboard?tab=recordings"
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.14] transition-colors group"
            >
              <span className="text-xl">🎵</span>
              <div>
                <div className="text-[13px] font-semibold text-white/80 group-hover:text-white transition-colors">Recent</div>
                <div className="text-[11px] text-white/30">Latest recordings</div>
              </div>
              <span className="ml-auto text-white/20 group-hover:text-white/40 transition-colors text-sm">→</span>
            </Link>
          </div>

          {/* Mobile CTA */}
          <div className="flex sm:hidden items-center gap-4 mt-1">
            <Link
              href="/map"
              className="flex items-center gap-2 px-5 py-2 text-[12px] font-semibold text-white tracking-wide"
              style={{
                background: "linear-gradient(#080B14,#080B14) padding-box, linear-gradient(135deg, #f87171,#fb923c,#fbbf24,#4ade80,#60a5fa,#c084fc) border-box",
                border: "1.5px solid transparent",
                borderRadius: "4px",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
              </svg>
              Sound Map →
            </Link>
          </div>

        </section>
      </main>
    </div>
  );
}
