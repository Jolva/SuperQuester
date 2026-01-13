import { world } from "@minecraft/server";

export class PersistenceManager {
  static KEY = "superquester:active_data"; // Legacy key
  static QUEST_DATA_KEY = "superquester:quest_data"; // New key

  /**
   * Saves the player's quest data to a dynamic property.
   * @param {Player} player 
   * @param {Array} quests 
   * @deprecated Use saveQuestData instead
   */
  static saveQuests(player, quests) {
    if (!player || !player.isValid()) return;
    try {
      const data = JSON.stringify(quests);
      player.setDynamicProperty(this.KEY, data);
    } catch (e) {
      console.warn(`[Persistence] Failed to save for ${player.name}: ${e}`);
    }
  }

  /**
   * Loads the player's quest data from dynamic property.
   * @param {Player} player 
   * @returns {Array} List of quest objects
   * @deprecated Use loadQuestData instead
   */
  static loadQuests(player) {
    if (!player || !player.isValid()) return [];
    try {
      const data = player.getDynamicProperty(this.KEY);
      if (typeof data !== 'string') return [];
      return JSON.parse(data);
    } catch (e) {
      console.warn(`[Persistence] Failed to load for ${player.name}: ${e}`);
      return [];
    }
  }

  /**
   * Loads the full quest data object for a player.
   * @param {Player} player
   * @returns {import("../main.js").QuestData|null}
   */
  static loadQuestData(player) {
    if (!player || !player.isValid()) return null;
    try {
      const data = player.getDynamicProperty(this.QUEST_DATA_KEY);
      if (typeof data !== 'string') return null;
      return JSON.parse(data);
    } catch (e) {
      console.warn(`[Persistence] Failed to load quest data for ${player.name}: ${e}`);
      return null;
    }
  }

  /**
   * Saves the full quest data object for a player.
   * @param {Player} player
   * @param {import("../main.js").QuestData} questData
   */
  static saveQuestData(player, questData) {
    if (!player || !player.isValid()) return;
    try {
      const data = JSON.stringify(questData);
      player.setDynamicProperty(this.QUEST_DATA_KEY, data);
    } catch (e) {
      console.warn(`[Persistence] Failed to save quest data for ${player.name}: ${e}`);
    }
  }

  /**
   * Wipes the player's quest data (both legacy and new).
   * @param {Player} player 
   */
  static wipeData(player) {
    if (!player || !player.isValid()) return;
    try {
      player.setDynamicProperty(this.KEY, undefined);
      player.setDynamicProperty(this.QUEST_DATA_KEY, undefined);
    } catch (e) {
      console.warn(`[Persistence] Failed to wipe data for ${player.name}: ${e}`);
    }
  }
}
