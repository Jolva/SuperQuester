# SuperQuester Bedrock Add-on — Refactor Plan (Claude Code Handoff)

## Goal
Refactor `scripts/main.js` into a maintainable, feature-oriented module structure **without changing behavior**.

**Success criteria**
- Game behavior is unchanged (quests, SP, celebrations, encounters, tutorials, UI).
- `main.js` becomes a thin bootstrap/wiring file.
- No circular imports.
- Build/pack still loads in Bedrock Dedicated Server.

---

## Constraints & Guardrails
- **Do not change gameplay logic** during refactor. Only move code + update imports/exports.
- **Do not move `/systems/` modules** - they are already properly organized!
- **Do not consolidate the encounter system** - it's well-structured across 4 modules.
- **Do not create `sp/celebrations.js`** - `CelebrationManager.js` already exists in `/systems/`.
- Keep function signatures stable unless explicitly noted.
- Prefer **feature folders** over "utils" dumping grounds.
- Avoid circular dependencies by passing a `deps` object instead of deep imports.
- Keep `main.js` as the single entrypoint used by manifest.

---

## Current State (from existing project)
`main.js` currently acts as:
- entrypoint + orchestration (~3441 lines)
- contains large constants/data tables (TEXTURES, CATEGORY_TEXTURES, BOARD_TABS)
- contains UI routing logic (BLOCK_TAB_MAP, tab switching)
- contains tutorial definitions (tutorials object with 4 topics)
- contains quest board UI composition (showQuestBoard, tab builders, detail views)
- contains event handlers (entity death, block break, player spawn/leave)
- contains ambient systems (town music, dog barking, cat spawning)
- imports many managers from `/systems/` directory:
  - PersistenceManager, QuestGenerator, AtmosphereManager
  - SPManager, SPAnimator, RewardCalculator, StreakTracker
  - CelebrationManager (already handles SP + quest celebrations)
  - EncounterManager, EncounterSpawner, EncounterProximity, LocationValidator

---

## Target Folder Structure
Under `behavior_packs/<BP>/scripts/`:

```
scripts/
  main.js                       # bootstrap + wiring only

  bootstrap/
    createDeps.js               # create managers + dependency container
    initSystems.js              # initialization routines

  events/
    registerEvents.js           # all world/system event subscriptions

  data/
    textures.js                 # TEXTURES, CATEGORY_TEXTURES (static asset paths)
    boardTabs.js                # BOARD_TABS constants
    tutorials.js                # tutorials object (4 topics: how_quests_work, super_points, rerolls, rarities)
    constants.js                # small constants / shared enums (if needed)

  features/
    questBoard/
      ui.js                     # UI render composition (showQuestBoard, tab builders, detail views)
      actions.js                # button click handlers (accept/abandon/turn-in/reroll)
      routing.js                # tab selection logic + BLOCK_TAB_MAP

    quests/
      lifecycle.js              # accept/abandon/turn-in orchestration
      progress.js               # kill counts / block breaks / completion checks
      formatters.js             # name/text/icon/color formatting (getQuestIcon, etc.)
      mobTypes.js               # mob variant mapping (moved from /quests/)

    leaderboard/
      leaderboardService.js     # player name registry + leaderboard entries

    hud/
      hudManager.js             # SP display + quest progress action bar

    tutorials/
      atlasDialog.js            # showQuestMasterDialog + showTutorialPage

    ambient/
      townAmbience.js           # town music, dog barking, cat spawning systems

  debug/
    commands.js                 # all testing/admin commands (easy to disable for production)

  lib/
    log.js                      # optional: logging wrapper (thin)

  systems/                      # ALREADY EXISTS - DO NOT MOVE
    PersistenceManager.js       # Quest data storage (dynamic properties)
    QuestGenerator.js           # Random quest generation
    AtmosphereManager.js        # Quest board proximity effects
    SPManager.js                # SP scoreboard operations
    SPAnimator.js               # SP count-up animation
    RewardCalculator.js         # Quest reward calculation
    StreakTracker.js            # Consecutive quest completion tracking
    CelebrationManager.js       # Particle effects + sounds (SP + quest celebrations)
    EncounterManager.js         # Encounter quest generation
    EncounterSpawner.js         # Mob spawning/tagging/cleanup
    EncounterProximity.js       # Player position monitoring
    LocationValidator.js        # Zone selection/terrain validation
```

Notes:
- **DO NOT MOVE** existing manager modules from `/systems/` - they are already properly organized!
- `/systems/` contains infrastructure (persistence, generation, calculations, effects)
- `/features/` will contain UI and user-facing workflows extracted from main.js
- `CelebrationManager.js` stays in `/systems/` (it's infrastructure, not a feature)
- Encounter system (4 modules) stays in `/systems/` (well-organized, don't consolidate)

---

## Dependency Injection Pattern (Avoid Circular Imports)
Create one dependency container in `bootstrap/createDeps.js`.

### `createDeps.js`
- Instantiate managers that are currently created in `main.js` (if any remain).
- Return a `deps` object.

**IMPORTANT:** Most managers are already instantiated in their own modules and imported as named exports. Only a few managers (QuestGenerator, AtmosphereManager, PersistenceManager) may need instantiation. Check main.js for actual instantiation patterns.

`deps` should include only what features need, e.g.:

- `deps.persistence` (PersistenceManager instance or import)
- `deps.questGenerator` (QuestGenerator instance or import)
- `deps.atmosphere` (AtmosphereManager instance or import)
- `deps.celebration` (imported functions: celebrateSPGain, celebrateQuestComplete)
- `deps.sp` (imported functions: getSP, addSP, deductSP, etc.)
- `deps.rewardCalculator` (imported function: calculateCompletionReward)
- `deps.streakTracker` (imported functions: incrementStreak, getStreakInfo, etc.)
- `deps.encounters` (imported functions from 4 encounter modules)- `deps.hud` (imported functions: updateSPDisplay, updateQuestHud)
- `deps.leaderboard` (imported functions for leaderboard access)
### Usage
`main.js` should do:
1) `const deps = createDeps({ world, system })`
2) `initSystems({ world, system, deps })`
3) `registerEvents({ world, system, deps })`

No other module should directly instantiate global managers.

---

---

## Quick Reference: What's Being Extracted

This section helps you quickly locate code in main.js during implementation.

### Phase 1 - Data Tables (~120 lines)
| What | Line Range | Destination |
|------|-----------|-------------|
| TEXTURES + CATEGORY_TEXTURES | ~414-453 | `data/textures.js` |
| BOARD_TABS | ~457 | `data/boardTabs.js` |
| tutorials object | ~2124-2170 | `data/tutorials.js` |

### Phase 2 - Event Subscriptions (~200 lines)
| What | Line Range | Destination |
|------|-----------|-------------|
| All world.afterEvents.*.subscribe | Scattered | `events/registerEvents.js` |
| Event handler functions | Varies | Keep in features, call from events |

### Phase 3 - Quest Board + Leaderboard (~600 lines)
| What | Line Range | Destination |
|------|-----------|-------------|
| BLOCK_TAB_MAP | ~2185 | `features/questBoard/routing.js` |
| showQuestBoard, showAvailableTab, showActiveTab | ~1333, ~1179, ~1243 | `features/questBoard/ui.js` |
| handleUiAction, showQuestDetails, showManageQuest | ~1402, ~1460, ~1526 | `features/questBoard/actions.js` |
| Player name registry (6 functions) | ~554-619, ~1565, ~1291 | `features/leaderboard/leaderboardService.js` |

### Phase 4 - Quest Logic + HUD (~500 lines)
| What | Line Range | Destination |
|------|-----------|-------------|
| handleQuestAccept, handleQuestAbandon, handleQuestTurnIn | ~1006, ~1082, ~1883 | `features/quests/lifecycle.js` |
| handleEntityDeath, handleBlockBreak, markQuestComplete | ~1710, ~1843, ~1694 | `features/quests/progress.js` |
| getQuestIcon, getQuestColors | ~469, ~493 | `features/quests/formatters.js` |
| mobTypes.js | `quests/mobTypes.js` | `features/quests/mobTypes.js` (move) |
| updateSPDisplay, sendSPDisplayValue, updateQuestHud | ~763, ~789, ~1668 | `features/hud/hudManager.js` |

### Phase 5 - Tutorials (~150 lines)
| What | Line Range | Destination |
|------|-----------|-------------|
| showQuestMasterDialog, showTutorialPage | ~2080, ~2123 | `features/tutorials/atlasDialog.js` |

### Phase 6 - Supporting Systems (~1,300 lines)
| What | Line Range | Destination |
|------|-----------|-------------|
| Town music config + loop | ~130-155, ~2750-2830 | `features/ambient/townAmbience.js` |
| Dog barking config + loop | ~157-168, ~2832-2950 | `features/ambient/townAmbience.js` |
| Cat spawning config + loop | ~170-220, ~2952-3070 | `features/ambient/townAmbience.js` |
| All !encounter commands | ~2273-2638 | `debug/commands.js` |
| All /scriptevent handlers | ~2700-3250 | `debug/commands.js` |

**Total Extracted:** ~2,870+ lines directly identified (remaining ~370 lines are bootstrap/wiring code)

---

## Step-by-Step Refactor Tasks (Safe, Incremental)

### Phase 1 — Extract Data Tables (Lowest risk)
1. Create `scripts/data/textures.js`
   - Move `TEXTURES` and `CATEGORY_TEXTURES` (lines ~414-453 in main.js).
   - Export them as named exports.
2. Create `scripts/data/boardTabs.js`
   - Move `BOARD_TABS` constant (line ~457 in main.js).
   - Export it.
3. Create `scripts/data/tutorials.js`
   - Move `tutorials` object (line ~2124 in main.js with 4 topics).
   - Export it.
4. Update `main.js` to import these values.

**Verification:** server boots, UI opens, textures resolve, tutorial entries still appear.

---

### Phase 2 — Extract Event Wiring
1. Create `scripts/events/registerEvents.js`.
2. Move **all** `world.afterEvents.*.subscribe(...)` and `world.beforeEvents.*.subscribe(...)` from `main.js` into this file.
3. Keep handler logic in-place initially (move the handler functions too if they are only used by subscriptions).

`registerEvents({ world, system, deps })` should:
- subscribe to events
- call the same functions as before

**Verification:** core loops still work: kill tracking, quest updates, SP awarding, board interactions.

---

### Phase 3 — Extract Feature Modules (UI + actions)
#### 3A Quest Board
1. Create `scripts/features/questBoard/routing.js`
   - Move `BLOCK_TAB_MAP` (line ~2185 in main.js) - maps block IDs to tab names.
   - Move any tab selection/navigation logic.
2. Create `scripts/features/questBoard/ui.js`
   - Move `showQuestBoard()` and related tab UI builder functions.
   - Move form composition functions (detail views, layouts).
   - Move `showAvailableTab()`, `showActiveTab()` functions.
3. Create `scripts/features/questBoard/actions.js`
   - Move button click/selection handlers.
   - Move `handleUiAction()` function if it exists.

#### 3B Leaderboard System
1. Create `scripts/features/leaderboard/leaderboardService.js`
   - Move `loadPlayerNameRegistry()` (line ~554)
   - Move `savePlayerNameRegistry()` (line ~570)
   - Move `registerPlayerName()` (line ~583)
   - Move `lookupPlayerName()` (line ~619)
   - Move `getLeaderboardEntries()` (line ~1565)
   - Move `showLeaderboardTab()` (line ~1291)
   - Move player name registry Map (keep internal to module)

**Key rule:** UI modules should not import managers directly; they use `deps`.

---

### Phase 4 — Consolidate Quest Logic
1. Create `scripts/features/quests/lifecycle.js`
   - Move `handleQuestAccept()` (line ~1006)
   - Move `handleQuestAbandon()` (line ~1082)
   - Move `handleQuestTurnIn()` (line ~1883)
   - Move `handleRefresh()` / reroll logic (line ~956)
   - Extract accept/abandon/turn-in orchestration from main.js.
2. Create `scripts/features/quests/progress.js`
   - Move `handleEntityDeath()` (line ~1710)
   - Move `handleBlockBreak()` (line ~1843)
   - Move `markQuestComplete()` (line ~1694)
   - Entity kill increments, completion checks.
   - Block break tracking logic.
3. Create `scripts/features/quests/formatters.js`
   - Move `getQuestIcon()` function (line ~469)
   - Move `getQuestColors()` function (line ~493)
   - Quest title/description/icon/color helpers.
4. Move `scripts/quests/mobTypes.js` → `scripts/features/quests/mobTypes.js`
   - Consolidates all quest logic in one folder.
   - Update import in progress.js and other files.
   - Delete empty `/quests/` folder after move.
5. Create `scripts/features/hud/hudManager.js`
   - Move `updateSPDisplay()` (line ~763)
   - Move `sendSPDisplayValue()` (line ~789)
   - Move `updateQuestHud()` (line ~1668)
   - Pure display/presentation logic, no business logic.

**Verification:** completing a quest still behaves identically, HUD updates correctly.

---

### Phase 5 — Extract Tutorial System
1. Create `scripts/features/tutorials/atlasDialog.js`
   - Move `showQuestMasterDialog()` function (line ~2080).
   - Move `showTutorialPage()` function (line ~2123).
   - Import tutorials data from `data/tutorials.js`.

**Verification:** Atlas NPC dialog still works, tutorial pages display correctly.

---

### Phase 6 — Extract Supporting Systems
#### 6A Ambient Systems (Town Music, Dogs, Cats)
1. Create `scripts/features/ambient/townAmbience.js`
   - Move town music config constants (lines ~130-155: TOWN_MUSIC_SOUND_ID, TRACK_DURATION_TICKS, etc.)
   - Move dog barking config (lines ~157-168: DOG_SOUNDS, DOG_DISTANCE_TIERS, etc.)
   - Move cat spawning config (lines ~170-220: CAT_DISTANCE_TIERS, CAT_VARIANTS, etc.)
   - Move town music loop (from bootstrap, lines ~2750-2830)
   - Move dog barking loop (from bootstrap, lines ~2832-2950)
   - Move cat spawning loop (from bootstrap, lines ~2952-3070)
   - Move player state Maps: `playerMusicState`, `playerDogBarkState`, `playerCatSquad`
   - Export single function: `initTownAmbience({ world, system, questBoardLocation })`

#### 6B Debug/Testing Commands
1. Create `scripts/debug/commands.js`
   - Move all chat commands (lines ~2273-2638):
     - `!encounter test table/generate/zone/tp` commands
     - `!register names` command
   - Move all scriptevent handlers (lines ~2700-3250):
     - `sq:givesp` (admin SP gifts)
     - `sq:test_spgain` (celebration testing)
     - `sq:test_celebration` (quest celebration testing)
     - `sq:test_countup/instant/rapid` (animation testing)
     - `sq:encounter info/count/complete/spawn/despawn` (encounter debugging)
   - Export single function: `registerDebugCommands({ world, system, deps })`
   - **Benefit:** Easy to disable all debug commands for production by commenting one line.

**Verification:** Town music plays on proximity, dogs bark with distance-based intensity, cats spawn/despawn correctly, all debug commands work.

---

## Testing Checklist (Manual)
Run these in-game after each phase:
1) Open QuestBoard UI (interact with quest board blocks)
2) Check all 3 tabs (Available, Active, Leaderboard)
3) Verify leaderboard displays player names correctly
4) Accept a quest
5) Make progress (kill mob / break block)
6) Verify HUD updates (SP display + quest progress action bar)
7) Complete quest
8) Turn in quest
9) Verify SP changes + celebration sounds/particles
10) Test Atlas NPC dialog and all 4 tutorial pages
11) Test reroll functionality (free + paid)
12) Verify encounter quests still spawn/track correctly
13) Verify streak bonuses apply correctly
14) Walk near quest board - verify town music plays
15) Walk close to quest board - verify dog barking intensifies
16) Walk close to quest board - verify cats spawn (count increases with proximity)
17) Walk away from quest board - verify music stops, dogs stop, cats despawn
18) Test debug commands (if Phase 6 complete): `!encounter test table`, `/scriptevent sq:givesp`, etc.
19) Restart server, confirm persistence still loads
20) Test multiplayer (if applicable)

---

## Agent Instructions (Claude Code)
- Make changes incrementally by phase.
- After each phase: ensure the code compiles and game boots.
- Do not perform unrelated refactors (no renaming everything, no stylistic changes).
- Preserve comments and behavior.
- Prefer exporting existing functions rather than rewriting them.

---

## Implementation Notes
- Keep module boundaries practical: fewer, larger files are better than 40 tiny ones.
- Use default exports sparingly; prefer named exports for clarity.
- If circular imports appear, break them by pushing shared logic into the calling layer and passing `deps`.

---

---

## Refactor Impact Summary

### Main.js Size Reduction
- **Before:** 3,441 lines (monolithic controller)
- **After:** ~150-200 lines (bootstrap + wiring)
- **Reduction:** ~94% smaller, ~3,200 lines extracted

### Files Created (15+ new modules)
**Data Layer (3 files):**
- `data/textures.js`, `data/boardTabs.js`, `data/tutorials.js`

**Features (11 files):**
- Quest Board: `ui.js`, `actions.js`, `routing.js`
- Quests: `lifecycle.js`, `progress.js`, `formatters.js`, `mobTypes.js`
- Leaderboard: `leaderboardService.js`
- HUD: `hudManager.js`
- Tutorials: `atlasDialog.js`
- Ambient: `townAmbience.js`

**Infrastructure (2 files):**
- `bootstrap/createDeps.js`, `bootstrap/initSystems.js`

**Event Wiring (1 file):**
- `events/registerEvents.js`

**Debug/Testing (1 file):**
- `debug/commands.js`

### Code Organization Benefits
✅ **Single Responsibility:** Each module has one clear purpose  
✅ **Discoverability:** Features organized by domain, not by line number  
✅ **Testability:** Modules can be tested in isolation  
✅ **Maintainability:** Changes localized to specific modules  
✅ **Production-Ready:** Debug commands easily disabled  
✅ **Onboarding:** New developers find code by feature, not by scrolling  

---

## Deliverables
- New module files created per structure above (15+ new files)
- `main.js` reduced from **3,441 lines** to **~150-200 lines** (bootstrap + wiring only)
- Main.js final responsibilities:
  - Import deps and modules
  - Bootstrap sequence (create deps, init systems, register events)
  - World/player lifecycle event subscriptions (spawn, leave, worldInitialize)
  - Atlas NPC interaction subscription
  - Call ambient systems init
  - Call debug commands registration (if enabled)
  - Start quest loop (inventory monitoring, HUD updates)
- All imports updated
- No behavior changes
- `/quests/` folder removed (consolidated into `/features/quests/`)
- Debug commands easily toggleable for production builds

