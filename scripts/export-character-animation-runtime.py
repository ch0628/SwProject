"""Export the 35 canonical supervised appearances from static and processed sources."""

import argparse
import re
from pathlib import Path

from PIL import Image

from character_runtime_image import bbox, premultiplied_lanczos, round1_target_height


FRAME_COUNT = 6
DIRECTIONS = ("down", "left", "right", "up")
PIXEL_DENSITY = 2
SPECIES = ("cat", "dog", "fox", "rabbit", "tiger")


def natural_key(path: Path) -> tuple:
    return tuple(int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", path.name))


def appearance_sets(root: Path):
    for species in SPECIES:
        species_dir = root / species
        for gender in ("female", "male"):
            yield species, gender, "base"
            variants = species_dir / "variants" / gender
            if variants.is_dir():
                for variant in sorted(path.name for path in variants.iterdir() if path.is_dir()):
                    yield species, gender, variant


def source_roots(root: Path, species: str, gender: str, appearance: str) -> tuple[Path, Path]:
    if appearance == "base":
        static_root = root / species / "base" / gender
        if not (static_root / f"{species}_{gender}_down.png").is_file():
            static_root /= "idle"
        return static_root, root / species / "animations" / gender / "processed"
    variant_root = root / species / "variants" / gender / appearance
    return variant_root / "base", variant_root / "animations" / "processed"


def checked_rgba(path: Path) -> Image.Image:
    with Image.open(path) as opened:
        opened.load()
        if opened.mode != "RGBA" or opened.size != (512, 682):
            raise RuntimeError(f"Expected 512x682 RGBA image: {path} ({opened.mode} {opened.size})")
        image = opened.copy()
    bbox(image.getchannel("A"))
    return image


def export_set(repo: Path, species: str, gender: str, appearance: str) -> int:
    assets_root = repo / "assets" / "characters"
    static_root, processed_root = source_roots(assets_root, species, gender, appearance)
    prefix = f"{species}_{gender}" + ("" if appearance == "base" else f"_{appearance}")
    output_root = repo / "public" / "assets" / "characters" / "world" / species / gender / appearance
    runtime_height = round1_target_height(repo, species) * PIXEL_DENSITY
    runtime_width = round(512 * runtime_height / 682)
    runtime_size = runtime_width, runtime_height
    written = 0

    for direction in DIRECTIONS:
        static_path = static_root / f"{prefix}_{direction}.png"
        static_runtime = premultiplied_lanczos(checked_rgba(static_path), runtime_size)
        static_output = output_root / "base" / static_path.name
        static_output.parent.mkdir(parents=True, exist_ok=True)
        static_runtime.save(static_output, format="PNG", optimize=False, compress_level=9)
        written += 1

        frame_paths = sorted((processed_root / f"walk_{direction}").glob("*.png"), key=natural_key)
        if len(frame_paths) != FRAME_COUNT:
            raise RuntimeError(f"Expected {FRAME_COUNT} frames: {processed_root / f'walk_{direction}'}")
        frames = [premultiplied_lanczos(checked_rgba(path), runtime_size) for path in frame_paths]
        sheet = Image.new("RGBA", (runtime_width * FRAME_COUNT, runtime_height))
        for index, frame in enumerate(frames):
            sheet.paste(frame, (index * runtime_width, 0))
        walk_output = output_root / "walk" / f"{prefix}_walk_{direction}.png"
        walk_output.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(walk_output, format="PNG", optimize=False, compress_level=9)
        written += 1

    print(f"{species}/{gender}/{appearance}: frame={runtime_width}x{runtime_height} files={written}")
    return written


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--species")
    parser.add_argument("--gender", choices=("female", "male"))
    parser.add_argument("--appearance")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    sets = [item for item in appearance_sets(repo / "assets" / "characters")
            if (not args.species or item[0] == args.species)
            and (not args.gender or item[1] == args.gender)
            and (not args.appearance or item[2] == args.appearance)]
    if not sets:
        raise RuntimeError("No matching character appearances")
    written = sum(export_set(repo, *item) for item in sets)
    print(f"exported appearances={len(sets)} files={written} pixel_density={PIXEL_DENSITY}")


if __name__ == "__main__":
    main()
