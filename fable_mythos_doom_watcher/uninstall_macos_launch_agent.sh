#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/python3 mythos_doom_gui.py --uninstall-agent
