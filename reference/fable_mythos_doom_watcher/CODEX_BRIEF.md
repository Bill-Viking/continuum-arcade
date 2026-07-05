# Codex build brief

Build a macOS-friendly local Python desktop app called **Fable/Mythos Doom Watcher**.

Requirements:

- Query `https://status.claude.com/api/v2/incidents.json`.
- Find incidents mentioning `Fable 5`, `Mythos 5`, `Claude Fable`, or `Claude Mythos`.
- Display a dark-mode GUI with:
  - current status,
  - incident details,
  - last status update,
  - last check time,
  - Check Now button,
  - Open Status Page button,
  - Start/Stop hourly GUI checks,
  - Install/Remove macOS LaunchAgent for background hourly notifications.
- Send macOS notifications with `osascript`.
- Store logs at `~/Library/Logs/fable-mythos-doom-watcher.log`.
- Store minimal state at `~/.fable_mythos_doom_watcher/state.json` so final restored notification only fires once.
- Use only Python standard library at runtime.
- Include an original parody-style icon. Do not copy Anthropic/Claude/Claude Code branding.

Tone: funny, slightly theatrical, not official.
