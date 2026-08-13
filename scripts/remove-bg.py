"""Remove watermark and white background from generated sprite strips."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

WHITE_THRESHOLD = 235  # pixels with all RGB >= this become transparent
WATERMARK_W = 300     # width of watermark area to paint over
WATERMARK_H = 80      # height of watermark area to paint over

def process_strip(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size

    # Paint white over the watermark area (bottom-right corner)
    draw = ImageDraw.Draw(img)
    draw.rectangle(
        [w - WATERMARK_W, h - WATERMARK_H, w, h],
        fill=(255, 255, 255, 255)
    )

    # Remove near-white background: make transparent
    pixels = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD:
                pixels[x, y] = (r, g, b, 0)

    img.save(output_path, "PNG")
    print(f"Processed: {input_path} -> {output_path}")

if __name__ == "__main__":
    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)
    for png in sorted(input_dir.glob("*.png")):
        process_strip(png, output_dir / png.name)
