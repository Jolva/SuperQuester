# Super Quester: Encounter System — Phase 5 Implementation (Revised)

**Phase:** 5 of 5
**Focus:** Navigation Enhancement + Orphan Cleanup
**Branch:** `feature/encounter-system`
**Prerequisite:** Phase 4 complete and validated
**Validates:** Directional compass, sky beacon, orphan cleanup

---

## Objective

Enhance navigation so players can actually find their encounters without squinting at coordinates. The current actionbar shows distance and coordinates — we're adding a directional arrow and a sky beacon.

By the end of this phase:
- Actionbar shows directional arrow that updates as player rotates
- Sky beacon particle column appears when player is within 150 blocks
- Orphan mobs cleaned up on server start

---

## Current State (What Exists)

### Existing Actionbar Display (in EncounterProximity.js)
```
Pending:  Zombie Siege | Travel to zone | 45m (120, -300)
Spawned:  Zombie Siege | Kill: 5/14 | 20m away
```

### What We're Changing
```
Pending:  Zombie Siege | Travel to zone | ↗ 45m
Spawned:  Zombie Siege | Kill: 5/14 | ↗ 20m
```

The arrow rotates based on player facing vs target direction. Coordinates are removed (arrow makes them redundant).

---

## Navigation Targets by State

| State | Navigate To | Data Source |
|-------|-------------|-------------|
| `pending` | Zone center | `quest.encounterZone.center` |
| `spawned` | Mob spawn location | `quest.spawnData.location` |
| `complete` | N/A (no navigation) | — |

---

## Files to Modify

### 1. `EncounterProximity.js` — Add Directional Arrow

**Add these constants at the top:**

```javascript
// === NAVIGATION CONSTANTS ===

// Arrow characters for 8 directions
const DIRECTION_ARROWS = {
  N:  "↑",
  NE: "↗",
  E:  "→",
  SE: "↘",
  S:  "↓",
  SW: "↙",
  W:  "←",
  NW: "↖"
};

// Beacon configuration
const BEACON_ACTIVATION_DISTANCE = 150;
const BEACON_PULSE_INTERVAL = 40;  // ticks (2 seconds)
const BEACON_HEIGHT = 50;
const BEACON_PARTICLE_COUNT = 30;

let beaconTickCounter = 0;
```

**Add this function to calculate directional arrow:**

```javascript
/**
 * Get directional arrow based on player facing vs target direction
 * @param {Player} player - The player
 * @param {{x: number, z: number}} target - Target location
 * @returns {string} Arrow character
 */
function getDirectionArrow(player, target) {
  const playerPos = player.location;
  
  // Angle from player to target (world space)
  // Minecraft: -Z is north, +X is east
  const dx = target.x - playerPos.x;
  const dz = target.z - playerPos.z;
  const targetAngle = Math.atan2(-dx, -dz) * (180 / Math.PI);
  
  // Player's facing direction (yaw)
  const playerRotation = player.getRotation();
  const playerYaw = playerRotation.y;
  
  // Relative angle (how far target is from where player is looking)
  let relativeAngle = targetAngle - playerYaw;
  
  // Normalize to -180 to 180
  while (relativeAngle > 180) relativeAngle -= 360;
  while (relativeAngle < -180) relativeAngle += 360;
  
  // Convert to 8-direction arrow
  // 0° = ahead, positive = right, negative = left
  if (relativeAngle >= -22.5 && relativeAngle < 22.5) return DIRECTION_ARROWS.N;
  if (relativeAngle >= 22.5 && relativeAngle < 67.5) return DIRECTION_ARROWS.NE;
  if (relativeAngle >= 67.5 && relativeAngle < 112.5) return DIRECTION_ARROWS.E;
  if (relativeAngle >= 112.5 && relativeAngle < 157.5) return DIRECTION_ARROWS.SE;
  if (relativeAngle >= 157.5 || relativeAngle < -157.5) return DIRECTION_ARROWS.S;
  if (relativeAngle >= -157.5 && relativeAngle < -112.5) return DIRECTION_ARROWS.SW;
  if (relativeAngle >= -112.5 && relativeAngle < -67.5) return DIRECTION_ARROWS.W;
  if (relativeAngle >= -67.5 && relativeAngle < -22.5) return DIRECTION_ARROWS.NW;
  
  return DIRECTION_ARROWS.N;  // Fallback
}
```

**Add beacon pulse function:**

```javascript
/**
 * Spawn a vertical column of particles at the target location
 * @param {Dimension} dimension - Minecraft dimension
 * @param {{x: number, y: number, z: number}} target - Target location
 */
function spawnBeaconParticles(dimension, target) {
  try {
    // Get actual ground level at target
    const topBlock = dimension.getTopmostBlock({ x: target.x, z: target.z });
    const groundY = topBlock ? topBlock.y + 1 : target.y;
    
    // Spawn particles in a vertical column
    for (let i = 0; i < BEACON_PARTICLE_COUNT; i++) {
      const y = groundY + (i * (BEACON_HEIGHT / BEACON_PARTICLE_COUNT));
      
      // Small XZ variance for visual interest
      const variance = {
        x: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.5
      };
      
      dimension.spawnParticle(
        "minecraft:endrod",
        {
          x: target.x + variance.x,
          y: y,
          z: target.z + variance.z
        }
      );
    }
  } catch (error) {
    // Chunk may not be loaded - that's fine
  }
}
```

**Modify the existing actionbar display logic:**

Find where the actionbar text is currently built and replace with:

```javascript
/**
 * Update actionbar display for a player with an active encounter
 * @param {Player} player - The player
 * @param {Object} questData - Player's quest data
 */
function updateEncounterActionbar(player, questData) {
  const quest = questData.active;
  const progress = questData.progress || 0;
  
  // Determine navigation target based on state
  let target = null;
  let actionbarText = "";
  
  if (quest.encounterState === "pending") {
    // Navigate to zone center
    target = quest.encounterZone.center;
    const distance = Math.floor(calculateDistance(player.location, target));
    const arrow = getDirectionArrow(player, target);
    
    actionbarText = `§e${quest.encounterName} §7| §fTravel to zone §7| §e${arrow} §f${distance}m`;
    
  } else if (quest.encounterState === "spawned") {
    // Navigate to mob spawn location
    target = quest.spawnData?.location;
    
    if (target) {
      const distance = Math.floor(calculateDistance(player.location, target));
      const arrow = getDirectionArrow(player, target);
      
      actionbarText = `§e${quest.encounterName} §7| §fKill: §a${progress}§f/§c${quest.totalMobCount} §7| §e${arrow} §f${distance}m`;
    } else {
      // Fallback if no spawn location
      actionbarText = `§e${quest.encounterName} §7| §fKill: §a${progress}§f/§c${quest.totalMobCount}`;
    }
    
  } else if (quest.encounterState === "complete") {
    // No navigation needed
    actionbarText = `§a${quest.encounterName} §7| §6COMPLETE! §7| §fReturn to board`;
  }
  
  // Display actionbar
  player.onScreenDisplay.setActionBar(actionbarText);
  
  // Handle beacon (only for pending/spawned, and only if close enough)
  if (target && quest.encounterState !== "complete") {
    const distance = calculateDistance(player.location, target);
    
    if (distance <= BEACON_ACTIVATION_DISTANCE) {
      // Pulse beacon (handled by tick counter in main loop)
      if (beaconTickCounter === 0) {
        spawnBeaconParticles(player.dimension, target);
      }
    }
  }
}
```

**Modify the main tick loop to handle beacon timing:**

In `startProximityMonitoring()`, add beacon counter:

```javascript
export function startProximityMonitoring() {
  if (isRunning) return;
  
  isRunning = true;
  console.log("[EncounterProximity] Started proximity monitoring");
  
  system.runInterval(async () => {
    // Increment beacon counter
    beaconTickCounter++;
    if (beaconTickCounter >= BEACON_PULSE_INTERVAL) {
      beaconTickCounter = 0;
    }
    
    // Existing proximity check logic
    for (const player of world.getPlayers()) {
      try {
        await checkPlayerProximity(player);
      } catch (error) {
        // Silently fail
      }
    }
  }, CHECK_INTERVAL);  // Use existing CHECK_INTERVAL
}
```

**Ensure `checkPlayerProximity` calls the new actionbar function:**

```javascript
async function checkPlayerProximity(player) {
  const questData = await PersistenceManager.loadQuestData(player);
  
  if (!questData?.active?.isEncounter) return;
  
  const quest = questData.active;
  
  // Always update actionbar with navigation
  updateEncounterActionbar(player, questData);
  
  // Check for zone entry (only if pending)
  if (quest.encounterState === "pending" && quest.encounterZone) {
    if (isPlayerInZone(player, quest.encounterZone.center)) {
      await triggerEncounterSpawn(player, questData);
    }
  }
}
```

---

### 2. `EncounterSpawner.js` — Add Orphan Cleanup

**Add this function:**

```javascript
/**
 * Clean up orphaned encounter mobs on server start
 * Catches mobs left behind from crashes or incomplete cleanup
 * @returns {Promise<number>} Number of mobs cleaned up
 */
export async function cleanupOrphanedMobs() {
  const dimension = world.getDimension("overworld");
  let cleanedCount = 0;
  
  try {
    // Find all entities with encounter mob tag
    const entities = dimension.getEntities({
      tags: [TAG_ENCOUNTER_MOB]
    });
    
    for (const entity of entities) {
      const questTag = entity.getTags().find(tag => tag.startsWith(TAG_QUEST_PREFIX));
      
      if (!questTag) {
        // No quest tag - definitely orphaned
        entity.remove();
        cleanedCount++;
        continue;
      }
      
      const questId = questTag.replace(TAG_QUEST_PREFIX, "");
      
      // Check if any online player owns this quest in spawned state
      let questFound = false;
      for (const player of world.getPlayers()) {
        try {
          const questData = await PersistenceManager.loadQuestData(player);
          if (questData?.active?.id === questId && 
              questData.active.encounterState === "spawned") {
            questFound = true;
            break;
          }
        } catch {
          continue;
        }
      }
      
      if (!questFound) {
        // No active quest matches - orphaned
        entity.remove();
        cleanedCount++;
      }
    }
  } catch (error) {
    console.error(`[EncounterSpawner] Error during orphan cleanup: ${error}`);
  }
  
  if (cleanedCount > 0) {
    console.warn(`[EncounterSpawner] Cleaned up ${cleanedCount} orphaned encounter mobs`);
  }
  
  return cleanedCount;
}
```

**Ensure constants are accessible:**
```javascript
const TAG_ENCOUNTER_MOB = "sq_encounter_mob";
const TAG_QUEST_PREFIX = "sq_quest_";
```

---

### 3. `main.js` — Run Orphan Cleanup on World Init

**Add import:**
```javascript
import { cleanupOrphanedMobs } from "./systems/EncounterSpawner.js";
```

**Add to world initialization:**
```javascript
world.afterEvents.worldInitialize.subscribe(async () => {
  // ... existing init code ...
  
  // Clean up any orphaned mobs from crashes
  await cleanupOrphanedMobs();
  
  // ... start encounter systems ...
});
```

---

## Validation Checklist

### Directional Arrow
- [ ] Arrow appears in actionbar for pending encounters
- [ ] Arrow appears in actionbar for spawned encounters
- [ ] Arrow points toward zone center when pending
- [ ] Arrow points toward spawn location when spawned
- [ ] Arrow updates as player rotates (within tick interval)
- [ ] All 8 arrow directions work correctly (↑ ↗ → ↘ ↓ ↙ ← ↖)
- [ ] No arrow for complete state (just "Return to board")

### Actionbar Format
- [ ] Pending: `Zombie Siege | Travel to zone | ↗ 45m`
- [ ] Spawned: `Zombie Siege | Kill: 5/14 | ↗ 20m`
- [ ] Complete: `Zombie Siege | COMPLETE! | Return to board`
- [ ] Colors are readable (§e yellow, §7 gray, §f white, §a green, §c red, §6 gold)

### Sky Beacon
- [ ] No beacon when far from target (>150 blocks)
- [ ] Beacon particles appear when within 150 blocks
- [ ] Beacon pulses every ~2 seconds
- [ ] Beacon visible from ground level
- [ ] Beacon at correct location (zone center for pending, spawn location for spawned)
- [ ] Beacon stops when encounter completes

### Orphan Cleanup
- [ ] Server start removes mobs with no matching active quest
- [ ] Server start preserves mobs with matching active quest
- [ ] Console logs cleanup count
- [ ] Cleanup handles edge cases (no quest tag, etc.)

### State Transitions
- [ ] Accept quest → arrow points to zone center
- [ ] Enter zone → mobs spawn → arrow switches to spawn location
- [ ] Kill all mobs → "COMPLETE!" message, no arrow
- [ ] Logout/login → navigation resumes correctly

### Edge Cases
- [ ] Phantoms fly away → arrow still points to original spawn location (player can track back)
- [ ] Player in cave → beacon particles may not be visible (expected)
- [ ] Multiple players → each sees their own navigation

---

## Testing Commands

```javascript
if (message === "!nav test arrow") {
  const questData = await PersistenceManager.loadQuestData(player);
  
  if (questData?.active?.isEncounter) {
    const quest = questData.active;
    let target = quest.encounterState === "pending" 
      ? quest.encounterZone?.center 
      : quest.spawnData?.location;
    
    if (target) {
      const arrow = getDirectionArrow(player, target);
      const distance = Math.floor(calculateDistance(player.location, target));
      player.sendMessage(`§eArrow: ${arrow} | Distance: ${distance}m`);
      player.sendMessage(`§7Target: ${target.x}, ${target.z}`);
      player.sendMessage(`§7Player facing: ${player.getRotation().y.toFixed(1)}°`);
    }
  } else {
    player.sendMessage(`§cNo active encounter`);
  }
  return true;
}

if (message === "!nav test beacon") {
  // Force spawn beacon at 50 blocks in front of player
  const rot = player.getRotation();
  const yawRad = rot.y * (Math.PI / 180);
  const target = {
    x: player.location.x - Math.sin(yawRad) * 50,
    y: player.location.y,
    z: player.location.z + Math.cos(yawRad) * 50
  };
  
  spawnBeaconParticles(player.dimension, target);
  player.sendMessage(`§aBeacon spawned 50 blocks ahead`);
  return true;
}

if (message === "!encounter cleanup") {
  const count = await cleanupOrphanedMobs();
  player.sendMessage(`§aCleaned up ${count} orphaned mobs`);
  return true;
}
```

---

## Rollback Plan

If Phase 5 causes issues:

1. Revert actionbar format to previous version (with coordinates)
2. Remove beacon spawning code
3. Remove orphan cleanup call from world init

Core encounter functionality from Phases 1-4 remains intact.

---

## Phase 5 Complete When

All validation checklist items pass:
1. Directional arrow shows in actionbar, updates with player rotation
2. Beacon pulses when within 150 blocks of target
3. Orphan cleanup runs on server start
4. Navigation switches from zone center to spawn location correctly

---

## Encounter System Complete! 🎉

After Phase 5, the full system includes:
- ✅ Encounter-based quests for Rare/Legendary tiers
- ✅ Ring-based zone assignment
- ✅ Proximity-triggered spawning
- ✅ Fire protection for undead mobs
- ✅ Full logout/login persistence
- ✅ Directional arrow navigation
- ✅ Sky beacon visual landmark
- ✅ Orphan mob cleanup

---

## Known Issues to Address Later

1. **Phantoms fly away** — Arrow points to original spawn, not current mob location. Consider glowing effect or leash mechanic.

2. **Witch Coven zombie villagers burn** — Potions spawn untagged mobs. Could extend fire protection to all mobs near encounter location.

3. **Multiplayer logout** — Current handler despawns all encounter mobs. Need per-player filtering for true multiplayer support.
