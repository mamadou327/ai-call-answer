import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, ChevronDown, Play, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male";
  lang?: string; // BCP 47 language code for Web Speech API
}

// Polly Neural voices that sound natural and human-like
const POLLY_VOICES: Record<string, Voice[]> = {
  English: [
    // British English - Neural voices only
    { id: "Polly.Amy-Neural", name: "Amy", description: "Natural British female", gender: "female", lang: "en-GB" },
    { id: "Polly.Emma-Neural", name: "Emma", description: "Warm British female", gender: "female", lang: "en-GB" },
    { id: "Polly.Arthur-Neural", name: "Arthur", description: "Professional British male", gender: "male", lang: "en-GB" },
    { id: "Polly.Brian-Neural", name: "Brian", description: "Confident British male", gender: "male", lang: "en-GB" },
    // US English - Neural voices
    { id: "Polly.Joanna-Neural", name: "Joanna", description: "Friendly US female", gender: "female", lang: "en-US" },
    { id: "Polly.Kendra-Neural", name: "Kendra", description: "Professional US female", gender: "female", lang: "en-US" },
    { id: "Polly.Salli-Neural", name: "Salli", description: "Warm US female", gender: "female", lang: "en-US" },
    { id: "Polly.Matthew-Neural", name: "Matthew", description: "Natural US male", gender: "male", lang: "en-US" },
    { id: "Polly.Stephen-Neural", name: "Stephen", description: "Authoritative US male", gender: "male", lang: "en-US" },
  ],
  Spanish: [
    // Spanish Neural voices
    { id: "Polly.Lucia-Neural", name: "Lucía", description: "Natural Spanish female", gender: "female", lang: "es-ES" },
    { id: "Polly.Lupe-Neural", name: "Lupe", description: "Warm Mexican Spanish female", gender: "female", lang: "es-MX" },
    { id: "Polly.Mia-Neural", name: "Mia", description: "Professional Mexican female", gender: "female", lang: "es-MX" },
    { id: "Polly.Sergio-Neural", name: "Sergio", description: "Natural Spanish male", gender: "male", lang: "es-ES" },
    { id: "Polly.Andres-Neural", name: "Andrés", description: "Friendly Mexican male", gender: "male", lang: "es-MX" },
  ],
  French: [
    // French Neural voices
    { id: "Polly.Lea-Neural", name: "Léa", description: "Natural French female", gender: "female", lang: "fr-FR" },
    { id: "Polly.Remi-Neural", name: "Rémi", description: "Professional French male", gender: "male", lang: "fr-FR" },
    // Canadian French
    { id: "Polly.Gabrielle-Neural", name: "Gabrielle", description: "Warm Canadian French female", gender: "female", lang: "fr-CA" },
    { id: "Polly.Liam-Neural", name: "Liam", description: "Natural Canadian French male", gender: "male", lang: "fr-CA" },
  ],
  German: [
    // German Neural voices
    { id: "Polly.Vicki-Neural", name: "Vicki", description: "Natural German female", gender: "female", lang: "de-DE" },
    { id: "Polly.Hannah-Neural", name: "Hannah", description: "Warm Austrian German female", gender: "female", lang: "de-AT" },
    { id: "Polly.Daniel-Neural", name: "Daniel", description: "Professional German male", gender: "male", lang: "de-DE" },
  ],
};

// Sample text for previews
const SAMPLE_TEXTS: Record<string, string> = {
  English: "Hello, thank you for calling. How can I help you today?",
  Spanish: "Hola, gracias por llamar. ¿En qué puedo ayudarle hoy?",
  French: "Bonjour, merci d'avoir appelé. Comment puis-je vous aider aujourd'hui?",
  German: "Hallo, danke für Ihren Anruf. Wie kann ich Ihnen heute helfen?",
};

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onVoiceSelect: (voiceId: string) => void;
  primaryLanguage: string;
}

export const VoiceSelector = ({ selectedVoiceId, onVoiceSelect, primaryLanguage }: VoiceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Get voices for the selected language
  const voices = useMemo(() => {
    return POLLY_VOICES[primaryLanguage] || POLLY_VOICES.English;
  }, [primaryLanguage]);

  const selectedVoice = voices.find(v => v.id === selectedVoiceId);

  const playVoicePreview = (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (playingVoiceId === voice.id) {
      setPlayingVoiceId(null);
      return;
    }

    if (!window.speechSynthesis) {
      toast.error("Voice preview not supported in this browser");
      return;
    }

    // Wait for voices to load
    let availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        availableVoices = window.speechSynthesis.getVoices();
        speakWithVoice(voice, availableVoices);
      };
    } else {
      speakWithVoice(voice, availableVoices);
    }
  };

  const speakWithVoice = (voice: Voice, availableVoices: SpeechSynthesisVoice[]) => {
    const sampleText = SAMPLE_TEXTS[primaryLanguage] || SAMPLE_TEXTS.English;
    const utterance = new SpeechSynthesisUtterance(sampleText);
    
    // Get the base language code (e.g., "en" from "en-GB")
    const baseLang = voice.lang?.split("-")[0] || "en";
    const region = voice.lang?.split("-")[1] || "";
    
    // Find voices matching the language and try to match gender
    const langVoices = availableVoices.filter(v => v.lang.startsWith(baseLang));
    
    // Prioritize voices that match the specific region (e.g., en-GB vs en-US)
    let matchingVoice: SpeechSynthesisVoice | undefined;
    
    if (region) {
      // Try to find exact regional match with gender preference
      matchingVoice = langVoices.find(v => {
        const isRightRegion = v.lang.includes(region);
        const nameLower = v.name.toLowerCase();
        const isFemale = nameLower.includes('female') || nameLower.includes('samantha') || 
                         nameLower.includes('victoria') || nameLower.includes('karen') ||
                         nameLower.includes('moira') || nameLower.includes('fiona') ||
                         nameLower.includes('zira') || nameLower.includes('hazel');
        const isMale = nameLower.includes('male') || nameLower.includes('daniel') || 
                       nameLower.includes('alex') || nameLower.includes('david') ||
                       nameLower.includes('fred') || nameLower.includes('thomas');
        
        if (voice.gender === "female") {
          return isRightRegion && (isFemale || !isMale);
        } else {
          return isRightRegion && (isMale || !isFemale);
        }
      });
      
      // Fallback to any voice in that region
      if (!matchingVoice) {
        matchingVoice = langVoices.find(v => v.lang.includes(region));
      }
    }
    
    // Fallback to any voice in the language with gender preference
    if (!matchingVoice) {
      matchingVoice = langVoices.find(v => {
        const nameLower = v.name.toLowerCase();
        if (voice.gender === "female") {
          return !nameLower.includes('male') || nameLower.includes('female');
        } else {
          return nameLower.includes('male') || nameLower.includes('daniel') || nameLower.includes('david');
        }
      }) || langVoices[0];
    }
    
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }
    
    utterance.lang = voice.lang || "en-GB";
    
    // Create distinct voice characteristics based on the voice type
    // Each voice gets unique pitch, rate and volume adjustments
    const voiceSettings: Record<string, { pitch: number; rate: number }> = {
      // English voices - each sounds distinct
      "Polly.Amy-Neural": { pitch: 1.15, rate: 1.0 },      // Higher pitch, natural British female
      "Polly.Emma-Neural": { pitch: 1.05, rate: 0.95 },    // Warm, slightly slower
      "Polly.Arthur-Neural": { pitch: 0.75, rate: 0.95 },  // Deep professional male
      "Polly.Brian-Neural": { pitch: 0.85, rate: 1.05 },   // Confident, slightly faster
      "Polly.Joanna-Neural": { pitch: 1.1, rate: 1.0 },    // Friendly US female
      "Polly.Kendra-Neural": { pitch: 1.0, rate: 0.98 },   // Professional, measured
      "Polly.Salli-Neural": { pitch: 1.08, rate: 0.92 },   // Warm, relaxed
      "Polly.Matthew-Neural": { pitch: 0.8, rate: 1.0 },   // Natural US male
      "Polly.Stephen-Neural": { pitch: 0.7, rate: 0.9 },   // Deep, authoritative
      // Spanish voices
      "Polly.Lucia-Neural": { pitch: 1.12, rate: 1.0 },
      "Polly.Lupe-Neural": { pitch: 1.05, rate: 0.95 },
      "Polly.Mia-Neural": { pitch: 1.0, rate: 1.02 },
      "Polly.Sergio-Neural": { pitch: 0.78, rate: 0.98 },
      "Polly.Andres-Neural": { pitch: 0.85, rate: 1.0 },
      // French voices
      "Polly.Lea-Neural": { pitch: 1.1, rate: 1.0 },
      "Polly.Remi-Neural": { pitch: 0.8, rate: 0.95 },
      "Polly.Gabrielle-Neural": { pitch: 1.05, rate: 0.98 },
      "Polly.Liam-Neural": { pitch: 0.75, rate: 1.0 },
      // German voices
      "Polly.Vicki-Neural": { pitch: 1.08, rate: 1.0 },
      "Polly.Hannah-Neural": { pitch: 1.02, rate: 0.95 },
      "Polly.Daniel-Neural": { pitch: 0.82, rate: 0.98 },
    };
    
    const settings = voiceSettings[voice.id] || { 
      pitch: voice.gender === "female" ? 1.1 : 0.8, 
      rate: 1.0 
    };
    
    utterance.pitch = settings.pitch;
    utterance.rate = settings.rate;

    utterance.onstart = () => setPlayingVoiceId(voice.id);
    utterance.onend = () => setPlayingVoiceId(null);
    utterance.onerror = () => {
      setPlayingVoiceId(null);
      toast.error("Could not play voice preview");
    };

    speechSynthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingVoiceId(null);
  };

  const renderVoiceCard = (voice: Voice) => {
    const isSelected = selectedVoiceId === voice.id;
    const isPlaying = playingVoiceId === voice.id;

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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={(e) => isPlaying ? stopPreview(e) : playVoicePreview(voice, e)}
          title={isPlaying ? "Stop preview" : "Play preview"}
        >
          {isPlaying ? (
            <Square className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>
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
            Select a voice for your phone assistant. Click play to hear a preview. 
            <span className="text-xs italic block mt-1">Note: Previews are approximate - actual call quality is higher.</span>
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
