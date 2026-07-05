# Fable/Mythos Hourly Status Watcher

This workflow checks the official Claude status feed once per hour for the Fable/Mythos suspension incident. It sends a desktop notification every hour while the incident is unresolved or unknown, then sends one final notification when the incident is marked resolved.

## Quick test

```bash
cd fable_mythos_watch
python3 fable_status_watch.py --once
```

## Run continuously in the foreground

```bash
python3 fable_status_watch.py --interval 3600
```

Leave that Terminal window open. It will check immediately, then every hour, and exit after it detects a resolved incident.

## Install as an hourly macOS LaunchAgent

```bash
cd fable_mythos_watch
bash install_macos_launch_agent.sh
```

This runs immediately at install/login and then every 3600 seconds. It writes logs to:

```text
~/Library/Logs/fable-mythos-watch.log
~/Library/Logs/fable-mythos-watch.err.log
```

Remove it later with:

```bash
bash uninstall_macos_launch_agent.sh
```

## Optional Slack notifications

Set a Slack incoming webhook before running the watcher manually:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
python3 fable_status_watch.py --interval 3600 --no-desktop
```

For macOS LaunchAgent use, add an `EnvironmentVariables` block to the generated plist or run the foreground command above.

## What it watches

The watcher uses:

```text
https://status.claude.com/api/v2/incidents.json
```

It searches first for incident ID `s9w82lp9dcn9`, then falls back to incident names containing Fable/Mythos and suspended/access wording.
