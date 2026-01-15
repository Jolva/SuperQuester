/**
 * Custom Font Icons — Private Use Area Characters
 * These map to sprites in RP/font/glyph_E1.png via RP/font/default8.json
 * 
 * Sprite Sheet: 512x512, 64x64 cells, 8x8 grid
 */

export const ICONS = {
  // ═══════════════════════════════════════════
  // KILL QUEST CATEGORIES (Row 0, positions 0-5)
  // ═══════════════════════════════════════════
  UNDEAD:   "\uE100",  // Skull — Zombie, Skeleton, Drowned, Phantom...
  BEAST:    "\uE101",  // Claw — Spider, Wolf, Cave Spider...
  MONSTER:  "\uE102",  // Evil Eye — Creeper, Slime, Witch, Enderman...
  PASSIVE:  "\uE103",  // Feather — Chicken, Cow, Pig, Sheep...
  NETHER:   "\uE104",  // Portal Swirl — Blaze, Piglin, Ghast...
  AQUATIC:  "\uE105",  // Water Drop — Guardian, Fish, Drowned...

  // ═══════════════════════════════════════════
  // RESOURCE CATEGORIES (Row 0 pos 6-7, Row 1 pos 0)
  // ═══════════════════════════════════════════
  GATHERING: "\uE106", // Logs — Wood, cobblestone, generic items
  MINING:    "\uE107", // Pickaxe/Ore — Ores, stone, deepslate
  FARMING:   "\uE108", // Wheat — Crops, seeds, produce

  // ═══════════════════════════════════════════
  // UI ICONS (Row 1, positions 1-7)
  // ═══════════════════════════════════════════
  REFRESH:   "\uE109", // Circular arrows — Reroll button
  COMPLETE:  "\uE10A", // Checkmark — Quest complete
  LEGENDARY: "\uE10B", // Gold crown badge — Legendary rarity
  RARE:      "\uE10C", // Diamond badge — Rare rarity
  CLOCK:     "\uE10D", // Clock face — Daily refresh timer
  TROPHY:    "\uE10E", // Trophy cup — Jackpot celebration
  ALERT:     "\uE10F", // Exclamation — Ready to turn in

  // ═══════════════════════════════════════════
  // CURRENCY & EXTRAS (Row 2)
  // ═══════════════════════════════════════════
  SP_COIN:   "\uE110", // Gold SP coin — Currency display
  CROWN:     "\uE111", // Crown — VIP/Premium (future use)
};

/**
 * Map quest categories to their icons
 */
export const CATEGORY_ICON_MAP = {
  // Kill quest categories
  undead:   ICONS.UNDEAD,
  beast:    ICONS.BEAST,
  monster:  ICONS.MONSTER,
  passive:  ICONS.PASSIVE,
  nether:   ICONS.NETHER,
  aquatic:  ICONS.AQUATIC,
  
  // Resource quest categories  
  gathering: ICONS.GATHERING,
  mining:    ICONS.MINING,
  farming:   ICONS.FARMING,
};

/**
 * Get icon for a quest based on its category
 * @param {string} category - The quest category (e.g., "undead", "mining")
 * @returns {string} The icon character, or empty string if not found
 */
export function getIconForCategory(category) {
  return CATEGORY_ICON_MAP[category] || "";
}
