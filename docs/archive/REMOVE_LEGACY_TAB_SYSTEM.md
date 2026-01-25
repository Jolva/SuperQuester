# Remove Legacy Tab System

## Context

When SuperQuester was first created, the quest board used a **single form UI with tab navigation** - one ActionFormData with buttons to switch between Available, Active, and Leaderboard tabs.

The system was later redesigned to use a **3x3 physical quest board** where each column of blocks opens a separate, dedicated menu:
- **Left column** (avail_top/mid/bot) → Opens Available quests menu directly
- **Middle column** (active_top/mid/bot) → Opens Active quest menu directly  
- **Right column** (leader_top/mid/bot) → Opens Leaderboard menu directly

However, the old tab system code is still present throughout the codebase, creating confusion and unnecessary complexity.

## Goal

Remove all legacy tab navigation code while preserving the physical block-to-menu mapping system.

## What Needs to Be Removed

### 1. BOARD_TABS Constant
- **File:** `packs/QuestSystemBP/scripts/data/boardTabs.js` - DELETE ENTIRE FILE
- **File:** `packs/QuestSystemBP/scripts/main.js`
  - Line 97: Remove `import { BOARD_TABS } from "./data/boardTabs.js";`
  - Line 337-341: Remove the `BOARD_TABS` object definition
  - Remove `BOARD_TABS` from all deps objects passed to functions

### 2. Tab Navigation Functions
- **File:** `packs/QuestSystemBP/scripts/features/questBoard/routing.js`
  - Remove `playerTabState` Map (stores which tab player is viewing)
  - Remove `setPlayerTab(player, tab)` function
  - Remove `getPlayerTab(player, BOARD_TABS, ensureQuestData)` function
  - **KEEP:** `BLOCK_TAB_MAP` (rename to `BLOCK_MENU_MAP`)

### 3. Tab Button Rendering
- **File:** `packs/QuestSystemBP/scripts/features/questBoard/ui.js`
  - Remove `getTabsConfig(BOARD_TABS)` function (lines ~24-30)
  - Remove `addTabButtons(form, currentTab, actionsList, BOARD_TABS)` function (lines ~39-50)
  - Remove all calls to `addTabButtons()` in:
    - `showAvailableQuestsTab()` - line ~108
    - `showActiveQuestTab()` - line ~164

### 4. Leaderboard Tab System
- **File:** `packs/QuestSystemBP/scripts/features/leaderboard/leaderboardService.js`
  - `showLeaderboardTab()` function (line ~186):
    - Remove `BOARD_TABS` parameter
    - Remove `addTabButtons` parameter
    - Remove `isStandalone` parameter (always standalone now)
    - Remove lines ~214-216: `if (!isStandalone && addTabButtons && BOARD_TABS)`
    - Remove line ~220: action with `tab: BOARD_TABS.LEADERBOARD`
  - Simplify to just show leaderboard data with Refresh/Close buttons

### 5. Update Function Signatures

Remove `BOARD_TABS` from deps objects in:
- `main.js`:
  - `showQuestBoard()` wrapper - line ~761
  - `handleUiAction()` wrapper - line ~783
  - `showQuestMasterDialog()` wrapper - line ~1090
- `features/questBoard/ui.js`:
  - `showAvailableQuestsTab()` - line ~70
  - `showActiveQuestTab()` - line ~148
  - `showQuestDetails()` - line ~210
  - `showManageQuest()` - line ~289
  - `showQuestBoard()` - destructure from deps
- `features/tutorials/atlasNpc.js`:
  - `showQuestMasterDialogBase()` - line ~30

### 6. Update Block Interaction Logic
- **File:** `packs/QuestSystemBP/scripts/main.js`
  - `wireInteractions()` function (line ~1149):
    - Rename `BLOCK_TAB_MAP` to `BLOCK_MENU_MAP`
    - Update to use menu type strings directly: `"available"`, `"active"`, `"leaderboard"`
    - Change `showQuestBoard(player, tab, true)` to `showQuestBoard(player, menuType, true)`
  - Remove import of `BOARD_TABS` from routing.js

## What Needs to Be Kept

### BLOCK_MENU_MAP (formerly BLOCK_TAB_MAP)
This maps physical quest board blocks to menu types and **must be preserved**:

```javascript
// routing.js
export const BLOCK_MENU_MAP = {
  // Available Column
  "quest:avail_top": "available",
  "quest:avail_mid": "available",
  "quest:avail_bot": "available",
  // Active Column
  "quest:active_top": "active",
  "quest:active_mid": "active",
  "quest:active_bot": "active",
  // Leaderboard Column
  "quest:leader_top": "leaderboard",
  "quest:leader_mid": "leaderboard",
  "quest:leader_bot": "leaderboard"
};
```

## Menu Type Strings

After cleanup, the system should use these simple string literals:
- `"available"` - Shows 3 available quests, refresh button
- `"active"` - Shows active quest progress, turn-in/abandon
- `"leaderboard"` - Shows top players by SP

## Implementation Order

1. **Delete boardTabs.js** and remove BOARD_TABS constant from main.js
2. **Clean up routing.js** - remove tab state, rename BLOCK_TAB_MAP to BLOCK_MENU_MAP
3. **Remove addTabButtons()** from ui.js and all call sites
4. **Simplify leaderboardService.js** - remove tab parameters
5. **Update function signatures** - remove BOARD_TABS from all deps objects
6. **Update wireInteractions()** - use BLOCK_MENU_MAP and menu type strings
7. **Update imports** - remove BOARD_TABS imports everywhere

## Testing Checklist

After implementation, verify:
- [ ] Click left column (avail blocks) → Opens Available quests menu
- [ ] Click middle column (active blocks) → Opens Active quest menu
- [ ] Click right column (leader blocks) → Opens Leaderboard
- [ ] All menus have correct buttons (no extra tab navigation buttons)
- [ ] Atlas NPC dialog → Quest Board opens correctly
- [ ] Leaderboard shows player names and SP correctly
- [ ] No references to BOARD_TABS remain in codebase
- [ ] No console errors about undefined BOARD_TABS

## Files to Modify

1. `packs/QuestSystemBP/scripts/data/boardTabs.js` - **DELETE**
2. `packs/QuestSystemBP/scripts/main.js` - Remove BOARD_TABS, update deps, update wireInteractions
3. `packs/QuestSystemBP/scripts/features/questBoard/routing.js` - Remove tab state, rename map
4. `packs/QuestSystemBP/scripts/features/questBoard/ui.js` - Remove addTabButtons, update deps
5. `packs/QuestSystemBP/scripts/features/leaderboard/leaderboardService.js` - Simplify function
6. `packs/QuestSystemBP/scripts/features/tutorials/atlasNpc.js` - Remove BOARD_TABS from deps

## Success Criteria

- Physical quest board blocks open correct menus directly (no tab switching)
- No BOARD_TABS constant exists anywhere in codebase
- No tab navigation buttons appear in any menu
- All functionality works identically to before (just cleaner code)
- Documentation is clearer for future developers

## Why This Matters

The legacy tab system adds ~200+ lines of unnecessary code and creates confusion:
- Functions have unused parameters (`BOARD_TABS`, `addTabButtons`, `currentTab`)
- New developers might think tab navigation is required
- The actual menu routing is obscured by legacy abstractions
- Future bugs could arise from maintaining unused code paths

Removing this simplifies the codebase and makes the actual architecture clear: **physical blocks → direct menu opens**.
