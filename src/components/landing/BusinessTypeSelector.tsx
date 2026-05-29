import { Scissors, UtensilsCrossed, CalendarDays, Building2, Wrench, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const BusinessTypeSelector = () => {
  const businessTypes = [
    {
      icon: Scissors,
      title: "Salons & Barbershops",
      description: "AI receptionist for appointment bookings",
      features: [
        "Book appointments 24/7",
        "Manage staff schedules",
        "Send SMS reminders",
        "Handle cancellations"
      ]
    },
    {
      icon: UtensilsCrossed,
      title: "Takeaway Restaurants",
      description: "AI order taker that knows your menu",
      features: [
        "Take phone orders",
        "Know your full menu",
        "Calculate totals",
        "Collect customer details"
      ]
    },
    {
      icon: CalendarDays,
      title: "Dine-in Restaurants",
      description: "AI host for table reservations",
      features: [
        "Table reservations",
        "Party bookings",
        "Special requests",
        "Dietary accommodations"
      ]
    },
    {
      icon: Building2,
      title: "Estate Agents",
      description: "AI receptionist for property enquiries and viewings",
      features: [
        "Capture weekend enquiries",
        "Book viewings automatically",
        "Answer property questions",
        "Never miss a hot lead"
      ]
    },
    {
      icon: Wrench,
      title: "Trades and Services",
      description: "AI receptionist that catches every emergency callout",
      features: [
        "Answer calls on the job",
        "Capture emergency details",
        "Book jobs automatically",
        "Cover early mornings and evenings"
      ]
    }
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Your Industry</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          AIVIA adapts to your business type with specialized AI trained for your specific needs
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {businessTypes.map((type, index) => (
          <Card 
            key={index} 
            className="border-2 border-border bg-card hover:shadow-md transition-all hover:-translate-y-1"
          >
            <CardContent className="p-6">
              <div className="w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center mb-4">
                <type.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">{type.title}</h3>
              <p className="text-muted-foreground mb-4">{type.description}</p>
              <ul className="space-y-2">
                {type.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default BusinessTypeSelector;
