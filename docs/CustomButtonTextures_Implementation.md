# Custom Button Textures Implementation

## Overview
This document describes how to customize the button textures in ActionFormData forms used by the Quest System. The implementation uses Minecraft Bedrock's JSON UI system to override vanilla button appearances with 9-slice scaled custom textures.

## Files Involved

| File | Purpose |
|------|---------|
| `packs/QuestSystemRP/ui/_ui_defs.json` | Registers custom UI files with the resource pack |
| `packs/QuestSystemRP/ui/server_form.json` | Contains button texture overrides |
| `packs/QuestSystemRP/textures/quest_ui/quest_button_common.png` | The 128x128 button texture |

## How It Works

### 1. UI Registration
The `_ui_defs.json` file tells Minecraft to load our custom UI:
```json
[
    "ui/server_form.json"
]
```

### 2. 9-Slice Scaling
9-slice (also called 9-patch) scaling divides a texture into 9 regions:
- **4 corners**: Fixed size, never stretched
- **4 edges**: Stretched in one direction only
- **1 center**: Stretched in both directions

For a 128x128 texture with `nineslice_size: 16`:
- Corners are 16x16 pixels (preserved)
- Remaining 96px in each direction stretches

### 3. Button States
Buttons have 3 visual states:
- **default**: Normal appearance
- **hover**: When cursor/focus is on the button (we use `color: [1.3, 1.3, 1.3]` for 30% brighter)
- **pressed**: When button is being clicked (we use `color: [0.7, 0.7, 0.7]` for 30% darker)

### 4. Overriding dynamic_button
The vanilla `server_form.json` uses a `dynamic_button` element for each ActionFormData button. By defining our own `dynamic_button` in the same namespace, we override it.

## Key Lessons Learned

### ❌ What DOESN'T Work
1. **Extending with texture variables**: 
   ```json
   "my_button@common_buttons.light_text_button": {
       "$default_texture": "my_texture"  // DOES NOT WORK
   }
   ```
   The vanilla button doesn't expose texture variables for override.

2. **Large nineslice values**: Using a nineslice_size that's too large (e.g., 43 for 128px texture) causes severe distortion.

### ✅ What DOES Work
1. **Complete button redefinition**: Define a new button type with your own controls array containing the texture images.

2. **Using `font_type: smooth`**: Critical for crisp text rendering that matches vanilla quality.

3. **Button state references**: Use `default_control`, `hover_control`, `pressed_control` to reference control names in your controls array.

## Text Rendering

For crisp text that matches vanilla buttons:
```json
"button_label": {
    "type": "label",
    "layer": 10,
    "shadow": true,
    "font_type": "smooth",
    "font_scale_factor": 1.0,
    "text": "#form_button_text",
    "bindings": [...]
}
```

Key properties:
- `font_type: "smooth"` - Essential for clean rendering
- `shadow: true` - Adds readability on textured backgrounds
- `layer: 10` - Ensures text appears above button textures

## Adding Rarity-Based Textures (Future)

To implement different button textures for Legendary/Rare/Common quests:

### Step 1: Create Texture Files
```
textures/quest_ui/quest_button_common.png    (gray/neutral)
textures/quest_ui/quest_button_rare.png      (blue tint)
textures/quest_ui/quest_button_legendary.png (gold/orange tint)
```

### Step 2: Define Texture Elements
```json
"quest_button_legendary_default": {
    "type": "image",
    "texture": "textures/quest_ui/quest_button_legendary",
    "nineslice_size": 16,
    ...
}
```

### Step 3: Create Rarity Button Types
```json
"quest_form_button_legendary": {
    "type": "button",
    "controls": [
        { "default@server_form.quest_button_legendary_default": {} },
        ...
    ]
}
```

### Step 4: Dynamic Selection
This is the tricky part - Minecraft JSON UI doesn't easily support dynamic texture selection based on data bindings. Options:
1. Use separate factory control_ids for each rarity
2. Use binding conditions to show/hide different button versions
3. Handle in script by generating different form structures

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Buttons have no texture | Check `_ui_defs.json` includes the file, verify texture path |
| Text not visible | Increase `layer` value, check `shadow` is true |
| Fuzzy/blurry text | Add `font_type: "smooth"` |
| Corners look stretched | Reduce `nineslice_size` value |
| Corners look too small | Increase `nineslice_size` value |
| Button not responding | Verify `$pressed_button_name` and bindings are correct |

## References

- [Bedrock Wiki - JSON UI](https://wiki.bedrock.dev/json-ui/json-ui-documentation.html)
- [Mojang Bedrock Samples](https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/ui)
- Vanilla `server_form.json` structure (referenced via web search)
