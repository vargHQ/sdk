#!/bin/bash
# Automated production script for 15 Menopause Diet campaign videos
# Prerequisites:
#   - All character images generated (✅ done)
#   - Voiceover generated (✅ done)
#   - Screencast video file at media/funnel-screencast.mp4
#   - Background music at media/background-music.mp3 (optional)
#   - FAL API credentials configured

set -e  # Exit on error

echo "🎬 Starting Menopause Campaign Video Production"
echo "==============================================="

# Load asset data
ASSETS_FILE="media/menopause-campaign-assets.json"
VOICE_URL="http://s3.varg.ai/varg/voice/1763782542061-rachel.mp3"
VOICE_LOCAL="media/voice-1763782540364.mp3"

# Create output directories
mkdir -p media/campaign/{animated,synced,captioned,hooks,final}

echo ""
echo "📋 Step 0: Generate SRT from voiceover"
echo "--------------------------------------"
if [ ! -f "media/voice-1763782540364.srt" ]; then
  bun run service/transcribe/index.ts \
    "$VOICE_LOCAL" \
    fireworks \
    media/voice-1763782540364.srt
  echo "✅ SRT file generated"
else
  echo "⏭️  SRT file already exists"
fi

echo ""
echo "🎨 Step 1: Animate all 15 character images"
echo "-------------------------------------------"
for i in {0..14}; do
  IMAGE_URL=$(jq -r ".characters[$i].imageUrl" "$ASSETS_FILE")
  PROFESSION=$(jq -r ".characters[$i].profession" "$ASSETS_FILE" | tr ' ' '-')
  OUTPUT_NUM=$((i+1))

  echo "Animating $PROFESSION ($OUTPUT_NUM/15)..."

  # Run animation
  bun run service/video/index.ts from_image \
    "person talking naturally to camera, professional demeanor" \
    "$IMAGE_URL" \
    5 \
    true \
    > "media/campaign/animated/result-$OUTPUT_NUM.json"

  # Extract video URL from result
  VIDEO_URL=$(jq -r '.uploaded' "media/campaign/animated/result-$OUTPUT_NUM.json")
  echo "$VIDEO_URL" >> media/campaign/animated/video-urls.txt

  echo "✅ Animated: $PROFESSION"
done

echo ""
echo "🎤 Step 2: Lipsync videos with voiceover"
echo "-----------------------------------------"
line_num=1
while IFS= read -r video_url; do
  echo "Lipsyncing video $line_num/15..."

  bun run service/sync/index.ts wav2lip \
    "$video_url" \
    "$VOICE_URL" \
    > "media/campaign/synced/result-$line_num.json"

  # Download the synced video
  SYNCED_URL=$(jq -r '.videoUrl' "media/campaign/synced/result-$line_num.json")
  curl -o "media/campaign/synced/video-$line_num.mp4" "$SYNCED_URL"

  echo "✅ Lipsynced video $line_num"
  ((line_num++))
done < media/campaign/animated/video-urls.txt

echo ""
echo "📝 Step 3: Add dynamic captions"
echo "--------------------------------"
for i in {1..15}; do
  echo "Adding captions to video $i/15..."

  bun run service/captions/index.ts \
    "media/campaign/synced/video-$i.mp4" \
    "media/campaign/captioned/video-$i.mp4" \
    --srt media/voice-1763782540364.srt \
    --font "Arial Black" \
    --size 32 \
    --color "&HFFFFFF"

  echo "✅ Captioned video $i"
done

echo ""
echo "🏷️  Step 4: Add subtitle and disclaimer overlays"
echo "------------------------------------------------"
for i in {1..15}; do
  echo "Adding overlays to video $i/15..."

  # Add title "My Menopause weight loss" at top
  # Add subtitle "Scientifically designed for women 40+" near bottom
  # Add disclaimer at bottom
  ffmpeg -i "media/campaign/captioned/video-$i.mp4" \
    -vf "[in]drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='My Menopause weight loss':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=60:box=1:boxcolor=black@0.7:boxborderw=10:borderw=2:bordercolor=white,\
drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='Scientifically designed for women 40+':fontcolor=white:fontsize=16:x=(w-text_w)/2:y=h-100:alpha=0.9,\
drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='Results may vary. Always consult your doctor before starting any diet program':fontcolor=white:fontsize=12:x=(w-text_w)/2:y=h-60:alpha=0.8[out]" \
    -codec:a copy \
    -y \
    "media/campaign/hooks/hook-$i.mp4"

  echo "✅ Added overlays to video $i"
done

echo ""
echo "🎞️  Step 5: Prepare screencast with music"
echo "-----------------------------------------"
if [ ! -f "media/funnel-screencast.mp4" ]; then
  echo "❌ ERROR: media/funnel-screencast.mp4 not found!"
  echo "   Please provide the menopause funnel screencast."
  exit 1
fi

if [ -f "media/background-music.mp3" ]; then
  echo "Adding music to screencast..."
  ffmpeg -i media/funnel-screencast.mp4 \
    -i media/background-music.mp3 \
    -c:v copy \
    -map 0:v:0 \
    -map 1:a:0 \
    -shortest \
    -y \
    media/campaign/funnel-with-music.mp4
  echo "✅ Music added to screencast"
else
  echo "⚠️  No background music found, using screencast as-is"
  cp media/funnel-screencast.mp4 media/campaign/funnel-with-music.mp4
fi

echo ""
echo "🔗 Step 6: Merge hooks with screencast"
echo "---------------------------------------"
for i in {1..15}; do
  echo "Merging video $i/15..."

  # Create concat file
  echo "file '../../hooks/hook-$i.mp4'" > "media/campaign/concat-$i.txt"
  echo "file '../funnel-with-music.mp4'" >> "media/campaign/concat-$i.txt"

  # Merge
  ffmpeg -f concat -safe 0 -i "media/campaign/concat-$i.txt" \
    -c copy \
    -y \
    "media/campaign/merged-$i.mp4"

  echo "✅ Merged video $i"
done

echo ""
echo "📱 Step 7: Optimize for social media (TikTok vertical)"
echo "-------------------------------------------------------"
for i in {0..14}; do
  VIDEO_NUM=$((i+1))
  PROFESSION=$(jq -r ".characters[$i].profession" "$ASSETS_FILE" | tr ' ' '-')

  echo "Optimizing $PROFESSION ($VIDEO_NUM/15)..."

  bun run service/edit/index.ts social \
    "media/campaign/merged-$VIDEO_NUM.mp4" \
    "media/campaign/final/$PROFESSION-tiktok.mp4" \
    tiktok

  echo "✅ Final video: $PROFESSION"
done

echo ""
echo "✨ PRODUCTION COMPLETE!"
echo "======================"
echo ""
echo "📊 Summary:"
echo "  • 15 character images ✅"
echo "  • 1 voiceover audio ✅"
echo "  • 15 animated videos ✅"
echo "  • 15 lipsynced videos ✅"
echo "  • 15 captioned videos ✅"
echo "  • 15 final videos with overlays ✅"
echo ""
echo "📁 Final videos location: media/campaign/final/"
echo ""
echo "🎯 Next steps:"
echo "  1. Review all 15 videos"
echo "  2. Test on target platforms"
echo "  3. Upload to ad platform"
echo "  4. Start A/B testing!"
echo ""

# List all final files
echo "📋 Final video files:"
ls -lh media/campaign/final/
