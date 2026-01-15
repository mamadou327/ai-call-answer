import { Check, X, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ComparisonTable = () => {
  const comparisons = [
    {
      feature: "Available 24/7",
      receptionist: false,
      voicemail: true,
      aivia: true
    },
    {
      feature: "Books appointments",
      receptionist: true,
      voicemail: false,
      aivia: true
    },
    {
      feature: "Takes food orders",
      receptionist: true,
      voicemail: false,
      aivia: true
    },
    {
      feature: "Never calls in sick",
      receptionist: false,
      voicemail: null,
      aivia: true
    },
    {
      feature: "Handles multiple calls at once",
      receptionist: false,
      voicemail: false,
      aivia: true
    },
    {
      feature: "Sends confirmation texts",
      receptionist: false,
      voicemail: false,
      aivia: true
    },
    {
      feature: "Full call transcripts",
      receptionist: false,
      voicemail: false,
      aivia: true
    }
  ];

  const renderIcon = (value: boolean | null) => {
    if (value === null) return <Minus className="w-5 h-5 text-muted-foreground" />;
    if (value) return <Check className="w-5 h-5 text-success" />;
    return <X className="w-5 h-5 text-destructive" />;
  };

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">See How AIVIA Compares</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Why businesses are switching from traditional solutions to AI
        </p>
      </div>

      <div className="max-w-4xl mx-auto overflow-x-auto">
        <Card className="border-2 border-border">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left p-4 font-semibold">Feature</th>
                  <th className="text-center p-4 font-semibold">Receptionist</th>
                  <th className="text-center p-4 font-semibold">Voicemail</th>
                  <th className="text-center p-4 font-semibold bg-primary/5">
                    <span className="text-primary">AIVIA</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, index) => (
                  <tr key={index} className={index !== comparisons.length - 1 ? "border-b border-border" : ""}>
                    <td className="p-4 text-sm">{row.feature}</td>
                    <td className="p-4 text-center">{renderIcon(row.receptionist)}</td>
                    <td className="p-4 text-center">{renderIcon(row.voicemail)}</td>
                    <td className="p-4 text-center bg-primary/5">{renderIcon(row.aivia)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="p-4 font-semibold">Monthly Cost</td>
                  <td className="p-4 text-center font-bold text-destructive">£2,000+</td>
                  <td className="p-4 text-center font-bold text-success">£0</td>
                  <td className="p-4 text-center font-bold bg-primary/5 text-primary">Contact Us</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ComparisonTable;
