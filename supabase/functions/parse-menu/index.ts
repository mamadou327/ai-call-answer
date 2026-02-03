import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedMenuItem {
  name: string;
  description: string | null;
  price: number;
  category_name: string;
  dietary_tags: string[];
  has_sizes: boolean;
  sizes: Array<{ name: string; price: number }>;
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
- Preserve the original order of items as much as possible`;

// For PDFs, we'll send them as images to Gemini which supports PDF vision
// This is simpler and more reliable than text extraction

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
      ? `Parse this menu ${menuPdf ? "PDF" : "image"} and extract all menu items. The currency is ${currency} (${currencySymbol}).`
      : `Parse this menu text and extract all menu items. The currency is ${currency} (${currencySymbol}).\n\nMenu text:\n${menuText}`;

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
          description: "Extract structured menu data from the provided text or image",
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
                    price: { type: "number", description: "Price as a number (e.g., 12.99). For items with sizes, use the lowest size price." },
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
                  },
                  required: ["name", "price", "category_name", "dietary_tags", "has_sizes", "sizes"],
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

    console.log(`Parsed ${cleanedData.categories.length} categories and ${cleanedData.items.length} items`);

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
