#!/bin/bash
# Convert still frame to video with ken burns effect (slow zoom)
# Usage: ./still-to-video.sh <input.jpg> <output.mp4> <duration> [zoom_direction]
# zoom_direction: in (default), out

INPUT=$1
OUTPUT=$2
DURATION=$3
ZOOM=${4:-"in"}

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ] || [ -z "$DURATION" ]; then
  echo "Usage: ./still-to-video.sh <input.jpg> <output.mp4> <duration> [in|out]"
  exit 1
fi

# Get input dimensions
WIDTH=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$INPUT")
HEIGHT=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$INPUT")

echo "Creating $DURATION sec video from $INPUT ($WIDTH x $HEIGHT)..."

if [ "$ZOOM" = "out" ]; then
  # Zoom out: start zoomed in, end at normal
  FILTER="zoompan=z='1.2-0.2*on/(${DURATION}*25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${DURATION}*25:s=${WIDTH}x${HEIGHT}:fps=25"
else
  # Zoom in: start normal, end zoomed
  FILTER="zoompan=z='1+0.2*on/(${DURATION}*25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${DURATION}*25:s=${WIDTH}x${HEIGHT}:fps=25"
fi

ffmpeg -y -loop 1 -i "$INPUT" \
  -vf "$FILTER" \
  -t "$DURATION" \
  -c:v libx264 -preset fast -crf 20 \
  -pix_fmt yuv420p \
  "$OUTPUT"

echo "Done: $OUTPUT"
