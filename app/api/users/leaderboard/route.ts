import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * GET /api/users/leaderboard
 *
 * Returns users ranked by (upload count + total likes received).
 * Query param: limit (default 20, max 50)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "20", 10) || 20, 50);

  try {
    // 1. Get all users from BetterAuth component
    const users = await fetchQuery(api.betterAuth.users.getAllUsers, {});

    // 2. For each user, get their upload stats
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const stats = await fetchQuery(api.uploads.getUserStats, {
          userId: user._id,
        });
        return {
          id: user._id,
          name: user.name,
          username: user.username,
          image: user.image,
          uploadCount: stats.uploadCount,
          totalLikes: stats.totalLikes,
          totalListens: stats.totalListens,
          // Score = uploads + likes (can adjust weighting as needed)
          score: stats.uploadCount + stats.totalLikes,
        };
      })
    );

    // 3. Sort by score descending and take top N
    const leaderboard = usersWithStats
      .filter((u) => u.score > 0) // Only show users with activity
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("[/api/users/leaderboard] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
