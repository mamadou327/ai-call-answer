import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import aiviaLogo from "@/assets/aivia-logo-new.png";

export const FontShowcase = () => {
  const fonts = [
    { name: "Orbitron", class: "font-orbitron", description: "Futuristic & tech-forward" },
    { name: "Exo 2", class: "font-exo", description: "Modern & dynamic" },
    { name: "Audiowide", class: "font-audiowide", description: "Bold & impactful" },
    { name: "Raleway", class: "font-raleway", description: "Elegant & professional" },
    { name: "Montserrat", class: "font-montserrat", description: "Clean & versatile" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aivia Font Options</CardTitle>
        <CardDescription>Choose the perfect font for your brand</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {fonts.map((font) => (
          <div key={font.name} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/5 transition-colors">
            <img src={aiviaLogo} alt="Aivia Logo" className="h-10 w-auto" />
            <div className="flex-1">
              <h3 className={`text-3xl font-bold ${font.class}`}>Aivia</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {font.name} - {font.description}
              </p>
            </div>
          </div>
        ))}
        
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">Current Selection: Orbitron</h4>
          <p className="text-sm text-muted-foreground">
            This font is currently applied to the dashboard header. To change it, update the className in Dashboard.tsx
          </p>
        </div>
      </CardContent>
    </Card>
  );
};