#!/usr/bin/env bash
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)/ssc_artifacts"
DEST="/opt/brains-worker/ssc_artifacts"

if [[ ! -d "$SRC" ]]; then
  echo "Source not found: $SRC" >&2
  exit 1
fi

if [[ ! -d "/opt/brains-worker" ]]; then
  echo "Destination /opt/brains-worker not found. Edit DEST in this script." >&2
  exit 1
fi

sudo mkdir -p "$DEST"
sudo rsync -av --delete "$SRC/" "$DEST/"

echo "Synced SSC artifacts to $DEST"
