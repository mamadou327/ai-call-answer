import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

const MidPageCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="bg-primary text-primary-foreground p-8 md:p-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Rocket className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-xl md:text-2xl font-bold">Ready to stop missing calls?</h3>
              <p className="text-primary-foreground/80 text-sm mt-1">
                No credit card required • Cancel anytime
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Button 
              variant="secondary" 
              size="lg"
              onClick={() => navigate("/auth")}
            >
              Start Free Trial
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {
                const demoSection = document.getElementById('demo-section');
                demoSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Hear Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MidPageCTA;
