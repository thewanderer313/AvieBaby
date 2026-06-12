#!/usr/bin/env bash
# Convert a book page image into a 1920x1080 padded PNG sized for the
# landscape book mode. Preserves aspect ratio; pads with black if needed.
# Optionally stamps the book's display title into assets/books/<id>/book.json
# so scripts/book-register.js can regenerate the TS registry without manual edits.
#
# Usage:
#   scripts/book-page.sh [--title "Display Title"] <input-image> <book-id> <page-number>
#
# Examples:
#   scripts/book-page.sh ~/Desktop/page-01.jpg goodnight-moon 1
#   scripts/book-page.sh --title "Goodnight Moon" ~/Desktop/page-01.jpg goodnight-moon 1
#
# Output:
#   assets/books/<book-id>/pages/page-NN.png (zero-padded NN)
#   assets/books/<book-id>/book.json (created/updated if --title given)

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/book-page.sh [--title "Display Title"] <input-image> <book-id> <page-number>'

TITLE=""
POSITIONAL=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --title)
      TITLE="${2:-}"
      shift 2
      ;;
    -h|--help)
      echo "$USAGE"
      exit 0
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done
set -- "${POSITIONAL[@]}"

if [ "$#" -ne 3 ]; then
  echo "$USAGE" >&2
  exit 1
fi

INPUT="$1"
BOOK_ID="$2"
PAGE_NUM="$3"

if ! [[ "$PAGE_NUM" =~ ^[0-9]+$ ]] || [ "$PAGE_NUM" -lt 1 ] || [ "$PAGE_NUM" -gt 99 ]; then
  echo "ERROR: page number must be an integer between 1 and 99." >&2
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required." >&2
  exit 1
fi

PAGE_NN=$(printf '%02d' "$PAGE_NUM")
OUT_DIR="assets/books/$BOOK_ID/pages"
mkdir -p "$OUT_DIR"
OUTPUT="$OUT_DIR/page-$PAGE_NN.png"

echo "Processing '$INPUT' -> '$OUTPUT' ..."

ffmpeg -y -i "$INPUT" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#000000" \
  -update 1 -pix_fmt rgba \
  "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
echo
echo "Done. Wrote $OUTPUT ($((SIZE / 1024)) KB)."

# Stamp book.json with the title, if provided. Use Node so apostrophes and
# unicode in the title don't have to be shell-escaped.
if [ -n "$TITLE" ]; then
  INFO_PATH="assets/books/$BOOK_ID/book.json"
  BOOK_ID="$BOOK_ID" TITLE="$TITLE" INFO_PATH="$INFO_PATH" node -e '
    const fs = require("fs");
    const p = process.env.INFO_PATH;
    const title = process.env.TITLE;
    let info = { title, readers: {} };
    if (fs.existsSync(p)) {
      info = JSON.parse(fs.readFileSync(p, "utf8"));
      info.title = title;
      if (!info.readers) info.readers = {};
    }
    fs.writeFileSync(p, JSON.stringify(info, null, 2) + "\n");
    console.log("  (book.json title set to: " + title + ")");
  '
fi
