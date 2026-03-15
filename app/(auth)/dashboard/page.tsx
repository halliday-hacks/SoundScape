import { Header } from "./header";
import { PixelCanvas } from "@/components/pixel-canvas";

const Page = async () => {
  return (
    <div className="min-h-screen bg-[#06080F]">
      <div className="mx-auto max-w-5xl px-4 py-4 space-y-5">
        <Header />
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <h1
              className="text-sm font-bold text-[#E2E8F0]"
              style={{ fontFamily: "var(--font-syne, sans-serif)", letterSpacing: "-0.01em" }}
            >
              Sound<span className="text-[#22D3EE]">Scape</span>
            </h1>
            <span className="text-xs text-[#64748B] tracking-widest uppercase">
              Listen · Visualise · Map
            </span>
          </div>
          <PixelCanvas />
        </div>
      </div>
    </div>
  );
};

export default Page;
