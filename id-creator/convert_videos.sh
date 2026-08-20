#!/bin/bash
# convert_videos.sh
# Converts .webm videos in /videos to optimized .gif files.

set -e

VIDEO_DIR="videos"

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed. Please install it first."
    exit 1
fi

echo "Converting WebM videos to optimized GIFs..."

for webm in "$VIDEO_DIR"/*.webm; do
    if [ -f "$webm" ]; then
        filename=$(basename "$webm" .webm)
        gif_path="$VIDEO_DIR/$filename.gif"
        
        echo "Converting: $webm -> $gif_path"
        
        # High quality palette-based conversion:
        # - fps=10: lower frame rate to reduce size
        # - scale=800:-1: scale width to 800px, maintain aspect ratio
        # - palettegen/paletteuse: generates a custom color palette for best quality
        ffmpeg -y -i "$webm" -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "$gif_path"
    fi
done

echo "Conversion complete!"
