"""Build a palette-only character variant while preserving animation alpha geometry."""

import argparse
import hashlib
from bisect import bisect_right
from pathlib import Path
from statistics import median

from PIL import Image

from character_runtime_image import ALPHA_THRESHOLD, bbox, premultiplied_lanczos, round1_target_height


DIRECTIONS = ("down", "left", "right", "up")
FRAME_COUNT = 6
WALK_FRAME = (512, 682)


def luma(rgb: tuple[int, int, int]) -> int:
    return round(rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114)


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    return bbox(image.getchannel("A"))


def family_pixels(image: Image.Image, family: str) -> list[tuple[int, int, int]]:
    left, top, right, bottom = visible_bbox(image)
    width, height = right - left, bottom - top
    samples = []
    pixels = image.load()
    for y in range(top, bottom):
        ry = (y - top) / height
        for x in range(left, right):
            r, g, b, a = pixels[x, y]
            if a < 240:
                continue
            rx = (x - left) / width
            value, chroma = luma((r, g, b)), max(r, g, b) - min(r, g, b)
            if family == "base_fur" and ry < .47 and 35 <= value <= 190 and chroma <= 55:
                samples.append((r, g, b))
            elif family == "variant_fur" and ry < .47 and r > g + 15 and g > b + 15 and 45 <= value <= 230:
                samples.append((r, g, b))
            elif family == "base_shirt" and .43 <= ry <= .72 and .18 <= rx <= .82 and value >= 125 and chroma <= 60:
                samples.append((r, g, b))
            elif family == "variant_shirt" and .43 <= ry <= .72 and .18 <= rx <= .82 and g > r + 2 and b > r + 2:
                samples.append((r, g, b))
    if len(samples) < 100:
        raise RuntimeError(f"Not enough {family} reference pixels: {len(samples)}")
    return samples


def palette_lut(source: list[tuple[int, int, int]], target: list[tuple[int, int, int]]) -> list[tuple[int, int, int]]:
    source_lumas = sorted(luma(color) for color in source)
    target_sorted = sorted(target, key=luma)
    radius = max(8, len(target_sorted) // 200)
    result = []
    for value in range(256):
        percentile = bisect_right(source_lumas, value) / len(source_lumas)
        center = min(len(target_sorted) - 1, round(percentile * (len(target_sorted) - 1)))
        sample = target_sorted[max(0, center - radius):min(len(target_sorted), center + radius + 1)]
        result.append(tuple(round(median(color[channel] for color in sample)) for channel in range(3)))
    return result


def transfer_frame(frame: Image.Image, fur_lut: list[tuple[int, int, int]], shirt_lut: list[tuple[int, int, int]]) -> Image.Image:
    left, top, right, bottom = visible_bbox(frame)
    width, height = right - left, bottom - top
    output = frame.copy()
    source_pixels, output_pixels = frame.load(), output.load()
    head_x = [x for y in range(top, bottom) for x in range(left, right)
              if (y - top) / height < .42 and source_pixels[x, y][3] >= 128]
    body_center = median(head_x)
    changed = 0
    for y in range(top, bottom):
        ry = (y - top) / height
        for x in range(left, right):
            r, g, b, a = source_pixels[x, y]
            if a <= ALPHA_THRESHOLD:
                continue
            value, chroma = luma((r, g, b)), max(r, g, b) - min(r, g, b)
            target = None
            body_offset = abs(x - body_center)
            if .43 <= ry <= .70 and body_offset <= frame.width * .22 and value >= 105 and chroma <= 70:
                target = shirt_lut[value]
            elif chroma <= 75 and (ry < .49 and 35 <= value <= 225 or body_offset > frame.width * .18 and 45 <= value <= 190):
                target = fur_lut[value]
            if target is not None and target != (r, g, b):
                output_pixels[x, y] = (*target, a)
                changed += 1
    if changed < 1000:
        raise RuntimeError(f"Unsafe transfer: only {changed} pixels changed")
    if output.getchannel("A").tobytes() != frame.getchannel("A").tobytes():
        raise RuntimeError("Alpha geometry changed")
    return output


def save_runtime(source: Image.Image, target_height: int, path: Path) -> tuple[int, int]:
    size = round(source.width * target_height / source.height), target_height
    runtime = premultiplied_lanczos(source, size)
    path.parent.mkdir(parents=True, exist_ok=True)
    runtime.save(path, format="PNG", optimize=False, compress_level=6)
    return size


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("species")
    parser.add_argument("gender")
    parser.add_argument("variant")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[1]
    variant_root = repo / f"assets/characters/{args.species}/variants/{args.gender}/{args.variant}"
    reference_path = variant_root / "source" / f"{args.species}_{args.gender}_{args.variant}_reference_sheet.png"
    base_root = repo / f"assets/characters/{args.species}/base/{args.gender}"
    walk_root = repo / f"assets/characters/{args.species}/animations/{args.gender}/processed"
    output_walk = variant_root / "animations/walk"
    runtime_root = repo / f"public/assets/characters/world/{args.species}/{args.gender}/{args.variant}"

    with Image.open(reference_path) as opened:
        opened.load()
        if opened.mode != "RGBA" or opened.width % 4 or opened.height <= 0:
            raise RuntimeError("Reference sheet must be RGBA with four equal columns")
        reference = opened.copy()
    cell_size = reference.width // 4, reference.height
    target_height = round1_target_height(repo, args.species) * 4
    alpha_hashes = []

    for index, direction in enumerate(DIRECTIONS):
        cell = reference.crop((index * cell_size[0], 0, (index + 1) * cell_size[0], cell_size[1]))
        cell_box = visible_bbox(cell)
        if cell_box[0] <= 0 or cell_box[1] <= 0 or cell_box[2] >= cell.width or cell_box[3] >= cell.height:
            raise RuntimeError(f"{direction}: visibly clipped reference cell {cell_box}")
        static_path = variant_root / "base" / f"{args.species}_{args.gender}_{args.variant}_{direction}.png"
        static_path.parent.mkdir(parents=True, exist_ok=True)
        cell.save(static_path, format="PNG", optimize=False, compress_level=6)
        save_runtime(cell, target_height, runtime_root / "base" / static_path.name)

        with Image.open(base_root / f"{args.species}_{args.gender}_{direction}.png") as opened:
            base_static = opened.convert("RGBA")
        fur_lut = palette_lut(family_pixels(base_static, "base_fur"), family_pixels(cell, "variant_fur"))
        shirt_lut = palette_lut(family_pixels(base_static, "base_shirt"), family_pixels(cell, "variant_shirt"))

        frames = []
        direction_root = output_walk / direction
        direction_root.mkdir(parents=True, exist_ok=True)
        for frame_index in range(1, FRAME_COUNT + 1):
            source_path = walk_root / f"walk_{direction}" / f"{args.species}_{args.gender}_walk_{direction}_{frame_index:02}.png"
            with Image.open(source_path) as opened:
                source = opened.convert("RGBA")
            if source.size != WALK_FRAME:
                raise RuntimeError(f"Unexpected walk frame size: {source_path} {source.size}")
            variant = transfer_frame(source, fur_lut, shirt_lut)
            output_path = direction_root / f"{args.species}_{args.gender}_{args.variant}_walk_{direction}_{frame_index:02}.png"
            variant.save(output_path, format="PNG", optimize=False, compress_level=6)
            source_alpha = hashlib.sha256(source.getchannel("A").tobytes()).hexdigest()
            variant_alpha = hashlib.sha256(variant.getchannel("A").tobytes()).hexdigest()
            if source_alpha != variant_alpha:
                raise RuntimeError(f"{direction} frame {frame_index}: alpha hash mismatch")
            alpha_hashes.append((direction, frame_index, source_alpha))
            frames.append(variant)

        sheet = Image.new("RGBA", (WALK_FRAME[0] * FRAME_COUNT, WALK_FRAME[1]))
        runtime_frames = []
        for frame_index, frame in enumerate(frames):
            sheet.paste(frame, (frame_index * WALK_FRAME[0], 0))
            runtime_frames.append(premultiplied_lanczos(frame, (round(WALK_FRAME[0] * target_height / WALK_FRAME[1]), target_height)))
        processed_path = output_walk / "processed" / f"{args.species}_{args.gender}_{args.variant}_walk_{direction}.png"
        processed_path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(processed_path, format="PNG", optimize=False, compress_level=6)
        runtime_sheet = Image.new("RGBA", (runtime_frames[0].width * FRAME_COUNT, target_height))
        for frame_index, frame in enumerate(runtime_frames):
            runtime_sheet.paste(frame, (frame_index * frame.width, 0))
        runtime_path = runtime_root / "walk" / processed_path.name
        runtime_path.parent.mkdir(parents=True, exist_ok=True)
        runtime_sheet.save(runtime_path, format="PNG", optimize=False, compress_level=6)
        print(direction, "static", cell.size, cell_box, "walk", sheet.size, "runtime", runtime_sheet.size)

    print("alpha_sha256_matches", len(alpha_hashes), "of", len(DIRECTIONS) * FRAME_COUNT)
    print("filter=premultiplied-alpha LANCZOS sharpen=NONE")


if __name__ == "__main__":
    main()
