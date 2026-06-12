#!/usr/bin/env bash
# Generate all app icon variants from a single 1024x1024 source PNG.
#
# Usage:
#   scripts/icon.sh <input.png> [background-color-hex]
#
# Examples:
#   scripts/icon.sh ~/Desktop/aviebaby-icon.png
#   scripts/icon.sh ~/Desktop/aviebaby-icon.png "#FF69B4"
#
# Produces (overwrites):
#   assets/icon.png                      1024x1024 (iOS home-screen icon, App Store)
#   assets/splash-icon.png               1024x1024 (logo on the splash screen)
#   assets/android-icon-foreground.png   432x432, ~30% safe-area padding so a
#                                        circular mask on Android doesn't crop
#                                        important content
#   assets/android-icon-background.png   432x432 solid color (defaults to black,
#                                        override with the optional second arg)
#
# Leaves assets/android-icon-monochrome.png alone — Android 13+ uses it for
# themed icons; if you ever want a custom one, draw a white silhouette of your
# icon at 432x432 and drop it in.
#
# Also reminder: if you change the background hex here, update app.json
#   expo.android.adaptiveIcon.backgroundColor
# and (if you want the splash to match) expo.splash.backgroundColor.

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/icon.sh <input.png> [background-color-hex]'

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "$USAGE" >&2
  exit 1
fi

INPUT="$1"
BG_COLOR="${2:-#000000}"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required." >&2
  exit 1
fi

echo "Generating icon variants from '$INPUT' (background $BG_COLOR)..."

# iOS / general icon: square 1024x1024.
# scale+crop forces a square output regardless of input aspect ratio.
ffmpeg -y -i "$INPUT" \
  -vf "scale=1024:1024:force_original_aspect_ratio=increase,crop=1024:1024" \
  -update 1 -pix_fmt rgba \
  assets/icon.png

# Splash screen icon: same as the main icon.
cp -f assets/icon.png assets/splash-icon.png

# Android adaptive foreground: 432x432 with safe-area padding.
# Important content fits inside a 302x302 central square so a circular
# launcher mask (Pixel, OnePlus, etc) doesn't cut it off.
ffmpeg -y -i "$INPUT" \
  -vf "scale=302:302:force_original_aspect_ratio=decrease,pad=432:432:(ow-iw)/2:(oh-ih)/2:color=#00000000" \
  -update 1 -pix_fmt rgba \
  assets/android-icon-foreground.png

# Android adaptive background: solid color, 432x432.
ffmpeg -y -f lavfi -i "color=c=$BG_COLOR:s=432x432:d=1" \
  -frames:v 1 -update 1 -pix_fmt rgba \
  assets/android-icon-background.png

echo
echo "Done. Wrote:"
echo "  assets/icon.png                       (1024x1024 — iOS + universal)"
echo "  assets/splash-icon.png                (1024x1024 — splash logo)"
echo "  assets/android-icon-foreground.png    (432x432  — Android adaptive fg)"
echo "  assets/android-icon-background.png    (432x432  — solid $BG_COLOR)"
echo
echo "Don't forget to update app.json colors if you changed the background:"
echo "  expo.android.adaptiveIcon.backgroundColor"
echo "  expo.splash.backgroundColor"
echo
echo "Reload the Expo app to see the splash: press 'r' in the Expo terminal,"
echo "then fully close and reopen AvieBaby."
