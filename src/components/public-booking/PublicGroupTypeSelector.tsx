import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Users } from "lucide-react";

interface PublicGroupTypeSelectorProps {
  serviceCount: number;
  onSelect: (mode: "single" | "multiple", personCount?: number) => void;
  onBack: () => void;
}

export const PublicGroupTypeSelector = ({
  serviceCount,
  onSelect,
  onBack,
}: PublicGroupTypeSelectorProps) => {
  const [personCount, setPersonCount] = useState(serviceCount);

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card className="border-2 border-primary shadow-sm max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Who's Booking?</CardTitle>
          <CardDescription>
            You've selected {serviceCount} service{serviceCount > 1 ? "s" : ""}. Is this for one person or multiple people?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full h-auto py-4 flex items-center gap-4 justify-start hover:border-primary"
            onClick={() => onSelect("single")}
          >
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Just Me</p>
              <p className="text-sm text-muted-foreground">
                All {serviceCount} services are for one person
              </p>
            </div>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="space-y-3 p-4 border-2 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Multiple People</p>
                <p className="text-sm text-muted-foreground">
                  Enter details for each person
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="personCount">How many people?</Label>
              <Input
                id="personCount"
                type="number"
                min={2}
                max={serviceCount}
                value={personCount}
                onChange={(e) => setPersonCount(Math.min(serviceCount, Math.max(2, parseInt(e.target.value) || 2)))}
                className="border-2"
              />
              <p className="text-xs text-muted-foreground">
                Maximum {serviceCount} (one per service)
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => onSelect("multiple", personCount)}
            >
              Continue with {personCount} People
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
