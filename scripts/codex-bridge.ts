#!/usr/bin/env bun

/**
 * Codex JSON bridge:
 * Reads JSONL from stdin (e.g. `codex exec --json ...`) and forwards canonical v2 events.
 */
import { isAbsolute, resolve } from "node:path";

type AgentStatus = "idle" | "reading" | "writing" | "executing";
type EventType =
  | "session_started"
  | "session_finished"
  | "agent_registered"
  | "agent_status_changed"
  | "tool_started"
  | "tool_finished"
  | "message"
  | "heartbeat"
  | "error";

interface CanonicalEventV2 {
  schema_version: "v2";
  provider: "codex";
  provider_user?: string;
  workspace?: string;
  session_id: string;
  agent_id: string;
  event_type: EventType;
  timestamp: number;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  file_path?: string;
  status?: AgentStatus;
  message?: string;
  raw?: unknown;
}

const MONITOR_URL = process.env.MONITOR_URL || "http://localhost:3001/api/events";
const MONITOR_KEY = process.env.MONITOR_INGEST_KEY || "";
const DEFAULT_WORKSPACE = process.env.MONITOR_WORKSPACE || process.cwd();

interface BridgeState {
  sessionId: string;
  workspace: string;
}

function get(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

function parseTimestamp(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function toolToStatus(tool?: string): AgentStatus {
  const name = (tool || "").toLowerCase();
  if (name.includes("read") || name.includes("grep") || name.includes("glob")) return "reading";
  if (name.includes("write") || name.includes("edit") || name.includes("patch")) return "writing";
  if (name.includes("bash") || name.includes("shell") || name.includes("command")) return "executing";
  return "executing";
}

function unwrapShellCommand(command: string): string {
  const shellWrapped = command.match(/-lc\s+['"]([\s\S]+)['"]$/);
  if (shellWrapped?.[1]) return shellWrapped[1];
  return command;
}

function tokenize(command: string): string[] {
  const matches = command.match(/"[^"]*"|'[^']*'|\S+/g);
  if (!matches) return [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ""));
}

function firstPathArg(tokens: string[], startIndex = 1): string | undefined {
  for (let i = startIndex; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || token.startsWith("-")) continue;
    return token;
  }
  return undefined;
}

function inferFilePathFromCommand(command?: string): string | undefined {
  if (!command) return undefined;
  const tokens = tokenize(unwrapShellCommand(command));
  const cmd = tokens[0];
  if (!cmd) return undefined;

  if (["cat", "nl", "bat", "head", "tail", "less", "more"].includes(cmd)) {
    return firstPathArg(tokens, 1);
  }

  if (cmd === "sed") {
    let i = 1;
    while (i < tokens.length && tokens[i].startsWith("-")) i += 1;
    i += 1; // skip sed script expression
    return firstPathArg(tokens, i);
  }

  return undefined;
}

function absolutePath(path: string | undefined, workspace: string): string | undefined {
  if (!path) return undefined;
  return isAbsolute(path) ? path : resolve(workspace, path);
}

function resolveSessionId(raw: Record<string, unknown>, state: BridgeState): string {
  const explicitSession = String(
    raw.session_id ||
      raw.thread_id ||
      get(raw, "thread.id") ||
      get(raw, "turn.thread_id") ||
      process.env.CODEX_SESSION_ID ||
      "",
  );

  if (explicitSession) {
    state.sessionId = explicitSession;
    return explicitSession;
  }
  return state.sessionId;
}

function resolveWorkspace(raw: Record<string, unknown>, state: BridgeState): string {
  const explicitWorkspace = String(raw.cwd || raw.workspace || process.env.MONITOR_WORKSPACE || "");
  if (explicitWorkspace) {
    state.workspace = explicitWorkspace;
    return explicitWorkspace;
  }
  return state.workspace;
}

function toCanonical(raw: Record<string, unknown>, state: BridgeState): CanonicalEventV2 {
  const rawType = String(raw.type || "");
  const sessionId = resolveSessionId(raw, state);
  const workspace = resolveWorkspace(raw, state);
  const agentId = String(raw.agent_id || raw.turn_id || get(raw, "turn.id") || sessionId) || sessionId;
  const toolName =
    ((raw.tool_name as string | undefined) ??
      ((get(raw, "item.type") as string | undefined) === "command_execution" ? "Bash" : undefined)) ||
    (get(raw, "item.name") as string | undefined) ||
    (get(raw, "item.tool_name") as string | undefined) ||
    (get(raw, "item.type") as string | undefined);

  const command =
    (raw.command as string | undefined) || (get(raw, "item.command") as string | undefined);
  const filePath = absolutePath(
    [
    get(raw, "file_path"),
    get(raw, "path"),
    get(raw, "item.input.file_path"),
    get(raw, "item.input.path"),
    get(raw, "item.path"),
      inferFilePathFromCommand(command),
    ].find((value) => typeof value === "string") as string | undefined,
    workspace,
  );

  let eventType: EventType = "heartbeat";
  let status: AgentStatus | undefined;
  if (rawType.includes("thread") && (rawType.includes("start") || rawType.includes("create"))) {
    eventType = "session_started";
  } else if (rawType.includes("thread") && (rawType.includes("finish") || rawType.includes("complete"))) {
    eventType = "session_finished";
  } else if (rawType.includes("item") && rawType.includes("start")) {
    eventType = "tool_started";
    status = toolToStatus(toolName);
  } else if (
    rawType.includes("item") &&
    (rawType.includes("finish") || rawType.includes("complete")) &&
    (get(raw, "item.type") as string | undefined) === "command_execution"
  ) {
    eventType = "tool_finished";
    status = "idle";
  } else if (rawType.includes("item") && (rawType.includes("finish") || rawType.includes("complete"))) {
    eventType = "message";
  } else if (rawType.includes("error")) {
    eventType = "error";
  } else if (rawType.includes("message") || rawType.includes("delta")) {
    eventType = "message";
  }

  return {
    schema_version: "v2",
    provider: "codex",
    provider_user: process.env.MONITOR_PROVIDER_USER || process.env.USER,
    workspace,
    session_id: sessionId,
    agent_id: agentId,
    event_type: eventType,
    timestamp: parseTimestamp(raw.timestamp),
    tool_name: toolName,
    tool_input: (get(raw, "item.input") as Record<string, unknown> | undefined) || undefined,
    file_path: filePath,
    status,
    message: (raw.message as string | undefined) || (get(raw, "item.summary") as string | undefined),
    raw,
  };
}

async function postEvent(event: CanonicalEventV2): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (MONITOR_KEY) headers["x-monitor-key"] = MONITOR_KEY;
  await fetch(MONITOR_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
  });
}

async function main() {
  const input = await Bun.stdin.text();
  if (!input.trim()) return;
  const state: BridgeState = {
    sessionId: process.env.CODEX_SESSION_ID || "codex-session",
    workspace: DEFAULT_WORKSPACE,
  };
  const lines = input.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const canonical = toCanonical(parsed, state);
      await postEvent(canonical);
    } catch {
      // Ignore malformed lines to keep stream processing resilient.
    }
  }
}

await main();
