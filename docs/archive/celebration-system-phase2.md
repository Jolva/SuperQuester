# Celebration System — Phase 2: Rarity-Scaled Quest Celebrations

**Status:** ✅ **COMPLETE** - Implemented January 22, 2026

## 🎯 Objective

Upgrade quest turn-in celebrations to scale with rarity. Common quests get a satisfying acknowledgment; Mythic quests get an epic show with spiraling particles, fireworks, and layered audio.

**Prerequisite:** Phase 1 must be complete (CelebrationManager.js exists and basic SP feedback works).

---

## ⚠️ CRITICAL IMPLEMENTATION NOTE

**Action Bar vs Title Cards:** This system uses `setActionBar()` instead of `setTitle()` for reward notifications because the SP display system uses `titleraw` to send "SPVAL:XX" to the JSON UI HUD. Using `setTitle()` would override the SP coin display in the upper right corner.

---

## 📁 Files to Modify

```
scripts/
├── CelebrationManager.js      # MODIFY - add full celebration system
└── main.js                    # MODIFY - add quest completion hook

packs/QuestSystemRP/
├── sounds/ui/
│   ├── fanfare_rare.ogg       # NEW - sound file
│   ├── fanfare_legendary.ogg  # NEW - sound file
│   ├── fanfare_mythic.ogg     # NEW - sound file
│   ├── jackpot.ogg            # NEW - sound file
│   └── streak.ogg             # NEW - sound file
└── sound_definitions.json     # MODIFY - register new sounds
```

---

## 📦 Step 1: Expand CelebrationManager.js

**⚠️ CRITICAL:** This step adds Phase 2 code AFTER the Phase 1 code. **DO NOT REPLACE** the existing `celebrateSPGain()` function or `spGain` config. Preserve them exactly as-is.

**Your current Phase 1 setup is LOCKED:**
```javascript
// THIS STAYS EXACTLY AS-IS:
const CELEBRATION_CONFIG = {
    spGain: {
        minAmountForEffect: 1,
        particleCount: 100,          // 9 waves × 100 = 900 lava particles
        particleSpread: 2.5,
        particleHeight: 1.5,
        particleType: "minecraft:lava_particle",  // Golden embers - DO NOT CHANGE
        soundVolume: 0.6,
    },
    // ← ADD questComplete configs HERE (below spGain)
};

// THIS STAYS EXACTLY AS-IS:
export function celebrateSPGain(player, amount) {
    // ... (9 burst loop, 2 tick spacing) DO NOT TOUCH
}
```

**What to add:** Insert the new `questComplete` object in CELEBRATION_CONFIG and implement the new functions below. Here's the code to ADD (not replace):

```javascript
/**
 * CelebrationManager.js
 * Centralized utility for triggering celebrations throughout SuperQuester.
 * 
 * Phase 1: Basic SP gain feedback ✓ (LOCKED - DO NOT MODIFY)
 * Phase 2: Rarity-scaled quest completion celebrations
 */

import { world, system } from "@minecraft/server";

// ============================================
// CONFIGURATION
// ============================================

const CELEBRATION_CONFIG = {
    // *** PHASE 1: DO NOT MODIFY - Rapid lava burst with 9 waves ***
    spGain: {
        minAmountForEffect: 1,
        particleCount: 100,          // 9 waves × 100 = 900 total particles
        particleSpread: 2.5,         // horizontal spread
        particleHeight: 1.5,         // vertical spread
        particleType: "minecraft:lava_particle",  // Golden embers
        soundVolume: 0.6,
    },
    
    // *** PHASE 2: NEW - Quest completion by rarity ***
        common: {
            particleCount: 4,
            particleType: "minecraft:villager_happy",
            pattern: "burst",        // burst | ring | spiral
            durationTicks: 1,        // instant
            soundLayers: 1,
            titleCard: false,
        },
        rare: {
            particleCount: 10,
            particleType: "minecraft:villager_happy",
            pattern: "ring",
            durationTicks: 10,       // 0.5 seconds
            soundLayers: 2,
            titleCard: true,
            titleColor: "§9",        // blue
        },
        legendary: {
            particleCount: 20,
            particleType: "minecraft:totem_particle",
            secondaryParticle: "minecraft:end_rod",
            pattern: "spiral",
            durationTicks: 30,       // 1.5 seconds
            soundLayers: 3,
            titleCard: true,
            titleColor: "§6",        // gold
        },
        mythic: {
            particleCount: 30,
            particleType: "minecraft:totem_particle",
            secondaryParticle: "minecraft:end_rod",
            pattern: "spiral",
            durationTicks: 50,       // 2.5 seconds
            soundLayers: 4,
            titleCard: true,
            titleColor: "§d§l",      // bold light purple
            spawnFirework: true,
        }
    },

// Jackpot overlay settings
jackpot: {
        extraParticles: 15,
        extraDurationTicks: 20,
    },
    
    // Streak bonus overlay
    streak: {
        extraParticles: 5,
    }
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Trigger celebration for quest turn-in.
 * This is the main celebration entry point for PHASE 2.
 * 
 * @param {Player} player - The player who completed the quest
 * @param {Object} options - Celebration context
 * @param {string} options.rarity - "common" | "rare" | "legendary" | "mythic"
 * @param {number} options.spAmount - SP awarded
 * @param {boolean} options.isJackpot - Whether jackpot triggered
 * @param {string|null} options.streakLabel - Streak info if applicable
 */
export function celebrateQuestComplete(player, options) {
    const { rarity, spAmount, isJackpot, streakLabel } = options;
    const config = CELEBRATION_CONFIG.questComplete[rarity] || CELEBRATION_CONFIG.questComplete.common;
    
    // Base celebration
    spawnParticlePattern(player, config);
    playCompletionSounds(player, config, rarity);
    
    if (config.titleCard) {
        showRewardTitle(player, spAmount, config.titleColor);
    }
    
    if (config.spawnFirework) {
        spawnDelayedFirework(player, config.durationTicks);
    }
    
    // Overlay effects for special conditions
    if (isJackpot) {
        overlayJackpotCelebration(player);
    }
    
    if (streakLabel) {
        overlayStreakCelebration(player, streakLabel);
    }
}

// ============================================================================
// PHASE 1 LOCKED SECTION - DO NOT MODIFY
// ============================================================================
// The celebrateSPGain() function below remains unchanged from Phase 1.
// It uses rapid lava particle bursts (9 waves × 100 particles) and is called
// whenever SP is gained. DO NOT ALTER THIS FUNCTION OR ITS CONFIG.
// ============================================================================

/**
 * Trigger subtle feedback for any SP gain.
 * Called from modifySP() - should be lightweight.
 * 
 * PHASE 1 LOCKED - DO NOT MODIFY
 * 
 * @param {Player} player - The player gaining SP
 * @param {number} amount - SP amount gained (positive)
 */
export function celebrateSPGain(player, amount) {
    if (amount < CELEBRATION_CONFIG.spGain.minAmountForEffect) return;
    
    const config = CELEBRATION_CONFIG.spGain;
    const pos = player.location;
    const dim = player.dimension;
    
    // Spawn particles in rapid bursts to create continuous rising effect
    // New particles spawn before old ones turn to ash, hiding the ash phase
    for (let burst = 0; burst < 9; burst++) {
        system.runTimeout(() => {
            for (let i = 0; i < config.particleCount; i++) {
                const offset = {
                    x: pos.x + (Math.random() - 0.5) * config.particleSpread,
                    y: pos.y + 1 + Math.random() * config.particleHeight,
                    z: pos.z + (Math.random() - 0.5) * config.particleSpread
                };
                dim.spawnParticle(config.particleType, offset);
            }
        }, burst * 2);  // Burst every 2 ticks for 18 ticks total
    }
    
    // Coin sound (random variant for variety)
    const variant = Math.floor(Math.random() * 3) + 1;
    player.playSound(`celebration.coin_clink_${variant}`, { 
        volume: config.soundVolume, 
        pitch: 0.9 + Math.random() * 0.2
    });
}

// ============================================================================
// PHASE 2 IMPLEMENTATION - Helper Functions Below
// ============================================================================

// ============================================
// PARTICLE PATTERNS (PRIVATE)
// ============================================

/**
 * Spawn particles in configured pattern over time.
 */
function spawnParticlePattern(player, config) {
    const pos = player.location;
    const dim = player.dimension;
    
    switch (config.pattern) {
        case "burst":
            spawnBurstPattern(dim, pos, config);
            break;
        case "ring":
            spawnRingPattern(dim, pos, config);
            break;
        case "spiral":
            spawnSpiralPattern(dim, pos, config);
            break;
    }
}

/**
 * Instant burst - particles spawn at random offsets immediately.
 * Used for: Common quests
 */
function spawnBurstPattern(dim, pos, config) {
    for (let i = 0; i < config.particleCount; i++) {
        const offset = {
            x: pos.x + (Math.random() - 0.5) * 2,
            y: pos.y + 1 + Math.random() * 1.5,
            z: pos.z + (Math.random() - 0.5) * 2
        };
        dim.spawnParticle(config.particleType, offset);
    }
}

/**
 * Ring pattern - particles spawn in expanding circles over time.
 * Used for: Rare quests
 */
function spawnRingPattern(dim, pos, config) {
    const ticksPerWave = Math.max(1, Math.floor(config.durationTicks / 3));
    const particlesPerWave = Math.floor(config.particleCount / 3);
    
    for (let wave = 0; wave < 3; wave++) {
        system.runTimeout(() => {
            const radius = 1 + wave * 0.5;  // expanding radius
            for (let i = 0; i < particlesPerWave; i++) {
                const angle = (i / particlesPerWave) * Math.PI * 2;
                const offset = {
                    x: pos.x + Math.cos(angle) * radius,
                    y: pos.y + 1 + wave * 0.3,
                    z: pos.z + Math.sin(angle) * radius
                };
                dim.spawnParticle(config.particleType, offset);
            }
        }, wave * ticksPerWave);
    }
}

/**
 * Spiral pattern - particles rise in a helix pattern over time.
 * Used for: Legendary and Mythic quests
 */
function spawnSpiralPattern(dim, pos, config) {
    const totalSteps = Math.min(config.durationTicks, 25);  // cap iterations for performance
    const particlesPerStep = Math.ceil(config.particleCount / totalSteps);
    
    let step = 0;
    const intervalId = system.runInterval(() => {
        if (step >= totalSteps) {
            system.clearRun(intervalId);
            return;
        }
        
        const progress = step / totalSteps;
        const radius = 1.5 - progress * 0.5;  // shrinking spiral
        const height = progress * 3;           // rising
        const baseAngle = progress * Math.PI * 4;  // 2 full rotations
        
        for (let i = 0; i < particlesPerStep; i++) {
            const angle = baseAngle + (i / particlesPerStep) * Math.PI * 0.5;
            const offset = {
                x: pos.x + Math.cos(angle) * radius,
                y: pos.y + 1 + height,
                z: pos.z + Math.sin(angle) * radius
            };
            dim.spawnParticle(config.particleType, offset);
            
            // Secondary particle on alternating steps for legendary+
            if (config.secondaryParticle && i % 2 === 0) {
                dim.spawnParticle(config.secondaryParticle, offset);
            }
        }
        
        step++;
    }, 2);  // every 2 ticks = 10 times per second
}

// ============================================
// SOUND SYSTEM (PRIVATE)
// ============================================

/**
 * Play layered sounds based on rarity.
 */
function playCompletionSounds(player, config, rarity) {
    // Layer 1: Base coin sound (all rarities)
    const variant = Math.floor(Math.random() * 3) + 1;
    player.playSound(`celebration.coin_clink_${variant}`, { volume: 0.8 });
    
    // Layer 2+: Fanfare for rare and above
    if (config.soundLayers >= 2 && rarity !== "common") {
        system.runTimeout(() => {
            player.playSound(`celebration.fanfare_${rarity}`, { volume: 1.0 });
        }, 3);  // slight delay for layering
    }
    
    // Layer 3+: Add existing quest.complete_single for legendary+
    if (config.soundLayers >= 3) {
        system.runTimeout(() => {
            player.playSound("quest.complete_single", { volume: 0.7, pitch: 1.1 });
        }, 8);
    }
    
    // Layer 4: Extra accent for mythic
    if (config.soundLayers >= 4) {
        system.runTimeout(() => {
            player.playSound("random.levelup", { volume: 0.5, pitch: 1.2 });
        }, 15);
    }
}

// ============================================
// TITLE CARDS (PRIVATE)
// ============================================

/**
 * Show floating SP reward via action bar (doesn't interfere with SP HUD display).
 * 
 * CRITICAL: We use action bar instead of setTitle() because the SP display system
 * uses titleraw to send "SPVAL:XX" to the JSON UI. Using setTitle() would override
 * the SP display in the upper right corner.
 */
function showRewardTitle(player, spAmount, colorCode) {
    // Format reward with color and subtitle-style text
    const rewardText = `${colorCode}+${spAmount} SP §7Quest Complete!§r`;
    
    // Show in action bar (stays for 1.5 seconds = 30 ticks)
    player.onScreenDisplay.setActionBar(rewardText);
    
    // Clear after duration to avoid blocking other action bar messages
    system.runTimeout(() => {
        player.onScreenDisplay.setActionBar("");
    }, 30);
}

// ============================================
// SPECIAL EFFECTS (PRIVATE)
// ============================================

/**
 * Spawn a firework after delay (mythic only).
 */
function spawnDelayedFirework(player, delay) {
    system.runTimeout(() => {
        const pos = player.location;
        const dim = player.dimension;
        
        try {
            // Spawn firework rocket entity
            const firework = dim.spawnEntity("minecraft:fireworks_rocket", {
                x: pos.x,
                y: pos.y + 1,
                z: pos.z
            });
            // Firework will auto-explode after a moment
        } catch (e) {
            // Fallback: extra totem particles if firework fails
            for (let i = 0; i < 10; i++) {
                dim.spawnParticle("minecraft:totem_particle", {
                    x: pos.x + (Math.random() - 0.5) * 2,
                    y: pos.y + 2 + Math.random() * 2,
                    z: pos.z + (Math.random() - 0.5) * 2
                });
            }
        }
    }, delay);
}

/**
 * Overlay effect for jackpot wins.
 */
function overlayJackpotCelebration(player) {
    const config = CELEBRATION_CONFIG.jackpot;
    const pos = player.location;
    const dim = player.dimension;
    
    // Extra particle burst after base celebration starts
    system.runTimeout(() => {
        for (let i = 0; i < config.extraParticles; i++) {
            dim.spawnParticle("minecraft:totem_particle", {
        
        // Jackpot message in action bar (doesn't interfere with SP display)
        player.onScreenDisplay.setActionBar("§6§l✦ JACKPOT! ✦§r");
        
        // Clear after 2 seconds
        system.runTimeout(() => {
            player.onScreenDisplay.setActionBar("");
        }, 40);
    }, 20);
}

/**
 * Overlay effect for streak bonuses.
 */
function overlayStreakCelebration(player, streakLabel) {
    const config = CELEBRATION_CONFIG.streak;
    
    system.runTimeout(() => {
        player.playSound("celebration.streak", { volume: 0.8 });
        
        // Show streak in action bar (doesn't interfere with SP display)
        player.onScreenDisplay.setActionBar(`§a${streakLabel}§r`);
        
        // Clear after 1.5 seconds
        system.runTimeout(() => {
            player.onScreenDisplay.setActionBar("");
        }, 30layer.playSound("celebration.streak", { volume: 0.8 });
        
        // Brief subtitle update showing streak
        player.onScreenDisplay.setTitle("", {
            subtitle: `§a${streakLabel}`,
            fadeInDuration: 0,
            stayDuration: 30,
            fadeOutDuration: 5
        });
    }, 35);
}
```

---

## 🔊 Step 2: Register Additional Sounds

**Add these entries to `sound_definitions.json`** (in addition to the coin sounds from Phase 1):

```json
"celebration.fanfare_rare": {
    "category": "player",
    "sounds": [{
        "name": "sounds/ui/fanfare_rare",
        "volume": 1.0
    }]
},
"celebration.fanfare_legendary": {
    "category": "player",
    "sounds": [{
        "name": "sounds/ui/fanfare_legendary",
        "volume": 1.0
    }]
},
"celebration.fanfare_mythic": {
    "category": "player",
    "sounds": [{
        "name": "sounds/ui/fanfare_mythic",
        "volume": 1.0
    }]
},
"celebration.jackpot": {
    "category": "player",
    "sounds": [{
        "name": "sounds/ui/jackpot",
        "volume": 1.0
    }]
},
"celebration.streak": {
    "category": "player",
    "sounds": [{
        "name": "sounds/ui/streak",
        "volume": 1.0
    }]
}
```

---

## 🎵 Step 3: Sound Files

**Place `.ogg` files in `packs/QuestSystemRP/sounds/ui/`:**

| Filename | Description | Duration | Style |
|----------|-------------|----------|-------|
| `fanfare_rare.ogg` | Rare quest completion | ~0.8s | Pleasant chime, brief |
| `fanfare_legendary.ogg` | Legendary completion | ~1.5s | Triumphant brass swell |
| `fanfare_mythic.ogg` | Mythic completion | ~2.0s | Epic orchestral hit with reverb |
| `jackpot.ogg` | Jackpot trigger | ~1.0s | Slot machine "winner" style |
| `streak.ogg` | Streak bonus | ~0.5s | Ascending chime sequence |

**Placeholder approach (for testing before custom audio is ready):**

Add this helper function at the top of `CelebrationManager.js` and use vanilla sounds:

```javascript
// TEMPORARY: Map custom sounds to vanilla placeholders
const SOUND_PLACEHOLDERS = {
    "celebration.fanfare_rare": { id: "random.levelup", pitch: 1.0 },
    "celebration.fanfare_legendary": { id: "ui.toast.challenge_complete", pitch: 1.0 },
    "celebration.fanfare_mythic": { id: "ui.toast.challenge_complete", pitch: 0.8 },
    "celebration.jackpot": { id: "random.totem", pitch: 1.2 },
    "celebration.streak": { id: "note.chime", pitch: 1.5 },
};

function playSoundWithFallback(player, soundId, options = {}) {
    try {
        player.playSound(soundId, options);
    } catch (e) {
        // Fallback to placeholder
        const fallback = SOUND_PLACEHOLDERS[soundId];
        if (fallback) {
            player.playSound(fallback.id, { ...options, pitch: fallback.pitch });
        }
    }
}
```

Then replace `player.playSound("celebration.fanfare_*")` calls with `playSoundWithFallback()`.

---

## 🔗 Step 4: Hook Quest Turn-In in main.js

**Find `handleQuestTurnIn()`** (approximately line 1818).

**Locate this section** (approximately lines 1913-1941) where rewards are granted:

```javascript
const rewardResult = calculateCompletionReward(questBaseSP, quest.rarity, player, isFirstOfDay);
if (rewardResult.finalAmount > 0) {
    addSP(player, rewardResult.finalAmount, { skipCelebration: true });
}
```

**Add the celebration trigger right after:**

```javascript
const rewardResult = calculateCompletionReward(questBaseSP, quest.rarity, player, isFirstOfDay);
if (rewardResult.finalAmount > 0) {
    addSP(player, rewardResult.finalAmount, { skipCelebration: true });
    
    // Trigger rarity-scaled celebration
    // Small delay ensures SP display updates first
    system.runTimeout(() => {
        celebrateQuestComplete(player, {
            rarity: quest.rarity,
            spAmount: rewardResult.finalAmount,
            isJackpot: rewardResult.isJackpot || false,
            streakLabel: rewardResult.streakLabel || null
        });
    }, 3);
}
```

**Ensure import exists** at top of `main.js`:

```javascript
import { celebrateSPGain, celebrateQuestComplete } from "./CelebrationManager.js";
```

---

## 🧪 Step 5: Add Test Commands

Add these to your scriptevent handler in `main.js`:

```javascript
// Test celebration by rarity
if (event.id === "sq:test_celebration") {
    const args = event.message.split(" ");
    const rarity = args[0] || "common";
    const modifier = args[1] || null;
    const player = event.sourceEntity;
    
    if (player) {
        const spAmounts = { common: 25, rare: 75, legendary: 200, mythic: 500 };
        
        celebrateQuestComplete(player, {
            rarity: rarity,
            spAmount: spAmounts[rarity] || 25,
            isJackpot: modifier === "jackpot",
            streakLabel: modifier === "streak" ? "3-Quest Streak!" : null
        });
    }
}
```

**Test commands:**

```
/scriptevent sq:test_celebration common
/scriptevent sq:test_celebration rare
/scriptevent sq:test_celebration legendary
/scriptevent sq:test_celebration mythic
/scriptevent sq:test_celebration legendary jackpot
/scriptevent sq:test_celebration rare streak
/scriptevent sq:test_celebration mythic jackpot
```

---

## ✅ Validation Checklist

### Common Quest Celebration
- [ ] Instant particle burst (4 particles)
- [ ] Single coin sound
- [ ] No title card appears
- [ ] Feels "satisfying but brief"

### Rare Quest Celebration
- [ ] Ring pattern particles (expanding circles)
- [ ] Particles appear over ~0.5 seconds
- [ ] Two-layer sound (coin + fanfare)
- [ ] Blue title card: "+75 SP"
- [ ] Feels "noticeably better than common"

### Legendary Quest Celebration
- [ ] Spiral pattern particles rising
- [ ] Totem particles + end_rod particles together
- [ ] Particles last ~1.5 seconds
- [ ] Three-layer sound
- [ ] Gold title card: "+200 SP"
- [ ] Feels "this was a big deal"

### Mythic Quest Celebration
- [ ] Extended spiral (2.5 seconds)
- [ ] Firework spawns at end
- [ ] Four-layer sound
- [ ] Bold purple title card: "+500 SP"
- [ ] Feels "legendary moment"

### Jackpot Overlay
- [ ] Extra totem particle burst
- [ ] Jackpot sound plays
- [ ] "✦ JACKPOT! ✦" title appears after main title
- [ ] Works when combined with any rarity

### Streak Overlay
- [ ] Streak sound plays
- [ ] Streak label appears as subtitle
- [ ] Works when combined with any rarity

---

## ⚠️ Potential Issues & Solutions

### 1. Firework Not Spawning
The `minecraft:fireworks_rocket` entity might fail in some contexts.

**Solution:** The code has a fallback that spawns extra totem particles instead. If fireworks consistently fail, you could also try:
```javascript
dim.runCommand(`summon fireworks_rocket ${pos.x} ${pos.y + 1} ${pos.z}`);
```

### 2. Title Cards Overlapping
Jackpot/streak titles might conflict with the main reward title.

**Solution:** Adjust the `runTimeout` delays in `overlayJackpotCelebration()` and `overlayStreakCelebration()`. Increase the delay values (45, 35) if overlap occurs.

### 3. Performance on Mythic
30 particles over 50 ticks is reasonable, but if lag occurs:

**Solution:** Reduce `particleCount` to 20 or reduce `totalSteps` cap in `spawnSpiralPattern()` from 25 to 15.

### 4. rewardResult Missing Properties
If `calculateCompletionReward()` doesn't return `isJackpot` or `streakLabel`:

**Solution:** Check the `RewardCalculator.js` to see what properties are returned. You may need to:
- Add `|| false` and `|| null` defaults (already in the spec)
- Or modify the reward calculator to include these properties

### 5. Sound Timing Feels Off
The layered sound delays (3, 8, 15 ticks) were estimated.

**Solution:** Adjust these values in `playCompletionSounds()` after hearing them in-game. Trust your ears.

---

## 🎨 Tuning Guide

Once everything works, you'll want to tune the feel. Here's what to adjust:

| If it feels... | Adjust... |
|----------------|-----------|
| Too subtle | Increase `particleCount`, add more sound layers |
| Too chaotic | Reduce `particleCount`, increase timing delays |
| Too slow | Reduce `durationTicks`, increase spiral speed |
| Too fast | Increase `durationTicks`, slow down intervals |
| Sounds cluttered | Increase delays between sound layers |
| Particles too spread | Reduce radius multipliers in pattern functions |
| Title too brief | Increase `stayDuration` in title card |

---

## 🚀 What's Next

After Phase 2 is validated, future enhancements could include:

- **Phase 3:** Milestone celebrations (first quest, 100 quests, 10000 SP)
- **Phase 4:** SP count-up animation (rapid incremental display updates)
- **Phase 5:** Custom particle entities (armor stands with coin models)
- **Gacha integration:** Reuse celebration system for capsule rewards
