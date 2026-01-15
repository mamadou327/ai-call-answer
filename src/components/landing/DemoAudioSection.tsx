import { useState, useRef } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DemoCall {
  id: string;
  title: string;
  type: string;
  duration: string;
  transcript: string;
}

const DemoAudioSection = () => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const demoCalls: DemoCall[] = [
    {
      id: "salon",
      title: "Salon Booking Call",
      type: "Barbershop",
      duration: "0:45",
      transcript: "Customer: Hi, I'd like to book a haircut for tomorrow.\nAIVIA: Of course! I can help with that. What time works best for you? We have openings at 10am, 2pm, and 4:30pm."
    },
    {
      id: "takeaway",
      title: "Takeaway Order Call",
      type: "Restaurant",
      duration: "1:12",
      transcript: "Customer: Can I order a large pepperoni pizza please?\nAIVIA: Absolutely! A large pepperoni pizza. Would you like any sides or drinks with that? Our garlic bread is very popular."
    },
    {
      id: "reservation",
      title: "Table Reservation Call",
      type: "Dine-in",
      duration: "0:58",
      transcript: "Customer: I'd like to book a table for 4 this Saturday.\nAIVIA: Perfect! For Saturday evening, I have availability at 6pm, 7:30pm, or 8pm. Which would work best for your party of 4?"
    }
  ];

  const handlePlay = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
      // Simulate playing - in real implementation, would play actual audio
      setTimeout(() => setPlayingId(null), 3000);
    }
  };

  return (
    <section id="demo" className="container mx-auto px-4 py-16 md:py-24 bg-muted/30">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Hear AIVIA in Action</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Real conversations. Natural voice. 24/7 availability.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {demoCalls.map((demo) => (
          <Card key={demo.id} className="border-2 border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold">{demo.title}</h3>
                  <span className="text-xs text-muted-foreground">{demo.type}</span>
                </div>
              </div>

              {/* Audio Player UI */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-muted border border-border">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => handlePlay(demo.id)}
                >
                  {playingId === demo.id ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-foreground transition-all duration-300 ${
                        playingId === demo.id ? 'w-1/2' : 'w-0'
                      }`}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{demo.duration}</span>
              </div>

              {/* Transcript Preview */}
              <div className="text-xs text-muted-foreground space-y-1 font-mono">
                {demo.transcript.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default DemoAudioSection;
