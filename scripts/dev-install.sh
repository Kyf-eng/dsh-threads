#!/bin/sh
# Link this checkout into the DeepSeek Harness Desktop profile for development.
# DSH must be fully quit first (the CLI refuses to touch a running Desktop profile).
set -eu

DSH_CLI="${DSH_CLI:-/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh}"
PROFILE="${DSH_PROFILE:-desktop}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if pgrep -f "DeepSeek Harness.app/Contents/MacOS" >/dev/null 2>&1; then
  echo "DeepSeek Harness is still running. Quit it completely (Cmd+Q), then run this again." >&2
  exit 1
fi

if [ ! -f "$ROOT/dist/index.js" ] || [ ! -f "$ROOT/dist/client.js" ]; then
  echo "dist/ is missing; run npm run build first." >&2
  exit 1
fi

"$DSH_CLI" plugin --profile "$PROFILE" add "link:$ROOT"
echo "Linked $ROOT into profile '$PROFILE'. Start DeepSeek Harness and check Plugins → dsh-threads."
