import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import type { ServerWebSocket } from "bun";
import { normalizeIncomingPayload } from "./adapters";
import { cleanupStalePendingSubagents } from "./adapters/claude";
import { isIngestAuthorized } from "./services/Auth";
import { RateLimiter } from "./services/RateLimiter";
import { setRoot, getTree, getRoot, getPreferredRoot } from "./services/TreeScanner";
import {
  applyCanonicalEvent,
  cleanupStaleAgents,
  getAgents,
  getProviderHealth,
  recomputeProviderHealth,
} from "./services/SessionTracker";
import type { CanonicalEventV2 } from "./types";

const app = new Hono();

// CORS – restrict to known origins (default: localhost dev servers)
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3001")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  "/api/*",
  cors({
    origin: CORS_ORIGINS,
  })
);

// Rate limiter for event ingestion (60 burst, 20/sec sustained)
const eventLimiter = new RateLimiter({ burst: 60, sustainedPerSec: 20 });

// Store connected WebSocket clients
const clients = new Set<ServerWebSocket<unknown>>();

function broadcast(message: object) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    client.send(data);
  }
}

// Tools that can create/modify files and directories
const FILE_MODIFYING_TOOLS = new Set(["Write", "Edit", "Bash"]);

// Initialize a stable root immediately so UI is always scoped to /github.
await setRoot(getPreferredRoot());

// API Routes
app.post("/api/events", async (c) => {
  try {
    if (!isIngestAuthorized(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Rate limit by IP (or fallback to "unknown")
    const clientIp = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    if (!eventLimiter.allow(clientIp)) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    const payload = await c.req.json();
    const events = normalizeIncomingPayload(payload);
    if (events.length === 0) {
      return c.json({ error: "Unsupported payload format" }, 400);
    }

    for (const event of events) {
      await processCanonicalEvent(event);
    }

    return c.json({ ok: true, accepted: events.length });
  } catch (e) {
    console.error("Error processing event:", e);
    return c.json({ error: "Invalid event" }, 400);
  }
});

app.get("/api/tree", async (c) => {
  const root = c.req.query("root");
  if (root) {
    await setRoot(root);
  }
  return c.json({ tree: getTree(), root: getRoot() });
});

app.get("/api/agents", (c) => {
  return c.json({ agents: getAgents() });
});

app.get("/api/providers", (c) => {
  return c.json({ providers: getProviderHealth() });
});

app.post("/api/set-root", async (c) => {
  const { root } = await c.req.json();
  if (root) {
    await setRoot(root);
    broadcast({ type: "tree_update", tree: getTree(), root: getRoot() });
    return c.json({ ok: true, tree: getTree(), root: getRoot() });
  }
  return c.json({ error: "Missing root" }, 400);
});

// Serve static files in production
app.use("/*", serveStatic({ root: "./client/dist" }));
app.use("/*", serveStatic({ root: "./client/dist", path: "index.html" }));

// Cleanup stale agents and pending subagents periodically
setInterval(() => {
  const removed = cleanupStaleAgents();
  for (const agent of removed) {
    broadcast({ type: "agent_remove", agentId: agent.id });
  }
  for (const provider of recomputeProviderHealth()) {
    broadcast({ type: "provider_update", providerHealth: provider });
  }
  cleanupStalePendingSubagents();
}, 5000);

// Start server with WebSocket support
const server = Bun.serve({
  port: 3001,
  fetch(req, server) {
    const url = new URL(req.url);

    // Handle WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Handle HTTP requests with Hono
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      clients.add(ws);
      // Send current state
      ws.send(
        JSON.stringify({
          type: "full_state",
          agents: getAgents(),
          tree: getTree(),
          root: getRoot(),
          providers: getProviderHealth(),
        })
      );
    },
    message(ws, message) {
      // Handle messages from client (e.g., set root)
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "set_root" && data.root) {
          setRoot(data.root).then(() => {
            broadcast({ type: "tree_update", tree: getTree(), root: getRoot() });
          });
        }
      } catch {
        // Ignore invalid messages
      }
    },
    close(ws) {
      clients.delete(ws);
    },
  },
});

console.log(`Server running at http://localhost:${server.port}`);

async function processCanonicalEvent(event: CanonicalEventV2): Promise<void> {
  // Set root on first event, then keep it stable.
  if (!getRoot()) {
    await setRoot(event.workspace ?? getPreferredRoot());
    broadcast({ type: "tree_update", tree: getTree(), root: getRoot() });
  }

  const updates = applyCanonicalEvent(event);
  for (const update of updates) {
    if (update.type === "agent_update") {
      broadcast({ type: "agent_update", agent: update.agent });
    } else if (update.type === "agent_remove") {
      broadcast({ type: "agent_remove", agentId: update.agentId });
    } else if (update.type === "provider_update") {
      broadcast({ type: "provider_update", providerHealth: update.providerHealth });
    }
  }

  // Rescan tree after file-modifying operations complete.
  if (
    event.event_type === "tool_finished" &&
    FILE_MODIFYING_TOOLS.has(event.tool_name || "") &&
    getRoot()
  ) {
    const oldTree = JSON.stringify(getTree());
    await setRoot(getRoot()!);
    const newTree = JSON.stringify(getTree());
    if (oldTree !== newTree) {
      broadcast({ type: "tree_update", tree: getTree(), root: getRoot() });
    }
  }
}
