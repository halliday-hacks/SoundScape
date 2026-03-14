import { api } from "@/convex/_generated/api";
import { Header } from "./header";
import { preloadAuthQuery } from "@/lib/auth-server";

const Page = async () => {
  const preloadedUserQuery = await preloadAuthQuery(api.auth.getCurrentUser);

  return (
    <div className="min-h-screen w-full p-4 space-y-8">
      <Header preloadedUserQuery={preloadedUserQuery} />
      <main className="max-w-2xl mx-auto">
        <div className="rounded-lg border border-border p-8 text-center space-y-3">
          <h2 className="text-xl font-semibold">Welcome to your dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Start building your app from here.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Page;
