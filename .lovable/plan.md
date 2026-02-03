

# AI Menu Parser Enhancement: Options & Modifiers Support

## Current Situation

The existing menu parser extracts:
- Categories
- Items with name, description, price
- Dietary tags (V, VG, GF, etc.)
- Size variants (Small/Large pricing)

**What's missing:**
- Option groups ("Choose your base", "Add toppings", "Pick a side")
- Individual options with price adjustments ("Extra cheese +£1")
- Selection rules (required vs optional, pick 1 vs pick many)

## What the AI Can Understand

Gemini 2.5 Pro's vision capabilities can intelligently parse complex menu structures like:

```text
BUILD YOUR BURRITO
Choose your protein (pick 1):
- Chicken
- Beef (+£1.50)
- Carnitas (+£2)
- Sofritas (V)

Choose your rice:
- White Rice
- Brown Rice
- Cauliflower Rice (+£0.75)

Add extras (optional):
- Guacamole (+£2)
- Sour Cream (+£0.50)
- Extra Cheese (+£0.75)
```

The AI will interpret this and understand:
- "Choose your protein" = required option group, pick exactly 1
- "Add extras" = optional group, pick as many as you want
- Price adjustments like "+£1.50" for premium options
- Dietary tags on individual options like "(V)" for Sofritas

## Implementation Changes

### 1. Update Edge Function Schema

Extend the `extract_menu_data` tool to include option groups:

```text
items: [{
  name, description, price, category_name, dietary_tags, has_sizes, sizes,
  // NEW:
  option_groups: [{
    name: string,           // "Choose your protein"
    is_required: boolean,   // true = must pick
    min_selections: number, // 1 for "pick 1"
    max_selections: number, // 1 for "pick 1", 10 for "unlimited"
    options: [{
      name: string,         // "Beef"
      price_adjustment: number, // 1.50
      dietary_tags: string[]    // ["Vegetarian"]
    }]
  }]
}]
```

### 2. Update System Prompt

Add guidance for the AI to:
- Detect option/choice groups from visual layout
- Understand selection rules ("pick 1", "choose up to 3", "add as many")
- Parse price modifiers (+£1, +50p, extra £2)
- Preserve the relationship between items and their options

### 3. Update Import Dialog

- Show options in the preview table (expandable rows)
- Allow users to review/modify option groups before import
- Import option groups and options to database

### 4. Database Insertion

When importing, for each item with option groups:
1. Insert the menu item
2. Create option groups linked to that item
3. Create options linked to each group

## Updated Flow

```text
User uploads menu
     |
AI analyzes (now includes options)
     |
Preview shows:
  - Burrito Bowl - £8.99
    └── Choose protein (required, pick 1)
        ├── Chicken
        ├── Beef (+£1.50)
        └── Carnitas (+£2)
    └── Add extras (optional)
        ├── Guacamole (+£2)
        └── Sour Cream (+£0.50)
     |
User reviews and imports
     |
Items + options saved to database
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/parse-menu/index.ts` | Add option_groups to schema and prompt |
| `src/components/dashboard/settings/MenuImportDialog.tsx` | Display and import option groups |

## UI Enhancement

The preview table will show nested options:

```text
┌──┬─────────────────┬─────────┬──────────┬──────┐
│☑ │ Item            │ Price   │ Category │ Tags │
├──┼─────────────────┼─────────┼──────────┼──────┤
│☑ │ Burrito Bowl    │ £8.99   │ Mains    │      │
│  │  ↳ Choose protein (pick 1)              │
│  │     Chicken, Beef +£1.50, Carnitas +£2  │
│  │  ↳ Add extras (optional)                │
│  │     Guac +£2, Sour Cream +£0.50         │
├──┼─────────────────┼─────────┼──────────┼──────┤
│☑ │ Tacos           │ £6.99   │ Mains    │      │
└──┴─────────────────┴─────────┴──────────┴──────┘
```

## Technical Details

### AI Prompt Addition

```text
- Look for customization sections (Choose, Pick, Add, Extras, Sides)
- Identify selection rules from context:
  - "Choose one" / "Pick 1" = required, max 1
  - "Add toppings" / "Optional" = not required, unlimited
  - "Pick up to 3" = not required, max 3
- Extract price adjustments (+£1, +50p, add £2, extra £1.50)
- Some options may have their own dietary tags
```

### Tool Schema Addition

```typescript
option_groups: {
  type: "array",
  items: {
    type: "object",
    properties: {
      name: { type: "string" },
      is_required: { type: "boolean" },
      min_selections: { type: "number" },
      max_selections: { type: "number" },
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price_adjustment: { type: "number" },
            dietary_tags: { type: "array", items: { type: "string" } }
          }
        }
      }
    }
  }
}
```

## Expected Results

- Restaurants with complex menus (build-your-own bowls, customizable pizzas, etc.) can now import their full menu structure
- Reduces manual setup time from 30+ minutes to under 2 minutes
- AI understands menu layouts visually, not just copying text

