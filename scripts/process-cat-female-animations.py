"""Deterministically prepare the six-frame cat/female sheets for Phaser."""

from pathlib import Path
from statistics import median
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/characters/cat/animations/female"
OUTPUT = SOURCE / "processed"
PUBLIC = ROOT / "public/assets/characters/cat/animations/female/processed"
NAMES = ("walk_left", "walk_right", "climb", "pickup_left", "pickup_right")
FRAME = (512, 682)
BASELINE = 670  # exclusive bottom of opaque pixels; Phaser uses 670 / 682 origin
TORSO_CENTER_Y = 475
MARGIN = 8


def alpha_bbox(image):
    return image.getchannel("A").getbbox()


def prepare(name):
    source = SOURCE / f"cat_female_{name}.png"
    with Image.open(source) as opened:
        if opened.mode != "RGBA" or opened.size[0] % 3 or opened.size[1] % 2:
            raise ValueError(f"{source}: requires RGBA and an exact 3x2 grid")
        image = opened.copy()
    cell_size = (image.width // 3, image.height // 2)
    cells = [image.crop((i % 3 * cell_size[0], i // 3 * cell_size[1],
                         (i % 3 + 1) * cell_size[0], (i // 3 + 1) * cell_size[1]))
             for i in range(6)]
    boxes = [alpha_bbox(cell) for cell in cells]
    if any(box is None or box[0] == 0 or box[1] == 0 or
           box[2] == cell_size[0] or box[3] == cell_size[1] for box in boxes):
        raise ValueError(f"{source}: empty or source-edge-clipped frame")
    max_width = max(box[2] - box[0] for box in boxes)
    max_height = max(box[3] - box[1] for box in boxes)
    scale = min((FRAME[0] - 2 * MARGIN) / max_width,
                (BASELINE - MARGIN) / max_height, 1.0)
    if scale < 1:
        scaled_size = tuple(round(side * scale) for side in cell_size)
        cells = [cell.resize(scaled_size, Image.Resampling.LANCZOS) for cell in cells]
        boxes = [alpha_bbox(cell) for cell in cells]

    # Pickup reach is real pose motion: anchor its idle-like endpoints, not every pose.
    idle_center = median(((boxes[i][0] + boxes[i][2]) / 2 for i in (0, 5)))
    frames = []
    output_boxes = []
    for cell, box in zip(cells, boxes):
        center_x = (box[0] + box[2]) / 2
        x = round(256 - (idle_center if name.startswith("pickup") else center_x))
        y = (round(TORSO_CENTER_Y - (box[1] + box[3]) / 2) if name == "climb"
             else BASELINE - box[3])
        frame = Image.new("RGBA", FRAME)
        frame.paste(cell, (x, y))
        output_box = alpha_bbox(frame)
        if output_box is None or output_box[0] <= 0 or output_box[1] <= 0 or \
                output_box[2] >= FRAME[0] or output_box[3] >= FRAME[1] or \
                frame.getchannel("A").getbbox() is None:
            raise ValueError(f"{source}: target clipping")
        # Alpha extrema catch any clipped pixels even if the remaining bbox looks safe.
        if sum(cell.getchannel("A").get_flattened_data()) != sum(frame.getchannel("A").get_flattened_data()):
            raise ValueError(f"{source}: alpha was lost")
        frames.append(frame)
        output_boxes.append(output_box)

    folder = OUTPUT / name
    folder.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames, 1):
        frame.save(folder / f"cat_female_{name}_{index:02}.png")
    sheet = Image.new("RGBA", (FRAME[0] * 6, FRAME[1]))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (FRAME[0] * index, 0))
    runtime_name = f"cat_female_{name}.png"
    sheet.save(OUTPUT / runtime_name)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    sheet.save(PUBLIC / runtime_name)

    contact = Image.new("RGB", (768, 736), "#eeeeee")
    draw = ImageDraw.Draw(contact)
    for index, frame in enumerate(frames):
        left, top = index % 3 * 256, index // 3 * 368
        thumb = frame.resize((256, 341), Image.Resampling.NEAREST)
        checker = Image.new("RGBA", thumb.size, "#ffffff")
        checks = ImageDraw.Draw(checker)
        for cy in range(0, 341, 16):
            for cx in range(0, 256, 16):
                if (cx // 16 + cy // 16) % 2:
                    checks.rectangle((cx, cy, cx + 15, cy + 15), fill="#dddddd")
        contact.paste(Image.alpha_composite(checker, thumb).convert("RGB"), (left, top))
        draw.text((left + 8, top + 346), f"Frame {index + 1}", fill="#222222")
    validation = OUTPUT / "validation"
    validation.mkdir(exist_ok=True)
    contact.save(validation / f"{name}_contact.png")

    # One runnable check for the output contract.
    with Image.open(OUTPUT / runtime_name) as saved:
        assert saved.mode == "RGBA" and saved.size == (3072, 682)
        assert all(alpha_bbox(saved.crop((i * 512, 0, (i + 1) * 512, 682))) == output_boxes[i]
                   for i in range(6))
    print(name, "source", image.size, "cell", cell_size, "scale", scale,
          "source_bboxes", boxes, "output_bboxes", output_boxes,
          "alignment", "torso-center 475" if name == "climb" else "baseline 670")


if __name__ == "__main__":
    for animation in NAMES:
        prepare(animation)
