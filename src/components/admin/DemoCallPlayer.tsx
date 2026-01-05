import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Square, Volume2, Calendar, RefreshCw, X, Phone } from "lucide-react";

interface TranscriptLine {
  speaker: "aivia" | "customer";
  text: string;
}

interface DemoCallPlayerProps {
  scenario: "booking" | "reschedule" | "cancel";
  title: string;
  description: string;
  icon: React.ReactNode;
}

// Pre-defined scripts for instant playback
const DEMO_SCRIPTS: Record<string, TranscriptLine[]> = {
  booking: [
    { speaker: "aivia", text: "Hi, thanks for calling Bella's Beauty Salon! I'm AIVIA, your AI assistant. How can I help you today?" },
    { speaker: "customer", text: "Hi, I'd like to book a haircut please." },
    { speaker: "aivia", text: "Of course! I'd be happy to help you book a haircut. When would you like to come in?" },
    { speaker: "customer", text: "Tomorrow afternoon if possible?" },
    { speaker: "aivia", text: "Let me check... I have availability tomorrow at 2pm or 3:30pm. Which works better for you?" },
    { speaker: "customer", text: "2pm would be perfect." },
    { speaker: "aivia", text: "Excellent! Can I take your name please?" },
    { speaker: "customer", text: "It's Sarah." },
    { speaker: "aivia", text: "Perfect, Sarah! Your haircut is confirmed for tomorrow at 2pm. We'll send you a confirmation text shortly. Is there anything else I can help you with?" },
    { speaker: "customer", text: "No, that's everything. Thank you!" },
    { speaker: "aivia", text: "You're welcome! We look forward to seeing you tomorrow. Have a lovely day!" },
  ],
  reschedule: [
    { speaker: "aivia", text: "Hi, thanks for calling Bella's Beauty Salon! I'm AIVIA. How can I help you today?" },
    { speaker: "customer", text: "Hi, I have an appointment booked but I need to change it." },
    { speaker: "aivia", text: "No problem at all! Can I take your name or booking reference?" },
    { speaker: "customer", text: "It's Sarah. I'm booked for tomorrow at 2pm." },
    { speaker: "aivia", text: "I found your haircut booking for tomorrow at 2pm. When would you like to reschedule to?" },
    { speaker: "customer", text: "Can I move it to Friday at 11am?" },
    { speaker: "aivia", text: "Let me check... Yes, Friday at 11am is available! I've moved your appointment. You'll receive a new confirmation text." },
    { speaker: "customer", text: "That's great, thank you so much!" },
    { speaker: "aivia", text: "You're welcome, Sarah! We'll see you Friday at 11am. Have a lovely day!" },
  ],
  cancel: [
    { speaker: "aivia", text: "Hi, thanks for calling Bella's Beauty Salon! I'm AIVIA. How can I help you today?" },
    { speaker: "customer", text: "Hi, I need to cancel my appointment please." },
    { speaker: "aivia", text: "I'm sorry to hear that. Can I take your name or booking reference?" },
    { speaker: "customer", text: "It's Sarah. I'm booked for Friday at 11am." },
    { speaker: "aivia", text: "I found your haircut booking for Friday at 11am. Are you sure you'd like to cancel?" },
    { speaker: "customer", text: "Yes please." },
    { speaker: "aivia", text: "No problem, I've cancelled that for you. Would you like to rebook for another time?" },
    { speaker: "customer", text: "Not right now, but I'll call back." },
    { speaker: "aivia", text: "Of course! We'd love to see you soon. Have a lovely day, Sarah!" },
  ],
};

export const DemoCallPlayer = ({ scenario, title, description, icon }: DemoCallPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  const transcript = DEMO_SCRIPTS[scenario] || [];

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

  // Calculate timing for each line based on text length
  const getLineDuration = (text: string) => {
    // Approximate: 150 words per minute = 2.5 words per second
    // Average word length ~5 chars, so ~12.5 chars per second
    const baseDuration = (text.length / 12) * 1000;
    return Math.max(baseDuration, 1500); // minimum 1.5 seconds per line
  };

  const startPlayback = () => {
    setIsPlaying(true);
    setCurrentLineIndex(0);
    
    // Clear any existing timeouts
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];

    let cumulativeTime = getLineDuration(transcript[0].text);

    // Schedule each line transition
    transcript.slice(1).forEach((line, index) => {
      const timeout = setTimeout(() => {
        setCurrentLineIndex(index + 1);
        // Auto-scroll to current line
        if (transcriptRef.current) {
          const lineElement = transcriptRef.current.children[index + 1] as HTMLElement;
          if (lineElement) {
            lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }, cumulativeTime);
      
      timeoutRefs.current.push(timeout);
      cumulativeTime += getLineDuration(line.text);
    });

    // Schedule end of playback
    const endTimeout = setTimeout(() => {
      setIsPlaying(false);
      setCurrentLineIndex(-1);
    }, cumulativeTime);
    
    timeoutRefs.current.push(endTimeout);
  };

  const stopPlayback = () => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
    setIsPlaying(false);
    setCurrentLineIndex(-1);
  };

  return (
    <Card className="border-2 border-foreground">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-foreground text-background">
            {icon}
          </div>
          <div>
            <CardTitle className="text-lg font-bold">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex gap-2">
          {!isPlaying ? (
            <Button
              onClick={startPlayback}
              className="gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              <Play className="h-4 w-4" />
              Play Demo
            </Button>
          ) : (
            <Button
              onClick={stopPlayback}
              variant="outline"
              className="gap-2 border-2 border-foreground"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          )}
        </div>

        {/* Transcript Display */}
        <div 
          ref={transcriptRef}
          className="max-h-48 overflow-y-auto border-2 border-foreground p-3 space-y-2 bg-muted/50"
        >
          {transcript.map((line, index) => (
            <div
              key={index}
              className={`flex gap-2 p-2 rounded transition-all duration-300 ${
                index === currentLineIndex 
                  ? "bg-foreground text-background" 
                  : index < currentLineIndex 
                    ? "opacity-50" 
                    : "opacity-30"
              }`}
            >
              <span className={`font-bold text-xs uppercase min-w-[70px] ${
                line.speaker === "aivia" ? "" : "text-muted-foreground"
              }`}>
                {line.speaker === "aivia" ? "🤖 AIVIA" : "👤 Customer"}
              </span>
              <span className="text-sm">{line.text}</span>
            </div>
          ))}
        </div>

        {/* Playing indicator */}
        {isPlaying && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 animate-pulse" />
            <span>Simulating call...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Export icons for use in DemoCallsTab
export const DemoIcons = {
  booking: <Calendar className="h-5 w-5" />,
  reschedule: <RefreshCw className="h-5 w-5" />,
  cancel: <X className="h-5 w-5" />,
};
