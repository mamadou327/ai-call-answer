import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, User, Calendar, Clock, ChevronRight, ChevronLeft, Play, Pause, FileText, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface CallLog {
  id: string;
  caller_name: string | null;
  caller_phone: string;
  call_type: string;
  call_outcome: string | null;
  summary: string | null;
  duration_ms: number | null;
  needs_review: boolean | null;
  tags: string[] | null;
  booking_id: string | null;
  created_at: string;
  provider: string | null;
  recording_url: string | null;
  transcription: string | null;
}

interface CallDetailsDialogProps {
  call: CallLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const callTypeLabels: Record<string, string> = {
  new_booking: "Booking Created",
  reschedule: "Reschedule",
  cancel: "Cancellation",
  question: "General Enquiry",
  complaint: "Complaint",
  other: "Other",
};

const callTypeBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new_booking: "default",
  reschedule: "secondary",
  cancel: "destructive",
  question: "outline",
  complaint: "destructive",
  other: "outline",
};

export const CallDetailsDialog = ({ call, open, onOpenChange }: CallDetailsDialogProps) => {
  const { t } = useTranslation();
  const [slide, setSlide] = useState<1 | 2>(1);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // Reset slide when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSlide(1);
      setAudioUrl(null);
      setIsPlaying(false);
    }
  }, [open]);

  // Load audio URL when moving to slide 2
  useEffect(() => {
    if (slide === 2 && call?.recording_url && !audioUrl) {
      loadAudioUrl();
    }
  }, [slide, call?.recording_url]);

  const loadAudioUrl = async () => {
    if (!call?.recording_url) return;
    
    setLoadingAudio(true);
    try {
      const { data, error } = await supabase.storage
        .from("call-recordings")
        .createSignedUrl(call.recording_url, 3600); // 1 hour expiry

      if (error) {
        console.error("Error getting signed URL:", error);
      } else if (data?.signedUrl) {
        setAudioUrl(data.signedUrl);
      }
    } catch (e) {
      console.error("Error loading audio:", e);
    }
    setLoadingAudio(false);
  };

  const togglePlayback = () => {
    if (!audioUrl) return;

    if (audioElement) {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        audioElement.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setAudioElement(audio);
      setIsPlaying(true);
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (!call) return null;

  const displayName = call.caller_name || call.caller_phone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            {slide === 1 ? "Call Details" : "Recording & Transcript"}
          </DialogTitle>
        </DialogHeader>

        {slide === 1 ? (
          // Slide 1: Caller Details
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{displayName}</h3>
                {call.caller_name && (
                  <p className="text-sm text-muted-foreground">{call.caller_phone}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Call Type</p>
                <Badge variant={callTypeBadgeVariants[call.call_type] || "outline"}>
                  {callTypeLabels[call.call_type] || call.call_type}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Duration</p>
                <p className="font-medium">{formatDuration(call.duration_ms)}</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Date & Time</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <p className="font-medium">
                  {format(new Date(call.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>

            {call.summary && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Summary</p>
                <p className="text-sm">{call.summary}</p>
              </div>
            )}

            {call.tags && call.tags.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Tags</p>
                <div className="flex gap-1 flex-wrap">
                  {call.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {call.needs_review && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive font-medium">This call needs review</span>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button 
                onClick={() => setSlide(2)}
                disabled={!call.recording_url && !call.transcription}
                className="gap-2"
              >
                {call.recording_url || call.transcription ? (
                  <>
                    View Recording & Transcript
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  "No Recording Available"
                )}
              </Button>
            </div>
          </div>
        ) : (
          // Slide 2: Audio & Transcription
          <div className="space-y-4">
            {/* Audio Player */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Play className="w-3 h-3" />
                Call Recording
              </p>
              {loadingAudio ? (
                <div className="flex items-center justify-center h-16 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading audio...</p>
                </div>
              ) : audioUrl ? (
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={togglePlayback}
                    className="shrink-0"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <div className="flex-1">
                    <audio
                      src={audioUrl}
                      controls
                      className="w-full h-8"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-16 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">No recording available</p>
                </div>
              )}
            </div>

            {/* Transcription */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Transcription
              </p>
              {call.transcription ? (
                <div className="p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{call.transcription}</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-16 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {call.recording_url ? "Transcription processing..." : "No transcription available"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-start pt-4">
              <Button variant="outline" onClick={() => setSlide(1)} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back to Details
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
