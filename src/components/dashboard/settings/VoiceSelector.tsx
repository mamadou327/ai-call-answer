import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male";
}

// OpenAI Realtime API voices
const OPENAI_VOICES: Voice[] = [
  // Female voices
  { id: "alloy", name: "Alloy", description: "Neutral, balanced, and versatile", gender: "female" },
  { id: "coral", name: "Coral", description: "Warm, friendly, and approachable", gender: "female" },
  { id: "sage", name: "Sage", description: "Calm, wise, and reassuring", gender: "female" },
  { id: "shimmer", name: "Shimmer", description: "Bright, energetic, and optimistic", gender: "female" },
  // Male voices
  { id: "ash", name: "Ash", description: "Clear, confident, and professional", gender: "male" },
  { id: "ballad", name: "Ballad", description: "Smooth, melodic, and soothing", gender: "male" },
  { id: "echo", name: "Echo", description: "Deep, resonant, and authoritative", gender: "male" },
  { id: "verse", name: "Verse", description: "Articulate, expressive, and engaging", gender: "male" },
];

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onVoiceSelect: (voiceId: string) => void;
  primaryLanguage: string;
  businessName?: string;
}

export const VoiceSelector = ({ selectedVoiceId, onVoiceSelect }: VoiceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedVoice = OPENAI_VOICES.find(v => v.id === selectedVoiceId);

  const renderVoiceCard = (voice: Voice) => {
    const isSelected = selectedVoiceId === voice.id;

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
            Select a voice for your AI phone assistant. These are OpenAI's realtime voices optimized for natural conversation.
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
