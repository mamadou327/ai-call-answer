import { PhoneOff, PoundSterling, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const ProblemSection = () => {
  const stats = [
    {
      icon: PhoneOff,
      stat: "85%",
      description: "of callers won't call back if you miss their call"
    },
    {
      icon: PoundSterling,
      stat: "£2,000+",
      description: "lost monthly from missed calls (avg. UK service business)"
    },
    {
      icon: TrendingDown,
      stat: "62%",
      description: "of restaurant orders still come by phone"
    }
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Every Missed Call Costs You Money
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          While you're busy with clients, potential customers are calling — and hanging up.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {stats.map((item, index) => (
          <Card key={index} className="border-2 border-border bg-card text-center">
            <CardContent className="p-8">
              <div className="w-14 h-14 bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
                <item.icon className="w-7 h-7" />
              </div>
              <div className="text-4xl md:text-5xl font-bold mb-2">{item.stat}</div>
              <p className="text-muted-foreground text-sm">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default ProblemSection;
