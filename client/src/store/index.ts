import { create } from 'zustand'
import type { Agent, Provider, ProviderHealth, TreeNode, WSMessage, LogEntry } from '../types'
import { layoutTree3D, type PositionedNode } from '../lib/tree-layout'

let logIdCounter = 0

function createLogEntry(agentId: string, provider: LogEntry['provider'], type: LogEntry['type'], message: string): LogEntry {
  return {
    id: `log-${++logIdCounter}`,
    agentId,
    provider,
    timestamp: Date.now(),
    type,
    message,
  }
}

interface AppState {
  agents: Agent[]
  providers: ProviderHealth[]
  selectedProviders: Provider[]
  tree: TreeNode | null
  root: string | null
  positionedNodes: PositionedNode[]
  connected: boolean
  selectedAgentId: string | null
  log: LogEntry[]
  missionStartedAt: number

  setConnected: (connected: boolean) => void
  handleMessage: (message: WSMessage) => void
  selectAgent: (agentId: string | null) => void
  toggleProvider: (provider: Provider) => void
  setAllProviders: () => void
}

const MIN_DISPLAY_MS = 3000

export const useStore = create<AppState>((set, get) => ({
  agents: [],
  providers: [],
  selectedProviders: ['claude', 'codex'],
  tree: null,
  root: null,
  positionedNodes: [],
  connected: false,
  selectedAgentId: null,
  log: [],
  missionStartedAt: Date.now(),

  setConnected: (connected) =>
    set((state) => {
      const newLogs = [...state.log]
      if (connected) {
        newLogs.push(createLogEntry('system', 'system', 'CONNECTED', 'SUBSPACE LINK ESTABLISHED'))
      } else {
        newLogs.push(createLogEntry('system', 'system', 'DISCONNECTED', 'SUBSPACE LINK LOST'))
      }
      return { connected, log: newLogs.slice(-500) }
    }),

  handleMessage: (message) => {
    switch (message.type) {
      case 'full_state':
        set({
          agents: message.agents.map((a) => ({ ...a, firstSeenAt: Date.now() })),
          tree: message.tree,
          root: message.root,
          positionedNodes: layoutTree3D(message.tree),
          providers: message.providers,
        })
        break
      case 'agent_update':
        set((state) => {
          const existing = state.agents.find((a) => a.id === message.agent.id)
          const agentWithMeta = {
            ...message.agent,
            firstSeenAt: existing?.firstSeenAt ?? Date.now(),
            departingAt: existing?.departingAt,
          }
          const newAgents = existing
            ? state.agents.map((a) => (a.id === message.agent.id ? agentWithMeta : a))
            : [...state.agents, agentWithMeta]

          // Generate log entry from real agent activity
          const agent = message.agent
          let logType: LogEntry['type'] = 'IDLE'
          let logMsg = `${agent.name} standing by`
          if (agent.status === 'reading') {
            logType = 'READING'
            logMsg = `${agent.name} scanning ${agent.currentFile || 'unknown sector'}`
          } else if (agent.status === 'writing') {
            logType = 'WRITING'
            logMsg = `${agent.name} writing to ${agent.currentFile || 'unknown target'}`
          } else if (agent.status === 'executing') {
            logType = 'EXECUTING'
            logMsg = `${agent.name} executing command`
          }

          const newLog = [...state.log, createLogEntry(agent.id, agent.provider, logType, logMsg)].slice(-500)

          return { agents: newAgents, log: newLog }
        })
        break
      case 'agent_remove': {
        const agent = get().agents.find((a) => a.id === message.agentId)
        if (!agent) break

        const doRemove = () => {
          set((state) => ({
            agents: state.agents.filter((a) => a.id !== message.agentId),
            log: [
              ...state.log,
              createLogEntry(
                message.agentId,
                agent.provider,
                'DISCONNECTED',
                `${agent.name} departed`,
              ),
            ].slice(-500),
          }))
        }

        const elapsed = Date.now() - (agent.firstSeenAt ?? 0)
        const remaining = MIN_DISPLAY_MS - elapsed

        if (remaining > 0) {
          // Mark as departing now, actually remove after minimum display time
          set((state) => ({
            agents: state.agents.map((a) =>
              a.id === message.agentId ? { ...a, departingAt: Date.now() } : a,
            ),
          }))
          setTimeout(doRemove, remaining)
        } else {
          doRemove()
        }
        break
      }
      case 'tree_update':
        set({ tree: message.tree, root: message.root, positionedNodes: layoutTree3D(message.tree) })
        break
      case 'provider_update':
        set((state) => {
          const exists = state.providers.some((p) => p.provider === message.providerHealth.provider)
          return {
            providers: exists
              ? state.providers.map((p) =>
                  p.provider === message.providerHealth.provider ? message.providerHealth : p,
                )
              : [...state.providers, message.providerHealth],
          }
        })
        break
    }
  },

  selectAgent: (agentId) => set({ selectedAgentId: agentId }),
  toggleProvider: (provider) =>
    set((state) => {
      const active = state.selectedProviders.includes(provider)
      const selectedProviders = active
        ? state.selectedProviders.filter((p) => p !== provider)
        : [...state.selectedProviders, provider]
      return { selectedProviders: selectedProviders.length ? selectedProviders : [provider] }
    }),
  setAllProviders: () => set({ selectedProviders: ['claude', 'codex'] }),
}))
