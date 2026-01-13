import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, CheckCircle2, Clock, AlertTriangle, User, Repeat } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isPast, isToday, isTomorrow, addDays } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface StaffTasksManagementProps {
  businessId: string;
  onUpdate: () => void;
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
  staff?: { id: string; name: string } | null;
  is_recurring?: boolean;
  recurrence_pattern?: string | null;
  recurrence_days?: string[] | null;
  recurrence_end_date?: string | null;
  parent_task_id?: string | null;
}

const WEEKDAYS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const MONTH_DAYS = [1, 5, 10, 15, 20, 25, 28];

interface Staff {
  id: string;
  name: string;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-slate-500" },
  { value: "medium", label: "Medium", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
];

const CATEGORY_OPTIONS = [
  { value: "cleaning", label: "Cleaning" },
  { value: "inventory", label: "Inventory" },
  { value: "admin", label: "Admin" },
  { value: "customer", label: "Customer" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const StaffTasksManagement = ({ businessId, onUpdate }: StaffTasksManagementProps) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    category: "other",
    assigned_to_staff_id: "",
    due_date: "",
    is_recurring: false,
    recurrence_pattern: "daily" as "daily" | "weekly" | "monthly",
    recurrence_days: [] as string[],
    recurrence_end_date: "",
  });

  useEffect(() => {
    loadTasks();
    loadStaff();
  }, [businessId, statusFilter]);

  const loadTasks = async () => {
    let query = supabase
      .from("staff_tasks")
      .select(`
        *,
        staff:assigned_to_staff_id(id, name)
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (statusFilter === "active") {
      query = query.in("status", ["pending", "in_progress"] as const);
    } else if (statusFilter !== "all") {
      query = query.eq("status", statusFilter as "pending" | "in_progress" | "completed" | "cancelled");
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading tasks:", error);
    } else {
      setTasks(data || []);
    }
  };

  const loadStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", businessId);
    
    if (data) setStaff(data);
  };

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      category: task.category || "other",
      assigned_to_staff_id: task.assigned_to_staff_id || "",
      due_date: task.due_date ? task.due_date.split("T")[0] : "",
      is_recurring: task.is_recurring || false,
      recurrence_pattern: (task.recurrence_pattern as "daily" | "weekly" | "monthly") || "daily",
      recurrence_days: task.recurrence_days || [],
      recurrence_end_date: task.recurrence_end_date ? task.recurrence_end_date.split("T")[0] : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Calculate first occurrence for recurring tasks
      const calculateFirstOccurrence = () => {
        if (!formData.is_recurring) return null;
        
        const now = new Date();
        if (formData.recurrence_pattern === 'daily') {
          return addDays(now, 1).toISOString();
        } else if (formData.recurrence_pattern === 'weekly' && formData.recurrence_days.length > 0) {
          const dayMap: { [key: string]: number } = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
          };
          const currentDay = now.getDay();
          const sortedDays = formData.recurrence_days
            .map(d => dayMap[d.toLowerCase()])
            .filter(d => d !== undefined)
            .sort((a, b) => a - b);
          
          let nextDay = sortedDays.find(d => d > currentDay);
          const daysToAdd = nextDay !== undefined 
            ? nextDay - currentDay 
            : 7 - currentDay + sortedDays[0];
          return addDays(now, daysToAdd).toISOString();
        } else if (formData.recurrence_pattern === 'monthly' && formData.recurrence_days.length > 0) {
          const currentDayOfMonth = now.getDate();
          const sortedDates = formData.recurrence_days
            .map(d => parseInt(d))
            .filter(d => !isNaN(d))
            .sort((a, b) => a - b);
          
          let nextDate = sortedDates.find(d => d > currentDayOfMonth);
          if (nextDate !== undefined) {
            const nextOccurrence = new Date(now);
            nextOccurrence.setDate(nextDate);
            return nextOccurrence.toISOString();
          } else {
            const nextOccurrence = new Date(now);
            nextOccurrence.setMonth(nextOccurrence.getMonth() + 1);
            nextOccurrence.setDate(sortedDates[0]);
            return nextOccurrence.toISOString();
          }
        }
        return addDays(now, 1).toISOString();
      };

      const taskData: Record<string, any> = {
        business_id: businessId,
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        category: formData.category,
        assigned_to_staff_id: formData.assigned_to_staff_id || null,
        due_date: formData.is_recurring ? null : (formData.due_date ? new Date(formData.due_date).toISOString() : null),
        assigned_by_user_id: user.id,
        is_recurring: formData.is_recurring,
        recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern : null,
        recurrence_days: formData.is_recurring && formData.recurrence_days.length > 0 ? formData.recurrence_days : null,
        recurrence_end_date: formData.is_recurring && formData.recurrence_end_date 
          ? new Date(formData.recurrence_end_date).toISOString() 
          : null,
        next_occurrence: formData.is_recurring ? calculateFirstOccurrence() : null,
      };

      if (selectedTask) {
        const { error } = await supabase
          .from("staff_tasks")
          .update(taskData as any)
          .eq("id", selectedTask.id);

        if (error) throw error;
        toast({ title: "Task updated successfully" });
      } else {
        const { error } = await supabase
          .from("staff_tasks")
          .insert([taskData as any]);

        if (error) throw error;
        toast({ title: formData.is_recurring ? "Recurring task created successfully" : "Task created successfully" });

        // Send email notification if task is assigned to a specific staff member
        if (formData.assigned_to_staff_id) {
          try {
            await supabase.functions.invoke('send-task-notification', {
              body: {
                taskTitle: formData.title,
                taskDescription: formData.description || null,
                taskPriority: formData.priority,
                taskDueDate: formData.due_date ? new Date(formData.due_date).toISOString() : null,
                staffId: formData.assigned_to_staff_id,
                businessId: businessId,
              }
            });
            console.log("Task notification sent");
          } catch (notifError) {
            console.error("Failed to send task notification:", notifError);
            // Don't fail the task creation if notification fails
          }
        }
      }

      setDialogOpen(false);
      setSelectedTask(null);
      resetForm();
      loadTasks();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save task",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    const { error } = await supabase
      .from("staff_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    } else {
      toast({ title: "Task deleted" });
      loadTasks();
      onUpdate();
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    if (newStatus === "completed") {
      updateData.completed_at = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) updateData.completed_by_user_id = user.id;
    } else {
      updateData.completed_at = null;
      updateData.completed_by_user_id = null;
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
      onUpdate();
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      category: "other",
      assigned_to_staff_id: "",
      due_date: "",
      is_recurring: false,
      recurrence_pattern: "daily",
      recurrence_days: [],
      recurrence_end_date: "",
    });
  };

  const getPriorityBadge = (priority: string) => {
    const option = PRIORITY_OPTIONS.find(p => p.value === priority);
    return (
      <Badge className={`${option?.color} text-white`}>
        {option?.label}
      </Badge>
    );
  };

  const getDueDateBadge = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    
    if (isPast(date) && !isToday(date)) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (isToday(date)) {
      return <Badge variant="outline" className="border-orange-500 text-orange-500">Due Today</Badge>;
    }
    if (isTomorrow(date)) {
      return <Badge variant="outline" className="border-blue-500 text-blue-500">Due Tomorrow</Badge>;
    }
    return <Badge variant="outline">{format(date, "MMM d")}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500 text-white">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Staff Tasks</CardTitle>
          <CardDescription>Assign and track tasks for your team</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedTask(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{selectedTask ? "Edit Task" : "Create Task"}</DialogTitle>
                <DialogDescription>
                  {selectedTask ? "Update task details" : "Assign a new task to your staff"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Clean station 3"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Add details about the task..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: "low" | "medium" | "high" | "urgent") => 
                        setFormData({ ...formData, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assign To</Label>
                  <Select
                    value={formData.assigned_to_staff_id || "all"}
                    onValueChange={(value) => setFormData({ ...formData, assigned_to_staff_id: value === "all" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!formData.is_recurring && (
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                )}

                {/* Recurring Task Settings */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="is_recurring" className="flex items-center gap-2">
                        <Repeat className="w-4 h-4" />
                        Recurring Task
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically repeat this task
                      </p>
                    </div>
                    <Switch
                      id="is_recurring"
                      checked={formData.is_recurring}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                    />
                  </div>

                  {formData.is_recurring && (
                    <div className="space-y-4 pl-2 border-l-2 border-muted ml-2">
                      <div className="space-y-2">
                        <Label>Repeat Pattern</Label>
                        <Select
                          value={formData.recurrence_pattern}
                          onValueChange={(value: "daily" | "weekly" | "monthly") => 
                            setFormData({ ...formData, recurrence_pattern: value, recurrence_days: [] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.recurrence_pattern === "weekly" && (
                        <div className="space-y-2">
                          <Label>On these days</Label>
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAYS.map((day) => (
                              <div key={day.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={day.value}
                                  checked={formData.recurrence_days.includes(day.value)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData({
                                        ...formData,
                                        recurrence_days: [...formData.recurrence_days, day.value]
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        recurrence_days: formData.recurrence_days.filter(d => d !== day.value)
                                      });
                                    }
                                  }}
                                />
                                <Label htmlFor={day.value} className="text-sm font-normal">
                                  {day.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {formData.recurrence_pattern === "monthly" && (
                        <div className="space-y-2">
                          <Label>On these dates</Label>
                          <div className="flex flex-wrap gap-2">
                            {MONTH_DAYS.map((day) => (
                              <div key={day} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`day-${day}`}
                                  checked={formData.recurrence_days.includes(day.toString())}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData({
                                        ...formData,
                                        recurrence_days: [...formData.recurrence_days, day.toString()]
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        recurrence_days: formData.recurrence_days.filter(d => d !== day.toString())
                                      });
                                    }
                                  }}
                                />
                                <Label htmlFor={`day-${day}`} className="text-sm font-normal">
                                  {day}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="recurrence_end_date">End Date (Optional)</Label>
                        <Input
                          id="recurrence_end_date"
                          type="date"
                          value={formData.recurrence_end_date}
                          onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty for indefinite recurring
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving..." : selectedTask ? "Update Task" : "Create Task"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No tasks found</p>
            <p className="text-sm">Create a task to assign work to your staff</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-start gap-3 p-4 border rounded-lg ${
                  task.status === "completed" ? "bg-muted/30" : ""
                }`}
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h4 className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </h4>
                    {task.is_recurring && (
                      <Badge variant="outline" className="border-purple-500 text-purple-500">
                        <Repeat className="w-3 h-3 mr-1" />
                        {task.recurrence_pattern}
                      </Badge>
                    )}
                    {task.parent_task_id && (
                      <Badge variant="outline" className="border-purple-300 text-purple-400 text-xs">
                        From recurring
                      </Badge>
                    )}
                    {getPriorityBadge(task.priority)}
                    {getStatusBadge(task.status)}
                    {getDueDateBadge(task.due_date)}
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {task.staff?.name || "All Staff"}
                    </span>
                    {task.category && (
                      <span className="capitalize">{task.category}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {task.status !== "completed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleStatusChange(task.id, "completed")}
                      title="Mark as completed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(task)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Task</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{task.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(task.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
