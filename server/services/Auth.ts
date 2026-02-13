import type { Context } from "hono";

export function isIngestAuthorized(c: Context): boolean {
  const requiredKey = process.env.MONITOR_INGEST_KEY;
  if (!requiredKey) return true;
  const provided = c.req.header("x-monitor-key");
  return provided === requiredKey;
}
