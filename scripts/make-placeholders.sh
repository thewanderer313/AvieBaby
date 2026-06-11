#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p assets/placeholder assets/sfx
mkdir -p assets/themes/sleepy-ocean/{music,characters,voices}
mkdir -p assets/themes/sparkle-space/{music,characters,voices}
mkdir -p assets/themes/disco-jungle/{music,characters,voices}

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required. Install via 'brew install ffmpeg' (mac), 'choco install ffmpeg' (windows), or 'apt install ffmpeg' (linux)." >&2
  exit 1
fi

# 1-second silent mp3
ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 -q:a 9 assets/placeholder/silent.mp3
# 1-second black 720x1280 mp4 (portrait)
ffmpeg -y -f lavfi -i color=c=black:s=720x1280:d=1 -c:v libx264 -pix_fmt yuv420p -movflags +faststart assets/placeholder/blank.mp4
# 1x1 transparent png
ffmpeg -y -f lavfi -i color=c=00000000:s=1x1:d=1 -frames:v 1 -update 1 assets/placeholder/transparent.png

# SFX placeholders (silent for now — adult can replace with real chime/pop)
cp assets/placeholder/silent.mp3 assets/sfx/sparkle.mp3
cp assets/placeholder/silent.mp3 assets/sfx/spawn.mp3

# Per-theme stubs
for theme in sleepy-ocean sparkle-space disco-jungle; do
  cp assets/placeholder/blank.mp4        assets/themes/$theme/background.mp4
  cp assets/placeholder/silent.mp3       assets/themes/$theme/music/track-1.mp3
  cp assets/placeholder/silent.mp3       assets/themes/$theme/music/track-2.mp3
done

# Per-character stubs (one set per theme)
declare -A CHARS=(
  [sleepy-ocean]="whale jellyfish starfish"
  [sparkle-space]="rocket alien comet"
  [disco-jungle]="banana monkey parrot"
)
for theme in "${!CHARS[@]}"; do
  for c in ${CHARS[$theme]}; do
    cp assets/placeholder/transparent.png assets/themes/$theme/characters/$c.png
    cp assets/placeholder/silent.mp3      assets/themes/$theme/voices/$c.mp3
  done
done

echo "Placeholders created."
