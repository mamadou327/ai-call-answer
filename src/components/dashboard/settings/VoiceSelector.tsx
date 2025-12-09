import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

// British ElevenLabs voices only
const ELEVENLABS_VOICES: Voice[] = [
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "Warm & friendly British", gender: "female" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Confident British", gender: "female" },
  { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", description: "Pleasant British", gender: "female" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", description: "Expressive British", gender: "female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Warm British professional", gender: "male" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Authoritative British", gender: "male" },
  { id: "SOYHLrjzK2X1ezoPC6cr", name: "Harry", description: "Young British", gender: "male" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", description: "Intense British", gender: "male" },
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
  const [customVoiceId, setCustomVoiceId] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if selected voice is a custom one (not in our list)
  const isCustomVoice = selectedVoiceId && !ELEVENLABS_VOICES.find(v => v.id === selectedVoiceId);

  useEffect(() => {
    if (isCustomVoice && selectedVoiceId) {
      setCustomVoiceId(selectedVoiceId);
    }
  }, [selectedVoiceId, isCustomVoice]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPreview = async (voiceId: string) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If clicking same voice, just stop
    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      return;
    }

    // Check cache first
    if (audioCache[voiceId]) {
      playAudio(voiceId, audioCache[voiceId]);
      return;
    }

    // Generate new audio
    setLoadingVoiceId(voiceId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-voice-preview", {
        body: { voiceId, businessName: businessName || "your business" },
      });

      if (error) throw error;

      // Cache the audio
      setAudioCache(prev => ({ ...prev, [voiceId]: data.audioUrl }));
      playAudio(voiceId, data.audioUrl);
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

  const handleCustomVoiceSubmit = () => {
    if (customVoiceId.trim()) {
      onVoiceSelect(customVoiceId.trim());
    }
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
        onClick={() => {
          onVoiceSelect(voice.id);
          setCustomVoiceId("");
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full bg-muted"
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation();
            handlePlayPreview(voice.id);
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
              {selectedVoice ? (
                <span className="text-muted-foreground">— {selectedVoice.name}</span>
              ) : isCustomVoice ? (
                <span className="text-muted-foreground">— Custom Voice</span>
              ) : null}
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Click play to hear each voice say your business greeting, then select your preferred British voice.
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

          {/* Custom Voice ID */}
          <div className="space-y-2 pt-4 border-t">
            <Label className="text-sm font-medium">Custom ElevenLabs Voice ID</Label>
            <p className="text-xs text-muted-foreground">
              Have your own ElevenLabs voice? Paste the Voice ID here.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. EXAVITQu4vr4xnSDxMaL"
                value={customVoiceId}
                onChange={(e) => setCustomVoiceId(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!customVoiceId.trim() || loadingVoiceId === customVoiceId}
                onClick={() => handlePlayPreview(customVoiceId.trim())}
              >
                {loadingVoiceId === customVoiceId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : playingVoiceId === customVoiceId ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCustomVoiceSubmit}
                disabled={!customVoiceId.trim()}
              >
                Use This Voice
              </Button>
            </div>
            {isCustomVoice && (
              <p className="text-xs text-primary">Currently using custom voice ID</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
