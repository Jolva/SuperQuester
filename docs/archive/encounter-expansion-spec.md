# Super Quester: Encounter Expansion Spec

## Overview

This document contains a complete set of **25 encounters** across **5 thematic packs**, distributed across Rare, Legendary, and Mythic tiers. It also includes implementation instructions for integrating these into the existing encounter system.

**Goal:** Transform encounters from placeholder content into memorable, thematic combat scenarios that make Rare/Legendary/Mythic quests feel dramatically different from Common quests.

---

## Tier Design Philosophy

| Tier | Mob Count | Composition | Named Mobs | Frequency |
|------|-----------|-------------|------------|-----------|
| Rare | 3-6 | Usually single type or simple pair | 0-1 | 22% of quests |
| Legendary | 7-14 | Mixed types, tactical variety | 1-2 | 7% of quests |
| Mythic | 10-20 | Complex compositions, multiple elites | 2-4 | 1% of quests |

---

## Theme 1: Undead Horde (5 Encounters)

*The dead refuse to stay buried. From shambling corpses to organized skeletal legions, these encounters test raw combat endurance.*

### Rare: Gravedigger's Mistake
```javascript
{
  id: "gravediggers_mistake",
  name: "Gravedigger's Mistake",
  description: "Something was disturbed that should have stayed buried.",
  tier: "rare",
  mobs: [
    { type: "minecraft:zombie", count: 4, equipment: null, nameTag: null },
    { type: "minecraft:zombie_villager", count: 1, equipment: null, nameTag: "The First Risen" }
  ],
  totalMobCount: 5
}
```

### Rare: Bone Collectors
```javascript
{
  id: "bone_collectors",
  name: "Bone Collectors",
  description: "Skeletons patrol the area, gathering remains for unknown purposes.",
  tier: "rare",
  mobs: [
    { type: "minecraft:skeleton", count: 4, equipment: null, nameTag: null }
  ],
  totalMobCount: 4
}
```

### Legendary: The Restless Battalion
```javascript
{
  id: "restless_battalion",
  name: "The Restless Battalion",
  description: "An entire unit of fallen soldiers marches again under a deathless commander.",
  tier: "legendary",
  mobs: [
    { type: "minecraft:skeleton", count: 6, equipment: null, nameTag: null },
    { type: "minecraft:stray", count: 3, equipment: null, nameTag: null },
    { type: "minecraft:skeleton", count: 1, equipment: null, nameTag: "Captain Ashford" }
  ],
  totalMobCount: 10
}
```

### Legendary: Drowned Expedition
```javascript
{
  id: "drowned_expedition",
  name: "Drowned Expedition",
  description: "A doomed expedition has returned from the depths, waterlogged and hungry.",
  tier: "legendary",
  mobs: [
    { type: "minecraft:drowned", count: 8, equipment: null, nameTag: null },
    { type: "minecraft:drowned", count: 1, equipment: null, nameTag: "Captain Tidewalker" }
  ],
  totalMobCount: 9
}
```

### Mythic: The Bone Sovereign
```javascript
{
  id: "bone_sovereign",
  name: "The Bone Sovereign",
  description: "A lord of the undead has claimed this land. Their legion answers only to them.",
  tier: "mythic",
  mobs: [
    { type: "minecraft:skeleton", count: 8, equipment: null, nameTag: null },
    { type: "minecraft:stray", count: 4, equipment: null, nameTag: "Frozen Honor Guard" },
    { type: "minecraft:wither_skeleton", count: 2, equipment: null, nameTag: "Ashen Champion" },
    { type: "minecraft:skeleton", count: 1, equipment: null, nameTag: "The Bone Sovereign" }
  ],
  totalMobCount: 15
}
```

---

## Theme 2: Arachnid Infestation (4 Encounters)

*Eight-legged horrors emerge from the darkness. Fast, numerous, and terrifying in tight spaces.*

### Rare: Webspinner Den
```javascript
{
  id: "webspinner_den",
  name: "Webspinner Den",
  description: "The webs grow thick here. You are not alone.",
  tier: "rare",
  mobs: [
    { type: "minecraft:spider", count: 5, equipment: null, nameTag: null }
  ],
  totalMobCount: 5
}
```

### Rare: Venomous Outcrop
```javascript
{
  id: "venomous_outcrop",
  name: "Venomous Outcrop",
  description: "Cave spiders have spilled out from underground. Their bite burns.",
  tier: "rare",
  mobs: [
    { type: "minecraft:cave_spider", count: 4, equipment: null, nameTag: null }
  ],
  totalMobCount: 4
}
```

### Legendary: The Broodmother's Children
```javascript
{
  id: "broodmother_children",
  name: "The Broodmother's Children",
  description: "A massive nest has hatched. The broodmother watches from the center.",
  tier: "legendary",
  mobs: [
    { type: "minecraft:spider", count: 6, equipment: null, nameTag: null },
    { type: "minecraft:cave_spider", count: 4, equipment: null, nameTag: null },
    { type: "minecraft:spider", count: 1, equipment: null, nameTag: "The Broodmother" }
  ],
  totalMobCount: 11
}
```

### Mythic: Arachnid Apocalypse
```javascript
{
  id: "arachnid_apocalypse",
  name: "Arachnid Apocalypse",
  description: "The spider queens have united. Nowhere is safe from their crawling legions.",
  tier: "mythic",
  mobs: [
    { type: "minecraft:spider", count: 8, equipment: null, nameTag: null },
    { type: "minecraft:cave_spider", count: 6, equipment: null, nameTag: null },
    { type: "minecraft:spider", count: 2, equipment: null, nameTag: "Silk Matriarch" },
    { type: "minecraft:cave_spider", count: 1, equipment: null, nameTag: "The Venom Queen" }
  ],
  totalMobCount: 17
}
```

---

## Theme 3: Illager Threat (6 Encounters)

*The outcast villagers strike back. Organized, armed, and backed by dark magic.*

### Rare: Pillager Scouts
```javascript
{
  id: "pillager_scouts",
  name: "Pillager Scouts",
  description: "A pillager scouting party probes our defenses.",
  tier: "rare",
  mobs: [
    { type: "minecraft:pillager", count: 4, equipment: null, nameTag: null }
  ],
  totalMobCount: 4
}
```

### Rare: Outcast War Party
```javascript
{
  id: "outcast_war_party",
  name: "Outcast War Party",
  description: "Vindicators sharpen their axes. They've come for blood.",
  tier: "rare",
  mobs: [
    { type: "minecraft:vindicator", count: 3, equipment: null, nameTag: null }
  ],
  totalMobCount: 3
}
```

### Legendary: Raiding Party
```javascript
{
  id: "raiding_party",
  name: "Raiding Party",
  description: "A full illager raiding party approaches. Archers and axemen work as one.",
  tier: "legendary",
  mobs: [
    { type: "minecraft:pillager", count: 5, equipment: null, nameTag: null },
    { type: "minecraft:vindicator", count: 3, equipment: null, nameTag: null },
    { type: "minecraft:pillager", count: 1, equipment: null, nameTag: "Raid Captain" }
  ],
  totalMobCount: 9
}
```

### Legendary: Dark Ritual
```javascript
{
  id: "dark_ritual",
  name: "Dark Ritual",
  description: "An evoker conducts a forbidden ceremony. Vexes swirl in anticipation.",
  tier: "legendary",
  mobs: [
    { type: "minecraft:evoker", count: 1, equipment: null, nameTag: "The Ritualist" },
    { type: "minecraft:vex", count: 4, equipment: null, nameTag: null },
    { type: "minecraft:vindicator", count: 3, equipment: null, nameTag: "Ritual Guardian" }
  ],
  totalMobCount: 8
}
```

### Mythic: The Gray Horde
```javascript
{
  id: "gray_horde",
  name: "The Gray Horde",
  description: "The illager clans have united under one banner. This is war.",
  tier: "mythic",
  mobs: [
    { type: "minecraft:pillager", count: 6, equipment: null, nameTag: null },
    { type: "minecraft:vindicator", count: 4, equipment: null, nameTag: null },
    { type: "minecraft:evoker", count: 2, equipment: null, nameTag: "Horde Warlock" },
    { type: "minecraft:ravager", count: 1, equipment: null, nameTag: "Siege Beast" },
    { type: "minecraft:pillager", count: 1, equipment: null, nameTag: "Warlord Grim" }
  ],
  totalMobCount: 14
}
```

### Mythic: Mansion Breakout
```javascript
{
  id: "mansion_breakout",
  name: "Mansion Breakout",
  description: "The woodland mansion's elite guard has mobilized. Evokers lead the charge.",
  tier: "mythic",
  mobs: [
    { type: "minecraft:vindicator", count: 6, equipment: null, nameTag: null },
    { type: "minecraft:evoker", count: 3, equipment: null, nameTag: null },
    { type: "minecraft:vex", count: 6, equipment: null, nameTag: null },
    { type: "minecraft:evoker", count: 1, equipment: null, nameTag: "The Arch-Evoker" }
  ],
  totalMobCount: 16
}
```

---

## Theme 4: Nether Breach (5 Encounters)

*The barrier between dimensions weakens. Fire and fury spill into the overworld.*

### Rare: Piglin Trespassers
```javascript
{
  id: "piglin_trespassers",
  name: "Piglin Trespassers",
  description: "Piglins have crossed over, seeking gold. They found you instead.",
  tier: "rare",
  mobs: [
    { type: "minecraft:piglin", count: 4, equipment: null, nameTag: null }
  ],
  totalMobCount: 4
}
```

### Rare: Magma Flow
```javascript
{
  id: "magma_flow",
  name: "Magma Flow",
  description: "Magma cubes bubble up from a dimensional rift.",
  tier: "rare",
  mobs: [
    { type: "minecraft:magma_cube", count: 5, equipment: null, nameTag: null }
  ],
  totalMobCount: 5
}
```

### Legendary: Blaze Patrol
```javascript
{
  id: "blaze_patrol",
  name: "Blaze Patrol",
  description: "Blazes drift through a tear in reality, scorching everything nearby.",
  tier: "legendary",
  mobs: [
    { type: "minecraft:blaze", count: 5, equipment: null, nameTag: null },
    { type: "minecraft:blaze", count: 1, equipment: null, nameTag: "Inferno Sentinel" }
  ],
  totalMobCount: 6
}
```

### Legendary: Bastion Vanguard
```javascript
{
  id: "bastion_vanguard",
  name: "Bastion Vanguard",
  description: "The bastion's warriors have arrived. Brutes lead the charge.",
  tier: "legendary",
  mobs: [
    { type: "minecraft:piglin", count: 5, equipment: null, nameTag: null },
    { type: "minecraft:piglin_brute", count: 2, equipment: null, nameTag: null },
    { type: "minecraft:hoglin", count: 2, equipment: null, nameTag: null }
  ],
  totalMobCount: 9
}
```

### Mythic: Hell's Army
```javascript
{
  id: "hells_army",
  name: "Hell's Army",
  description: "The Nether lords marshal their forces. Fire rains from the sky.",
  tier: "mythic",
  mobs: [
    { type: "minecraft:blaze", count: 4, equipment: null, nameTag: null },
    { type: "minecraft:piglin_brute", count: 4, equipment: null, nameTag: "Nether Guard" },
    { type: "minecraft:hoglin", count: 3, equipment: null, nameTag: null },
    { type: "minecraft:magma_cube", count: 4, equipment: null, nameTag: null },
    { type: "minecraft:blaze", count: 1, equipment: null, nameTag: "Infernal Commander" }
  ],
  totalMobCount: 16
}
```

---

## Theme 5: Abominations (5 Encounters)

*Unnatural creatures and cursed beings. These encounters defy categorization.*

### Rare: Creeping Dread
```javascript
{
  id: "creeping_dread",
  name: "Creeping Dread",
  description: "That hissing sound? It's not just one of them.",
  tier: "rare",
  mobs: [
    { type: "minecraft:creeper", count: 4, equipment: null, nameTag: null }
  ],
  totalMobCount: 4
}
```

### Rare: Slime Surge
```javascript
{
  id: "slime_surge",
  name: "Slime Surge",
  description: "A mass of slimes bounces toward you with unsettling purpose.",
  tier: "rare",
  mobs: [
    { type: "minecraft:slime", count: 6, equipment: null, nameTag: null }
  ],
  totalMobCount: 6
}
```

### Legendary: Witch's Bargain
```javascript
{
  id: "witchs_bargain",
  name: "Witch's Bargain",
  description: "A coven gathers to trade in curses. Their victims shamble nearby.",
  tier: "legendary",
  mobs: [
    { type: "minecraft:witch", count: 3, equipment: null, nameTag: null },
    { type: "minecraft:zombie_villager", count: 4, equipment: null, nameTag: "Cursed Soul" },
    { type: "minecraft:witch", count: 1, equipment: null, nameTag: "Coven Mother" }
  ],
  totalMobCount: 8
}
```

### Legendary: Nightmare Flock
```javascript
{
  id: "nightmare_flock",
  name: "Nightmare Flock",
  description: "The sleepless nights have manifested. Phantoms blot out the stars.",
  tier: "legendary",
  mobs: [
    { type: "minecraft:phantom", count: 7, equipment: null, nameTag: null },
    { type: "minecraft:phantom", count: 1, equipment: null, nameTag: "The Sleepless One" }
  ],
  totalMobCount: 8
}
```

### Mythic: The Wither Cult
```javascript
{
  id: "wither_cult",
  name: "The Wither Cult",
  description: "Fanatics of decay gather wither skeletons for a dark summoning. Stop them before it's too late.",
  tier: "mythic",
  mobs: [
    { type: "minecraft:wither_skeleton", count: 5, equipment: null, nameTag: null },
    { type: "minecraft:witch", count: 3, equipment: null, nameTag: "Cult Alchemist" },
    { type: "minecraft:zombie_villager", count: 4, equipment: null, nameTag: "Cult Thrall" },
    { type: "minecraft:wither_skeleton", count: 1, equipment: null, nameTag: "Herald of Withering" }
  ],
  totalMobCount: 13
}
```

---

## Implementation Checklist for Claude Code

### Step 1: Update EncounterTable.js

Replace the existing `ENCOUNTER_TABLE` array with the 25 encounters above. Keep the helper functions (`getEncountersByTier`, `getEncounterById`) unchanged.

**File location:** `data/EncounterTable.js`

**Verification:**
- [ ] `getEncountersByTier("rare")` returns 10 encounters
- [ ] `getEncountersByTier("legendary")` returns 10 encounters
- [ ] `getEncountersByTier("mythic")` returns 5 encounters

### Step 2: Add Mythic Tier Routing

**File:** `logic/QuestGenerator.js`

**Current behavior (lines ~80-95):** Mythic tier falls through to standard quest generation.

**Required change:** Route Mythic to encounter system alongside Rare and Legendary.

```javascript
// BEFORE:
if (rarity === "rare" || rarity === "legendary") {

// AFTER:
if (rarity === "rare" || rarity === "legendary" || rarity === "mythic") {
```

**Verification:**
- [ ] Rolling a Mythic quest returns an encounter quest (isEncounter: true)
- [ ] Mythic encounters have the mythic-tier SP rewards applied

### Step 3: Verify Mob Type IDs

All mob type IDs used must be valid Bedrock entity IDs. Test spawn each mob type:

```javascript
// Test in-game or via script:
dimension.spawnEntity("minecraft:pillager", location);
dimension.spawnEntity("minecraft:vindicator", location);
dimension.spawnEntity("minecraft:evoker", location);
dimension.spawnEntity("minecraft:vex", location);
dimension.spawnEntity("minecraft:ravager", location);
dimension.spawnEntity("minecraft:piglin", location);
dimension.spawnEntity("minecraft:piglin_brute", location);
dimension.spawnEntity("minecraft:hoglin", location);
dimension.spawnEntity("minecraft:blaze", location);
dimension.spawnEntity("minecraft:magma_cube", location);
dimension.spawnEntity("minecraft:wither_skeleton", location);
dimension.spawnEntity("minecraft:phantom", location);
dimension.spawnEntity("minecraft:slime", location);
```

**Known considerations:**
- Piglins may convert to zombified piglins in the overworld (expected, adds chaos)
- Hoglins may convert to zoglins in the overworld (expected, adds chaos)
- Vex will despawn after some time if not killed (intended behavior)
- Phantoms spawn at night only by default, but direct spawning should work anytime

### Step 4: Test Spawning at Scale

For Mythic encounters (13-17 mobs), verify:
- [ ] All mobs spawn within the variance radius
- [ ] Named mobs receive their nameTag correctly
- [ ] Fire resistance is applied to undead types
- [ ] Kill tracking increments correctly for all mob types

### Step 5: Update mobTypes.js (if needed)

The `getMobType()` function maps variant mobs to base types for quest tracking. Verify these mappings exist or add them:

```javascript
// Should already exist:
// - piglin family (piglin, piglin_brute, zombified_piglin) → "piglin"
// - illager family (pillager, vindicator, evoker, ravager) → "illager"

// May need to add:
// - vex → "vex" (or consider mapping to "illager" if you want evoker quests to count vex kills)
// - hoglin → "hoglin"
// - blaze → "blaze"
// - magma_cube → "slime" (already mapped?)
// - wither_skeleton → "skeleton" (verify this mapping)
```

---

## Encounter Summary Table

| ID | Name | Tier | Mobs | Total |
|----|------|------|------|-------|
| gravediggers_mistake | Gravedigger's Mistake | Rare | 4 zombie + 1 named | 5 |
| bone_collectors | Bone Collectors | Rare | 4 skeleton | 4 |
| restless_battalion | The Restless Battalion | Legendary | 6 skeleton + 3 stray + 1 named | 10 |
| drowned_expedition | Drowned Expedition | Legendary | 8 drowned + 1 named | 9 |
| bone_sovereign | The Bone Sovereign | Mythic | 8 skeleton + 4 stray + 2 wither_skel + 1 named | 15 |
| webspinner_den | Webspinner Den | Rare | 5 spider | 5 |
| venomous_outcrop | Venomous Outcrop | Rare | 4 cave_spider | 4 |
| broodmother_children | The Broodmother's Children | Legendary | 6 spider + 4 cave_spider + 1 named | 11 |
| arachnid_apocalypse | Arachnid Apocalypse | Mythic | 8 spider + 6 cave_spider + 3 named | 17 |
| pillager_scouts | Pillager Scouts | Rare | 4 pillager | 4 |
| outcast_war_party | Outcast War Party | Rare | 3 vindicator | 3 |
| raiding_party | Raiding Party | Legendary | 5 pillager + 3 vindicator + 1 named | 9 |
| dark_ritual | Dark Ritual | Legendary | 1 evoker + 4 vex + 3 vindicator | 8 |
| gray_horde | The Gray Horde | Mythic | 6 pillager + 4 vind + 2 evoker + 1 ravager + 1 named | 14 |
| mansion_breakout | Mansion Breakout | Mythic | 6 vindicator + 3 evoker + 6 vex + 1 named | 16 |
| piglin_trespassers | Piglin Trespassers | Rare | 4 piglin | 4 |
| magma_flow | Magma Flow | Rare | 5 magma_cube | 5 |
| blaze_patrol | Blaze Patrol | Legendary | 5 blaze + 1 named | 6 |
| bastion_vanguard | Bastion Vanguard | Legendary | 5 piglin + 2 brute + 2 hoglin | 9 |
| hells_army | Hell's Army | Mythic | 4 blaze + 4 brute + 3 hoglin + 4 magma + 1 named | 16 |
| creeping_dread | Creeping Dread | Rare | 4 creeper | 4 |
| slime_surge | Slime Surge | Rare | 6 slime | 6 |
| witchs_bargain | Witch's Bargain | Legendary | 3 witch + 4 zombie_villager + 1 named | 8 |
| nightmare_flock | Nightmare Flock | Legendary | 7 phantom + 1 named | 8 |
| wither_cult | The Wither Cult | Mythic | 5 wither_skel + 3 witch + 4 zombie_vill + 1 named | 13 |

**Totals:**
- Rare: 10 encounters
- Legendary: 10 encounters  
- Mythic: 5 encounters
- **Grand Total: 25 encounters**

---

## Future Considerations

Once this is stable, consider:

1. **Equipment support:** The schema has `equipment: null` — could add armor/weapons to elite mobs
2. **Spawn effects:** Particles or sounds when encounter spawns
3. **Biome restrictions:** Certain encounters only spawn in matching biomes
4. **Seasonal rotations:** Swap encounter packs for holidays or events
