# Celebration System — Phase 1: Foundation & Basic Feedback

## 🎯 Objective

Create the celebration infrastructure and implement subtle SP gain feedback. Every time a player earns SP, they should see a small particle burst and hear a satisfying coin sound.

---

## 📁 Files to Create/Modify

```
scripts/
├── CelebrationManager.js      # NEW - create this file
└── main.js                    # MODIFY - add hooks

packs/QuestSystemRP/
├── sounds/ui/
│   ├── coin_clink_1.ogg       # NEW - sound file (placeholder OK)
│   ├── coin_clink_2.ogg       # NEW - sound file (placeholder OK)
│   └── coin_clink_3.ogg       # NEW - sound file (placeholder OK)
└── sound_definitions.json     # MODIFY - register sounds
```

---

## 📦 Step 1: Create CelebrationManager.js

Create `scripts/CelebrationManager.js` with the following content:

```javascript
/**
 * CelebrationManager.js
 * Centralized utility for triggering celebrations throughout SuperQuester.
 * 
 * Phase 1: Basic SP gain feedback
 * Phase 2: Will add rarity-scaled quest completion celebrations
 */

import { world, system } from "@minecraft/server";

// ============================================
// CONFIGURATION
// ============================================

const CELEBRATION_CONFIG = {
    // Generic SP gain feedback (subtle, frequent)
    spGain: {
        minAmountForEffect: 1,       // minimum SP to trigger any effect
        particleCount: 3,
        particleType: "minecraft:villager_happy",
        soundVolume: 0.6,            // quieter than quest completion
    },
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Trigger subtle feedback for any SP gain.
 * Called from modifySP() - should be lightweight.
 * 
 * @param {Player} player - The player gaining SP
 * @param {number} amount - SP amount gained (positive)
 */
export function celebrateSPGain(player, amount) {
    if (amount < CELEBRATION_CONFIG.spGain.minAmountForEffect) return;
    
    const config = CELEBRATION_CONFIG.spGain;
    const pos = player.location;
    const dim = player.dimension;
    
    // Small particle burst at player position
    for (let i = 0; i < config.particleCount; i++) {
        const offset = {
            x: pos.x + (Math.random() - 0.5) * 1.5,
            y: pos.y + 1 + Math.random() * 0.5,
            z: pos.z + (Math.random() - 0.5) * 1.5
        };
        dim.spawnParticle(config.particleType, offset);
    }
    
    // Coin sound (random variant for variety)
    const variant = Math.floor(Math.random() * 3) + 1;
    player.playSound(`celebration.coin_clink_${variant}`, { 
        volume: config.soundVolume, 
        pitch: 0.9 + Math.random() * 0.2  // slight pitch variation
    });
}

/**
 * Placeholder for Phase 2 - quest completion celebration.
 * For now, just calls the basic SP gain effect.
 * 
 * @param {Player} player - The player who completed the quest
 * @param {Object} options - Celebration context
 */
export function celebrateQuestComplete(player, options) {
    // Phase 2 will implement full rarity-scaled celebrations
    // For now, delegate to basic SP feedback
    celebrateSPGain(player, options.spAmount || 50);
}
```

---

## 🔊 Step 2: Register Sounds

**Modify `packs/QuestSystemRP/sound_definitions.json`** — add these entries to the existing JSON object:

```json
"celebration.coin_clink_1": {
    "category": "player",
    "sounds": [{
        "name": "sounds/ui/coin_clink_1",
        "volume": 1.0
    }]
},
"celebration.coin_clink_2": {
    "category": "player",
    "sounds": [{
        "name": "sounds/ui/coin_clink_2",
        "volume": 1.0
    }]
},
"celebration.coin_clink_3": {
    "category": "player",
    "sounds": [{
        "name": "sounds/ui/coin_clink_3",
        "volume": 1.0
    }]
}
```

---

## 🎵 Step 3: Sound Files

**Option A: Use placeholders (recommended for testing)**

If custom sound files aren't ready yet, modify `celebrateSPGain()` to use vanilla sounds:

```javascript
// Temporary placeholder - replace this line:
player.playSound(`celebration.coin_clink_${variant}`, { ... });

// With this:
player.playSound("random.orb", { 
    volume: config.soundVolume, 
    pitch: 1.2 + Math.random() * 0.3
});
```

**Option B: Add custom sounds**

Place `.ogg` files in `packs/QuestSystemRP/sounds/ui/`:
- `coin_clink_1.ogg` — ~0.2s crisp coin sound
- `coin_clink_2.ogg` — ~0.2s slight variation
- `coin_clink_3.ogg` — ~0.2s another variation

---

## 🔗 Step 4: Hook into main.js

### 4a. Add Import

At the top of `main.js`, add:

```javascript
import { celebrateSPGain, celebrateQuestComplete } from "./CelebrationManager.js";
```

### 4b. Hook into modifySP()

**Find the `modifySP()` function** (approximately line 633). Look for where `updateSPDisplay(player)` is called.

**After** `updateSPDisplay(player)`, add:

```javascript
// Celebration feedback for SP gains
if (delta > 0 && !options?.skipCelebration) {
    celebrateSPGain(player, delta);
}
```

**Important:** The `modifySP()` function signature may need to accept an `options` parameter if it doesn't already. Check the current signature and modify if needed:

```javascript
// If current signature is:
function modifySP(player, delta) { ... }

// Change to:
function modifySP(player, delta, options = {}) { ... }
```

### 4c. Prevent Double-Celebration on Quest Turn-In

**Find `handleQuestTurnIn()`** (approximately line 1818). Look for where `addSP()` is called.

**Modify the addSP call** to skip the basic celebration (Phase 2 will add the full quest celebration):

```javascript
// Find this line (approximately line 1913-1920):
addSP(player, rewardResult.finalAmount);

// Change to:
addSP(player, rewardResult.finalAmount, { skipCelebration: true });
```

This prevents the subtle coin effect from firing when a quest is turned in — Phase 2 will add a more elaborate celebration for that moment.

---

## 🧪 Step 5: Add Test Command

Add this to your existing scriptevent handler section in `main.js`:

```javascript
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "sq:test_spgain") {
        const amount = parseInt(event.message) || 50;
        const player = event.sourceEntity;
        if (player) {
            celebrateSPGain(player, amount);
        }
    }
});
```

**Test with:**
```
/scriptevent sq:test_spgain 50
/scriptevent sq:test_spgain 100
```

---

## ✅ Validation Checklist

Phase 1 is complete when:

- [ ] `CelebrationManager.js` exists and imports successfully
- [ ] No errors on world load
- [ ] `/scriptevent sq:test_spgain 50` triggers:
  - [ ] 3 particles appear near player
  - [ ] Coin sound plays
- [ ] Completing any action that grants SP (admin command, etc.) triggers the effect
- [ ] Quest turn-in does NOT trigger double celebration (skipCelebration works)
- [ ] Sound has slight pitch variation (not identical every time)
- [ ] Particle positions are randomized (not identical every time)

---

## ⚠️ Potential Issues

1. **Import path** — If the import fails, check that the path matches your project structure. Might need `./CelebrationManager.js` or just `CelebrationManager.js` depending on setup.

2. **options parameter** — If `modifySP()` is called from multiple places, ensure all call sites still work after adding the options parameter. Default value `= {}` should handle this.

3. **Sound not playing** — If using custom sounds and they don't play, verify:
   - File is `.ogg` format (Vorbis codec)
   - Path in `sound_definitions.json` matches actual file location
   - No typos in sound ID

4. **Particles not visible** — Player might be looking away. Test while looking down at feet.

---

## 🚀 Next Steps

Once Phase 1 is validated, proceed to Phase 2 which adds:
- Rarity-scaled celebrations (common → mythic)
- Particle patterns (burst, ring, spiral)
- Layered sound design
- Title cards
- Jackpot and streak overlays
- Firework effects for mythic quests
