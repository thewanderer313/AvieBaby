#!/usr/bin/env bash
# Convert a raw Veo 3 video into a loop-ready background.mp4 for one of the three themes.
#
# Usage:
#   scripts/boomerang.sh <input-video> <theme>
#
# Examples:
#   scripts/boomerang.sh ~/Downloads/sleepy.mp4 sleepy-ocean
#   scripts/boomerang.sh ~/Downloads/space.mp4  sparkle-space
#   scripts/boomerang.sh ~/Downloads/jungle.mp4 disco-jungle
#
# Output goes to assets/themes/<theme>/background.mp4 (overwrites the placeholder).

set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -ne 2 ]; then
  echo "Usage: scripts/boomerang.sh <input-video> <theme>" >&2
  echo "  <theme> must be one of: sleepy-ocean, sparkle-space, disco-jungle" >&2
  exit 1
fi

INPUT="$1"
THEME="$2"

case "$THEME" in
  sleepy-ocean|sparkle-space|disco-jungle) ;;
  *)
    echo "ERROR: unknown theme '$THEME'. Must be one of: sleepy-ocean, sparkle-space, disco-jungle" >&2
    exit 1
    ;;
esac

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required. Install via 'choco install ffmpeg' (Windows), 'brew install ffmpeg' (macOS), or 'apt install ffmpeg' (Linux)." >&2
  exit 1
fi

OUTPUT="assets/themes/$THEME/background.mp4"

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
echo "Reload the Expo app to see it: press 'r' in the Expo terminal."
