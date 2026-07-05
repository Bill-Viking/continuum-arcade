#!/bin/bash
cd "$(dirname "$0")"
/usr/bin/python3 mythos_doom_gui.py --check --notify
read -n 1 -s -r -p "Press any key to close..."
echo
