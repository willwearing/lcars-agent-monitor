# Progressive Tree Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Only render tree nodes down to the deepest level where agents are currently active, progressively revealing deeper layers as work moves deeper into the tree.

**Architecture:** Compute the "active depth" from agent positions (the maximum depth of any node an agent is working in). Filter `positionedNodes` in the store to only include nodes at depth <= activeDepth. The tree layout itself stays unchanged -- we just gate which nodes and edges get rendered. Default to depth 1 when no agents are active (show root + top-level directories). Animate nodes appearing when a new depth level is revealed.

**Tech Stack:** TypeScript, React, Zustand, Three.js (via @react-three/fiber), Vitest

---

### Task 1: Add `computeActiveDepth` utility function

**Files:**
- Create: `/Users/will/github/lcars-agent-monitor/client/src/lib/active-depth.ts`
- Test: `/Users/will/github/lcars-agent-monitor/client/src/__tests__/active-depth.test.ts`

This function determines the deepest tree level agents are working at. It takes a list of agents and positioned nodes, finds which node each active agent maps to, and returns the max depth across all of them. Defaults to 1 when no agents are active (show root + top-level dirs).

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { computeActiveDepth } from '../lib/active-depth'
import type { PositionedNode } from '../lib/tree-layout'

const nodes: PositionedNode[] = [
  { id: '/root', name: 'root', position: [0, 0, 0], parentId: null, depth: 0, childCount: 2 },
  { id: '/root/src', name: 'src', position: [5, 0, 0], parentId: '/root', depth: 1, childCount: 1 },
  { id: '/root/tests', name: 'tests', position: [-5, 0, 0], parentId: '/root', depth: 1, childCount: 0 },
  { id: '/root/src/components', name: 'components', position: [8, -2, 0], parentId: '/root/src', depth: 2, childCount: 1 },
  { id: '/root/src/components/App.tsx', name: 'App.tsx', position: [10, -4, 0], parentId: '/root/src/components', depth: 3, childCount: 0 },
]

interface MinimalAgent {
  id: string
  currentFile: string | null
  status: string
}

describe('computeActiveDepth', () => {
  it('returns 1 when no agents are active', () => {
    const agents: MinimalAgent[] = []
    expect(computeActiveDepth(agents, nodes)).toBe(1)
  })

  it('returns 1 when all agents are idle', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: '/root/src/components/App.tsx', status: 'idle' },
    ]
    expect(computeActiveDepth(agents, nodes)).toBe(1)
  })

  it('returns depth of the node an active agent is working in', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: '/root/src/components', status: 'reading' },
    ]
    expect(computeActiveDepth(agents, nodes)).toBe(2)
  })

  it('returns max depth across multiple active agents', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: '/root/src', status: 'reading' },
      { id: 'a2', currentFile: '/root/src/components/App.tsx', status: 'writing' },
    ]
    expect(computeActiveDepth(agents, nodes)).toBe(3)
  })

  it('walks up file path to find nearest ancestor node', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: '/root/src/components/deep/nested/file.ts', status: 'writing' },
    ]
    // Nearest ancestor in nodes is /root/src/components at depth 2
    expect(computeActiveDepth(agents, nodes)).toBe(2)
  })

  it('ignores agents with no currentFile', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: null, status: 'executing' },
    ]
    expect(computeActiveDepth(agents, nodes)).toBe(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/will/github/lcars-agent-monitor && bunx vitest run client/src/__tests__/active-depth.test.ts`
Expected: FAIL with "Cannot find module '../lib/active-depth'"

**Step 3: Write minimal implementation**

```typescript
import type { PositionedNode } from './tree-layout'

interface AgentLike {
  currentFile: string | null
  status: string
}

/**
 * Compute the deepest tree depth any active agent is working at.
 * Returns 1 (root + top-level dirs) when no agents are active.
 */
export function computeActiveDepth(
  agents: AgentLike[],
  nodes: PositionedNode[],
): number {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  let maxDepth = 1

  for (const agent of agents) {
    if (agent.status === 'idle' || !agent.currentFile) continue

    let path = agent.currentFile
    while (path) {
      const node = nodeMap.get(path)
      if (node) {
        if (node.depth > maxDepth) maxDepth = node.depth
        break
      }
      const lastSlash = path.lastIndexOf('/')
      if (lastSlash <= 0) break
      path = path.substring(0, lastSlash)
    }
  }

  return maxDepth
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/will/github/lcars-agent-monitor && bunx vitest run client/src/__tests__/active-depth.test.ts`
Expected: PASS (6 tests)

**Step 5: Ask me for feedback before commit**

**Step 6: Commit**

```bash
git add client/src/lib/active-depth.ts client/src/__tests__/active-depth.test.ts
git commit -m "feat: add computeActiveDepth utility for progressive tree rendering"
```

---

### Task 2: Add `visibleDepth` to Zustand store

**Files:**
- Modify: `/Users/will/github/lcars-agent-monitor/client/src/store/index.ts`

The store needs a `visibleDepth` field that updates whenever agents change. It should be derived from `computeActiveDepth`. We also add a `+1` buffer so the user sees one level ahead of where agents currently are (the immediate children of active nodes).

**Step 1: Add the import and state field**

In `/Users/will/github/lcars-agent-monitor/client/src/store/index.ts`, add:

```typescript
// At top, add import:
import { computeActiveDepth } from '../lib/active-depth'

// In the AppState interface, add:
visibleDepth: number

// In the create() initial state, add:
visibleDepth: 1,
```

**Step 2: Recompute `visibleDepth` on agent updates**

In the `agent_update` case of `handleMessage`, after computing `newAgents`, add the depth recomputation:

```typescript
const newVisibleDepth = computeActiveDepth(newAgents, state.positionedNodes) + 1
```

Return `visibleDepth: newVisibleDepth` alongside `agents: newAgents` and `log: newLog`.

**Step 3: Recompute on `agent_remove`**

In the `doRemove` function inside the `agent_remove` case, after filtering agents:

```typescript
const remaining = state.agents.filter((a) => a.id !== message.agentId)
const newVisibleDepth = computeActiveDepth(remaining, state.positionedNodes) + 1
```

Return `visibleDepth: newVisibleDepth` alongside the filtered agents.

**Step 4: Recompute on `full_state`**

In the `full_state` case, after computing `positionedNodes`:

```typescript
const positioned = layoutTree3D(message.tree)
const depth = computeActiveDepth(
  message.agents.map((a) => ({ ...a, firstSeenAt: Date.now() })),
  positioned,
) + 1
```

Return `visibleDepth: depth` alongside other fields.

**Step 5: Run existing tests to verify nothing broke**

Run: `cd /Users/will/github/lcars-agent-monitor && bunx vitest run`
Expected: All existing tests PASS

**Step 6: Ask me for feedback before commit**

**Step 7: Commit**

```bash
git add client/src/store/index.ts
git commit -m "feat: add visibleDepth to store, recompute on agent changes"
```

---

### Task 3: Filter nodes by `visibleDepth` in TreeGraph3D

**Files:**
- Modify: `/Users/will/github/lcars-agent-monitor/client/src/components/Scene3D/TreeGraph3D.tsx`

This is the core rendering change. Instead of rendering all `positionedNodes`, filter to only those with `depth <= visibleDepth`. Edges are already derived from `nodeData`, so they'll automatically follow.

**Step 1: Read `visibleDepth` from the store**

At the top of the `TreeGraph3D` component (around line 181-183), add:

```typescript
const visibleDepth = useStore((s) => s.visibleDepth)
```

**Step 2: Filter `positionedNodes` before computing `nodeData`**

After line 186 (the `nodeMap` memo), add a filtered nodes memo:

```typescript
const filteredNodes = useMemo(() => {
  return positionedNodes.filter((n) => n.depth <= visibleDepth)
}, [positionedNodes, visibleDepth])
```

**Step 3: Replace `positionedNodes` with `filteredNodes` in `nodeData` computation**

In the `nodeData` useMemo (around line 211), change:

```typescript
// Before:
const depth1Nodes = positionedNodes.filter((n) => n.depth === 1)
// ...
return positionedNodes.map((node): NodeRenderData => {
```

To:

```typescript
// After:
const depth1Nodes = filteredNodes.filter((n) => n.depth === 1)
// ...
return filteredNodes.map((node): NodeRenderData => {
```

Update the dependency array from `[positionedNodes, nodeMap]` to `[filteredNodes, nodeMap]`.

**Step 4: Update `edgeLines` dependency**

The `edgeLines` memo references `nodeMap` which is built from ALL `positionedNodes`. This is fine -- the edge building iterates `nodeData` (already filtered) and looks up parents in `nodeDataMap` (also filtered). If a parent is outside the visible depth, the edge simply won't be drawn. No changes needed here since `nodeData` is already filtered.

**Step 5: Verify visually**

Run: `cd /Users/will/github/lcars-agent-monitor && bun run dev`

1. Open `http://localhost:5174`
2. With no agents active, you should see only root + depth-1 nodes
3. Start a Claude Code session -- as the agent works in deeper directories, deeper tree levels should appear

**Step 6: Ask me for feedback before commit**

**Step 7: Commit**

```bash
git add client/src/components/Scene3D/TreeGraph3D.tsx
git commit -m "feat: filter tree nodes by visibleDepth for progressive rendering"
```

---

### Task 4: Animate new depth levels appearing

**Files:**
- Modify: `/Users/will/github/lcars-agent-monitor/client/src/components/Scene3D/TreeGraph3D.tsx`

When `visibleDepth` increases and new nodes appear, they should fade/scale in rather than popping in abruptly. Track which nodes are "new" and animate their ring scale from 0 to 1 over ~0.5 seconds.

**Step 1: Track previous visible node IDs**

Add a ref to track which nodes were visible last frame:

```typescript
const previousVisibleIdsRef = useRef<Set<string>>(new Set())
const nodeAppearTimeRef = useRef<Map<string, number>>(new Map())
```

**Step 2: Detect newly appearing nodes**

In a `useEffect` that runs when `nodeData` changes, compare current IDs against previous:

```typescript
useEffect(() => {
  const currentIds = new Set(nodeData.map((n) => n.id))
  const prevIds = previousVisibleIdsRef.current
  const now = performance.now() / 1000

  for (const id of currentIds) {
    if (!prevIds.has(id) && !nodeAppearTimeRef.current.has(id)) {
      nodeAppearTimeRef.current.set(id, now)
    }
  }

  // Clean up entries for nodes no longer visible
  for (const id of nodeAppearTimeRef.current.keys()) {
    if (!currentIds.has(id)) nodeAppearTimeRef.current.delete(id)
  }

  previousVisibleIdsRef.current = currentIds
}, [nodeData])
```

**Step 3: Apply scale animation in useFrame**

In the existing `useFrame` callback, after the active-node animation block, add:

```typescript
// Animate newly appearing nodes (scale from 0 to 1)
const APPEAR_DURATION = 0.5
const now = clock.getElapsedTime()
let needsUpdate = false

for (let i = 0; i < nodeData.length; i++) {
  const node = nodeData[i]
  const appearTime = nodeAppearTimeRef.current.get(node.id)
  if (appearTime === undefined) continue
  if (activeNodeIds.has(node.id)) continue // active nodes have their own animation

  const elapsed = now - appearTime
  if (elapsed >= APPEAR_DURATION) {
    nodeAppearTimeRef.current.delete(node.id)
    continue
  }

  const progress = elapsed / APPEAR_DURATION
  const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
  const scale = node.size * eased

  _dummy.position.set(node.position[0], node.position[1], node.position[2])
  _dummy.rotation.set(0, 0, 0)
  _dummy.scale.setScalar(scale)
  _dummy.updateMatrix()

  const mesh = ringRef.current
  if (mesh) {
    mesh.setMatrixAt(i, _dummy.matrix)
    needsUpdate = true
  }
}

if (needsUpdate && ringRef.current) {
  ringRef.current.instanceMatrix.needsUpdate = true
}
```

**Step 4: Use `performance.now()` aligned time for appear tracking**

The `nodeAppearTimeRef` should use `clock.getElapsedTime()` from the first `useFrame` call rather than `performance.now()`, since that's what the animation loop uses. Update the `useEffect` to instead set a sentinel value (e.g., `-1`) and have `useFrame` assign the real time on first encounter:

```typescript
// In useEffect, when detecting new nodes:
nodeAppearTimeRef.current.set(id, -1) // sentinel: "hasn't been assigned a real time yet"

// In useFrame, before the animation loop:
for (const [id, t] of nodeAppearTimeRef.current) {
  if (t === -1) nodeAppearTimeRef.current.set(id, clock.getElapsedTime())
}
```

**Step 5: Verify visually**

Run: `cd /Users/will/github/lcars-agent-monitor && bun run dev`

Trigger a depth change by starting/stopping agent activity. New nodes should scale up smoothly rather than appearing instantly.

**Step 6: Ask me for feedback before commit**

**Step 7: Commit**

```bash
git add client/src/components/Scene3D/TreeGraph3D.tsx
git commit -m "feat: animate new tree nodes scaling in when depth increases"
```

---

### Task 5: Handle depth decrease (nodes fading out)

**Files:**
- Modify: `/Users/will/github/lcars-agent-monitor/client/src/store/index.ts`
- Modify: `/Users/will/github/lcars-agent-monitor/client/src/components/Scene3D/TreeGraph3D.tsx`

When agents stop working at a deep level, the visible depth should retract. But not instantly -- add a delay so the tree doesn't flicker when agents briefly pause between tasks.

**Step 1: Add depth retraction delay to the store**

In `/Users/will/github/lcars-agent-monitor/client/src/store/index.ts`, change the depth computation to never decrease immediately. Use a "high-water mark with decay" approach:

```typescript
// In AppState interface, add:
visibleDepthTimer: ReturnType<typeof setTimeout> | null

// In initial state:
visibleDepthTimer: null,
```

**Step 2: Create a helper function for delayed depth updates**

Add this outside the store `create()`:

```typescript
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
```

**Step 3: Use the helper in agent_update, agent_remove, and full_state**

Replace the direct `visibleDepth` assignments from Task 2 with calls to `updateVisibleDepth`. For example in `agent_update`:

```typescript
const newComputedDepth = computeActiveDepth(newAgents, state.positionedNodes)
const depthUpdate = updateVisibleDepth(
  newComputedDepth,
  state.visibleDepth,
  state.visibleDepthTimer,
  set,
)
return { agents: newAgents, log: newLog, ...depthUpdate }
```

For `full_state`, always set immediately (no delay on initial load):

```typescript
const depth = computeActiveDepth(incomingAgents, positioned) + 1
return { ..., visibleDepth: depth, visibleDepthTimer: null }
```

**Step 4: Run all tests**

Run: `cd /Users/will/github/lcars-agent-monitor && bunx vitest run`
Expected: All tests PASS

**Step 5: Verify visually**

Run: `cd /Users/will/github/lcars-agent-monitor && bun run dev`

1. Start an agent working deep in the tree -- depth expands instantly
2. Stop the agent -- tree stays expanded for 5 seconds, then gently retracts
3. Start the agent again quickly -- tree stays expanded (timer cancelled)

**Step 6: Ask me for feedback before commit**

**Step 7: Commit**

```bash
git add client/src/store/index.ts client/src/components/Scene3D/TreeGraph3D.tsx
git commit -m "feat: delay depth retraction by 5s to prevent flickering"
```

---

### Task 6: Add tests for the store depth integration

**Files:**
- Create: `/Users/will/github/lcars-agent-monitor/client/src/__tests__/visible-depth-store.test.ts`

Test that the store correctly computes and updates `visibleDepth` in response to agent updates.

**Step 1: Write the integration tests**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { computeActiveDepth } from '../lib/active-depth'
import type { PositionedNode } from '../lib/tree-layout'

// We test the pure computeActiveDepth function in combination
// with simulated store scenarios, since Zustand store testing
// requires DOM setup we don't have in node environment.

const nodes: PositionedNode[] = [
  { id: '/root', name: 'root', position: [0, 0, 0], parentId: null, depth: 0, childCount: 2 },
  { id: '/root/src', name: 'src', position: [5, 0, 0], parentId: '/root', depth: 1, childCount: 1 },
  { id: '/root/tests', name: 'tests', position: [-5, 0, 0], parentId: '/root', depth: 1, childCount: 0 },
  { id: '/root/src/lib', name: 'lib', position: [8, -2, 0], parentId: '/root/src', depth: 2, childCount: 1 },
  { id: '/root/src/lib/utils.ts', name: 'utils.ts', position: [10, -4, 0], parentId: '/root/src/lib', depth: 3, childCount: 0 },
]

describe('visibleDepth computation scenarios', () => {
  it('depth increases when agent moves deeper', () => {
    const step1 = computeActiveDepth(
      [{ currentFile: '/root/src', status: 'reading' }],
      nodes,
    )
    const step2 = computeActiveDepth(
      [{ currentFile: '/root/src/lib', status: 'reading' }],
      nodes,
    )
    expect(step1).toBe(1)
    expect(step2).toBe(2)
    expect(step2).toBeGreaterThan(step1)
  })

  it('depth decreases when agent moves shallower', () => {
    const deep = computeActiveDepth(
      [{ currentFile: '/root/src/lib/utils.ts', status: 'writing' }],
      nodes,
    )
    const shallow = computeActiveDepth(
      [{ currentFile: '/root/src', status: 'reading' }],
      nodes,
    )
    expect(deep).toBe(3)
    expect(shallow).toBe(1)
  })

  it('depth resets to 1 when agent becomes idle', () => {
    const active = computeActiveDepth(
      [{ currentFile: '/root/src/lib', status: 'writing' }],
      nodes,
    )
    const idle = computeActiveDepth(
      [{ currentFile: '/root/src/lib', status: 'idle' }],
      nodes,
    )
    expect(active).toBe(2)
    expect(idle).toBe(1)
  })

  it('with +1 buffer, visibleDepth shows children of active level', () => {
    const activeDepth = computeActiveDepth(
      [{ currentFile: '/root/src', status: 'reading' }],
      nodes,
    )
    const visibleDepth = activeDepth + 1
    // Agent at depth 1, visible depth should be 2 (shows depth-2 children)
    expect(visibleDepth).toBe(2)
    const visibleNodes = nodes.filter((n) => n.depth <= visibleDepth)
    expect(visibleNodes.map((n) => n.id)).toContain('/root/src/lib')
    expect(visibleNodes.map((n) => n.id)).not.toContain('/root/src/lib/utils.ts')
  })
})
```

**Step 2: Run tests**

Run: `cd /Users/will/github/lcars-agent-monitor && bunx vitest run client/src/__tests__/visible-depth-store.test.ts`
Expected: PASS

**Step 3: Run full test suite**

Run: `cd /Users/will/github/lcars-agent-monitor && bunx vitest run`
Expected: All tests PASS

**Step 4: Ask me for feedback before commit**

**Step 5: Commit**

```bash
git add client/src/__tests__/visible-depth-store.test.ts
git commit -m "test: add integration tests for visibleDepth computation"
```

---

### Task 7: Final type-check and cleanup

**Files:**
- All modified files

**Step 1: Type-check the entire project**

Run: `cd /Users/will/github/lcars-agent-monitor && bunx tsc --noEmit`
Expected: No errors

**Step 2: Run the full test suite**

Run: `cd /Users/will/github/lcars-agent-monitor && bunx vitest run`
Expected: All tests PASS

**Step 3: Visual smoke test**

Run: `cd /Users/will/github/lcars-agent-monitor && bun run dev`

Verify:
- Tree renders with only root + depth-1 nodes when idle
- Starting agent work at depth 2 reveals depth-2 nodes (with animation)
- Deeper work reveals deeper nodes
- Stopping agent work retracts the tree after 5 seconds
- No console errors
- Labels still appear correctly for visible nodes
- Edge lines connect only visible nodes

**Step 4: Ask me for feedback before commit**

**Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore: type-check and cleanup for progressive tree rendering"
```

---

## Summary of changes

| File | Action | Purpose |
|------|--------|---------|
| `client/src/lib/active-depth.ts` | Create | Pure function: compute max depth from active agents |
| `client/src/__tests__/active-depth.test.ts` | Create | Unit tests for depth computation |
| `client/src/__tests__/visible-depth-store.test.ts` | Create | Integration tests for depth + filtering |
| `client/src/store/index.ts` | Modify | Add `visibleDepth` state, recompute on agent changes, delayed retraction |
| `client/src/components/Scene3D/TreeGraph3D.tsx` | Modify | Filter nodes by visibleDepth, animate new nodes appearing |

## Key design decisions

1. **+1 buffer**: Show one level deeper than where agents are working so the immediate children are visible as context.
2. **Delayed retraction**: 5-second delay before shrinking the tree prevents flickering when agents briefly pause between tasks.
3. **Filter, don't re-layout**: We compute the full layout once and filter the rendered nodes. This avoids expensive re-layouts and keeps node positions stable as the tree expands/contracts.
4. **Animate appearance only**: New nodes scale in with ease-out cubic. Disappearing nodes simply vanish (the delayed retraction handles the UX -- by the time nodes disappear, the user has moved on).
