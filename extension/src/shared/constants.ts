import type { Platform } from "./types";

export const PLATFORM_HOSTS: Record<Platform, string[]> = {
  leetcode: ["leetcode.com"],
  gfg: ["geeksforgeeks.org"],
  hackerrank: ["hackerrank.com"]
};

export function detectPlatform(platform: Platform): Platform {
  return platform;
}
