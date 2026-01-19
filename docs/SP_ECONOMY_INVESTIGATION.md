# Super Points Economy Investigation

> **Date:** 2026-01-18
> **Purpose:** Document current SP reward implementation before overhaul
> **Status:** Complete

---

## Executive Summary

The current SP economy is **extremely simple and flat**:
- **All quests award exactly 1 SP** (base value)
- Rarity multipliers scale this: Common (1x), Rare (2x), Legendary (5x)
- **Final values: 1 SP, 2 SP, or 5 SP per quest**
- Reroll costs start at 50 SP with exponential scaling

This system desperately needs the proposed 10x multiplier and complexity additions.

---

## 1. SP Storage Architecture

### Dual-Storage System (Redundancy Design)

**Primary Source (Authoritative):**
```javascript
// Scoreboard objective: "SuperPoints"
const SCOREBOARD_OBJECTIVE_ID = "SuperPoints";
const SCOREBOARD_OBJECTIVE_DISPLAY = "§e★ SP";
```

**Backup Source:**
```javascript
// Dynamic property: questData.currentSP
// Synced on every modifySP() call
data.currentSP = newBalance;
```

### Storage Locations

| Location | Purpose | File |
|----------|---------|------|
| `world.scoreboard.getObjective("SuperPoints")` | Authoritative balance | [main.js:246](../packs/QuestSystemBP/scripts/main.js#L246) |
| `questData.currentSP` | Backup/recovery | [PersistenceManager.js:28](../packs/QuestSystemBP/scripts/systems/PersistenceManager.js#L28) |

### Access Patterns

**Reading SP:**
```javascript
// main.js:465-469
function getSP(player) {
  const objective = world.scoreboard.getObjective(SCOREBOARD_OBJECTIVE_ID);
  if (!objective || !player.scoreboardIdentity) return 0;
  return objective.getScore(player.scoreboardIdentity) ?? 0;
}
```

**Writing SP:**
```javascript
// main.js:479-509
function modifySP(player, delta) {
  // 1. Read from scoreboard
  let current = objective.getScore(player.scoreboardIdentity) ?? 0;

  // 2. Calculate new balance (floor at 0)
  const newBalance = Math.max(0, current + delta);

  // 3. Write to scoreboard (authoritative)
  objective.setScore(player, newBalance);

  // 4. Write to backup (dynamic property)
  data.currentSP = newBalance;
  PersistenceManager.saveQuestData(player, data);

  // 5. Trigger HUD animation
  updateSPDisplayWithAnimation(player);

  return newBalance;
}
```

---

## 2. Reward Assignment System

### Current Base Values (CRITICAL)

**Location:** [QuestGenerator.js:147-177](../packs/QuestSystemBP/scripts/systems/QuestGenerator.js#L147-177)

```javascript
// KILL QUESTS
reward: {
  scoreboardIncrement: 1,  // ← BASE SP REWARD
  rewardItems: [
    { typeId: "minecraft:diamond", amount: Math.ceil(count / 10) }
  ]
}

// GATHER/MINE QUESTS
reward: {
  scoreboardIncrement: 1,  // ← BASE SP REWARD
  rewardItems: [
    { typeId: "minecraft:iron_ingot", amount: Math.ceil(count / 16) }
  ]
}
```

### Rarity Multiplier System

**Location:** [QuestGenerator.js:84-116](../packs/QuestSystemBP/scripts/systems/QuestGenerator.js#L84-116)

```javascript
// Rarity Logic
const roll = Math.random();
let rarity = "common";
let multiplier = 1;

if (roll >= 0.9) {       // 10% chance
  rarity = "legendary";
  multiplier = 5;         // ← 5x rewards
} else if (roll >= 0.6) {  // 30% chance
  rarity = "rare";
  multiplier = 2;         // ← 2x rewards
}
// else: common (60% chance, 1x multiplier)

// Apply multiplier to BOTH SP and items
quest.reward.scoreboardIncrement = Math.ceil(baseReward * multiplier);
quest.reward.rewardItems.forEach(item => {
  item.amount = Math.ceil(item.amount * multiplier);
});
```

### Final SP Values (Current System)

| Rarity | Probability | Base SP | Multiplier | **Final SP** |
|--------|-------------|---------|------------|--------------|
| Common | 60% | 1 | 1x | **1 SP** |
| Rare | 30% | 1 | 2x | **2 SP** |
| Legendary | 10% | 1 | 5x | **5 SP** |

**Quest Type Impact:** NONE. All quests (kill/mine/gather) start at 1 SP base.

---

## 3. Quest Generation Details

### Rarity Distribution (Hardcoded Probabilities)

**Location:** [QuestGenerator.js:84-98](../packs/QuestSystemBP/scripts/systems/QuestGenerator.js#L84-98)

```javascript
const roll = Math.random();

if (roll >= 0.9)      → Legendary (10%)
else if (roll >= 0.6) → Rare (30%)
else                  → Common (60%)
```

### Existing Rarities

1. **Common** (§7, gray)
2. **Rare** (§b, aqua)
3. **Legendary** (§6§l, bold gold)

**Missing:** Mythic tier (mentioned in future plans)

### Quest Types

All quests are 50/50 split:
- **Kill quests** (50%): Target mobs from MOB_POOL
- **Gather/Mine quests** (50%): Target items/blocks from ITEM_POOL

---

## 4. Reward Distribution Flow

### Complete Code Path

**1. Quest Completion Detection**
   - Kill: [main.js:1483-1554](../packs/QuestSystemBP/scripts/main.js#L1483-1554) (entityDie event)
   - Mine: [main.js:1556-1582](../packs/QuestSystemBP/scripts/main.js#L1556-1582) (playerBreakBlock event)
   - Gather: Validated on turn-in

**2. Turn-In Handler**
   - Function: `handleQuestTurnIn(player)` [main.js:1584-1701](../packs/QuestSystemBP/scripts/main.js#L1584-1701)
   - Validates completion
   - Awards rewards
   - Updates quest state

**3. SP Award (Line 1641-1646)**
```javascript
const reward = quest.reward;
const spEarned = reward?.scoreboardIncrement ?? 0;

if (spEarned > 0) {
  modifySP(player, spEarned);  // ← Centralized SP award
}
```

**4. Item Rewards (Lines 1649-1665)**
```javascript
for (const rItem of reward.rewardItems) {
  const itemStack = new ItemStack(rItem.typeId, rItem.amount);
  inventory.addItem(itemStack);  // or drop if full
}
```

**5. Player Feedback**

**Single Quest:**
```javascript
// Line 1694
player.sendMessage(`§a✓ Quest Complete: ${colors.chat}${quest.title}§r (+${spEarned} SP)`);
player.playSound("quest.complete_single", { volume: 1.0, pitch: 1.0 });
player.dimension.spawnParticle("minecraft:villager_happy", player.location);
```

**All 3 Quests (Jackpot):**
```javascript
// Lines 1393-1439 (triggerQuestClearCelebration)
- Totem particle burst
- "quest.complete_all" sound
- Title card: "★ ALL QUESTS COMPLETE ★"
- Subtitle: "3 new quests available! (+1 free reroll)"
- Celebration messages with SP display
```

---

## 5. Economy Costs

### Reroll Pricing System

**Location:** [main.js:782-793](../packs/QuestSystemBP/scripts/main.js#L782-793)

```javascript
function calculateRerollPrice(paidRerollsThisCycle) {
  const BASE_PRICE = 50;  // ← Hardcoded constant (IN FUNCTION!)

  if (paidRerollsThisCycle < 2) {
    return BASE_PRICE;  // 1st & 2nd reroll: 50 SP
  }

  // Exponential scaling after 2nd reroll
  // 3rd reroll = 50 * 2^1 = 100
  // 4th reroll = 50 * 2^2 = 200
  // 5th reroll = 50 * 2^3 = 400
  return BASE_PRICE * Math.pow(2, paidRerollsThisCycle - 1);
}
```

### Pricing Table

| Reroll # | Formula | **Cost** |
|----------|---------|----------|
| 1st (paid) | BASE_PRICE | **50 SP** |
| 2nd (paid) | BASE_PRICE | **50 SP** |
| 3rd (paid) | 50 × 2¹ | **100 SP** |
| 4th (paid) | 50 × 2² | **200 SP** |
| 5th (paid) | 50 × 2³ | **400 SP** |
| 6th (paid) | 50 × 2⁴ | **800 SP** |

**Free Reroll:**
- Earned by completing all 3 quests
- Stored in `questData.freeRerollAvailable` (boolean)
- Resets exponential pricing when used

### Other SP Costs

**Currently:** NONE. Rerolls are the only SP sink.

---

## 6. Current Config Structures

### None Exist!

**Problem:** All values are hardcoded:
- Base SP rewards: Hardcoded in `QuestGenerator.js` line 147 & 174
- Rarity multipliers: Hardcoded in `QuestGenerator.js` lines 84-98
- Reroll base price: Hardcoded **inside a function** at `main.js` line 783

### Constants That Should Be Configurable

```javascript
// Scattered across files:
QuestGenerator.js:
  - BASE_SP_REWARD_KILL = 1
  - BASE_SP_REWARD_GATHER = 1
  - RARITY_PROBABILITY_LEGENDARY = 0.1
  - RARITY_PROBABILITY_RARE = 0.3
  - RARITY_MULTIPLIER_COMMON = 1
  - RARITY_MULTIPLIER_RARE = 2
  - RARITY_MULTIPLIER_LEGENDARY = 5

main.js:
  - REROLL_BASE_PRICE = 50
  - REROLL_EXPONENTIAL_THRESHOLD = 2
```

---

## 7. Recommendations for New SP_CONFIG

### Proposed Location

**Option A (Recommended):** New file `scripts/data/EconomyConfig.js`
```javascript
// Centralized economy configuration
export const SP_CONFIG = {
  BASE_REWARDS: { /* ... */ },
  RARITY_CONFIG: { /* ... */ },
  COSTS: { /* ... */ }
};
```

**Option B:** Add to existing `scripts/data/QuestData.js`
- Pro: Keeps data files together
- Con: Mixes static content (mobs/items) with tunable economy values

**Option C:** New file `scripts/config/economy.js`
- Pro: Clear separation of tunable config
- Con: Creates new folder structure

### Recommended Structure

```javascript
// scripts/data/EconomyConfig.js
export const SP_CONFIG = {
  // Base rewards (before rarity multipliers)
  BASE_REWARDS: {
    KILL: 10,      // Was: 1
    MINE: 10,      // Was: 1
    GATHER: 10     // Was: 1
  },

  // Rarity system
  RARITY: {
    COMMON: {
      weight: 0.60,      // 60% chance
      multiplier: 1.0,   // Was: 1
      color: { chat: "§7", button: "§f" }
    },
    RARE: {
      weight: 0.30,      // 30% chance
      multiplier: 2.0,   // Was: 2
      color: { chat: "§b", button: "§b" }
    },
    LEGENDARY: {
      weight: 0.10,      // 10% chance
      multiplier: 5.0,   // Was: 5
      color: { chat: "§6§l", button: "§6" }
    },
    MYTHIC: {           // NEW
      weight: 0.01,      // 1% chance (or special trigger)
      multiplier: 10.0,
      color: { chat: "§d§l", button: "§d" }
    }
  },

  // Quest type modifiers (NEW)
  TYPE_MODIFIERS: {
    KILL: 1.0,
    MINE: 1.1,    // Slightly more rewarding
    GATHER: 0.9   // Slightly less (easier)
  },

  // Special bonuses (NEW)
  BONUSES: {
    JACKPOT_CHANCE: 0.05,        // 5% chance
    JACKPOT_MULTIPLIER: 2.0,     // 2x SP on lucky rolls
    STREAK_BONUS_PER_QUEST: 5,   // +5 SP per quest in streak
    ALL_CLEAR_BONUS: 50          // Flat bonus for clearing all 3
  },

  // Economy costs
  COSTS: {
    REROLL_BASE: 500,            // Was: 50
    REROLL_EXPONENTIAL_START: 2, // After 2nd reroll
    REROLL_EXPONENTIAL_BASE: 2   // Power of 2
  }
};
```

### Migration Path

1. **Create `EconomyConfig.js`** with new values
2. **Update `QuestGenerator.js`:**
   ```javascript
   import { SP_CONFIG } from "../data/EconomyConfig.js";

   // Replace hardcoded `scoreboardIncrement: 1`
   let baseSP = SP_CONFIG.BASE_REWARDS[quest.type.toUpperCase()];
   baseSP *= SP_CONFIG.TYPE_MODIFIERS[quest.type.toUpperCase()] || 1.0;

   // Apply rarity multiplier (existing logic)
   quest.reward.scoreboardIncrement = Math.ceil(baseSP * multiplier);
   ```

3. **Update `main.js`:**
   ```javascript
   import { SP_CONFIG } from "./data/EconomyConfig.js";

   function calculateRerollPrice(paidRerollsThisCycle) {
     const BASE = SP_CONFIG.COSTS.REROLL_BASE;  // 500
     const THRESHOLD = SP_CONFIG.COSTS.REROLL_EXPONENTIAL_START;
     // ... rest of logic
   }
   ```

4. **Add bonus systems:**
   - Jackpot roll in `QuestGenerator.generateQuest()`
   - Streak tracking in quest data schema
   - All-clear bonus in `handleQuestTurnIn()`

---

## 8. Impact Analysis (10x Multiplier)

### Before vs After

| Quest Type | Rarity | **Current SP** | **Proposed SP** | Change |
|------------|--------|----------------|-----------------|--------|
| Any | Common | 1 | 10 | +900% |
| Any | Rare | 2 | 20 | +900% |
| Any | Legendary | 5 | 50 | +900% |

### Economy Implications

**Average SP per quest (current):**
- (1 × 0.60) + (2 × 0.30) + (5 × 0.10) = **1.7 SP**

**Average SP per quest (proposed base 10):**
- (10 × 0.60) + (20 × 0.30) + (50 × 0.10) = **17 SP**

**3-quest daily completion (current):** ~5 SP
**3-quest daily completion (proposed):** ~50 SP

**Reroll cost adjustment:**
- Current: 50 SP (10x average daily earnings)
- Proposed: 500 SP (10x average daily earnings)
- **Ratio preserved!**

---

## 9. Code Snippets for Reference

### Where Rewards are Generated
```javascript
// QuestGenerator.js:146-151 (Kill quests)
reward: {
  scoreboardIncrement: 1,  // ← CHANGE THIS
  rewardItems: [
    { typeId: "minecraft:diamond", amount: diamondCount }
  ]
}

// QuestGenerator.js:173-178 (Gather/Mine quests)
reward: {
  scoreboardIncrement: 1,  // ← CHANGE THIS
  rewardItems: [
    { typeId: "minecraft:iron_ingot", amount: ironCount }
  ]
}
```

### Where Rewards are Applied
```javascript
// QuestGenerator.js:105-115 (Rarity multiplier application)
if (quest.reward) {
  if (quest.reward.scoreboardIncrement) {
    quest.reward.scoreboardIncrement =
      Math.ceil(quest.reward.scoreboardIncrement * multiplier);
  }
  // Items also multiplied
}
```

### Where Rewards are Awarded
```javascript
// main.js:1641-1646 (Turn-in handler)
const reward = quest.reward;
const spEarned = reward?.scoreboardIncrement ?? 0;

if (spEarned > 0) {
  modifySP(player, spEarned);  // ← Triggers HUD animation
}
```

---

## 10. Next Steps for Overhaul

### Phase 1: Configuration Extraction
- [ ] Create `scripts/data/EconomyConfig.js`
- [ ] Define `SP_CONFIG` object with new values
- [ ] Import into `QuestGenerator.js` and `main.js`
- [ ] Replace all hardcoded values with config references

### Phase 2: Base Value Adjustment
- [ ] Change `BASE_REWARDS.KILL` from 1 → 10
- [ ] Change `BASE_REWARDS.MINE` from 1 → 10
- [ ] Change `BASE_REWARDS.GATHER` from 1 → 10
- [ ] Update `COSTS.REROLL_BASE` from 50 → 500

### Phase 3: New Features
- [ ] Add Mythic rarity tier (1% chance, 10x multiplier)
- [ ] Implement quest type modifiers (KILL/MINE/GATHER bonuses)
- [ ] Add jackpot system (5% chance for 2x SP)
- [ ] Implement streak tracking
- [ ] Add all-clear bonus (+50 SP flat)

### Phase 4: Testing
- [ ] Verify average SP/day stays balanced (~50-60 SP)
- [ ] Test reroll pricing curve (should feel expensive but achievable)
- [ ] Confirm HUD updates correctly with larger numbers
- [ ] Check for integer overflow (unlikely with these values)

### Phase 5: Documentation
- [ ] Update `ARCHITECTURE.md` with economy details
- [ ] Add economy tuning guide to `CLAUDE_QUICKSTART.md`
- [ ] Document new config file in `PROJECT_MAP.md`

---

## Appendix: File References

| File | Lines | Purpose |
|------|-------|---------|
| [QuestGenerator.js](../packs/QuestSystemBP/scripts/systems/QuestGenerator.js) | 84-116 | Rarity logic |
| [QuestGenerator.js](../packs/QuestSystemBP/scripts/systems/QuestGenerator.js) | 147, 174 | Base SP rewards |
| [main.js](../packs/QuestSystemBP/scripts/main.js) | 246-247 | Scoreboard constants |
| [main.js](../packs/QuestSystemBP/scripts/main.js) | 465-509 | SP helpers (getSP, modifySP) |
| [main.js](../packs/QuestSystemBP/scripts/main.js) | 782-793 | Reroll pricing |
| [main.js](../packs/QuestSystemBP/scripts/main.js) | 1584-1701 | Turn-in handler |
| [main.js](../packs/QuestSystemBP/scripts/main.js) | 1393-1439 | Celebration effects |
| [PersistenceManager.js](../packs/QuestSystemBP/scripts/systems/PersistenceManager.js) | 19-29 | Data schema |

---

**Investigation Complete:** All questions answered. Ready for economy overhaul implementation.
