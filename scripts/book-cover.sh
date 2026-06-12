#!/usr/bin/env bash
# Generate a 512x512 square cover thumbnail for the book picker.
#
# Usage:
#   scripts/book-cover.sh <input-image> <book-id>
#
# Output: assets/books/<book-id>/cover.png

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/book-cover.sh <input-image> <book-id>'

if [ "$#" -ne 2 ]; then
  echo "$USAGE" >&2
  exit 1
fi

INPUT="$1"
BOOK_ID="$2"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required." >&2
  exit 1
fi

OUT_DIR="assets/books/$BOOK_ID"
mkdir -p "$OUT_DIR"
OUTPUT="$OUT_DIR/cover.png"

echo "Processing '$INPUT' -> '$OUTPUT' ..."

ffmpeg -y -i "$INPUT" \
  -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512" \
  -update 1 -pix_fmt rgba \
  "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
echo
echo "Done. Wrote $OUTPUT ($((SIZE / 1024)) KB)."
