#!/usr/bin/env bash
# Normalize a voice recording into a mono mp3 ready for the library.
#
# Usage:
#   scripts/book-voice.sh [--keep-tail] <input-audio> <output-path>

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/book-voice.sh [--keep-tail] <input-audio> <output-path>'

KEEP_TAIL=0
POSITIONAL=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --keep-tail) KEEP_TAIL=1; shift ;;
    -h|--help) echo "$USAGE"; exit 0 ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
set -- "${POSITIONAL[@]}"

if [ "$#" -ne 2 ]; then
  echo "$USAGE" >&2; exit 1
fi

INPUT="$1"; OUTPUT="$2"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input not found: $INPUT" >&2; exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg required" >&2; exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

SILREMOVE_START="silenceremove=start_periods=1:start_silence=0.05:start_threshold=-55dB"
SILREMOVE_END="silenceremove=stop_periods=-1:stop_silence=0.5:stop_threshold=-55dB"

if [ "$KEEP_TAIL" -eq 1 ]; then
  FILTER="$SILREMOVE_START,loudnorm=I=-16:LRA=11:TP=-1.5"
else
  FILTER="$SILREMOVE_START,loudnorm=I=-16:LRA=11:TP=-1.5,$SILREMOVE_END"
fi

ffmpeg -y -i "$INPUT" -af "$FILTER" -ac 1 -ar 44100 -b:a 96k -c:a libmp3lame "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
echo "Done. Wrote $OUTPUT ($((SIZE / 1024)) KB)."
