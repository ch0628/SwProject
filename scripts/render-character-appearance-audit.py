"""Render contact sheets for visual QA of the 35 supervised character appearances."""

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


FRAME_COUNT = 6
DIRECTIONS = ("down", "left", "right", "up")
DISPLAY_HEIGHT = {"rabbit": 105, "cat": 126, "fox": 126, "dog": 147, "tiger": 168}


def appearance(character_id: str) -> str:
    number = int(character_id[-2:])
    return "base" if number <= 10 else f"v0{(number - 1) // 10}"


def character_pool(repo: Path):
    source = (repo / "src" / "characterPool.ts").read_text(encoding="utf-8")
    pattern = re.compile(r"d\('(NPC\d{2})','(rabbit|cat|fox|dog|tiger)','(female|male)'")
    return pattern.findall(source)


def runtime_paths(repo: Path, character_id: str, species: str, gender: str, direction: str):
    variant = appearance(character_id)
    prefix = f"{species}_{gender}" + ("" if variant == "base" else f"_{variant}")
    root = repo / "public" / "assets" / "characters" / "world" / species / gender / variant
    return root / "base" / f"{prefix}_{direction}.png", root / "walk" / f"{prefix}_walk_{direction}.png"


def display_frame(path: Path, species: str, frame: int | None = None) -> Image.Image:
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    if frame is not None:
        width = image.width // FRAME_COUNT
        image = image.crop((frame * width, 0, (frame + 1) * width, image.height))
    height = DISPLAY_HEIGHT[species]
    width = round(image.width * height / image.height)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def checker(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGBA", size, "#243039")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], 16):
        for x in range(0, size[0], 16):
            draw.rectangle((x, y, x + 15, y + 15), fill="#2d3a44" if (x // 16 + y // 16) % 2 else "#34434e")
    return image


def paste_bottom(sheet: Image.Image, sprite: Image.Image, center_x: int, baseline: int):
    sheet.alpha_composite(sprite, (center_x - sprite.width // 2, baseline - sprite.height))


def render_down_comparison(repo: Path, output: Path, pool) -> None:
    columns, cell_width, cell_height = 5, 340, 205
    rows = (len(pool) + columns - 1) // columns
    sheet = checker((columns * cell_width, rows * cell_height))
    draw, font = ImageDraw.Draw(sheet), ImageFont.load_default()
    for index, (character_id, species, gender) in enumerate(pool):
        x, y = index % columns * cell_width, index // columns * cell_height
        baseline = y + cell_height - 12
        idle_path, walk_path = runtime_paths(repo, character_id, species, gender, "down")
        idle = display_frame(idle_path, species)
        walk = display_frame(walk_path, species, 0)
        paste_bottom(sheet, idle, x + 90, baseline)
        paste_bottom(sheet, walk, x + 250, baseline)
        draw.line((x, baseline, x + cell_width, baseline), fill="#ffdf6b", width=2)
        draw.text((x + 8, y + 6), f"{character_id} {species} {gender} {appearance(character_id)}", font=font, fill="white")
        draw.text((x + 62, y + 22), "IDLE", font=font, fill="#9fe7ff")
        draw.text((x + 224, y + 22), "WALK F1", font=font, fill="#b8ff9f")
    output.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output / "down-idle-vs-walk.png", quality=95)


def render_directions(repo: Path, output: Path, pool) -> None:
    cell_width, row_height = 160, 205
    for variant in ("base", "v01", "v02", "v03"):
        members = [entry for entry in pool if appearance(entry[0]) == variant]
        sheet = checker((len(DIRECTIONS) * cell_width, len(members) * row_height))
        draw, font = ImageDraw.Draw(sheet), ImageFont.load_default()
        for row, (character_id, species, gender) in enumerate(members):
            baseline = (row + 1) * row_height - 12
            for column, direction in enumerate(DIRECTIONS):
                _, walk_path = runtime_paths(repo, character_id, species, gender, direction)
                sprite = display_frame(walk_path, species, 0)
                paste_bottom(sheet, sprite, column * cell_width + cell_width // 2, baseline)
                draw.line((column * cell_width, baseline, (column + 1) * cell_width, baseline), fill="#ffdf6b", width=2)
                draw.text((column * cell_width + 6, row * row_height + 24), direction, font=font, fill="#b8ff9f")
            draw.text((6, row * row_height + 6), f"{character_id} {species} {gender} {variant}", font=font, fill="white")
        sheet.convert("RGB").save(output / f"walk-directions-{variant}.png", quality=95)


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    output = repo / "reports" / "character-appearance-audit"
    pool = character_pool(repo)
    if len(pool) != 35:
        raise RuntimeError(f"Expected 35 characters, found {len(pool)}")
    render_down_comparison(repo, output, pool)
    render_directions(repo, output, pool)
    print(output)


if __name__ == "__main__":
    main()
