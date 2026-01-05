import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Play, Square, Calendar, RefreshCw, X, Phone, ChevronDown, ChevronUp, AlertCircle, Loader2 } from "lucide-react";

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

interface DemoCallPlayerProps {
  scenario: "booking" | "reschedule" | "cancel";
  title: string;
  description: string;
  icon: React.ReactNode;
  manifest?: DemoManifest | null;
}

const VOICE_NAME = "Coral";

export const DemoCallPlayer = ({ scenario, title, description, icon, manifest }: DemoCallPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackStateRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playbackStateRef.current.cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
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

  const playAudioFile = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (playbackStateRef.current.cancelled) {
        reject(new Error("Playback cancelled"));
        return;
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      audio.oncanplaythrough = () => {
        if (!playbackStateRef.current.cancelled) {
          audio.play().catch(reject);
        }
      };
      
      audio.load();
    });
  };

  const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (playbackStateRef.current.cancelled) {
          resolve();
        } else {
          resolve();
        }
      }, ms);
    });
  };

  const startPlayback = useCallback(async () => {
    if (!manifest || !manifest.lines.length) return;

    setIsLoading(true);
    playbackStateRef.current.cancelled = false;
    
    try {
      // Pre-load first audio to check availability
      const testAudio = new Audio(manifest.lines[0].audioUrl);
      await new Promise((resolve, reject) => {
        testAudio.oncanplaythrough = resolve;
        testAudio.onerror = reject;
        testAudio.load();
      });
      
      setIsLoading(false);
      setIsPlaying(true);
      setCurrentLineIndex(0);

      // Play each line sequentially
      for (let i = 0; i < manifest.lines.length; i++) {
        if (playbackStateRef.current.cancelled) break;
        
        setCurrentLineIndex(i);
        
        try {
          await playAudioFile(manifest.lines[i].audioUrl);
        } catch (err) {
          if (playbackStateRef.current.cancelled) break;
          console.error(`Error playing line ${i}:`, err);
        }
        
        // Add pause between lines (except after last line)
        if (i < manifest.lines.length - 1 && !playbackStateRef.current.cancelled) {
          await sleep(manifest.pauseBetweenLinesMs || 500);
        }
      }
    } catch (err) {
      console.error("Playback error:", err);
    } finally {
      setIsPlaying(false);
      setIsLoading(false);
      setCurrentLineIndex(-1);
    }
  }, [manifest]);

  const stopPlayback = useCallback(() => {
    playbackStateRef.current.cancelled = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentLineIndex(-1);
  }, []);

  const hasAudio = manifest && manifest.lines && manifest.lines.length > 0;
  const lines = manifest?.lines || [];

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
          ) : isLoading ? (
            <Button disabled className="gap-2 bg-foreground text-background">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </Button>
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
              <span>Line {currentLineIndex + 1} of {lines.length}</span>
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
              className="max-h-64 overflow-y-auto border-2 border-foreground p-3 space-y-2 bg-muted/50"
            >
              {lines.map((line, index) => (
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
