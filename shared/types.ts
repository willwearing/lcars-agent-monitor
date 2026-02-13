/**
 * Shared types used by both server and client.
 * Single source of truth -- do not duplicate these definitions.
 */

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
  stoppingAt?: number;
}

export interface TreeNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: TreeNode[];
}

export interface ProviderHealth {
  provider: Provider;
  status: "healthy" | "degraded" | "offline";
  lastEventAt: number | null;
  totalEvents: number;
  droppedEvents: number;
}
