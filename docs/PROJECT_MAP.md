# Project File Map

## Root Directory
* `packs/` - Contains all Behavior and Resource packs.

## Behavior Pack (`packs/QuestSystemBP/`)
* **Core Scripts (`scripts/`):**
  * `scripts/main.js` - Main entry point. Handles Event Listeners (`worldInitialize`, `playerSpawn`) and the central UI loop.
  * `scripts/manifest.json` - Pack definition and dependencies.
  * `scripts/config.js` - Central configuration constants.
  * `scripts/scoreboard.js` - Helper for scoreboard objective management.
  * `scripts/safeZone.js` - Logic for the town safety perimeter.
  * `scripts/ui_manager.js` - (Legacy/Helper) UI construction utilities.

* **Systems (`scripts/systems/`):**
  * `scripts/systems/QuestGenerator.js` - The logic class for creating random quests.
  * `scripts/systems/PersistenceManager.js` - Handles saving/loading data to `player.setDynamicProperty`.
  * `scripts/systems/AtmosphereManager.js` - Manages audio loops, particles, and the "Darkness" effect near the board.

* **Quests (`scripts/quests/`):**
  * `scripts/quests/mobTypes.js` - Logic for identifying mob types.

* **Data (`scripts/data/`):**
  * `scripts/data/QuestData.js` - Static arrays of Mobs, Items, and Lore strings.

## Resource Pack (`packs/QuestSystemRP/`)
* **Root Files:**
  * `manifest.json` - Resource Pack manifest.
  * `blocks.json` - Block definition overrides.

* **UI Overrides (`ui/`):**
  * `ui/server_form.json` - **[MISSING/PLANNED]** Custom override for server forms.

* **Textures (`textures/`):**
  * `textures/quest_ui/` - Custom icons for the quest board.