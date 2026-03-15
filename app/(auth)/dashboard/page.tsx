import { Header } from "./header";
import { DashboardClient } from "./DashboardClient";

const Page = async () => {
  return (
    <div className="min-h-screen bg-[#050f1f]">
      <div className="mx-auto max-w-5xl px-4 py-4 space-y-5">
        <Header />
        <DashboardClient />
      </div>
    </div>
  );
};

export default Page;
