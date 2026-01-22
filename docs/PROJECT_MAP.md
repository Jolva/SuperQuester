# Project File Map

> **Last Updated:** 2026-01-18 (Added Claude-specific docs)

## 📚 Documentation Quick Guide

**New to the project? Start here:**
1. [CLAUDE_QUICKSTART.md](CLAUDE_QUICKSTART.md) - 2-minute onboarding for Claude sessions
2. [AI_CONTEXT.md](AI_CONTEXT.md) - Mental models and critical architecture rules
3. [ARCHITECTURE.md](ARCHITECTURE.md) - System design and data flow
4. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions

**For specific work:**
- [CODING_STANDARDS.md](CODING_STANDARDS.md) - Constraints and forbidden patterns
- [AUDIO_SYSTEM.md](AUDIO_SYSTEM.md) - How to add/modify sounds
- [COMMAND_REFERENCE.md](COMMAND_REFERENCE.md) - In-game admin commands

---

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
| `QuestGenerator.js` | Creates randomized quests with rarity tiers. Routes Rare/Legendary to EncounterManager. |
| `PersistenceManager.js` | Saves/loads player quest data to `player.setDynamicProperty()`. |
| `AtmosphereManager.js` | Quest board proximity effects (particles, night vision, sounds within 10 blocks). |
| `SPManager.js` | Centralized SP (Super Points) API. Wraps scoreboard operations. |
| `RewardCalculator.js` | Calculates quest rewards with rarity, type modifiers, jackpots, and streaks. |
| `StreakTracker.js` | Tracks consecutive quest completions for session-based bonuses. |
| `EncounterManager.js` | Generates encounter-based quests using curated mob groups from EncounterTable. |
| `EncounterSpawner.js` | Handles mob spawning, dual-tagging, tracking, and cleanup for encounters. |
| `EncounterProximity.js` | Monitors players, triggers spawns on zone entry, provides navigation arrows/beacons. |
| `LocationValidator.js` | Zone selection and terrain validation for encounter spawn points. |

### Data (`scripts/data/`)

| File | Purpose |
|------|---------|
| `QuestData.js` | Static data pools: MOB_POOL, ITEM_POOL, LORE_TEMPLATES for standard quests. |
| `EconomyConfig.js` | Single source of truth for all economy values (rewards, costs, modifiers, streaks). |
| `EncounterTable.js` | Pre-configured mob encounters for Rare/Legendary/Mythic quests. |

### Quests (`scripts/quests/`)

| File | Purpose |
|------|---------|
| `mobTypes.js` | Maps entity variants to canonical types (zombie_villager → "zombie"). Used by kill tracking. |

### Deleted Files (Post-Cleanup)

These files were removed as dead code on 2026-01-17:
- ~~`config.js`~~ — Was imported but never used
- ~~`scoreboard.js`~~ — `ensureObjective()` was never called
- ~~`ui_manager.js`~~ — Legacy UI helper, replaced by main.js implementation

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