#!/bin/bash
# Installs Claude Code hooks for LCARS Agent Monitor
# The hook handler reads stdin and POSTs to the LCARS server on port 3001

HOOK_PATH="$(cd "$(dirname "$0")" && pwd)/hook-handler.ts"
SETTINGS="$HOME/.claude/settings.json"

echo "Installing LCARS Agent Monitor hooks..."
echo "Hook handler: $HOOK_PATH"
echo ""
echo "Add these hooks to $SETTINGS under \"hooks\":"
echo ""
echo '  "hooks": {'
echo '    "PreToolUse": ['
echo "      { \"type\": \"command\", \"command\": \"bun $HOOK_PATH\" }"
echo '    ],'
echo '    "PostToolUse": ['
echo "      { \"type\": \"command\", \"command\": \"bun $HOOK_PATH\" }"
echo '    ],'
echo '    "SubagentStop": ['
echo "      { \"type\": \"command\", \"command\": \"bun $HOOK_PATH\" }"
echo '    ]'
echo '  }'
