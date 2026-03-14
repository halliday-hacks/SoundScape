import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * GET /api/uploads/recent
 *
 * Returns the most recent uploads globally, newest first.
 * Query param: limit (default 20, max 50)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "20", 10) || 20, 50);

  try {
    const uploads = await fetchQuery(api.uploads.getRecent, { limit });

    return NextResponse.json({
      uploads: uploads.map((u) => ({
        id: u._id,
        userId: u.userId,
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
        biodiversityScore: u.biodiversityScore,
        createdAt: u._creationTime,
      })),
    });
  } catch (err) {
    console.error("[/api/uploads/recent] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch recent uploads" },
      { status: 500 }
    );
  }
}
