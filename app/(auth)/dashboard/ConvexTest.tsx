"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function ConvexTest() {
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [sessionId] = useState("test-session-001");
  const [log, setLog] = useState<string[]>([]);

  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const createUpload = useMutation(api.uploads.create);
  const createEvent = useMutation(api.classificationEvents.create);
  const incrementListenCount = useMutation(api.uploads.incrementListenCount);

  const recentUploads = useQuery(api.uploads.getRecent, { limit: 5 });
  const sessionEvents = useQuery(api.classificationEvents.getBySession, {
    sessionId,
    limit: 10,
  });

  const addLog = (msg: string) =>
    setLog((prev) => [`[${new Date().toISOString()}] ${msg}`, ...prev]);

  const handleSeedData = async () => {
    try {
      // Create an upload
      // storageId is required — generate a real upload URL first for production use
      const uploadUrl = await generateUploadUrl();
      const dummyBlob = new Blob(["test"], { type: "audio/wav" });
      const uploadRes = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: dummyBlob });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { storageId } = await uploadRes.json();

      const id = await createUpload({
        userId: "test-user-001",
        storageId,
        title: "Fitzroy Gardens Dawn Chorus",
        description: "Beautiful birdsong recorded at dawn in Fitzroy Gardens",
        locationLabel: "Fitzroy Gardens, Melbourne",
        lat: -37.8136,
        lon: 144.9794,
        biodiversityScore: 82,
        dominantClass: "birds",
        durationSeconds: 180,
        tags: ["birdsong", "melbourne", "dawn"],
      });
      setUploadId(id);
      addLog(`Created upload: ${id}`);

      // Simulate a few classification events
      const events = [
        { birds: 0.82, insects: 0.05, rain: 0.03, traffic: 0.08, music: 0.0, construction: 0.0, silence: 0.02, dominantClass: "birds", confidence: 0.82, biodiversityScore: 74, speciesCommon: "Laughing Kookaburra", species: "Dacelo novaeguineae" },
        { birds: 0.71, insects: 0.12, rain: 0.10, traffic: 0.04, music: 0.0, construction: 0.0, silence: 0.03, dominantClass: "birds", confidence: 0.71, biodiversityScore: 68, speciesCommon: "Australian Magpie", species: "Gymnorhina tibicen" },
        { birds: 0.15, insects: 0.05, rain: 0.06, traffic: 0.72, music: 0.0, construction: 0.0, silence: 0.02, dominantClass: "traffic", confidence: 0.72, biodiversityScore: 22 },
      ];

      for (const evt of events) {
        const evtId = await createEvent({
          sessionId,
          userId: "test-user-001",
          timestamp: Date.now(),
          lat: -37.8136,
          lon: 144.9794,
          ...evt,
        });
        addLog(`Created classification event: ${evtId} (${evt.dominantClass})`);
      }

      // Increment listen count on the upload
      await incrementListenCount({ uploadId: id });
      addLog(`Incremented listen count on ${id}`);

      addLog("Seed complete — check query results below");
    } catch (err) {
      addLog(`Error: ${String(err)}`);
    }
  };

  return (
    <div className="space-y-6 text-sm font-mono">
      <div className="flex items-center gap-3">
        <button
          onClick={handleSeedData}
          className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600 transition-colors"
        >
          Seed test data
        </button>
        <span className="text-muted-foreground">
          session: <code>{sessionId}</code>
        </span>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-black/80 text-green-400 rounded p-4 space-y-1 max-h-48 overflow-y-auto">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Recent uploads */}
      <div>
        <h3 className="font-semibold text-base mb-2">Recent Uploads ({recentUploads?.length ?? "…"})</h3>
        <div className="space-y-2">
          {recentUploads?.map((u) => (
            <div key={u._id} className="border border-border rounded p-3 space-y-1">
              <div className="font-medium">{u.title}</div>
              <div className="text-muted-foreground text-xs">
                {u.locationLabel} · bio score: {u.biodiversityScore ?? "—"} · {u.dominantClass} · 👂 {u.listenCount} · ❤️ {u.likeCount}
              </div>
              {uploadId === u._id && (
                <div className="text-xs text-yellow-500">← just created</div>
              )}
            </div>
          ))}
          {recentUploads?.length === 0 && (
            <div className="text-muted-foreground">No uploads yet — seed some data</div>
          )}
        </div>
      </div>

      {/* Session events */}
      <div>
        <h3 className="font-semibold text-base mb-2">
          Classification Events for <code>{sessionId}</code> ({sessionEvents?.length ?? "…"})
        </h3>
        <div className="space-y-2">
          {sessionEvents?.map((e) => (
            <div key={e._id} className="border border-border rounded p-3 space-y-1">
              <div>
                <span className="font-medium">{e.dominantClass}</span>
                {e.speciesCommon && <span className="text-muted-foreground"> · {e.speciesCommon}</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                confidence: {(e.confidence * 100).toFixed(0)}% · bio: {e.biodiversityScore} · birds: {((e.birds ?? 0) * 100).toFixed(0)}% traffic: {((e.traffic ?? 0) * 100).toFixed(0)}%
              </div>
            </div>
          ))}
          {sessionEvents?.length === 0 && (
            <div className="text-muted-foreground">No events yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
