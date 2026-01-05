import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Play, Square, Calendar, RefreshCw, X, Phone, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

interface TranscriptLine {
  speaker: "aivia" | "customer";
  text: string;
  startMs?: number;
  endMs?: number;
}

interface DemoCallPlayerProps {
  scenario: "booking" | "reschedule" | "cancel";
  title: string;
  description: string;
  icon: React.ReactNode;
  audioUrl?: string | null;
  timingData?: TranscriptLine[] | null;
}

const VOICE_NAME = "Coral";

// Fallback scripts for transcript display when no timing data
const DEMO_SCRIPTS: Record<string, TranscriptLine[]> = {
  booking: [
    { speaker: "aivia", text: `Hi, thanks for calling Bella's Beauty Salon! I'm ${VOICE_NAME}, your AI assistant. How can I help you today?` },
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
    { speaker: "aivia", text: `Hi, thanks for calling Bella's Beauty Salon! I'm ${VOICE_NAME}. How can I help you today?` },
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
    { speaker: "aivia", text: `Hi, thanks for calling Bella's Beauty Salon! I'm ${VOICE_NAME}. How can I help you today?` },
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

export const DemoCallPlayer = ({ scenario, title, description, icon, audioUrl, timingData }: DemoCallPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Use timing data if available, otherwise fallback to static scripts
  const transcript = timingData || DEMO_SCRIPTS[scenario] || [];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Sync transcript with audio playback
  const updateTranscriptPosition = () => {
    if (!audioRef.current || !timingData) return;
    
    const currentTimeMs = audioRef.current.currentTime * 1000;
    
    // Find which line is currently playing
    let activeIndex = -1;
    for (let i = 0; i < timingData.length; i++) {
      const line = timingData[i];
      if (line.startMs !== undefined && line.endMs !== undefined) {
        if (currentTimeMs >= line.startMs && currentTimeMs < line.endMs) {
          activeIndex = i;
          break;
        }
        // If we're past this line but before the next one, show this line
        if (currentTimeMs >= line.startMs && (i === timingData.length - 1 || currentTimeMs < (timingData[i + 1]?.startMs || Infinity))) {
          activeIndex = i;
        }
      }
    }
    
    if (activeIndex !== currentLineIndex && activeIndex >= 0) {
      setCurrentLineIndex(activeIndex);
      
      // Auto-scroll transcript
      if (transcriptRef.current) {
        const lineElement = transcriptRef.current.children[activeIndex] as HTMLElement;
        if (lineElement) {
          lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
    
    // Continue updating while playing
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      animationFrameRef.current = requestAnimationFrame(updateTranscriptPosition);
    }
  };

  // Simple fallback: estimate timing based on text length
  const estimateLineTimings = (): TranscriptLine[] => {
    const lines = DEMO_SCRIPTS[scenario] || [];
    let currentTime = 0;
    
    return lines.map(line => {
      const duration = Math.max(1000, line.text.length * 65); // ~65ms per character
      const result = {
        ...line,
        startMs: currentTime,
        endMs: currentTime + duration,
      };
      currentTime += duration + 400; // Add pause between lines
      return result;
    });
  };

  const startPlayback = () => {
    if (!audioUrl) return;
    
    // Create audio element if not exists
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
    }
    
    setIsPlaying(true);
    setCurrentLineIndex(0);
    
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    
    // Start transcript syncing
    if (timingData) {
      animationFrameRef.current = requestAnimationFrame(updateTranscriptPosition);
    } else {
      // Fallback: estimate timings and sync manually
      const estimatedTimings = estimateLineTimings();
      let lineIndex = 0;
      
      const interval = setInterval(() => {
        if (!audioRef.current || audioRef.current.paused) {
          clearInterval(interval);
          return;
        }
        
        const currentTimeMs = audioRef.current.currentTime * 1000;
        
        for (let i = estimatedTimings.length - 1; i >= 0; i--) {
          if (currentTimeMs >= (estimatedTimings[i].startMs || 0)) {
            if (i !== lineIndex) {
              lineIndex = i;
              setCurrentLineIndex(i);
              
              if (transcriptRef.current) {
                const lineElement = transcriptRef.current.children[i] as HTMLElement;
                if (lineElement) {
                  lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }
            }
            break;
          }
        }
      }, 100);
      
      audioRef.current.onended = () => {
        clearInterval(interval);
        setIsPlaying(false);
        setCurrentLineIndex(-1);
      };
    }
    
    audioRef.current.onended = () => {
      setIsPlaying(false);
      setCurrentLineIndex(-1);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    setCurrentLineIndex(-1);
  };

  const hasAudio = !!audioUrl;

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
        <div className="flex items-center gap-2">
          {!hasAudio ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>Audio not generated yet. Generate below.</span>
            </div>
          ) : !isPlaying ? (
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

          {/* Playing indicator */}
          {isPlaying && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 animate-pulse" />
              <span>Playing call...</span>
            </div>
          )}
        </div>

        {/* Collapsible Transcript */}
        <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="gap-2 p-0 h-auto text-muted-foreground hover:text-foreground">
              {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showTranscript ? "Hide Transcript" : "Show Transcript"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
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
                        : "opacity-70"
                  }`}
                >
                  <span className={`font-bold text-xs uppercase min-w-[70px] ${
                    line.speaker === "aivia" ? "" : "text-muted-foreground"
                  }`}>
                    {line.speaker === "aivia" ? `🤖 ${VOICE_NAME}` : "👤 Customer"}
                  </span>
                  <span className="text-sm">{line.text}</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
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
