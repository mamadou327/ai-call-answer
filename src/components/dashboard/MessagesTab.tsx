import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

export const MessagesTab = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.messages")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">{t("dashboard.noMessages")}</p>
            <p className="text-sm">{t("dashboard.messagesDescription")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};