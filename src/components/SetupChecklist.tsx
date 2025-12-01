import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";

export interface ChecklistItem {
  label: string;
  isComplete: boolean;
  action?: string; // Settings section to navigate to
}

interface SetupChecklistProps {
  items: ChecklistItem[];
  onItemClick: (action: string) => void;
}

export const SetupChecklist = ({ items, onItemClick }: SetupChecklistProps) => {
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
      <CardContent className="space-y-2">
        {items.map((item, index) => (
          <Button
            key={index}
            variant="ghost"
            className="w-full justify-start h-auto py-3 px-3"
            onClick={() => item.action && onItemClick(item.action)}
          >
            <div className="flex items-center gap-3 flex-1">
              {item.isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={`flex-1 text-left ${item.isComplete ? "text-foreground" : "text-muted-foreground"}`}>
                {item.label}
              </span>
              {!item.isComplete && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};