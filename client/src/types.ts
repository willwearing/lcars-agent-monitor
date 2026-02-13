// These match the server types in server/types.ts

export type Provider = 'claude' | 'codex'

export interface Agent {
  id: string
  provider: Provider
  sessionId: string
  stableSessionId: string
  stableAgentId: string
  type: 'main' | 'subagent'
  name: string
  currentFile: string | null
  status: 'idle' | 'reading' | 'writing' | 'executing'
  lastActivity: number
  workspace?: string
  providerUser?: string
  // Client-only: minimum display time tracking
  firstSeenAt?: number
  departingAt?: number
}

export interface TreeNode {
  id: string
  name: string
  type: 'file' | 'folder'
  children?: TreeNode[]
}

// LCARS-specific extensions
export type LCARSAgentStatus = 'idle' | 'reading' | 'writing' | 'executing'

export interface LogEntry {
  id: string
  agentId: string
  provider: Provider | 'system'
  timestamp: number
  type: 'READING' | 'WRITING' | 'EXECUTING' | 'IDLE' | 'CONNECTED' | 'DISCONNECTED'
  message: string
}

export interface ProviderHealth {
  provider: Provider
  status: 'healthy' | 'degraded' | 'offline'
  lastEventAt: number | null
  totalEvents: number
  droppedEvents: number
}

// WebSocket message types (match server protocol)
export type WSMessage =
  | { type: 'full_state'; agents: Agent[]; tree: TreeNode | null; root: string | null; providers: ProviderHealth[] }
  | { type: 'agent_update'; agent: Agent }
  | { type: 'agent_remove'; agentId: string }
  | { type: 'tree_update'; tree: TreeNode; root: string }
  | { type: 'provider_update'; providerHealth: ProviderHealth }
