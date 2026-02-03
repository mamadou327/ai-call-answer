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
}

interface ParsedCategory {
  name: string;
  description: string | null;
}

interface ParseMenuResponse {
  categories: ParsedCategory[];
  items: ParsedMenuItem[];
}

const SYSTEM_PROMPT = `You are a menu parsing assistant. Your job is to extract menu items from text or images and return structured JSON data.

You MUST use the extract_menu_data tool to return the parsed menu.

Guidelines:
- Extract ALL menu items you can identify
- Group items into logical categories (e.g., Starters, Mains, Desserts, Drinks)
- Parse prices correctly, handling various formats (£12.99, 12.99, £12, etc.)
- Identify dietary tags from common abbreviations: (V) = Vegetarian, (VG) = Vegan, (GF) = Gluten-Free, (N) = Contains Nuts, (D) = Dairy-Free
- If an item has size variants (Small/Large, S/M/L, etc.), set has_sizes to true and populate the sizes array
- If no size variants, set has_sizes to false and sizes to empty array
- For items with sizes, set the price field to the lowest size price
- Clean up descriptions - remove prices and dietary tags from the description text
- If a category seems obvious from context but isn't explicitly stated, infer it
- Preserve the original order of items as much as possible

IMPORTANT - Option Groups and Customizations:
- Look for customization sections like "Choose your...", "Pick a...", "Add...", "Extras", "Sides", "Toppings", "Build your..."
- Identify selection rules from context:
  - "Choose one" / "Pick 1" / "Select your" = required, min_selections: 1, max_selections: 1
  - "Add toppings" / "Optional" / "Add extras" = not required, min_selections: 0, max_selections: 10
  - "Pick up to 3" = not required, min_selections: 0, max_selections: 3
  - "Required" = is_required: true
- Extract price adjustments (+£1, +50p, add £2, extra £1.50, +1.50) as numbers
- Some individual options may have their own dietary tags (e.g., "Sofritas (V)")
- If an item has customization options, populate the option_groups array
- Each option group contains a name, selection rules, and array of options
- Options within a group have a name, price_adjustment (0 if no extra cost), and optional dietary_tags`;

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
    
    // Determine content type
    const hasVisualContent = menuImage || menuPdf;
    const visualContent = menuImage || menuPdf;
    
    const userPrompt = hasVisualContent 
      ? `Parse this menu ${menuPdf ? "PDF" : "image"} and extract all menu items, including any customization options, add-ons, or choice sections. The currency is ${currency} (${currencySymbol}).`
      : `Parse this menu text and extract all menu items, including any customization options, add-ons, or choice sections. The currency is ${currency} (${currencySymbol}).\n\nMenu text:\n${menuText}`;

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
          description: "Extract structured menu data from the provided text or image, including customization options and modifiers",
          parameters: {
            type: "object",
            properties: {
              categories: {
                type: "array",
                description: "List of menu categories",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Category name (e.g., Starters, Mains, Desserts)" },
                    description: { type: "string", description: "Optional category description", nullable: true },
                  },
                  required: ["name"],
                  additionalProperties: false,
                },
              },
              items: {
                type: "array",
                description: "List of menu items",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Item name" },
                    description: { type: "string", description: "Item description (without price or dietary tags)", nullable: true },
                    price: { type: "number", description: "Base price as a number (e.g., 12.99). For items with sizes, use the lowest size price." },
                    category_name: { type: "string", description: "Name of the category this item belongs to" },
                    dietary_tags: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Dietary tags: Vegetarian, Vegan, Gluten-Free, Halal, Kosher, Dairy-Free, Nut-Free" 
                    },
                    has_sizes: { type: "boolean", description: "True if item has size variants (Small/Large, S/M/L, etc.)" },
                    sizes: {
                      type: "array",
                      description: "Size variants with their prices. Empty if has_sizes is false.",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Size name (e.g., Small, Large, Regular)" },
                          price: { type: "number", description: "Price for this size" },
                        },
                        required: ["name", "price"],
                        additionalProperties: false,
                      },
                    },
                    option_groups: {
                      type: "array",
                      description: "Customization option groups (e.g., 'Choose your protein', 'Add toppings'). Empty if no options.",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Option group name (e.g., 'Choose your protein', 'Add extras')" },
                          is_required: { type: "boolean", description: "True if customer must make a selection" },
                          min_selections: { type: "number", description: "Minimum number of selections required (0 for optional)" },
                          max_selections: { type: "number", description: "Maximum number of selections allowed (use 10 for unlimited)" },
                          options: {
                            type: "array",
                            description: "Available options in this group",
                            items: {
                              type: "object",
                              properties: {
                                name: { type: "string", description: "Option name (e.g., 'Chicken', 'Extra Cheese')" },
                                price_adjustment: { type: "number", description: "Additional cost for this option (0 if no extra charge)" },
                                dietary_tags: {
                                  type: "array",
                                  items: { type: "string" },
                                  description: "Dietary tags specific to this option (e.g., Vegetarian)"
                                },
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
                  },
                  required: ["name", "price", "category_name", "dietary_tags", "has_sizes", "sizes", "option_groups"],
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

    console.log("Calling Lovable AI Gateway for menu parsing...");

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

    // Count option groups for logging
    const totalOptionGroups = cleanedData.items.reduce((acc, item) => acc + item.option_groups.length, 0);
    console.log(`Parsed ${cleanedData.categories.length} categories, ${cleanedData.items.length} items, ${totalOptionGroups} option groups`);

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
