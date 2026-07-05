#!/usr/bin/env python3
"""
Fable/Mythos hourly status watcher.

Checks the official Claude StatusPage incidents feed for the Fable/Mythos suspension
incident and sends a local desktop notification each time it runs until the incident
is marked resolved. When resolved, it sends one final notification and then stays
silent on later scheduled runs.

Optional Slack support: set SLACK_WEBHOOK_URL before running.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

STATUS_URL = "https://status.claude.com/api/v2/incidents.json"
TARGET_INCIDENT_ID = "s9w82lp9dcn9"
STATE_PATH = Path.home() / ".fable_mythos_watch_state.json"


def now_local() -> str:
    return datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")


def iso_to_local(value: Optional[str]) -> str:
    if not value:
        return "unknown"
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    except Exception:
        return value


def load_state() -> Dict[str, Any]:
    try:
        if STATE_PATH.exists():
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def save_state(state: Dict[str, Any]) -> None:
    try:
        STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    except Exception as exc:
        print(f"Warning: could not save state file {STATE_PATH}: {exc}", file=sys.stderr)


def fetch_status() -> Dict[str, Any]:
    request = urllib.request.Request(
        STATUS_URL,
        headers={"User-Agent": "fable-mythos-watch/1.0"},
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.loads(response.read().decode("utf-8"))


def find_fable_mythos_incident(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    incidents = payload.get("incidents") or []

    for incident in incidents:
        if incident.get("id") == TARGET_INCIDENT_ID:
            return incident

    candidates = []
    for incident in incidents:
        name = str(incident.get("name") or "")
        lowered = name.lower()
        if ("fable" in lowered or "mythos" in lowered) and ("suspend" in lowered or "access" in lowered):
            candidates.append(incident)

    if not candidates:
        return None

    return sorted(candidates, key=lambda i: str(i.get("created_at") or ""), reverse=True)[0]


def incident_is_resolved(incident: Dict[str, Any]) -> bool:
    return bool(incident.get("resolved_at")) or str(incident.get("status") or "").lower() == "resolved"


def build_message(payload: Dict[str, Any], incident: Optional[Dict[str, Any]]) -> Tuple[str, str, str]:
    """Return (state, title, message). state is unresolved/resolved/unknown."""
    checked_at = now_local()

    if incident is None:
        return (
            "unknown",
            "Fable/Mythos status unknown",
            f"Could not find the Fable/Mythos suspension incident in the Claude status feed. Checked: {checked_at}. Manually verify at https://status.claude.com/",
        )

    name = incident.get("name") or "Fable/Mythos incident"
    status = str(incident.get("status") or "unknown")
    updated_at = iso_to_local(incident.get("updated_at"))
    resolved_at = iso_to_local(incident.get("resolved_at"))
    shortlink = incident.get("shortlink") or "https://status.claude.com/"

    if incident_is_resolved(incident):
        return (
            "resolved",
            "Fable/Mythos restored or incident resolved",
            f"{name}: RESOLVED at {resolved_at}. Checked: {checked_at}. Verify access in Claude/API. Details: {shortlink}",
        )

    return (
        "unresolved",
        "Fable/Mythos still unavailable",
        f"{name}: still not resolved. Status: {status}. Last status update: {updated_at}. Checked: {checked_at}. Details: {shortlink}",
    )


def send_desktop_notification(title: str, message: str) -> None:
    system = platform.system()
    try:
        if system == "Darwin":
            # json.dumps gives safe AppleScript string quoting.
            script = f"display notification {json.dumps(message)} with title {json.dumps(title)}"
            subprocess.run(["osascript", "-e", script], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == "Linux" and shutil.which("notify-send"):
            subprocess.run(["notify-send", title, message], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif system == "Windows":
            # No dependency-free native toast path. Print still works, and Slack can be used if configured.
            pass
    except Exception as exc:
        print(f"Warning: desktop notification failed: {exc}", file=sys.stderr)


def send_slack_notification(title: str, message: str) -> None:
    webhook = os.environ.get("SLACK_WEBHOOK_URL") or os.environ.get("FABLE_STATUS_WEBHOOK_URL")
    if not webhook:
        return
    try:
        payload = json.dumps({"text": f"*{title}*\n{message}"}).encode("utf-8")
        request = urllib.request.Request(
            webhook,
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "fable-mythos-watch/1.0"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            response.read()
    except Exception as exc:
        print(f"Warning: Slack notification failed: {exc}", file=sys.stderr)


def run_check(no_desktop: bool = False, notify_on_every_resolved_check: bool = False) -> str:
    state = load_state()

    try:
        payload = fetch_status()
        incident = find_fable_mythos_incident(payload)
        status_state, title, message = build_message(payload, incident)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        status_state = "unknown"
        title = "Fable/Mythos status check failed"
        message = f"Could not reach or parse the Claude status feed. Error: {exc}. Checked: {now_local()}."

    print(f"[{now_local()}] {title}\n{message}\n", flush=True)

    # Notify hourly while unresolved/unknown. If resolved, notify once unless explicitly forced.
    resolved_already_announced = bool(state.get("resolved_announced"))
    should_notify = status_state in {"unresolved", "unknown"} or notify_on_every_resolved_check or not resolved_already_announced

    if should_notify:
        if not no_desktop:
            send_desktop_notification(title, message)
        send_slack_notification(title, message)

    state["last_state"] = status_state
    state["last_checked_at"] = now_local()
    if status_state == "resolved":
        state["resolved_announced"] = True
    save_state(state)

    return status_state


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Hourly watcher for the Claude Fable/Mythos suspension incident.")
    parser.add_argument("--interval", type=int, default=3600, help="Seconds between checks in continuous mode. Default: 3600.")
    parser.add_argument("--once", action="store_true", help="Run one check and exit. Useful for cron/launchd.")
    parser.add_argument("--no-desktop", action="store_true", help="Disable desktop notifications; still prints and sends Slack if configured.")
    parser.add_argument("--notify-on-every-resolved-check", action="store_true", help="Keep notifying even after resolved. Default is one resolved notification only.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    while True:
        status_state = run_check(
            no_desktop=args.no_desktop,
            notify_on_every_resolved_check=args.notify_on_every_resolved_check,
        )
        if args.once or status_state == "resolved":
            break
        sleep_for = max(60, int(args.interval))
        time.sleep(sleep_for)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
