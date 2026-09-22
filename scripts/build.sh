#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> [backend] cargo build --release"
( cd "$ROOT/backend" && cargo build --release )

echo "==> [frontend] npm install && build"
( cd "$ROOT/ui" && npm ci && npm run build )

echo "==> [done] Build artifacts ready."
echo "    Backend: $ROOT/backend/target/release/dbx-plugin-dbx-workflow-plugin"
echo "    Frontend: $ROOT/ui/dist/"
echo ""
echo "    Run: dbx-plugin package ."
