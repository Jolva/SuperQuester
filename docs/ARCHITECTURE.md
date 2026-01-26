# SuperQuester Architecture

## Core Philosophy
SuperQuester is a Minecraft Bedrock Add-On focused on persistent, procedurally generated RPG quests.
**Critical Rule:** All gameplay logic runs on the Server side (`@minecraft/server`). UI is handled via `@minecraft/server-ui`.

## System Modules

### 1. Data Layer (`scripts/data/`)
* **Purpose:** Stores static pools of data (Mobs, Items, Lore Templates, Economy Configuration, Encounters).
* **Rules:** Pure data exports only. No logic functions.
* **Key Files:**
    * `QuestData.js` - Mob pools, item pools, lore templates for standard quests
    * `EconomyConfig.js` - Single source of truth for all economy values (rewards, costs, modifiers, streaks)
    * `EncounterTable.js` - Pre-configured mob encounters for Rare/Legendary/Mythic quests

### 2. Logic Systems (`scripts/systems/`)

**Quest Generation:**
* **QuestGenerator.js:** The "Chef." Takes data from the Data Layer and constructs unique Quest Objects.
    * *Note:* Generated quests are transient.
    * Routes Rare/Legendary quests to EncounterManager for encounter-based quests.
* **PersistenceManager.js:** The "Vault." Handles saving/loading data to `player.setDynamicProperty`.
    * *Critical:* Uses "Self-Contained State." When a quest is accepted, the ENTIRE definition is copied to the player. We do NOT reference definitions by ID after acceptance.

**Economy & Rewards:**
* **SPManager.js:** Centralized SP (Super Points) API. Wraps scoreboard operations with clean functions (getSP, addSP, deductSP).
* **RewardCalculator.js:** Calculates quest rewards based on rarity, type, difficulty scaling, and player-specific bonuses (jackpots, streaks).
* **StreakTracker.js:** Tracks consecutive quest completions within a session. Awards bonus SP at thresholds (3, 5, 10 quests).

**Encounter System:**
* **EncounterManager.js:** Generates encounter-based quests for Rare/Legendary tiers using curated mob groups.
* **EncounterSpawner.js:** Handles mob spawning, tagging (dual-tag system), tracking, and cleanup operations.
* **EncounterProximity.js:** Monitors player positions, triggers spawns when entering zones, provides directional navigation arrows and sky beacons.
* **LocationValidator.js:** Zone selection and terrain validation for encounter spawning (18-22 blocks from player).

**Atmosphere:**
* **AtmosphereManager.js:** The "Vibe." Handles audio loops, particle effects, and status effects based on player location.

### 3. Core Helpers (`scripts/`)
* **safeZone.js:** Handles event cancellation for the town hub protection (20-block radius around quest board).
* **quests/mobTypes.js:** Maps entity variants to canonical mob types (e.g., zombie_villager, husk, drowned → "zombie").

### 4. The Controller (`scripts/main.js`)
* **Purpose:** The central nervous system.
* **Responsibilities:**
    * Initializes the World (Generates Daily Quests).
    * Event Listeners (Entity Death, Block Break, Player Spawn).
    * UI State Machine (Handling Form responses).
    * Coordinates between Systems and Helpers.

## UI Flow
1.  **Board Interact:** Triggers `showQuestBoard`.
2.  **Available Tab:** Displays generated daily quests.
3.  **Selection:** Opens `showQuestDetails` (The Contract).
    * *Action:* Accepting triggers `PersistenceManager.saveQuests`.

---

## Economy System (Super Points / SP)

SuperQuester uses a centralized economy system based on Super Points (SP) as the primary currency.

### Configuration
All economy values are centralized in [EconomyConfig.js](../packs/QuestSystemBP/scripts/data/EconomyConfig.js):
- Base rewards by rarity (Common: 100-250, Rare: 200-600, Legendary: 500-1500, Mythic: 1200-5000)
- Quest type modifiers (kill: 1.0, mine: 0.9, gather: 0.85)
- Jackpot chances and multipliers (2-3x rewards on lucky completions)
- Streak bonuses (Hat Trick +10% at 3, On Fire +25% at 5, Unstoppable +50% at 10)
- Difficulty scaling (bonus SP for higher target counts)
- Reroll costs (100 SP base, exponential increase: 100, 100, 200, 400, 800...)

### Reward Calculation Flow
1. **Quest Generation** ([RewardCalculator.js](../packs/QuestSystemBP/scripts/systems/RewardCalculator.js:41)):
   - Roll base reward from rarity range
   - Apply quest type modifier
   - Add difficulty scaling bonus
   - Result stamped onto quest object

2. **Quest Completion** ([RewardCalculator.js](../packs/QuestSystemBP/scripts/systems/RewardCalculator.js:101)):
   - Start with quest's base SP value
   - Roll for jackpot (5-15% chance for 2-3x multiplier)
   - Apply streak bonus if player has active streak ([StreakTracker.js](../packs/QuestSystemBP/scripts/systems/StreakTracker.js))
   - Add first-of-day bonus if applicable
   - Award final amount via [SPManager.js](../packs/QuestSystemBP/scripts/systems/SPManager.js)

### SP Management
[SPManager.js](../packs/QuestSystemBP/scripts/systems/SPManager.js) provides clean API:
- `getSP(player)` - Read current balance from scoreboard
- `addSP(player, amount)` - Credit SP (triggers HUD update)
- `deductSP(player, amount)` - Debit SP (will not go below zero)
- All operations maintain scoreboard as authoritative source with backup sync

### Streak System
[StreakTracker.js](../packs/QuestSystemBP/scripts/systems/StreakTracker.js) tracks consecutive completions:
- In-memory only (session-based, resets on logout/daily refresh)
- Three thresholds: 3 quests (+10%), 5 quests (+25%), 10 quests (+50%)
- Encourages engagement without permanent progression pressure

---

## Encounter System

The Encounter System generates curated mob group quests for Rare, Legendary, and Mythic tiers. Unlike standard kill quests (where mobs spawn naturally), encounters spawn specific mob groups at calculated distances when players enter designated zones.

### Quest Generation
1. Player completes all 3 daily quests → earns free reroll
2. Reroll generates new quests with rarity roll
3. If Rare/Legendary: [QuestGenerator.js](../packs/QuestSystemBP/scripts/systems/QuestGenerator.js) routes to [EncounterManager.js](../packs/QuestSystemBP/scripts/systems/EncounterManager.js)
4. EncounterManager selects random encounter from [EncounterTable.js](../packs/QuestSystemBP/scripts/data/EncounterTable.js) for that tier
5. Quest object includes both standard fields (for UI compatibility) and encounter-specific data

### Zone Assignment (Two-Stage Flow)
**Stage 1 - Quest Accept:**
- [LocationValidator.js](../packs/QuestSystemBP/scripts/systems/LocationValidator.js:220) picks random point in tier ring:
  - Rare: 60-120 blocks from quest board
  - Legendary: 100-200 blocks from quest board
  - Mythic: 120-220 blocks from quest board
- Zone center saved to quest data (no terrain validation yet - chunks not loaded)

**Stage 2 - Player Arrival:**
- [EncounterProximity.js](../packs/QuestSystemBP/scripts/systems/EncounterProximity.js) monitors player positions every 2 ticks
- When player enters zone (within 50 blocks of center):
  1. Alert: "The enemy is near!" + sound
  2. Dramatic pause (500ms)
  3. Find valid spawn point 18-22 blocks from player (chunks now loaded)
  4. Spawn mobs via [EncounterSpawner.js](../packs/QuestSystemBP/scripts/systems/EncounterSpawner.js)
  5. Alert: "The enemy approaches!" + sound
  6. Update quest state to "spawned"

### Navigation System
Once spawned, [EncounterProximity.js](../packs/QuestSystemBP/scripts/systems/EncounterProximity.js:250) provides:
- **Directional arrows:** 16-direction custom glyphs showing target direction relative to player facing
- **Sky beacons:** Vertical particle columns when within 150 blocks (pulse every 2 seconds)
- Updates every 2 ticks for fluid navigation experience

### Mob Tagging & Tracking
[EncounterSpawner.js](../packs/QuestSystemBP/scripts/systems/EncounterSpawner.js) uses dual-tag system:
- `sq_encounter_mob` - Universal marker for all encounter mobs
- `sq_quest_<questId>` - Links mob to specific quest instance

This enables:
- Kill attribution ([main.js](../packs/QuestSystemBP/scripts/main.js:1700) uses [mobTypes.js](../packs/QuestSystemBP/scripts/quests/mobTypes.js) for variant matching)
- Quest-specific cleanup on turn-in/abandon
- Logout/login persistence (despawn on logout, respawn on login)

### Protection System
Undead mobs (skeletons, zombies, phantoms) receive fire resistance to prevent sunlight burning:
- Applied on spawn as ongoing effect
- Backup: damage event blocker for fire damage on tagged mobs
- Other environmental damage (drowning, lava, fall) allowed (prevents stuck mobs from persisting forever)

---

## SP HUD System

Custom HUD element displaying player's Super Points in the top-right corner.

### Title Bridge Protocol

**Static Display (Frame 0):**
- Format: `SPVAL:100` (no frame suffix)
- Shows `sp_coin.png` (static default coin)
- Used on player join/respawn