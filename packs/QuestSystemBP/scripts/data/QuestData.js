export const MOB_POOL = [
  { id: "minecraft:zombie", name: "Zombie", category: "undead", baseCount: 10, xp: 1 },
  { id: "minecraft:skeleton", name: "Skeleton", category: "undead", baseCount: 8, xp: 2 },
  { id: "minecraft:spider", name: "Spider", category: "beast", baseCount: 8, xp: 1 },
  { id: "minecraft:creeper", name: "Creeper", category: "monster", baseCount: 5, xp: 3 },
  { id: "minecraft:drowned", name: "Drowned", category: "undead", baseCount: 8, xp: 2 },
];

export const ITEM_POOL = [
  { id: "minecraft:oak_log", name: "Oak Log", type: "gather", baseCount: 32, category: "gathering" },
  { id: "minecraft:birch_log", name: "Birch Log", type: "gather", baseCount: 32, category: "gathering" },
  { id: "minecraft:coal_ore", name: "Coal Ore", type: "mine", baseCount: 16, category: "mining", blockIds: ["minecraft:coal_ore", "minecraft:deepslate_coal_ore"] },
  { id: "minecraft:iron_ore", name: "Iron Ore", type: "mine", baseCount: 12, category: "mining", blockIds: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"] },
  { id: "minecraft:cobblestone", name: "Cobblestone", type: "gather", baseCount: 64, category: "mining" },
  { id: "minecraft:wheat", name: "Wheat", type: "gather", baseCount: 32, category: "farming" },
];

export const LORE_TEMPLATES = {
  undead: [
    "The local priest reports strange groanings from the crypts. Put the restless dead back to sleep.",
    "A dark energy is rising from the graveyards. We must thin their numbers before nightfall.",
    "They say the dead do not sleep comfortably tonight. Prove them right."
  ],
  beast: [
    "Wild beasts have been encroaching on the farmlands. Cull them to protect the harvest.",
    "Travelers are afraid to take the east road. Make it safe again.",
    "Something is stirring in the dark corners of the woods."
  ],
  monster: [
    "A dangerous monstrosity threatens the village outskirts. Eliminate it with extreme prejudice.",
    "Explosive tempers are flaring. Watch your step and neutralize the threat.",
    "We cannot allow these creatures to establish a foothold near our homes."
  ],
  mining: [
    "The blacksmith is running low on fuel for the forge. Retrieve resources from the depths.",
    "We need raw materials to reinforce the town walls. Dig deep.",
    "The masons are asking for more supplies. The quarry awaits."
  ],
  gathering: [
    "Winter is coming, and the town stockpile is empty. We need lumber for repairs and warmth.",
    "The carpenter needs fresh timber for the new barn construction.",
    "Stockpile resources for the coming festival."
  ],
  farming: [
    "The bakery is running low on flour. Harvest the fields.",
    "Famine threatens if we don't stock the granary now."
  ]
};
