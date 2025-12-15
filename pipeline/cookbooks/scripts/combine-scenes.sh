#!/bin/bash
# Combine multiple scene videos with audio clips
# Usage: ./combine-scenes.sh <project_dir>

PROJECT_DIR=${1:-"media/girl-ruined-you"}

# Scene timing configuration (adjust as needed)
# Format: scene_num:start_time:duration
SCENES=(
  "1:0:3.5"
  "2:3.5:6.5"
  "3:10:10"
  "4:20:15"
  "5:35:7"
)

echo "Extracting audio clips..."
for scene_config in "${SCENES[@]}"; do
  IFS=':' read -r num start dur <<< "$scene_config"
  ffmpeg -y -i "$PROJECT_DIR/voiceover.mp3" -ss "$start" -t "$dur" "$PROJECT_DIR/audio_scene${num}.mp3" 2>/dev/null
  echo "  audio_scene${num}.mp3 ($dur sec)"
done

echo ""
echo "Combining videos with audio..."
for scene_config in "${SCENES[@]}"; do
  IFS=':' read -r num start dur <<< "$scene_config"
  
  # Calculate loop count needed (5s videos)
  loops=$(echo "($dur / 5) - 1" | bc)
  if [ "$loops" -lt 0 ]; then loops=0; fi
  
  ffmpeg -y -stream_loop "$loops" -i "$PROJECT_DIR/scene${num}_video.mp4" \
    -i "$PROJECT_DIR/audio_scene${num}.mp3" \
    -t "$dur" -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 128k -shortest \
    "$PROJECT_DIR/scene${num}_final.mp4" 2>/dev/null
  echo "  scene${num}_final.mp4"
done

echo ""
echo "Creating concat file..."
rm -f "$PROJECT_DIR/scenes.txt"
for scene_config in "${SCENES[@]}"; do
  IFS=':' read -r num start dur <<< "$scene_config"
  echo "file 'scene${num}_final.mp4'" >> "$PROJECT_DIR/scenes.txt"
done

echo "Concatenating all scenes..."
cd "$PROJECT_DIR" && ffmpeg -y -f concat -safe 0 -i scenes.txt -c copy combined_scenes.mp4 2>/dev/null

duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 combined_scenes.mp4)
echo ""
echo "Done! combined_scenes.mp4 ($duration sec)"
