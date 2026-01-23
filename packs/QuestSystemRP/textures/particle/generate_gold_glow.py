"""
Simple script to generate the gold glow particle texture.
Requires: pip install pillow

Run: python generate_gold_glow.py
"""

from PIL import Image, ImageDraw
import math

def create_soft_glow(size=64):
    """Create a soft circular glow texture."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = size / 2
    max_radius = size / 2

    # Create radial gradient by drawing concentric circles
    for radius in range(int(max_radius), 0, -1):
        # Calculate alpha based on distance from center
        normalized = radius / max_radius
        alpha = int(255 * (1.0 - normalized) ** 2)  # Quadratic falloff

        # White color with varying alpha
        color = (255, 255, 255, alpha)

        # Draw circle
        bbox = [
            center - radius,
            center - radius,
            center + radius,
            center + radius
        ]
        draw.ellipse(bbox, fill=color)

    return img

if __name__ == "__main__":
    print("Generating sp_gold_glow.png...")
    texture = create_soft_glow(64)
    texture.save("sp_gold_glow.png")
    print("Done! Texture saved as sp_gold_glow.png")
    print("The particle JSON will colorize this to gold using tinting.")
