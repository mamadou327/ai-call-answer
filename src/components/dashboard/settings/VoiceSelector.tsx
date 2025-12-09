import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Play, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "female" | "male" | "neutral";
  previewUrl: string;
}

// ElevenLabs top voices with preview URLs
const ELEVENLABS_VOICES: Voice[] = [
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    description: "Warm & natural",
    gender: "female",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2571e83c99.mp3",
  },
  {
    id: "FGY2WhTYpPnrIDTdsKH5",
    name: "Laura",
    description: "Calm & professional",
    gender: "female",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/67341759-ad08-41a5-be6e-de12fe448618.mp3",
  },
  {
    id: "XB0fDUnXU5powFXDhCwa",
    name: "Charlotte",
    description: "Friendly & warm",
    gender: "female",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/942356dc-f10d-4d89-bda5-4f8505ee038b.mp3",
  },
  {
    id: "pFZP5JQG7iQjIQuC4Bku",
    name: "Lily",
    description: "Soft & gentle",
    gender: "female",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/d10f7534-11f6-41fe-a012-2de1e482d336.mp3",
  },
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    description: "Warm & professional",
    gender: "male",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4571-8c6b-461e56c91c78.mp3",
  },
  {
    id: "nPczCjzI2devNBz1zQrb",
    name: "Brian",
    description: "Conversational",
    gender: "male",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/nPczCjzI2devNBz1zQrb/2b12ce5c-3573-419e-b6ba-6aee6a5bf1f1.mp3",
  },
  {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Daniel",
    description: "Friendly & clear",
    gender: "male",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/6b1d4898-c76d-4aa3-a56b-3f66adb0b2c1.mp3",
  },
  {
    id: "TX3LPaxmHKxFdv7VOQHJ",
    name: "Liam",
    description: "Young & energetic",
    gender: "male",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/edc1e75d-5dce-4da3-b7dc-4aad66d8d41f.mp3",
  },
  {
    id: "SAz9YHcvj6GT2YYXdXww",
    name: "River",
    description: "Neutral & smooth",
    gender: "neutral",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/28d623be-fa40-4c84-8e14-92a1e26cd1b4.mp3",
  },
];

interface VoiceSelectorProps {
  selectedVoiceId: string | null;
  onVoiceSelect: (voiceId: string) => void;
}

export const VoiceSelector = ({ selectedVoiceId, onVoiceSelect }: VoiceSelectorProps) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPreview = (voice: Voice) => {
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

    // Play new voice
    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    setPlayingVoiceId(voice.id);

    audio.play().catch(console.error);
    audio.onended = () => {
      setPlayingVoiceId(null);
      audioRef.current = null;
    };
  };

  const femaleVoices = ELEVENLABS_VOICES.filter(v => v.gender === "female");
  const maleVoices = ELEVENLABS_VOICES.filter(v => v.gender === "male");
  const neutralVoices = ELEVENLABS_VOICES.filter(v => v.gender === "neutral");

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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            handlePlayPreview(voice);
          }}
        >
          {isPlaying ? (
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">AI Voice</Label>
      </div>
      <p className="text-sm text-muted-foreground">
        Click the play button to preview each voice, then select your preferred voice for phone calls.
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
    </div>
  );
};
