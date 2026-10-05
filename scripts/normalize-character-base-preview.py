"""Create validated 512x682 previews for the three non-canonical base statics."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from character_runtime_image import ALPHA_THRESHOLD, premultiplied_lanczos


TARGET_SIZE = (512, 682)
DIRECTIONS = ("down", "left", "right", "up")
CHARACTERS = (
    ("dog", "female", "assets/characters/dog/base/female/idle"),
    ("dog", "male", "assets/characters/dog/base/male/idle"),
    ("fox", "female", "assets/characters/fox/base/female"),
)


def alpha_bbox(image: Image.Image, threshold: int = ALPHA_THRESHOLD) -> tuple[int, int, int, int]:
    result = image.getchannel("A").point(lambda value: 255 if value > threshold else 0).getbbox()
    if result is None:
        raise RuntimeError("Empty visible alpha bbox")
    return result


def edge_touches(box: tuple[int, int, int, int], size: tuple[int, int]) -> list[str]:
    left, top, right, bottom = box
    return [name for name, touches in (
        ("left", left == 0), ("top", top == 0),
        ("right", right == size[0]), ("bottom", bottom == size[1]),
    ) if touches]


def normalize(source: Image.Image, scale: float) -> tuple[Image.Image, int, int]:
    new_width = round(source.width * scale)
    if new_width > TARGET_SIZE[0]:
        raise RuntimeError(f"BLOCKING FAIL: scaled width {new_width} exceeds {TARGET_SIZE[0]}")
    resized = premultiplied_lanczos(source, (new_width, TARGET_SIZE[1]))
    left_padding = (TARGET_SIZE[0] - new_width) // 2
    output = Image.new("RGBA", TARGET_SIZE)
    output.paste(resized, (left_padding, 0))
    return output, left_padding, TARGET_SIZE[0] - new_width - left_padding


def assert_zero_rgb_under_zero_alpha(image: Image.Image) -> None:
    pixels = image.tobytes()
    if any(pixels[index + 3] == 0 and any(pixels[index:index + 3]) for index in range(0, len(pixels), 4)):
        raise RuntimeError("RGB fringe remains under alpha=0")


def checkerboard(size: tuple[int, int], block: int = 16) -> Image.Image:
    board = Image.new("RGBA", size, (232, 232, 232, 255))
    draw = ImageDraw.Draw(board)
    for y in range(0, size[1], block):
        for x in range(0, size[0], block):
            if (x // block + y // block) % 2:
                draw.rectangle((x, y, min(x + block - 1, size[0] - 1), min(y + block - 1, size[1] - 1)), fill=(200, 200, 200, 255))
    return board


def contact_sheet(
    species: str,
    gender: str,
    sources: dict[str, Image.Image],
    normalized: dict[str, Image.Image],
    output_path: Path,
) -> None:
    cell_width, cell_height = 256, 341
    margin, gap, label_width, title_height, row_label_height = 18, 12, 92, 38, 24
    sheet_width = margin * 2 + label_width + cell_width * 4 + gap * 3
    sheet_height = margin * 2 + title_height + 2 * (row_label_height + cell_height) + gap
    sheet = Image.new("RGBA", (sheet_width, sheet_height), (35, 38, 44, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((margin, margin), f"{species.title()} {gender.title()} - Base Static Canvas Normalization", fill="white", font=font)

    start_y = margin + title_height
    for row, label in enumerate(("ORIGINAL", "NORMALIZED")):
        y = start_y + row * (row_label_height + cell_height + gap)
        draw.text((margin, y + row_label_height + cell_height // 2), label, fill="white", font=font)
        for index, direction in enumerate(DIRECTIONS):
            x = margin + label_width + index * (cell_width + gap)
            draw.text((x + cell_width // 2 - 18, y), direction.upper(), fill="white", font=font)
            cell_y = y + row_label_height
            board = checkerboard((cell_width, cell_height))
            if row == 0:
                source = sources[direction]
                width = round(source.width * cell_height / source.height)
                rendered = premultiplied_lanczos(source, (width, cell_height))
                offset = (cell_width - width) // 2
                board.alpha_composite(rendered, (offset, 0))
                ImageDraw.Draw(board).rectangle((offset, 0, offset + width - 1, cell_height - 1), outline=(80, 170, 255, 255))
            else:
                rendered = premultiplied_lanczos(normalized[direction], (cell_width, cell_height))
                board.alpha_composite(rendered)
                ImageDraw.Draw(board).rectangle((0, 0, cell_width - 1, cell_height - 1), outline=(90, 220, 140, 255))
            sheet.alpha_composite(board, (x, cell_y))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, format="PNG", optimize=False, compress_level=9)


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    preview_root = repo / "assets/characters/_normalization_preview"
    records = []

    for species, gender, relative_root in CHARACTERS:
        source_root = repo / relative_root
        sources: dict[str, Image.Image] = {}
        dimensions = set()
        for direction in DIRECTIONS:
            path = source_root / f"{species}_{gender}_{direction}.png"
            with Image.open(path) as opened:
                opened.load()
                if opened.mode != "RGBA":
                    raise RuntimeError(f"Expected RGBA: {path} ({opened.mode})")
                sources[direction] = opened.copy()
                dimensions.add(opened.size)
        if len(dimensions) != 1:
            raise RuntimeError(f"BLOCKING FAIL: {species}/{gender} directions have different canvas sizes: {dimensions}")

        original_width, original_height = dimensions.pop()
        scale = TARGET_SIZE[1] / original_height
        expected_width = round(original_width * scale)
        if expected_width > TARGET_SIZE[0]:
            raise RuntimeError(f"BLOCKING FAIL: {species}/{gender} scaled width {expected_width} exceeds 512")

        outputs: dict[str, Image.Image] = {}
        for direction in DIRECTIONS:
            source = sources[direction]
            source_path = source_root / f"{species}_{gender}_{direction}.png"
            before = alpha_bbox(source)
            before_raw = source.getchannel("A").getbbox()
            output, pad_left, pad_right = normalize(source, scale)
            assert_zero_rgb_under_zero_alpha(output)
            after = alpha_bbox(output)
            after_raw = output.getchannel("A").getbbox()
            if output.size != TARGET_SIZE or output.mode != "RGBA":
                raise RuntimeError(f"Invalid normalized output: {species}/{gender}/{direction}")
            clipping = edge_touches(after, output.size)
            if clipping:
                raise RuntimeError(f"BLOCKING FAIL: visible alpha touches {clipping}: {species}/{gender}/{direction}")

            before_aspect = (before[2] - before[0]) / (before[3] - before[1])
            after_aspect = (after[2] - after[0]) / (after[3] - after[1])
            aspect_error = abs(after_aspect / before_aspect - 1)
            if aspect_error > 0.01:
                raise RuntimeError(f"BLOCKING FAIL: visible aspect error {aspect_error:.4%}: {species}/{gender}/{direction}")
            before_bottom_ratio = (source.height - before[3]) / source.height
            after_bottom_ratio = (output.height - after[3]) / output.height
            if abs(after_bottom_ratio - before_bottom_ratio) > 0.005:
                raise RuntimeError(f"BLOCKING FAIL: bottom padding ratio changed: {species}/{gender}/{direction}")

            output_path = preview_root / species / gender / f"{species}_{gender}_{direction}.png"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output.save(output_path, format="PNG", optimize=False, compress_level=9)
            with Image.open(output_path) as saved:
                saved.load()
                if saved.mode != "RGBA" or saved.size != TARGET_SIZE or saved.tobytes() != output.tobytes():
                    raise RuntimeError(f"Saved PNG verification failed: {output_path}")

            outputs[direction] = output
            records.append({
                "character": f"{species}/{gender}",
                "direction": direction,
                "source": source_path.relative_to(repo).as_posix(),
                "output": output_path.relative_to(repo).as_posix(),
                "original_canvas": f"{source.width}x{source.height}",
                "scale": round(scale, 10),
                "scaled_canvas": f"{expected_width}x{TARGET_SIZE[1]}",
                "normalized_canvas": f"{TARGET_SIZE[0]}x{TARGET_SIZE[1]}",
                "horizontal_padding": [pad_left, pad_right],
                "alpha_bbox_gt10_before": before,
                "alpha_bbox_gt10_after": after,
                "alpha_bbox_gt0_before": before_raw,
                "alpha_bbox_gt0_after": after_raw,
                "raw_alpha_edges_before": edge_touches(before_raw, source.size),
                "raw_alpha_edges_after": edge_touches(after_raw, output.size),
                "bottom_padding_ratio_before": round(before_bottom_ratio, 8),
                "bottom_padding_ratio_after": round(after_bottom_ratio, 8),
                "visible_aspect_before": round(before_aspect, 8),
                "visible_aspect_after": round(after_aspect, 8),
                "visible_aspect_error_pct": round(aspect_error * 100, 6),
                "clipping": False,
                "zero_rgb_under_alpha_zero": True,
            })

        qa_path = preview_root / "_qa" / f"{species}_{gender}_contact_sheet.png"
        contact_sheet(species, gender, sources, outputs, qa_path)
        print(json.dumps({
            "character": f"{species}/{gender}",
            "scale": round(scale, 10),
            "scaled_canvas": f"{expected_width}x{TARGET_SIZE[1]}",
            "qa": qa_path.relative_to(repo).as_posix(),
        }, ensure_ascii=False))

    for record in records:
        print(json.dumps(record, ensure_ascii=False))
    print(json.dumps({"validated_outputs": len(records), "blocking_fail": None}, ensure_ascii=False))


if __name__ == "__main__":
    main()
