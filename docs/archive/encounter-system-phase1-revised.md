# Super Quester: Encounter System — Phase 1 Implementation (Revised)

**Phase:** 1 of 5
**Focus:** Encounter Data Structures & Tables
**Branch:** `feature/encounter-system`
**Validates:** Data layer works, encounters defined, quest generation integrates cleanly

---

## Objective

Establish the data layer for encounters. No mob spawning yet — this phase wires encounter definitions into quest generation so that Rare and Legendary quests pull from a curated encounter table instead of generating standard kill quests.

By the end of this phase:
- Encounter table exists with 8 encounters (4 Rare, 4 Legendary)
- Quest generation routes Rare/Legendary to encounter system
- Quest board UI displays encounter names and descriptions
- Accepting an encounter quest copies full encounter data to `active` slot

---

## Current Rarity Distribution (Unchanged)

| Tier | Probability |
|------|-------------|
| Common | 70% |
| Rare | 22% |
| Legendary | 7% |
| Mythic | 1% |

Encounter system applies to **Rare and Legendary only**. Common and Mythic remain unchanged.

---

## Files to Create

### 1. `/scripts/data/EncounterTable.js`

```javascript
/**
 * EncounterTable.js
 * Defines all available encounters for the quest system.
 * Each encounter specifies mob composition, display info, and tier.
 */

export const ENCOUNTER_TABLE = [
  // ============================================
  // RARE TIER (4 encounters)
  // ============================================
  {
    id: "skeleton_warband",
    name: "Skeleton Warband",
    description: "A group of skeletal warriors has assembled nearby.",
    tier: "rare",
    mobs: [
      { type: "minecraft:skeleton", count: 5, equipment: null, nameTag: null }
    ],
    totalMobCount: 5
  },
  {
    id: "zombie_pack",
    name: "Shambling Horde",
    description: "The dead are walking. Put them down.",
    tier: "rare",
    mobs: [
      { type: "minecraft:zombie", count: 6, equipment: null, nameTag: null }
    ],
    totalMobCount: 6
  },
  {
    id: "spider_nest",
    name: "Spider Nest",
    description: "Arachnids have infested the area.",
    tier: "rare",
    mobs: [
      { type: "minecraft:spider", count: 4, equipment: null, nameTag: null },
      { type: "minecraft:cave_spider", count: 2, equipment: null, nameTag: null }
    ],
    totalMobCount: 6
  },
  {
    id: "creeper_cluster",
    name: "Creeper Problem",
    description: "Something hisses in the shadows...",
    tier: "rare",
    mobs: [
      { type: "minecraft:creeper", count: 3, equipment: null, nameTag: null }
    ],
    totalMobCount: 3
  },

  // ============================================
  // LEGENDARY TIER (4 encounters)
  // ============================================
  {
    id: "skeleton_legion",
    name: "Skeleton Legion",
    description: "An organized force of the undead marches on the realm.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:skeleton", count: 8, equipment: null, nameTag: null },
      { type: "minecraft:stray", count: 3, equipment: null, nameTag: "Frost Archer" }
    ],
    totalMobCount: 11
  },
  {
    id: "zombie_siege",
    name: "Zombie Siege",
    description: "A massive horde approaches. Hold the line.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:zombie", count: 10, equipment: null, nameTag: null },
      { type: "minecraft:husk", count: 4, equipment: null, nameTag: null }
    ],
    totalMobCount: 14
  },
  {
    id: "phantom_swarm",
    name: "Phantom Swarm",
    description: "Nightmares made flesh circle overhead.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:phantom", count: 6, equipment: null, nameTag: null }
    ],
    totalMobCount: 6
  },
  {
    id: "witch_coven",
    name: "Witch Coven",
    description: "Dark magic corrupts this land.",
    tier: "legendary",
    mobs: [
      { type: "minecraft:witch", count: 3, equipment: null, nameTag: null },
      { type: "minecraft:zombie_villager", count: 4, equipment: null, nameTag: "Cursed Villager" }
    ],
    totalMobCount: 7
  }
];

/**
 * Get all encounters for a specific tier
 * @param {string} tier - "rare" or "legendary"
 * @returns {Array} Array of encounter definitions
 */
export function getEncountersByTier(tier) {
  return ENCOUNTER_TABLE.filter(encounter => encounter.tier === tier);
}

/**
 * Get a specific encounter by ID
 * @param {string} id - Encounter ID (e.g., "skeleton_warband")
 * @returns {Object|undefined} Encounter definition or undefined
 */
export function getEncounterById(id) {
  return ENCOUNTER_TABLE.find(encounter => encounter.id === id);
}
```

---

### 2. `/scripts/systems/EncounterManager.js`

**Note:** Reward calculation is handled entirely within this module to keep QuestGenerator integration simple.

```javascript
/**
 * EncounterManager.js
 * Handles encounter selection and quest generation for encounter-based quests.
 * Self-contained reward calculation using existing RewardCalculator patterns.
 */

import { ENCOUNTER_TABLE, getEncountersByTier } from "../data/EncounterTable.js";
import { calculateBaseQuestReward } from "./RewardCalculator.js";

/**
 * Generate a unique quest ID
 * @returns {string} Unique identifier
 */
function generateUniqueId() {
  return `enc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Select a random encounter from the available pool for a tier
 * @param {string} tier - "rare" or "legendary"
 * @returns {Object|null} Encounter definition or null
 */
export function selectRandomEncounter(tier) {
  const available = getEncountersByTier(tier);
  
  if (available.length === 0) {
    console.error(`[EncounterManager] No encounters found for tier: ${tier}`);
    return null;
  }
  
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Generate an encounter-based quest object
 * Handles its own reward calculation using the encounter's mob count.
 * 
 * @param {string} tier - "rare" or "legendary"
 * @returns {Object|null} Quest object ready for player's available/active slot, or null on failure
 */
export function generateEncounterQuest(tier) {
  const encounter = selectRandomEncounter(tier);
  
  if (!encounter) {
    return null;
  }
  
  // Calculate SP reward using existing reward calculator
  // Encounters are treated as "kill" type quests
  const rewardCalc = calculateBaseQuestReward(tier, "kill", encounter.totalMobCount);
  
  // Calculate item rewards using existing multiplier pattern
  const rarityToMultiplier = {
    "common": 1,
    "rare": 2,
    "legendary": 5,
    "mythic": 10
  };
  const itemMultiplier = rarityToMultiplier[tier] || 1;
  
  // Base diamond reward scales with mob count
  const baseDiamonds = Math.ceil(encounter.totalMobCount / 10);
  const rewardItems = [{
    typeId: "minecraft:diamond",
    amount: Math.max(1, Math.ceil(baseDiamonds * itemMultiplier))
  }];
  
  return {
    // === STANDARD FIELDS (maintain UI/persistence compatibility) ===
    id: generateUniqueId(),
    title: encounter.name,
    description: encounter.description,
    type: "encounter",
    category: "combat",
    rarity: tier,
    requiredCount: encounter.totalMobCount,
    targets: encounter.mobs.map(m => m.type.replace("minecraft:", "")),  // Strip prefix for UI
    
    reward: {
      scoreboardIncrement: rewardCalc.total,
      rewardItems: rewardItems
    },
    
    // === ENCOUNTER-SPECIFIC FIELDS ===
    isEncounter: true,
    encounterId: encounter.id,
    encounterName: encounter.name,
    encounterMobs: structuredClone(encounter.mobs),  // Deep copy to prevent mutation
    totalMobCount: encounter.totalMobCount,
    
    // === SPAWN DATA (populated in Phase 2 when quest is accepted) ===
    spawnData: null
  };
}
```

---

## Files to Modify

### 3. `QuestGenerator.js`

**Location:** `/scripts/systems/QuestGenerator.js`

**Current Flow (lines ~76-111):**
```javascript
static generateQuest() {
  // 1. Generate kill or gather quest first (lines 76-83)
  const isKill = Math.random() < 0.5;
  let quest = isKill ? this.generateKillQuest() : this.generateGatherQuest();
  
  // 2. THEN roll rarity (line 86)
  const rarity = rollRarity();
  quest.rarity = rarity;
  
  // 3. Calculate rewards (lines 90-111)
  const rewardCalc = calculateBaseQuestReward(rarity, quest.type, quest.requiredCount);
  quest.reward.scoreboardIncrement = rewardCalc.total;
  // ... item rewards ...
  
  return quest;
}
```

**Required Changes:**

**Step 1:** Add import at top of file:
```javascript
import { generateEncounterQuest } from "./EncounterManager.js";
```

**Step 2:** Insert encounter routing immediately after rarity roll (after line 86):

```javascript
static generateQuest() {
  const isKill = Math.random() < 0.5;
  let quest;

  if (isKill) {
    quest = this.generateKillQuest();
  } else {
    quest = this.generateGatherQuest();
  }

  // Roll rarity using weighted system from EconomyConfig
  const rarity = rollRarity();
  
  // === NEW: Route Rare and Legendary to encounter system ===
  if (rarity === "rare" || rarity === "legendary") {
    const encounterQuest = generateEncounterQuest(rarity);
    
    if (encounterQuest) {
      return encounterQuest;
    }
    // If encounter generation fails, fall through to standard quest
    console.warn(`[QuestGenerator] Encounter generation failed for ${rarity}, falling back to standard quest`);
  }
  // === END NEW CODE ===
  
  // Continue with original logic for Common/Mythic or fallback
  quest.rarity = rarity;
  
  // Calculate rewards (existing code continues unchanged)
  const rewardCalc = calculateBaseQuestReward(rarity, quest.type, quest.requiredCount);
  quest.reward.scoreboardIncrement = rewardCalc.total;
  // ... rest of existing reward/item logic ...
  
  return quest;
}
```

**Key Points:**
- Insert AFTER `const rarity = rollRarity();`
- Insert BEFORE `quest.rarity = rarity;`
- `generateEncounterQuest()` takes only `tier` parameter (no `playerId` needed)
- Fallback to standard quest if encounter generation fails

---

## Extended Quest Schema Reference

Encounter quests include all standard fields plus encounter-specific fields:

```javascript
{
  // === STANDARD FIELDS (existing) ===
  id: string,                    // Unique quest ID
  title: string,                 // Display name (= encounterName)
  description: string,           // Quest description
  type: "encounter",             // NEW type value
  category: "combat",            // Category for filtering
  rarity: "rare"|"legendary",    // Tier
  requiredCount: number,         // Total mobs to kill (= totalMobCount)
  targets: string[],             // Mob type IDs without "minecraft:" prefix
  reward: {
    scoreboardIncrement: number, // SP to award
    rewardItems: [{ typeId: string, amount: number }]
  },
  
  // === ENCOUNTER FIELDS (new) ===
  isEncounter: true,             // Flag for encounter-specific logic
  encounterId: string,           // Reference to ENCOUNTER_TABLE entry
  encounterName: string,         // Display name
  encounterMobs: [               // Full mob composition
    {
      type: string,              // Entity type ID (with "minecraft:" prefix)
      count: number,             // How many to spawn
      equipment: object|null,    // Future: armor/weapons
      nameTag: string|null       // Custom name tag
    }
  ],
  totalMobCount: number,         // Sum of all mob counts
  
  // === SPAWN DATA (added in Phase 2 when accepted) ===
  spawnData: null | {
    location: { x: number, y: number, z: number },
    spawnedEntityIds: string[],
    dimensionId: string
  }
}
```

---

## Validation Checklist

### Data Layer
- [ ] `EncounterTable.js` loads without errors
- [ ] `getEncountersByTier("rare")` returns exactly 4 encounters
- [ ] `getEncountersByTier("legendary")` returns exactly 4 encounters
- [ ] `getEncounterById("skeleton_warband")` returns correct encounter

### Quest Generation
- [ ] Accepting a Rare quest generates an encounter quest (check `isEncounter: true`)
- [ ] Accepting a Legendary quest generates an encounter quest
- [ ] Common quests are NOT affected (still generate standard kill/gather)
- [ ] Mythic quests are NOT affected (behavior unchanged)
- [ ] Encounter quest has all required standard fields populated
- [ ] Encounter quest has all encounter-specific fields populated
- [ ] `encounterMobs` is a deep copy (modifying it doesn't affect ENCOUNTER_TABLE)
- [ ] `targets` array contains mob names without "minecraft:" prefix

### Reward Calculation
- [ ] Encounter quest SP reward matches expected value from `calculateBaseQuestReward()`
- [ ] Item rewards scale correctly with rarity multiplier
- [ ] Rare encounters award ~50 SP base (before bonuses)
- [ ] Legendary encounters award ~150 SP base (before bonuses)

### Quest Board UI
- [ ] Encounter quests display on Available tab correctly
- [ ] `title` shows encounter name (e.g., "Skeleton Warband")
- [ ] `description` shows encounter description
- [ ] Reward display shows correct SP value
- [ ] Accepting encounter quest moves it to Active tab
- [ ] Active tab shows encounter quest with correct info

### Persistence
- [ ] Encounter quest in `available` slot persists through logout/login
- [ ] Encounter quest in `active` slot persists through logout/login
- [ ] All encounter fields survive JSON serialization/deserialization

---

## Testing Commands

Add these to chat command handler in `main.js` for Phase 1 testing:

```javascript
if (message === "!encounter test table") {
  const { getEncountersByTier, ENCOUNTER_TABLE } = await import("./data/EncounterTable.js");
  player.sendMessage(`§aTotal encounters: ${ENCOUNTER_TABLE.length}`);
  player.sendMessage(`§eRare: ${getEncountersByTier("rare").length}`);
  player.sendMessage(`§6Legendary: ${getEncountersByTier("legendary").length}`);
  return true;
}

if (message === "!encounter test generate rare") {
  const { generateEncounterQuest } = await import("./systems/EncounterManager.js");
  const quest = generateEncounterQuest("rare");
  if (quest) {
    player.sendMessage(`§aGenerated: ${quest.encounterName}`);
    player.sendMessage(`§7ID: ${quest.id}`);
    player.sendMessage(`§7Mobs: ${quest.totalMobCount}`);
    player.sendMessage(`§7SP: ${quest.reward.scoreboardIncrement}`);
    player.sendMessage(`§7isEncounter: ${quest.isEncounter}`);
  } else {
    player.sendMessage(`§cFailed to generate encounter`);
  }
  return true;
}

if (message === "!encounter test generate legendary") {
  const { generateEncounterQuest } = await import("./systems/EncounterManager.js");
  const quest = generateEncounterQuest("legendary");
  if (quest) {
    player.sendMessage(`§6Generated: ${quest.encounterName}`);
    player.sendMessage(`§7ID: ${quest.id}`);
    player.sendMessage(`§7Mobs: ${quest.totalMobCount}`);
    player.sendMessage(`§7SP: ${quest.reward.scoreboardIncrement}`);
    player.sendMessage(`§7isEncounter: ${quest.isEncounter}`);
  } else {
    player.sendMessage(`§cFailed to generate encounter`);
  }
  return true;
}
```

---

## Rollback Plan

If Phase 1 causes issues:

1. Revert `QuestGenerator.js` to remove the encounter routing block
2. New files (`EncounterTable.js`, `EncounterManager.js`) can remain — they're inert if not imported

The encounter routing is the only integration point. Removing the `if (rarity === "rare" || rarity === "legendary")` block restores original behavior completely.

---

## Phase 1 Complete When

All validation checklist items pass, specifically:
1. Rare/Legendary quests generate as encounters
2. Quest board displays them correctly
3. Rewards calculate correctly
4. Data persists through logout/login
5. Common/Mythic quests are unaffected

**Do not proceed to Phase 2** until all Phase 1 validations pass.

---

## Notes for Implementation

1. **No `playerId` parameter**: Quests aren't player-specific until accepted. The `generateEncounterQuest(tier)` signature takes only the tier.

2. **Reward calculation is self-contained**: `EncounterManager.js` imports `calculateBaseQuestReward` directly and handles all reward logic internally. This keeps QuestGenerator integration minimal.

3. **Mythic tier**: Not routed to encounters. Intentional — Mythic can be added later once encounters prove stable.

4. **`structuredClone()`**: Deep copies `encounter.mobs` to prevent accidental mutation of ENCOUNTER_TABLE during gameplay.

5. **Targets array**: Strips "minecraft:" prefix for UI compatibility (e.g., `"skeleton"` not `"minecraft:skeleton"`).

6. **Import path**: Verify the import path from `QuestGenerator.js` to `EncounterManager.js` matches your file structure. Should be `"./EncounterManager.js"` if both are in `/scripts/systems/`.
