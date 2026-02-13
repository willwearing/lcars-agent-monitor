import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

const API_URL = "http://localhost:3001";
const PROJECT_ROOT = resolve(import.meta.dirname, "..");

// Helper: send a hook event to the server (simulates Claude Code activity)
async function sendHookEvent(event: object) {
  const response = await fetch(`${API_URL}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  return response.json();
}

test.describe("LCARS Agent Monitor", () => {
  test("loads the app and shows bridge banner with LCARS elements", async ({ page }) => {
    await page.goto("/");

    // Bridge banner should render with connection status
    // When WebSocket connects, it shows "LINKED"
    await expect(page.getByText("LINKED")).toBeVisible({ timeout: 10000 });

    // Stardate should be visible (format: "SD XXXXX.X")
    await expect(page.getByText(/SD \d+\.\d/)).toBeVisible();

    // LCARS header sweep elements should be present
    await expect(page.locator(".lcars-header")).toBeVisible();
  });

  test("shows initial UI state before hook events", async ({ page }) => {
    await page.goto("/");

    // The bridge banner always renders
    await expect(page.getByText("LINKED")).toBeVisible({ timeout: 10000 });

    // The LCARS header structure is always present
    await expect(page.locator(".lcars-header-sweep-left")).toBeVisible();
    await expect(page.locator(".lcars-header-sweep-right")).toBeVisible();

    // Elapsed time counter should be visible (format: "HH:MM:SS")
    await expect(page.getByText(/\d{2}:\d{2}:\d{2}/)).toBeVisible();
  });

  test("shows agent status chips after receiving hook events", async ({ page }) => {
    await page.goto("/");

    // Wait for WebSocket to connect
    await expect(page.getByText("LINKED")).toBeVisible({ timeout: 10000 });

    // Send a PreToolUse Read event (agent starts reading a file)
    await sendHookEvent({
      session_id: "test-session-chips",
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: {
        file_path: `${PROJECT_ROOT}/client/src/App.tsx`,
      },
      cwd: PROJECT_ROOT,
    });

    // Agent chip for "SCANNING" (reading) should appear
    await expect(page.getByText("SCANNING")).toBeVisible({ timeout: 5000 });
  });

  test("renders 3D canvas after tree data is sent", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("LINKED")).toBeVisible({ timeout: 10000 });

    // Send an event with cwd to trigger tree scanning
    await sendHookEvent({
      session_id: "test-session-canvas",
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: {
        file_path: `${PROJECT_ROOT}/package.json`,
      },
      cwd: PROJECT_ROOT,
    });

    // The 3D scene container should appear (has data-testid="scene3d")
    await expect(page.locator('[data-testid="scene3d"]')).toBeVisible({ timeout: 10000 });

    // Canvas element should exist inside the scene
    await expect(page.locator('[data-testid="scene3d"] canvas')).toBeVisible();
  });

  test("shows multiple agent status types simultaneously", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("LINKED")).toBeVisible({ timeout: 10000 });

    // Send reading agent
    await sendHookEvent({
      session_id: "test-multi-read",
      hook_event_name: "PreToolUse",
      tool_name: "Read",
      tool_input: { file_path: `${PROJECT_ROOT}/server/index.ts` },
      cwd: PROJECT_ROOT,
    });

    // Send writing agent
    await sendHookEvent({
      session_id: "test-multi-write",
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: `${PROJECT_ROOT}/client/src/test.ts` },
      cwd: PROJECT_ROOT,
    });

    // Send executing agent
    await sendHookEvent({
      session_id: "test-multi-exec",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "bun test" },
      cwd: PROJECT_ROOT,
    });

    // All three status chips should appear
    await expect(page.getByText("SCANNING")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("WRITING")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("EXECUTING")).toBeVisible({ timeout: 5000 });
  });
});
