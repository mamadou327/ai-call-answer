import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Volume2, ChevronDown, Check, Play, Square, Loader2, Sparkles, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Voice {
  id: string;
  voice_id: string;
  name: string;
  description: string;
  gender: "female" | "male";
  accent: "British" | "American";
  verified_languages: string[];
  is_multilingual: boolean;
}

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onVoiceSelect: (voiceId: string) => void;
  primaryLanguage: string;
  businessName?: string;
}

const LANG_LABELS: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ru: "Russian", tr: "Turkish",
  ar: "Arabic", hi: "Hindi", ja: "Japanese", ko: "Korean", zh: "Chinese",
  cy: "Welsh", ga: "Irish", sv: "Swedish", da: "Danish", no: "Norwegian",
  fi: "Finnish", cs: "Czech", el: "Greek", he: "Hebrew", id: "Indonesian",
  ms: "Malay", ro: "Romanian", uk: "Ukrainian", vi: "Vietnamese",
};
const langLabel = (code: string) => LANG_LABELS[code.toLowerCase()] ?? code.toUpperCase();

export const VoiceSelector = ({ selectedVoiceId, onVoiceSelect, primaryLanguage, businessName }: VoiceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [search, setSearch] = useState("");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("voice_library")
        .select("id, voice_id, name, description, gender, accent, verified_languages, is_multilingual")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Failed to load voices:", error);
        toast.error("Could not load voice library");
      } else if (data) {
        setVoices(data as Voice[]);
      }
      setLoadingVoices(false);
    };
    load();
  }, []);

  const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId);

  const playVoicePreview = async (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingVoiceId === voice.voice_id) {
      setPlayingVoiceId(null);
      return;
    }

    setLoadingVoiceId(voice.voice_id);

    try {
      const { data, error } = await supabase.functions.invoke('generate-voice-preview', {
        body: {
          voiceId: voice.voice_id,
          businessName: businessName || "your business",
        }
      });

      if (error) throw error;
      if (!data?.audioUrl) throw new Error('No audio received');

      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setPlayingVoiceId(voice.voice_id);
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

  const filteredVoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return voices.filter(v => {
      if (!q) return true;
      return v.name.toLowerCase().includes(q) || v.description.toLowerCase().includes(q);
    });
  }, [voices, search]);

  const groups = useMemo(() => {
    const order: Array<{ key: string; label: string; gender: "female" | "male" }> = [
      { key: "f", label: "Female", gender: "female" },
      { key: "m", label: "Male", gender: "male" },
    ];
    return order
      .map(g => ({ ...g, voices: filteredVoices.filter(v => v.gender === g.gender) }))
      .filter(g => g.voices.length > 0);
  }, [filteredVoices]);

  const renderVoiceCard = (voice: Voice) => {
    const isSelected = selectedVoiceId === voice.voice_id;
    const isPlaying = playingVoiceId === voice.voice_id;
    const isLoading = loadingVoiceId === voice.voice_id;
    const langs = voice.verified_languages ?? ["en"];

    return (
      <div
        key={voice.id}
        className={cn(
          "relative flex flex-col gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
        onClick={() => onVoiceSelect(voice.voice_id)}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{voice.name}</p>
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
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {voice.is_multilingual ? (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Multilingual</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">English only</Badge>
          )}
          {langs.slice(0, 4).map((l) => (
            <Badge key={l} variant="outline" className="text-[10px] h-5 px-1.5">
              {langLabel(l)}
            </Badge>
          ))}
          {langs.length > 4 && (
            <span className="text-[10px] text-muted-foreground">+{langs.length - 4} more</span>
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
            British voices recommended for UK businesses. Click play to preview, then click a card to select.
          </p>

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search voices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loadingVoices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No voices match your filters.</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.voices.map(renderVoiceCard)}
                </div>
              </div>
            ))
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
