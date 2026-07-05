#!/usr/bin/env python3
"""
Fable/Mythos Doom Watcher
An unofficial macOS-friendly GUI and hourly notification watcher for the Claude
Fable 5 / Mythos 5 status incident.

Runtime dependencies: Python 3 standard library only.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import platform
import plistlib
import subprocess
import sys
import textwrap
import threading
import time
import traceback
import urllib.error
import urllib.request
import webbrowser
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple

STATUS_API = "https://status.claude.com/api/v2/incidents.json"
STATUS_PAGE = "https://status.claude.com/"
INCIDENT_SEARCH_TERMS = ("fable 5", "mythos 5", "claude fable", "claude mythos")
DEFAULT_INTERVAL_SECONDS = 3600
APP_NAME = "Fable/Mythos Doom Watcher"
APP_SUBTITLE = "Unofficial watcher. Not affiliated with Anthropic."
LABEL_ID = "com.bill.fablemythos.doomwatcher"
STATE_DIR = Path.home() / ".fable_mythos_doom_watcher"
STATE_PATH = STATE_DIR / "state.json"
LOG_PATH = Path.home() / "Library" / "Logs" / "fable-mythos-doom-watcher.log"

# Dark UI palette. Kept here for easy tweaking.
BG = "#101014"
PANEL = "#181821"
PANEL_2 = "#20202c"
TEXT = "#f4f0ea"
MUTED = "#b6adb2"
WARN = "#ffb14e"
GOOD = "#6ee79a"
BAD = "#ff5b73"
CYAN = "#7bdcff"
BORDER = "#363648"
BUTTON = "#2d2d3b"
BUTTON_HOVER = "#3a3a4c"


@dataclass
class IncidentStatus:
    state: str  # unresolved, resolved, not_found, error
    title: str
    body: str
    incident_name: str = ""
    incident_status: str = ""
    incident_url: str = STATUS_PAGE
    updated_at: str = ""
    resolved_at: str = ""
    checked_at: str = ""
    raw_error: str = ""

    @property
    def is_resolved(self) -> bool:
        return self.state == "resolved"

    @property
    def is_unresolved(self) -> bool:
        return self.state == "unresolved"


def now_local() -> datetime:
    return datetime.now().astimezone()


def fmt_dt(value: Optional[str]) -> str:
    """Parse common Statuspage timestamps and render in the user's local timezone."""
    if not value:
        return "unknown"
    try:
        cleaned = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
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


def save_state(data: Dict[str, Any]) -> None:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        STATE_PATH.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    except Exception:
        # State persistence should never stop a status check.
        pass


def append_log(title: str, body: str) -> None:
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        stamp = now_local().strftime("%Y-%m-%d %H:%M:%S %Z")
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(f"[{stamp}] {title}\n{body}\n\n")
    except Exception:
        pass


def applescript_quote(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


def notify(title: str, body: str, sound: str = "Submarine") -> None:
    """Best-effort macOS desktop notification; falls back to stdout/log only."""
    append_log(title, body)
    print(f"[{now_local().strftime('%Y-%m-%d %H:%M:%S %Z')}] {title}\n{body}\n")
    if platform.system() != "Darwin":
        return
    script = (
        f'display notification "{applescript_quote(body)}" '
        f'with title "{applescript_quote(title)}" '
        f'subtitle "{applescript_quote(APP_NAME)}" '
        f'sound name "{applescript_quote(sound)}"'
    )
    try:
        subprocess.run(["/usr/bin/osascript", "-e", script], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def fetch_json(url: str, timeout: int = 20) -> Dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "FableMythosDoomWatcher/1.0 (+local desktop status watcher)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset, errors="replace"))


def incident_text(incident: Dict[str, Any]) -> str:
    parts = [
        str(incident.get("name", "")),
        str(incident.get("status", "")),
        str(incident.get("impact", "")),
    ]
    for update in incident.get("incident_updates", []) or []:
        parts.append(str(update.get("body", "")))
        parts.append(str(update.get("status", "")))
    return "\n".join(parts).lower()


def find_fable_mythos_incident(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    incidents = payload.get("incidents", []) or []
    for incident in incidents:
        text = incident_text(incident)
        if any(term in text for term in INCIDENT_SEARCH_TERMS):
            return incident
    return None


def build_status() -> IncidentStatus:
    checked = now_local().strftime("%Y-%m-%d %H:%M:%S %Z")
    try:
        payload = fetch_json(STATUS_API)
        incident = find_fable_mythos_incident(payload)
        if not incident:
            body = (
                "The watcher could reach the Claude status feed, but it could not find a recent "
                "Fable/Mythos incident. Verify manually before assuming restoration."
            )
            return IncidentStatus(
                state="not_found",
                title="Fable/Mythos status unknown",
                body=f"{body} Checked: {checked}. Details: {STATUS_PAGE}",
                checked_at=checked,
                incident_url=STATUS_PAGE,
            )

        name = html.unescape(str(incident.get("name") or "Claude Fable/Mythos incident"))
        status = str(incident.get("status") or "unknown")
        url = str(incident.get("shortlink") or incident.get("url") or STATUS_PAGE)
        updated = fmt_dt(str(incident.get("updated_at") or ""))
        resolved_raw = incident.get("resolved_at")
        resolved = fmt_dt(str(resolved_raw or "")) if resolved_raw else ""

        if resolved_raw or status.lower() == "resolved":
            body = (
                f"{name}: RESOLVED at {resolved or 'unknown time'}. "
                f"Checked: {checked}. Verify access in Claude/API. Details: {url}"
            )
            return IncidentStatus(
                state="resolved",
                title="Fable/Mythos restored or incident resolved",
                body=body,
                incident_name=name,
                incident_status=status,
                incident_url=url,
                updated_at=updated,
                resolved_at=resolved,
                checked_at=checked,
            )

        body = (
            f"{name}: still not resolved. Status: {status}. "
            f"Last status update: {updated}. Checked: {checked}. Details: {url}"
        )
        return IncidentStatus(
            state="unresolved",
            title="Fable/Mythos still unavailable",
            body=body,
            incident_name=name,
            incident_status=status,
            incident_url=url,
            updated_at=updated,
            checked_at=checked,
        )
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        body = f"Could not read the Claude status feed. Checked: {checked}. Error: {exc}"
        return IncidentStatus(state="error", title="Fable/Mythos status check failed", body=body, checked_at=checked, raw_error=str(exc))
    except Exception as exc:
        body = f"Unexpected watcher error. Checked: {checked}. Error: {exc}"
        return IncidentStatus(state="error", title="Fable/Mythos status check failed", body=body, checked_at=checked, raw_error=traceback.format_exc())


def should_send_resolution_notice(status: IncidentStatus) -> bool:
    if not status.is_resolved:
        return True
    state = load_state()
    return not bool(state.get("resolution_notice_sent"))


def remember_status(status: IncidentStatus) -> None:
    state = load_state()
    state.update(
        {
            "last_state": status.state,
            "last_title": status.title,
            "last_body": status.body,
            "last_checked_at": status.checked_at,
            "last_incident_status": status.incident_status,
            "last_incident_url": status.incident_url,
        }
    )
    if status.is_resolved:
        state["resolution_notice_sent"] = True
        state["resolved_at"] = status.resolved_at
    else:
        state["resolution_notice_sent"] = False
    save_state(state)


def run_check(send_notification: bool = False, quiet: bool = False) -> IncidentStatus:
    status = build_status()
    if send_notification and should_send_resolution_notice(status):
        sound = "Glass" if status.is_resolved else "Submarine"
        notify(status.title, status.body, sound=sound)
    elif not quiet:
        append_log(status.title, status.body)
        print(f"[{now_local().strftime('%Y-%m-%d %H:%M:%S %Z')}] {status.title}\n{status.body}\n")
    remember_status(status)
    return status


def script_path_for_launchd() -> Path:
    return Path(__file__).resolve()


def install_launch_agent() -> Tuple[bool, str]:
    if platform.system() != "Darwin":
        return False, "LaunchAgent install is only supported on macOS."
    script = script_path_for_launchd()
    if not script.exists():
        return False, f"Could not find script path: {script}"
    launch_dir = Path.home() / "Library" / "LaunchAgents"
    launch_dir.mkdir(parents=True, exist_ok=True)
    plist_path = launch_dir / f"{LABEL_ID}.plist"
    log_path = str(LOG_PATH)
    plist = {
        "Label": LABEL_ID,
        "ProgramArguments": [
            "/usr/bin/python3",
            str(script),
            "--check",
            "--notify",
        ],
        "StartInterval": DEFAULT_INTERVAL_SECONDS,
        "RunAtLoad": True,
        "StandardOutPath": log_path,
        "StandardErrorPath": log_path,
        "WorkingDirectory": str(script.parent),
    }
    with plist_path.open("wb") as f:
        plistlib.dump(plist, f)
    # Kick any old copy, then load the current one. bootstrap is preferred on newer macOS.
    uid = os.getuid()
    subprocess.run(["/bin/launchctl", "bootout", f"gui/{uid}", str(plist_path)], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    boot = subprocess.run(["/bin/launchctl", "bootstrap", f"gui/{uid}", str(plist_path)], capture_output=True, text=True)
    if boot.returncode != 0:
        # Fallback for older launchctl behavior.
        legacy = subprocess.run(["/bin/launchctl", "load", "-w", str(plist_path)], capture_output=True, text=True)
        if legacy.returncode != 0:
            return False, (boot.stderr or legacy.stderr or "launchctl failed").strip()
    subprocess.run(["/bin/launchctl", "kickstart", "-k", f"gui/{uid}/{LABEL_ID}"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return True, f"Installed hourly watcher. Log: {LOG_PATH}"


def uninstall_launch_agent() -> Tuple[bool, str]:
    if platform.system() != "Darwin":
        return False, "LaunchAgent uninstall is only supported on macOS."
    plist_path = Path.home() / "Library" / "LaunchAgents" / f"{LABEL_ID}.plist"
    uid = os.getuid()
    subprocess.run(["/bin/launchctl", "bootout", f"gui/{uid}", str(plist_path)], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["/bin/launchctl", "unload", "-w", str(plist_path)], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        plist_path.unlink()
    except FileNotFoundError:
        pass
    return True, "Removed hourly watcher."


def run_forever(interval: int = DEFAULT_INTERVAL_SECONDS, send_notification: bool = True) -> None:
    print(f"{APP_NAME}: checking every {interval} seconds. Press Ctrl-C to stop.")
    while True:
        status = run_check(send_notification=send_notification)
        if status.is_resolved:
            break
        time.sleep(interval)


def resource_path(name: str) -> Path:
    return Path(__file__).resolve().parent / name


class DoomWatcherGUI:
    def __init__(self) -> None:
        import tkinter as tk
        from tkinter import messagebox

        self.tk = tk
        self.messagebox = messagebox
        self.root = tk.Tk()
        self.root.title(APP_NAME)
        self.root.geometry("820x620")
        self.root.minsize(720, 540)
        self.root.configure(bg=BG)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.hourly_enabled = False
        self.next_check_epoch: Optional[float] = None
        self.last_status: Optional[IncidentStatus] = None
        self._busy = False

        icon_path = resource_path("evil_codex_icon.png")
        self.icon_img = None
        if icon_path.exists():
            try:
                self.icon_img = tk.PhotoImage(file=str(icon_path))
                self.root.iconphoto(True, self.icon_img)
            except Exception:
                self.icon_img = None

        self.build_ui()
        self.root.after(250, self.check_now)
        self.root.after(1000, self.tick)

    def build_ui(self) -> None:
        tk = self.tk
        outer = tk.Frame(self.root, bg=BG, padx=22, pady=22)
        outer.pack(fill="both", expand=True)

        header = tk.Frame(outer, bg=BG)
        header.pack(fill="x")

        if self.icon_img is not None:
            # Use a smaller copy by subsampling the 1024 icon.
            try:
                small_icon = self.icon_img.subsample(8, 8)
                self.header_icon = small_icon
                tk.Label(header, image=small_icon, bg=BG).pack(side="left", padx=(0, 18))
            except Exception:
                pass

        titles = tk.Frame(header, bg=BG)
        titles.pack(side="left", fill="x", expand=True)
        tk.Label(
            titles,
            text="Fable/Mythos Doom Watcher",
            font=("Avenir Next", 28, "bold"),
            fg=TEXT,
            bg=BG,
        ).pack(anchor="w")
        tk.Label(
            titles,
            text="A goofy desktop goblin that checks whether Claude Fable 5 / Mythos 5 is back.",
            font=("Avenir Next", 13),
            fg=MUTED,
            bg=BG,
        ).pack(anchor="w", pady=(4, 0))
        tk.Label(
            titles,
            text=APP_SUBTITLE,
            font=("Avenir Next", 11),
            fg="#85808a",
            bg=BG,
        ).pack(anchor="w", pady=(2, 0))

        self.status_card = tk.Frame(outer, bg=PANEL, padx=18, pady=18, highlightbackground=BORDER, highlightthickness=1)
        self.status_card.pack(fill="x", pady=(24, 14))

        self.status_label = tk.Label(
            self.status_card,
            text="Summoning status feed…",
            font=("Avenir Next", 22, "bold"),
            fg=CYAN,
            bg=PANEL,
        )
        self.status_label.pack(anchor="w")

        self.details_label = tk.Label(
            self.status_card,
            text="Checking the official status feed now.",
            font=("Avenir Next", 13),
            fg=TEXT,
            bg=PANEL,
            justify="left",
            wraplength=740,
        )
        self.details_label.pack(anchor="w", pady=(12, 0), fill="x")

        meta = tk.Frame(self.status_card, bg=PANEL)
        meta.pack(fill="x", pady=(15, 0))
        self.updated_label = tk.Label(meta, text="Last status update: —", font=("Menlo", 11), fg=MUTED, bg=PANEL)
        self.updated_label.pack(anchor="w")
        self.checked_label = tk.Label(meta, text="Checked: —", font=("Menlo", 11), fg=MUTED, bg=PANEL)
        self.checked_label.pack(anchor="w", pady=(4, 0))
        self.countdown_label = tk.Label(meta, text="Hourly GUI checks: off", font=("Menlo", 11), fg=MUTED, bg=PANEL)
        self.countdown_label.pack(anchor="w", pady=(4, 0))

        controls = tk.Frame(outer, bg=BG)
        controls.pack(fill="x", pady=(4, 8))

        self.check_button = self.button(controls, "Check now", self.check_now)
        self.check_button.pack(side="left", padx=(0, 8), pady=6)

        self.hourly_button = self.button(controls, "Start hourly GUI checks", self.toggle_hourly)
        self.hourly_button.pack(side="left", padx=8, pady=6)

        self.notify_button = self.button(controls, "Send test notification", self.send_test_notification)
        self.notify_button.pack(side="left", padx=8, pady=6)

        self.open_button = self.button(controls, "Open status page", lambda: webbrowser.open(STATUS_PAGE))
        self.open_button.pack(side="left", padx=8, pady=6)

        bg_controls = tk.Frame(outer, bg=PANEL_2, padx=16, pady=14, highlightbackground=BORDER, highlightthickness=1)
        bg_controls.pack(fill="x", pady=(12, 8))
        tk.Label(
            bg_controls,
            text="Background hourly alerts",
            font=("Avenir Next", 15, "bold"),
            fg=TEXT,
            bg=PANEL_2,
        ).pack(anchor="w")
        tk.Label(
            bg_controls,
            text="Install a macOS LaunchAgent so notifications keep running even when this window is closed.",
            font=("Avenir Next", 12),
            fg=MUTED,
            bg=PANEL_2,
            wraplength=760,
            justify="left",
        ).pack(anchor="w", pady=(4, 10))

        agent_row = tk.Frame(bg_controls, bg=PANEL_2)
        agent_row.pack(fill="x")
        self.install_button = self.button(agent_row, "Install hourly background watcher", self.install_agent)
        self.install_button.pack(side="left", padx=(0, 8))
        self.uninstall_button = self.button(agent_row, "Remove background watcher", self.uninstall_agent)
        self.uninstall_button.pack(side="left", padx=8)
        self.log_button = self.button(agent_row, "Open log in Terminal", self.open_log)
        self.log_button.pack(side="left", padx=8)

        footer = tk.Frame(outer, bg=BG)
        footer.pack(fill="both", expand=True, pady=(12, 0))
        self.goblin_label = tk.Label(
            footer,
            text="Goblin mood: annoyed, caffeinated, and checking the feed.",
            font=("Avenir Next", 12, "italic"),
            fg="#9d96a6",
            bg=BG,
        )
        self.goblin_label.pack(anchor="w")

    def button(self, parent, text: str, command):
        tk = self.tk
        btn = tk.Button(
            parent,
            text=text,
            command=command,
            bg=BUTTON,
            fg=TEXT,
            activebackground=BUTTON_HOVER,
            activeforeground=TEXT,
            relief="flat",
            borderwidth=0,
            padx=14,
            pady=9,
            cursor="hand2",
            font=("Avenir Next", 12, "bold"),
        )
        return btn

    def set_busy(self, busy: bool) -> None:
        self._busy = busy
        try:
            self.check_button.configure(text="Checking…" if busy else "Check now", state="disabled" if busy else "normal")
        except Exception:
            pass

    def check_now(self) -> None:
        if self._busy:
            return
        self.set_busy(True)
        threading.Thread(target=self._check_worker, daemon=True).start()

    def _check_worker(self) -> None:
        status = run_check(send_notification=False, quiet=True)
        self.root.after(0, lambda: self.apply_status(status))

    def apply_status(self, status: IncidentStatus) -> None:
        self.last_status = status
        self.set_busy(False)
        color = CYAN
        goblin = "Goblin mood: confused, refreshing the scrying pool."
        if status.state == "unresolved":
            color = WARN
            goblin = "Goblin mood: grumbling. Still locked in the model dungeon."
        elif status.state == "resolved":
            color = GOOD
            goblin = "Goblin mood: triumphant. The gates may be open — verify access."
        elif status.state == "error":
            color = BAD
            goblin = "Goblin mood: angry at the network goblins."
        elif status.state == "not_found":
            color = CYAN
            goblin = "Goblin mood: suspicious. Incident not found; verify manually."

        self.status_label.configure(text=status.title, fg=color)
        self.details_label.configure(text=status.body)
        self.updated_label.configure(text=f"Last status update: {status.updated_at or '—'}")
        self.checked_label.configure(text=f"Checked: {status.checked_at or '—'}")
        self.goblin_label.configure(text=goblin)
        self.update_countdown_label()

    def toggle_hourly(self) -> None:
        self.hourly_enabled = not self.hourly_enabled
        if self.hourly_enabled:
            self.next_check_epoch = time.time() + DEFAULT_INTERVAL_SECONDS
            self.hourly_button.configure(text="Stop hourly GUI checks")
        else:
            self.next_check_epoch = None
            self.hourly_button.configure(text="Start hourly GUI checks")
        self.update_countdown_label()

    def tick(self) -> None:
        if self.hourly_enabled and self.next_check_epoch is not None:
            if time.time() >= self.next_check_epoch:
                self.next_check_epoch = time.time() + DEFAULT_INTERVAL_SECONDS
                self.check_now()
        self.update_countdown_label()
        self.root.after(1000, self.tick)

    def update_countdown_label(self) -> None:
        if self.hourly_enabled and self.next_check_epoch is not None:
            remaining = max(0, int(self.next_check_epoch - time.time()))
            mins, secs = divmod(remaining, 60)
            self.countdown_label.configure(text=f"Hourly GUI checks: on — next check in {mins:02d}:{secs:02d}", fg=MUTED)
        else:
            self.countdown_label.configure(text="Hourly GUI checks: off", fg=MUTED)

    def send_test_notification(self) -> None:
        notify("Doom Watcher test", "The evil little status goblin can send notifications.", sound="Submarine")

    def install_agent(self) -> None:
        ok, msg = install_launch_agent()
        title = "Installed" if ok else "Install failed"
        self.messagebox.showinfo(title, msg)
        notify("Fable/Mythos background watcher", msg, sound="Glass" if ok else "Basso")

    def uninstall_agent(self) -> None:
        ok, msg = uninstall_launch_agent()
        title = "Removed" if ok else "Remove failed"
        self.messagebox.showinfo(title, msg)
        notify("Fable/Mythos background watcher", msg, sound="Glass" if ok else "Basso")

    def open_log(self) -> None:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        LOG_PATH.touch(exist_ok=True)
        if platform.system() == "Darwin":
            subprocess.run(["/usr/bin/open", "-a", "Terminal", str(LOG_PATH)], check=False)
        else:
            webbrowser.open(str(LOG_PATH))

    def on_close(self) -> None:
        self.root.destroy()

    def run(self) -> None:
        self.root.mainloop()


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--check", "--once", action="store_true", help="Check once, print/log the result, then exit.")
    parser.add_argument("--notify", action="store_true", help="Send a desktop notification with the check result.")
    parser.add_argument("--watch", action="store_true", help="Run continuously until the incident resolves.")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL_SECONDS, help="Watch interval in seconds. Default: 3600.")
    parser.add_argument("--install-agent", action="store_true", help="Install macOS hourly LaunchAgent.")
    parser.add_argument("--uninstall-agent", action="store_true", help="Remove macOS hourly LaunchAgent.")
    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.install_agent:
        ok, msg = install_launch_agent()
        print(msg)
        return 0 if ok else 1
    if args.uninstall_agent:
        ok, msg = uninstall_launch_agent()
        print(msg)
        return 0 if ok else 1
    if args.watch:
        run_forever(interval=max(60, args.interval), send_notification=args.notify or True)
        return 0
    if args.check:
        status = run_check(send_notification=args.notify)
        return 0 if status.state != "error" else 2

    try:
        DoomWatcherGUI().run()
    except Exception as exc:
        print(f"Could not launch GUI: {exc}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
