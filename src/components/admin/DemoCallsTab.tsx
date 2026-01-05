import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Lightbulb, RefreshCw, Check, Loader2, AlertCircle } from "lucide-react";
import { DemoCallPlayer, DemoIcons } from "./DemoCallPlayer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Scenario = "booking" | "reschedule" | "cancel";

interface DemoLine {
  index: number;
  speaker: string;
  text: string;
  audioUrl: string;
}

interface DemoManifest {
  scenario: string;
  version: number;
  linesCount: number;
  pauseBetweenLinesMs: number;
  lines: DemoLine[];
}

interface AudioStatus {
  exists: boolean;
  generating: boolean;
  error: string | null;
}

const SCENARIOS: { id: Scenario; title: string; description: string }[] = [
  { id: "booking", title: "NEW BOOKING DEMO", description: "Customer books a new haircut appointment" },
  { id: "reschedule", title: "RESCHEDULING DEMO", description: "Customer changes their existing appointment" },
  { id: "cancel", title: "CANCELLATION DEMO", description: "Customer cancels their appointment" },
];

export const DemoCallsTab = () => {
  const [audioStatus, setAudioStatus] = useState<Record<Scenario, AudioStatus>>({
    booking: { exists: false, generating: false, error: null },
    reschedule: { exists: false, generating: false, error: null },
    cancel: { exists: false, generating: false, error: null },
  });
  const [manifests, setManifests] = useState<Record<Scenario, DemoManifest | null>>({
    booking: null,
    reschedule: null,
    cancel: null,
  });

  // Check which audio files exist on mount
  useEffect(() => {
    checkAudioStatus();
  }, []);

  const checkAudioStatus = async () => {
    const scenarios: Scenario[] = ["booking", "reschedule", "cancel"];
    
    for (const scenario of scenarios) {
      try {
        // Check if manifest exists
        const { data: manifestUrl } = supabase.storage
          .from("demo-audio")
          .getPublicUrl(`demo-${scenario}-manifest.json`);
        
        const response = await fetch(manifestUrl.publicUrl);
        
        if (response.ok) {
          const manifest = await response.json() as DemoManifest;
          
          // Verify at least the first audio file exists
          if (manifest.lines && manifest.lines.length > 0) {
            const testResponse = await fetch(manifest.lines[0].audioUrl, { method: "HEAD" });
            
            if (testResponse.ok) {
              setAudioStatus(prev => ({
                ...prev,
                [scenario]: { exists: true, generating: false, error: null }
              }));
              setManifests(prev => ({
                ...prev,
                [scenario]: manifest,
              }));
              continue;
            }
          }
        }
        
        // Not found or invalid
        setAudioStatus(prev => ({
          ...prev,
          [scenario]: { exists: false, generating: false, error: null }
        }));
      } catch (error) {
        console.error(`Error checking ${scenario}:`, error);
        setAudioStatus(prev => ({
          ...prev,
          [scenario]: { exists: false, generating: false, error: null }
        }));
      }
    }
  };

  const generateAudio = async (scenario: Scenario) => {
    setAudioStatus(prev => ({
      ...prev,
      [scenario]: { ...prev[scenario], generating: true, error: null }
    }));

    try {
      const { data, error } = await supabase.functions.invoke("generate-demo-audio", {
        body: { scenario }
      });

      if (error) throw error;

      toast.success(`${scenario} demo generated! (${data.linesCount} audio files)`);
      
      // Fetch the new manifest
      const { data: manifestUrl } = supabase.storage
        .from("demo-audio")
        .getPublicUrl(`demo-${scenario}-manifest.json`);
      
      // Add cache-busting timestamp
      const response = await fetch(`${manifestUrl.publicUrl}?t=${Date.now()}`);
      if (response.ok) {
        const manifest = await response.json() as DemoManifest;
        setManifests(prev => ({
          ...prev,
          [scenario]: manifest,
        }));
      }
      
      setAudioStatus(prev => ({
        ...prev,
        [scenario]: { exists: true, generating: false, error: null }
      }));

    } catch (error) {
      console.error(`Error generating ${scenario}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Generation failed";
      
      setAudioStatus(prev => ({
        ...prev,
        [scenario]: { exists: false, generating: false, error: errorMessage }
      }));
      
      toast.error(`Failed to generate ${scenario} demo: ${errorMessage}`);
    }
  };

  const generateAllAudios = async () => {
    for (const scenario of SCENARIOS) {
      if (!audioStatus[scenario.id].exists) {
        await generateAudio(scenario.id);
      }
    }
  };

  const allGenerated = SCENARIOS.every(s => audioStatus[s.id].exists);
  const anyGenerating = SCENARIOS.some(s => audioStatus[s.id].generating);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-foreground text-background">
              <Phone className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">DEMO CALLS</CardTitle>
              <CardDescription>
                Play realistic AI-generated call demos to show clients how AIVIA handles bookings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Audio Generation Section */}
      <Card className="border-2 border-foreground">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">Demo Audio Files</CardTitle>
          <CardDescription>
            Generate once, play instantly forever. Each line is a separate high-quality audio file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status list */}
          <div className="space-y-2">
            {SCENARIOS.map(scenario => {
              const status = audioStatus[scenario.id];
              const manifest = manifests[scenario.id];
              
              return (
                <div 
                  key={scenario.id}
                  className="flex items-center justify-between p-3 border-2 border-foreground/20 rounded"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-foreground/10">
                      {DemoIcons[scenario.id]}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{scenario.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {manifest 
                          ? `${manifest.linesCount} audio files ready`
                          : scenario.description
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {status.generating ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating...</span>
                      </div>
                    ) : status.error ? (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>Error</span>
                      </div>
                    ) : status.exists ? (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        <span>Ready</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not generated</span>
                    )}
                    
                    <Button
                      size="sm"
                      variant={status.exists ? "outline" : "default"}
                      onClick={() => generateAudio(scenario.id)}
                      disabled={status.generating || anyGenerating}
                      className={status.exists ? "border-foreground" : "bg-foreground text-background"}
                    >
                      {status.exists ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Regenerate
                        </>
                      ) : (
                        "Generate"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Generate All button */}
          {!allGenerated && (
            <Button
              onClick={generateAllAudios}
              disabled={anyGenerating}
              className="w-full bg-foreground text-background hover:bg-foreground/90"
            >
              {anyGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate All Missing Demos"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-2 border-foreground bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 mt-0.5 text-foreground" />
            <div className="text-sm">
              <p className="font-bold mb-1">Sales Meeting Tip</p>
              <p className="text-muted-foreground">
                Play the booking demo first to showcase AIVIA's capabilities. 
                Then use rescheduling and cancellation demos to show how AIVIA handles 
                the full customer journey. Audio plays instantly - no waiting!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Players */}
      <div className="grid gap-6">
        {SCENARIOS.map(scenario => (
          <DemoCallPlayer
            key={scenario.id}
            scenario={scenario.id}
            title={scenario.title}
            description={scenario.description}
            icon={DemoIcons[scenario.id]}
            manifest={manifests[scenario.id]}
          />
        ))}
      </div>
    </div>
  );
};
