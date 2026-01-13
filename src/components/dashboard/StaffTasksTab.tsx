import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, PlayCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, isTomorrow } from "date-fns";

interface StaffTasksTabProps {
  businessId: string;
  staffId: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  due_date: string | null;
  category: string | null;
  assigned_to_staff_id: string | null;
  completed_at: string | null;
  created_at: string;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-slate-500" },
  { value: "medium", label: "Medium", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
];

export const StaffTasksTab = ({ businessId, staffId }: StaffTasksTabProps) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();

    // Set up realtime subscription
    const channel = supabase
      .channel('staff-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_tasks',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, staffId]);

  const loadTasks = async () => {
    let query = supabase
      .from("staff_tasks")
      .select("*")
      .eq("business_id", businessId)
      .in("status", ["pending", "in_progress"])
      .order("priority", { ascending: false })
      .order("due_date", { ascending: true });

    // Staff can see tasks assigned to them OR to all staff (null)
    if (staffId) {
      query = query.or(`assigned_to_staff_id.eq.${staffId},assigned_to_staff_id.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading tasks:", error);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    if (newStatus === "completed") {
      updateData.completed_at = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) updateData.completed_by_user_id = user.id;
    }

    const { error } = await supabase
      .from("staff_tasks")
      .update(updateData)
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    } else {
      toast({ title: `Task marked as ${newStatus}` });
      loadTasks();
    }
  };

  const getPriorityBadge = (priority: string) => {
    const option = PRIORITY_OPTIONS.find(p => p.value === priority);
    return (
      <Badge className={`${option?.color} text-white`}>
        {option?.label}
      </Badge>
    );
  };

  const getDueDateInfo = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    
    if (isPast(date) && !isToday(date)) {
      return { label: "Overdue", className: "text-destructive" };
    }
    if (isToday(date)) {
      return { label: "Due Today", className: "text-orange-500" };
    }
    if (isTomorrow(date)) {
      return { label: "Due Tomorrow", className: "text-blue-500" };
    }
    return { label: format(date, "MMM d"), className: "text-muted-foreground" };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Loading tasks...</p>
        </CardContent>
      </Card>
    );
  }

  const urgentTasks = tasks.filter(t => t.priority === "urgent" || (t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))));
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");

  return (
    <div className="space-y-6">
      {/* Urgent/Overdue Tasks Alert */}
      {urgentTasks.length > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Urgent Tasks ({urgentTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgentTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                <div>
                  <p className="font-medium">{task.title}</p>
                  {task.due_date && (
                    <p className="text-sm text-destructive">
                      {isPast(new Date(task.due_date)) ? "Overdue" : `Due: ${format(new Date(task.due_date), "MMM d")}`}
                    </p>
                  )}
                </div>
                <Button size="sm" onClick={() => handleStatusChange(task.id, "completed")}>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Complete
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            My Tasks
          </CardTitle>
          <CardDescription>
            {tasks.length === 0 
              ? "No active tasks assigned to you" 
              : `${pendingTasks.length} pending, ${inProgressTasks.length} in progress`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>You're all caught up!</p>
              <p className="text-sm">No tasks assigned to you at the moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const dueDateInfo = getDueDateInfo(task.due_date);
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-4 border rounded-lg"
                  >
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h4 className="font-medium">{task.title}</h4>
                        {getPriorityBadge(task.priority)}
                        <Badge variant={task.status === "in_progress" ? "default" : "secondary"}>
                          {task.status === "in_progress" ? "In Progress" : "Pending"}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        {task.category && (
                          <span className="text-muted-foreground capitalize">{task.category}</span>
                        )}
                        {dueDateInfo && (
                          <span className={dueDateInfo.className}>{dueDateInfo.label}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(task.id, "in_progress")}
                        >
                          <PlayCircle className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(task.id, "completed")}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Complete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
