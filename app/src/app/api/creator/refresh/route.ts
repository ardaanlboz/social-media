import { readCreatorProfile, writeCreatorProfile } from "@/lib/creator-profile";
import { readCreatorVideos, writeCreatorVideos } from "@/lib/csv";
import { scrapeCreatorStats, scrapeReels } from "@/lib/apify";
import { mergeCreatorVideos } from "@/lib/creator-merge";
import { classifyTopics } from "@/lib/creator-ai";

export const maxDuration = 300;

const REFRESH_MAX_REELS = 100;
const REFRESH_DAYS = 90;

export async function POST() {
  const profile = readCreatorProfile();
  if (!profile) {
    return Response.json({ error: "No creator account set" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ type: "progress", step: "profile", message: `Refreshing @${profile.username} profile stats` });
        try {
          const stats = await scrapeCreatorStats(profile.username);
          profile.profilePicUrl = stats.profilePicUrl;
          profile.followers = stats.followers;
        } catch (err) {
          send({ type: "error", error: `Profile stats failed: ${err instanceof Error ? err.message : err}` });
        }

        send({ type: "progress", step: "reels", message: `Scraping latest reels (last ${REFRESH_DAYS} days)` });
        const reels = await scrapeReels(profile.username, REFRESH_MAX_REELS, REFRESH_DAYS);

        const scraped = reels
          .filter((r) => r.url && r.timestamp)
          .map((r) => ({
            link: r.url,
            videoUrl: r.videoUrl || "",
            thumbnail: r.images?.[0] || "",
            caption: r.caption || "",
            views: r.videoPlayCount || 0,
            likes: r.likesCount || 0,
            comments: r.commentsCount || 0,
            datePosted: r.timestamp?.split("T")[0] || "",
          }));

        // Save reels before topic classification so an AI failure never loses scraped data
        const today = new Date().toISOString().slice(0, 10);
        const { videos, added, updated } = mergeCreatorVideos(readCreatorVideos(), scraped, today);
        writeCreatorVideos(videos);
        profile.lastRefreshedAt = new Date().toISOString();
        writeCreatorProfile(profile);
        send({ type: "progress", step: "saving", message: `${added} new videos, ${updated} updated` });

        const untopiced = videos.filter((v) => !v.topic && v.caption);
        if (untopiced.length > 0) {
          send({ type: "progress", step: "topics", message: `Classifying topics for ${untopiced.length} videos` });
          try {
            const existingTopics = [...new Set(videos.map((v) => v.topic).filter(Boolean))];
            const assignments = await classifyTopics(
              untopiced.map((v) => ({ id: v.id, caption: v.caption.slice(0, 500) })),
              existingTopics
            );
            if (assignments.size === 0) {
              send({ type: "error", error: "Topic classification returned no assignments — topics will retry on next refresh" });
            }
            for (const v of videos) {
              const topic = assignments.get(v.id);
              if (topic) v.topic = topic;
            }
            writeCreatorVideos(videos);
          } catch (err) {
            send({ type: "error", error: `Topic classification failed: ${err instanceof Error ? err.message : err}` });
          }
        }

        send({ type: "complete", added, updated });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Unknown error" });
        send({ type: "complete", added: 0, updated: 0 });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
