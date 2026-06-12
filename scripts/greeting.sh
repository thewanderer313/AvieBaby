#!/usr/bin/env bash
# Convert a recording of the launch greeting (e.g. "Hi Ava! Uncle Ryan made
# this app just for you") into a normalized mp3 that plays when the app opens.
#
# Usage:
#   scripts/greeting.sh [--keep-tail] <input-recording>
#
# Flags:
#   --keep-tail   Skip end-of-clip silence trimming. Use when the last word
#                 of your greeting (e.g. "you") gets clipped despite the
#                 default forgiving threshold. Loudness normalization still
#                 runs so the clip matches the character voice labels.
#
# Examples:
#   scripts/greeting.sh ~/Desktop/greeting.m4a
#   scripts/greeting.sh --keep-tail ~/Desktop/greeting.m4a
#
# Output: assets/greeting.mp3 (overwrites)
#
# Processing (same shape as scripts/voice.sh):
#   * Strips leading silence (aggressive: -40 dB / 50 ms) so the greeting
#     starts crisply.
#   * Strips trailing silence (gentle: -55 dB / 500 ms) unless --keep-tail.
#   * Loudness-normalizes to -16 LUFS so the greeting matches the volume of
#     the per-character voice labels.
#   * Re-encodes to mono mp3 at 96 kbps, 44.1 kHz.

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/greeting.sh [--keep-tail] <input-recording>'

KEEP_TAIL=false
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --keep-tail) KEEP_TAIL=true ;;
    -h|--help) echo "$USAGE"; exit 0 ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
set -- "${POSITIONAL[@]}"

if [ "$#" -ne 1 ]; then
  echo "$USAGE" >&2
  exit 1
fi

INPUT="$1"
OUTPUT="assets/greeting.mp3"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required. Install via 'choco install ffmpeg' (Windows), 'brew install ffmpeg' (macOS), or 'apt install ffmpeg' (Linux)." >&2
  exit 1
fi

echo "Processing '$INPUT' -> '$OUTPUT' ..."

if [ "$KEEP_TAIL" = "true" ]; then
  echo "  (--keep-tail: skipping end-of-clip silence trim)"
  AUDIO_FILTER="silenceremove=start_periods=1:start_silence=0.05:start_threshold=-40dB,loudnorm=I=-16:TP=-1.5:LRA=11"
else
  AUDIO_FILTER="silenceremove=start_periods=1:start_silence=0.05:start_threshold=-40dB:stop_periods=1:stop_silence=0.5:stop_threshold=-55dB,loudnorm=I=-16:TP=-1.5:LRA=11"
fi

ffmpeg -y -i "$INPUT" \
  -af "$AUDIO_FILTER" \
  -ac 1 -ar 44100 -b:a 96k \
  "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
SIZE_KB=$((SIZE / 1024))
echo
echo "Done. Wrote $OUTPUT (${SIZE_KB} KB)."
echo "Reload the Expo app to hear it: press 'r' in the Expo terminal,"
echo "then close and reopen AvieBaby. The greeting plays right after launch"
echo "(in Gentle or Full audio mode)."
