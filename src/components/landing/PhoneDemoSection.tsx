import { useState, useRef, useEffect, useCallback } from "react";
import { Phone, PhoneOff, Volume2, Mic, MicOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoLine {
  index: number;
  speaker: string;
  text: string;
  audioUrl: string;
}

interface DemoManifest {
  scenario: string;
  version: number;
  linesCount: number;
  pauseBetweenLinesMs: number;
  lines: DemoLine[];
}

type ScenarioType = "booking" | "order" | "reservation";

const VOICE_NAME = "Coral";

// Hardcoded demo scripts for when audio isn't available
const demoScripts: Record<ScenarioType, { speaker: string; text: string }[]> = {
  booking: [
    { speaker: "aivia", text: "Good morning, Luxe Hair Studio. This is Coral, how may I help you today?" },
    { speaker: "customer", text: "Hi, I'd like to book a haircut for tomorrow afternoon please." },
    { speaker: "aivia", text: "Of course! I'd be happy to help you with that. May I have your name please?" },
    { speaker: "customer", text: "It's Sarah Mitchell." },
    { speaker: "aivia", text: "Thank you Sarah. For tomorrow afternoon, I have availability at 2pm, 3:30pm, or 5pm. Which time works best for you?" },
    { speaker: "customer", text: "3:30pm would be perfect." },
    { speaker: "aivia", text: "Excellent! I've booked you in for 3:30pm tomorrow with our stylist. You'll receive a confirmation text shortly. Is there anything else I can help you with?" },
    { speaker: "customer", text: "No, that's all. Thank you!" },
    { speaker: "aivia", text: "You're welcome, Sarah. We look forward to seeing you tomorrow at 3:30. Have a great day!" },
  ],
  order: [
    { speaker: "aivia", text: "Thank you for calling Mario's Pizzeria. This is Coral, how can I help you today?" },
    { speaker: "customer", text: "Hi, I'd like to place an order for pickup please." },
    { speaker: "aivia", text: "Absolutely! What would you like to order?" },
    { speaker: "customer", text: "Can I get a large pepperoni pizza and garlic bread?" },
    { speaker: "aivia", text: "A large pepperoni pizza and garlic bread. Would you like any drinks with that? We have a deal on 2-liter sodas today." },
    { speaker: "customer", text: "Sure, I'll add a Coke please." },
    { speaker: "aivia", text: "Perfect! Your total comes to £18.50. It'll be ready for pickup in about 25 minutes. May I have a name for the order?" },
    { speaker: "customer", text: "It's James." },
    { speaker: "aivia", text: "Got it, James. Your order will be ready at 6:45pm. See you soon!" },
  ],
  reservation: [
    { speaker: "aivia", text: "Good evening, The Oak Table Restaurant. This is Coral speaking, how may I assist you?" },
    { speaker: "customer", text: "Hi, I'd like to make a reservation for this Saturday." },
    { speaker: "aivia", text: "Wonderful! How many guests will be dining with us?" },
    { speaker: "customer", text: "There will be 4 of us." },
    { speaker: "aivia", text: "For a party of 4 this Saturday, I have availability at 6pm, 7:30pm, or 8:45pm. Which time would you prefer?" },
    { speaker: "customer", text: "7:30pm please." },
    { speaker: "aivia", text: "Excellent choice! May I have a name and phone number for the reservation?" },
    { speaker: "customer", text: "Emma Wilson, 07700 900123." },
    { speaker: "aivia", text: "Thank you Emma. I've reserved a table for 4 at 7:30pm this Saturday. You'll receive a confirmation text. We look forward to seeing you!" },
  ],
};

const scenarioInfo: Record<ScenarioType, { title: string; businessName: string }> = {
  booking: { title: "Salon Booking", businessName: "Luxe Hair Studio" },
  order: { title: "Takeaway Order", businessName: "Mario's Pizzeria" },
  reservation: { title: "Table Reservation", businessName: "The Oak Table" },
};

const PhoneDemoSection = () => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("booking");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [callDuration, setCallDuration] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackStateRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get current script
  const currentScript = demoScripts[selectedScenario];
  const currentInfo = scenarioInfo[selectedScenario];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playbackStateRef.current.cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Auto-scroll transcript to current line
  useEffect(() => {
    if (currentLineIndex >= 0 && transcriptRef.current) {
      const lineElement = transcriptRef.current.children[currentLineIndex] as HTMLElement;
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentLineIndex]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  };

  const startCall = useCallback(async () => {
    // Start ringing animation
    setIsRinging(true);
    await sleep(1500);
    
    if (playbackStateRef.current.cancelled) {
      setIsRinging(false);
      return;
    }

    setIsRinging(false);
    setIsPlaying(true);
    setCallDuration(0);
    playbackStateRef.current.cancelled = false;

    // Start duration counter
    durationIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // Play through the script with simulated timing
    for (let i = 0; i < currentScript.length; i++) {
      if (playbackStateRef.current.cancelled) break;
      
      setCurrentLineIndex(i);
      
      // Calculate reading time based on text length (roughly 150 words per minute)
      const words = currentScript[i].text.split(" ").length;
      const readingTime = Math.max(1500, (words / 2.5) * 1000);
      
      await sleep(readingTime);
      
      // Add pause between lines
      if (i < currentScript.length - 1 && !playbackStateRef.current.cancelled) {
        await sleep(500);
      }
    }

    // End call
    endCall();
  }, [currentScript]);

  const endCall = useCallback(() => {
    playbackStateRef.current.cancelled = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setIsPlaying(false);
    setIsRinging(false);
    setCurrentLineIndex(-1);
    setCallDuration(0);
  }, []);

  const handleScenarioChange = (scenario: ScenarioType) => {
    if (isPlaying || isRinging) {
      endCall();
    }
    setSelectedScenario(scenario);
  };

  const answerCall = () => {
    playbackStateRef.current.cancelled = false;
    startCall();
  };

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Experience AIVIA Live</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          See how AIVIA handles real customer calls with natural conversation flow
        </p>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
        {/* Phone Mockup */}
        <div className="relative">
          {/* Floating animation wrapper */}
          <div className="animate-float">
            {/* Phone Frame */}
            <div className="w-[280px] md:w-[320px] bg-foreground rounded-[40px] p-3 shadow-2xl">
              {/* Phone Screen */}
              <div className="bg-background rounded-[32px] overflow-hidden min-h-[520px] md:min-h-[580px]">
                {/* Status Bar */}
                <div className="bg-background px-6 py-2 flex justify-between items-center text-xs">
                  <span className="font-medium">9:41</span>
                  <div className="absolute left-1/2 -translate-x-1/2 w-24 h-6 bg-foreground rounded-full top-4" />
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-2 border border-foreground rounded-sm relative">
                      <div className="absolute inset-0.5 right-1 bg-foreground rounded-sm" />
                    </div>
                  </div>
                </div>

                {/* Call Screen Content */}
                <div className="px-6 py-4 flex flex-col h-[480px] md:h-[540px]">
                  {/* Call Header */}
                  <div className="text-center mb-4">
                    {/* Avatar */}
                    <div className={`w-20 h-20 mx-auto mb-3 rounded-full flex items-center justify-center ${
                      isRinging 
                        ? "bg-success animate-pulse" 
                        : isPlaying 
                          ? "bg-primary" 
                          : "bg-muted border-2 border-foreground"
                    }`}>
                      {isPlaying ? (
                        <Volume2 className="w-10 h-10 text-primary-foreground animate-pulse" />
                      ) : (
                        <Phone className={`w-10 h-10 ${isRinging ? "text-success-foreground animate-bounce" : "text-muted-foreground"}`} />
                      )}
                    </div>
                    <h3 className="font-bold text-lg">{currentInfo.businessName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isRinging 
                        ? "Incoming call..." 
                        : isPlaying 
                          ? formatDuration(callDuration)
                          : currentInfo.title
                      }
                    </p>
                  </div>

                  {/* Transcript Area */}
                  <div 
                    ref={transcriptRef}
                    className="flex-1 overflow-y-auto space-y-2 px-1 scrollbar-thin"
                  >
                    {(isPlaying || currentLineIndex >= 0) && currentScript.slice(0, currentLineIndex + 1).map((line, index) => (
                      <div
                        key={index}
                        className={`flex ${line.speaker === "aivia" ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                            line.speaker === "aivia"
                              ? "bg-muted border border-border rounded-bl-none"
                              : "bg-primary text-primary-foreground rounded-br-none"
                          } ${
                            index === currentLineIndex ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""
                          }`}
                        >
                          <p className="text-xs font-medium mb-1 opacity-70">
                            {line.speaker === "aivia" ? `🤖 ${VOICE_NAME}` : "👤 You"}
                          </p>
                          <p>{line.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Call Controls */}
                  <div className="pt-4 mt-auto">
                    {isRinging ? (
                      <div className="flex justify-center gap-6">
                        <Button
                          onClick={endCall}
                          size="lg"
                          className="w-16 h-16 rounded-full bg-destructive hover:bg-destructive/90"
                        >
                          <PhoneOff className="w-6 h-6" />
                        </Button>
                        <Button
                          onClick={answerCall}
                          size="lg"
                          className="w-16 h-16 rounded-full bg-success hover:bg-success/90 animate-pulse"
                        >
                          <Phone className="w-6 h-6" />
                        </Button>
                      </div>
                    ) : isPlaying ? (
                      <div className="flex justify-center gap-4">
                        <Button
                          variant="ghost"
                          size="lg"
                          className="w-12 h-12 rounded-full bg-muted"
                          disabled
                        >
                          <MicOff className="w-5 h-5" />
                        </Button>
                        <Button
                          onClick={endCall}
                          size="lg"
                          className="w-16 h-16 rounded-full bg-destructive hover:bg-destructive/90"
                        >
                          <PhoneOff className="w-6 h-6" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="lg"
                          className="w-12 h-12 rounded-full bg-muted"
                          disabled
                        >
                          <Volume2 className="w-5 h-5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Button
                          onClick={answerCall}
                          size="lg"
                          className="w-16 h-16 rounded-full bg-success hover:bg-success/90"
                        >
                          <Phone className="w-6 h-6" />
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">Tap to start call</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scenario Selector */}
        <div className="w-full max-w-sm space-y-4">
          <h3 className="font-bold text-lg mb-4">Choose a scenario:</h3>
          
          {(["booking", "order", "reservation"] as ScenarioType[]).map((scenario) => (
            <button
              key={scenario}
              onClick={() => handleScenarioChange(scenario)}
              className={`w-full p-4 text-left border-2 transition-all ${
                selectedScenario === scenario
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 flex items-center justify-center ${
                  selectedScenario === scenario ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {scenario === "booking" && "💇"}
                  {scenario === "order" && "🍕"}
                  {scenario === "reservation" && "🍽️"}
                </div>
                <div>
                  <div className="font-bold">{scenarioInfo[scenario].title}</div>
                  <div className="text-sm text-muted-foreground">{scenarioInfo[scenario].businessName}</div>
                </div>
              </div>
            </button>
          ))}

          <p className="text-sm text-muted-foreground pt-4">
            Each scenario demonstrates how AIVIA handles different types of customer calls naturally and professionally.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PhoneDemoSection;
