import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Clean up seed data:
 * 1. Delete duplicate uploads with title 'Fitzroy Gardens Dawn Chorus' that lack a storageId
 * 2. Update uploads where dominantClass === 'bird' to 'birds'
 */
export const cleanData = mutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    updatedCount: v.number(),
  }),
  handler: async (ctx) => {
    let deletedCount = 0;
    let updatedCount = 0;

    // 1. Delete duplicate/seed uploads with title 'Fitzroy Gardens Dawn Chorus' without storageId
    const allUploads = await ctx.db.query("uploads").collect();

    const fitzroyUploads = allUploads.filter(
      (upload) =>
        upload.title === "Fitzroy Gardens Dawn Chorus" &&
        !upload.storageId
    );

    for (const upload of fitzroyUploads) {
      await ctx.db.delete(upload._id);
      deletedCount++;
    }

    // 2. Update uploads where dominantClass === 'bird' to 'birds'
    const birdUploads = allUploads.filter(
      (upload) => upload.dominantClass === "bird" && upload.storageId // Only modify remaining valid uploads
    );

    for (const upload of birdUploads) {
      await ctx.db.patch(upload._id, {
        dominantClass: "birds",
      });
      updatedCount++;
    }

    return {
      deletedCount,
      updatedCount,
    };
  },
});
