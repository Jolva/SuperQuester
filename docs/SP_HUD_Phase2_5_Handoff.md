# Phase 2.5: String Extraction Validation ⚠️ CHECKPOINT

## Objective

Validate that JSON UI can strip the "SPVAL:" prefix from the title text, leaving just the number. **This is the riskiest part of the entire system** — we test it in isolation before proceeding.

---

## Context

Phase 2 confirmed:
- JSON UI can bind to `#hud_title_text_string` ✅
- Label shows `SPVAL:92` ✅
- Label persists after title fades ✅ (bonus!)

Now we need to extract just `92` from `SPVAL:92`.

---

## The Test

Modify the existing `hud_screen.json` to add a string subtraction binding.

### Current Bindings (Phase 2):
```json
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
```

### New Bindings (Phase 2.5):
```json
"bindings": [
    {
        "binding_name": "#hud_title_text_string",
        "binding_type": "global"
    },
    {
        "binding_type": "view",
        "source_property_name": "(#hud_title_text_string - 'SPVAL:')",
        "target_property_name": "#text"
    }
]
```

**The only change:** Replace `"#hud_title_text_string"` with `"(#hud_title_text_string - 'SPVAL:')"` in the second binding.

---

## Full Updated File

Replace `packs/QuestSystemRP/ui/hud_screen.json` with:

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
                "source_property_name": "(#hud_title_text_string - 'SPVAL:')",
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

---

## Expected Results

| Scenario | Before (Phase 2) | After (Phase 2.5) |
|----------|------------------|-------------------|
| Title shows | `SPVAL:92` | `SPVAL:92` (unchanged) |
| Label shows | `SPVAL:92` | `92` ← just the number |

---

## Verification Steps

### Test 1: Basic Extraction
1. Apply the updated `hud_screen.json`
2. Reload world / resource pack
3. **Expected:** Red label shows just `92` (or whatever your current SP is)

### Test 2: Updates Still Work
1. Run `/scriptevent sq:givesp @s 10`
2. **Expected:** Label updates to new number (just the number, no prefix)

### Test 3: Edge Cases
1. Set SP to 0: `/scriptevent sq:givesp @s -9999`
2. **Expected:** Label shows `0`
3. Set SP to large number: `/scriptevent sq:givesp @s 9999`
4. **Expected:** Label shows `9999` (or capped value)

---

## If It Works ✅

Celebrate! The hardest part is done. Proceed to:
- **Phase 3:** Make title invisible
- **Phase 4:** Position HUD element + remove sidebar
- **Phase 5:** Add coin icon

---

## If It Fails ❌

Don't panic. Here are fallback options:

### Fallback A: Different Syntax
Try wrapping with string concatenation (forces string output):
```json
"source_property_name": "('§z' + (#hud_title_text_string - 'SPVAL:'))"
```
The `§z` is an invalid formatting code that renders as nothing.

### Fallback B: Different Prefix
Maybe the colon is problematic. Change Script API to send `SPVAL_92` instead:
```javascript
player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"SPVAL_${sp}"}]}`);
```
Then extract with:
```json
"source_property_name": "(#hud_title_text_string - 'SPVAL_')"
```

### Fallback C: Just Display Full String
Accept `SPVAL:92` as the display and style around it:
- Make "SPVAL:" part of the design
- Or use a very small font where the prefix is less noticeable

### Fallback D: Change Approach
If string manipulation truly doesn't work, we could:
- Use multiple labels with conditional visibility based on score ranges
- Accept the sidebar as our display (abort custom HUD)
- Investigate other data bridge methods

---

## Troubleshooting

| Symptom | Likely Cause | Try |
|---------|--------------|-----|
| Label is empty | Extraction returned empty string | Check syntax exactly |
| Label shows `SPVAL:92` still | Binding not applied | Verify file saved, world reloaded |
| Label shows weird characters | String operation failed | Try Fallback A |
| JSON error on load | Syntax error | Check parentheses and quotes |
| Label shows `0` always | Expression evaluated as number | Try Fallback A |

---

## Definition of Done

- [ ] Label shows just the number (e.g., `92`)
- [ ] Number updates when SP changes
- [ ] No JSON errors in content log
- [ ] Works with 0, small numbers, and large numbers

---

## This Is The Gate

If string extraction works → we have a clear path to the mockup.

If it fails → we evaluate fallbacks and decide whether to proceed or simplify our goals.

Either outcome is valuable information. Let's find out!
