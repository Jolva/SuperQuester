# Celebration System — Phase 3: SP Count-Up Animation

## 🎯 Objective

When players earn SP, the HUD number visually ticks up instead of jumping instantly. A gain of +50 SP shows: 2500 → 2505 → 2510 → ... → 2550, accompanied by satisfying audio ticks. This creates the "slot machine / score counter" dopamine hit that makes earning rewards feel tangible.

**Prerequisites:** 
- Phase 1 complete (CelebrationManager.js exists)
- Understanding of current SP display system

---

## 🎮 User Experience Goal

| SP Gained | Animation Duration | Tick Count | Feel |
|-----------|-------------------|------------|------|
| 1-10 | ~0.3s | 3-5 ticks | Quick acknowledgment |
| 11-50 | ~0.6s | 8-12 ticks | Satisfying build |
| 51-200 | ~1.0s | 15-20 ticks | Exciting climb |
| 201-500 | ~1.5s | 20-25 ticks | Major reward |
| 500+ | ~2.0s | 25-30 ticks | Jackpot energy (capped) |

**Key feel targets:**
- Fast start, slower finish (ease-out curve) — most satisfying
- Audio tick on each visual update
- Final number "lands" with a slightly different sound
- Never feels sluggish — cap duration regardless of amount

---

## 📁 Files to Create/Modify

```
scripts/
├── SPAnimator.js              # NEW - handles count-up animation
├── CelebrationManager.js      # MODIFY - integrate with celebrations
└── main.js                    # MODIFY - replace direct display updates

packs/QuestSystemRP/
├── sounds/ui/
│   ├── sp_tick_1.ogg          # NEW - counting tick variant 1
│   ├── sp_tick_2.ogg          # NEW - counting tick variant 2
│   ├── sp_tick_3.ogg          # NEW - counting tick variant 3
│   └── sp_land.ogg            # NEW - final "landing" sound
└── sound_definitions.json     # MODIFY - register tick sounds
```

---

## 🔧 Technical Approach

### Current System (from architecture report)
```javascript
// Current flow in main.js:
function updateSPDisplay(player) {
    // Uses invisible titleraw command
    // JSON UI captures "SPVAL:XXX" pattern
    // Updates top-right HUD instantly
}
```

### New System
```javascript
// New flow:
function updateSPDisplay(player, newValue, options = {}) {
    if (options.animate && options.oldValue !== undefined) {
        // Animate from oldValue to newValue
        SPAnimator.animateCountUp(player, options.oldValue, newValue);
    } else {
        // Instant update (for initial load, etc.)
        sendSPDisplay(player, newValue);
    }
}
```

---

## 📦 Step 1: Create SPAnimator.js

```javascript
/**
 * SPAnimator.js
 * Handles animated SP count-up display with audio feedback.
 * 
 * Uses ease-out curve for satisfying "slot machine" feel.
 * Manages concurrent animations (new SP gain interrupts previous).
 */

import { system } from "@minecraft/server";

// ============================================
// CONFIGURATION
// ============================================

const ANIMATION_CONFIG = {
    // Duration scaling based on SP amount
    timing: {
        minDurationTicks: 6,      // 0.3 seconds minimum
        maxDurationTicks: 40,     // 2.0 seconds maximum
        ticksPerHundredSP: 8,     // Base scaling
    },
    
    // Tick count scaling
    ticks: {
        minTicks: 3,
        maxTicks: 30,
        ticksPerTenSP: 1,         // Roughly 1 tick per 10 SP gained
    },
    
    // Audio settings
    audio: {
        tickVolume: 0.4,          // Subtle, not annoying
        landVolume: 0.7,          // Final tick is louder
        tickPitchBase: 1.0,
        tickPitchVariance: 0.15,  // Slight randomization
        pitchRiseOnProgress: 0.3, // Pitch rises as count approaches target
    },
};

// Track active animations per player to handle interrupts
const activeAnimations = new Map();

// ============================================
// PUBLIC API
// ============================================

/**
 * Animate SP display from oldValue to newValue.
 * 
 * @param {Player} player - The player to update
 * @param {number} oldValue - Starting SP value
 * @param {number} newValue - Target SP value
 * @param {Function} displayCallback - Function to call to update display: (player, value) => void
 */
export function animateCountUp(player, oldValue, newValue, displayCallback) {
    const playerId = player.id;
    const delta = newValue - oldValue;
    
    // Cancel any existing animation for this player
    if (activeAnimations.has(playerId)) {
        const existing = activeAnimations.get(playerId);
        system.clearRun(existing.intervalId);
        // Jump to the previous target before starting new animation
        displayCallback(player, existing.targetValue);
    }
    
    // For negative changes or zero, just instant update
    if (delta <= 0) {
        displayCallback(player, newValue);
        return;
    }
    
    // Calculate animation parameters
    const totalTicks = calculateTickCount(delta);
    const durationTicks = calculateDuration(delta);
    const tickInterval = Math.max(1, Math.floor(durationTicks / totalTicks));
    
    // Generate the value sequence with ease-out curve
    const valueSequence = generateEaseOutSequence(oldValue, newValue, totalTicks);
    
    // Start animation
    let currentTick = 0;
    
    const intervalId = system.runInterval(() => {
        if (currentTick >= valueSequence.length) {
            // Animation complete
            system.clearRun(intervalId);
            activeAnimations.delete(playerId);
            
            // Final display update and "land" sound
            displayCallback(player, newValue);
            playLandSound(player);
            return;
        }
        
        const displayValue = valueSequence[currentTick];
        const progress = currentTick / (valueSequence.length - 1);
        
        // Update display
        displayCallback(player, displayValue);
        
        // Play tick sound (skip first tick, it's the starting value)
        if (currentTick > 0) {
            playTickSound(player, progress);
        }
        
        currentTick++;
    }, tickInterval);
    
    // Store animation state for potential interruption
    activeAnimations.set(playerId, {
        intervalId,
        targetValue: newValue,
        startValue: oldValue,
    });
}

/**
 * Instantly set SP display (no animation).
 * Also cancels any running animation.
 * 
 * @param {Player} player - The player to update
 * @param {number} value - SP value to display
 * @param {Function} displayCallback - Function to call to update display
 */
export function setInstant(player, value, displayCallback) {
    const playerId = player.id;
    
    // Cancel any existing animation
    if (activeAnimations.has(playerId)) {
        system.clearRun(activeAnimations.get(playerId).intervalId);
        activeAnimations.delete(playerId);
    }
    
    displayCallback(player, value);
}

/**
 * Check if player has an active count-up animation.
 * 
 * @param {Player} player 
 * @returns {boolean}
 */
export function isAnimating(player) {
    return activeAnimations.has(player.id);
}

// ============================================
// ANIMATION MATH (PRIVATE)
// ============================================

/**
 * Calculate how many visual ticks (updates) to show.
 */
function calculateTickCount(delta) {
    const config = ANIMATION_CONFIG.ticks;
    const calculated = Math.ceil(delta / 10) * config.ticksPerTenSP;
    return Math.min(config.maxTicks, Math.max(config.minTicks, calculated));
}

/**
 * Calculate total animation duration in ticks.
 */
function calculateDuration(delta) {
    const config = ANIMATION_CONFIG.timing;
    const calculated = Math.ceil(delta / 100) * config.ticksPerHundredSP;
    return Math.min(config.maxDurationTicks, Math.max(config.minDurationTicks, calculated));
}

/**
 * Generate sequence of values with ease-out curve.
 * Ease-out: starts fast, slows down at end (most satisfying for scores).
 * 
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} steps - Number of steps
 * @returns {number[]} Array of integer values
 */
function generateEaseOutSequence(start, end, steps) {
    const sequence = [];
    const delta = end - start;
    
    for (let i = 0; i < steps; i++) {
        // Ease-out cubic: 1 - (1 - t)^3
        const t = i / (steps - 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = Math.round(start + delta * eased);
        sequence.push(value);
    }
    
    // Ensure final value is exact
    sequence[sequence.length - 1] = end;
    
    return sequence;
}

// ============================================
// AUDIO (PRIVATE)
// ============================================

/**
 * Play a counting tick sound.
 * Pitch rises slightly as we approach the target.
 */
function playTickSound(player, progress) {
    const config = ANIMATION_CONFIG.audio;
    
    // Random variant (1-3)
    const variant = Math.floor(Math.random() * 3) + 1;
    
    // Calculate pitch: base + variance + progress rise
    const randomVariance = (Math.random() - 0.5) * config.tickPitchVariance;
    const progressBoost = progress * config.pitchRiseOnProgress;
    const pitch = config.tickPitchBase + randomVariance + progressBoost;
    
    try {
        player.playSound(`celebration.sp_tick_${variant}`, {
            volume: config.tickVolume,
            pitch: pitch,
        });
    } catch (e) {
        // Fallback to vanilla sound
        player.playSound("random.click", {
            volume: config.tickVolume * 0.5,
            pitch: pitch,
        });
    }
}

/**
 * Play the final "landing" sound when count-up completes.
 */
function playLandSound(player) {
    const config = ANIMATION_CONFIG.audio;
    
    try {
        player.playSound("celebration.sp_land", {
            volume: config.landVolume,
            pitch: 1.0,
        });
    } catch (e) {
        // Fallback to vanilla sound
        player.playSound("random.orb", {
            volume: config.landVolume,
            pitch: 1.2,
        });
    }
}

// ============================================
// CLEANUP
// ============================================

/**
 * Clear all animations (call on world unload or player leave).
 */
export function clearAllAnimations() {
    for (const [playerId, state] of activeAnimations) {
        system.clearRun(state.intervalId);
    }
    activeAnimations.clear();
}

/**
 * Clear animation for specific player (call on player leave).
 */
export function clearPlayerAnimation(player) {
    const playerId = player.id;
    if (activeAnimations.has(playerId)) {
        system.clearRun(activeAnimations.get(playerId).intervalId);
        activeAnimations.delete(playerId);
    }
}
```

---

## 🔗 Step 2: Integrate with main.js

### 2a. Add Import

At the top of `main.js`:

```javascript
import * as SPAnimator from "./SPAnimator.js";
```

### 2b. Modify modifySP()

**Find the `modifySP()` function.** We need to:
1. Capture the old value before modification
2. Pass both old and new values to the display update

**Current structure (approximately):**
```javascript
function modifySP(player, delta, options = {}) {
    // ... get current value ...
    // ... calculate new value ...
    // ... update scoreboard/dynamic properties ...
    updateSPDisplay(player);
    
    if (delta > 0 && !options?.skipCelebration) {
        celebrateSPGain(player, delta);
    }
}
```

**Modify to:**
```javascript
function modifySP(player, delta, options = {}) {
    // Capture old value BEFORE modification
    const oldValue = getSPBalance(player); // or however you get current SP
    
    // ... existing modification logic ...
    // ... update scoreboard/dynamic properties ...
    
    const newValue = oldValue + delta;
    
    // Animated display update for gains, instant for losses/admin
    if (delta > 0 && !options?.skipAnimation) {
        updateSPDisplay(player, newValue, { 
            animate: true, 
            oldValue: oldValue 
        });
    } else {
        updateSPDisplay(player, newValue, { animate: false });
    }
    
    // Celebration (from Phase 1) - timing coordinated below
    if (delta > 0 && !options?.skipCelebration) {
        // Delay celebration slightly so it starts during/after count-up
        system.runTimeout(() => {
            celebrateSPGain(player, delta);
        }, 5);
    }
}
```

### 2c. Modify updateSPDisplay()

**Find the existing `updateSPDisplay()` function** (approximately line 722).

**Current structure:**
```javascript
function updateSPDisplay(player) {
    // Gets current SP and sends titleraw command
    // JSON UI captures "SPVAL:XXX" pattern
}
```

**Refactor to:**
```javascript
/**
 * Update the SP HUD display.
 * 
 * @param {Player} player 
 * @param {number} value - SP value to display
 * @param {Object} options
 * @param {boolean} options.animate - Whether to animate the change
 * @param {number} options.oldValue - Previous value (required if animate=true)
 */
function updateSPDisplay(player, value, options = {}) {
    if (options.animate && options.oldValue !== undefined && options.oldValue !== value) {
        SPAnimator.animateCountUp(
            player,
            options.oldValue,
            value,
            sendSPDisplayValue  // callback to actually update display
        );
    } else {
        sendSPDisplayValue(player, value);
    }
}

/**
 * Actually send the display update command.
 * This is the raw display function called by animator or directly.
 */
function sendSPDisplayValue(player, value) {
    // Your existing titleraw/display logic here
    // Example (adjust to match your actual implementation):
    player.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"SPVAL:${value}"}]}`);
}
```

**Important:** Extract your existing display logic into `sendSPDisplayValue()`. The key is separating "what value to show" from "how to show it" so the animator can call the display function repeatedly.

### 2d. Handle Player Leave

Add cleanup when players leave to prevent orphaned animations:

```javascript
world.afterEvents.playerLeave.subscribe((event) => {
    // ... existing leave handling ...
    SPAnimator.clearPlayerAnimation(event.player);
});
```

---

## 🔊 Step 3: Register Sounds

**Add to `sound_definitions.json`:**

```json
"celebration.sp_tick_1": {
    "category": "ui",
    "sounds": [{
        "name": "sounds/ui/sp_tick_1",
        "volume": 1.0
    }]
},
"celebration.sp_tick_2": {
    "category": "ui",
    "sounds": [{
        "name": "sounds/ui/sp_tick_2",
        "volume": 1.0
    }]
},
"celebration.sp_tick_3": {
    "category": "ui",
    "sounds": [{
        "name": "sounds/ui/sp_tick_3",
        "volume": 1.0
    }]
},
"celebration.sp_land": {
    "category": "ui",
    "sounds": [{
        "name": "sounds/ui/sp_land",
        "volume": 1.0
    }]
}
```

---

## 🎵 Step 4: Sound Assets

**Place `.ogg` files in `packs/QuestSystemRP/sounds/ui/`:**

| Filename | Description | Duration | Style |
|----------|-------------|----------|-------|
| `sp_tick_1.ogg` | Count tick variant 1 | ~0.05s | Short, crisp click/tick |
| `sp_tick_2.ogg` | Count tick variant 2 | ~0.05s | Slight variation |
| `sp_tick_3.ogg` | Count tick variant 3 | ~0.05s | Another variation |
| `sp_land.ogg` | Final landing sound | ~0.15s | Satisfying "chunk" or soft chime |

**Sound design notes:**
- Tick sounds should be VERY short and subtle — they play rapidly
- Think: mechanical counter, slot machine reel, or soft UI click
- The "land" sound is the payoff — slightly fuller, signals completion
- Test at low volume first; rapid ticks can get annoying if too loud

**Placeholder approach:**
The code already has fallbacks to `random.click` and `random.orb`. These work but custom sounds will feel much better.

---

## 🧪 Step 5: Test Commands

Add to your scriptevent handler:

```javascript
// Test SP count-up animation
if (event.id === "sq:test_countup") {
    const amount = parseInt(event.message) || 50;
    const player = event.sourceEntity;
    
    if (player) {
        const currentSP = getSPBalance(player); // your SP getter
        
        // Simulate gaining SP with animation
        SPAnimator.animateCountUp(
            player,
            currentSP,
            currentSP + amount,
            sendSPDisplayValue
        );
    }
}

// Test instant display (no animation)
if (event.id === "sq:test_instant") {
    const value = parseInt(event.message) || 1000;
    const player = event.sourceEntity;
    
    if (player) {
        sendSPDisplayValue(player, value);
    }
}

// Test rapid SP gains (interrupt handling)
if (event.id === "sq:test_rapid") {
    const player = event.sourceEntity;
    if (player) {
        const base = getSPBalance(player);
        
        // Fire three SP gains in quick succession
        SPAnimator.animateCountUp(player, base, base + 25, sendSPDisplayValue);
        
        system.runTimeout(() => {
            SPAnimator.animateCountUp(player, base + 25, base + 75, sendSPDisplayValue);
        }, 10);
        
        system.runTimeout(() => {
            SPAnimator.animateCountUp(player, base + 75, base + 150, sendSPDisplayValue);
        }, 20);
    }
}
```

**Test commands:**
```
/scriptevent sq:test_countup 25      # Small gain
/scriptevent sq:test_countup 100     # Medium gain
/scriptevent sq:test_countup 500     # Large gain
/scriptevent sq:test_instant 9999    # Set display to specific value
/scriptevent sq:test_rapid           # Test interrupt handling
```

---

## ✅ Validation Checklist

### Basic Animation
- [ ] `/scriptevent sq:test_countup 50` shows number climbing
- [ ] Animation uses ease-out (fast start, slow finish)
- [ ] Final number is exactly correct (no rounding errors)
- [ ] Tick sounds play during count-up
- [ ] "Land" sound plays when animation completes

### Timing Feel
- [ ] Small gains (10-25 SP) animate quickly (~0.3-0.5s)
- [ ] Medium gains (50-100 SP) feel satisfying (~0.6-1.0s)
- [ ] Large gains (200+ SP) don't drag on (capped at ~2s)
- [ ] Animation never feels sluggish

### Interrupt Handling
- [ ] `/scriptevent sq:test_rapid` doesn't break anything
- [ ] New SP gain interrupts previous animation cleanly
- [ ] Display jumps to correct intermediate value before new animation
- [ ] No orphaned sounds or visual glitches

### Integration
- [ ] Actual quest turn-in triggers count-up animation
- [ ] Count-up coordinates with Phase 1/2 celebrations
- [ ] Admin SP commands can skip animation if desired
- [ ] Player leaving mid-animation doesn't cause errors

### Audio
- [ ] Tick sounds have subtle pitch variation (not monotonous)
- [ ] Pitch rises slightly toward end of count (building excitement)
- [ ] Volume is appropriate (audible but not annoying)
- [ ] Land sound is distinct from tick sounds

---

## ⚠️ Potential Issues & Solutions

### 1. Display Command Not Working
Your actual `titleraw` or display command syntax may differ.

**Solution:** Check your existing `updateSPDisplay()` and copy the exact command format into `sendSPDisplayValue()`.

### 2. Animation Too Fast/Slow
The default timing might not feel right for your game.

**Solution:** Adjust values in `ANIMATION_CONFIG`:
```javascript
timing: {
    minDurationTicks: 6,      // Increase for slower minimum
    maxDurationTicks: 40,     // Decrease for faster maximum
    ticksPerHundredSP: 8,     // Adjust scaling
},
```

### 3. Sounds Too Loud/Frequent
Rapid tick sounds can be irritating.

**Solution:** 
- Reduce `tickVolume` in config (try 0.2-0.3)
- Reduce tick count by adjusting `ticksPerTenSP`
- Or skip some tick sounds: `if (currentTick % 2 === 0) playTickSound(...)`

### 4. Celebrations Firing Too Early
Phase 1/2 celebrations might trigger before count-up finishes.

**Solution:** The spec includes a 5-tick delay before `celebrateSPGain()`. Increase this if needed, or check `SPAnimator.isAnimating(player)` before firing particles.

### 5. Multiple Players Animating
Each player needs independent animation state.

**Solution:** Already handled — `activeAnimations` Map uses `player.id` as key.

### 6. Negative SP Changes
Spending SP (if you add a shop) shouldn't animate.

**Solution:** Already handled — `animateCountUp()` instantly updates for `delta <= 0`.

---

## 🎨 Tuning Guide

| If it feels... | Adjust... |
|----------------|-----------|
| Too slow | Decrease `maxDurationTicks`, decrease `ticksPerHundredSP` |
| Too fast | Increase `minDurationTicks`, increase tick counts |
| Ticks annoying | Decrease `tickVolume`, reduce tick frequency |
| Anticlimactic end | Make `sp_land.ogg` more satisfying, increase `landVolume` |
| Robotic/mechanical | Increase `tickPitchVariance` for more randomness |
| Pitch rise too subtle | Increase `pitchRiseOnProgress` (try 0.4-0.5) |

---

## 🔄 Coordination with Phase 1 & 2

The count-up animation should feel like part of the celebration, not separate from it.

**Recommended timing flow for quest turn-in:**

```
0ms    - Quest marked complete
        - SP added to scoreboard
        - Count-up animation STARTS
        
~100ms - Small celebration particles begin (Phase 1)
        - Count-up still running
        
~500ms - Count-up nearing completion for medium gains
        - Phase 2 particles/sounds layering in
        
~800ms - Count-up LANDS (land sound)
        - Main celebration crescendo
        - Title card appears (Phase 2)
```

If timing feels off, adjust the `system.runTimeout()` delays in `modifySP()` and `handleQuestTurnIn()`.

---

## 🚀 What's Next

After Phase 3 is validated, potential enhancements:

- **Coin icon pulse:** If JSON UI supports it, pulse/scale the coin icon during count-up
- **Color flash:** Briefly tint the number gold during large gains
- **Milestone triggers:** When count-up crosses round numbers (1000, 5000), fire extra celebration
- **Combo system:** Rapid consecutive gains could trigger multiplier visuals

---

## 📋 Summary

Phase 3 adds the "score counter" feel that makes every SP gain tangible. The ease-out curve (fast start, slow finish) is psychologically satisfying — it builds anticipation and then lets the final number "land" with weight.

Combined with Phase 1's coin sounds and Phase 2's rarity-scaled celebrations, your kids will feel genuinely rewarded every time they complete a quest.
