// Re-export shared types
export type {
  Provider,
  AgentStatus,
  TreeNode,
  ProviderHealth,
} from "../../shared/types";

// Client extends the shared Agent with UI-only fields
import type { Agent as SharedAgent, Provider, TreeNode, ProviderHealth } from "../../shared/types";

export interface Agent extends SharedAgent {
  // Client-only: minimum display time tracking
  firstSeenAt?: number;
  departingAt?: number;
}

// LCARS-specific extensions
export type LCARSAgentStatus = "idle" | "reading" | "writing" | "executing";

export interface LogEntry {
  id: string;
  agentId: string;
  provider: Provider | "system";
  timestamp: number;
  type: "READING" | "WRITING" | "EXECUTING" | "IDLE" | "CONNECTED" | "DISCONNECTED";
  message: string;
}

// WebSocket message types (match server protocol)
export type WSMessage =
  | { type: "full_state"; agents: Agent[]; tree: TreeNode | null; root: string | null; providers: ProviderHealth[] }
  | { type: "agent_update"; agent: Agent }
  | { type: "agent_remove"; agentId: string }
  | { type: "tree_update"; tree: TreeNode; root: string }
  | { type: "provider_update"; providerHealth: ProviderHealth };
