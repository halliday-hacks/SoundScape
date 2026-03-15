import { Header } from "./header";
import { DashboardClient } from "./DashboardClient";

const Page = async () => {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-4 space-y-5">
        <Header />
        <div className="space-y-1">
          <DashboardClient />
        </div>
      </div>
    </div>
  );
};

export default Page;
