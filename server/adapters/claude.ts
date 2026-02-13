import { readFileSync } from "node:fs";
import type { AgentStatus, CanonicalEventV2, HookEvent } from "../types";

interface PendingSubagent {
  subagentType: string;
  description: string;
  createdAt: number;
}

const PENDING_SUBAGENT_TTL = 120_000; // 2 minutes

const pendingSubagents = new Map<string, PendingSubagent[]>();

function queuePendingSubagent(sessionId: string, info: PendingSubagent) {
  const queue = pendingSubagents.get(sessionId) ?? [];
  queue.push(info);
  pendingSubagents.set(sessionId, queue);
}

function shiftPendingSubagent(sessionId: string): PendingSubagent | null {
  const queue = pendingSubagents.get(sessionId);
  if (!queue || queue.length === 0) return null;
  const item = queue.shift() ?? null;
  if (queue.length === 0) pendingSubagents.delete(sessionId);
  return item;
}

export function getPendingSubagentCount(): number {
  let count = 0;
  for (const queue of pendingSubagents.values()) {
    count += queue.length;
  }
  return count;
}

export function cleanupStalePendingSubagents(
  now = Date.now(),
  ttl = PENDING_SUBAGENT_TTL
): number {
  let removed = 0;
  for (const [sessionId, queue] of pendingSubagents.entries()) {
    const before = queue.length;
    const fresh = queue.filter((item) => now - item.createdAt < ttl);
    removed += before - fresh.length;
    if (fresh.length === 0) {
      pendingSubagents.delete(sessionId);
    } else {
      pendingSubagents.set(sessionId, fresh);
    }
  }
  return removed;
}

/** Reset state -- only for tests. */
export function resetPendingSubagents(): void {
  pendingSubagents.clear();
}

function toolToStatus(tool?: string): AgentStatus {
  switch (tool) {
    case "Read":
    case "Glob":
    case "Grep":
      return "reading";
    case "Write":
    case "Edit":
      return "writing";
    case "Bash":
      return "executing";
    default:
      return "idle";
  }
}

function extractFilePath(event: HookEvent): string | null {
  const input = event.tool_input;
  if (!input) return null;
  return input.file_path || input.path || null;
}

function extractFileFromTranscript(transcriptPath: string): string | null {
  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (!entry.message?.content || !Array.isArray(entry.message.content)) continue;
        for (const item of entry.message.content) {
          if (item.type !== "tool_use") continue;
          if (item.input?.file_path) return item.input.file_path as string;
          if (item.input?.path) return item.input.path as string;
        }
      } catch {
        // Ignore malformed line.
      }
    }
  } catch {
    // Ignore transcript read errors.
  }
  return null;
}

function baseEvent(event: HookEvent, eventType: CanonicalEventV2["event_type"], agentId: string): CanonicalEventV2 {
  return {
    schema_version: "v2",
    provider: "claude",
    workspace: event.cwd,
    session_id: event.session_id,
    agent_id: agentId,
    event_type: eventType,
    timestamp: event.timestamp ?? Date.now(),
  };
}

export function isLegacyClaudeHookEvent(payload: unknown): payload is HookEvent {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return typeof record.session_id === "string" && typeof record.hook_event_name === "string";
}

export function normalizeClaudeHookEvent(event: HookEvent): CanonicalEventV2[] {
  const events: CanonicalEventV2[] = [];
  const isSubagent = !!event.agent_id && event.agent_id !== event.session_id;
  const agentId = isSubagent ? event.agent_id! : event.session_id;
  const filePath = extractFilePath(event) ?? undefined;

  if (event.hook_event_name === "PreToolUse" && event.tool_name === "Task" && event.tool_input) {
    queuePendingSubagent(event.session_id, {
      subagentType: event.tool_input.subagent_type || "general-purpose",
      description: event.tool_input.description || "Subagent",
      createdAt: event.timestamp ?? Date.now(),
    });
    return [
      {
        ...baseEvent(event, "message", agentId),
        message: `Queued subagent task: ${event.tool_input.description || "Subagent"}`,
      },
    ];
  }

  if (event.hook_event_name === "SubagentStop" && event.agent_id) {
    const pending = shiftPendingSubagent(event.session_id);
    const transcriptFile = event.agent_transcript_path
      ? extractFileFromTranscript(event.agent_transcript_path)
      : null;
    events.push({
      ...baseEvent(event, "agent_registered", event.agent_id),
      message: pending?.description || pending?.subagentType || "Subagent",
      file_path: transcriptFile ?? filePath,
    });
    events.push({
      ...baseEvent(event, "tool_finished", event.agent_id),
      status: "idle",
      file_path: transcriptFile ?? filePath,
    });
    return events;
  }

  if (event.hook_event_name === "PreToolUse") {
    events.push({
      ...baseEvent(event, "tool_started", agentId),
      tool_name: event.tool_name,
      tool_input: (event.tool_input as Record<string, unknown> | undefined) ?? undefined,
      file_path: filePath,
      status: toolToStatus(event.tool_name),
      message: isSubagent ? event.subagent_type || event.agent_type : "Main",
    });
  } else if (event.hook_event_name === "PostToolUse") {
    events.push({
      ...baseEvent(event, "tool_finished", agentId),
      tool_name: event.tool_name,
      tool_input: (event.tool_input as Record<string, unknown> | undefined) ?? undefined,
      file_path: filePath,
      status: "idle",
    });
  } else {
    events.push({
      ...baseEvent(event, "heartbeat", agentId),
      file_path: filePath,
      message: event.hook_event_name,
    });
  }

  return events;
}
