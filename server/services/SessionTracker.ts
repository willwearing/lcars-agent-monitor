import type { Agent, CanonicalEventV2, Provider, ProviderHealth } from "../types";

const AGENT_TIMEOUT = 30_000;
const SUBAGENT_LINGER_TIME = 30_000;

type TrackerUpdate =
  | { type: "agent_update"; agent: Agent }
  | { type: "agent_remove"; agentId: string }
  | { type: "provider_update"; providerHealth: ProviderHealth };

const agents = new Map<string, Agent>();
const providerHealth = new Map<Provider, ProviderHealth>();

function getOrCreateProviderHealth(provider: Provider): ProviderHealth {
  let health = providerHealth.get(provider);
  if (!health) {
    health = {
      provider,
      status: "healthy",
      lastEventAt: null,
      totalEvents: 0,
      droppedEvents: 0,
    };
    providerHealth.set(provider, health);
  }
  return health;
}

function getAgentStatus(event: CanonicalEventV2): Agent["status"] {
  if (event.status) return event.status;
  if (event.event_type === "tool_finished") return "idle";
  if (event.event_type === "tool_started") {
    const tool = event.tool_name || "";
    if (tool === "Read" || tool === "Glob" || tool === "Grep") return "reading";
    if (tool === "Write" || tool === "Edit") return "writing";
    if (tool === "Bash") return "executing";
  }
  return "idle";
}

function stableSessionId(event: CanonicalEventV2): string {
  return `${event.provider}:${event.provider_user ?? "local"}:${event.workspace ?? "unknown"}:${event.session_id}`;
}

function stableAgentId(event: CanonicalEventV2): string {
  return `${stableSessionId(event)}:${event.agent_id}`;
}

function isSubagent(event: CanonicalEventV2): boolean {
  return event.agent_id !== event.session_id;
}

function getAgentName(event: CanonicalEventV2): string {
  if (!isSubagent(event)) return "Main";
  if (event.message && event.message.trim()) return event.message;
  return "Subagent";
}

function markProviderEvent(event: CanonicalEventV2): ProviderHealth {
  const health = getOrCreateProviderHealth(event.provider);
  health.lastEventAt = event.timestamp;
  health.totalEvents += 1;
  health.status = "healthy";
  return { ...health };
}

export function applyCanonicalEvent(event: CanonicalEventV2): TrackerUpdate[] {
  const updates: TrackerUpdate[] = [];
  const health = markProviderEvent(event);
  updates.push({ type: "provider_update", providerHealth: health });

  if (event.event_type === "session_finished") {
    const sid = stableSessionId(event);
    for (const [id, agent] of agents.entries()) {
      if (agent.stableSessionId === sid) {
        agents.delete(id);
        updates.push({ type: "agent_remove", agentId: id });
      }
    }
    return updates;
  }

  if (event.event_type === "session_started" || event.event_type === "heartbeat") {
    return updates;
  }

  const sSession = stableSessionId(event);
  const sAgent = stableAgentId(event);
  const type: Agent["type"] = isSubagent(event) ? "subagent" : "main";

  let agent = agents.get(sAgent);
  if (!agent) {
    agent = {
      id: sAgent,
      provider: event.provider,
      sessionId: event.session_id,
      stableSessionId: sSession,
      stableAgentId: sAgent,
      type,
      name: getAgentName(event),
      currentFile: event.file_path ?? null,
      status: getAgentStatus(event),
      lastActivity: event.timestamp,
      workspace: event.workspace,
      providerUser: event.provider_user,
    };
    agents.set(sAgent, agent);
    updates.push({ type: "agent_update", agent: { ...agent } });
    return updates;
  }

  if (event.message && event.event_type === "agent_registered" && agent.name === "Subagent") {
    agent.name = event.message;
  }
  if (event.file_path) {
    agent.currentFile = event.file_path;
  }
  if (
    event.event_type === "agent_registered" ||
    event.event_type === "agent_status_changed" ||
    event.event_type === "tool_started" ||
    event.event_type === "tool_finished"
  ) {
    agent.status = getAgentStatus(event);
  }
  agent.lastActivity = event.timestamp;
  agent.workspace = event.workspace ?? agent.workspace;
  agent.providerUser = event.provider_user ?? agent.providerUser;

  // Subagents can linger briefly after they finish.
  if (agent.type === "subagent" && event.event_type === "tool_finished" && agent.status === "idle") {
    agent.stoppingAt = event.timestamp;
  } else {
    agent.stoppingAt = undefined;
  }

  updates.push({ type: "agent_update", agent: { ...agent } });
  return updates;
}

export function getAgents(): Agent[] {
  return Array.from(agents.values());
}

export function getProviderHealth(): ProviderHealth[] {
  return Array.from(providerHealth.values());
}

export function cleanupStaleAgents(now = Date.now()): Agent[] {
  const removed: Agent[] = [];
  for (const [id, agent] of agents.entries()) {
    if (now - agent.lastActivity > AGENT_TIMEOUT) {
      agents.delete(id);
      removed.push(agent);
      continue;
    }
    if (agent.stoppingAt && now - agent.stoppingAt > SUBAGENT_LINGER_TIME) {
      agents.delete(id);
      removed.push(agent);
    }
  }
  return removed;
}

export function recomputeProviderHealth(now = Date.now()): ProviderHealth[] {
  for (const health of providerHealth.values()) {
    if (!health.lastEventAt) {
      health.status = "offline";
      continue;
    }
    const elapsed = now - health.lastEventAt;
    if (elapsed > 30_000) health.status = "offline";
    else if (elapsed > 10_000) health.status = "degraded";
    else health.status = "healthy";
  }
  return getProviderHealth();
}
