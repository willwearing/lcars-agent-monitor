import type { CanonicalEventV2 } from "../types";
import { isLegacyClaudeHookEvent, normalizeClaudeHookEvent } from "./claude";

function isCanonicalEvent(payload: unknown): payload is CanonicalEventV2 {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return (
    record.schema_version === "v2" &&
    (record.provider === "claude" || record.provider === "codex") &&
    typeof record.session_id === "string" &&
    typeof record.agent_id === "string" &&
    typeof record.event_type === "string" &&
    typeof record.timestamp === "number"
  );
}

export function normalizeIncomingPayload(payload: unknown): CanonicalEventV2[] {
  if (isCanonicalEvent(payload)) return [payload];
  if (Array.isArray(payload)) return payload.filter(isCanonicalEvent);
  if (isLegacyClaudeHookEvent(payload)) return normalizeClaudeHookEvent(payload);
  return [];
}
