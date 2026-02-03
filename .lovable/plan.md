

# AI Menu Parser Feature

## Overview
Add an intelligent AI-powered menu import feature that allows restaurant owners to paste or upload their existing menu, and the AI will automatically extract and add all menu items with their categories, prices, descriptions, and dietary tags.

## User Value
- **Time saved**: A restaurant with 40 menu items would take 15-20 minutes to add manually. With AI parsing, this drops to ~30 seconds
- **Onboarding improvement**: Reduces friction for new restaurant signups significantly
- **Accuracy**: AI can detect patterns like dietary tags (V, VG, GF), size variants, and category groupings
- **Competitive advantage**: This is a premium feature most competitors don't offer

## Input Methods Supported
1. **Text paste** - Copy/paste menu text from any source (website, Word doc, PDF text)
2. **Image upload** - Take a photo of a physical menu (using AI vision capabilities)

## Implementation Details

### 1. Edge Function: `parse-menu`
Creates a new edge function that:
- Accepts menu text or base64 image
- Uses Lovable AI (Gemini 2.5 Pro for vision support) to extract structured menu data
- Returns categories and items in the correct database format

```text
Input: Raw menu text or image
     ↓
AI Analysis (Gemini 2.5 Pro)
     ↓
Structured JSON output:
{
  categories: [{ name, description }],
  items: [{
    name, description, price,
    category_name, dietary_tags,
    has_sizes, sizes
  }]
}
```

### 2. Frontend: Import Menu Dialog
Add a new "Import Menu" button to MenuManagement.tsx that opens a dialog with:
- Tab 1: **Paste Menu** - Large textarea for pasting menu text
- Tab 2: **Upload Photo** - Image upload for menu photos
- Preview of extracted items before importing
- Ability to review/edit/deselect items before final import

### 3. Database Insertion Logic
- Creates categories that don't already exist
- Matches existing categories by name (case-insensitive)
- Bulk inserts menu items with proper category linking
- Handles size variants if detected (Small/Large pricing)

## Technical Approach

### Edge Function Structure
```text
supabase/functions/parse-menu/index.ts
├── Validate input (text or image)
├── Build AI prompt with menu schema context
├── Call Lovable AI Gateway
├── Parse structured response
├── Return validated menu data
```

### AI Prompt Strategy
The AI will be given:
- Expected output schema (matching database structure)
- Currency context (GBP/USD/EUR)
- Known dietary tag options
- Instructions for handling size variants
- Example of expected output format

### Frontend Flow
```text
User clicks "Import Menu"
     ↓
Paste text or upload image
     ↓
Click "Analyze Menu"
     ↓
AI returns parsed items (5-15 seconds)
     ↓
User reviews in preview table
     ↓
User can edit/remove items
     ↓
Click "Import X Items"
     ↓
Bulk insert to database
     ↓
Refresh menu list
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/parse-menu/index.ts` | Create | AI menu parsing edge function |
| `supabase/config.toml` | Update | Add parse-menu function config |
| `src/components/dashboard/settings/MenuManagement.tsx` | Update | Add Import Menu button and dialog |
| `src/components/dashboard/settings/MenuImportDialog.tsx` | Create | New dialog component for import flow |

## UI Preview

The Import Menu button will appear next to the existing "Add Category" and "Add Item" buttons:

```text
┌─────────────────────────────────────────────────────┐
│ Menu Items                                          │
│                                                     │
│ [📁 Add Category] [➕ Add Item] [🤖 Import Menu]    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The Import Dialog:

```text
┌─────────────────────────────────────────────────────┐
│ Import Menu with AI                            [X]  │
├─────────────────────────────────────────────────────┤
│ [ Paste Text ]  [ Upload Photo ]                    │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Paste your menu here...                         │ │
│ │                                                 │ │
│ │ Example:                                        │ │
│ │ Margherita Pizza - £12.99                       │ │
│ │ Classic tomato and mozzarella (V)               │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│                       [🔍 Analyze Menu]             │
└─────────────────────────────────────────────────────┘
```

After analysis:

```text
┌─────────────────────────────────────────────────────┐
│ Review Items (12 found)                             │
├─────────────────────────────────────────────────────┤
│ ☑️ Margherita Pizza    £12.99    Pizzas      V     │
│ ☑️ Pepperoni Pizza     £14.99    Pizzas           │
│ ☑️ Garlic Bread        £4.50     Starters    V    │
│ ☐ House Salad          £6.99     Starters    V,VG │
│ ...                                                 │
├─────────────────────────────────────────────────────┤
│           [Cancel]      [Import 11 Items]           │
└─────────────────────────────────────────────────────┘
```

## Expected Results
- Restaurant owners can import entire menus in under 1 minute
- Works with messy, inconsistent menu formats
- Handles UK-style pricing (£) and common dietary abbreviations
- Creates proper category structure automatically
- Significantly improves onboarding experience

