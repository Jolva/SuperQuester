# Custom SP Gold Burst Particle

## What You Need to Do

### Option 1: Generate Texture with Python (Recommended)
```bash
cd packs/QuestSystemRP/textures/particle/
pip install pillow
python generate_gold_glow.py
```

This will create `sp_gold_glow.png` automatically.

---

### Option 2: Create Texture Manually

Create a **64x64 PNG** image with:
- **Soft white circular gradient** in center
- **Fades to transparent** at edges
- **No hard edges** (use Gaussian blur)
- Save as: `packs/QuestSystemRP/textures/particle/sp_gold_glow.png`

Tools you can use:
- Photoshop/GIMP: Radial gradient tool
- Paint.NET: Gradient tool + Gaussian blur
- Online: https://www.pixilart.com/ or https://www.photopea.com/

---

## Particle Features

The custom particle (`superquester:sp_gold_burst`) includes:

✅ **Spiral Motion** - Particles orbit briefly before exploding outward
✅ **Size Animation** - Grows from small → large → fades
✅ **Alpha Animation** - Fades in quickly, then gradually fades out
✅ **Gold Tinting** - Pure gold (RGB: 255, 217, 51) with amber undertones
✅ **Dynamic Physics** - Gravity + drag for realistic motion
✅ **Performance Optimized** - Designed for high-end hardware

---

## How It Works

1. **Particle JSON** (`sp_gold_burst.json`) defines:
   - Motion curves (spiral + outward burst)
   - Size/alpha animations
   - Gold color tinting
   - Physics (gravity, drag)

2. **Texture** (`sp_gold_glow.png`) provides:
   - Soft circular base shape
   - Gets colorized to gold by particle system

3. **CelebrationManager** spawns:
   - 120 particles in spherical distribution
   - Spread over 16 ticks (0.8 seconds)
   - Each particle lives 0.6-1.2 seconds

---

## Testing

After adding the texture, reload the resource pack and test with:
```
/scriptevent sq:test_spgain 100
```

You should see an **epic explosion of golden spiraling particles**!

If the texture isn't loaded, it will automatically fall back to vanilla particles (totem/critical/lava mix).

---

## Fallback Mode

If you don't create the texture, the system uses vanilla particles:
- `minecraft:totem_particle` (rainbow/gold)
- `minecraft:critical_hit_emitter` (white sparkles)
- `minecraft:lava_particle` (orange glow)

Set `useCustomParticle: false` in CelebrationManager.js to permanently use fallback particles.
