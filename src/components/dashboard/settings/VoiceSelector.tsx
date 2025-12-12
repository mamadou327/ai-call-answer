import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, ChevronDown, Check, Play, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male";
  hasPreview: boolean;
}

// OpenAI Realtime API voices
// TTS preview available for: alloy, ash, coral, echo, sage, shimmer
// No preview for: ballad, verse (realtime-only)
const OPENAI_VOICES: Voice[] = [
  // Female voices
  { id: "alloy", name: "Alloy", description: "Neutral, balanced, and versatile", gender: "female", hasPreview: true },
  { id: "coral", name: "Coral", description: "Warm, friendly, and approachable", gender: "female", hasPreview: true },
  { id: "sage", name: "Sage", description: "Calm, wise, and reassuring", gender: "female", hasPreview: true },
  { id: "shimmer", name: "Shimmer", description: "Bright, energetic, and optimistic", gender: "female", hasPreview: true },
  // Male voices
  { id: "ash", name: "Ash", description: "Clear, confident, and professional", gender: "male", hasPreview: true },
  { id: "ballad", name: "Ballad", description: "Smooth, melodic, and soothing", gender: "male", hasPreview: false },
  { id: "echo", name: "Echo", description: "Deep, resonant, and authoritative", gender: "male", hasPreview: true },
  { id: "verse", name: "Verse", description: "Articulate, expressive, and engaging", gender: "male", hasPreview: false },
];

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onVoiceSelect: (voiceId: string) => void;
  primaryLanguage: string;
  businessName?: string;
}

export const VoiceSelector = ({ selectedVoiceId, onVoiceSelect }: VoiceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedVoice = OPENAI_VOICES.find(v => v.id === selectedVoiceId);

  const playVoicePreview = async (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();

    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If already playing this voice, just stop
    if (playingVoiceId === voice.id) {
      setPlayingVoiceId(null);
      return;
    }

    if (!voice.hasPreview) {
      toast.info("Preview not available for this voice");
      return;
    }

    setLoadingVoiceId(voice.id);

    try {
      const { data, error } = await supabase.functions.invoke('generate-openai-voice-preview', {
        body: { voiceId: voice.id }
      });

      if (error) throw error;
      if (data?.unsupported) {
        toast.info("Preview not available for this voice");
        setLoadingVoiceId(null);
        return;
      }
      if (!data?.audioUrl) throw new Error('No audio received');

      // Create and play audio
      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setPlayingVoiceId(voice.id);
        setLoadingVoiceId(null);
      };

      audio.onended = () => {
        setPlayingVoiceId(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingVoiceId(null);
        setLoadingVoiceId(null);
        toast.error("Could not play voice preview");
      };

      await audio.play();
    } catch (error) {
      console.error('Voice preview error:', error);
      setLoadingVoiceId(null);
      toast.error("Could not generate voice preview");
    }
  };

  const stopPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingVoiceId(null);
  };

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
        <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{voice.name}</p>
          <p className="text-xs text-muted-foreground">{voice.description}</p>
        </div>
        <div className="flex items-center gap-1">
          {voice.hasPreview ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={(e) => isPlaying ? stopPreview(e) : playVoicePreview(voice, e)}
              disabled={isLoading}
              title={isPlaying ? "Stop preview" : "Play preview"}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isPlaying ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground px-2">No preview</span>
          )}
        </div>
        {isSelected && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-primary-foreground" />
          </div>
        )}
      </div>
    );
  };

  const femaleVoices = OPENAI_VOICES.filter(v => v.gender === "female");
  const maleVoices = OPENAI_VOICES.filter(v => v.gender === "male");

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
              {!selectedVoice && selectedVoiceId && (
                <span className="text-muted-foreground">— {selectedVoiceId}</span>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a voice for your AI phone assistant. Click play to preview each voice.
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
