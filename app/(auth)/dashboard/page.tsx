import { api } from "@/convex/_generated/api";
import { Header } from "./header";
import { preloadAuthQuery } from "@/lib/auth-server";
import { ConvexTest } from "./ConvexTest";

const Page = async () => {
  const preloadedUserQuery = await preloadAuthQuery(api.auth.getCurrentUser);

  return (
    <div className="min-h-screen w-full p-4 space-y-8">
      <Header preloadedUserQuery={preloadedUserQuery} />
      <main className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-lg border border-border p-8 text-center space-y-3">
          <h2 className="text-xl font-semibold">SoundSoil — Convex Data Test</h2>
          <p className="text-sm text-muted-foreground">
            Verify Convex is storing and returning data before wiring up real audio classification.
          </p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <ConvexTest />
        </div>
      </main>
    </div>
  );
};

export default Page;
