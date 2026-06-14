#!/usr/bin/env bash
# Produce a 512x512 square thumbnail for a title cover.
# Usage: scripts/book-cover.sh <input-image> <output-path>

set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -ne 2 ]; then
  echo "Usage: scripts/book-cover.sh <input-image> <output-path>" >&2; exit 1
fi

INPUT="$1"; OUTPUT="$2"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input not found: $INPUT" >&2; exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg required" >&2; exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

ffmpeg -y -i "$INPUT" \
  -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512" \
  -update 1 -pix_fmt rgba "$OUTPUT"

echo "Wrote $OUTPUT"
