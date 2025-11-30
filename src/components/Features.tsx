import { Phone, Zap, Shield, TrendingUp } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Phone,
      title: "Instant Setup",
      description: "Get your AI phone agent running in under 5 minutes. No technical knowledge required.",
    },
    {
      icon: Zap,
      title: "Powered by Twilio",
      description: "Enterprise-grade call quality and reliability with Twilio's phone infrastructure.",
    },
    {
      icon: Shield,
      title: "Always Available",
      description: "Your AI agent never sleeps, never takes breaks, and handles unlimited calls simultaneously.",
    },
    {
      icon: TrendingUp,
      title: "Scale Effortlessly",
      description: "From 10 to 10,000 calls per day. Our infrastructure grows with your business.",
    },
  ];

  return (
    <section className="py-24 bg-background" id="features">
      <div className="container px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything you need,
            <br />
            <span className="text-accent">nothing you don't</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Focus on your business while we handle the complexity of AI voice technology
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group relative p-8 rounded-2xl border bg-card hover:shadow-lg transition-all duration-300"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <div className="bg-accent/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
