import { Scissors, UtensilsCrossed, ChefHat, Store, Sparkles } from "lucide-react";

const LogoWall = () => {
  const industries = [
    { icon: Scissors, label: "Barbershops" },
    { icon: Sparkles, label: "Hair Salons" },
    { icon: Store, label: "Beauty Salons" },
    { icon: UtensilsCrossed, label: "Takeaways" },
    { icon: ChefHat, label: "Restaurants" },
  ];

  return (
    <section className="border-y border-border bg-muted/30 py-8">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm text-muted-foreground mb-6">
          Trusted by barbershops, salons, and restaurants across the UK
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {industries.map((industry, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <industry.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{industry.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LogoWall;
