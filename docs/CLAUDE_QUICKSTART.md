# Claude Code Quickstart Guide

> **Purpose:** Get a new Claude session productive in under 2 minutes.

## 📖 Essential Reading Order

1. **Start here:** [AI_CONTEXT.md](AI_CONTEXT.md) - Mental models & critical rules (3 min read)
2. **Then:** [PROJECT_MAP.md](PROJECT_MAP.md) - File locations & what was deleted (2 min read)
3. **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md) - System design & data flow (5 min read)
4. **Standards:** [CODING_STANDARDS.md](CODING_STANDARDS.md) - What NOT to do (2 min read)

**For specific tasks:**
- Audio work → [AUDIO_SYSTEM.md](AUDIO_SYSTEM.md)
- UI changes → [CustomButtonTextures_Implementation.md](CustomButtonTextures_Implementation.md)
- HUD/SP changes → [SP_Coin_Animation_Specification.md](SP_Coin_Animation_Specification.md)

## 🎯 Common Tasks Cheat Sheet

### Adding a New Quest Type

```javascript
// 1. Add data to QuestData.js
export const NEW_POOL = [ /* ... */ ];

// 2. Update QuestGenerator.js
generateNewTypeQuest() { /* ... */ }

// 3. Update main.js event handlers
// Search for: "QUEST PROGRESS TRACKING"
```

### Adding a Sound

```bash
# 1. Add .ogg file to packs/QuestSystemRP/sounds/[category]/
# 2. Add entry to sounds/sound_definitions.json
# 3. Run cache buster
python tools/cache_buster.py
# 4. Test in-game
/playsound your.sound_id @s
```

### Modifying SP (Super Points)

```javascript
// CORRECT (triggers HUD animation):
modifySP(player, 50);  // Add 50 SP

// WRONG (bypasses system):
player.runCommand("scoreboard players add @s SuperPoints 50");
```

### Changing Hub Location

**Files to update if relocating the town:**
1. `scripts/main.js` → `QUEST_BOARD_LOCATION`, `HUB_SPAWN_LOCATION`
2. `scripts/safeZone.js` → `HUB_LOCATION`
3. `scripts/systems/AtmosphereManager.js` → `BOARD_LOCATION`

### Testing & Deployment

```bash
# Always run after changes (bumps version, clears cache):
python tools/cache_buster.py

# Start server:
./bedrock_server.exe  # or start_server.bat

# Useful commands:
/reload               # Reload scripts (doesn't work for JSON/textures)
/scriptevent          # Trigger custom events
/playsound <id> @s    # Test sounds
```

## 🚨 Critical "DO NOT" List

- ❌ **DO NOT** modify quest data in `QuestGenerator` without understanding Snapshot Rule
- ❌ **DO NOT** use direct scoreboard commands for SP (bypasses animation)
- ❌ **DO NOT** edit JSON UI or textures without running cache buster after
- ❌ **DO NOT** create external dependencies (we're vanilla Script API only)
- ❌ **DO NOT** use `var` (use `const`/`let`)
- ❌ **DO NOT** trust in-memory state (always persist via PersistenceManager)

## 🐛 Debugging Checklist

**Quest not appearing?**
1. Check Content Log for script errors
2. Verify player has quest data: `ensureQuestData(player)`
3. Check if player at max quest limit (3 active)

**Sound not playing?**
1. File in subfolder? (`sounds/ui/` not `sounds/`)
2. Mono OGG at 44100Hz?
3. Defined in `sound_definitions.json`?
4. Cache buster run?
5. Test with `/playsound` first

**HUD not updating?**
1. Using `modifySP()` helper?
2. Check for animation state conflicts
3. Verify `hud_screen.json` binding syntax
4. Try `titleraw @s clear` to flush cache

**UI looks wrong?**
1. Cache buster run?
2. Full game restart (not just `/reload`)?
3. Check `server_form.json` syntax

## 📂 File Quick Reference

| Task | File(s) |
|------|---------|
| Quest logic, UI flow | `scripts/main.js` (~2200 lines) |
| Quest generation | `scripts/systems/QuestGenerator.js` |
| Save/load player data | `scripts/systems/PersistenceManager.js` |
| Proximity effects | `scripts/systems/AtmosphereManager.js` |
| Hub protection | `scripts/safeZone.js` |
| Quest data pools | `scripts/data/QuestData.js` |
| SP HUD display | `ui/hud_screen.json` (RP) |
| Quest board styling | `ui/server_form.json` (RP) |
| All sounds | `sounds/sound_definitions.json` (RP) |

## 🔍 Where to Find Things

**Player spawns:** Search for `HUB_SPAWN_LOCATION`
**Quest acceptance:** Search for `acceptQuest(`
**Quest completion:** Search for `completeQuest(`
**Turn-in logic:** Search for `handleQuestTurnIn(`
**UI tabs:** Search for `showQuestBoard(`, `showAvailableQuests(`, `showActiveQuests(`
**SP economy:** Search for `modifySP(`, `getSP(`
**Leaderboard:** Search for `showLeaderboard(`

## 💡 Pro Tips

- **Timestamps matter:** Files have "Last Updated" headers - check dates
- **Archive folder:** Old implementation docs (5 SP HUD phases) - mostly historical
- **Main.js structure:** File organization documented in header (lines 28-40)
- **Test incrementally:** Add logging, test one feature at a time
- **Player data schema:** See `PersistenceManager.js` for structure

## 🎓 Learning the Codebase

**30-second overview:**
Main.js orchestrates everything → Systems handle specific logic → Data provides content pools

**5-minute tour:**
1. Read `main.js` header (lines 1-51)
2. Skim `QuestGenerator.generateQuest()`
3. Check `PersistenceManager` save/load methods
4. Look at one UI function like `showQuestBoard()`

**Deep dive:**
Follow the flow: Player interacts with quest board → `showQuestBoard()` → Tab functions → `acceptQuest()` → `PersistenceManager.saveQuests()` → Progress tracking → Turn-in → Rewards → Celebration

## 📞 Ask the User

**Before making changes, confirm:**
- Which Minecraft version are they running?
- Is this for single-player or dedicated server?
- Do they have a backup of their world?
- What does the Content Log show?

**For new features, ask:**
- Should this trigger for all players or just nearby?
- What happens if the player logs out mid-quest?
- Does this need to persist across world reloads?
- Should there be a cooldown/limit?
