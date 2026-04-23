import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, ChevronDown, Check, Play, Square, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male";
  accent: string;
}

// Curated ElevenLabs voices — mix of accents and styles
const ELEVENLABS_VOICES: Voice[] = [
  // Female
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Warm, friendly American", gender: "female", accent: "American" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", description: "Bright and upbeat", gender: "female", accent: "American" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Confident British", gender: "female", accent: "British" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", description: "Calm and professional", gender: "female", accent: "American" },
  // Male
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", description: "Confident American", gender: "male", accent: "American" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Warm British", gender: "male", accent: "British" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Articulate and young", gender: "male", accent: "American" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", description: "Deep, narrator-style", gender: "male", accent: "American" },
];

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onVoiceSelect: (voiceId: string) => void;
  primaryLanguage: string;
  businessName?: string;
}

export const VoiceSelector = ({ selectedVoiceId, onVoiceSelect, businessName }: VoiceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedVoice = ELEVENLABS_VOICES.find(v => v.id === selectedVoiceId);

  const playVoicePreview = async (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingVoiceId === voice.id) {
      setPlayingVoiceId(null);
      return;
    }

    setLoadingVoiceId(voice.id);

    try {
      const { data, error } = await supabase.functions.invoke('generate-voice-preview', {
        body: {
          voiceId: voice.id,
          businessName: businessName || "your business",
        }
      });

      if (error) throw error;
      if (!data?.audioUrl) throw new Error('No audio received');

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
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm">{voice.name}</p>
            <span className="text-[10px] text-muted-foreground">· {voice.accent}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{voice.description}</p>
        </div>
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
        {isSelected && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-primary-foreground" />
          </div>
        )}
      </div>
    );
  };

  const femaleVoices = ELEVENLABS_VOICES.filter(v => v.gender === "female");
  const maleVoices = ELEVENLABS_VOICES.filter(v => v.gender === "male");

  return (
    <div className="space-y-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">AI Voice</span>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">Premium</Badge>
              {selectedVoice && (
                <span className="text-muted-foreground truncate">— {selectedVoice.name}</span>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform shrink-0", isOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose how your AI assistant sounds. Click play to preview a voice greeting your callers, then click the card to select it.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Female Voices</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {femaleVoices.map(renderVoiceCard)}
            </div>
          </div>

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
