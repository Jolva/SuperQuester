# Project File Map

> **Last Updated:** 2026-01-17 (Post-Cleanup)

## Root Directory
* `packs/` - Contains all Behavior and Resource packs.
* `tools/` - Deployment utilities (`cache_buster.py`).
* `docs/` - Documentation for AI agents.

## Behavior Pack (`packs/QuestSystemBP/`)

### Core Scripts (`scripts/`)

| File | Purpose |
|------|---------|
| `main.js` | **Central nervous system.** Event handlers, UI flow, quest logic, ambient systems. (~2200 lines) |
| `safeZone.js` | Hub protection (20-block radius). Blocks building, mob damage, explosions. Exports `!safezone` command. |

### Systems (`scripts/systems/`)

| File | Purpose |
|------|---------|
| `QuestGenerator.js` | Creates randomized quests with rarity tiers. Stateless — just generates quest objects. |
| `PersistenceManager.js` | Saves/loads player quest data to `player.setDynamicProperty()`. |
| `AtmosphereManager.js` | Quest board proximity effects (particles, night vision, sounds within 10 blocks). |

### Data (`scripts/data/`)

| File | Purpose |
|------|---------|
| `QuestData.js` | Static data pools: MOB_POOL, ITEM_POOL, LORE_TEMPLATES. |

### Deleted Files (Post-Cleanup)

These files were removed as dead code on 2026-01-17:
- ~~`config.js`~~ — Was imported but never used
- ~~`scoreboard.js`~~ — `ensureObjective()` was never called  
- ~~`ui_manager.js`~~ — Legacy UI helper, replaced by main.js implementation
- ~~`quests/mobTypes.js`~~ — `getMobType()` was imported but never called

---

## Resource Pack (`packs/QuestSystemRP/`)

### Root Files
* `manifest.json` - Resource Pack manifest.
* `blocks.json` - Block definition overrides.

### UI Overrides (`ui/`)
* `_ui_defs.json` - Registers custom UI files.
* `server_form.json` - Custom ActionFormData styling (wider modal, custom button textures).

### Sounds (`sounds/`)
* `sound_definitions.json` - All custom sound definitions.
* `ui/` - UI and interaction sounds.
* `quest/` - Quest board ambient sounds.
* `atmosphere/` - Environmental audio (dogs, monkeys, etc.).
* `music/town/` - Town zone background music.

### Textures (`textures/`)
* `quest_ui/` - Custom icons for the quest board.

---

## Key Coordinates (Hardcoded)

| Location | Coordinates | Used In |
|----------|-------------|---------|
| Quest Board / Town Center | X:72, Y:75, Z:-278 | main.js, safeZone.js, AtmosphereManager.js |
| Player Spawn Point | X:84, Y:78, Z:-278 | main.js |
| Safe Zone Radius | 20 blocks | main.js, safeZone.js |