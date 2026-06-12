#!/usr/bin/env bash
# Convert a phone voice recording (m4a, wav, aac, etc.) into a normalized
# mp3 voice label and drop it in the right theme folder.
#
# Usage:
#   scripts/voice.sh <input-recording> <theme> <character>
#
# Examples:
#   scripts/voice.sh ~/Desktop/whale.m4a       sleepy-ocean  whale
#   scripts/voice.sh ~/Desktop/jellyfish.m4a   sleepy-ocean  jellyfish
#   scripts/voice.sh ~/Desktop/starfish.m4a    sleepy-ocean  starfish
#   scripts/voice.sh ~/Desktop/rocket.m4a      sparkle-space rocket
#   scripts/voice.sh ~/Desktop/alien.m4a       sparkle-space alien
#   scripts/voice.sh ~/Desktop/comet.m4a       sparkle-space comet
#   scripts/voice.sh ~/Desktop/banana.m4a      disco-jungle  banana
#   scripts/voice.sh ~/Desktop/monkey.m4a      disco-jungle  monkey
#   scripts/voice.sh ~/Desktop/parrot.m4a      disco-jungle  parrot
#
# What it does:
#   * Strips leading and trailing silence (so the word starts immediately)
#   * Normalizes loudness to -16 LUFS so every character plays at the same volume
#   * Re-encodes to mono mp3 at 96 kbps, 44.1 kHz (small file, plenty of fidelity for voice)
#   * Writes to assets/themes/<theme>/voices/<character>.mp3 (overwrites)

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/voice.sh <input-recording> <theme> <character>
  <theme>     one of: sleepy-ocean, sparkle-space, disco-jungle
  <character> must match a character id in the chosen theme:
    sleepy-ocean:  whale | jellyfish | starfish
    sparkle-space: rocket | alien | comet
    disco-jungle:  banana | monkey | parrot'

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

# silenceremove trims start and end; loudnorm targets -16 LUFS (broadcast voice standard)
ffmpeg -y -i "$INPUT" \
  -af "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-40dB:stop_periods=1:stop_silence=0.1:stop_threshold=-40dB,loudnorm=I=-16:TP=-1.5:LRA=11" \
  -ac 1 -ar 44100 -b:a 96k \
  "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
SIZE_KB=$((SIZE / 1024))
echo
echo "Done. Wrote $OUTPUT (${SIZE_KB} KB)."
echo "Reload the Expo app to hear it: press 'r' in the Expo terminal,"
echo "then tap in the play area while audio mode is Gentle or Full."
