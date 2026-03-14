import { Header } from "./header";
import { PixelCanvas } from "@/components/pixel-canvas";

const Page = async () => {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-4 space-y-5">
        <Header />
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <h1 className="text-sm font-semibold tracking-wide text-neutral-200">SoundSoil</h1>
            <span className="text-xs text-neutral-500 italic">Listen to the Earth. Watch it Grow.</span>
          </div>
          <PixelCanvas />
        </div>
      </div>
    </div>
  );
};

export default Page;
