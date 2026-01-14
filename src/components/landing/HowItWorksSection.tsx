import { UserPlus, Phone, CheckCircle } from "lucide-react";

const HowItWorksSection = () => {
  const steps = [
    {
      icon: UserPlus,
      number: "1",
      title: "Sign Up in 5 Minutes",
      description: "Add your services, menu, or table setup to your AIVIA profile"
    },
    {
      icon: Phone,
      number: "2",
      title: "Get Your AI Number",
      description: "Forward your existing line or get a dedicated new number"
    },
    {
      icon: CheckCircle,
      number: "3",
      title: "Start Taking Calls 24/7",
      description: "AIVIA handles everything automatically while you focus on clients"
    }
  ];

  return (
    <section className="container mx-auto px-4 py-16 md:py-24 bg-muted/30">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Get Started in 3 Simple Steps</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          No technical knowledge required. Be up and running in minutes.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connection Line */}
          <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-border" />
          
          {steps.map((step, index) => (
            <div key={index} className="relative text-center">
              {/* Step Number Circle */}
              <div className="w-24 h-24 bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 relative z-10">
                <step.icon className="w-10 h-10" />
              </div>
              
              {/* Step Number Badge */}
              <div className="absolute top-0 right-1/2 translate-x-14 -translate-y-2 w-8 h-8 bg-background border-2 border-border flex items-center justify-center font-bold text-sm z-20">
                {step.number}
              </div>

              <h3 className="text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
