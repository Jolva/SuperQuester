# SuperQuester Command Reference

Quick reference guide for all available commands in SuperQuester.

---

## Table of Contents

1. [Player Commands](#player-commands)
2. [Admin Commands](#admin-commands)
3. [Debug Commands](#debug-commands)
4. [Testing Commands](#testing-commands)
5. [Vanilla Minecraft Commands](#vanilla-minecraft-commands)

---

## Player Commands

These commands are available to all players.

### Quest Management

**Open Quest Board**
```
!quests
```
Opens the quest board UI where you can view available quests, accept quests, and manage active quests.

**Alternative:** Right-click the quest board block in the world.

---

**Check Super Points**
```
!sp
```
Displays your current Super Points (SP) balance in chat.

---

## Admin Commands

These commands require admin/operator permissions.

### Super Points Management

**Give Super Points (Self)**
```
/scriptevent sq:givesp <amount>
```
Give yourself a specific amount of SP.

**Examples:**
```
/scriptevent sq:givesp 500       # Give yourself 500 SP
/scriptevent sq:givesp 1000      # Give yourself 1000 SP
```

---

**Give Super Points (Other Player)**
```
/scriptevent sq:givesp <amount> <playerName>
```
Give SP to another player.

**Examples:**
```
/scriptevent sq:givesp 1000 PlayerName    # Give PlayerName 1000 SP
/scriptevent sq:givesp 500 Steve          # Give Steve 500 SP
```

---

### Builder Mode

**Toggle Builder Mode**
```
!builder
```
Toggles creative mode and flying for the player. Used for world building and testing.

---

### Quest System Admin

**Force Daily Refresh**
```
!forcedaily
```
Forces the daily quest refresh, generating new quests in all available slots.

**Use Case:** Testing quest generation without waiting 24 hours.

---

**Register Player Names**
```
!registernames
```
Registers all online player names to the persistent registry.

**Use Case:** Fixes "Unknown Player" issue on leaderboards when players join for the first time.

---

## Debug Commands

### Encounter System Debug

All encounter debug commands use the `/scriptevent sq:encounter` pattern.

**Show Active Encounter Info**
```
/scriptevent sq:encounter info
```
Displays details about your currently active encounter quest:
- Encounter name
- Quest ID
- Progress (kills/total)
- Spawn location coordinates
- Number of spawned entity IDs

**Use Case:** Verify quest was accepted correctly and mobs spawned.

---

**Count Remaining Mobs**
```
/scriptevent sq:encounter count
```
Counts how many encounter mobs are still alive for your active quest.

**Use Case:** Debug despawn operations or check if mobs died naturally.

---

**Force Complete Encounter**
```
/scriptevent sq:encounter complete
```
Force completes your active encounter quest by setting progress to 100%.

**Use Case:** Skip to turn-in for testing rewards without killing all mobs.

---

**Spawn Test Encounter**
```
/scriptevent sq:encounter spawn
```
Spawns a test encounter (Skeleton Warband) at your current location.

**Details:**
- Spawns skeleton encounter from EncounterTable
- Applies proper tags for kill tracking
- Mobs count toward active quest if you have one

**Use Case:** Test mob spawning and kill tracking without accepting a quest.

---

**Despawn Test Mobs**
```
/scriptevent sq:encounter despawn
```
Removes all encounter mobs within 32 blocks of your position.

**Use Case:** Clean up test spawns after debugging.

---

## Testing Commands

### Encounter Table Testing

**Test Encounter Table**
```
!encounter test table
```
Shows encounter table statistics:
- Total encounters
- Rare encounter count
- Legendary encounter count

**Use Case:** Verify EncounterTable.js loaded correctly.

---

**Generate Test Rare Encounter**
```
!encounter test generate rare
```
Generates and displays a test rare encounter quest in chat.

**Output:**
- Encounter name
- Quest ID
- Mob count
- SP reward
- Item rewards
- Type and flags

**Use Case:** Test rare encounter generation without accepting quest.

---

**Generate Test Legendary Encounter**
```
!encounter test generate legendary
```
Generates and displays a test legendary encounter quest in chat.

**Output:** Same as rare encounter test.

**Use Case:** Test legendary encounter generation without accepting quest.

---

## Vanilla Minecraft Commands

Useful Minecraft commands for testing SuperQuester.

### Teleportation

**Teleport to Coordinates**
```
/tp <x> <y> <z>
```

**Examples:**
```
/tp 180 65 -307              # Teleport to test spawn location
/tp 72 75 -278               # Teleport to quest board
/tp @s 139 74 -288           # Alternative syntax (explicit self)
```

---

**Teleport to Player**
```
/tp <targetPlayer>
```

**Example:**
```
/tp Steve                    # Teleport to Steve
```

---

### Game Mode

**Change Game Mode**
```
/gamemode <creative|survival|adventure>
```

**Examples:**
```
/gamemode creative           # Switch to creative mode
/gamemode survival           # Switch to survival mode
/gamemode c                  # Shorthand for creative
/gamemode s                  # Shorthand for survival
```

---

### Time and Weather

**Set Time**
```
/time set <day|night|0|6000|12000|18000>
```

**Examples:**
```
/time set day                # Set to day
/time set night              # Set to night
/time set 0                  # Set to dawn
```

---

**Set Weather**
```
/weather <clear|rain|thunder>
```

**Examples:**
```
/weather clear               # Clear weather
/weather rain                # Start rain
```

---

### Entity Management

**Kill All Entities of Type**
```
/kill @e[type=<entityType>]
```

**Examples:**
```
/kill @e[type=creeper]       # Kill all creepers
/kill @e[type=zombie]        # Kill all zombies
/kill @e[type=!player]       # Kill all non-player entities
```

---

**Clear Items on Ground**
```
/kill @e[type=item]
```
Removes all dropped items from the world.

---

### Scoreboard (Super Points)

**View Scoreboard**
```
/scoreboard objectives setdisplay sidebar SuperPoints
```
Displays the SuperPoints scoreboard on the right side of the screen.

---

**Check Player SP (Admin)**
```
/scoreboard players list <playerName>
```
Shows all scoreboard values for a player.

---

**Set SP Directly (Admin)**
```
/scoreboard players set <playerName> SuperPoints <amount>
```

**Example:**
```
/scoreboard players set Steve SuperPoints 5000
```

---

**Add SP (Admin)**
```
/scoreboard players add <playerName> SuperPoints <amount>
```

**Example:**
```
/scoreboard players add Steve SuperPoints 100
```

---

### Ticking Areas (For Debugging)

**List Ticking Areas**
```
/tickingarea list
```
Shows all active ticking areas (useful for debugging chunk loading).

---

**Remove Ticking Area**
```
/tickingarea remove <name>
```

**Example:**
```
/tickingarea remove encounter_spawn_temp
```

---

## Quick Reference Tables

### Quest System Locations

| Location | Coordinates | Purpose |
|----------|-------------|---------|
| Quest Board | 72, 75, -278 | Main quest interaction point |
| Test Spawn Location | 180, 65, -307 | Phase 2 encounter spawn point (temp) |

**Note:** Test spawn location is temporary for Phase 2. Phase 3 will implement ring-based random spawning.

---

### Encounter Spawn Distances (Phase 3+)

| Tier | Distance from Quest Board |
|------|---------------------------|
| Rare | 60-120 blocks |
| Legendary | 100-200 blocks |

**Note:** Phase 2 uses fixed test location. Ring-based spawning comes in Phase 3.

---

### Encounter Types

**Rare Encounters:**
- Skeleton Warband (5 skeletons, 3 strays)
- Zombie Pack (6 zombies, 2 husks)
- Spider Nest (4 spiders, 2 cave spiders)
- Creeper Problem (3 creepers)

**Legendary Encounters:**
- Skeleton Legion (8 skeletons, 4 strays, 2 named)
- Zombie Siege (10 zombies, 4 husks)
- Phantom Swarm (6 phantoms)
- Witch Coven (3 witches, 4 cursed villagers)

---

## Common Testing Workflows

### Test Encounter Quest Flow

1. **Accept encounter quest:**
   ```
   !quests
   ```
   Click "Accept" on rare/legendary quest

2. **Check spawn data:**
   ```
   /scriptevent sq:encounter info
   ```

3. **Teleport to spawn location:**
   ```
   /tp 180 65 -307
   ```

4. **Count mobs:**
   ```
   /scriptevent sq:encounter count
   ```

5. **Force complete (optional):**
   ```
   /scriptevent sq:encounter complete
   ```

6. **Turn in quest:**
   ```
   !quests
   ```
   Click "Turn In" on active tab

---

### Test Mob Spawning

1. **Spawn test encounter at your location:**
   ```
   /scriptevent sq:encounter spawn
   ```

2. **Verify tags and tracking:**
   Kill a mob and check for progress notification

3. **Clean up test mobs:**
   ```
   /scriptevent sq:encounter despawn
   ```

---

### Reset Daily Quests

1. **Force daily refresh:**
   ```
   !forcedaily
   ```

2. **Open quest board:**
   ```
   !quests
   ```

3. **Check new quests in available tab**

---

### Fix "Unknown Player" on Leaderboard

1. **Register all player names:**
   ```
   !registernames
   ```

2. **Verify in console:**
   Check logs for player registration messages

---

## Notes for Future Phases

### Phase 3 Changes
- Test spawn location will be replaced with ring-based random spawning
- Terrain validation will prevent spawns in water/lava/leaves
- Fallback coordinates will be used if validation fails

### Phase 4 Changes
- Logout/login will trigger mob despawn and respawn
- Spawn data will persist through sessions

### Phase 5 Changes
- Orphan mob cleanup on server restart
- Enhanced abandon flow

---

## Troubleshooting Commands

### Quest Not Progressing

**Check active quest:**
```
!quests
```
Open Active tab and verify quest is there.

**Check SP balance:**
```
!sp
```

**Force refresh quests:**
```
!forcedaily
```

---

### Mobs Not Spawning

**Check spawn data:**
```
/scriptevent sq:encounter info
```

**Check for ticking areas:**
```
/tickingarea list
```

**Manually spawn test mobs:**
```
/scriptevent sq:encounter spawn
```

---

### Cleanup After Testing

**Kill all encounter mobs:**
```
/scriptevent sq:encounter despawn
```

**Kill all entities (extreme):**
```
/kill @e[type=!player]
```

**Clear dropped items:**
```
/kill @e[type=item]
```

---

## Admin Tips

### Give Starting SP to New Players
```
/scriptevent sq:givesp 1000 <playerName>
```

### Test Quest Completion
1. Accept quest with `!quests`
2. Force complete with `/scriptevent sq:encounter complete`
3. Turn in immediately to test rewards

### Quick Builder Mode Toggle
```
!builder
```
Faster than `/gamemode creative` + `/ability @s mayfly true`

### Monitor Quest Progress
Use `/scriptevent sq:encounter info` to check quest state without opening UI.

---

## Version Info

**Current Phase:** Phase 2 (Mob Spawning)
**Last Updated:** 2026-01-19
**Branch:** feature/encounter-system

For implementation details, see:
- [PHASE_1_IMPLEMENTATION_SUMMARY.md](PHASE_1_IMPLEMENTATION_SUMMARY.md)
- [PHASE_2_IMPLEMENTATION_SUMMARY.md](PHASE_2_IMPLEMENTATION_SUMMARY.md)
