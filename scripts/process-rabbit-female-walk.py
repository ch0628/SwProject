"""Validate and build Rabbit Female walk masters from exact 3x2 source cells."""

from pathlib import Path
from statistics import mean, median

from PIL import Image

from character_runtime_image import ALPHA_THRESHOLD, bbox


DIRECTIONS = ("down", "left", "right", "up")
FRAME_COUNT = 6


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False, compress_level=6)


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    source_root = repo / "assets/characters/rabbit/animations/female/source/walk"
    output_root = repo / "assets/characters/rabbit/animations/female/processed"
    static_root = repo / "assets/characters/rabbit/base/female"
    prepared: dict[str, tuple[list[Image.Image], list[tuple[int, int, int, int]]]] = {}
    frame_size = None

    for direction in DIRECTIONS:
        source_path = source_root / f"rabbit_female_walk_{direction}.png"
        with Image.open(source_path) as opened:
            opened.load()
            if opened.mode != "RGBA" or opened.width % 3 or opened.height % 2:
                raise RuntimeError(f"{source_path}: expected RGBA with an exact 3x2 grid")
            source = opened.copy()
        current_size = source.width // 3, source.height // 2
        if frame_size is None:
            frame_size = current_size
        elif current_size != frame_size:
            raise RuntimeError(f"{source_path}: frame size {current_size} does not match {frame_size}")
        frames = [source.crop((index % 3 * current_size[0], index // 3 * current_size[1],
                               (index % 3 + 1) * current_size[0], (index // 3 + 1) * current_size[1]))
                  for index in range(FRAME_COUNT)]
        boxes = [bbox(frame.getchannel("A")) for frame in frames]
        clipped = [index + 1 for index, box in enumerate(boxes)
                   if box[0] == 0 or box[1] == 0 or box[2] == current_size[0] or box[3] == current_size[1]]
        if clipped:
            raise RuntimeError(f"{source_path}: visibly source-edge-clipped frames {clipped}")
        prepared[direction] = frames, boxes
        print(direction, "raw", source.size, "frame", current_size, "visible_bboxes", boxes)

    assert frame_size is not None
    for direction, (frames, boxes) in prepared.items():
        frame_root = output_root / f"walk_{direction}"
        for index, frame in enumerate(frames, 1):
            save_png(frame, frame_root / f"rabbit_female_walk_{direction}_{index:02}.png")
        sheet = Image.new("RGBA", (frame_size[0] * FRAME_COUNT, frame_size[1]))
        for index, frame in enumerate(frames):
            sheet.paste(frame, (index * frame_size[0], 0))
        output_path = output_root / f"rabbit_female_walk_{direction}.png"
        save_png(sheet, output_path)
        with Image.open(output_path) as saved:
            saved.load()
            assert saved.mode == "RGBA" and saved.size == sheet.size
            assert all(saved.crop((index * frame_size[0], 0, (index + 1) * frame_size[0], frame_size[1])).tobytes() == frame.tobytes()
                       for index, frame in enumerate(frames))

        with Image.open(static_root / f"rabbit_female_{direction}.png") as opened:
            static_size = opened.size
            static_box = bbox(opened.getchannel("A"))
        widths = [box[2] - box[0] for box in boxes]
        heights = [box[3] - box[1] for box in boxes]
        static_height = static_box[3] - static_box[1]
        walk_median_height = median(heights)
        raw_ratio = static_height / walk_median_height
        apparent_ratio = (static_height / static_size[1]) / (walk_median_height / frame_size[1])
        print(direction, "static", static_size, static_box,
              "walk_width", (min(widths), max(widths), mean(widths), median(widths)),
              "walk_height", (min(heights), max(heights), mean(heights), walk_median_height),
              "static_walk_ratio", raw_ratio, "normalized_apparent_ratio", apparent_ratio,
              "output", output_path)

    print("clipping", f"PASS {len(DIRECTIONS) * FRAME_COUNT}/{len(DIRECTIONS) * FRAME_COUNT}",
          f"alpha_threshold>{ALPHA_THRESHOLD}")


if __name__ == "__main__":
    main()
