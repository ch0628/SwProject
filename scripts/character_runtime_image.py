"""Shared deterministic image operations for character runtime exports."""

import re
from pathlib import Path

from PIL import Image, ImageMath


ALPHA_THRESHOLD = 10


def round1_target_height(repo: Path, species: str) -> int:
    manifest = (repo / "src" / "characterManifest.ts").read_text(encoding="utf-8")
    block = re.search(r"SPECIES_DISPLAY_HEIGHT[^=]*=\s*Object\.freeze\(\{(.*?)\}\);", manifest, re.DOTALL)
    match = block and re.search(rf"\b{re.escape(species)}:\s*(\d+)", block.group(1))
    if not match:
        raise RuntimeError(f"Unknown character species: {species}")
    return int(match.group(1))


def bbox(alpha: Image.Image) -> tuple[int, int, int, int]:
    result = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0).getbbox()
    if result is None:
        raise RuntimeError("Empty alpha bbox")
    return result


def float_to_l(image: Image.Image) -> Image.Image:
    return ImageMath.lambda_eval(
        lambda args: args["convert"](args["min"](args["max"](args["image"] + 0.5, 0), 255), "L"),
        image=image,
    )


def zero_transparent_rgb(image: Image.Image) -> Image.Image:
    red, green, blue, alpha = image.split()
    visible = alpha.point(lambda value: 255 if value else 0)
    zero = Image.new("L", image.size)
    return Image.merge("RGBA", tuple(Image.composite(channel, zero, visible) for channel in (red, green, blue)) + (alpha,))


def premultiplied_lanczos(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    source_alpha = source.getchannel("A")
    alpha = source_alpha.resize(size, Image.Resampling.LANCZOS)
    alpha_float = alpha.convert("F")
    channels = []
    for channel in source.convert("RGB").split():
        premultiplied = ImageMath.lambda_eval(
            lambda args: args["channel"] * args["alpha"] / 255.0,
            channel=channel.convert("F"), alpha=source_alpha.convert("F"),
        ).resize(size, Image.Resampling.LANCZOS)
        straight = ImageMath.lambda_eval(
            lambda args: args["premultiplied"] * 255.0 / (args["alpha"] + (args["alpha"] == 0)) * (args["alpha"] != 0),
            premultiplied=premultiplied, alpha=alpha_float,
        )
        channels.append(float_to_l(straight))
    return zero_transparent_rgb(Image.merge("RGBA", (*channels, alpha)))
