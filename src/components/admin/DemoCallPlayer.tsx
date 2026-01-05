import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Square, Loader2, Volume2, Calendar, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export const DemoCallPlayer = ({ scenario, title, description, icon }: DemoCallPlayerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Calculate approximate timing for each line based on text length
  const getLineDuration = (text: string) => {
    // Approximate: 150 words per minute = 2.5 words per second
    // Average word length ~5 chars, so ~12.5 chars per second
    // Add some padding for natural pauses
    const baseDuration = (text.length / 12) * 1000; // ms
    return Math.max(baseDuration, 1500); // minimum 1.5 seconds per line
  };

  const generateAndPlay = async () => {
    setIsLoading(true);
    setCurrentLineIndex(-1);
    
    try {
      // Check if we have cached audio
      const cacheKey = `demo_call_${scenario}`;
      const cached = localStorage.getItem(cacheKey);
      
      let audio: string;
      let transcriptData: TranscriptLine[];
      
      if (cached) {
        const parsedCache = JSON.parse(cached);
        audio = parsedCache.audioUrl;
        transcriptData = parsedCache.transcript;
        console.log("Using cached demo audio");
      } else {
        // Generate new audio
        const { data, error } = await supabase.functions.invoke("generate-demo-call", {
          body: { scenario },
        });

        if (error) throw error;
        if (!data.audioUrl) throw new Error("No audio generated");

        audio = data.audioUrl;
        transcriptData = data.transcript;
        
        // Cache for future use
        localStorage.setItem(cacheKey, JSON.stringify({ audioUrl: audio, transcript: transcriptData }));
      }

      setAudioUrl(audio);
      setTranscript(transcriptData);
      
      // Play audio
      playAudio(audio, transcriptData);
      
    } catch (error) {
      console.error("Demo generation error:", error);
      toast.error("Failed to generate demo. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (url: string, transcriptData: TranscriptLine[]) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    
    audio.onplay = () => {
      setIsPlaying(true);
      // Start transcript animation
      animateTranscript(transcriptData);
    };
    
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentLineIndex(-1);
    };
    
    audio.onerror = () => {
      setIsPlaying(false);
      toast.error("Failed to play audio");
    };

    audio.play().catch((err) => {
      console.error("Playback error:", err);
      toast.error("Failed to play audio. Please try again.");
    });
  };

  const animateTranscript = (transcriptData: TranscriptLine[]) => {
    let cumulativeTime = 0;
    
    transcriptData.forEach((line, index) => {
      setTimeout(() => {
        setCurrentLineIndex(index);
        // Auto-scroll to current line
        if (transcriptRef.current) {
          const lineElement = transcriptRef.current.children[index] as HTMLElement;
          if (lineElement) {
            lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }, cumulativeTime);
      
      cumulativeTime += getLineDuration(line.text);
    });
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentLineIndex(-1);
  };

  const replayFromCache = () => {
    if (audioUrl && transcript.length > 0) {
      playAudio(audioUrl, transcript);
    } else {
      generateAndPlay();
    }
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
              onClick={audioUrl ? replayFromCache : generateAndPlay}
              disabled={isLoading}
              className="gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {audioUrl ? "Play Again" : "Play Demo"}
                </>
              )}
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
        {transcript.length > 0 && (
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
                      : ""
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
        )}

        {/* Playing indicator */}
        {isPlaying && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Volume2 className="h-4 w-4 animate-pulse" />
            <span>Playing demo call...</span>
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
