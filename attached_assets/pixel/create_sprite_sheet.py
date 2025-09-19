#!/usr/bin/env python3
"""Create a sprite sheet and JSON atlas from Pixel mascot images."""

import json
import os
from PIL import Image
from pathlib import Path

def create_sprite_sheet(input_dir=".", output_name="pixel_sprites"):
    """Create a sprite sheet and JSON atlas from all PNG images in the directory."""
    
    # Get all PNG files in the directory
    image_files = sorted([f for f in os.listdir(input_dir) if f.endswith('.png') and f.startswith('Pixel')])
    
    if not image_files:
        print("No Pixel PNG images found!")
        return
    
    # Load all images
    images = []
    for img_file in image_files:
        img = Image.open(os.path.join(input_dir, img_file))
        images.append((img_file, img))
    
    # Calculate sprite sheet dimensions (5x5 grid for 25 images)
    img_width, img_height = images[0][1].size
    cols = 5
    rows = 5
    sheet_width = img_width * cols
    sheet_height = img_height * rows
    
    # Create sprite sheet
    sprite_sheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))
    
    # Create JSON atlas
    atlas = {
        "meta": {
            "image": f"{output_name}.png",
            "size": {"w": sheet_width, "h": sheet_height},
            "scale": 1
        },
        "frames": {}
    }
    
    # Place images and record positions
    for idx, (filename, img) in enumerate(images):
        row = idx // cols
        col = idx % cols
        x = col * img_width
        y = row * img_height
        
        # Paste image onto sprite sheet
        sprite_sheet.paste(img, (x, y))
        
        # Extract expression name from filename
        # Format: Pixel_expression_name_hash.png
        parts = filename.replace('Pixel_', '').replace('.png', '').rsplit('_', 1)
        expression_name = parts[0] if parts else filename
        
        # Add to atlas
        atlas["frames"][expression_name] = {
            "frame": {"x": x, "y": y, "w": img_width, "h": img_height},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": img_width, "h": img_height},
            "sourceSize": {"w": img_width, "h": img_height}
        }
    
    # Save sprite sheet
    sprite_sheet.save(f"{output_name}.png")
    print(f"Created sprite sheet: {output_name}.png ({sheet_width}x{sheet_height})")
    
    # Save JSON atlas
    with open(f"{output_name}.json", 'w') as f:
        json.dump(atlas, f, indent=2)
    print(f"Created JSON atlas: {output_name}.json")
    
    # Print summary
    print(f"\nSprite sheet contains {len(images)} images:")
    for expression in sorted(atlas["frames"].keys()):
        print(f"  - {expression}")

if __name__ == "__main__":
    create_sprite_sheet()