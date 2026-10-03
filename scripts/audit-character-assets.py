"""Read-only audit of the 40 character PNGs used by PlazaParkScene Round 1."""

from __future__ import annotations

import csv
import re
import statistics
from collections import defaultdict
from pathlib import Path

from PIL import Image


SPECIES = ("rabbit", "cat", "fox", "dog", "tiger")
GENDERS = ("male", "female")
DIRECTIONS = ("down", "left", "right", "up")


def source_values(repo: Path) -> tuple[int, float, dict[str, float]]:
    config = (repo / "src/config.ts").read_text(encoding="utf-8")
    scene = (repo / "src/PlazaParkScene.ts").read_text(encoding="utf-8")
    manifest = (repo / "src/characterManifest.ts").read_text(encoding="utf-8")
    expected_path = "return `/assets/characters/${species}/base/${gender}/${species}_${gender}_${facing}.png`;"
    if expected_path not in manifest:
        raise RuntimeError("characterAssetPath no longer matches this audit")

    threshold_match = re.search(r"ASSET_ALPHA_THRESHOLD\s*=\s*(\d+)", config)
    round1 = scene.split("private startRound1()", 1)[1].split("selectCctv(", 1)[0]
    scale_match = re.search(r"CCTV_CHARACTER_VISUAL_SCALE\s*=\s*([\d.]+)", round1)
    heights_match = re.search(r"visualHeight\s*=\s*\{([^}]+)\}", round1)
    if not (threshold_match and scale_match and heights_match):
        raise RuntimeError("Could not read current threshold or Round 1 visual heights")
    heights = {
        species: float(re.search(rf"{species}\s*:\s*([\d.]+)\s*\*", heights_match.group(1)).group(1))
        for species in SPECIES
    }
    return int(threshold_match.group(1)), float(scale_match.group(1)), heights


def bbox_fields(prefix: str, bbox: tuple[int, int, int, int] | None) -> dict[str, int | str]:
    if bbox is None:
        return {f"{prefix}_{name}": "" for name in ("left", "top", "right_exclusive", "bottom_exclusive", "width", "height")}
    left, top, right, bottom = bbox
    return {
        f"{prefix}_left": left,
        f"{prefix}_top": top,
        f"{prefix}_right_exclusive": right,
        f"{prefix}_bottom_exclusive": bottom,
        f"{prefix}_width": right - left,
        f"{prefix}_height": bottom - top,
    }


def audit(repo: Path) -> tuple[list[dict[str, object]], int, float, dict[str, float]]:
    threshold, visual_scale, base_heights = source_values(repo)
    root = repo / "public/assets/characters"  # Vite serves /assets from public/assets.
    paths = [root / s / "base" / g / f"{s}_{g}_{d}.png" for s in SPECIES for g in GENDERS for d in DIRECTIONS]
    if len(paths) != 40 or len(set(paths)) != 40:
        raise RuntimeError("Expected 40 unique runtime PNG paths")
    missing = [path for path in paths if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing runtime PNGs:\n" + "\n".join(map(str, missing)))

    measurements: dict[tuple[str, str, str], dict[str, object]] = {}
    for species in SPECIES:
        for gender in GENDERS:
            for direction in DIRECTIONS:
                path = root / species / "base" / gender / f"{species}_{gender}_{direction}.png"
                with Image.open(path) as image:
                    image.load()
                    width, height = image.size
                    has_alpha = "A" in image.getbands() or "transparency" in image.info
                    alpha = image.convert("RGBA").getchannel("A")
                    histogram = alpha.histogram()
                    bbox_gt0 = alpha.getbbox()
                    bbox_threshold = alpha.point(lambda value: 255 if value > threshold else 0).getbbox()
                    if bbox_threshold is None:
                        raise RuntimeError(f"No pixels above threshold in {path}")
                    left, top, right, bottom = bbox_threshold
                    row: dict[str, object] = {
                        "path": path.relative_to(repo).as_posix(),
                        "species": species,
                        "gender": gender,
                        "direction": direction,
                        "file_bytes": path.stat().st_size,
                        "canvas_width": width,
                        "canvas_height": height,
                        "mode": image.mode,
                        "has_alpha": has_alpha,
                        **bbox_fields("bbox_alpha_gt0", bbox_gt0),
                        **bbox_fields("bbox_threshold", bbox_threshold),
                        "padding_left": left,
                        "padding_right": width - right,
                        "padding_top": top,
                        "padding_bottom": height - bottom,
                        "alpha_zero_count": histogram[0],
                        "alpha_1_9_count": sum(histogram[1:10]),
                        "alpha_10_254_count": sum(histogram[10:255]),
                        "alpha_255_count": histogram[255],
                        "unique_alpha_count": sum(count > 0 for count in histogram),
                        "runtime_frame_width": width,
                        "runtime_frame_height": height,
                        "base_visual_height": base_heights[species],
                        "cctv_visual_scale": visual_scale,
                        "target_visual_height": base_heights[species] * visual_scale,
                    }
                    measurements[species, gender, direction] = row

    rows = []
    for key, row in measurements.items():
        species, gender, _ = key
        down_height = int(measurements[species, gender, "down"]["runtime_frame_height"])
        scale = float(row["target_visual_height"]) / down_height
        visible_height = int(row["bbox_threshold_height"])
        displayed_visible_height = visible_height * scale
        row.update({
            "runtime_scale_basis_direction": "down",
            "runtime_scale_basis_frame_height": down_height,
            "runtime_scale_factor": round(scale, 8),
            "displayed_visible_height": round(displayed_visible_height, 4),
            "visible_downscale_ratio": round(visible_height / displayed_visible_height, 4),
        })
        rows.append(row)
    return rows, threshold, visual_scale, base_heights


def print_summary(rows: list[dict[str, object]], threshold: int, visual_scale: float) -> None:
    print(f"Audited PNGs: {len(rows)} / 40")
    print("Runtime texture trimming: NO (PlazaParkScene load.image; full source frame)")
    print(f"ASSET_ALPHA_THRESHOLD: {threshold}")
    print(f"CCTV_CHARACTER_VISUAL_SCALE: {visual_scale:g} (active Round 1)")
    print("\nSpecies summary (medians; partial alpha is share of alpha>0 pixels):")
    print("species,canvas,visible_h,target_h,scale,downscale,partial_alpha_pct,max_direction_h_variation_pct")
    for species in SPECIES:
        group = [row for row in rows if row["species"] == species]
        visible = [int(row["bbox_threshold_height"]) for row in group]
        partial = [
            100 * (int(row["alpha_1_9_count"]) + int(row["alpha_10_254_count"]))
            / (int(row["alpha_1_9_count"]) + int(row["alpha_10_254_count"]) + int(row["alpha_255_count"]))
            for row in group
        ]
        variations = []
        for gender in GENDERS:
            heights = [int(row["bbox_threshold_height"]) for row in group if row["gender"] == gender]
            variations.append(100 * (max(heights) - min(heights)) / statistics.mean(heights))
        canvas = sorted({f'{row["canvas_width"]}x{row["canvas_height"]}' for row in group})
        print(
            f'{species},{"|".join(canvas)},{statistics.median(visible):g},'
            f'{statistics.median(float(row["target_visual_height"]) for row in group):g},'
            f'{statistics.median(float(row["runtime_scale_factor"]) for row in group):.4f},'
            f'{statistics.median(float(row["visible_downscale_ratio"]) for row in group):.2f}:1,'
            f'{statistics.median(partial):.3f},{max(variations):.2f}'
        )
    print("\nDirection consistency by species/gender:")
    groups: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        groups[str(row["species"]), str(row["gender"])].append(row)
    for (species, gender), group in groups.items():
        heights = [int(row["bbox_threshold_height"]) for row in group]
        widths = [int(row["bbox_threshold_width"]) for row in group]
        bottoms = [int(row["padding_bottom"]) for row in group]
        variation = 100 * (max(heights) - min(heights)) / statistics.mean(heights)
        print(
            f"{species}/{gender}: visible_h={min(heights)}..{max(heights)}, "
            f"height_variation={variation:.2f}%, visible_w={min(widths)}..{max(widths)}, "
            f"bottom_padding={min(bottoms)}..{max(bottoms)}"
        )


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    rows, threshold, visual_scale, _ = audit(repo)
    output = repo / "docs/validation/raw/character_asset_audit.csv"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print_summary(rows, threshold, visual_scale)
    print(f"\nCreated: {output.relative_to(repo).as_posix()}")


if __name__ == "__main__":
    main()
