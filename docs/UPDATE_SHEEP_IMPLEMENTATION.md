# Update Sheep Implementation - AI Agent Handoff

## Context
This is a Minecraft Bedrock Edition add-on for a quest system called "SuperQuester". The project uses:
- **Behavior Pack**: `packs/QuestSystemBP/`
- **Resource Pack**: `packs/QuestSystemRP/`
- **Minecraft Bedrock Server** with custom scripts

## Task: Create "Update Sheep" NPC

Create an interactive sheep NPC with a nametag "Update Sheep" that displays a scrollable list of date-stamped game updates when players interact with it.

## Reference Implementation
The codebase already has a similar NPC called "Atlas" (quest_master). Use this as a template:
- **Behavior Pack Entity**: `packs/QuestSystemBP/entities/quest_master.json`
- **Resource Pack Entity**: `packs/QuestSystemRP/entity/quest_master.entity.json`
- **Render Controller**: `packs/QuestSystemRP/render_controllers/quest_master.render_controllers.json`
- **Interaction Handler**: `packs/QuestSystemBP/scripts/features/tutorials/atlasNpc.js`
- **Data File**: `packs/QuestSystemBP/scripts/data/tutorials.js`
- **Localization**: `packs/QuestSystemRP/texts/en_US.lang`

## Implementation Steps

### 1. Create Update Log Data File
**File**: `packs/QuestSystemBP/scripts/data/updateLog.js`

```javascript
/**
 * updateLog.js
 * Game update changelog for Update Sheep NPC.
 * 
 * Add new updates at the TOP of the array (most recent first).
 */

export const updateLog = [
  {
    date: "January 25, 2026",
    title: "SPSS Store & Protection",
    details: "Added Super Points Super Store with custom 2x2 display blocks, background music zone, and protected area (+3 block buffer)."
  },
  {
    date: "January 25, 2026",
    title: "Security Update",
    details: "Changed default player permissions to 'member' and disabled cheats for cleaner gameplay. Operators maintain full access."
  },
  {
    date: "January 2026",
    title: "Quest System Launch",
    details: "Initial release with quest board, daily quests, encounter system, leaderboard, and town hub with ambient sounds."
  }
];
```

### 2. Create Update Sheep Handler
**File**: `packs/QuestSystemBP/scripts/features/updateSheep/updateSheep.js`

```javascript
/**
 * updateSheep.js
 * Update Sheep NPC interaction and dialog system.
 * 
 * Handles:
 * - Update Sheep interaction detection
 * - Update log display with scrollable list
 * - Individual update details
 * - Sheep sound effects
 */

import { ActionFormData } from "@minecraft/server-ui";
import { updateLog } from "../../data/updateLog.js";

/**
 * Shows the Update Sheep dialog with game updates list.
 * 
 * @param {import("@minecraft/server").Player} player
 */
export function showUpdateSheepDialog(player) {
  const form = new ActionFormData()
    .title("§6§lUpdate Sheep")
    .body("§7Baa! Here's what's new in Super Quester:\n\n§fSelect an update to see details:");

  // Add buttons for each update
  updateLog.forEach((update) => {
    form.button(`§e${update.date}\n§f${update.title}`, "textures/items/book_normal");
  });

  form.button("§7Close");

  form.show(player).then((response) => {
    if (response.canceled) return;
    
    if (response.selection === updateLog.length) {
      // Close button
      return;
    }

    // Show selected update details
    const update = updateLog[response.selection];
    if (update) {
      showUpdateDetails(player, update);
    }
  });
}

/**
 * Shows details for a specific update.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {Object} update - Update object with date, title, details
 */
function showUpdateDetails(player, update) {
  const form = new ActionFormData()
    .title(`§e${update.date}`)
    .body(`§6§l${update.title}\n\n§f${update.details}`)
    .button("§a← Back to Updates")
    .button("§7Close");

  form.show(player).then((response) => {
    if (response.canceled || response.selection === 1) return;
    
    if (response.selection === 0) {
      // Back button - show main dialog again
      showUpdateSheepDialog(player);
    }
  });
}

/**
 * Update Sheep interaction handler.
 * Detects when a player interacts with the Update Sheep entity.
 * 
 * @param {import("@minecraft/server").Player} player
 * @param {string} entityId - Entity type ID
 */
export function handleUpdateSheepInteract(player, entityId) {
  if (entityId === "quest:update_sheep") {
    // Play sheep sound
    try {
      player.playSound("mob.sheep.say", { volume: 1.0, pitch: 1.0 });
    } catch (e) {
      console.warn("[UpdateSheep] Failed to play sound:", e);
    }

    showUpdateSheepDialog(player);
  }
}
```

### 3. Create Behavior Pack Entity
**File**: `packs/QuestSystemBP/entities/update_sheep.json`

```json
{
  "format_version": "1.20.50",
  "minecraft:entity": {
    "description": {
      "identifier": "quest:update_sheep",
      "is_spawnable": true,
      "is_summonable": true,
      "is_experimental": false,
      "scripts": {
        "animate": [
          "update_sheep"
        ]
      },
      "animations": {
        "update_sheep": "controller.animation.update_sheep"
      }
    },
    "component_groups": {},
    "components": {
      "minecraft:type_family": {
        "family": ["sheep", "mob"]
      },
      "minecraft:collision_box": {
        "width": 0.9,
        "height": 1.3
      },
      "minecraft:health": {
        "value": 8,
        "max": 8
      },
      "minecraft:physics": {
        "has_gravity": true,
        "has_collision": true
      },
      "minecraft:pushable": {
        "is_pushable": true,
        "is_pushable_by_piston": true
      },
      "minecraft:damage_sensor": {
        "triggers": [
          {
            "cause": "all",
            "deals_damage": false
          }
        ]
      },
      "minecraft:nameable": {
        "always_show": true,
        "allow_name_tag_renaming": false,
        "default_trigger": {
          "event": "update_sheep_interact"
        }
      },
      "minecraft:movement": {
        "value": 0.25
      },
      "minecraft:navigation.walk": {
        "can_path_over_water": false,
        "avoid_damage_blocks": true
      },
      "minecraft:movement.basic": {},
      "minecraft:jump.static": {},
      "minecraft:behavior.look_at_player": {
        "priority": 7,
        "look_distance": 6.0
      },
      "minecraft:behavior.random_look_around": {
        "priority": 8
      },
      "minecraft:behavior.random_stroll": {
        "priority": 6,
        "speed_multiplier": 0.6
      }
    },
    "events": {
      "update_sheep_interact": {
        "run_command": {
          "command": "scriptevent sq:update_sheep_interact"
        }
      }
    }
  }
}
```

### 4. Create Resource Pack Entity
**File**: `packs/QuestSystemRP/entity/update_sheep.entity.json`

```json
{
  "format_version": "1.10.0",
  "minecraft:client_entity": {
    "description": {
      "identifier": "quest:update_sheep",
      "materials": {
        "default": "sheep"
      },
      "textures": {
        "default": "textures/entity/sheep/sheep"
      },
      "geometry": {
        "default": "geometry.sheep.v1.8"
      },
      "render_controllers": [
        "controller.render.update_sheep"
      ],
      "spawn_egg": {
        "base_color": "#E7E7E7",
        "overlay_color": "#FFD700"
      }
    }
  }
}
```

### 5. Create Render Controller
**File**: `packs/QuestSystemRP/render_controllers/update_sheep.render_controllers.json`

```json
{
  "format_version": "1.10.0",
  "render_controllers": {
    "controller.render.update_sheep": {
      "geometry": "Geometry.default",
      "materials": [
        {
          "*": "Material.default"
        }
      ],
      "textures": [
        "Texture.default"
      ]
    }
  }
}
```

### 6. Add Localization
**File**: `packs/QuestSystemRP/texts/en_US.lang`

Add this line:
```
entity.quest:update_sheep.name=Update Sheep
```

### 7. Register Event Handler in Main Script
**File**: `packs/QuestSystemBP/scripts/main.js`

Add import near other imports (~line 144):
```javascript
import { handleUpdateSheepInteract } from "./features/updateSheep/updateSheep.js";
```

Find the scriptevent handler section (search for "sq:atlas_interact") and add:
```javascript
// Update Sheep NPC interaction
if (id === "sq:update_sheep_interact" && player) {
  handleUpdateSheepInteract(player, "quest:update_sheep");
}
```

## Testing

1. Run cache buster: `python tools/cache_buster.py`
2. Restart the server
3. Spawn the Update Sheep: `/summon quest:update_sheep`
4. Interact with the sheep
5. Verify:
   - Sheep sound plays
   - Update list displays
   - Can click updates to see details
   - Back button works
   - Close button works

## Future Maintenance

To add new updates, simply edit `packs/QuestSystemBP/scripts/data/updateLog.js` and add new entries at the TOP of the array. No other code changes needed!

Example:
```javascript
{
  date: "February 1, 2026",
  title: "New Feature Name",
  details: "Description of what was added or changed."
}
```

## Notes
- The sheep is invincible (damage sensor set to not take damage)
- Nametag always shows and cannot be renamed
- Uses vanilla sheep model and texture
- Follows existing code patterns (Phase 3 refactor architecture)
- No cheats required - works with `allow-cheats=false`
