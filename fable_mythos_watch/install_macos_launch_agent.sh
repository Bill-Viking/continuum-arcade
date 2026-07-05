#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$HOME/.local/share/fable-mythos-watch"
PLIST="$HOME/Library/LaunchAgents/com.bill.fable-mythos-watch.plist"
LOG_DIR="$HOME/Library/Logs"

mkdir -p "$INSTALL_DIR" "$HOME/Library/LaunchAgents" "$LOG_DIR"
cp "$SCRIPT_DIR/fable_status_watch.py" "$INSTALL_DIR/fable_status_watch.py"
chmod +x "$INSTALL_DIR/fable_status_watch.py"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.bill.fable-mythos-watch</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>$INSTALL_DIR/fable_status_watch.py</string>
    <string>--once</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/fable-mythos-watch.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/fable-mythos-watch.err.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Installed hourly Fable/Mythos watcher."
echo "Logs: $LOG_DIR/fable-mythos-watch.log"
echo "To remove it later, run: bash $SCRIPT_DIR/uninstall_macos_launch_agent.sh"
