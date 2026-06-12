#!/usr/bin/env bash
# Convert a recording of one book page into a normalized mp3 voice track.
# Optionally stamps the reader's display name into book.json so the registry
# generator can produce the correct name in the picker.
#
# Usage:
#   scripts/book-voice.sh [--keep-tail] [--reader-name "Display Name"] \
#                        <input-audio> <book-id> <reader-id> <page-number>
#
# Examples:
#   scripts/book-voice.sh ~/Desktop/page01-ryan.m4a goodnight-moon ryan 1
#   scripts/book-voice.sh --reader-name "Uncle Ryan" ~/Desktop/page01-ryan.m4a goodnight-moon ryan 1
#   scripts/book-voice.sh --keep-tail ~/Desktop/page05-ryan.m4a goodnight-moon ryan 5
#
# Output:
#   assets/books/<book-id>/voices/<reader-id>/page-NN.mp3
#   assets/books/<book-id>/book.json (updated with reader name if --reader-name given)

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/book-voice.sh [--keep-tail] [--reader-name "Name"] <input-audio> <book-id> <reader-id> <page-number>'

KEEP_TAIL=false
READER_NAME=""
POSITIONAL=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --keep-tail)
      KEEP_TAIL=true
      shift
      ;;
    --reader-name)
      READER_NAME="${2:-}"
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

if [ "$#" -ne 4 ]; then
  echo "$USAGE" >&2
  exit 1
fi

INPUT="$1"
BOOK_ID="$2"
READER_ID="$3"
PAGE_NUM="$4"

if ! [[ "$PAGE_NUM" =~ ^[0-9]+$ ]] || [ "$PAGE_NUM" -lt 1 ] || [ "$PAGE_NUM" -gt 99 ]; then
  echo "ERROR: page number must be an integer between 1 and 99." >&2
  exit 1
fi

if [ ! -d "assets/books/$BOOK_ID" ]; then
  echo "ERROR: no book directory at assets/books/$BOOK_ID. Process a page first with book-page.sh." >&2
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
OUT_DIR="assets/books/$BOOK_ID/voices/$READER_ID"
mkdir -p "$OUT_DIR"
OUTPUT="$OUT_DIR/page-$PAGE_NN.mp3"

if [ "$KEEP_TAIL" = "true" ]; then
  echo "  (--keep-tail: skipping end-of-clip silence trim)"
  AUDIO_FILTER="silenceremove=start_periods=1:start_silence=0.05:start_threshold=-40dB,loudnorm=I=-16:TP=-1.5:LRA=11"
else
  AUDIO_FILTER="silenceremove=start_periods=1:start_silence=0.05:start_threshold=-40dB:stop_periods=1:stop_silence=0.5:stop_threshold=-55dB,loudnorm=I=-16:TP=-1.5:LRA=11"
fi

echo "Processing '$INPUT' -> '$OUTPUT' ..."

ffmpeg -y -i "$INPUT" \
  -af "$AUDIO_FILTER" \
  -ac 1 -ar 44100 -b:a 96k \
  "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
echo
echo "Done. Wrote $OUTPUT ($((SIZE / 1024)) KB)."

# Stamp reader display name into book.json, if given.
if [ -n "$READER_NAME" ]; then
  INFO_PATH="assets/books/$BOOK_ID/book.json"
  READER_ID="$READER_ID" READER_NAME="$READER_NAME" INFO_PATH="$INFO_PATH" BOOK_ID="$BOOK_ID" node -e '
    const fs = require("fs");
    const p = process.env.INFO_PATH;
    const rid = process.env.READER_ID;
    const rname = process.env.READER_NAME;
    let info = { title: process.env.BOOK_ID, readers: {} };
    if (fs.existsSync(p)) {
      info = JSON.parse(fs.readFileSync(p, "utf8"));
      if (!info.readers) info.readers = {};
    }
    info.readers[rid] = rname;
    fs.writeFileSync(p, JSON.stringify(info, null, 2) + "\n");
    console.log("  (book.json reader \"" + rid + "\" name set to: " + rname + ")");
  '
fi
