# Fable/Mythos Doom Watcher

A small, unofficial macOS-friendly GUI watcher for the Claude Fable 5 / Mythos 5 status incident.

It checks the official Claude status API:

```text
https://status.claude.com/api/v2/incidents.json
```

The icon is an original parody-style “evil terminal goblin” mascot. It does **not** copy Anthropic’s or Claude Code’s actual icon.

## Fast start

Unzip this folder and put it somewhere stable, such as:

```text
/Users/bill/Desktop/fable_mythos_doom_watcher
```

Then double-click:

```text
run_gui.command
```

Or run from Terminal:

```bash
cd /Users/bill/Desktop/fable_mythos_doom_watcher
python3 mythos_doom_gui.py
```

## One-time check

```bash
python3 mythos_doom_gui.py --check --notify
```

## Install hourly background notifications

From Terminal:

```bash
cd /Users/bill/Desktop/fable_mythos_doom_watcher
bash install_macos_launch_agent.sh
```

Or press **Install hourly background watcher** inside the GUI.

It writes logs here:

```bash
~/Library/Logs/fable-mythos-doom-watcher.log
```

Watch the log:

```bash
tail -f ~/Library/Logs/fable-mythos-doom-watcher.log
```

## Remove hourly background notifications

```bash
cd /Users/bill/Desktop/fable_mythos_doom_watcher
bash uninstall_macos_launch_agent.sh
```

Or press **Remove background watcher** inside the GUI.

## Avoid double notifications

If you already installed the earlier plain watcher, remove it after installing this GUI watcher:

```bash
bash /Users/bill/Desktop/fable_mythos_watch/uninstall_macos_launch_agent.sh
```

Then check only the new one is loaded:

```bash
launchctl list | grep fable
```

## What it sends

While unresolved:

```text
Fable/Mythos still unavailable
[incident name]: still not resolved. Status: monitoring. Last status update: [...]. Checked: [...]. Details: [...]
```

When resolved:

```text
Fable/Mythos restored or incident resolved
[incident name]: RESOLVED at [...]. Checked: [...]. Verify access in Claude/API. Details: [...]
```

## Notes

- The GUI's hourly checks only run while the window is open.
- The LaunchAgent background watcher keeps running even when the GUI window is closed.
- macOS notifications may appear as coming from Terminal, Python, or the app bundle depending on how you launch it.
