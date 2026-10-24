#!/bin/sh
# Link this checkout into a DeepSeek Harness profile for development (default: the macOS
# Desktop app's own dsh and its `desktop` profile; set DSH_CLI / DSH_PROFILE for anything else).
# DSH must be fully quit first (the CLI refuses to touch a running Desktop profile).
set -eu

DSH_CLI="${DSH_CLI:-/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh}"
PROFILE="${DSH_PROFILE:-desktop}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if pgrep -f "DeepSeek Harness.app/Contents/MacOS" >/dev/null 2>&1; then
  echo "DeepSeek Harness is still running. Quit it completely (Cmd+Q), then run this again." >&2
  exit 1
fi

if ! command -v "$DSH_CLI" >/dev/null 2>&1; then
  echo "No dsh command at $DSH_CLI. Point DSH_CLI at your DeepSeek Harness command line, e.g. DSH_CLI=/path/to/dsh npm run dev:install" >&2
  exit 1
fi

if [ ! -f "$ROOT/dist/index.js" ] || [ ! -f "$ROOT/dist/client.js" ]; then
  echo "dist/ is missing; run npm run build first." >&2
  exit 1
fi

"$DSH_CLI" plugin --profile "$PROFILE" add "link:$ROOT"
echo "Linked $ROOT into profile '$PROFILE'. Start DeepSeek Harness and check Plugins → dsh-threads."
