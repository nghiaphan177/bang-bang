#!/usr/bin/env python3
"""
Asset Processing Script — Bang Bang Remake
Uses rembg (neural network) for high-quality background removal.
Replaces the old BFS flood-fill approach.

Usage:
    # Single file
    python process_assets.py --input raw.png --output clean.png

    # Batch process a directory
    python process_assets.py --input raw_folder/ --output clean_folder/

    # With optional resize
    python process_assets.py --input raw.png --output clean.png --size 512

Prerequisites:
    pip install rembg[gpu] pillow
    # or without GPU: pip install rembg pillow
"""

import os
import sys
import argparse
from pathlib import Path

try:
    from rembg import remove
except ImportError:
    print("ERROR: rembg is not installed. Run: pip install rembg[gpu]")
    sys.exit(1)

from PIL import Image


def process_single(input_path: str, output_path: str, size: int | None = None) -> None:
    """Remove background from a single image and optionally resize."""
    print(f"Processing: {input_path}")

    with open(input_path, "rb") as f:
        input_data = f.read()

    output_data = remove(input_data)

    img = Image.open(__import__("io").BytesIO(output_data)).convert("RGBA")

    # Auto-crop transparent borders
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    # Resize if requested (Lanczos for high quality)
    if size:
        img.thumbnail((size, size), Image.Resampling.LANCZOS)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    img.save(output_path, "PNG")
    print(f"  → Saved: {output_path} ({img.width}x{img.height})")


def process_batch(input_dir: str, output_dir: str, size: int | None = None) -> None:
    """Process all PNG/JPG files in a directory."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    extensions = {".png", ".jpg", ".jpeg", ".webp"}
    files = [f for f in input_path.iterdir() if f.suffix.lower() in extensions]

    if not files:
        print(f"No image files found in {input_dir}")
        return

    print(f"Processing {len(files)} files from {input_dir}...")
    for f in sorted(files):
        out_file = output_path / f"{f.stem}.png"
        process_single(str(f), str(out_file), size)

    print(f"\nDone! {len(files)} files processed → {output_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove backgrounds from images using rembg neural network"
    )
    parser.add_argument("--input", "-i", required=True, help="Input file or directory")
    parser.add_argument("--output", "-o", required=True, help="Output file or directory")
    parser.add_argument(
        "--size", "-s", type=int, default=None,
        help="Optional: max dimension to resize to (maintains aspect ratio)"
    )

    args = parser.parse_args()

    if os.path.isdir(args.input):
        process_batch(args.input, args.output, args.size)
    elif os.path.isfile(args.input):
        process_single(args.input, args.output, args.size)
    else:
        print(f"ERROR: Input not found: {args.input}")
        sys.exit(1)


if __name__ == "__main__":
    main()
