import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="text-lg font-semibold tracking-tight">
          Hackathon Starter
        </span>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Ship faster with a solid foundation
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            A production-ready starter with authentication, real-time data, and
            everything you need to build your next project.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
            <span>Next.js 16</span>
            <span className="text-border">|</span>
            <span>Convex</span>
            <span className="text-border">|</span>
            <span>Better Auth</span>
            <span className="text-border">|</span>
            <span>Tailwind v4</span>
          </div>
        </div>
      </main>
    </div>
  );
}
