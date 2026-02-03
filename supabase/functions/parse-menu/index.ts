import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedOption {
  name: string;
  price_adjustment: number;
  dietary_tags: string[];
}

interface ParsedOptionGroup {
  name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  options: ParsedOption[];
}

interface ParsedMenuItem {
  name: string;
  description: string | null;
  price: number;
  category_name: string;
  dietary_tags: string[];
  has_sizes: boolean;
  sizes: Array<{ name: string; price: number }>;
  option_groups: ParsedOptionGroup[];
  // Enhanced semantic understanding fields
  ingredients: string[];
  cooking_method: string | null;
  spice_level: string | null;
  common_aliases: string[];
  pairs_well_with: string[];
  ai_description: string | null;
}

interface ParsedCategory {
  name: string;
  description: string | null;
}

interface ParseMenuResponse {
  categories: ParsedCategory[];
  items: ParsedMenuItem[];
  menu_summary: string | null;
}

const SYSTEM_PROMPT = `You are an expert menu analyst. Your job is to DEEPLY UNDERSTAND menu items - not just read and copy text, but truly comprehend what each dish is, how it's made, what it contains, and how a customer might ask about it.

You MUST use the extract_menu_data tool to return the parsed menu.

## Core Extraction Guidelines:
- Extract ALL menu items you can identify
- Group items into logical categories (e.g., Starters, Mains, Desserts, Drinks)
- Parse prices correctly, handling various formats (£12.99, 12.99, £12, etc.)
- Identify dietary tags: (V) = Vegetarian, (VG) = Vegan, (GF) = Gluten-Free, (N) = Contains Nuts, (D) = Dairy-Free
- Handle size variants (Small/Large, S/M/L) - set has_sizes true and populate sizes array
- For items with sizes, set price to the lowest size price

## Option Groups and Customizations:
- Detect "Choose your...", "Pick a...", "Add...", "Extras", "Toppings", "Build your..."
- Understand selection rules:
  - "Choose one" / "Pick 1" = required, min: 1, max: 1
  - "Add toppings" / "Optional" = not required, min: 0, max: 10
  - "Pick up to 3" = not required, min: 0, max: 3
- Extract price adjustments (+£1, +50p, add £2, extra £1.50)

## CRITICAL - Deep Semantic Understanding:
For EACH item, you must analyze and understand:

### 1. Ingredients (ingredients array)
- List the key ingredients, even if not explicitly stated
- Infer from the dish name (e.g., "Carbonara" → ["pasta", "egg", "pancetta", "parmesan", "black pepper"])
- Include base ingredients and toppings

### 2. Cooking Method (cooking_method)
- Identify how the dish is prepared: "grilled", "fried", "steamed", "baked", "raw", "smoked", "roasted", "braised", etc.
- If unclear, set to null

### 3. Spice Level (spice_level)
- Detect spice indicators: "mild", "medium", "hot", "extra hot", null if not applicable
- Look for 🌶️ symbols, "spicy", "chilli", "jalapeño", etc.

### 4. Common Aliases (common_aliases)
- How might customers casually refer to this item?
- "Margherita" → ["margarita", "cheese pizza", "plain pizza"]
- "Fish and Chips" → ["fish n chips", "fish & chips", "fish supper"]
- "Pad Thai" → ["pad thai noodles", "thai noodles"]
- Include common misspellings and shortened names

### 5. Pairs Well With (pairs_well_with)
- What other items on this menu complement this dish?
- Suggest drinks, sides, starters that go with mains
- Reference other items BY NAME from the same menu

### 6. AI Description (ai_description)
- Write a 1-2 sentence natural description of the dish
- Explain what it IS, not just list ingredients
- This helps the voice AI describe dishes naturally to customers
- Example: "A classic Italian pasta with a creamy egg sauce, crispy pancetta, and sharp parmesan - rich and comforting."

## Menu Summary (menu_summary)
Provide a brief overview of the restaurant's menu style:
- Cuisine type (Italian, Indian, Mexican, etc.)
- Price range
- Notable specialties
- Overall vibe (casual, upscale, family-friendly, etc.)
This helps the AI understand the restaurant's identity.

## Example Output Understanding:
If you see "Butter Chicken - £14.99 (GF available)" you should understand:
- name: "Butter Chicken"
- ingredients: ["chicken", "tomato", "butter", "cream", "garam masala", "fenugreek"]
- cooking_method: "slow-cooked"
- spice_level: "mild"
- common_aliases: ["murgh makhani", "butter chicken curry", "makhani"]
- pairs_well_with: ["Pilau Rice", "Garlic Naan", "Mango Lassi"]
- ai_description: "Tender chicken pieces in a rich, creamy tomato sauce with aromatic spices - a crowd-favorite Indian classic that's mild enough for everyone."
- dietary_tags: ["Gluten-Free"]

Remember: The goal is that when a customer calls and says "What's in your butter chicken?" or "Do you have that creamy chicken curry?", the AI can confidently understand and respond.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { menuText, menuImage, menuPdf, currency = "GBP" } = await req.json();

    if (!menuText && !menuImage && !menuPdf) {
      return new Response(
        JSON.stringify({ error: "menuText, menuImage, or menuPdf is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
    
    const hasVisualContent = menuImage || menuPdf;
    const visualContent = menuImage || menuPdf;
    
    const userPrompt = hasVisualContent 
      ? `Analyze this menu ${menuPdf ? "PDF" : "image"} deeply. Extract all items with full semantic understanding - ingredients, cooking methods, what customers might call them, and natural descriptions. The currency is ${currency} (${currencySymbol}).`
      : `Analyze this menu text deeply. Extract all items with full semantic understanding - ingredients, cooking methods, what customers might call them, and natural descriptions. The currency is ${currency} (${currencySymbol}).\n\nMenu text:\n${menuText}`;

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (hasVisualContent) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: visualContent } },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "extract_menu_data",
          description: "Extract deeply understood menu data with semantic context for AI voice assistants",
          parameters: {
            type: "object",
            properties: {
              menu_summary: {
                type: "string",
                description: "Brief overview of the restaurant's menu style, cuisine, price range, and vibe",
                nullable: true,
              },
              categories: {
                type: "array",
                description: "List of menu categories",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Category name" },
                    description: { type: "string", description: "Optional category description", nullable: true },
                  },
                  required: ["name"],
                  additionalProperties: false,
                },
              },
              items: {
                type: "array",
                description: "List of menu items with deep semantic understanding",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Item name as shown on menu" },
                    description: { type: "string", description: "Original description from menu", nullable: true },
                    price: { type: "number", description: "Base price (lowest if sizes exist)" },
                    category_name: { type: "string", description: "Category this item belongs to" },
                    dietary_tags: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Dietary tags: Vegetarian, Vegan, Gluten-Free, Halal, Kosher, Dairy-Free, Nut-Free" 
                    },
                    has_sizes: { type: "boolean", description: "True if item has size variants" },
                    sizes: {
                      type: "array",
                      description: "Size variants with prices",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          price: { type: "number" },
                        },
                        required: ["name", "price"],
                        additionalProperties: false,
                      },
                    },
                    option_groups: {
                      type: "array",
                      description: "Customization options (toppings, sides, choices)",
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
                                dietary_tags: { type: "array", items: { type: "string" } },
                              },
                              required: ["name", "price_adjustment", "dietary_tags"],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["name", "is_required", "min_selections", "max_selections", "options"],
                        additionalProperties: false,
                      },
                    },
                    // Enhanced semantic fields
                    ingredients: {
                      type: "array",
                      items: { type: "string" },
                      description: "Key ingredients in this dish (infer if not explicitly stated)",
                    },
                    cooking_method: {
                      type: "string",
                      description: "How the dish is prepared: grilled, fried, baked, steamed, etc.",
                      nullable: true,
                    },
                    spice_level: {
                      type: "string",
                      description: "Spice level: mild, medium, hot, extra hot, or null if not spicy",
                      nullable: true,
                    },
                    common_aliases: {
                      type: "array",
                      items: { type: "string" },
                      description: "Other names customers might use to refer to this dish",
                    },
                    pairs_well_with: {
                      type: "array",
                      items: { type: "string" },
                      description: "Names of other menu items that complement this dish",
                    },
                    ai_description: {
                      type: "string",
                      description: "Natural 1-2 sentence description explaining what the dish IS for voice AI",
                      nullable: true,
                    },
                  },
                  required: ["name", "price", "category_name", "dietary_tags", "has_sizes", "sizes", "option_groups", "ingredients", "common_aliases", "pairs_well_with"],
                  additionalProperties: false,
                },
              },
            },
            required: ["categories", "items"],
            additionalProperties: false,
          },
        },
      },
    ];

    console.log("Calling Lovable AI Gateway for deep menu analysis...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
        tools,
        tool_choice: { type: "function", function: { name: "extract_menu_data" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service requires payment. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response received");

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_menu_data") {
      throw new Error("AI did not return the expected tool call");
    }

    const parsedData: ParseMenuResponse = JSON.parse(toolCall.function.arguments);
    
    // Validate and clean the data
    const cleanedData: ParseMenuResponse = {
      menu_summary: parsedData.menu_summary?.trim() || null,
      categories: parsedData.categories.map(cat => ({
        name: cat.name?.trim() || "Uncategorized",
        description: cat.description?.trim() || null,
      })),
      items: parsedData.items.map(item => ({
        name: item.name?.trim() || "Unknown Item",
        description: item.description?.trim() || null,
        price: typeof item.price === "number" ? item.price : parseFloat(String(item.price)) || 0,
        category_name: item.category_name?.trim() || "Uncategorized",
        dietary_tags: Array.isArray(item.dietary_tags) ? item.dietary_tags : [],
        has_sizes: Boolean(item.has_sizes),
        sizes: Array.isArray(item.sizes) ? item.sizes.map(s => ({
          name: s.name?.trim() || "",
          price: typeof s.price === "number" ? s.price : parseFloat(String(s.price)) || 0,
        })).filter(s => s.name && s.price > 0) : [],
        option_groups: Array.isArray(item.option_groups) ? item.option_groups.map(og => ({
          name: og.name?.trim() || "Options",
          is_required: Boolean(og.is_required),
          min_selections: typeof og.min_selections === "number" ? og.min_selections : 0,
          max_selections: typeof og.max_selections === "number" ? og.max_selections : 10,
          options: Array.isArray(og.options) ? og.options.map(opt => ({
            name: opt.name?.trim() || "",
            price_adjustment: typeof opt.price_adjustment === "number" ? opt.price_adjustment : parseFloat(String(opt.price_adjustment)) || 0,
            dietary_tags: Array.isArray(opt.dietary_tags) ? opt.dietary_tags : [],
          })).filter(opt => opt.name) : [],
        })).filter(og => og.options.length > 0) : [],
        // Enhanced semantic fields
        ingredients: Array.isArray(item.ingredients) ? item.ingredients.filter(i => i?.trim()) : [],
        cooking_method: item.cooking_method?.trim() || null,
        spice_level: item.spice_level?.trim() || null,
        common_aliases: Array.isArray(item.common_aliases) ? item.common_aliases.filter(a => a?.trim()) : [],
        pairs_well_with: Array.isArray(item.pairs_well_with) ? item.pairs_well_with.filter(p => p?.trim()) : [],
        ai_description: item.ai_description?.trim() || null,
      })),
    };

    // Ensure all categories referenced by items exist
    const categoryNames = new Set(cleanedData.categories.map(c => c.name.toLowerCase()));
    cleanedData.items.forEach(item => {
      if (!categoryNames.has(item.category_name.toLowerCase())) {
        cleanedData.categories.push({ name: item.category_name, description: null });
        categoryNames.add(item.category_name.toLowerCase());
      }
    });

    // Count stats for logging
    const totalOptionGroups = cleanedData.items.reduce((acc, item) => acc + item.option_groups.length, 0);
    const itemsWithAliases = cleanedData.items.filter(i => i.common_aliases.length > 0).length;
    console.log(`Parsed ${cleanedData.categories.length} categories, ${cleanedData.items.length} items, ${totalOptionGroups} option groups, ${itemsWithAliases} items with aliases`);

    return new Response(
      JSON.stringify(cleanedData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Parse menu error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
