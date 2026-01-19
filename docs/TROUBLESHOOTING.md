# Troubleshooting Guide

> Common issues and their solutions for SuperQuester development and gameplay.

## 🔧 Development Issues

### "Changes aren't showing up in game"

**Symptom:** You modified code/JSON/textures but nothing changed in-game.

**Solution:**
```bash
# 1. Run cache buster (ALWAYS do this first)
python tools/cache_buster.py

# 2. For script changes (.js files):
#    In-game: /reload
#    OR restart Bedrock server

# 3. For JSON UI or texture changes:
#    MUST fully restart Minecraft (exit to menu or close game)
#    /reload does NOT work for resource pack changes
```

**Why:** Bedrock aggressively caches resource pack files. The cache buster increments manifest versions to force cache invalidation.

---

### "Script errors in Content Log"

**Symptom:** `[Script Engine] Error: ...` messages in console/logs.

**Common causes:**

1. **Undefined property access**
   ```javascript
   // BAD: Old quest data missing new property
   const reward = quest.newProperty.amount;  // Error if newProperty doesn't exist

   // GOOD: Always check for undefined
   const reward = quest.newProperty?.amount ?? 100;
   ```

2. **Quest data corruption**
   ```javascript
   // Player has old quest format in saved data
   // Solution: Add migration logic in PersistenceManager
   if (!playerData.quests) playerData.quests = { available: [], active: [], completed: [] };
   ```

3. **Type mismatches**
   ```javascript
   // BAD: Scoreboard returns number, but we expect string
   const sp = player.scoreboard.getScore("SuperPoints");  // Returns number or undefined

   // GOOD: Use the helper functions
   const sp = getSP(player);  // Handles all edge cases
   ```

**Debug strategy:**
- Add `console.warn("DEBUG: variable =", variable);` liberally
- Check line numbers in error messages
- Test with a fresh player (no saved data)

---

### "Python cache_buster.py not working"

**Symptom:** `python: command not found` or similar.

**Solutions:**

**Windows:**
```bash
# Try python3 instead
python3 tools/cache_buster.py

# Or use full path
C:\Python39\python.exe tools/cache_buster.py

# Or run in PowerShell
py tools/cache_buster.py
```

**What it does:**
- Increments version in `manifest.json` for both packs
- Generates new UUIDs (optional, commented out by default)
- Forces Bedrock to reload pack assets

**Manual alternative:**
Edit both `manifest.json` files and increment the last version number:
```json
"version": [1, 0, 230]  →  "version": [1, 0, 231]
```

---

### "Quest Board UI looks broken/vanilla"

**Symptom:** Quest board shows default Minecraft UI instead of custom wooden board.

**Checks:**
1. Is `packs/QuestSystemRP/ui/server_form.json` present?
2. Is it registered in `ui/_ui_defs.json`?
3. Did you run cache buster + restart game (not just /reload)?
4. Check for JSON syntax errors (trailing commas, missing brackets)

**Test:**
```bash
# Validate JSON syntax
python -m json.tool packs/QuestSystemRP/ui/server_form.json
```

---

### "Sounds not playing"

**Checklist:**
- ✅ Audio file is **mono** OGG (not stereo)
- ✅ Sample rate is 44100Hz
- ✅ File is in a **subfolder** (`sounds/ui/`, NOT `sounds/`)
- ✅ Entry exists in `sounds/sound_definitions.json`
- ✅ Path is relative to RP root: `"sounds/ui/my_sound.ogg"`
- ✅ Cache buster run + game restarted
- ✅ `/playsound` command works: `/playsound quest.complete @s`

**Convert to correct format (ffmpeg):**
```bash
# Convert any audio to mono OGG at 44100Hz
ffmpeg -i input.mp3 -ac 1 -ar 44100 output.ogg
```

**Debug:**
```bash
# Test sound directly (bypass script)
/playsound your.sound_id @s

# If this works but script doesn't, issue is in script logic
# If this doesn't work, issue is in sound definition or file
```

---

## 🎮 Gameplay Issues

### "Player spawns in wrong location"

**Symptom:** New players don't spawn at the hub stairs.

**Check:**
1. Is `HUB_SPAWN_LOCATION` correct in `main.js`?
   ```javascript
   const HUB_SPAWN_LOCATION = { x: 84, y: 78, z: -278 };
   ```
2. Is the spawn event handler registered?
   ```javascript
   world.afterEvents.playerSpawn.subscribe(handlePlayerSpawn);
   ```
3. Is `handlePlayerSpawn` checking for first spawn?
   ```javascript
   if (!event.initialSpawn) return;
   ```

**Test:**
Delete your player data from the world save and rejoin.

---

### "Quest progress not tracking"

**Symptom:** Player completes objectives but quest doesn't update.

**Common causes:**

1. **Wrong entity type**
   ```javascript
   // Quest asks for "minecraft:zombie" but code checks "zombie"
   // ALWAYS use full namespace: "minecraft:entity_name"
   ```

2. **Case sensitivity**
   ```javascript
   // Quest item: "minecraft:oak_log"
   // Code checks: "minecraft:Oak_Log"  // Won't match!
   ```

3. **Event not firing**
   ```javascript
   // Block break quests: Check if event.player exists
   // Mob kill quests: Check if event.damageSource.damagingEntity is player
   ```

**Debug:**
Add logging to event handlers:
```javascript
world.afterEvents.entityDie.subscribe((event) => {
  console.warn(`Entity died: ${event.deadEntity.typeId}`);
  console.warn(`Killed by: ${event.damageSource.damagingEntity?.typeId}`);
  // Compare with quest targets
});
```

---

### "Leaderboard shows 'Unknown Player'"

**Symptom:** Leaderboard displays player name as "Unknown Player" or shows wrong names.

**Root cause:** Player joined before name registry system was initialized.

**Solution:**
1. The system now auto-registers players on join
2. For old saves, players need to rejoin or run:
   ```javascript
   // In main.js, this is now automatic:
   world.afterEvents.playerJoin.subscribe((event) => {
     registerPlayerName(event.playerId, event.playerName);
   });
   ```

**Manual fix:**
Delete the `playerNameRegistry` dynamic property to force rebuild:
```javascript
world.setDynamicProperty("playerNameRegistry", undefined);
```

---

### "SP HUD not showing/wrong value"

**Symptom:** Super Points coin/number missing or incorrect.

**Checks:**

1. **Is HUD file present?**
   - `packs/QuestSystemRP/ui/hud_screen.json`

2. **Are coin textures present?**
   - `textures/quest_ui/sp_coin_0.png` through `sp_coin_5.png`

3. **Is SP scoreboard objective created?**
   ```bash
   # In-game:
   /scoreboard objectives list
   # Should show "SuperPoints" objective
   ```

4. **Cache buster + game restart?**
   - JSON UI requires FULL game restart

5. **Is player SP initialized?**
   ```javascript
   // Should happen on first spawn
   initializePlayerSP(player);
   ```

**Test manually:**
```bash
# Set SP via scoreboard
/scoreboard players set @s SuperPoints 100

# Trigger update via script (call modifySP in main.js)
# OR wait for next quest complete
```

**Check binding:**
The HUD binds to titleraw commands. If title is cleared elsewhere in code, HUD breaks.
Search for: `player.runCommand("titleraw")` - make sure nothing conflicts.

---

### "Quest disappeared after world reload"

**Symptom:** Player had active quest, but after reloading world it's gone.

**Root cause:** Quest wasn't saved to dynamic properties.

**Prevention:**
Every quest state change MUST call:
```javascript
PersistenceManager.saveQuests(player, questData);
```

**Check these functions call saveQuests:**
- `acceptQuest()`
- `completeQuest()`
- `abandonQuest()`
- Any progress tracking updates

**Recovery:**
Quest data is lost. Player must accept a new quest. Consider:
- Adding auto-save interval
- Persisting on world shutdown event
- Adding `/questdebug backup` command

---

### "Safe zone not working"

**Symptom:** Players can build/break blocks or take damage in the hub.

**Checks:**

1. **Is safe zone radius correct?**
   ```javascript
   // In safeZone.js
   const SAFE_ZONE_RADIUS = 20;
   const HUB_LOCATION = { x: 72, y: 75, z: -278 };
   ```

2. **Are events registered?**
   ```javascript
   // In main.js bootstrap:
   registerSafeZoneEvents();
   ```

3. **Does player have bypass permission?**
   - Check if any admin code grants bypass tags

**Test:**
```bash
# Stand at quest board and check distance
/tp 72 75 -278
# Try breaking a block - should be prevented
```

---

### "Too many active quests"

**Symptom:** Player can't accept new quests even though they have slots.

**Root cause:** Active quest limit is 3 (hardcoded).

**Check:**
```javascript
// In main.js
const MAX_ACTIVE_QUESTS = 3;
```

**Debug:**
Add logging to `acceptQuest()`:
```javascript
console.warn(`Active quests: ${questData.active.length}/${MAX_ACTIVE_QUESTS}`);
```

**If player truly has < 3 active but can't accept:**
- Quest data corruption
- Check `questData.active` array structure
- May need to reset: `questData.active = [];`

---

## 🗄️ Data Issues

### "Resetting player quest data"

**WARNING: This deletes all quest progress for a player!**

```javascript
// In-game (as player):
// There is no built-in command for this yet

// Via script:
const player = world.getAllPlayers()[0];  // Get specific player
player.setDynamicProperty("questData", undefined);
player.setDynamicProperty("superPoints", undefined);

// Then reinitialize:
ensureQuestData(player);
initializePlayerSP(player);
```

**Better: Add debug command in main.js:**
```javascript
world.beforeEvents.chatSend.subscribe((event) => {
  if (event.message === "!resetquests" && event.sender.hasTag("admin")) {
    event.cancel = true;
    const player = event.sender;
    player.setDynamicProperty("questData", undefined);
    player.sendMessage("§eQuest data reset!");
  }
});
```

---

### "Migrating old quest data format"

**Scenario:** You changed quest data structure and old saves break.

**Solution: Add migration in PersistenceManager.loadQuests():**

```javascript
static loadQuests(player) {
  const raw = player.getDynamicProperty("questData");
  if (!raw) return this.getDefaultQuestData();

  const data = JSON.parse(raw);

  // MIGRATION: Add missing properties
  if (!data.version) data.version = 1;

  // MIGRATION: Convert old format
  if (data.version === 1) {
    data.active = data.active.map(quest => {
      if (!quest.targets) quest.targets = [quest.target];  // Old single target → new array
      return quest;
    });
    data.version = 2;
  }

  return data;
}
```

---

## 🛠️ Server Issues

### "Bedrock server won't start"

**Check:**
1. Port 19132 not already in use
2. `server.properties` syntax correct
3. World folder exists and is valid
4. No corrupted chunks

**View logs:**
```bash
# Server outputs to console and log files
# Check for error messages
```

### "Server crash on player join"

**Common causes:**
- Script error in `playerSpawn` handler
- Corrupted player data
- Missing dynamic property initialization

**Debug:**
Add try-catch in `handlePlayerSpawn`:
```javascript
function handlePlayerSpawn(event) {
  try {
    // existing code
  } catch (error) {
    console.error("Spawn handler error:", error);
  }
}
```

---

## 📋 Useful Commands

```bash
# === In-Game Commands ===
/reload                          # Reload scripts (not JSON/textures)
/scriptevent <namespace:event>   # Trigger custom events
/playsound <sound_id> @s         # Test sounds
/scoreboard objectives list      # View all objectives
/scoreboard players list @s      # View your scores

# === Development ===
python tools/cache_buster.py     # Force pack reload
python -m json.tool file.json    # Validate JSON syntax

# === Testing ===
/tp 72 75 -278                   # Teleport to quest board
/give @s diamond 64              # Test turn-ins
```

---

## 🆘 Still Stuck?

**Check these files for clues:**
1. Bedrock server console output
2. Content Log (in-game, press F1 to toggle)
3. `main.js` header comments (explains architecture)
4. Recent git commits (see what changed)

**Provide this info when asking for help:**
- Exact error message (copy full text)
- Steps to reproduce
- Bedrock version
- Recent changes made
- Content Log output
