# UI Form Icons — Implementation Guide

## Overview

Now that the action bar font experiment is cleaned up, we're implementing proper icons for the quest UI forms. These are 64×64 PNG textures used in `ActionFormData` button calls.

## Asset Location

All icons should be placed in:
```
packs/QuestSystemRP/textures/quest_ui/
```

## Files Expected

```
textures/quest_ui/
├── icon_undead.png      # Skull
├── icon_beast.png       # Claw
├── icon_monster.png     # Evil Eye
├── icon_passive.png     # Feather
├── icon_nether.png      # Portal Swirl
├── icon_aquatic.png     # Water Drop
├── icon_gathering.png   # Logs
├── icon_mining.png      # Pickaxe
├── icon_farming.png     # Wheat
├── icon_refresh.png     # Circular Arrows
├── icon_complete.png    # Checkmark
├── icon_legendary.png   # Gold Crown Badge
├── icon_rare.png        # Diamond Badge
├── icon_clock.png       # Clock Face
├── icon_trophy.png      # Trophy Cup
├── icon_alert.png       # Exclamation
├── icon_sp_coin.png     # SP Gold Coin
└── icon_crown.png       # Crown
```

---

## Cleanup — Delete Old Icons

These files are no longer needed and should be removed from `packs/QuestSystemRP/textures/quest_ui/`:

```
quest_tab_avail.png    ← DELETE (legacy tab system)
quest_tab_active.png   ← DELETE (legacy tab system)
quest_tab_stats.png    ← DELETE (legacy tab system)
quest_tab_done.png     ← DELETE (legacy tab system, if exists)
cat_slay.png           ← DELETE (replaced by category icons)
cat_mine.png           ← DELETE (replaced by category icons)
```

Keep `sp_coin.png` temporarily if the new `icon_sp_coin.png` isn't ready, but replace it once available.

---

## Code Changes

### 1. Update TEXTURES Object in main.js

Replace the existing `TEXTURES` object (around line 58) which currently looks like:

```javascript
// CURRENT CODE — REPLACE THIS
const TEXTURES = {
  TAB_AVAILABLE: "textures/quest_ui/quest_tab_avail.png",
  TAB_ACTIVE: "textures/quest_ui/quest_tab_active.png",
  TAB_LEADERBOARD: "textures/quest_ui/quest_tab_stats.png",
  QUEST_KILL: "textures/quest_ui/cat_slay.png",
  QUEST_MINE: "textures/quest_ui/cat_mine.png",
  QUEST_GATHER: "textures/quest_ui/cat_mine.png",
  DEFAULT: "textures/items/book_writable",
};
```

With:

```javascript
const TEXTURES = {
  // Quest Categories
  CATEGORY_UNDEAD: "textures/quest_ui/icon_undead.png",
  CATEGORY_BEAST: "textures/quest_ui/icon_beast.png",
  CATEGORY_MONSTER: "textures/quest_ui/icon_monster.png",
  CATEGORY_PASSIVE: "textures/quest_ui/icon_passive.png",
  CATEGORY_NETHER: "textures/quest_ui/icon_nether.png",
  CATEGORY_AQUATIC: "textures/quest_ui/icon_aquatic.png",
  CATEGORY_GATHERING: "textures/quest_ui/icon_gathering.png",
  CATEGORY_MINING: "textures/quest_ui/icon_mining.png",
  CATEGORY_FARMING: "textures/quest_ui/icon_farming.png",

  // UI Elements
  REFRESH: "textures/quest_ui/icon_refresh.png",
  COMPLETE: "textures/quest_ui/icon_complete.png",
  LEGENDARY: "textures/quest_ui/icon_legendary.png",
  RARE: "textures/quest_ui/icon_rare.png",
  CLOCK: "textures/quest_ui/icon_clock.png",
  TROPHY: "textures/quest_ui/icon_trophy.png",
  ALERT: "textures/quest_ui/icon_alert.png",
  SP_COIN: "textures/quest_ui/icon_sp_coin.png",
  CROWN: "textures/quest_ui/icon_crown.png",

  // Fallback
  DEFAULT: "textures/items/book_writable",
};
```

### 2. Add Category-to-Texture Mapping

Add this new mapping object after `TEXTURES`:

```javascript
const CATEGORY_TEXTURES = {
  // Kill quest categories
  undead: TEXTURES.CATEGORY_UNDEAD,
  beast: TEXTURES.CATEGORY_BEAST,
  monster: TEXTURES.CATEGORY_MONSTER,
  passive: TEXTURES.CATEGORY_PASSIVE,
  nether: TEXTURES.CATEGORY_NETHER,
  aquatic: TEXTURES.CATEGORY_AQUATIC,

  // Resource quest categories
  gathering: TEXTURES.CATEGORY_GATHERING,
  mining: TEXTURES.CATEGORY_MINING,
  farming: TEXTURES.CATEGORY_FARMING,
};
```

### 3. Update getQuestIcon Function

Replace the existing `getQuestIcon` function (around line 75) which currently looks like:

```javascript
// CURRENT CODE — REPLACE THIS
function getQuestIcon(def) {
  if (def.icon) return def.icon;
  if (def.type === "kill") return TEXTURES.QUEST_KILL;
  if (def.type === "mine") return TEXTURES.QUEST_MINE;
  if (def.type === "gather") return TEXTURES.QUEST_GATHER;
  return TEXTURES.DEFAULT;
}
```

With this new version that supports categories AND rarity overrides:

```javascript
/**
 * Get icon for a quest based on rarity and category
 * @param {Object} quest - Quest object with category and rarity fields
 * @param {boolean} showRarityBadge - If true, legendary/rare quests show rarity icon instead
 * @returns {string} Texture path
 */
function getQuestIcon(quest, showRarityBadge = false) {
  // Rarity badge override (for special visual emphasis)
  if (showRarityBadge) {
    if (quest.rarity === "legendary") return TEXTURES.LEGENDARY;
    if (quest.rarity === "rare") return TEXTURES.RARE;
  }

  // Category-based icon (primary system)
  if (quest.category && CATEGORY_TEXTURES[quest.category]) {
    return CATEGORY_TEXTURES[quest.category];
  }

  // Fallback to type-based (legacy support)
  if (quest.type === "kill") return TEXTURES.CATEGORY_UNDEAD;
  if (quest.type === "mine") return TEXTURES.CATEGORY_MINING;
  if (quest.type === "gather") return TEXTURES.CATEGORY_GATHERING;

  return TEXTURES.DEFAULT;
}
```

### 4. Update showAvailableTab — Refresh Button

In `showAvailableTab` function, find the refresh button (around line 427) and update:

```javascript
// OLD
form.button(refreshLabel, "textures/quest_ui/sp_coin.png");

// NEW — Use SP Coin for paid, Refresh icon for free
const refreshIcon = data.freeRerollAvailable 
  ? TEXTURES.REFRESH 
  : TEXTURES.SP_COIN;
form.button(refreshLabel, refreshIcon);
```

### 5. Update showActiveTab — Turn In Button

In `showActiveTab` function, find the turn-in button (around line 470) and update:

```javascript
// OLD
form.button(`§aTurn In: ${quest.title}§r`, "textures/quest_ui/quest_tab_done.png");

// NEW
form.button(`§aTurn In: ${quest.title}§r`, TEXTURES.COMPLETE);
```

### 6. Update showActiveTab — Active Quest Button

Also in `showActiveTab`, update the in-progress quest button to use category icons:

```javascript
// OLD
form.button(`${colors.button}${quest.title}\n§8${progressStr}§r`, icon);

// NEW — icon now comes from getQuestIcon which uses categories
const icon = getQuestIcon(quest);
form.button(`${colors.button}${quest.title}\n§8${progressStr}§r`, icon);
```

### 7. Use Rarity Badges in Available Quests

In `showAvailableTab`, update the quest button loop to show rarity badges for legendary/rare quests:

```javascript
// Around line 417-424
data.available.forEach((quest, index) => {
  if (quest) {
    // Show rarity badge for legendary/rare, category icon for common
    const showRarityBadge = quest.rarity === "legendary" || quest.rarity === "rare";
    const icon = getQuestIcon(quest, showRarityBadge);
    const colors = getQuestColors(quest.rarity);
    form.button(`${colors.button}${quest.title}§r`, icon);
    actions.push({ type: "view_details", questIndex: index, fromStandalone: isStandalone });
  }
});
```

This means:
- **Legendary quests** → Gold crown badge icon
- **Rare quests** → Diamond badge icon  
- **Common quests** → Category icon (skull, pickaxe, wheat, etc.)

---

## Category Propagation — CONFIRMED ✓

`QuestGenerator.js` already passes `category` through to quest objects:

```javascript
// Line 92 (kill quests)
category: target.category, // For icon system lookup

// Line 127 (gather/mine quests)  
category: target.category, // For icon system lookup
```

No changes needed here.

---

## Testing Checklist

1. **Available Quests Tab**
   - [ ] Common kill quests show category icon (skull for undead, claw for beast, etc.)
   - [ ] Common mine quests show pickaxe icon
   - [ ] Common gather quests show logs or wheat icon based on category
   - [ ] **Rare quests show diamond badge icon**
   - [ ] **Legendary quests show gold crown badge icon**
   - [ ] Free reroll button shows refresh arrows icon
   - [ ] Paid reroll button shows SP coin icon

2. **Active Quest Tab**
   - [ ] Active quest shows correct category icon (not rarity badge)
   - [ ] Turn In button shows checkmark icon

3. **Quest Details Modal**
   - [ ] Icon matches the quest category

4. **Edge Cases**
   - [ ] Quest with missing category falls back gracefully
   - [ ] No console errors about missing textures

---

## Future Use (Not Implemented Yet)

These icons are ready for future features:

| Icon | Future Use |
|------|------------|
| `icon_clock.png` | Daily timer countdown display |
| `icon_trophy.png` | Jackpot celebration, stats screen |
| `icon_alert.png` | "Ready to turn in" notification |
| `icon_crown.png` | VIP features, Gacha system |

Note: `icon_legendary.png` and `icon_rare.png` are now actively used for rarity badges in the Available Quests list.
