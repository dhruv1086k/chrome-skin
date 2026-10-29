#!/bin/sh
# Linux / macOS installer (the helper is mainly developed for Windows + NVIDIA)
cd "$(dirname "$0")" && python3 install.py "$@"
