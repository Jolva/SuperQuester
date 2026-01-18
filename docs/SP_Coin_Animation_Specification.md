# SuperQuester: SP Coin Spinning Animation Specification

## Overview
This document specifies the implementation of a triggered coin spinning animation that plays when a player's Super Points (SP) value changes. The animation uses the established title bridge pattern to display 5-6 frames of coin rotation, creating a visual "wow factor" when players earn or spend SP.

## Technical Approach
**Method**: Extend the existing title bridge system to include frame numbers
**Animation Trigger**: Any SP value change (earn/spend)
**Frame Count**: 6 frames (0 = static, 1-5 = animation sequence)
**Frame Duration**: ~100ms per frame (2 game ticks)
**Total Animation Duration**: ~500ms

## Architecture Components

### 1. Title Bridge Protocol Extension
Current format: `SPVAL:123`
New format: `SPVAL:123:0` (where last digit is frame number)

**Frame Meanings**:
- Frame 0: Static default coin (displayed when not animating)
- Frame 1-5: Animation sequence frames

### 2. Script API Changes

#### A. New Animation Function
```javascript
/**
 * Updates SP display with spinning coin animation
 * @param {Player} player - The player whose SP changed
 * @param {number} newSP - The new SP value to display
 */
async function updateSPDisplayWithAnimation(player) {
    const sp = getSP(player);
    
    try {
        // Spin through animation frames
        for (let frame = 1; frame <= 5; frame++) {
            player.runCommandAsync(`titleraw @s times 0 1 0`);
            player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"SPVAL:${sp}:${frame}"}]}`);
            await system.waitTicks(2); // ~100ms per frame at 20 TPS
        }
        
        // Return to static coin
        player.runCommandAsync(`titleraw @s times 0 1 0`);
        player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"SPVAL:${sp}:0"}]}`);
    } catch (error) {
        console.warn(`SP animation error for ${player.name}: ${error}`);
        // Fallback to static display
        player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"SPVAL:${sp}:0"}]}`);
    }
}
```

#### B. Integration Points
Replace ALL instances of `updateSPDisplay(player)` with `updateSPDisplayWithAnimation(player)`:

**Quest Completion**:
```javascript
// In quest completion handler
if (questData) {
    player.runCommandAsync(`scoreboard players add @s sp ${questData.reward.sp}`);
    await updateSPDisplayWithAnimation(player);
    // ... rest of completion logic
}
```

**Reroll Purchase**:
```javascript
// In reroll handler
if (canAfford) {
    player.runCommandAsync(`scoreboard players remove @s sp ${rerollCost}`);
    await updateSPDisplayWithAnimation(player);
    // ... rest of reroll logic
}
```

**Manual SP Awards/Deductions**:
```javascript
// In admin commands or any other SP modification
player.runCommandAsync(`scoreboard players set @s sp ${newValue}`);
await updateSPDisplayWithAnimation(player);
```

**Join/Respawn Events**:
```javascript
// On player join or respawn - just send static display
const sp = getSP(player);
player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"SPVAL:${sp}:0"}]}`);
```

### 3. JSON UI Changes

#### hud_screen.json Modifications

Replace the current single coin image with a stack of 6 conditional images:

```json
"sp_display_panel": {
  "type": "panel",
  "size": [60, 24],
  "anchor_from": "top_right",
  "anchor_to": "top_right",
  "offset": [-10, 10],
  "controls": [
    {
      "coin_stack": {
        "type": "stack_panel",
        "orientation": "horizontal",
        "size": [60, 20],
        "controls": [
          {
            "coin_frame_0": {
              "type": "image",
              "texture": "textures/quest_ui/sp_coin_0",
              "size": [20, 20],
              "bindings": [
                {
                  "binding_name": "#hud_title_text",
                  "binding_name_override": "#visible",
                  "binding_type": "collection",
                  "binding_collection_name": "hud_title_text_collection"
                },
                {
                  "binding_type": "view",
                  "source_property_name": "(#hud_title_text - (#hud_title_text - 'SPVAL:') - (#hud_title_text - ':0'))",
                  "target_property_name": "#visible"
                }
              ]
            }
          },
          {
            "coin_frame_1": {
              "type": "image",
              "texture": "textures/quest_ui/sp_coin_1",
              "size": [20, 20],
              "bindings": [
                {
                  "binding_name": "#hud_title_text",
                  "binding_name_override": "#visible",
                  "binding_type": "collection",
                  "binding_collection_name": "hud_title_text_collection"
                },
                {
                  "binding_type": "view",
                  "source_property_name": "(#hud_title_text - (#hud_title_text - 'SPVAL:') - (#hud_title_text - ':1'))",
                  "target_property_name": "#visible"
                }
              ]
            }
          },
          {
            "coin_frame_2": {
              "type": "image",
              "texture": "textures/quest_ui/sp_coin_2",
              "size": [20, 20],
              "bindings": [
                {
                  "binding_name": "#hud_title_text",
                  "binding_name_override": "#visible",
                  "binding_type": "collection",
                  "binding_collection_name": "hud_title_text_collection"
                },
                {
                  "binding_type": "view",
                  "source_property_name": "(#hud_title_text - (#hud_title_text - 'SPVAL:') - (#hud_title_text - ':2'))",
                  "target_property_name": "#visible"
                }
              ]
            }
          },
          {
            "coin_frame_3": {
              "type": "image",
              "texture": "textures/quest_ui/sp_coin_3",
              "size": [20, 20],
              "bindings": [
                {
                  "binding_name": "#hud_title_text",
                  "binding_name_override": "#visible",
                  "binding_type": "collection",
                  "binding_collection_name": "hud_title_text_collection"
                },
                {
                  "binding_type": "view",
                  "source_property_name": "(#hud_title_text - (#hud_title_text - 'SPVAL:') - (#hud_title_text - ':3'))",
                  "target_property_name": "#visible"
                }
              ]
            }
          },
          {
            "coin_frame_4": {
              "type": "image",
              "texture": "textures/quest_ui/sp_coin_4",
              "size": [20, 20],
              "bindings": [
                {
                  "binding_name": "#hud_title_text",
                  "binding_name_override": "#visible",
                  "binding_type": "collection",
                  "binding_collection_name": "hud_title_text_collection"
                },
                {
                  "binding_type": "view",
                  "source_property_name": "(#hud_title_text - (#hud_title_text - 'SPVAL:') - (#hud_title_text - ':4'))",
                  "target_property_name": "#visible"
                }
              ]
            }
          },
          {
            "coin_frame_5": {
              "type": "image",
              "texture": "textures/quest_ui/sp_coin_5",
              "size": [20, 20],
              "bindings": [
                {
                  "binding_name": "#hud_title_text",
                  "binding_name_override": "#visible",
                  "binding_type": "collection",
                  "binding_collection_name": "hud_title_text_collection"
                },
                {
                  "binding_type": "view",
                  "source_property_name": "(#hud_title_text - (#hud_title_text - 'SPVAL:') - (#hud_title_text - ':5'))",
                  "target_property_name": "#visible"
                }
              ]
            }
          },
          {
            "sp_value_text": {
              "type": "label",
              "text": "#sp_value",
              "color": "$sp_coin_color",
              "shadow": true,
              "size": [36, 20],
              "bindings": [
                {
                  "binding_name": "#hud_title_text",
                  "binding_name_override": "#sp_value",
                  "binding_type": "collection",
                  "binding_collection_name": "hud_title_text_collection"
                },
                {
                  "binding_type": "view",
                  "source_property_name": "(#hud_title_text - 'SPVAL:' - (':0' or ':1' or ':2' or ':3' or ':4' or ':5'))",
                  "target_property_name": "#sp_value"
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

**Note**: The visibility bindings check for the specific frame suffix (`:0`, `:1`, etc.) ensuring only one coin image displays at a time.

### 4. Resource Pack Structure

```
RP/
└── textures/
    └── quest_ui/
        ├── sp_coin_0.png  (64x64) - Static/default coin
        ├── sp_coin_1.png  (64x64) - Front view
        ├── sp_coin_2.png  (64x64) - Quarter turn
        ├── sp_coin_3.png  (64x64) - Edge-on/vertical
        ├── sp_coin_4.png  (64x64) - Three-quarter turn
        └── sp_coin_5.png  (64x64) - Back view
```

## Implementation Phases

### Phase 1: Asset Creation
- Generate 6 coin images using AI art tools
- Add images to resource pack at specified paths
- Test basic image loading in-game

### Phase 2: JSON UI Update
- Modify hud_screen.json with 6 conditional coin images
- Update visibility bindings for frame detection
- Verify static display (frame 0) works correctly

### Phase 3: Script Animation
- Implement `updateSPDisplayWithAnimation()` function
- Replace existing `updateSPDisplay()` calls
- Add error handling and fallback logic

### Phase 4: Integration Testing
- Test animation on quest completion
- Test animation on reroll purchase
- Test edge cases (rapid SP changes, multiple simultaneous animations)

### Phase 5: Polish & Refinement
- Adjust timing if frames feel too fast/slow
- Verify animation doesn't interfere with other UI elements
- Confirm no performance issues with multiple players

## Technical Considerations

### Timing & Performance
- 2 ticks per frame = 10 frames per second
- Total animation time is 500ms (½ second)
- Animation is async, won't block other game logic
- Each animation sends 6 title commands (acceptable overhead)

### Edge Cases to Handle

**Rapid SP Changes**:
- If SP changes again during animation, new animation starts fresh
- Previous animation is effectively "interrupted" (acceptable behavior)

**Multiple Players**:
- Each player's animation is independent
- No shared state between animations
- Title commands are player-specific

**Error Handling**:
- Try-catch around animation sequence
- Fallback to static display on any error
- Console warnings for debugging

## Testing Checklist

- [ ] Static coin displays correctly on join/respawn
- [ ] Animation plays when completing quests
- [ ] Animation plays when spending SP on rerolls
- [ ] SP value updates correctly during animation
- [ ] Animation doesn't flicker or show multiple coins
- [ ] Frame 0 (static) displays after animation completes
- [ ] Works correctly for multiple players simultaneously
- [ ] Performance is acceptable with 4+ players
- [ ] No console errors during animation

## Success Criteria
1. Coin visibly "spins" through 5 frames when SP changes
2. Animation completes in approximately ½ second
3. Static coin displays when not animating
4. No visual glitches or multiple coins showing
5. Works consistently across all SP modification points
6. Delivers the intended "wow factor" visual feedback

## Notes for AntiGravity
- The title bridge string extraction pattern is proven to work
- Frame detection uses the same technique as SP value extraction
- Consider adding a small delay (5-10 ticks) before returning to static if rapid animations feel jarring
- Console.warn any animation errors for easier debugging
- The JSON UI binding syntax is complex but follows existing patterns
