import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink, Code2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WidgetSnippetProps {
  slug: string;
  enabled: boolean;
}

const ORIGIN = "https://aiviaapp.co.uk";

export const WidgetSnippet = ({ slug, enabled }: WidgetSnippetProps) => {
  const { toast } = useToast();
  const [color, setColor] = useState("#0F172A");
  const [label, setLabel] = useState("Book Now");

  if (!enabled || !slug) {
    return (
      <div className="text-sm text-muted-foreground">
        Enable online booking and set a booking URL slug above to generate your website widget snippet.
      </div>
    );
  }

  const snippet = `<script src="${ORIGIN}/widget.js" data-slug="${slug}" data-color="${color}" data-label="${label}" async></script>`;

  const copy = () => {
    navigator.clipboard.writeText(snippet);
    toast({ title: "Snippet copied", description: "Paste it into your website before </body>." });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add a floating <strong>“{label}”</strong> button to your existing website. Customers click it and
        book inside a popup — replacing your Fresha / Booksy / Treatwell widget.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Button label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 24))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Button color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 p-1 cursor-pointer"
            />
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5" /> Paste this snippet into your website
        </Label>
        <div className="relative">
          <pre className="text-xs bg-muted p-3 pr-12 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
            <code>{snippet}</code>
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-1.5 right-1.5"
            onClick={copy}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Place it just before the closing <code>&lt;/body&gt;</code> tag. Works on WordPress, Wix, Squarespace,
          Shopify, Webflow, and any custom site.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="h-4 w-4 mr-2" /> Copy snippet
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`${ORIGIN}/embed/${slug}`, "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-2" /> Preview widget content
        </Button>
      </div>
    </div>
  );
};
