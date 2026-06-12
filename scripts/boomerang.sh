#!/usr/bin/env bash
# Convert a raw Veo 3 video into a loop-ready background.mp4 for one of the three themes.
#
# Two modes:
#
#   1. From an external file (e.g. fresh Veo download in ~/Downloads):
#        scripts/boomerang.sh <input-video> <theme>
#      Example: scripts/boomerang.sh ~/Downloads/sleepy.mp4 sleepy-ocean
#
#   2. In place (you already dropped the raw Veo file at assets/themes/<theme>/background.mp4):
#        scripts/boomerang.sh <theme>
#      Example: scripts/boomerang.sh sleepy-ocean
#      The original is backed up as background.raw.mp4 in the same folder so you can re-run
#      the boomerang if you want different output. *.raw.mp4 is gitignored.
#
# <theme> must be one of: sleepy-ocean, sparkle-space, disco-jungle

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage:
  scripts/boomerang.sh <input-video> <theme>      # from external file
  scripts/boomerang.sh <theme>                    # in place (file already at assets/themes/<theme>/background.mp4)
  <theme> must be one of: sleepy-ocean, sparkle-space, disco-jungle'

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "$USAGE" >&2
  exit 1
fi

if [ "$#" -eq 2 ]; then
  INPUT="$1"
  THEME="$2"
  MODE="external"
else
  INPUT=""   # set after we resolve the theme path
  THEME="$1"
  MODE="in-place"
fi

case "$THEME" in
  sleepy-ocean|sparkle-space|disco-jungle) ;;
  *)
    echo "ERROR: unknown theme '$THEME'." >&2
    echo "$USAGE" >&2
    exit 1
    ;;
esac

OUTPUT="assets/themes/$THEME/background.mp4"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required. Install via 'choco install ffmpeg' (Windows), 'brew install ffmpeg' (macOS), or 'apt install ffmpeg' (Linux)." >&2
  exit 1
fi

if [ "$MODE" = "in-place" ]; then
  if [ ! -f "$OUTPUT" ]; then
    echo "ERROR: no file at $OUTPUT to process in place." >&2
    echo "Drop your raw Veo video there first, or use the two-argument form." >&2
    exit 1
  fi
  RAW="assets/themes/$THEME/background.raw.mp4"
  echo "In-place mode. Backing up current $OUTPUT -> $RAW"
  mv -f "$OUTPUT" "$RAW"
  INPUT="$RAW"
fi

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

echo "Boomeranging '$INPUT' -> '$OUTPUT' ..."

ffmpeg -y -i "$INPUT" \
  -filter_complex "[0:v]reverse[r];[0:v][r]concat=n=2:v=1:a=0[v]" \
  -map "[v]" \
  -vf "scale=720:-2" \
  -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart -an \
  "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
SIZE_KB=$((SIZE / 1024))
echo
echo "Done. Wrote $OUTPUT (${SIZE_KB} KB)."
if [ "$MODE" = "in-place" ]; then
  echo "Original raw file kept at assets/themes/$THEME/background.raw.mp4 (gitignored)."
  echo "Delete it once you're happy with the result, or re-run this script if you want different output."
fi
echo "Reload the Expo app to see it: press 'r' in the Expo terminal."
