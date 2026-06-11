import { v4 as uuid } from "uuid";
import { readConfigs, readCreators, readVideos, writeVideos } from "./csv";
import { scrapeReels } from "./apify";
import { uploadVideo, analyzeVideo } from "./gemini";
import { generateNewConcepts } from "./claude";
import { readMasterChecklist } from "./checklist";
import { readNexusFramework } from "./framework";
import { verifyConcepts, reviseConcepts } from "./verifier";
import type { PipelineParams, PipelineProgress, Video, ActiveTask, ChecklistResult, ChecklistVerdict } from "./types";

const VIDEO_CONCURRENCY = 3;

interface ScrapedVideo {
  videoUrl: string;
  postUrl: string;
  views: number;
  likes: number;
  comments: number;
  username: string;
  thumbnail: string;
  datePosted: string;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

export async function runPipeline(
  params: PipelineParams,
  onProgress: (progress: PipelineProgress) => void
): Promise<void> {
  const progress: PipelineProgress = {
    status: "running",
    phase: "scraping",
    activeTasks: [],
    creatorsCompleted: 0,
    creatorsTotal: 0,
    creatorsScraped: 0,
    videosAnalyzed: 0,
    videosTotal: 0,
    errors: [],
    log: [],
  };

  const emit = () => {
    onProgress({ ...progress, activeTasks: [...progress.activeTasks], log: [...progress.log], errors: [...progress.errors] });
  };

  const log = (msg: string) => {
    progress.log.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    emit();
  };

  const addTask = (task: ActiveTask) => {
    progress.activeTasks.push(task);
    emit();
  };

  const updateTask = (id: string, step: string) => {
    const t = progress.activeTasks.find((t) => t.id === id);
    if (t) { t.step = step; emit(); }
  };

  const removeTask = (id: string) => {
    progress.activeTasks = progress.activeTasks.filter((t) => t.id !== id);
    emit();
  };

  try {
    // Load config
    const configs = readConfigs();
    const config = configs.find((c) => c.configName === params.configName);
    if (!config) throw new Error(`Config "${params.configName}" not found`);

    log(`Loaded config: ${config.configName}`);

    const masterChecklist = readMasterChecklist();
    if (masterChecklist) log("Master scripting checklist loaded — verification enabled");

    const nexusFramework = readNexusFramework();
    if (nexusFramework) log("Nexus framework loaded — writing rules enabled");

    let analysisInstruction = config.analysisInstruction;
    if (masterChecklist) {
      analysisInstruction += `

# CHECKLIST EVALUATION
After the sections above, add a "# CHECKLIST" section: for each item of the master scripting checklist below, state in one line whether this reference video satisfies it and how.
------
${masterChecklist}
------`;
    }
    if (nexusFramework) {
      analysisInstruction += `

# NEXUS FRAMEWORK (CONTEXT)
Where relevant, use the vocabulary and concepts of this framework (hooks, interest peak, value trinity, CTA types, sandwich storytelling) when describing the reference video.
------
${nexusFramework}
------`;
    }

    // Load creators
    const allCreators = readCreators();
    const creators = allCreators.filter((c) => c.category === config.creatorsCategory);
    if (creators.length === 0) throw new Error(`No creators found for category "${config.creatorsCategory}"`);

    progress.creatorsTotal = creators.length;
    log(`Found ${creators.length} creators — scraping all in parallel`);
    emit();

    // Phase 1: Scrape all creators in parallel
    progress.phase = "scraping";
    const cutoffDate = new Date(Date.now() - params.nDays * 24 * 60 * 60 * 1000);
    const allTopVideos: ScrapedVideo[] = [];

    const scrapeResults = await Promise.allSettled(
      creators.map(async (creator) => {
        const taskId = `scrape-${creator.username}`;
        addTask({ id: taskId, creator: creator.username, step: "Scraping reels" });

        const reels = await scrapeReels(creator.username, params.maxVideos, params.nDays);
        updateTask(taskId, `Found ${reels.length} reels`);

        const videos = reels
          .filter((r) => r.videoUrl && r.timestamp)
          .map((r) => ({
            videoUrl: r.videoUrl,
            postUrl: r.url,
            views: r.videoPlayCount || 0,
            likes: r.likesCount || 0,
            comments: r.commentsCount || 0,
            username: r.ownerUsername || creator.username,
            thumbnail: r.images?.[0] || "",
            datePosted: r.timestamp?.split("T")[0] || "",
            timestamp: new Date(r.timestamp),
          }))
          .filter((v) => v.timestamp >= cutoffDate);

        videos.sort((a, b) => b.views - a.views);
        const topVideos = videos.slice(0, params.topK);

        updateTask(taskId, `Top ${topVideos.length} selected`);
        log(`@${creator.username}: ${reels.length} reels → top ${topVideos.length} selected`);

        removeTask(taskId);
        progress.creatorsScraped++;
        emit();

        return { creator: creator.username, videos: topVideos };
      })
    );

    for (const result of scrapeResults) {
      if (result.status === "fulfilled") {
        for (const v of result.value.videos) {
          allTopVideos.push(v);
        }
        progress.creatorsCompleted++;
      } else {
        const msg = `Scraping error: ${result.reason instanceof Error ? result.reason.message : result.reason}`;
        progress.errors.push(msg);
        log(msg);
        progress.creatorsCompleted++;
      }
    }

    progress.videosTotal = allTopVideos.length;
    log(`Scraping done. ${allTopVideos.length} videos to analyze (${VIDEO_CONCURRENCY} workers)`);
    emit();

    // Phase 2: Process videos concurrently
    progress.phase = "analyzing";
    emit();

    const newVideos: Video[] = [];

    await runWithConcurrency(allTopVideos, VIDEO_CONCURRENCY, async (video) => {
      const taskId = `video-${uuid().slice(0, 8)}`;
      const label = `${video.views.toLocaleString()} views`;

      try {
        addTask({ id: taskId, creator: video.username, step: "Downloading", views: video.views });

        const videoResponse = await fetch(video.videoUrl);
        if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        const contentType = videoResponse.headers.get("content-type") || "video/mp4";

        updateTask(taskId, "Uploading to Gemini");
        log(`@${video.username} (${label}): uploading to Gemini`);

        const fileData = await uploadVideo(videoBuffer, contentType);

        updateTask(taskId, "Gemini analyzing");
        log(`@${video.username} (${label}): Gemini analyzing`);

        const analysis = await analyzeVideo(
          fileData.uri,
          fileData.mimeType,
          analysisInstruction
        );

        updateTask(taskId, "Claude generating concepts");
        log(`@${video.username} (${label}): Claude generating concepts`);

        let newConcepts = await generateNewConcepts(analysis, config.newConceptsInstruction, masterChecklist, nexusFramework);

        let checklistResult = "";
        if (masterChecklist) {
          let verdict: ChecklistVerdict | null = null;
          let rounds = 0;
          try {
            updateTask(taskId, "Verifying against checklist");
            log(`@${video.username} (${label}): verifying against checklist`);
            verdict = await verifyConcepts(newConcepts, masterChecklist);

            while (!verdict.allPass && rounds < 2) {
              rounds++;
              updateTask(taskId, `Revising concepts (round ${rounds})`);
              log(`@${video.username} (${label}): revising concepts (round ${rounds})`);
              newConcepts = await reviseConcepts(
                newConcepts,
                verdict,
                analysis,
                config.newConceptsInstruction,
                masterChecklist,
                nexusFramework
              );
              updateTask(taskId, "Re-verifying");
              verdict = await verifyConcepts(newConcepts, masterChecklist);
            }
          } catch (err) {
            // A grading failure must never lose a video — keep the last verdict (if any) and move on.
            log(`@${video.username} (${label}): checklist step failed (${err instanceof Error ? err.message : err})`);
          }
          if (verdict) {
            const result: ChecklistResult = { verdict, revisionRounds: rounds };
            checklistResult = JSON.stringify(result);
            log(
              `@${video.username} (${label}): checklist ${verdict.allPass ? "passed" : "NOT fully passed"} after ${rounds} revision round(s)`
            );
          }
        }

        const videoRecord: Video = {
          id: uuid(),
          link: video.postUrl,
          thumbnail: video.thumbnail,
          creator: video.username,
          views: video.views,
          likes: video.likes,
          comments: video.comments,
          analysis,
          newConcepts,
          datePosted: video.datePosted,
          dateAdded: new Date().toISOString().slice(0, 10),
          configName: params.configName,
          starred: false,
          checklistResult,
        };

        newVideos.push(videoRecord);
        progress.videosAnalyzed++;
        removeTask(taskId);
        log(`@${video.username} (${label}): done`);
        emit();
      } catch (err) {
        removeTask(taskId);
        const msg = `@${video.username} (${label}): ${err instanceof Error ? err.message : err}`;
        progress.errors.push(msg);
        log(`Error — ${msg}`);
        emit();
      }
    });

    // Write all new videos at once
    if (newVideos.length > 0) {
      const existing = readVideos();
      writeVideos([...existing, ...newVideos]);
    }

    progress.phase = "done";
    progress.status = "completed";
    log(`Pipeline complete! ${progress.videosAnalyzed}/${progress.videosTotal} videos analyzed, ${progress.errors.length} errors.`);
    emit();
  } catch (err) {
    progress.status = "error";
    const msg = `Pipeline error: ${err instanceof Error ? err.message : err}`;
    progress.errors.push(msg);
    log(msg);
    emit();
  }
}
