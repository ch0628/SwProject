"""Build a palette-only character variant while preserving animation alpha geometry."""

import argparse
import hashlib
import json
import math
from pathlib import Path
from statistics import median

from PIL import Image

from character_runtime_image import ALPHA_THRESHOLD, bbox, premultiplied_lanczos, round1_target_height


DIRECTIONS = ("down", "left", "right", "up")
FRAME_COUNT = 6
SHADE_QUANTILES = (.02, .10, .25, .50, .75, .90, .98)
PaletteLut = tuple[tuple[int, int, int], ...]
CanonicalPalette = dict[str, PaletteLut]
TRANSPARENT, FUR, LIGHT_FUR, INNER_EAR, SHIRT, PANTS, EYES, NOSE_MOUTH, OUTLINE = range(9)
VALID_REGIONS = frozenset(range(9))
TRANSFER_FAMILIES = {FUR: "fur", LIGHT_FUR: "light_fur", SHIRT: "shirt"}
TRANSFER_NAMES = ("fur", "light_fur", "shirt")
PROTECTED_FAMILIES = {
    INNER_EAR: "inner_ear", PANTS: "pants", EYES: "eyes",
    NOSE_MOUTH: "nose_mouth", OUTLINE: "outline",
}


def luma(rgb: tuple[int, int, int]) -> int:
    return round(rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114)


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    return bbox(image.getchannel("A"))


def load_semantic_mask(path: Path, frame: Image.Image) -> bytearray:
    with Image.open(path) as opened:
        mask = opened.convert("L")
    if mask.size != frame.size:
        raise RuntimeError(f"{path}: mask dimensions {mask.size} != Base frame {frame.size}")
    values = mask.tobytes()
    alpha = frame.getchannel("A").tobytes()
    invalid_ids = set(values) - VALID_REGIONS
    if invalid_ids:
        raise RuntimeError(f"{path}: invalid semantic region IDs {sorted(invalid_ids)}")
    unclassified = sum(1 for alpha_value, region in zip(alpha, values)
                       if alpha_value > 0 and region == TRANSPARENT)
    stray = sum(1 for alpha_value, region in zip(alpha, values)
                if alpha_value == 0 and region != TRANSPARENT)
    if unclassified or stray:
        raise RuntimeError(f"{path}: unclassified={unclassified}, mask_outside_alpha={stray}")
    return bytearray(values)


def semantic_pixels(
    images: list[Image.Image], masks: list[bytearray], families: tuple[int, ...],
) -> list[tuple[int, int, int]]:
    samples = []
    for image, mask in zip(images, masks):
        pixels = image.load()
        samples.extend(pixels[index % image.width, index // image.width][:3]
                       for index, value in enumerate(mask) if value in families and pixels[index % image.width, index // image.width][3] >= 240)
    if len(samples) < 100:
        raise RuntimeError(f"Not enough source semantic family {families} pixels: {len(samples)}")
    return samples


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
            warm_fur = r > g + 5 and g > b + 5
            neutral_fur = chroma <= 45
            eye_region = .20 <= ry <= .39 and .25 <= rx <= .75
            pink_detail = r > g + 25 and r > b + 15 and abs(g - b) < 35
            if family == "variant_fur" and ry < .47 and 50 <= value < 195 and (warm_fur or neutral_fur) and not eye_region and not pink_detail:
                samples.append((r, g, b))
            elif family == "variant_marking" and value >= 195 and chroma <= 50 and (
                .34 <= ry < .50 or ry >= .68 or .45 <= ry < .75 and abs(rx - .5) > .28
            ):
                samples.append((r, g, b))
            elif family == "variant_shirt" and .45 <= ry <= .64 and .30 <= rx <= .70:
                samples.append((r, g, b))
    if family == "variant_shirt" and samples:
        if median(luma(color) for color in samples) > 210:
            samples = [color for color in samples
                       if luma(color) >= 160 and max(color) - min(color) <= 60]
        else:
            samples = [color for color in samples
                       if color[1] >= color[0] + 3 and color[1] >= color[2] + 3]
    if len(samples) < 100:
        raise RuntimeError(f"Not enough {family} reference pixels: {len(samples)}")
    return samples


def palette_lut(source: list[tuple[int, int, int]], target: list[tuple[int, int, int]]) -> PaletteLut:
    source_lumas = sorted(luma(color) for color in source)
    target_sorted = sorted(target, key=luma)
    radius = max(8, len(target_sorted) // 200)
    anchors = []
    for quantile in SHADE_QUANTILES:
        source_index = round(quantile * (len(source_lumas) - 1))
        target_index = round(quantile * (len(target_sorted) - 1))
        sample = target_sorted[max(0, target_index - radius):min(len(target_sorted), target_index + radius + 1)]
        anchors.append((
            source_lumas[source_index],
            tuple(round(median(color[channel] for color in sample)) for channel in range(3)),
        ))
    result = []
    for value in range(256):
        if value <= anchors[0][0]:
            result.append(anchors[0][1])
            continue
        if value >= anchors[-1][0]:
            result.append(anchors[-1][1])
            continue
        for (start_value, start_color), (end_value, end_color) in zip(anchors, anchors[1:]):
            if value <= end_value:
                amount = (value - start_value) / (end_value - start_value or 1)
                result.append(tuple(round(start + (end - start) * amount) for start, end in zip(start_color, end_color)))
                break
    return tuple(result)


def canonical_palette(
    base_images: list[Image.Image], base_masks: list[bytearray], variant_references: list[Image.Image],
) -> CanonicalPalette:
    return {
        "fur": palette_lut(
            semantic_pixels(base_images, base_masks, (FUR,)),
            [pixel for image in variant_references for pixel in family_pixels(image, "variant_fur")],
        ),
        "light_fur": palette_lut(
            semantic_pixels(base_images, base_masks, (LIGHT_FUR,)),
            [pixel for image in variant_references for pixel in family_pixels(image, "variant_marking")],
        ),
        "shirt": palette_lut(
            semantic_pixels(base_images, base_masks, (SHIRT,)),
            [pixel for image in variant_references for pixel in family_pixels(image, "variant_shirt")],
        ),
    }


def transfer_frame(frame: Image.Image, palette: CanonicalPalette, mask: bytearray) -> Image.Image:
    output = frame.copy()
    source_pixels, output_pixels = frame.load(), output.load()
    changed = 0
    for index, family_code in enumerate(mask):
        family = TRANSFER_FAMILIES.get(family_code)
        if family is None:
            continue
        y, x = divmod(index, frame.width)
        r, g, b, a = source_pixels[x, y]
        target = palette[family][luma((r, g, b))]
        if target != (r, g, b):
            output_pixels[x, y] = (*target, a)
            changed += 1
    if changed < 1000:
        raise RuntimeError(f"Unsafe transfer: only {changed} pixels changed")
    if output.getchannel("A").tobytes() != frame.getchannel("A").tobytes():
        raise RuntimeError("Alpha geometry changed")
    return output


def update_transfer_metrics(
    metrics: dict[str, object], source: Image.Image, output: Image.Image, mask: bytearray,
) -> None:
    source_pixels, output_pixels = source.load(), output.load()
    protected = metrics["protected"]
    for index, family_code in enumerate(mask):
        family = TRANSFER_FAMILIES.get(family_code)
        if family is None and family_code not in PROTECTED_FAMILIES:
            continue
        y, x = divmod(index, source.width)
        source_rgb = source_pixels[x, y][:3]
        output_rgb = output_pixels[x, y][:3]
        if family is not None:
            metrics[f"{family}_total"] += 1
            if max(abs(source_rgb[channel] - output_rgb[channel]) for channel in range(3)) <= 8:
                metrics[f"{family}_residual"] += 1
        elif source_rgb != output_rgb:
            protected[PROTECTED_FAMILIES[family_code]] += 1


def load_idle_visual_scales(base_root: Path, variant_root: Path | None = None) -> dict[str, float]:
    configured = {}
    config_paths = [base_root / "visual_profile.json"]
    if variant_root is not None:
        config_paths.append(variant_root / "variant_config.json")
    for config_path in config_paths:
        if not config_path.exists():
            continue
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Invalid visual config {config_path}: {error}") from error
        if not isinstance(config, dict) or not isinstance(config.get("idle_visual_scale", {}), dict):
            raise RuntimeError(f"{config_path}: idle_visual_scale must be an object")
        configured.update(config.get("idle_visual_scale", {}))

    scales = {}
    for direction in DIRECTIONS:
        value = configured.get(direction, 1.0)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise RuntimeError(f"idle_visual_scale.{direction} must be a number")
        if not 0 < value <= 1.5:
            raise RuntimeError(f"idle_visual_scale.{direction} must satisfy 0 < scale <= 1.5")
        scales[direction] = float(value)
    return scales


def export_base_statics(repo: Path, species: str, gender: str) -> None:
    base_root = repo / f"assets/characters/{species}/base/{gender}"
    runtime_root = repo / f"public/assets/characters/{species}/base/{gender}"
    scales = load_idle_visual_scales(base_root)
    print("visual_profile", base_root / "visual_profile.json")
    for direction in DIRECTIONS:
        source_path = base_root / f"{species}_{gender}_{direction}.png"
        with Image.open(source_path) as opened:
            source = opened.convert("RGBA")
        tuned = tune_static_visual(source, scales[direction])
        output_path = runtime_root / source_path.name
        save_png(tuned, output_path)
        print(f"{direction:<5} idle_visual_scale={scales[direction]:g} bbox={visible_bbox(source)}->{visible_bbox(tuned)}")
        print("  runtime", output_path)


def tune_static_visual(image: Image.Image, scale: float) -> Image.Image:
    if scale == 1.0:
        return image.copy()
    left, top, right, bottom = visible_bbox(image)
    content = image.crop((left, top, right, bottom))
    scaled_size = max(1, round(content.width * scale)), max(1, round(content.height * scale))
    scaled = premultiplied_lanczos(content, scaled_size)
    target_left = round((left + right - scaled.width) / 2)
    target_top = bottom - scaled.height
    if target_left < 0 or target_top < 0 or target_left + scaled.width > image.width or bottom > image.height:
        raise RuntimeError(f"Static visual scale {scale:g} would clip content in canvas {image.size}")
    output = Image.new("RGBA", image.size)
    output.paste(scaled, (target_left, target_top))
    tuned_box = visible_bbox(output)
    if tuned_box[3] != bottom:
        raise RuntimeError(f"Static visual scale {scale:g} moved the feet baseline: {bottom} -> {tuned_box[3]}")
    if abs((tuned_box[0] + tuned_box[2]) - (left + right)) > 1:
        raise RuntimeError(f"Static visual scale {scale:g} moved the horizontal center: {(left, right)} -> {(tuned_box[0], tuned_box[2])}")
    return output


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    image.save(temporary, format="PNG", optimize=False, compress_level=6)
    temporary.replace(path)


def save_runtime(source: Image.Image, target_height: int, path: Path) -> tuple[int, int]:
    size = round(source.width * target_height / source.height), target_height
    runtime = premultiplied_lanczos(source, size)
    save_png(runtime, path)
    return size


def equal_reference_cells(reference: Image.Image) -> tuple[list[Image.Image], tuple[int, int]]:
    remainder = reference.width % len(DIRECTIONS)
    left_trim = remainder // 2
    right_trim = remainder - left_trim
    if remainder:
        left_alpha = reference.getchannel("A").crop((0, 0, left_trim, reference.height))
        right_alpha = reference.getchannel("A").crop((reference.width - right_trim, 0, reference.width, reference.height))
        if left_alpha.getextrema()[1] > ALPHA_THRESHOLD or right_alpha.getextrema()[1] > ALPHA_THRESHOLD:
            raise RuntimeError("Reference sheet width is not divisible into four equal cells and required trim is not transparent")
        reference = reference.crop((left_trim, 0, reference.width - right_trim, reference.height))
    cell_width = reference.width // len(DIRECTIONS)
    return [reference.crop((index * cell_width, 0, (index + 1) * cell_width, reference.height))
            for index in range(len(DIRECTIONS))], (left_trim, right_trim)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("species")
    parser.add_argument("gender")
    parser.add_argument("variant", nargs="?")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--static-only", action="store_true", help="Generate only Variant authoring and WORLD runtime Static assets")
    mode.add_argument("--base-static-only", action="store_true", help="Generate only Base public runtime Static assets")
    parser.add_argument("--dry-run", action="store_true", help="Validate and render in memory without writing assets")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[1]
    if args.base_static_only:
        if args.variant is not None:
            parser.error("variant must be omitted with --base-static-only")
        export_base_statics(repo, args.species, args.gender)
        return
    if args.variant is None:
        parser.error("variant is required unless --base-static-only is used")

    variant_root = repo / f"assets/characters/{args.species}/variants/{args.gender}/{args.variant}"
    reference_path = variant_root / "source" / f"{args.species}_{args.gender}_{args.variant}_reference_sheet.png"
    base_root = repo / f"assets/characters/{args.species}/base/{args.gender}"
    mask_root = base_root / "masks"
    walk_root = repo / f"assets/characters/{args.species}/animations/{args.gender}/processed"
    output_walk = variant_root / "animations/walk"
    runtime_root = repo / f"public/assets/characters/world/{args.species}/{args.gender}/{args.variant}"

    with Image.open(reference_path) as opened:
        opened.load()
        if opened.mode != "RGBA" or opened.height <= 0:
            raise RuntimeError("Reference sheet must be non-empty RGBA")
        reference = opened.copy()
    reference_cells, reference_trim = equal_reference_cells(reference)
    cell_size = reference_cells[0].size
    target_height = round1_target_height(repo, args.species) * 4
    idle_visual_scales = load_idle_visual_scales(base_root, variant_root)
    static_alpha_hashes = []
    walk_alpha_hashes = []
    base_statics = {}
    base_walks = {}
    static_masks = {}
    walk_masks = {}
    metrics: dict[str, object] = {
        **{f"{family}_{metric}": 0 for family in TRANSFER_NAMES for metric in ("total", "residual")},
        "protected": {name: 0 for name in PROTECTED_FAMILIES.values()},
    }

    print("reference", reference_path, reference.size, reference.mode)
    print("reference_cells", len(reference_cells), cell_size, f"transparent_outer_trim={reference_trim[0]}+{reference_trim[1]}")
    for direction, cell in zip(DIRECTIONS, reference_cells):
        visible_bbox(cell)
        with Image.open(base_root / f"{args.species}_{args.gender}_{direction}.png") as opened:
            base_statics[direction] = opened.convert("RGBA")
        static_masks[direction] = load_semantic_mask(
            mask_root / "static" / f"{args.species}_{args.gender}_{direction}_mask.png",
            base_statics[direction],
        )
        for frame_index in range(1, FRAME_COUNT + 1):
            source_path = walk_root / f"walk_{direction}" / f"{args.species}_{args.gender}_walk_{direction}_{frame_index:02}.png"
            with Image.open(source_path) as opened:
                base_walks[direction, frame_index] = opened.convert("RGBA")
            walk_masks[direction, frame_index] = load_semantic_mask(
                mask_root / "walk" / direction / f"frame_{frame_index:02}_mask.png",
                base_walks[direction, frame_index],
            )

    source_images = [*base_statics.values(), *base_walks.values()]
    source_masks = [*static_masks.values(), *walk_masks.values()]
    palette = canonical_palette(source_images, source_masks, reference_cells)
    print("semantic_masks", mask_root, "static=4 walk=24 unclassified=0")
    print("visual_profile", base_root / "visual_profile.json")
    config_path = variant_root / "variant_config.json"
    print("variant_config", config_path if config_path.exists() else "NONE")
    print("write_mode", "DRY_RUN" if args.dry_run else "WRITE")

    for direction in DIRECTIONS:
        base_static = base_statics[direction]
        semantic_mask = static_masks[direction]
        canonical_static = transfer_frame(base_static, palette, semantic_mask)
        update_transfer_metrics(metrics, base_static, canonical_static, semantic_mask)
        source_alpha = hashlib.sha256(base_static.getchannel("A").tobytes()).hexdigest()
        canonical_alpha = hashlib.sha256(canonical_static.getchannel("A").tobytes()).hexdigest()
        if source_alpha != canonical_alpha:
            raise RuntimeError(f"{direction} canonical static: alpha hash mismatch")
        static_alpha_hashes.append((direction, source_alpha))
        scale = idle_visual_scales[direction]
        variant_static = tune_static_visual(canonical_static, scale)
        static_path = variant_root / "base" / f"{args.species}_{args.gender}_{args.variant}_{direction}.png"
        if not args.dry_run:
            save_png(variant_static, static_path)
        runtime_static_path = runtime_root / "base" / static_path.name
        if not args.dry_run:
            save_runtime(variant_static, target_height, runtime_static_path)
        print(f"{direction:<5} idle_visual_scale={scale:g}")
        print("  static", static_path)
        print("  runtime", runtime_static_path)

        if args.static_only:
            continue

        frames = []
        walk_frame_size = None
        direction_root = output_walk / direction
        if not args.dry_run:
            direction_root.mkdir(parents=True, exist_ok=True)
        for frame_index in range(1, FRAME_COUNT + 1):
            source_path = walk_root / f"walk_{direction}" / f"{args.species}_{args.gender}_walk_{direction}_{frame_index:02}.png"
            source = base_walks[direction, frame_index]
            if walk_frame_size is None:
                walk_frame_size = source.size
            elif source.size != walk_frame_size:
                raise RuntimeError(f"Walk frame size mismatch: {source_path} {source.size} != {walk_frame_size}")
            semantic_mask = walk_masks[direction, frame_index]
            variant = transfer_frame(source, palette, semantic_mask)
            update_transfer_metrics(metrics, source, variant, semantic_mask)
            output_path = direction_root / f"{args.species}_{args.gender}_{args.variant}_walk_{direction}_{frame_index:02}.png"
            if not args.dry_run:
                save_png(variant, output_path)
            source_alpha = hashlib.sha256(source.getchannel("A").tobytes()).hexdigest()
            variant_alpha = hashlib.sha256(variant.getchannel("A").tobytes()).hexdigest()
            if source_alpha != variant_alpha:
                raise RuntimeError(f"{direction} frame {frame_index}: alpha hash mismatch")
            walk_alpha_hashes.append((direction, frame_index, source_alpha))
            frames.append(variant)

        if walk_frame_size is None:
            raise RuntimeError(f"No walk frames found for {direction}")
        sheet = Image.new("RGBA", (walk_frame_size[0] * FRAME_COUNT, walk_frame_size[1]))
        runtime_frames = []
        for frame_index, frame in enumerate(frames):
            sheet.paste(frame, (frame_index * walk_frame_size[0], 0))
            runtime_frames.append(premultiplied_lanczos(frame, (round(walk_frame_size[0] * target_height / walk_frame_size[1]), target_height)))
        processed_path = output_walk / "processed" / f"{args.species}_{args.gender}_{args.variant}_walk_{direction}.png"
        if not args.dry_run:
            save_png(sheet, processed_path)
        runtime_sheet = Image.new("RGBA", (runtime_frames[0].width * FRAME_COUNT, target_height))
        for frame_index, frame in enumerate(runtime_frames):
            runtime_sheet.paste(frame, (frame_index * frame.width, 0))
        runtime_path = runtime_root / "walk" / processed_path.name
        if not args.dry_run:
            save_png(runtime_sheet, runtime_path)
        print(direction, "static", variant_static.size, visible_bbox(variant_static), "walk", sheet.size, "runtime", runtime_sheet.size)

    print("canonical_palette", "one mapping shared by all directions and states; semantic identity from masks only")
    for family in TRANSFER_NAMES:
        total = metrics[f"{family}_total"]
        residual = metrics[f"{family}_residual"]
        print(f"source_{family}_pixels", total)
        print(f"base_{family}_residual_le8", residual, "of", total, f"{residual * 100 / total:.3f}%")
    print("protected_unintended_rgb_changes", metrics["protected"])
    if any(metrics["protected"].values()):
        raise RuntimeError(f"Protected semantic regions changed: {metrics['protected']}")
    print("canonical_static_alpha_sha256_matches", len(static_alpha_hashes), "of", len(DIRECTIONS))
    if args.static_only:
        print("walk_generation", "SKIPPED (--static-only)")
    else:
        print("walk_alpha_sha256_matches", len(walk_alpha_hashes), "of", len(DIRECTIONS) * FRAME_COUNT)
    print("filter=premultiplied-alpha LANCZOS sharpen=NONE")


if __name__ == "__main__":
    main()
