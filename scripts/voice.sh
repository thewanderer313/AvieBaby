#!/usr/bin/env bash
# Convert a phone voice recording (m4a, wav, aac, etc.) into a normalized
# mp3 voice label and drop it in the right theme folder.
#
# Usage:
#   scripts/voice.sh [--keep-tail] <input-recording> <theme> <character>
#
# Flags:
#   --keep-tail   Skip end-of-clip silence trimming. Use for recordings where
#                 a soft trailing consonant (like the "-sh" in "starfish") is
#                 being clipped even with the default forgiving threshold.
#                 Loudness normalization still runs, so the clip blends fine.
#
# Examples:
#   scripts/voice.sh ~/Desktop/whale.m4a              sleepy-ocean  whale
#   scripts/voice.sh ~/Desktop/jellyfish.m4a          sleepy-ocean  jellyfish
#   scripts/voice.sh --keep-tail ~/Desktop/starfish.m4a sleepy-ocean starfish
#   scripts/voice.sh ~/Desktop/banana.m4a             disco-jungle  banana
#
# What it does:
#   * Strips leading silence (so the word starts immediately)
#   * Strips trailing silence too, unless --keep-tail
#   * Normalizes loudness to -16 LUFS so every character plays at the same volume
#   * Re-encodes to mono mp3 at 96 kbps, 44.1 kHz
#   * Writes to assets/themes/<theme>/voices/<character>.mp3 (overwrites)

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/voice.sh [--keep-tail] <input-recording> <theme> <character>
  <theme>     one of: sleepy-ocean, sparkle-space, disco-jungle
  <character> must match a character id in the chosen theme:
    sleepy-ocean:  whale | jellyfish | starfish
    sparkle-space: rocket | alien | comet
    disco-jungle:  banana | monkey | parrot'

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

if [ "$#" -ne 3 ]; then
  echo "$USAGE" >&2
  exit 1
fi

INPUT="$1"
THEME="$2"
CHAR="$3"

declare -A VALID_CHARS=(
  [sleepy-ocean]="whale jellyfish starfish"
  [sparkle-space]="rocket alien comet"
  [disco-jungle]="banana monkey parrot"
)

if [ -z "${VALID_CHARS[$THEME]:-}" ]; then
  echo "ERROR: unknown theme '$THEME'." >&2
  echo "$USAGE" >&2
  exit 1
fi

if [[ " ${VALID_CHARS[$THEME]} " != *" $CHAR "* ]]; then
  echo "ERROR: '$CHAR' is not a character in '$THEME'." >&2
  echo "Valid characters for $THEME: ${VALID_CHARS[$THEME]}" >&2
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required. Install via 'choco install ffmpeg' (Windows), 'brew install ffmpeg' (macOS), or 'apt install ffmpeg' (Linux)." >&2
  exit 1
fi

OUTPUT="assets/themes/$THEME/voices/$CHAR.mp3"

echo "Processing '$INPUT' -> '$OUTPUT' ..."

if [ "$KEEP_TAIL" = "true" ]; then
  echo "  (--keep-tail: skipping end-of-clip silence trim)"
  AUDIO_FILTER="silenceremove=start_periods=1:start_silence=0.05:start_threshold=-40dB,loudnorm=I=-16:TP=-1.5:LRA=11"
else
  # Tail trim is intentionally forgiving (-55 dB, 500 ms) so soft trailing
  # consonants like "-sh" in "jellyfish" don't get clipped. If yours still
  # clip, re-run with --keep-tail.
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
echo "then tap in the play area while audio mode is Gentle or Full."
