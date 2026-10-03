"""Deterministically export a Female WORLD runtime A/B pilot."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

from character_runtime_image import ALPHA_THRESHOLD, bbox, premultiplied_lanczos, round1_target_height, zero_transparent_rgb


DIRECTIONS = ("down", "left", "right", "up")
CCTV_ZOOM = 0.6206666666666667  # 720x380 viewport, 800x600 zone, then 0.98.


def alpha_distribution(alpha: Image.Image) -> tuple[int, int, int, int, int]:
    histogram = alpha.histogram()
    return histogram[0], sum(histogram[1:10]), sum(histogram[10:255]), histogram[255], sum(count > 0 for count in histogram)


def rgb_difference(first: Image.Image, second: Image.Image, mask: Image.Image) -> tuple[int, int, int]:
    pixels = mask.histogram()[255]
    total = maximum = 0
    zero = Image.new("L", first.size)
    for first_channel, second_channel in zip(first.convert("RGB").split(), second.convert("RGB").split()):
        difference = Image.composite(ImageChops.difference(first_channel, second_channel), zero, mask)
        histogram = difference.histogram()
        total += sum(value * count for value, count in enumerate(histogram))
        maximum = max(maximum, max(value for value, count in enumerate(histogram) if count))
    return total, pixels * 3, maximum


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=("1x", "2x", "4x", "6x"), default="1x")
    parser.add_argument("--filter", choices=("nearest", "lanczos"), default="nearest")
    parser.add_argument("--premultiply-alpha", action="store_true")
    parser.add_argument("--sharpen", choices=("weak",))
    parser.add_argument("--species", choices=("fox", "cat", "tiger"), default="fox")
    parser.add_argument("--gender", choices=("female",), default="female")
    args = parser.parse_args()
    profile, resize_filter, species, gender = args.profile, args.filter, args.species, args.gender
    if resize_filter == "lanczos" and profile not in ("4x", "6x"):
        parser.error("The comparison pilot only supports LANCZOS with --profile 4x or 6x")
    if args.premultiply_alpha and (profile != "4x" or resize_filter != "lanczos"):
        parser.error("Premultiplied alpha is limited to the 4x LANCZOS pilot")
    if args.sharpen and not args.premultiply_alpha:
        parser.error("Weak sharpening requires --premultiply-alpha")
    if species != "fox" and (profile != "4x" or resize_filter != "lanczos" or not args.premultiply_alpha or args.sharpen):
        parser.error("Cat/Tiger cross-validation is limited to 4x LANCZOS premultiplied-alpha")
    multiplier = int(profile[0])
    repo = Path(__file__).resolve().parents[1]
    source_root = repo / f"assets/characters/{species}/base/{gender}"
    production_root = repo / f"public/assets/characters/{species}/base/{gender}"
    pilot_root = repo / f"public/assets/characters/runtime-test/world/{species}/{gender}"
    output_root = pilot_root / "4lp" if species != "fox" else \
        pilot_root / "4x-lanczos-premultiplied-sharp" if args.sharpen else \
        pilot_root / "4x-lanczos-premultiplied" if args.premultiply_alpha else \
        pilot_root / "6x-lanczos" if resize_filter == "lanczos" and profile == "6x" else \
        pilot_root / "4x-lanczos" if resize_filter == "lanczos" else \
        pilot_root / "6x-nearest" if profile == "6x" else pilot_root if profile == "1x" else pilot_root / profile
    display_height = round1_target_height(repo, species)
    runtime_height = display_height * multiplier
    output_root.mkdir(parents=True, exist_ok=True)

    rows = []
    for direction in DIRECTIONS:
        name = f"{species}_{gender}_{direction}.png"
        source_path = source_root / name
        production_path = production_root / name
        output_path = output_root / name
        if source_path.read_bytes() != production_path.read_bytes():
            raise RuntimeError(f"Source and production A differ: {name}")
        with Image.open(source_path) as source:
            source.load()
            if source.mode != "RGBA":
                raise RuntimeError(f"Expected RGBA source: {source_path} ({source.mode})")
            runtime_width = round(source.width * runtime_height / source.height)
            size = runtime_width, runtime_height
            if args.premultiply_alpha:
                runtime = premultiplied_lanczos(source, size)
                if args.sharpen:
                    red, green, blue, alpha = runtime.split()
                    sharpened = Image.merge("RGB", (red, green, blue)).filter(
                        ImageFilter.UnsharpMask(radius=0.6, percent=40, threshold=3)
                    )
                    runtime = zero_transparent_rgb(Image.merge("RGBA", (*sharpened.split(), alpha)))
            else:
                resampling = Image.Resampling.NEAREST if resize_filter == "nearest" else Image.Resampling.LANCZOS
                runtime = source.resize(size, resampling)
            runtime.save(output_path, format="PNG", optimize=False, compress_level=9)

            comparison_path = pilot_root / ("4x-lanczos-premultiplied" if args.sharpen else "4x-lanczos") / name \
                if args.premultiply_alpha and species == "fox" else None
            comparison = Image.open(comparison_path) if comparison_path else \
                source.resize(size, Image.Resampling.LANCZOS) if args.premultiply_alpha else None
            if comparison and runtime.getchannel("A").tobytes() != comparison.getchannel("A").tobytes():
                raise RuntimeError(f"Alpha differs from comparison profile: {output_path}")
            if args.premultiply_alpha:
                transparent_rgb = runtime.convert("RGB").split()
                transparent = runtime.getchannel("A").point(lambda value: 255 if value == 0 else 0)
                if any(Image.composite(channel, Image.new("L", runtime.size), transparent).getbbox() for channel in transparent_rgb):
                    raise RuntimeError(f"Non-zero RGB remains under alpha=0: {output_path}")

            source_box = bbox(source.getchannel("A"))
            runtime_box = bbox(runtime.getchannel("A"))
            source_alphas = {value for value, count in enumerate(source.getchannel("A").histogram()) if count}
            runtime_alphas = {value for value, count in enumerate(runtime.getchannel("A").histogram()) if count}
            if runtime.mode != "RGBA" or resize_filter == "nearest" and not runtime_alphas.issubset(source_alphas):
                raise RuntimeError(f"Alpha samples changed unexpectedly: {output_path}")
            if any(value == edge for value, edge in zip(runtime_box, (0, 0, runtime.width, runtime.height))):
                raise RuntimeError(f"Visible bbox touches the pilot canvas edge: {output_path}")

            source_scale = display_height / source.height
            runtime_scale = display_height / runtime.height
            source_visible = (source_box[3] - source_box[1]) * source_scale * CCTV_ZOOM
            runtime_visible = (runtime_box[3] - runtime_box[1]) * runtime_scale * CCTV_ZOOM
            source_padding = (source_box[0] / source.width, (source.width - source_box[2]) / source.width,
                              source_box[1] / source.height, (source.height - source_box[3]) / source.height)
            runtime_padding = (runtime_box[0] / runtime.width, (runtime.width - runtime_box[2]) / runtime.width,
                               runtime_box[1] / runtime.height, (runtime.height - runtime_box[3]) / runtime.height)
            aspect_error = abs((runtime.width / runtime.height) / (source.width / source.height) - 1)
            padding_delta = max(abs(a - b) for a, b in zip(source_padding, runtime_padding))
            bbox_ratio_delta = max(
                abs((runtime_box[2] - runtime_box[0]) / runtime.width - (source_box[2] - source_box[0]) / source.width),
                abs((runtime_box[3] - runtime_box[1]) / runtime.height - (source_box[3] - source_box[1]) / source.height),
            )
            padding_tolerance = (4 if resize_filter == "lanczos" else 1) / runtime.width
            if aspect_error > 1 / runtime.width or padding_delta > padding_tolerance:
                raise RuntimeError(f"Integer resize rounding exceeded one output pixel: {output_path}")
            if resize_filter == "nearest" and abs(source_visible - runtime_visible) > CCTV_ZOOM:
                raise RuntimeError(f"Visible height changed by more than one CCTV pixel: {output_path}")
            rows.append({
                "direction": direction,
                "source": source.size,
                "runtime": runtime.size,
                "source_box": source_box,
                "runtime_box": runtime_box,
                "source_scale": source_scale,
                "runtime_scale": runtime_scale,
                "source_visible": source_visible,
                "runtime_visible": runtime_visible,
                "source_padding": source_padding,
                "runtime_padding": runtime_padding,
                "aspect_error": aspect_error,
                "padding_delta": padding_delta,
                "bbox_ratio_delta": bbox_ratio_delta,
                "source_alpha": alpha_distribution(source.getchannel("A")),
                "source_alpha_values": source_alphas,
                "alpha": alpha_distribution(runtime.getchannel("A")),
                "alpha_values": runtime_alphas,
                "source_png": production_path.stat().st_size,
                "runtime_png": output_path.stat().st_size,
                "source_raw": source.width * source.height * 4,
                "runtime_raw": runtime.width * runtime.height * 4,
                "difference": rgb_difference(
                    comparison,
                    runtime,
                    runtime.getchannel("A").point(
                        (lambda value: 255 if value > 0 else 0) if args.sharpen else
                        (lambda value: 255 if 0 < value < 255 else 0)
                    ),
                ) if comparison else None,
            })
            if comparison:
                comparison.close()

    if sorted(rows, key=lambda row: int(row["source_box"][3]) - int(row["source_box"][1])) != \
       sorted(rows, key=lambda row: int(row["runtime_box"][3]) - int(row["runtime_box"][1])):
        raise RuntimeError("Direction visible-height ordering changed")

    processing = " premultiplied" if args.premultiply_alpha else ""
    processing += " weak-sharpen" if args.sharpen else ""
    print(f"Character: {species.title()} {gender.title()}")
    print(f"Profile: {profile} {resize_filter.upper()}{processing}")
    print(f"Target visual height: {display_height}")
    print(f"CCTV zoom: {CCTV_ZOOM:.6f}")
    print("direction,A size,profile size,A scale,profile scale,A CCTV visible,profile CCTV visible,aspect error,max padding-ratio delta,bbox-ratio delta")
    for row in rows:
        print(
            f'{row["direction"]},{row["source"]},{row["runtime"]},'
            f'{row["source_scale"]:.8f},{row["runtime_scale"]:.8f},'
            f'{row["source_visible"]:.3f},{row["runtime_visible"]:.3f},'
            f'{row["aspect_error"]:.6f},{row["padding_delta"]:.6f},{row["bbox_ratio_delta"]:.6f}'
        )
    print("direction,A bbox,profile bbox,A bottom padding ratio,profile bottom padding ratio")
    for row in rows:
        print(
            f'{row["direction"]},{row["source_box"]},{row["runtime_box"]},'
            f'{row["source_padding"][3]:.6f},{row["runtime_padding"][3]:.6f}'
        )
    source_raw = sum(int(row["source_raw"]) for row in rows)
    runtime_raw = sum(int(row["runtime_raw"]) for row in rows)
    source_png = sum(int(row["source_png"]) for row in rows)
    runtime_png = sum(int(row["runtime_png"]) for row in rows)
    source_alpha = tuple(sum(int(row["source_alpha"][index]) for row in rows) for index in range(4))
    source_alpha_values = set().union(*(row["source_alpha_values"] for row in rows))
    runtime_alpha = tuple(sum(int(row["alpha"][index]) for row in rows) for index in range(4))
    runtime_alpha_values = set().union(*(row["alpha_values"] for row in rows))
    print(f"A decoded RGBA: {source_raw} bytes")
    print(f"{profile} decoded RGBA: {runtime_raw} bytes")
    print(f"Decoded reduction: {(1 - runtime_raw / source_raw) * 100:.3f}%")
    print(f"A PNG total: {source_png} bytes")
    print(f"{profile} PNG total: {runtime_png} bytes")
    print(f"A alpha distribution (0,1-9,10-254,255,unique): {source_alpha + (len(source_alpha_values),)}")
    print(f"Alpha distribution (0,1-9,10-254,255,unique): {runtime_alpha + (len(runtime_alpha_values),)}")
    if args.premultiply_alpha:
        print("Alpha matches straight LANCZOS reference: YES")
    print(f"Unique alpha values by direction: {tuple(int(row['alpha'][4]) for row in rows)}")
    differences = [row["difference"] for row in rows if row["difference"]]
    if differences:
        difference_total = sum(int(value[0]) for value in differences)
        difference_samples = sum(int(value[1]) for value in differences)
        print(f"RGB absolute difference mean/max: {difference_total / difference_samples:.6f}/{max(int(value[2]) for value in differences)}")
    if species == "fox" and resize_filter == "lanczos" and profile == "4x" and not args.premultiply_alpha:
        nearest_alpha = [0, 0, 0, 0]
        nearest_alpha_values: set[int] = set()
        nearest_unique = []
        for direction in DIRECTIONS:
            with Image.open(pilot_root / "4x" / f"{species}_{gender}_{direction}.png") as nearest:
                nearest_channel = nearest.getchannel("A")
                distribution = alpha_distribution(nearest_channel)
                for index, value in enumerate(distribution[:4]):
                    nearest_alpha[index] += value
                nearest_alpha_values.update(value for value, count in enumerate(nearest_channel.histogram()) if count)
                nearest_unique.append(distribution[4])
        print(f"4x NEAREST alpha distribution: {tuple(nearest_alpha) + (len(nearest_alpha_values),)}")
        print(f"4x NEAREST unique alpha values by direction: {tuple(nearest_unique)}")
        print(f"LANCZOS minus NEAREST: {tuple(runtime_alpha[index] - nearest_alpha[index] for index in range(4))}")


if __name__ == "__main__":
    main()
