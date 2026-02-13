import { describe, it, expect, beforeEach } from "vitest";
import {
  getPendingSubagentCount,
  cleanupStalePendingSubagents,
  resetPendingSubagents,
  normalizeClaudeHookEvent,
} from "../adapters/claude";
import type { HookEvent } from "../types";

function makeTaskEvent(sessionId: string, timestamp: number): HookEvent {
  return {
    session_id: sessionId,
    hook_event_name: "PreToolUse",
    tool_name: "Task",
    tool_input: { subagent_type: "test", description: "test subagent" },
    cwd: "/tmp",
    timestamp,
  };
}

describe("pendingSubagents cleanup", () => {
  beforeEach(() => {
    resetPendingSubagents();
  });

  it("tracks pending subagent count", () => {
    expect(getPendingSubagentCount()).toBe(0);
    normalizeClaudeHookEvent(makeTaskEvent("sess1", 1000));
    expect(getPendingSubagentCount()).toBe(1);
    normalizeClaudeHookEvent(makeTaskEvent("sess1", 2000));
    expect(getPendingSubagentCount()).toBe(2);
  });

  it("cleans up entries older than the threshold", () => {
    normalizeClaudeHookEvent(makeTaskEvent("sess1", 1000));
    normalizeClaudeHookEvent(makeTaskEvent("sess2", 5000));

    // With a 2-second threshold, only the entry at t=1000 should be stale at t=4000
    const removed = cleanupStalePendingSubagents(4000, 2000);
    expect(removed).toBe(1);
    expect(getPendingSubagentCount()).toBe(1);
  });

  it("removes entire session key when all entries are stale", () => {
    normalizeClaudeHookEvent(makeTaskEvent("sess1", 1000));
    normalizeClaudeHookEvent(makeTaskEvent("sess1", 2000));

    const removed = cleanupStalePendingSubagents(100000, 2000);
    expect(removed).toBe(2);
    expect(getPendingSubagentCount()).toBe(0);
  });

  it("does not remove fresh entries", () => {
    normalizeClaudeHookEvent(makeTaskEvent("sess1", 5000));
    const removed = cleanupStalePendingSubagents(5500, 2000);
    expect(removed).toBe(0);
    expect(getPendingSubagentCount()).toBe(1);
  });
});
