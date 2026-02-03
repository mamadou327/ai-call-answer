
## Goal
Prevent the AI phone assistant from mixing up extras/options between different menu items. When a customer orders a specific item, the AI should only offer or mention the options that belong to that specific item - never suggest extras from other items.

## What's happening now (the problem)
Looking at the code in `restaurant-pickup-prompt.ts` and `restaurant-hybrid-prompt.ts`:

1. The menu is formatted correctly with each item's options nested under it:
   ```
   Burgers:
     - Classic Burger
       ↳ Extras (REQUIRED - MUST ASK): Cheese (+£1.00), Bacon (+£1.50)
     - Chicken Burger
       ↳ Extras (REQUIRED - MUST ASK): Lettuce, Tomato
   ```

2. However, there's no explicit instruction telling the AI that options are **item-specific** and must not be mixed

3. The AI might see "Cheese (+£1.00)" mentioned in the menu and suggest it for items that don't have cheese as an option

## Solution
Add clear, explicit rules to the system prompts for restaurant ordering that:

1. **Emphasize options are item-specific**: Add text explaining that each item's options (shown with `↳`) belong ONLY to that item
2. **Add a hard rule against cross-item suggestions**: Add explicit "NEVER" rules about mixing options between items
3. **Update the menu format** to make the item-option relationship even clearer by adding an explicit header

## Files to change

### 1. `supabase/functions/twilio-media-stream/prompts/restaurant-pickup-prompt.ts`

**Changes to the menu section (around line 77-132):**
- Add a clear header explaining that options under each item are exclusive to that item
- Make the formatting even clearer

**Changes to the rules section (around line 338-360):**
- Add new rule: "NEVER offer or suggest extras/options from one menu item when taking order for a different item"
- Add new rule: "Each item's options (shown with ↳) belong ONLY to that item - never mix them"

### 2. `supabase/functions/twilio-media-stream/prompts/restaurant-hybrid-prompt.ts`

Apply the same changes:
- Add explanation in menu section about item-specific options
- Add new rules about never mixing options between items

## Technical details

### Updated menu section header (both prompts):
```
MENU (Know this well - you're the expert!):
⚠️ CRITICAL ABOUT OPTIONS: Each item below may have OPTIONS shown with "↳".
These options belong ONLY to that specific item - NEVER offer them for other items!
For example, if "Burger" has "Extra Cheese" but "Chips" doesn't, NEVER ask if they want cheese with their chips.
```

### New rules to add:
```
22. ❌ NEVER offer extras/options from one menu item when taking an order for a different item
23. ❌ NEVER mix options between items - each item's options (↳) belong ONLY to that item
24. ✅ When offering options, ONLY mention the ones listed directly under the specific item being ordered
```

## Expected outcome
After this change:
- When customer orders "Burger", AI only offers Burger's extras (Cheese, Bacon)
- When customer orders "Chips", AI only offers Chips' extras (Salt, Vinegar) - not Cheese
- AI will never say "Would you like extra cheese with your chips?" if cheese isn't a chips option
