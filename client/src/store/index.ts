import type React from 'react'
import { create } from 'zustand'
import type { Agent, Provider, ProviderHealth, TreeNode, WSMessage, LogEntry } from '../types'
import { layoutTree3D, type PositionedNode } from '../lib/tree-layout'
import { computeActiveDepth } from '../lib/active-depth'

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
  visibleDepth: number
  visibleDepthTimer: ReturnType<typeof setTimeout> | null
  missionStartedAt: number

  autoPanEnabled: boolean
  toggleAutoPan: () => void
  orbitControlsRef: React.RefObject<any> | null
  setOrbitControlsRef: (ref: React.RefObject<any>) => void

  setConnected: (connected: boolean) => void
  handleMessage: (message: WSMessage) => void
  selectAgent: (agentId: string | null) => void
  toggleProvider: (provider: Provider) => void
  setAllProviders: () => void
}

const MIN_DISPLAY_MS = 5_000
const DEPTH_RETRACT_DELAY_MS = 5000

function updateVisibleDepth(
  newComputedDepth: number,
  currentVisibleDepth: number,
  currentTimer: ReturnType<typeof setTimeout> | null,
  set: (partial: Partial<AppState>) => void,
): { visibleDepth: number; visibleDepthTimer: ReturnType<typeof setTimeout> | null } {
  const targetDepth = newComputedDepth + 1

  if (targetDepth >= currentVisibleDepth) {
    // Expanding or same: update immediately, cancel any pending retraction
    if (currentTimer) clearTimeout(currentTimer)
    return { visibleDepth: targetDepth, visibleDepthTimer: null }
  }

  // Shrinking: delay the retraction
  if (currentTimer) return { visibleDepth: currentVisibleDepth, visibleDepthTimer: currentTimer }

  const timer = setTimeout(() => {
    set({ visibleDepth: targetDepth, visibleDepthTimer: null })
  }, DEPTH_RETRACT_DELAY_MS)

  return { visibleDepth: currentVisibleDepth, visibleDepthTimer: timer }
}

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
  visibleDepth: 1,
  visibleDepthTimer: null,
  missionStartedAt: Date.now(),
  autoPanEnabled: true,
  toggleAutoPan: () => set((state) => ({ autoPanEnabled: !state.autoPanEnabled })),
  orbitControlsRef: null,
  setOrbitControlsRef: (ref) => set({ orbitControlsRef: ref }),

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
      case 'full_state': {
        const positioned = layoutTree3D(message.tree)
        const incomingAgents = message.agents.map((a) => ({ ...a, firstSeenAt: Date.now() }))
        const depth = computeActiveDepth(incomingAgents, positioned) + 1
        set((state) => {
          if (state.visibleDepthTimer) clearTimeout(state.visibleDepthTimer)
          return {
            agents: incomingAgents,
            tree: message.tree,
            root: message.root,
            positionedNodes: positioned,
            visibleDepth: depth,
            visibleDepthTimer: null,
            providers: message.providers,
          }
        })
        break
      }
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

          const newComputedDepth = computeActiveDepth(newAgents, state.positionedNodes)
          const depthUpdate = updateVisibleDepth(
            newComputedDepth,
            state.visibleDepth,
            state.visibleDepthTimer,
            set,
          )

          return { agents: newAgents, log: newLog, ...depthUpdate }
        })
        break
      case 'agent_remove': {
        const agent = get().agents.find((a) => a.id === message.agentId)
        if (!agent) break

        const doRemove = () => {
          set((state) => {
            const remaining = state.agents.filter((a) => a.id !== message.agentId)
            const newComputedDepth = computeActiveDepth(remaining, state.positionedNodes)
            const depthUpdate = updateVisibleDepth(
              newComputedDepth,
              state.visibleDepth,
              state.visibleDepthTimer,
              set,
            )
            return {
              agents: remaining,
              ...depthUpdate,
              log: [
                ...state.log,
                createLogEntry(
                  message.agentId,
                  agent.provider,
                  'DISCONNECTED',
                  `${agent.name} departed`,
                ),
              ].slice(-500),
            }
          })
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
      case 'tree_update': {
        const newPositioned = layoutTree3D(message.tree)
        const currentAgents = get().agents
        const newDepth = computeActiveDepth(currentAgents, newPositioned) + 1
        set((state) => {
          if (state.visibleDepthTimer) clearTimeout(state.visibleDepthTimer)
          return {
            tree: message.tree,
            root: message.root,
            positionedNodes: newPositioned,
            visibleDepth: newDepth,
            visibleDepthTimer: null,
          }
        })
        break
      }
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
