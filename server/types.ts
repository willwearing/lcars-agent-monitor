export type Provider = "claude" | "codex";
export type AgentStatus = "idle" | "reading" | "writing" | "executing";

export interface Agent {
  id: string;
  provider: Provider;
  sessionId: string;
  stableSessionId: string;
  stableAgentId: string;
  type: "main" | "subagent";
  name: string;
  currentFile: string | null;
  status: AgentStatus;
  lastActivity: number;
  workspace?: string;
  providerUser?: string;
  stoppingAt?: number; // When subagent stopped (for delayed removal)
}

export interface TreeNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: TreeNode[];
}

export interface HookEvent {
  session_id: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    command?: string;
    pattern?: string;
    path?: string;
    // Task tool inputs
    subagent_type?: string;
    description?: string;
    prompt?: string;
  };
  agent_id?: string;
  agent_type?: string;
  subagent_type?: string;
  agent_transcript_path?: string; // Path to subagent transcript (from SubagentStop)
  cwd: string;
  timestamp?: number;
}

export type CanonicalEventType =
  | "session_started"
  | "session_finished"
  | "agent_registered"
  | "agent_status_changed"
  | "tool_started"
  | "tool_finished"
  | "message"
  | "heartbeat"
  | "error";

export interface CanonicalEventV2 {
  schema_version: "v2";
  provider: Provider;
  provider_user?: string;
  workspace?: string;
  session_id: string;
  agent_id: string;
  event_type: CanonicalEventType;
  timestamp: number;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  file_path?: string;
  status?: AgentStatus;
  message?: string;
  raw?: unknown;
}

export interface ProviderHealth {
  provider: Provider;
  status: "healthy" | "degraded" | "offline";
  lastEventAt: number | null;
  totalEvents: number;
  droppedEvents: number;
}
