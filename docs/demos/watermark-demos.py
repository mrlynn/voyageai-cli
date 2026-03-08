#!/usr/bin/env python3
"""
watermark-demos.py
──────────────────
Applies the VAI brand watermark to VHS demo GIFs.

FIRST-TIME SETUP (macOS / Homebrew Python):
  python3 watermark-demos.py --setup
  source .venv/bin/activate
  python3 watermark-demos.py recording.gif

  Or run directly without activating:
  .venv/bin/python3 watermark-demos.py recording.gif

Supports two watermark styles:
  --style logo     → "V" lettermark with teal/cyan gradient  (default)
  --style robot    → Pixel-art robot mascot

Usage:
  # Watermark a single GIF
  python3 watermark-demos.py recording.gif

  # Watermark all GIFs in a directory
  python3 watermark-demos.py ./tapes/

  # Choose watermark style and position
  python3 watermark-demos.py recording.gif --style robot --position top-left

  # Custom opacity and size
  python3 watermark-demos.py recording.gif --opacity 0.25 --size 48

  # Preview without saving (prints frame count and output path)
  python3 watermark-demos.py recording.gif --dry-run

Options:
  --setup                             Create .venv and install dependencies
  --style       logo | robot          Watermark graphic  (default: logo)
  --position    bottom-right | bottom-left | top-right | top-left
                                      Placement          (default: bottom-right)
  --opacity     0.0–1.0               Watermark opacity  (default: 0.20)
  --size        pixels                Watermark height   (default: 40)
  --margin      pixels                Edge margin        (default: 12)
  --suffix      string                Output filename suffix (default: _watermarked)
  --overwrite                         Overwrite the source file
  --dry-run                           Print what would happen, don't write files
  --output      path                  Output directory   (default: same as input)
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

# ─── Venv bootstrap ──────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent.resolve()
VENV_DIR   = SCRIPT_DIR / ".venv"
VENV_PY    = VENV_DIR / "bin" / "python3"


def setup_venv():
    """Create a local .venv and install Pillow into it."""
    print("\n  VAI Demo Watermarker — first-time setup")
    print("  ─────────────────────────────────────────")

    if not VENV_DIR.exists():
        print("  Creating .venv …")
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
        print("  ✓  .venv created")
    else:
        print("  ✓  .venv already exists")

    print("  Installing dependencies (pillow, cairosvg) …")
    subprocess.run(
        [str(VENV_PY), "-m", "pip", "install", "--quiet", "pillow", "numpy"],
        check=True
    )
    print("  ✓  pillow + numpy installed")

    print("""
  Setup complete. To run the watermarker:

    # Option A — use the venv Python directly (no activation needed):
    .venv/bin/python3 watermark-demos.py recording.gif

    # Option B — activate the venv first:
    source .venv/bin/activate
    python3 watermark-demos.py recording.gif
    deactivate
""")


# Handle --setup before importing Pillow (it may not exist yet)
if "--setup" in sys.argv:
    setup_venv()
    sys.exit(0)

# If dependencies are missing, give a clear, actionable error
try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageSequence
except ImportError as _e:
    print(f"\n  ❌  Missing dependency: {_e}\n")
    print("  Run setup first:\n")
    print("    python3 watermark-demos.py --setup\n")
    print("  Then run with the venv Python:\n")
    print("    .venv/bin/python3 watermark-demos.py recording.gif\n")
    sys.exit(1)

import re
import xml.etree.ElementTree as ET


# ─── Asset paths ─────────────────────────────────────────────────────────────

LOGO_PATH  = SCRIPT_DIR / "logo.png"
ROBOT_PATH = SCRIPT_DIR / "robot.svg"


# ─── Watermark renderers ─────────────────────────────────────────────────────

def render_logo(size: int) -> Image.Image:
    """
    Loads logo.png from the script directory.
    The logo has a solid black background with dark artwork — we extract the
    artwork by treating pixel brightness as an alpha mask, then render it white
    so it reads clearly on dark terminal GIFs.
    Returns an RGBA image scaled to (size × size).
    """
    if not LOGO_PATH.exists():
        sys.exit(f"❌  logo.png not found at {LOGO_PATH}\n"
                  "    Place logo.png alongside watermark-demos.py in docs/demos/")

    img = Image.open(LOGO_PATH).convert("RGBA")
    arr = np.array(img, dtype=float)

    # Black background has brightness ~0; artwork has brightness > 0.
    # Amplify faint anti-aliased edges so they don't disappear at small sizes.
    brightness = arr[:, :, :3].mean(axis=2)
    alpha = np.clip(brightness * 4, 0, 255).astype(np.uint8)

    out = np.zeros((arr.shape[0], arr.shape[1], 4), dtype=np.uint8)
    out[:, :, 0] = 255  # R — white artwork
    out[:, :, 1] = 255  # G
    out[:, :, 2] = 255  # B
    out[:, :, 3] = alpha

    result = Image.fromarray(out, "RGBA")
    return result.resize((size, size), Image.LANCZOS)


def _hex_to_rgba(hex_color: str) -> tuple:
    """Convert #rrggbb hex string to (r, g, b, 255)."""
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def render_robot(size: int) -> Image.Image:
    """
    Parses robot.svg directly — no Cairo or system libraries needed.
    The SVG is a grid of <rect> elements; we rasterise each one using Pillow.
    Returns an RGBA image scaled to (size × size).
    """
    if not ROBOT_PATH.exists():
        sys.exit(f"❌  robot.svg not found at {ROBOT_PATH}\n"
                  "    Place robot.svg alongside watermark-demos.py in docs/demos/")

    tree = ET.parse(ROBOT_PATH)
    root = tree.getroot()

    # Read the SVG's own declared dimensions for the scale factor
    ns   = re.match(r"\{.*\}", root.tag)
    ns   = ns.group(0) if ns else ""
    vbox = root.get("viewBox", "")
    if vbox:
        _, _, vb_w, vb_h = map(float, vbox.split())
    else:
        vb_w = float(root.get("width",  size))
        vb_h = float(root.get("height", size))

    scale_x = size / vb_w
    scale_y = size / vb_h

    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for elem in root.iter(f"{ns}rect"):
        x      = float(elem.get("x",      0)) * scale_x
        y      = float(elem.get("y",      0)) * scale_y
        w      = float(elem.get("width",  0)) * scale_x
        h      = float(elem.get("height", 0)) * scale_y
        fill   = elem.get("fill", "none")
        if fill == "none" or not fill.startswith("#"):
            continue
        color  = _hex_to_rgba(fill)
        draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)

    return img


RENDERERS = {
    "logo":  render_logo,
    "robot": render_robot,
}


# ─── Compositing ──────────────────────────────────────────────────────────────

def compute_position(
    frame_w: int, frame_h: int,
    wm_w: int,    wm_h: int,
    position: str, margin: int
) -> tuple[int, int]:
    positions = {
        "bottom-right": (frame_w - wm_w - margin, frame_h - wm_h - margin),
        "bottom-left":  (margin,                   frame_h - wm_h - margin),
        "top-right":    (frame_w - wm_w - margin,  margin),
        "top-left":     (margin,                   margin),
    }
    return positions.get(position, positions["bottom-right"])


def apply_watermark(
    input_path: Path,
    output_path: Path,
    watermark: Image.Image,
    opacity: float,
    position: str,
    margin: int,
    dry_run: bool = False,
) -> int:
    """
    Composites *watermark* onto every frame of the GIF at *input_path*.
    Returns the number of frames processed.
    """
    src = Image.open(input_path)
    frames  = []
    durations = []

    # Build a faded copy of the watermark
    wm = watermark.copy().convert("RGBA")
    r, g, b, a = wm.split()
    a = a.point(lambda v: int(v * opacity))
    wm.putalpha(a)
    wm_w, wm_h = wm.size

    for frame in ImageSequence.Iterator(src):
        frame_rgba = frame.convert("RGBA")
        fw, fh     = frame_rgba.size
        x, y       = compute_position(fw, fh, wm_w, wm_h, position, margin)

        composite = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        composite.paste(frame_rgba, (0, 0))
        composite.alpha_composite(wm, dest=(x, y))

        frames.append(composite.convert("P", palette=Image.ADAPTIVE, colors=256))

        info = frame.info
        durations.append(info.get("duration", 100))

    if not dry_run and frames:
        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            loop=src.info.get("loop", 0),
            duration=durations,
            optimize=False,
        )

    return len(frames)


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Apply the VAI brand watermark to VHS demo GIFs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("input",     help="GIF file or directory containing GIFs")
    p.add_argument("--style",   choices=["logo", "robot"], default="logo",
                   help="Watermark graphic  (default: logo)")
    p.add_argument("--position",
                   choices=["bottom-right", "bottom-left", "top-right", "top-left"],
                   default="bottom-right",
                   help="Placement  (default: bottom-right)")
    p.add_argument("--opacity", type=float, default=0.20,
                   help="Watermark opacity 0–1  (default: 0.20)")
    p.add_argument("--size",    type=int, default=40,
                   help="Watermark height in pixels  (default: 40)")
    p.add_argument("--margin",  type=int, default=12,
                   help="Edge margin in pixels  (default: 12)")
    p.add_argument("--suffix",  default="_watermarked",
                   help="Appended to output filename  (default: _watermarked)")
    p.add_argument("--overwrite", action="store_true",
                   help="Overwrite the source file")
    p.add_argument("--output",  default=None,
                   help="Output directory  (default: same as input)")
    p.add_argument("--dry-run", action="store_true",
                   help="Print what would happen without writing files")
    return p.parse_args()


def collect_gifs(input_path: str) -> list[Path]:
    p = Path(input_path)
    if p.is_dir():
        return sorted(p.glob("*.gif"))
    if p.suffix.lower() == ".gif":
        return [p]
    sys.exit(f"❌  '{input_path}' is not a GIF file or directory.")


def output_path_for(src: Path, args: argparse.Namespace) -> Path:
    if args.overwrite:
        return src
    stem = src.stem + args.suffix
    out_dir = Path(args.output) if args.output else src.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / (stem + ".gif")


def main():
    args = parse_args()

    if not (0.0 <= args.opacity <= 1.0):
        sys.exit("❌  --opacity must be between 0.0 and 1.0")
    if args.size < 8:
        sys.exit("❌  --size must be at least 8 pixels")

    gifs = collect_gifs(args.input)
    if not gifs:
        sys.exit(f"❌  No GIF files found in '{args.input}'")

    renderer  = RENDERERS[args.style]
    watermark = renderer(args.size)
    label     = "V logo" if args.style == "logo" else "pixel robot"

    print(f"\n  VAI Demo Watermarker")
    print(f"  ────────────────────────────────────────")
    print(f"  Watermark : {label}  ({args.size}px, {int(args.opacity*100)}% opacity)")
    print(f"  Position  : {args.position}  +{args.margin}px margin")
    print(f"  Mode      : {'dry run — no files written' if args.dry_run else 'write'}\n")

    ok = fail = 0
    for gif in gifs:
        out = output_path_for(gif, args)
        try:
            n = apply_watermark(
                gif, out, watermark,
                opacity=args.opacity,
                position=args.position,
                margin=args.margin,
                dry_run=args.dry_run,
            )
            status = "dry-run" if args.dry_run else "✓"
            print(f"  {status}  {gif.name}  →  {out.name}  ({n} frames)")
            ok += 1
        except Exception as e:
            print(f"  ✗  {gif.name}  —  {e}")
            fail += 1

    print(f"\n  Done: {ok} processed, {fail} failed.\n")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()