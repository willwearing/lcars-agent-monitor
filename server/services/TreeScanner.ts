import { readdir } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import type { TreeNode } from "../types";

let cachedTree: TreeNode | null = null;
let cachedRoot: string | null = null;
const PREFERRED_ROOT = resolve(process.env.MONITOR_ROOT || join(process.env.HOME || "/Users/will", "github"));

const IGNORE = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  "coverage",
  ".turbo",
  ".svelte-kit",
]);

const MAX_DEPTH = 3; // Limit tree depth to keep it manageable

async function scanDirectory(
  dirPath: string,
  depth = 0
): Promise<TreeNode> {
  const name = basename(dirPath) || dirPath;
  const node: TreeNode = { id: dirPath, name, type: "folder", children: [] };

  if (depth >= MAX_DEPTH) return node;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE.has(entry.name) || entry.name.startsWith(".")) continue;

      const fullPath = join(dirPath, entry.name);
      // Only include directories, not files
      if (entry.isDirectory()) {
        node.children!.push(await scanDirectory(fullPath, depth + 1));
      }
    }
    // Sort alphabetically
    node.children!.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // Permission denied, etc.
  }

  return node;
}

function normalizeRoot(_path: string): string {
  // Keep visualization anchored to a single workspace root.
  return PREFERRED_ROOT;
}

export async function setRoot(path: string): Promise<TreeNode> {
  const normalizedRoot = normalizeRoot(path);
  if (cachedTree && cachedRoot === normalizedRoot) {
    return cachedTree;
  }
  cachedRoot = normalizedRoot;
  cachedTree = await scanDirectory(normalizedRoot);
  return cachedTree;
}

export function getTree(): TreeNode | null {
  return cachedTree;
}

export function getRoot(): string | null {
  return cachedRoot;
}

export function getPreferredRoot(): string {
  return PREFERRED_ROOT;
}
