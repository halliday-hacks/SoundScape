import { Header } from "./header";
import { DashboardClient } from "./DashboardClient";

const Page = async () => {
  return (
    <div className="min-h-screen bg-[#07090E]">
      <div className="mx-auto max-w-5xl px-4 py-4 space-y-5">
        <Header />
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <h1 className="wordmark text-base text-[#DDE4F0]">
              Sound<span className="text-[#93C5FD]">Scape</span>
            </h1>
            <span className="text-xs text-[#5C6A82] tracking-widest uppercase">
              Listen · Visualise · Map
            </span>
          </div>
          <DashboardClient />
        </div>
      </div>
    </div>
  );
};

export default Page;
