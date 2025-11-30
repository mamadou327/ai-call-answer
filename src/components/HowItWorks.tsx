import { UserPlus, Settings, Phone, BarChart } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      icon: UserPlus,
      title: "Sign Up",
      description: "Create your account in seconds. No credit card required to start.",
    },
    {
      icon: Settings,
      title: "Configure Agent",
      description: "Tell us about your business and how you want your agent to respond to calls.",
    },
    {
      icon: Phone,
      title: "Get Your Number",
      description: "Choose a phone number from our Twilio integration and connect it to your agent.",
    },
    {
      icon: BarChart,
      title: "Start Receiving Calls",
      description: "Your AI agent is live! Monitor calls and performance from your dashboard.",
    },
  ];

  return (
    <section className="py-24 bg-secondary/30">
      <div className="container px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Simple as <span className="text-accent">1-2-3</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From signup to your first call in minutes, not days
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gradient-to-b from-accent to-accent/20 hidden md:block" />
            
            <div className="space-y-12">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={index} className="relative flex gap-6 items-start">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-primary font-bold text-xl">
                        {index + 1}
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-accent animate-pulse opacity-20" />
                    </div>
                    
                    <div className="flex-1 pt-2">
                      <div className="flex items-center gap-3 mb-3">
                        <Icon className="w-6 h-6 text-accent" />
                        <h3 className="text-2xl font-semibold">{step.title}</h3>
                      </div>
                      <p className="text-muted-foreground text-lg leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
