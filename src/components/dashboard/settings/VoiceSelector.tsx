import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male";
}

// Polly Neural voices that sound natural and human-like
const POLLY_VOICES: Record<string, Voice[]> = {
  English: [
    // British English - Neural voices only
    { id: "Polly.Amy-Neural", name: "Amy", description: "Natural British female", gender: "female" },
    { id: "Polly.Emma-Neural", name: "Emma", description: "Warm British female", gender: "female" },
    { id: "Polly.Arthur-Neural", name: "Arthur", description: "Professional British male", gender: "male" },
    { id: "Polly.Brian-Neural", name: "Brian", description: "Confident British male", gender: "male" },
    // US English - Neural voices
    { id: "Polly.Joanna-Neural", name: "Joanna", description: "Friendly US female", gender: "female" },
    { id: "Polly.Kendra-Neural", name: "Kendra", description: "Professional US female", gender: "female" },
    { id: "Polly.Salli-Neural", name: "Salli", description: "Warm US female", gender: "female" },
    { id: "Polly.Matthew-Neural", name: "Matthew", description: "Natural US male", gender: "male" },
    { id: "Polly.Stephen-Neural", name: "Stephen", description: "Authoritative US male", gender: "male" },
  ],
  Spanish: [
    // Spanish Neural voices
    { id: "Polly.Lucia-Neural", name: "Lucía", description: "Natural Spanish female", gender: "female" },
    { id: "Polly.Lupe-Neural", name: "Lupe", description: "Warm Mexican Spanish female", gender: "female" },
    { id: "Polly.Mia-Neural", name: "Mia", description: "Professional Mexican female", gender: "female" },
    { id: "Polly.Sergio-Neural", name: "Sergio", description: "Natural Spanish male", gender: "male" },
    { id: "Polly.Andres-Neural", name: "Andrés", description: "Friendly Mexican male", gender: "male" },
  ],
  French: [
    // French Neural voices
    { id: "Polly.Lea-Neural", name: "Léa", description: "Natural French female", gender: "female" },
    { id: "Polly.Remi-Neural", name: "Rémi", description: "Professional French male", gender: "male" },
    // Canadian French
    { id: "Polly.Gabrielle-Neural", name: "Gabrielle", description: "Warm Canadian French female", gender: "female" },
    { id: "Polly.Liam-Neural", name: "Liam", description: "Natural Canadian French male", gender: "male" },
  ],
  German: [
    // German Neural voices
    { id: "Polly.Vicki-Neural", name: "Vicki", description: "Natural German female", gender: "female" },
    { id: "Polly.Hannah-Neural", name: "Hannah", description: "Warm Austrian German female", gender: "female" },
    { id: "Polly.Daniel-Neural", name: "Daniel", description: "Professional German male", gender: "male" },
  ],
};

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onVoiceSelect: (voiceId: string) => void;
  primaryLanguage: string;
}

export const VoiceSelector = ({ selectedVoiceId, onVoiceSelect, primaryLanguage }: VoiceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get voices for the selected language
  const voices = useMemo(() => {
    return POLLY_VOICES[primaryLanguage] || POLLY_VOICES.English;
  }, [primaryLanguage]);

  const selectedVoice = voices.find(v => v.id === selectedVoiceId);

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
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a natural-sounding voice for your phone assistant. Voices are filtered based on your primary language.
          </p>

          {/* Female Voices */}
          {femaleVoices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Female Voices</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {femaleVoices.map(renderVoiceCard)}
              </div>
            </div>
          )}

          {/* Male Voices */}
          {maleVoices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Male Voices</p>
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
