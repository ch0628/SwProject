"""Export the Cat Female walk pilot by resizing each frame independently."""

import hashlib
import sys
from pathlib import Path

from PIL import Image

from character_runtime_image import bbox, premultiplied_lanczos, round1_target_height


FRAME_COUNT = 6
ANIMATIONS = ("walk_left", "walk_right", "walk_up", "walk_down")
VARIANTS = ("walk_down_2",)


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    source_root = repo / "assets/characters/cat/animations/female/processed"
    output_base = repo / "public/assets/characters/runtime-test/world/cat/female/animation/walk"
    target_height = round1_target_height(repo, "cat")
    runtime_height = target_height * 4
    selected = tuple(sys.argv[1:]) or ANIMATIONS
    if unknown := set(selected) - set(ANIMATIONS) - set(VARIANTS):
        raise SystemExit(f"Unknown animation(s): {', '.join(sorted(unknown))}")

    expected_frame_size = None
    for animation in selected:
        output_root = output_base / ("4lp-v2" if animation in VARIANTS else "4lp")
        output_root.mkdir(parents=True, exist_ok=True)
        source_path = source_root / f"cat_female_{animation}.png"
        with Image.open(source_path) as opened:
            opened.load()
            if opened.mode != "RGBA" or opened.width % FRAME_COUNT:
                raise RuntimeError(f"Expected an RGBA horizontal {FRAME_COUNT}-frame sheet: {source_path}")
            source = opened.copy()

        frame_size = source.width // FRAME_COUNT, source.height
        if expected_frame_size is None:
            expected_frame_size = frame_size
        elif frame_size != expected_frame_size:
            raise RuntimeError(f"Walk directions must share frame dimensions: {source_path}")

        runtime_width = round(frame_size[0] * runtime_height / frame_size[1])
        runtime_size = runtime_width, runtime_height
        source_frames = [source.crop((index * frame_size[0], 0, (index + 1) * frame_size[0], frame_size[1])) for index in range(FRAME_COUNT)]
        source_boxes = [bbox(frame.getchannel("A")) for frame in source_frames]
        if any(box[0] == 0 or box[1] == 0 or box[2] == frame_size[0] or box[3] == frame_size[1] for box in source_boxes):
            raise RuntimeError(f"Source frame is clipped: {source_path}")

        runtime_frames = [premultiplied_lanczos(frame, runtime_size) for frame in source_frames]
        runtime_boxes = [bbox(frame.getchannel("A")) for frame in runtime_frames]
        if any(box[0] == 0 or box[1] == 0 or box[2] == runtime_width or box[3] == runtime_height for box in runtime_boxes):
            raise RuntimeError(f"Runtime frame is clipped: {source_path}")
        if any(frame.mode != "RGBA" or frame.getchannel("A").getextrema()[0] != 0 or frame.getchannel("A").getextrema()[1] == 0 for frame in runtime_frames):
            raise RuntimeError(f"Invalid runtime RGBA/alpha range: {source_path}")

        runtime_sheet = Image.new("RGBA", (runtime_width * FRAME_COUNT, runtime_height))
        for index, frame in enumerate(runtime_frames):
            runtime_sheet.paste(frame, (index * runtime_width, 0))
        output_path = output_root / source_path.name
        runtime_sheet.save(output_path, format="PNG", optimize=False, compress_level=9)

        with Image.open(output_path) as saved:
            saved.load()
            assert saved.mode == "RGBA" and saved.size == runtime_sheet.size
            assert all(saved.crop((index * runtime_width, 0, (index + 1) * runtime_width, runtime_height)).tobytes() == frame.tobytes()
                       for index, frame in enumerate(runtime_frames))

        visible_widths = [box[2] - box[0] for box in source_boxes]
        visible_heights = [box[3] - box[1] for box in source_boxes]
        bottoms = [box[3] for box in source_boxes]
        print(f"{animation}: source={source.size} frame={frame_size} frames={FRAME_COUNT} decoded={source.width * source.height * 4}")
        print(f"  source_bboxes={source_boxes}")
        print(f"  source_visible_width={min(visible_widths)}..{max(visible_widths)} visible_height={min(visible_heights)}..{max(visible_heights)} bottom={min(bottoms)}..{max(bottoms)}")
        print(f"  runtime={runtime_sheet.size} frame={runtime_size} decoded={runtime_sheet.width * runtime_sheet.height * 4}")
        print(f"  runtime_bboxes={runtime_boxes}")
        print(f"  sha256={hashlib.sha256(output_path.read_bytes()).hexdigest()}")

    print(f"target_visual_height={target_height} runtime_scale={target_height / runtime_height:.2f}")
    print("filter=premultiplied-alpha LANCZOS sharpen=NONE")


if __name__ == "__main__":
    main()
