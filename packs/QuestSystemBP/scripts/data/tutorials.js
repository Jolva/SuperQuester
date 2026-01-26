/**
 * tutorials.js
 * Atlas NPC tutorial content definitions.
 * Contains all 4 tutorial topics available through the Quest Master dialog.
 */

/**
 * Tutorial page content for Atlas NPC.
 * Each topic has a title and body with formatted Minecraft text.
 * 
 * Available topics:
 * - how_quests_work: Quest system mechanics
 * - super_points: SP currency explanation
 * - rerolls: Refresh system details
 * - rarities: Quest tier breakdown
 */
export const tutorials = {
  how_quests_work: {
    title: "§2How Quests Work",
    body:
      "§fThe Quest Board offers you §e3 personal quests§f that refresh every §b24 hours§f.\n\n" +
      "§7• §fYou can have §eONE active quest§f at a time\n" +
      "§7• §fComplete it by meeting the goal (kill mobs, mine blocks, or gather items)\n" +
      "§7• §fReturn to the board to §aturn in§f your completed quest\n" +
      "§7• §fCompleting all 3 quests triggers a §dbonus refresh§f!\n\n" +
      "§8Tip: Sneak + interact with the board to place blocks nearby."
  },
  super_points: {
    title: "§eSuper Points (SP)",
    body:
      "§6SP§f is the currency of the Quest Board.\n\n" +
      "§7• §fEarn SP by completing quests\n" +
      "§7• §fHigher rarity quests (§brare§f, §6legendary§f, §dmythic§f) give more SP\n" +
      "§7• §fSP is tracked on the §dLeaderboard§f tab\n" +
      "§7• §fSpend SP on §cpaid rerolls§f when your free one is used\n\n" +
      "§8Future: SP will unlock rewards, cosmetics, and more!"
  },
  rerolls: {
    title: "§bRerolls & Refreshes",
    body:
      "§fDon't like your available quests? You have options:\n\n" +
      "§a§lFree Reroll§r\n" +
      "§7You get §eONE free reroll§7 per 24-hour cycle. Use it wisely!\n\n" +
      "§c§lPaid Rerolls§r\n" +
      "§7After your free reroll, you can spend §6SP§7 for more:\n" +
      "§7• 1st-2nd paid: §e100 SP§7 each → 3rd: §e200 SP§7 → 4th: §e400 SP§7...\n\n" +
      "§d§l24-Hour Refresh§r\n" +
      "§7Every 24 hours, your quests fully refresh and rerolls reset."
  },
  rarities: {
    title: "§dQuest Rarities",
    body:
      "§fQuests come in four rarity tiers:\n\n" +
      "§7§lCOMMON§r §f(70%) - Basic rewards\n" +
      "§b§lRARE§r §f(22%) - 2x item rewards, higher SP\n" +
      "§6§lLEGENDARY§r §f(7%) - 5x items, massive SP, marked with §6golden crown§f\n" +
      "§d§lMYTHIC§r §f(1%) - 10x items, jackpot SP, marked with §dcrimson gem§f\n\n" +
      "§7• §fHigher rarities = better rewards & SP multipliers\n" +
      "§7• §fJackpot bonuses can trigger on any quest!\n" +
      "§7• §fStreak bonuses stack with rarity for huge payouts\n\n" +
      "§8If you see a mythic, don't reroll it!"
  }
};
