# Phase 2: JSON UI Binds to Title Text

## Objective

Create a JSON UI element that binds to `#hud_title_text_string` and displays the title text on the HUD. This phase validates that JSON UI can successfully read the data bridge established in Phase 1.

**The label will be intentionally ugly and obvious** (top-left, bright red, large font) so we can confirm the binding works before investing in positioning and styling.

---

## Context

Phase 1 confirmed that Script API can send SP values via `titleraw`:
- Title shows: `SPVAL:67`
- Sidebar shows: `67`
- Values match ✓

Now we need JSON UI to "see" that title text and display it in a custom element.

---

## Implementation

### File 1: Create `RP/ui/hud_screen.json`

Create a new file at `packs/QuestSystemRP/ui/hud_screen.json`:

```json
{
    "namespace": "hud",

    "sp_test_label": {
        "type": "label",
        "text": "#text",
        "color": [1.0, 0.2, 0.2],
        "font_size": "large",
        "font_type": "default",
        "shadow": true,
        "anchor_from": "top_left",
        "anchor_to": "top_left",
        "offset": [10, 10],
        "layer": 100,
        "bindings": [
            {
                "binding_name": "#hud_title_text_string",
                "binding_type": "global"
            },
            {
                "binding_type": "view",
                "source_property_name": "#hud_title_text_string",
                "target_property_name": "#text"
            }
        ]
    },

    "root_panel": {
        "modifications": [
            {
                "array_name": "controls",
                "operation": "insert_front",
                "value": [
                    { "sp_test_label@hud.sp_test_label": {} }
                ]
            }
        ]
    }
}
```

**What this does:**
- Creates a label element (`sp_test_label`) with bright red text
- Binds it to `#hud_title_text_string` (the title text from Script API)
- Positions it in the top-left corner with a 10px offset
- Inserts it into the HUD's root panel

### File 2: Modify `RP/ui/_ui_defs.json`

The current file contains:
```json
{
    "ui_defs": [
        "ui/server_form.json"
    ]
}
```

Update it to:
```json
{
    "ui_defs": [
        "ui/server_form.json",
        "ui/hud_screen.json"
    ]
}
```

---

## File Locations

| File | Path | Action |
|------|------|--------|
| `hud_screen.json` | `packs/QuestSystemRP/ui/hud_screen.json` | Create new |
| `_ui_defs.json` | `packs/QuestSystemRP/ui/_ui_defs.json` | Modify |

---

## Verification Steps

### Test 1: Basic Binding
1. Apply the resource pack changes (may need to reload world)
2. Join the world
3. **Expected:** Red text appears in top-left showing `SPVAL:XX`
4. **Also visible:** The actual title still flashes in center screen

### Test 2: Value Updates
1. Run `/scriptevent sq:givesp @s 25`
2. **Expected:** Both the title AND the red label update to show new value

### Test 3: Persistence Check
1. Wait for title to fade away
2. **Check:** Does the red label persist, or does it also disappear?

**Note on Test 3:** The label may disappear when the title fades. This is expected behavior—the binding reads the current title text, which becomes empty when the title fades. Phase 2.5 will address this with the "preserve title text" pattern if needed.

### Test 4: Multiple Players (if possible)
1. Have two players in the world
2. Give SP to one player
3. **Expected:** Each player sees their own SP value in their label

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| No red label appears | `hud_screen.json` not registered | Check `_ui_defs.json` includes it |
| Label appears but empty | Binding not working | Verify binding syntax exactly matches |
| Label shows but wrong position | Anchor/offset issue | Check anchor_from/anchor_to values |
| JSON parse error in logs | Syntax error in JSON | Validate JSON (check commas, brackets) |
| Label disappears with title | Expected behavior | Will address in Phase 2.5 if needed |

---

## Common JSON Pitfalls

1. **Trailing commas** — JSON doesn't allow them:
   ```json
   // WRONG:
   { "value": 1, }
   
   // RIGHT:
   { "value": 1 }
   ```

2. **Namespace reference** — Must match:
   ```json
   // In element definition:
   "namespace": "hud"
   
   // In root_panel modification:
   "sp_test_label@hud.sp_test_label"
   //            ^^^^ must match namespace
   ```

3. **Binding name** — Must include the `#`:
   ```json
   "binding_name": "#hud_title_text_string"
   //              ^ required
   ```

---

## Definition of Done

- [ ] `hud_screen.json` file created with test label
- [ ] `_ui_defs.json` updated to include `hud_screen.json`
- [ ] Resource pack reloaded / world reloaded
- [ ] Red label visible in top-left corner
- [ ] Label shows `SPVAL:XX` text
- [ ] Label updates when SP changes
- [ ] No JSON errors in content log

---

## What We're NOT Doing Yet

- ❌ String extraction (removing "SPVAL:" prefix) — Phase 2.5
- ❌ Positioning in lower-right — Phase 4
- ❌ Adding coin icon — Phase 5
- ❌ Making title invisible — Phase 3
- ❌ Removing sidebar — Phase 4

This phase is purely about validating the binding works.

---

## Next Phase Preview

**Phase 2.5: String Extraction Validation**

Once the binding is confirmed working, we test string manipulation:
```json
{
    "binding_type": "view",
    "source_property_name": "(#hud_title_text_string - 'SPVAL:')",
    "target_property_name": "#text"
}
```

This is the riskiest part of the whole system—we validate it works before proceeding to styling and positioning.
