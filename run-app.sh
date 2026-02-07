#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but not found in PATH. Install pnpm 9+ first."
  exit 1
fi

pnpm install

MODE="${1:-dev}"
case "$MODE" in
  dev)
    pnpm --filter demo-host-react dev
    ;;
  demo)
    pnpm demo:react
    ;;
  *)
    echo "Usage: $(basename "$0") [dev|demo]"
    exit 1
    ;;
esac