#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/sniper-lion-main/Documents/EstateHat_files/estatehat-clean"
OUT_DIR="$ROOT/public/landing/video"
BUILD_DIR="$ROOT/.tmp/estatehat-video"
FONT_SANS="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_SERIF="/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"

mkdir -p "$OUT_DIR" "$BUILD_DIR"
rm -f "$BUILD_DIR"/*

create_scene() {
  local scene_id="$1"
  local duration="$2"
  local image="$3"
  local title="$4"
  local body="$5"
  local badge="$6"
  local tts_text="$7"

  local wav="$BUILD_DIR/${scene_id}.wav"
  local mp4="$BUILD_DIR/${scene_id}.mp4"
  local title_txt="$BUILD_DIR/${scene_id}-title.txt"
  local body_txt="$BUILD_DIR/${scene_id}-body.txt"
  local footer_txt="$BUILD_DIR/${scene_id}-footer.txt"
  local badge_txt="$BUILD_DIR/${scene_id}-badge.txt"

  espeak -s 165 -w "$wav" "$tts_text"
  printf "%s" "$title" > "$title_txt"
  printf "%s" "$body" > "$body_txt"
  printf "%s" "EstateHat  |  A calmer way to sell or buy a home" > "$footer_txt"
  printf "%s" "$badge" > "$badge_txt"

  if [[ "$image" == "none" ]]; then
    ffmpeg -y \
      -f lavfi -i "color=c=#0f5b52:s=1920x1080:d=${duration}" \
      -i "$wav" \
      -filter_complex "\
        drawbox=x=80:y=72:w=540:h=58:color=#d4a053@0.20:t=fill,\
        drawtext=fontfile=${FONT_SANS}:textfile=${badge_txt}:fontcolor=0xF4F7F3:fontsize=34:x=110:y=86,\
        drawtext=fontfile=${FONT_SERIF}:textfile=${title_txt}:fontcolor=white:fontsize=70:line_spacing=12:x=104:y=200,\
        drawtext=fontfile=${FONT_SANS}:textfile=${body_txt}:fontcolor=0xE7EFEA:fontsize=34:line_spacing=18:x=108:y=470:box=1:boxcolor=0x042529@0.24:boxborderw=22,\
        drawtext=fontfile=${FONT_SANS}:textfile=${footer_txt}:fontcolor=0xA8D7D1:fontsize=28:x=108:y=920" \
      -c:v libx264 -pix_fmt yuv420p -r 30 -shortest "$mp4"
    return
  fi

  ffmpeg -y \
    -loop 1 -t "$duration" -i "$image" \
    -i "$wav" \
    -filter_complex "\
      [0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=brightness=-0.03:saturation=1.03,format=yuv420p[bg];\
      [bg]drawbox=x=0:y=0:w=1920:h=1080:color=#042529@0.42:t=fill,\
      drawbox=x=96:y=86:w=440:h=54:color=#d4a053@0.20:t=fill,\
      drawtext=fontfile=${FONT_SANS}:textfile=${badge_txt}:fontcolor=0xF4F7F3:fontsize=30:x=124:y=100,\
      drawtext=fontfile=${FONT_SERIF}:textfile=${title_txt}:fontcolor=white:fontsize=60:line_spacing=12:x=108:y=214,\
      drawbox=x=104:y=470:w=920:h=258:color=#042529@0.28:t=fill,\
      drawtext=fontfile=${FONT_SANS}:textfile=${body_txt}:fontcolor=0xF2F6F3:fontsize=26:line_spacing=18:x=128:y=506,\
      drawbox=x=108:y=830:w=28:h=28:color=#67F0D7@0.95:t=fill,\
      drawtext=fontfile=${FONT_SANS}:textfile=${footer_txt}:fontcolor=0xDDEAE6:fontsize=28:x=154:y=830" \
    -c:v libx264 -pix_fmt yuv420p -r 30 -shortest "$mp4"
}

create_scene "scene1" "6" "none" \
  "EstateHat helps keep a home sale in one place." \
  "This walkthrough explains the process in plain language, from setup to closing." \
  "EstateHat explainer" \
  "EstateHat helps keep a home sale in one place. This walkthrough explains the process in plain language, from setup to closing."

create_scene "scene2" "8" "$ROOT/public/landing/estatehat-intro-workflow.png" \
  "Start with one account and one workspace." \
  "Create your EstateHat account, choose your role, and keep listings, messages, forms, and reminders connected instead of scattered across tabs and texts." \
  "Step 1" \
  "Start with one account and one workspace. Create your EstateHat account, choose your role, and keep listings, messages, forms, and reminders connected instead of scattered across tabs and texts."

create_scene "scene3" "8" "$ROOT/public/landing/estatehat-intro-closing.png" \
  "Build trust before the deal moves forward." \
  "EstateHat emphasizes verified identities, role checks, and clearer transaction boundaries so buyers and sellers know who they are working with." \
  "Step 2" \
  "Build trust before the deal moves forward. EstateHat emphasizes verified identities, role checks, and clearer transaction boundaries so buyers and sellers know who they are working with."

create_scene "scene4" "8" "none" \
  "Follow the path: list or search, complete forms, then close." \
  "Use Move Kit, Forms, Hat Data, and guided next steps to keep the process visible as the transaction heads toward closing." \
  "Step 3" \
  "Follow the path. List or search, complete forms, then close. Use Move Kit, Forms, Hat Data, and guided next steps to keep the process visible as the transaction heads toward closing."

create_scene "scene5" "8" "$ROOT/public/landing/estatehat-intro-closing.png" \
  "See the cost story early and keep money boundaries clear." \
  "The current site presents a one point five percent platform fee model, no upfront listing fee, and licensed third party escrow handling for funds." \
  "Step 4" \
  "See the cost story early and keep money boundaries clear. The current site presents a one point five percent platform fee model, no upfront listing fee, and licensed third party escrow handling for funds."

printf "file '%s/scene1.mp4'\nfile '%s/scene2.mp4'\nfile '%s/scene3.mp4'\nfile '%s/scene4.mp4'\nfile '%s/scene5.mp4'\n" \
  "$BUILD_DIR" "$BUILD_DIR" "$BUILD_DIR" "$BUILD_DIR" "$BUILD_DIR" > "$BUILD_DIR/concat.txt"

ffmpeg -y \
  -f concat -safe 0 -i "$BUILD_DIR/concat.txt" \
  -c copy "$OUT_DIR/estatehat-explainer.mp4"

echo "Wrote $OUT_DIR/estatehat-explainer.mp4"
