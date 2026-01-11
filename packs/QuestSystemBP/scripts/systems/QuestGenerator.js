import { MOB_POOL, ITEM_POOL, LORE_TEMPLATES } from "../data/QuestData.js";

export class QuestGenerator {
  static generateDailyQuests(count = 3) {
    const quests = [];
    for (let i = 0; i < count; i++) {
      quests.push(this.generateQuest());
    }
    return quests;
  }

  static generateQuest() {
    // 50/50 chance of Kill vs Gather/Mine
    const isKill = Math.random() < 0.5;
    let quest;

    if (isKill) {
      quest = this.generateKillQuest();
    } else {
      quest = this.generateGatherQuest();
    }

    // Rarity Logic
    const roll = Math.random();
    let rarity = "common";
    let multiplier = 1;
    let color = "§7";

    if (roll >= 0.9) {
      rarity = "legendary";
      multiplier = 5;
      color = "§6§l";
    } else if (roll >= 0.6) {
      rarity = "rare";
      multiplier = 2;
      color = "§b";
    }

    // Apply Rarity
    quest.rarity = rarity;
    // quest.title modifies handled in display layers now
    // quest.title = `${color}${quest.title}§r`;

    // Multiply Rewards
    if (quest.reward) {
      if (quest.reward.scoreboardIncrement) {
        quest.reward.scoreboardIncrement = Math.ceil(quest.reward.scoreboardIncrement * multiplier);
      }
      if (quest.reward.rewardItems) {
        quest.reward.rewardItems.forEach(item => {
          item.amount = Math.ceil(item.amount * multiplier);
        });
      }
    }

    return quest;
  }

  static generateKillQuest() {
    const target = MOB_POOL[Math.floor(Math.random() * MOB_POOL.length)];
    const variance = Math.floor(Math.random() * 5); // 0-4 extra
    const count = target.baseCount + variance;

    const loreList = LORE_TEMPLATES[target.category] || LORE_TEMPLATES["monster"];
    const lore = loreList[Math.floor(Math.random() * loreList.length)];

    // Reward: 1 Diamond per 10 mobs (rounded up), +1 Score
    const diamondCount = Math.ceil(count / 10);

    return {
      id: `kill_${target.id.split(":")[1]}_${Date.now()}_${Math.floor(Math.random() * 1000)}`, // Unique ID
      title: `Kill ${count} ${target.name}s`,
      description: lore,
      type: "kill",
      requiredCount: count,
      targets: new Set([target.id.replace("minecraft:", "")]), // Simple ID for mob types logic if needed, or full ID
      // Note: mobTypes.js might expect simple IDs (e.g. "zombie") or full IDs. 
      // Main.js usually checks `getMobType` result. Let's ensure compatibility.
      // Current main.js uses `targets: new Set(["zombie"])`.

      // We'll store the raw typeId here, main.js might need adaptation if it expects "zombie" vs "minecraft:zombie"
      targetMobId: target.id,

      reward: {
        scoreboardIncrement: 1,
        rewardItems: [
          { typeId: "minecraft:diamond", amount: diamondCount }
        ]
      }
    };
  }

  static generateGatherQuest() {
    const target = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
    const variance = Math.floor(Math.random() * 10);
    const count = target.baseCount + variance;

    const loreList = LORE_TEMPLATES[target.category] || LORE_TEMPLATES["gathering"];
    const lore = loreList[Math.floor(Math.random() * loreList.length)];

    // Reward: 1 Iron Ingot per 16 items (rounded up), +1 Score
    const ironCount = Math.ceil(count / 16);

    const quest = {
      id: `${target.type}_${target.id.split(":")[1]}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: `${target.type === "mine" ? "Mine" : "Gather"} ${count} ${target.name}`,
      description: lore,
      type: target.type, // "mine" or "gather"
      requiredCount: count,
      reward: {
        scoreboardIncrement: 1,
        rewardItems: [
          { typeId: "minecraft:iron_ingot", amount: ironCount }
        ]
      }
    };

    if (target.type === "mine") {
      quest.targetBlockIds = target.blockIds || [target.id];
    } else {
      // gather
      quest.targetItemIds = [target.id]; // Logic support arrays
    }

    return quest;
  }
}
