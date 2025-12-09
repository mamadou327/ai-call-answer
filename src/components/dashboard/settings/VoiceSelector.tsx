import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Play, Pause, Volume2, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male" | "neutral";
}

const ELEVENLABS_VOICES: Voice[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Warm & natural", gender: "female" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", description: "Calm & professional", gender: "female" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "Friendly & warm", gender: "female" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Soft & gentle", gender: "female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Warm & professional", gender: "male" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", description: "Conversational", gender: "male" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Friendly & clear", gender: "male" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Young & energetic", gender: "male" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", description: "Neutral & smooth", gender: "neutral" },
];

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onVoiceSelect: (voiceId: string) => void;
  businessName: string;
}

export const VoiceSelector = ({ selectedVoiceId, onVoiceSelect, businessName }: VoiceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPreview = async (voice: Voice) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If clicking same voice, just stop
    if (playingVoiceId === voice.id) {
      setPlayingVoiceId(null);
      return;
    }

    // Check cache first
    if (audioCache[voice.id]) {
      playAudio(voice.id, audioCache[voice.id]);
      return;
    }

    // Generate new audio
    setLoadingVoiceId(voice.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-voice-preview", {
        body: { voiceId: voice.id, businessName: businessName || "your business" },
      });

      if (error) throw error;

      // Cache the audio
      setAudioCache(prev => ({ ...prev, [voice.id]: data.audioUrl }));
      playAudio(voice.id, data.audioUrl);
    } catch (error) {
      console.error("Error generating preview:", error);
    } finally {
      setLoadingVoiceId(null);
    }
  };

  const playAudio = (voiceId: string, audioUrl: string) => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setPlayingVoiceId(voiceId);

    audio.play().catch(console.error);
    audio.onended = () => {
      setPlayingVoiceId(null);
      audioRef.current = null;
    };
  };

  const selectedVoice = ELEVENLABS_VOICES.find(v => v.id === selectedVoiceId);

  const renderVoiceCard = (voice: Voice) => {
    const isSelected = selectedVoiceId === voice.id;
    const isPlaying = playingVoiceId === voice.id;
    const isLoading = loadingVoiceId === voice.id;

    return (
      <div
        key={voice.id}
        className={cn(
          "relative flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
        onClick={() => onVoiceSelect(voice.id)}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full bg-muted"
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation();
            handlePlayPreview(voice);
          }}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{voice.name}</p>
          <p className="text-xs text-muted-foreground">{voice.description}</p>
        </div>
        {isSelected && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    );
  };

  const femaleVoices = ELEVENLABS_VOICES.filter(v => v.gender === "female");
  const maleVoices = ELEVENLABS_VOICES.filter(v => v.gender === "male");
  const neutralVoices = ELEVENLABS_VOICES.filter(v => v.gender === "neutral");

  return (
    <div className="space-y-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span>AI Voice</span>
              {selectedVoice && (
                <span className="text-muted-foreground">— {selectedVoice.name}</span>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Click play to hear each voice say your business greeting, then select your preferred voice.
          </p>

          {/* Female Voices */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Female Voices</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {femaleVoices.map(renderVoiceCard)}
            </div>
          </div>

          {/* Male Voices */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Male Voices</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {maleVoices.map(renderVoiceCard)}
            </div>
          </div>

          {/* Neutral Voices */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Neutral Voices</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {neutralVoices.map(renderVoiceCard)}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
