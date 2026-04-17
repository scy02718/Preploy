#!/usr/bin/env bash
# Setup MediaPipe assets for gaze & presence analysis.
# Run from apps/web/ after npm install.
#
# Usage:
#   bash scripts/setup-mediapipe.sh
#
# This script:
#   1. Copies WASM files from node_modules/@mediapipe/tasks-vision/wasm/
#   2. Downloads the face_landmarker.task model from Google storage

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

WASM_SRC="$WEB_DIR/node_modules/@mediapipe/tasks-vision/wasm"
WASM_DEST="$WEB_DIR/public/mediapipe/wasm"
MODEL_DEST="$WEB_DIR/public/mediapipe/face_landmarker.task"
MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

echo "Setting up MediaPipe assets..."

# --- WASM files ---
if [ ! -d "$WASM_SRC" ]; then
  echo "ERROR: $WASM_SRC not found. Run 'npm install' first." >&2
  exit 1
fi

mkdir -p "$WASM_DEST"
cp -r "$WASM_SRC"/. "$WASM_DEST/"
echo "WASM files copied to $WASM_DEST"

# --- Face landmark model ---
if [ -f "$MODEL_DEST" ]; then
  echo "face_landmarker.task already exists, skipping download."
else
  echo "Downloading face_landmarker.task (~4 MB)..."
  if command -v curl &>/dev/null; then
    curl -fsSL "$MODEL_URL" -o "$MODEL_DEST"
  elif command -v wget &>/dev/null; then
    wget -q "$MODEL_URL" -O "$MODEL_DEST"
  else
    echo "ERROR: Neither curl nor wget is available. Download manually:" >&2
    echo "  $MODEL_URL" >&2
    echo "  -> $MODEL_DEST" >&2
    exit 1
  fi
  echo "face_landmarker.task downloaded."
fi

echo "MediaPipe setup complete."
