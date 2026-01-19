# SuperQuester Architecture

## Core Philosophy
SuperQuester is a Minecraft Bedrock Add-On focused on persistent, procedurally generated RPG quests.
**Critical Rule:** All gameplay logic runs on the Server side (`@minecraft/server`). UI is handled via `@minecraft/server-ui`.

## System Modules

### 1. Data Layer (`scripts/data/`)
* **Purpose:** Stores static pools of data (Mobs, Items, Lore Templates).
* **Rules:** Pure data exports only. No logic functions.
* **Key Files:** `QuestData.js`.

### 2. Logic Systems (`scripts/systems/`)
* **QuestGenerator.js:** The "Chef." Takes data from the Data Layer and constructs unique Quest Objects.
    * *Note:* Generated quests are transient.
* **PersistenceManager.js:** The "Vault." Handles saving/loading data to `player.setDynamicProperty`.
    * *Critical:* Uses "Self-Contained State." When a quest is accepted, the ENTIRE definition is copied to the player. We do NOT reference definitions by ID after acceptance.
* **AtmosphereManager.js:** The "Vibe." Handles audio loops, particle effects, and status effects based on player location.

### 3. Core Helpers (`scripts/`)
* **scoreboard.js:** Manages scoreboard objectives (e.g., Town Reputation).
* **safeZone.js:** Handles event cancellation for the town hub protection.
* **ui_manager.js:** Utilities for UI construction.

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

## SP HUD System with Coin Animation

Custom HUD element displaying player's Super Points with an animated spinning coin in the top-right corner.

### Title Bridge Protocol

**Static Display (Frame 0):**
- Format: `SPVAL:100` (no frame suffix)
- Shows `sp_coin_0.png` (static default coin)
- Used on player join/respawn

**Animated Display (Frames 1-5):**
- Format: `SPVAL:100:N` where N = 1-5
- Each frame shows corresponding `sp_coin_N.png`
- Triggered by SP changes during gameplay

### How It Works

1. **Script API** sends title commands with SP value and optional frame number
2. **JSON UI** (`hud_screen.json`) binds to `#hud_title_text_string` (global binding)
3. **Frame Detection** uses string subtraction to check for `:N` suffixes
4. **Value Extraction** strips `SPVAL:` prefix and all frame suffixes
5. **Display** shows only one coin frame at a time + SP number

### Animation Flow

1. Player earns/spends SP → `modifySP()` called
2. `updateSPDisplayWithAnimation()` triggered
3. Animation state flag prevents overlaps
4. Cycles frames 1→2→3→4→5 at 200ms each (1 second total)
5. Returns to frame 0 (static, no suffix)
6. Animation state cleared

### JSON UI Binding Mechanics (Critical Implementation Details)

**Frame 0 Visibility:**
```javascript
// Shows when: has "SPVAL:" AND no :1 through :5 suffixes
(not ((#string - 'SPVAL:') = #string) and 
     ((#string - ':1') = #string) and 
     ((#string - ':2') = #string) and 
     ((#string - ':3') = #string) and 
     ((#string - ':4') = #string) and 
     ((#string - ':5') = #string))
```

**Frames 1-5 Visibility:**
```javascript
// Shows when: specific suffix exists
// Example for frame 3:
(not ((#string - ':3') = #string))
```

**Value Extraction:**
```javascript
// Strips prefix and all suffixes
('§z' + ((#string - 'SPVAL:') - ':0' - ':1' - ':2' - ':3' - ':4' - ':5'))
```

**Key Learnings:**
- Must use `#hud_title_text_string` with `"global"` binding type
- Collection bindings (`hud_title_text_collection`) do NOT work with titleraw
- Frame 0 is IMPLICIT (no suffix) rather than explicit `:0` suffix
- Panel container (not stack_panel) for layered frame images
- String subtraction: `(string - 'text')` removes first occurrence
- Comparison: `(result = original)` returns true if nothing was removed

### Key Files

**Script API:**
- `scripts/main.js` → `modifySP()`, `updateSPDisplay()`, `updateSPDisplayWithAnimation()`
- `playerAnimationState` Map tracks active animations

**JSON UI:**
- `ui/hud_screen.json` → Frame conditional visibility bindings
- 6 overlapping image controls (sp_coin_frame_0 through sp_coin_frame_5)
- Single label with value extraction binding

**Assets:**
- `textures/quest_ui/sp_coin_0.png` through `sp_coin_5.png` (32×32 each)

### Triggering Animation

**CORRECT (triggers animation):**
- Complete a quest → `modifySP(player, +reward)`
- Purchase reroll → `modifySP(player, -cost)`
- Any code calling `modifySP(player, delta)`

**INCORRECT (no animation):**
- `/scoreboard players add @s SuperPoints 50` (bypasses system)
- `/scoreboard players set @s SuperPoints 100` (bypasses system)
- Direct scoreboard modifications (only updates number, no animation)

### Technical Specifications

**Timing:**
- Frame duration: 4 ticks (200ms at 20 TPS)
- Total animation: 1 second (5 frames)
- Post-animation pause: 2 ticks (ensures last frame processes)
- Title display: 0 fade in, 1 tick stay, 0 fade out (invisible timing)

**State Management:**
- `playerAnimationState` Map prevents overlapping animations
- Cleared on player spawn (prevents stuck states)
- Cleared in finally block (ensures cleanup on errors)

**Error Handling:**
- Try-catch wraps entire animation loop
- Fallback to static display on errors
- Console logging for debugging (start/complete/error)

**Spawn Behavior:**
- Uses `titleraw @s clear` to flush cached title data
- Sends static display (`SPVAL:XX` no suffix) after 1 second delay
- Explicitly clears animation state map

### Known Quirks

- Title flash visible during animation (expected behavior)
- Spawn may briefly show wrong frame if title cache persists (cleared command fixes)
- Animation skipped if already running (by design, prevents visual conflicts)

### Important Notes

- **Never send `:0` suffix** - frame 0 is implicit (no suffix)
- **Don't use collection bindings** - they don't work with titleraw in Bedrock
- **Always use modifySP()** - direct scoreboard commands bypass animation
- **Cache buster required** after JSON UI changes (texture/binding caching)