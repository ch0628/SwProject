"""Create the canonical pixel-exact semantic masks for Rabbit Female Base."""

import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image


DIRECTIONS = ("down", "left", "right", "up")
FRAME_COUNT = 6
TRANSPARENT, FUR, LIGHT_FUR, INNER_EAR, SHIRT, PANTS, EYES, NOSE_MOUTH, OUTLINE = range(9)
REGIONS = {
    TRANSPARENT: ("TRANSPARENT", (0, 0, 0, 0)),
    FUR: ("FUR", (190, 120, 50, 255)),
    LIGHT_FUR: ("LIGHT_FUR", (255, 235, 150, 255)),
    INNER_EAR: ("INNER_EAR", (255, 90, 160, 255)),
    SHIRT: ("SHIRT", (40, 150, 255, 255)),
    PANTS: ("PANTS", (90, 65, 190, 255)),
    EYES: ("EYES", (50, 230, 100, 255)),
    NOSE_MOUTH: ("NOSE_MOUTH", (255, 45, 45, 255)),
    OUTLINE: ("OUTLINE", (25, 25, 25, 255)),
}


def luma(rgb: tuple[int, int, int]) -> int:
    return round(rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114)


def eye_pixels(
    image: Image.Image, direction: str, box: tuple[int, int, int, int],
) -> set[tuple[int, int]]:
    if direction == "up":
        return set()
    left, top, right, bottom = box
    width, height = right - left, bottom - top
    static = image.height != 512
    eye_y = .38 if static else .41
    eye_xs = (.31, .69) if direction == "down" else (
        ((.31,) if direction == "left" else (.71,)) if static
        else ((.43,) if direction == "left" else (.57,))
    )
    pixels = image.load()
    candidates = set()
    seeds = []
    for y in range(top, bottom):
        ry = (y - top) / height
        for x in range(left, right):
            rx = (x - left) / width
            if not any(((rx - eye_x) / .145) ** 2 + ((ry - eye_y) / .075) ** 2 <= 1 for eye_x in eye_xs):
                continue
            r, g, b, a = pixels[x, y]
            value = luma((r, g, b))
            pale = value >= 185 and max(r, g, b) - min(r, g, b) <= 70
            if a > 0 and (value <= 145 or pale):
                candidates.add((x, y))
                if value <= 55:
                    seeds.append((x, y))

    result = set()
    queue = deque(seeds)
    while queue:
        point = queue.popleft()
        if point in result or point not in candidates:
            continue
        result.add(point)
        x, y = point
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return result


def classify(image: Image.Image, direction: str) -> Image.Image:
    alpha = image.getchannel("A")
    box = alpha.point(lambda value: 255 if value >= 8 else 0).getbbox()
    if box is None:
        raise RuntimeError("Base frame is empty")
    left, top, right, bottom = box
    width, height = right - left, bottom - top
    pixels = image.load()
    eyes = eye_pixels(image, direction, box)
    mask = Image.new("L", image.size)
    output = mask.load()

    for y in range(top, bottom):
        ry = (y - top) / height
        for x in range(left, right):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            rx = (x - left) / width
            value = luma((r, g, b))
            chroma = max(r, g, b) - min(r, g, b)
            static = image.height != 512
            in_eye = (x, y) in eyes
            ear_pink = r > g + 28 and b * 4 >= g * 3
            nose_pink = r > g + 28 and b >= g - 5
            blue = b > r + 6 and b >= g + 3
            pale = value >= 158 and r >= g - 8 and abs(r - g) <= 48 and abs(g - b) <= 52
            nose_x = .5 if direction == "down" else (
                (.14 if direction == "left" else .86) if static
                else (.24 if direction == "left" else .76)
            )
            in_mouth = direction != "up" and abs(rx - nose_x) <= .16 and .38 <= ry <= .52

            # High-confidence semantic identities first. These are authoring rules only;
            # generated masks, never these RGB tests, drive Variant recoloring.
            if ry < .32 and ear_pink:
                region = INNER_EAR
            elif direction != "up" and .25 <= ry <= .49 and nose_pink:
                region = NOSE_MOUTH
            elif in_eye:
                region = EYES
            elif in_mouth and value <= 95:
                region = NOSE_MOUTH
            elif .43 <= ry <= .70 and blue and (.12 <= rx <= .88):
                region = SHIRT
            elif .60 <= ry <= .94 and blue and (.15 <= rx <= .85):
                region = PANTS
            elif value <= 42 or value <= 82 and chroma <= 34:
                region = OUTLINE
            elif pale and not (.43 <= ry <= .68 and .20 <= rx <= .80):
                region = LIGHT_FUR
            elif .43 <= ry <= .68 and .20 <= rx <= .80 and blue:
                region = SHIRT
            elif .62 <= ry <= .93 and .20 <= rx <= .80 and value < 135 and b >= r:
                region = PANTS
            else:
                region = FUR
            output[x, y] = region

    # Classify isolated low-alpha antialias/glow components by the nearest authored
    # visible pixel, while preserving one and only one ID for every alpha > 0 pixel.
    queue = deque()
    distance = [-1] * (image.width * image.height)
    for y in range(image.height):
        for x in range(image.width):
            if pixels[x, y][3] >= 32 and output[x, y] != TRANSPARENT:
                index = y * image.width + x
                distance[index] = 0
                queue.append(index)
    while queue:
        index = queue.popleft()
        y, x = divmod(index, image.width)
        for neighbor in (index - image.width, index + image.width, index - 1, index + 1):
            if neighbor < 0 or neighbor >= len(distance) or distance[neighbor] >= 0:
                continue
            ny, nx = divmod(neighbor, image.width)
            if abs(nx - x) + abs(ny - y) != 1 or pixels[nx, ny][3] == 0:
                continue
            output[nx, ny] = output[x, y]
            distance[neighbor] = distance[index] + 1
            queue.append(neighbor)

    for y in range(image.height):
        for x in range(image.width):
            if pixels[x, y][3] > 0 and output[x, y] == TRANSPARENT:
                output[x, y] = OUTLINE
    return mask


def debug_preview(mask: Image.Image) -> Image.Image:
    output = Image.new("RGBA", mask.size)
    source, target = mask.load(), output.load()
    for y in range(mask.height):
        for x in range(mask.width):
            target[x, y] = REGIONS[source[x, y]][1]
    return output


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    image.save(temporary, format="PNG", optimize=False, compress_level=6)
    temporary.replace(path)


def frame_paths(repo: Path):
    base = repo / "assets/characters/rabbit/base/female"
    walk = repo / "assets/characters/rabbit/animations/female/processed"
    masks = base / "masks"
    for direction in DIRECTIONS:
        yield direction, "static", 0, base / f"rabbit_female_{direction}.png", masks / "static" / f"rabbit_female_{direction}_mask.png"
        for index in range(1, FRAME_COUNT + 1):
            yield direction, "walk", index, walk / f"walk_{direction}" / f"rabbit_female_walk_{direction}_{index:02}.png", masks / "walk" / direction / f"frame_{index:02}_mask.png"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    mask_root = repo / "assets/characters/rabbit/base/female/masks"
    counts = {identifier: 0 for identifier in REGIONS}
    previews = []
    unclassified = 0

    for direction, kind, index, source_path, mask_path in frame_paths(repo):
        with Image.open(source_path) as opened:
            source = opened.convert("RGBA")
        if args.verify_only:
            with Image.open(mask_path) as opened:
                mask = opened.convert("L")
        else:
            mask = classify(source, direction)
            save_png(mask, mask_path)
            preview_path = mask_root / "debug" / kind / direction / (f"frame_{index:02}_preview.png" if kind == "walk" else f"rabbit_female_{direction}_preview.png")
            preview = debug_preview(mask)
            save_png(preview, preview_path)
            previews.append((direction, kind, index, preview))
        if mask.size != source.size:
            raise RuntimeError(f"{mask_path}: dimensions {mask.size} != {source.size}")
        alpha_data = source.getchannel("A").tobytes()
        mask_data = mask.tobytes()
        invalid = sum(1 for alpha_value, region in zip(alpha_data, mask_data)
                      if (alpha_value > 0) != (region != TRANSPARENT) or region not in REGIONS)
        unclassified += invalid
        if invalid:
            raise RuntimeError(f"{mask_path}: {invalid} unclassified/invalid pixels")
        for region in mask_data:
            counts[region] += 1

    metadata = {
        "format": "8-bit grayscale PNG; pixel value is the semantic region ID",
        "regions": {str(identifier): name for identifier, (name, _) in REGIONS.items()},
        "debug_colors_rgba": {str(identifier): color for identifier, (_, color) in REGIONS.items()},
        "static_masks": 4,
        "walk_masks": 24,
    }
    if not args.verify_only:
        (mask_root / "semantic_regions.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
        cell_width, cell_height = 512, 682
        contact = Image.new("RGBA", (cell_width * 7, cell_height * 4))
        for direction_index, direction in enumerate(DIRECTIONS):
            row = [item for item in previews if item[0] == direction]
            for column, (_, _, _, preview) in enumerate(row):
                contact.alpha_composite(preview, (column * cell_width, direction_index * cell_height))
        save_png(contact, mask_root / "debug" / "rabbit_female_semantic_masks_contact_sheet.png")
    print("static_masks", 4)
    print("walk_masks", 24)
    print("unclassified_pixels", unclassified)
    print("region_pixels", {REGIONS[key][0]: value for key, value in counts.items()})
    print("qa_preview", mask_root / "debug" / "rabbit_female_semantic_masks_contact_sheet.png")


if __name__ == "__main__":
    main()
