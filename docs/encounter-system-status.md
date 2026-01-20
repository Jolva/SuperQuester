# Encounter System: Current Implementation Status

**Last Updated:** January 2026
**Current Phase:** 4 of 5 COMPLETE
**Next Phase:** Navigation System (new priority, replacing Phase 5)

---

## Executive Summary

The encounter system is fully functional through Phase 4. Players can accept encounter quests, travel to zones, fight spawned mobs, and the system persists across logout/login. Several significant deviations from the original specification were made during implementation to solve real-world issues discovered during testing.

---

## What's Working Now

### Core Flow (Fully Functional)
1. **Quest Generation** - Rare/Legendary quests generate as encounters
2. **Zone Assignment** - Random zone center 60-200 blocks from quest board
3. **Proximity Detection** - Player entering zone triggers spawn
4. **Mob Spawning** - Mobs spawn 18-22 blocks from player
5. **Kill Tracking** - Deaths attributed via entity tags
6. **Progress Persistence** - Survives logout/login
7. **Turn-in** - Works at quest board, despawns remaining mobs
8. **Abandon** - Despawns mobs, resets state

### State Machine
```
pending → spawned → complete
   ↑         |
   └─────────┘ (abandon resets to pending)
```

### UI Feedback
- **Actionbar** displays persistent objective:
  - Pending: `Zombie Siege | Travel to zone | 45m (120, -300)`
  - Spawned: `Zombie Siege | Kill: 5/14 | 20m away`

---

## Key Deviations from Original Spec

### Spawn Distance Changed
| Original Spec | Actual Implementation | Reason |
|---------------|----------------------|--------|
| 40-60 blocks from player | 18-22 blocks from player | Mobs were dying instantly at 40-60 blocks due to chunk loading edge cases |

### Fire Protection Added (Not in Original Spec)
- **Problem:** Undead mobs (zombies, skeletons, phantoms) burned in sunlight immediately after spawning
- **Solution:** Added `initializeEncounterMobProtection()` that blocks fire/sunlight damage for encounter mobs
- **Design Decision:** Only fire damage is blocked - drowning, lava, fall damage still work so mobs don't get permanently stuck

### UI Simplified
| Original Spec | Actual Implementation | Reason |
|---------------|----------------------|--------|
| Title + Subtitle + Actionbar | Actionbar only | Title/subtitle was too large and obtrusive during gameplay |

### Zone Trigger Unchanged
- Zone trigger radius remains at 50 blocks (player must be within 50 blocks of zone center to trigger spawn)

---

## File Structure

### Core Encounter Files
```
packs/QuestSystemBP/scripts/
├── systems/
│   ├── EncounterSpawner.js      # Spawn, despawn, respawn, fire protection
│   ├── EncounterProximity.js    # Tick-based zone detection, UI display
│   ├── EncounterManager.js      # Quest generation for encounters
│   └── LocationValidator.js     # Zone selection, terrain validation
├── data/
│   └── EncounterTable.js        # Encounter definitions (mob types, counts)
└── main.js                       # Event handlers (playerSpawn, playerLeave, entityDie)
```

### Key Functions by File

#### EncounterSpawner.js
- `spawnEncounterMobs(quest, location, dimension)` - Spawns all mobs for an encounter
- `despawnEncounterMobs(questId, dimension)` - Removes all mobs for a quest
- `respawnRemainingMobs(quest, progress, dimension)` - Respawns after login
- `initializeEncounterMobProtection()` - Sets up fire damage blocking
- `isEncounterMob(entity)` - Checks if entity has encounter tag
- `getQuestIdFromMob(entity)` - Gets quest ID from entity tags

#### EncounterProximity.js
- `startProximityMonitoring()` - Starts tick-based zone checking
- `stopProximityMonitoring()` - Stops monitoring
- Internal: `checkPlayerProximity(player)` - Checks zone entry, shows UI
- Internal: `triggerEncounterSpawn(player, questData)` - Initiates spawn sequence

#### LocationValidator.js
- `selectEncounterZone(tier)` - Picks random zone center in tier ring
- `isPlayerInZone(player, zoneCenter)` - Distance check for trigger
- `findSpawnPointNearPlayer(dimension, player)` - Terrain-validated spawn point
- `getFallbackLocation(tier)` - Pre-scouted backup locations
- `calculateDistance(point1, point2)` - 2D distance calculation
- `getDirection(from, to)` - Cardinal direction string

#### EncounterManager.js
- `generateEncounterQuest(tier)` - Creates complete encounter quest object
- `selectRandomEncounter(tier)` - Picks from EncounterTable

---

## Quest Data Schema

When a player has an active encounter quest, `questData.active` contains:

```javascript
{
  // Standard quest fields
  id: "enc_1234567890_abc123",
  title: "Zombie Siege",
  description: "A massive horde approaches...",
  type: "encounter",
  category: "combat",
  rarity: "legendary",
  requiredCount: 14,
  targets: ["zombie", "husk"],
  reward: {
    scoreboardIncrement: 150,
    rewardItems: [{ typeId: "minecraft:diamond", amount: 3 }]
  },

  // Encounter-specific fields
  isEncounter: true,
  encounterId: "zombie_siege",
  encounterName: "Zombie Siege",
  encounterMobs: [
    { type: "minecraft:zombie", count: 10, equipment: null, nameTag: null },
    { type: "minecraft:husk", count: 4, equipment: null, nameTag: null }
  ],
  totalMobCount: 14,

  // State machine
  encounterState: "spawned",  // "pending" | "spawned" | "complete"

  // Zone data (set on accept)
  encounterZone: {
    center: { x: 150, y: 65, z: -300 },
    radius: 50,
    tier: "legendary"
  },

  // Spawn data (set when mobs spawn, null if pending)
  spawnData: {
    location: { x: 145, y: 68, z: -295 },
    spawnedEntityIds: ["entity_1", "entity_2", ...],
    dimensionId: "overworld"
  }
}
```

---

## Tagging System

Every encounter mob gets TWO tags:
1. `sq_encounter_mob` - Universal marker for filtering
2. `sq_quest_<questId>` - Links to specific quest (e.g., `sq_quest_enc_1234567890_abc123`)

### Tag Usage
- **Fire protection:** Checks `sq_encounter_mob` tag
- **Kill attribution:** Extracts quest ID from `sq_quest_*` tag
- **Despawn:** Queries by `sq_quest_<questId>` tag
- **Mob counting:** Queries by `sq_quest_<questId>` tag

---

## Current Encounter Definitions

### Rare Tier (3-6 mobs)
| ID | Name | Mobs | Total |
|----|------|------|-------|
| skeleton_warband | Skeleton Warband | 5 skeletons | 5 |
| zombie_pack | Shambling Horde | 6 zombies | 6 |
| spider_nest | Spider Nest | 4 spiders, 2 cave spiders | 6 |
| creeper_cluster | Creeper Problem | 3 creepers | 3 |

### Legendary Tier (6-14 mobs)
| ID | Name | Mobs | Total |
|----|------|------|-------|
| skeleton_legion | Skeleton Legion | 8 skeletons, 3 strays (named "Frost Archer") | 11 |
| zombie_siege | Zombie Siege | 10 zombies, 4 husks | 14 |
| phantom_swarm | Phantom Swarm | 6 phantoms | 6 |
| witch_coven | Witch Coven | 3 witches, 4 zombie villagers (named "Cursed Villager") | 7 |

---

## World Layout Context

### Key Locations
- **Quest Board:** `(72, 75, -278)` - Center of town hub
- **Hub Spawn:** `(72, 78, -278)` - Where players teleport on join
- **Safe Zone:** 20-block radius around quest board (hostile mobs auto-removed)

### Zone Distances from Quest Board
- **Rare encounters:** 60-120 blocks away
- **Legendary encounters:** 100-200 blocks away
- **Zone trigger radius:** 50 blocks (player must get within 50 blocks of zone center)

### Spawn Distance from Player
- **When triggered:** Mobs spawn 18-22 blocks from player position
- **Terrain validation:** Checks for solid ground, air above, no water/lava

---

## Navigation Context for Next Phase

### Current Navigation (Minimal)
- Actionbar shows distance and coordinates: `45m (120, -300)`
- No waypoints, particles, or compass integration
- Player must manually navigate using coordinates

### Challenges for Navigation System
1. **Zone is a point, not the mobs** - Zone center is assigned on accept, but mobs spawn at a different location when player arrives
2. **Two navigation targets:**
   - Pending state: Navigate to zone center (trigger spawn)
   - Spawned state: Navigate to mob spawn location
3. **Distance calculation** - Currently 2D only (ignores Y), which works for overworld but may confuse in hilly terrain
4. **No minimap** - Bedrock doesn't have F3 coordinates by default, relies on coordinate display setting

### Potential Navigation Features
- Particle trail pointing toward objective
- Compass that points to zone/mobs
- Periodic chat messages with direction ("Head northeast")
- Sound cues when getting closer/further
- Integration with Bedrock's locator maps (if possible)

### Available Data for Navigation
```javascript
// In EncounterProximity.js checkPlayerProximity():
const playerLoc = player.location;  // { x, y, z }
const zone = quest.encounterZone;   // { center: {x, y, z}, radius, tier }
const spawnLoc = quest.spawnData?.location;  // { x, y, z } or null if pending

// Calculated:
const distance = calculateDistance(playerLoc, targetLoc);  // 2D distance
const direction = getDirection(playerLoc, targetLoc);  // "north", "southeast", etc.
```

---

## Testing Commands

All commands use `!encounter` prefix:

| Command | Description |
|---------|-------------|
| `!encounter` or `/scriptevent sq:encounter` | Show active encounter info |
| `!encounter zone info` | Show zone center and state |
| `!encounter count` | Count alive mobs for current quest |
| `!encounter test logout` | Simulate logout (despawn mobs) |
| `!encounter test login` | Simulate login (respawn mobs) |
| `!encounter test generate rare` | Generate test rare encounter |
| `!encounter test generate legendary` | Generate test legendary encounter |
| `!encounter tp zone` | Teleport to zone center |

---

## Known Issues / Future Considerations

1. **Witch Coven spawns zombie villagers that burn** - Zombie villagers are sunlight-sensitive but not in our protection list (witches throw potions that spawn them, those aren't tagged)

2. **Phantoms fly away** - Phantom Swarm mobs may fly far from spawn point, making them hard to find

3. **No orphan cleanup** - If server crashes with spawned mobs, they persist until manually removed (Phase 5 was supposed to address this)

4. **Single-player focused** - Current logout handler despawns ALL encounter mobs, not just the leaving player's mobs (fine for single player, problematic for multiplayer)

---

## Phase 5 (Original Plan - Now Deprioritized)

The original Phase 5 was:
- Orphan mob cleanup on server start
- Full abandon flow validation
- Edge case hardening

This is being replaced with **Navigation System** as the next priority based on user feedback that finding the encounter zone is the main pain point.
