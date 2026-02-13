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
const DEBUG_LOG = "/tmp/lcars-hook-debug.log";
const MONITOR_KEY = process.env.MONITOR_INGEST_KEY || "";

async function main() {
  try {
    // Read JSON from stdin
    const input = await Bun.stdin.text();
    if (!input.trim()) return;

    const data = JSON.parse(input);

    // Debug: log raw hook data to file using appendFile for reliability
    const fs = await import("fs/promises");
    await fs.appendFile(DEBUG_LOG, `${new Date().toISOString()} - ${JSON.stringify(data)}\n`);

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
    // Log errors to debug file
    await Bun.write(DEBUG_LOG, `${new Date().toISOString()} - ERROR: ${err}\n`, { append: true });
  }
}

main();
