import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Volume2, ChevronDown, Play, Loader2, Square, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male";
}

// ElevenLabs British voices - natural, human-like voices
const ELEVENLABS_VOICES: Record<string, Voice[]> = {
  English: [
    // Female British voices
    { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "Confident & articulate British female", gender: "female" },
    { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Warm & conversational British female", gender: "female" },
    { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Warm & engaging British narrator", gender: "female" },
    { id: "jsCqWAovK2LkecY7zXl4", name: "Freya", description: "Soft & soothing British female", gender: "female" },
    { id: "oWAxZDx7w5VEj9dCyTzz", name: "Grace", description: "Professional British female", gender: "female" },
    // Male British voices
    { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Warm & friendly British narrator", gender: "male" },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Authoritative & clear British male", gender: "male" },
    { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", description: "Calm & reassuring British male", gender: "male" },
    { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", description: "Deep & trustworthy British male", gender: "male" },
    { id: "bIHbv24MWmeRgasZH58o", name: "Will", description: "Friendly & approachable British male", gender: "male" },
  ],
  Spanish: [
    { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "British female (multilingual)", gender: "female" },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "British male (multilingual)", gender: "male" },
  ],
  French: [
    { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "British female (multilingual)", gender: "female" },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "British male (multilingual)", gender: "male" },
  ],
  German: [
    { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "British female (multilingual)", gender: "female" },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "British male (multilingual)", gender: "male" },
  ],
};

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onVoiceSelect: (voiceId: string) => void;
  primaryLanguage: string;
  businessName?: string;
}

export const VoiceSelector = ({ selectedVoiceId, onVoiceSelect, primaryLanguage, businessName }: VoiceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get voices for the selected language
  const voices = useMemo(() => {
    return ELEVENLABS_VOICES[primaryLanguage] || ELEVENLABS_VOICES.English;
  }, [primaryLanguage]);

  const selectedVoice = voices.find(v => v.id === selectedVoiceId);
  const isCustomVoice = selectedVoiceId && !selectedVoice;

  const playVoicePreview = async (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If already playing this voice, just stop
    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      return;
    }

    setLoadingVoiceId(voiceId);

    try {
      const { data, error } = await supabase.functions.invoke('generate-voice-preview', {
        body: { 
          voiceId: voiceId, 
          businessName: businessName || 'your business' 
        }
      });

      if (error) throw error;
      if (!data?.audioUrl) throw new Error('No audio received');

      // Create and play audio
      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setPlayingVoiceId(voiceId);
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

  const copyVoiceId = (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(voiceId);
    setCopiedId(voiceId);
    toast.success("Voice ID copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCustomVoiceSubmit = () => {
    if (customVoiceId.trim()) {
      onVoiceSelect(customVoiceId.trim());
      toast.success("Custom voice ID applied!");
    }
  };

  const renderVoiceCard = (voice: Voice) => {
    const isSelected = selectedVoiceId === voice.id;
    const isPlaying = playingVoiceId === voice.id;
    const isLoading = loadingVoiceId === voice.id;
    const isCopied = copiedId === voice.id;

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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(e) => copyVoiceId(voice.id, e)}
            title="Copy voice ID"
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(e) => isPlaying ? stopPreview(e) : playVoicePreview(voice.id, e)}
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

  const femaleVoices = voices.filter(v => v.gender === "female");
  const maleVoices = voices.filter(v => v.gender === "male");

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
              {isCustomVoice && (
                <span className="text-muted-foreground">— Custom Voice</span>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a natural-sounding British voice for your phone assistant. Click play to hear each voice.
          </p>

          {/* Custom Voice ID Input */}
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg border border-dashed">
            <Label htmlFor="custom-voice-id" className="text-sm font-medium">
              Custom ElevenLabs Voice ID
            </Label>
            <p className="text-xs text-muted-foreground">
              Paste a voice ID from{" "}
              <a 
                href="https://elevenlabs.io/voice-library" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                ElevenLabs Voice Library
              </a>
              {" "}to use a custom voice.
            </p>
            <div className="flex gap-2">
              <Input
                id="custom-voice-id"
                placeholder="e.g. pNInz6obpgDQGcFmaJgB"
                value={customVoiceId}
                onChange={(e) => setCustomVoiceId(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="button" 
                onClick={handleCustomVoiceSubmit}
                disabled={!customVoiceId.trim()}
                size="sm"
              >
                Apply
              </Button>
              {customVoiceId.trim() && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={(e) => playVoicePreview(customVoiceId.trim(), e)}
                  disabled={loadingVoiceId === customVoiceId.trim()}
                  title="Preview custom voice"
                >
                  {loadingVoiceId === customVoiceId.trim() ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : playingVoiceId === customVoiceId.trim() ? (
                    <Square className="h-4 w-4 fill-current" onClick={stopPreview} />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {isCustomVoice && selectedVoiceId && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Using custom voice: {selectedVoiceId}
              </p>
            )}
          </div>

          {/* Female Voices */}
          {femaleVoices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Female British Voices</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {femaleVoices.map(renderVoiceCard)}
              </div>
            </div>
          )}

          {/* Male Voices */}
          {maleVoices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Male British Voices</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {maleVoices.map(renderVoiceCard)}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
