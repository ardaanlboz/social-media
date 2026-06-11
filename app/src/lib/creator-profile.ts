import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { CreatorProfile } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const PROFILE_PATH = path.join(DATA_DIR, "creator-profile.json");

export function readCreatorProfile(): CreatorProfile | null {
  if (!existsSync(PROFILE_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(PROFILE_PATH, "utf-8"));
    if (!raw?.username) return null;
    return {
      username: raw.username,
      profilePicUrl: raw.profilePicUrl || "",
      followers: raw.followers || 0,
      lastRefreshedAt: raw.lastRefreshedAt || "",
      accountInsights: raw.accountInsights || "",
    };
  } catch {
    return null;
  }
}

export function writeCreatorProfile(profile: CreatorProfile): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), "utf-8");
}
