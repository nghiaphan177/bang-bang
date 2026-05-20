#!/usr/bin/env python3
import os
import sys
import argparse
from PIL import Image

def flood_fill_remove_background(img, tolerance=30):
    """
    Performs a Breadth-First Search (BFS) flood-fill starting from the four corners.
    Any connected pixel that is close to pure white (RGB distance < tolerance)
    is marked as transparent.
    """
    img = img.convert("RGBA")
    width, height = img.size
    data = img.load()
    
    visited = set()
    queue = []
    
    # Add four corners to queue
    corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    for pt in corners:
        queue.append(pt)
        visited.add(pt)
        
    while queue:
        cx, cy = queue.pop(0)
        r, g, b, a = data[cx, cy]
        
        # Calculate Euclidean distance to white (255, 255, 255)
        dist = ((r - 255)**2 + (g - 255)**2 + (b - 255)**2)**0.5
        if dist < tolerance:
            # Mark pixel as transparent
            data[cx, cy] = (r, g, b, 0)
            
            # Add neighbors (4-directional)
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in visited:
                        visited.add((nx, ny))
                        queue.append((nx, ny))
                        
    return img

def make_square_and_resize(img, size):
    """
    Crops the image to its non-transparent bounding box, pads it back into
    a square to keep it centered, and resizes it to the target size.
    """
    # 1. Crop to non-transparent bounds
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    # 2. Pad to a square aspect ratio centered
    width, height = img.size
    max_dim = max(width, height)
    
    square_img = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
    offset_x = (max_dim - width) // 2
    offset_y = (max_dim - height) // 2
    
    square_img.paste(img, (offset_x, offset_y))
    
    # 3. Resize to target size using high-quality Lanczos resampling
    return square_img.resize((size, size), Image.Resampling.LANCZOS)

def main():
    parser = argparse.ArgumentParser(description="Clean, remove white background, center and resize 2.5D game assets.")
    parser.add_argument("--input", required=True, help="Path to input image file")
    parser.add_argument("--output", required=True, help="Path to save processed image file")
    parser.add_argument("--size", type=int, default=128, help="Target size (width and height in pixels)")
    parser.add_argument("--tolerance", type=int, default=35, help="Color tolerance for white background removal")
    parser.add_argument("--no-remove-bg", action="store_true", help="Skip background removal")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input):
        print(f"Error: Input file '{args.input}' does not exist.")
        sys.exit(1)
        
    try:
        img = Image.open(args.input)
        
        # 1. Background removal
        if not args.no_remove_bg:
            print(f"Removing white background (tolerance={args.tolerance})...")
            img = flood_fill_remove_background(img, args.tolerance)
        else:
            print("Skipping background removal.")
            
        # 2. Center, square, and downscale
        print(f"Resizing and centering to {args.size}x{args.size}...")
        processed_img = make_square_and_resize(img, args.size)
        
        # Ensure output directory exists
        out_dir = os.path.dirname(args.output)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
            
        processed_img.save(args.output, "PNG")
        print(f"Successfully processed and saved to: {args.output}")
        
    except Exception as e:
        print(f"Failed to process image: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
