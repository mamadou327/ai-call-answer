import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export const CallsTab = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.calls")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Phone className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">{t("dashboard.noCalls")}</p>
            <p className="text-sm">{t("dashboard.callsDescription")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Sample call log structure for reference */}
      <Card className="opacity-50">
        <CardHeader>
          <CardTitle className="text-sm">Example Call Log Structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4 p-4 border rounded-lg">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold">Customer Name</p>
                  <p className="text-sm text-muted-foreground">+1 234 567 8900</p>
                </div>
                <Badge>Booking</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                AI-generated summary: Customer called to book an appointment...
              </p>
              <Button variant="outline" size="sm">
                <PlayCircle className="w-4 h-4 mr-2" />
                Play Recording
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};