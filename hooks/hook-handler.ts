#!/usr/bin/env bun

/**
 * Claude Code Hook Handler
 *
 * Receives hook events from Claude Code via stdin and posts them
 * to the LCARS visualization server.
 *
 * Install by running: bun hooks/install.sh
 */

const SERVER_URL = process.env.VISUALIZER_URL || "http://localhost:3001";
const MONITOR_KEY = process.env.MONITOR_INGEST_KEY || "";
const DEBUG = process.env.LCARS_DEBUG === "1";
const DEBUG_LOG = "/tmp/lcars-hook-debug.log";

async function debugLog(msg: string) {
  if (!DEBUG) return;
  const fs = await import("fs/promises");
  await fs.appendFile(DEBUG_LOG, `${new Date().toISOString()} - ${msg}\n`);
}

async function main() {
  try {
    // Read JSON from stdin
    const input = await Bun.stdin.text();
    if (!input.trim()) return;

    const data = JSON.parse(input);
    await debugLog(JSON.stringify(data));

    // POST to visualization server
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (MONITOR_KEY) headers["x-monitor-key"] = MONITOR_KEY;
    await fetch(`${SERVER_URL}/api/events`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...data,
        timestamp: Date.now(),
      }),
    });
  } catch (err) {
    await debugLog(`ERROR: ${err}`);
  }
}

main();
