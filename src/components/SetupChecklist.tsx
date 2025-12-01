import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";

export interface ChecklistItem {
  label: string;
  isComplete: boolean;
}

interface SetupChecklistProps {
  items: ChecklistItem[];
}

export const SetupChecklist = ({ items }: SetupChecklistProps) => {
  const completedCount = items.filter(item => item.isComplete).length;
  const totalCount = items.length;
  const progress = (completedCount / totalCount) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup Checklist</CardTitle>
        <CardDescription>
          {completedCount}/{totalCount} steps completed
        </CardDescription>
        <div className="w-full bg-secondary rounded-full h-2 mt-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            {item.isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
            <span className={item.isComplete ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
