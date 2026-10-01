#!/bin/zsh
STUDIO_ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
cd -- "$STUDIO_ROOT" || exit 1
python3 serve.py --open
