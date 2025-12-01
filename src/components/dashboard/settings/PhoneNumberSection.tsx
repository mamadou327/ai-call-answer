import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Phone, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PhoneNumberSectionProps {
  business: any;
}

export const PhoneNumberSection = ({ business }: PhoneNumberSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Phone Number Configuration</CardTitle>
        <CardDescription>Your Aivia phone number and porting details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {business?.assigned_aivia_number && (
          <Alert className="border-primary/50 bg-primary/5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="space-y-2">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Your Aivia Number: {business.assigned_aivia_number}
                  </p>
                  {business.number_notes && (
                    <p className="text-sm text-muted-foreground mt-1">{business.number_notes}</p>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {business?.porting_status && (
          <Alert className="border-primary/50 bg-primary/5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="space-y-2">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    Porting Status:{" "}
                    <Badge variant="outline" className="capitalize">
                      {business.porting_status.replace("_", " ")}
                    </Badge>
                  </p>
                  {business.porting_instructions && (
                    <div className="mt-2 p-3 bg-background rounded-md">
                      <p className="text-sm font-medium mb-1">Instructions:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {business.porting_instructions}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!business?.assigned_aivia_number && !business?.porting_status && (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No phone number assigned yet</p>
            <p className="text-sm">Your phone number will be assigned once your account is approved</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};