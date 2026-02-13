// Re-export shared types
export type {
  Provider,
  AgentStatus,
  Agent,
  TreeNode,
  ProviderHealth,
} from "../shared/types";

// Server-only types below

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
  provider: import("../shared/types").Provider;
  provider_user?: string;
  workspace?: string;
  session_id: string;
  agent_id: string;
  event_type: CanonicalEventType;
  timestamp: number;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  file_path?: string;
  status?: import("../shared/types").AgentStatus;
  message?: string;
  raw?: unknown;
}
