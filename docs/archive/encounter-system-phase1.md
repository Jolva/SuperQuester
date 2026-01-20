# Super Quester: Encounter System — Phase 1 Implementation

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

```javascript
/**
 * EncounterManager.js
 * Handles encounter selection and quest generation for encounter-based quests.
 */

import { ENCOUNTER_TABLE, getEncountersByTier } from "../data/EncounterTable.js";

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
 * @returns {Object} Encounter definition
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
 * @param {string} tier - "rare" or "legendary"
 * @param {string} playerId - Player's unique ID
 * @param {number} baseReward - SP reward calculated by RewardCalculator
 * @param {Array} rewardItems - Item rewards from RewardCalculator
 * @returns {Object} Quest object ready for player's available/active slot
 */
export function generateEncounterQuest(tier, playerId, baseReward, rewardItems) {
  const encounter = selectRandomEncounter(tier);
  
  if (!encounter) {
    return null;
  }
  
  return {
    // Standard quest fields (maintain compatibility)
    id: generateUniqueId(),
    title: encounter.name,
    description: encounter.description,
    type: "encounter",                    // New type for encounter quests
    category: "combat",
    rarity: tier,
    requiredCount: encounter.totalMobCount,
    targets: encounter.mobs.map(m => m.type),  // For UI compatibility
    
    // Reward structure (matches existing schema)
    reward: {
      scoreboardIncrement: baseReward,
      rewardItems: rewardItems
    },
    
    // Encounter-specific fields
    isEncounter: true,
    encounterId: encounter.id,
    encounterName: encounter.name,
    encounterMobs: structuredClone(encounter.mobs),  // Deep copy to prevent mutation
    totalMobCount: encounter.totalMobCount,
    
    // Spawn data (populated when quest is accepted in Phase 2)
    spawnData: null
  };
}
```

---

## Files to Modify

### 3. `QuestGenerator.js`

**Location:** `/scripts/systems/QuestGenerator.js`
**Target Area:** Inside `generateQuest()` function, after rarity is determined but before kill/mine/gather quest generation.

**Current Flow (approximately lines 74-114):**
```javascript
// Rarity is rolled here
const rarity = rollRarity();

// Then quest type is determined and quest is generated
// Kill quests, mine quests, gather quests, etc.
```

**Required Change:**

Add import at top of file:
```javascript
import { generateEncounterQuest } from "./EncounterManager.js";
```

Add encounter routing after rarity roll, before existing quest type logic:
```javascript
// After rarity is determined:
const rarity = rollRarity();

// NEW: Route Rare and Legendary to encounter system
if (rarity === "rare" || rarity === "legendary") {
  // Calculate rewards using existing system
  const baseReward = calculateBaseReward(rarity);  // Use existing reward calculation
  const rewardItems = generateRewardItems(rarity); // Use existing item generation
  
  const encounterQuest = generateEncounterQuest(rarity, playerId, baseReward, rewardItems);
  
  if (encounterQuest) {
    return encounterQuest;
  }
  // If encounter generation fails, fall through to standard quest generation
  console.warn(`[QuestGenerator] Encounter generation failed for ${rarity}, falling back to standard quest`);
}

// Existing quest generation continues below for Common/Mythic or fallback...
```

**Important:** Match the existing reward calculation pattern. Look at how `reward.scoreboardIncrement` and `reward.rewardItems` are currently populated and use the same functions/logic.

---

## Extended Quest Schema Reference

Encounter quests must include all standard fields (for UI/persistence compatibility) plus encounter-specific fields:

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
  targets: string[],             // Mob type IDs (for UI display)
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
      type: string,              // Entity type ID
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
- [ ] Common quests are NOT affected (still generate standard kill/mine/gather)
- [ ] Mythic quests are NOT affected (behavior unchanged for now)
- [ ] Encounter quest has all required standard fields populated
- [ ] Encounter quest has all encounter-specific fields populated
- [ ] `encounterMobs` is a deep copy (modifying it doesn't affect ENCOUNTER_TABLE)

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

Add these to chat command handler for Phase 1 testing:

```javascript
if (message === "!encounter test table") {
  const { getEncountersByTier, ENCOUNTER_TABLE } = await import("../data/EncounterTable.js");
  player.sendMessage(`§aTotal encounters: ${ENCOUNTER_TABLE.length}`);
  player.sendMessage(`§eRare: ${getEncountersByTier("rare").length}`);
  player.sendMessage(`§6Legendary: ${getEncountersByTier("legendary").length}`);
  return true;
}

if (message === "!encounter test generate rare") {
  const { generateEncounterQuest } = await import("../systems/EncounterManager.js");
  const quest = generateEncounterQuest("rare", player.id, 50, []);
  player.sendMessage(`§aGenerated: ${quest.encounterName}`);
  player.sendMessage(`§7ID: ${quest.id}`);
  player.sendMessage(`§7Mobs: ${quest.totalMobCount}`);
  player.sendMessage(`§7isEncounter: ${quest.isEncounter}`);
  return true;
}

if (message === "!encounter test generate legendary") {
  const { generateEncounterQuest } = await import("../systems/EncounterManager.js");
  const quest = generateEncounterQuest("legendary", player.id, 150, []);
  player.sendMessage(`§6Generated: ${quest.encounterName}`);
  player.sendMessage(`§7ID: ${quest.id}`);
  player.sendMessage(`§7Mobs: ${quest.totalMobCount}`);
  player.sendMessage(`§7isEncounter: ${quest.isEncounter}`);
  return true;
}
```

---

## Rollback Plan

If Phase 1 causes issues:

1. Revert `QuestGenerator.js` to remove encounter routing
2. New files (`EncounterTable.js`, `EncounterManager.js`) can remain — they're not loaded if not imported

The encounter routing is the only integration point. Removing the `if (rarity === "rare" || rarity === "legendary")` block restores original behavior.

---

## Phase 1 Complete When

All validation checklist items pass, specifically:
1. Rare/Legendary quests generate as encounters
2. Quest board displays them correctly
3. Data persists through logout/login
4. Common quests are unaffected

**Do not proceed to Phase 2** until all Phase 1 validations pass.

---

## Notes for Implementation

1. **Reward calculation**: Match existing patterns in `QuestGenerator.js` and `RewardCalculator.js`. The encounter system should use the same SP values currently assigned to Rare (50 SP base) and Legendary (150 SP base) quests.

2. **Mythic tier**: Currently not routed to encounters. This is intentional — Mythic can be added later once the encounter system proves stable.

3. **`structuredClone()`**: Used to deep copy `encounter.mobs`. This prevents accidental mutation of the ENCOUNTER_TABLE if quest data is modified during gameplay.

4. **Fallback behavior**: If `generateEncounterQuest()` returns null (shouldn't happen with valid data), the code falls through to standard quest generation. This is a safety net.
