import { world } from "@minecraft/server";

export class PersistenceManager {
  static KEY = "superquester:active_data";

  /**
   * Saves the player's quest data to a dynamic property.
   * @param {Player} player 
   * @param {Array} quests 
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
   * Wipes the player's quest data.
   * @param {Player} player 
   */
  static wipeData(player) {
    if (!player || !player.isValid()) return;
    try {
      player.setDynamicProperty(this.KEY, undefined);
    } catch (e) {
      console.warn(`[Persistence] Failed to wipe data for ${player.name}: ${e}`);
    }
  }
}
