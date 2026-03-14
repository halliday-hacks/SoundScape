import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * GET /api/users/:username
 *
 * Returns profile data for a user:
 * - User info (name, avatar, username)
 * - Their uploads
 * - Total likes received across all uploads
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 }
    );
  }

  try {
    // 1. Get user by username
    const user = await fetchQuery(api.betterAuth.users.getByUsername, {
      username,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Get their uploads
    const uploads = await fetchQuery(api.uploads.getByUserId, {
      userId: user._id,
      limit: 50,
    });

    // 3. Get their stats
    const stats = await fetchQuery(api.uploads.getUserStats, {
      userId: user._id,
    });

    return NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username ?? user.displayUsername,
        image: user.image,
        createdAt: user.createdAt,
      },
      stats: {
        uploadCount: stats.uploadCount,
        totalLikes: stats.totalLikes,
        totalListens: stats.totalListens,
      },
      uploads: uploads.map((u) => ({
        id: u._id,
        title: u.title,
        description: u.description,
        storageId: u.storageId,
        lat: u.lat,
        lon: u.lon,
        locationLabel: u.locationLabel,
        dominantClass: u.dominantClass,
        tags: u.tags,
        likeCount: u.likeCount,
        listenCount: u.listenCount,
        durationSeconds: u.durationSeconds,
        createdAt: u._creationTime,
      })),
    });
  } catch (err) {
    console.error(`[/api/users/${username}] Error:`, err);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}
