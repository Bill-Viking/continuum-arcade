#!/usr/bin/env bash
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.bill.fable-mythos-watch.plist"
INSTALL_DIR="$HOME/.local/share/fable-mythos-watch"

launchctl unload "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"
rm -rf "$INSTALL_DIR"

echo "Removed hourly Fable/Mythos watcher."
