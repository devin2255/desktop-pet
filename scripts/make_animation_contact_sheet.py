from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1] / "assets" / "animations" / "v2"
FRAMES = ROOT / "frames"
ACTIONS = {"idle": 4, "walk": 6, "sit": 4, "sleep": 4, "reaction": 4}
CELL_WIDTH, CELL_HEIGHT, LABEL_HEIGHT = 120, 112, 18

sheet = Image.new(
    "RGB",
    (max(ACTIONS.values()) * CELL_WIDTH, len(ACTIONS) * (CELL_HEIGHT + LABEL_HEIGHT)),
    "white",
)
draw = ImageDraw.Draw(sheet)

for row, (action, frame_count) in enumerate(ACTIONS.items()):
    row_y = row * (CELL_HEIGHT + LABEL_HEIGHT)
    draw.text((4, row_y + 2), f"{action} ({frame_count})", fill="#55483e")
    for index in range(frame_count):
        frame = Image.open(FRAMES / action / f"{index + 1:02d}.png").convert("RGBA")
        frame.thumbnail((CELL_WIDTH - 12, CELL_HEIGHT - 12), Image.Resampling.LANCZOS)
        x0, y0 = index * CELL_WIDTH, row_y + LABEL_HEIGHT
        for y in range(y0, y0 + CELL_HEIGHT, 12):
            for x in range(x0, x0 + CELL_WIDTH, 12):
                color = "#ece8e1" if ((x - x0) // 12 + (y - y0) // 12) % 2 else "#faf8f4"
                draw.rectangle(
                    (x, y, min(x + 12, x0 + CELL_WIDTH), min(y + 12, y0 + CELL_HEIGHT)),
                    fill=color,
                )
        px = x0 + (CELL_WIDTH - frame.width) // 2
        py = y0 + CELL_HEIGHT - frame.height - 4
        sheet.paste(frame, (px, py), frame)

sheet.save(ROOT / "contact-sheet.jpg", quality=68, optimize=True)
print(ROOT / "contact-sheet.jpg")
