#!/usr/bin/env bash
# Process a single book page image into the flat library.
#
# Usage:
#   scripts/book-page.sh <input-image> <output-path>
#
# Output: writes a 1920x1080 padded PNG to <output-path>. Caller is
# responsible for choosing the filename and updating library.json.

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/book-page.sh <input-image> <output-path>'

if [ "$#" -ne 2 ]; then
  echo "$USAGE" >&2
  exit 1
fi

INPUT="$1"
OUTPUT="$2"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

echo "Processing '$INPUT' -> '$OUTPUT' ..."

ffmpeg -y -i "$INPUT" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#000000" \
  -update 1 -pix_fmt rgba \
  "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
echo
echo "Done. Wrote $OUTPUT ($((SIZE / 1024)) KB)."
