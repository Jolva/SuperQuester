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

Replace the existing `TEXTURES` object (around line 57) with:

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

Replace the existing `getQuestIcon` function (around line 74):

```javascript
function getQuestIcon(quest) {
  // First, try category-based icon
  if (quest.category && CATEGORY_TEXTURES[quest.category]) {
    return CATEGORY_TEXTURES[quest.category];
  }

  // Fallback to type-based (legacy)
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

### 6. Optional: Rarity-Based Icon Override

For legendary/rare quests, you might want to show the rarity badge instead of (or alongside) the category icon. Here's an optional enhancement to `getQuestIcon`:

```javascript
function getQuestIcon(quest, useRarityIcon = false) {
  // Option to show rarity badge instead
  if (useRarityIcon) {
    if (quest.rarity === "legendary") return TEXTURES.LEGENDARY;
    if (quest.rarity === "rare") return TEXTURES.RARE;
  }

  // Category-based icon
  if (quest.category && CATEGORY_TEXTURES[quest.category]) {
    return CATEGORY_TEXTURES[quest.category];
  }

  // Fallback to type-based
  if (quest.type === "kill") return TEXTURES.CATEGORY_UNDEAD;
  if (quest.type === "mine") return TEXTURES.CATEGORY_MINING;
  if (quest.type === "gather") return TEXTURES.CATEGORY_GATHERING;

  return TEXTURES.DEFAULT;
}
```

---

## Verify Category Propagation

**IMPORTANT:** For category icons to work, the quest objects must have a `category` field. Check `QuestGenerator.js` to ensure it passes through the category from `QuestData.js`.

The quest pools already have categories defined:
```javascript
// From QuestData.js
{ id: "minecraft:zombie", category: "undead", ... }
{ id: "minecraft:coal_ore", category: "mining", ... }
```

Make sure `QuestGenerator.js` includes `category` in the generated quest object:
```javascript
// In the quest generation logic, ensure this is included:
const quest = {
  title: "Kill 10 Zombies",
  type: "kill",
  category: mobData.category,  // ← This must be passed through
  // ... other fields
};
```

---

## Testing Checklist

1. **Available Quests Tab**
   - [ ] Kill quests show appropriate category icon (skull for zombie, claw for spider, etc.)
   - [ ] Mine quests show pickaxe icon
   - [ ] Gather quests show logs or farming icon based on category
   - [ ] Free reroll button shows refresh arrows icon
   - [ ] Paid reroll button shows SP coin icon

2. **Active Quest Tab**
   - [ ] Active quest shows correct category icon
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
| `icon_legendary.png` | Rarity indicator in quest list |
| `icon_rare.png` | Rarity indicator in quest list |
| `icon_crown.png` | VIP features, Gacha system |
