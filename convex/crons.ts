import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Every 60 seconds: find all uploads where elasticSynced is false
 * and schedule a syncUpload action for each one.
 *
 * This acts as both:
 *  - A retry mechanism (if Elastic was down when the upload was created)
 *  - A force-refresh trigger (reset elasticSynced: false on a doc to re-queue it)
 */
crons.interval(
  "sync-unsynced-uploads-to-elastic",
  { seconds: 60 },
  internal.elastic.sweepUnsynced
);

export default crons;
