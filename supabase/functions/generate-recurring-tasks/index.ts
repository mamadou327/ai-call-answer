import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  category: string | null;
  assigned_to_staff_id: string | null;
  business_id: string;
  recurrence_pattern: string;
  recurrence_days: string[] | null;
  recurrence_end_date: string | null;
  next_occurrence: string;
}

function getNextOccurrence(
  pattern: string,
  days: string[] | null,
  currentDate: Date
): Date {
  const next = new Date(currentDate);
  
  switch (pattern) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
      
    case 'weekly':
      if (days && days.length > 0) {
        const dayMap: { [key: string]: number } = {
          'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
          'thursday': 4, 'friday': 5, 'saturday': 6
        };
        
        const currentDay = next.getDay();
        const sortedDays = days
          .map(d => dayMap[d.toLowerCase()])
          .filter(d => d !== undefined)
          .sort((a, b) => a - b);
        
        // Find the next occurrence day
        let nextDay = sortedDays.find(d => d > currentDay);
        if (nextDay === undefined) {
          // Wrap to next week
          nextDay = sortedDays[0];
          next.setDate(next.getDate() + (7 - currentDay + nextDay));
        } else {
          next.setDate(next.getDate() + (nextDay - currentDay));
        }
      } else {
        // Default to same day next week
        next.setDate(next.getDate() + 7);
      }
      break;
      
    case 'monthly':
      if (days && days.length > 0) {
        const currentDayOfMonth = next.getDate();
        const sortedDates = days
          .map(d => parseInt(d))
          .filter(d => !isNaN(d) && d >= 1 && d <= 31)
          .sort((a, b) => a - b);
        
        // Find the next occurrence date this month
        let nextDate = sortedDates.find(d => d > currentDayOfMonth);
        if (nextDate === undefined) {
          // Move to next month
          next.setMonth(next.getMonth() + 1);
          nextDate = sortedDates[0];
        }
        next.setDate(nextDate);
      } else {
        // Default to same day next month
        next.setMonth(next.getMonth() + 1);
      }
      break;
  }
  
  return next;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Cron-invoked function: invoked internally by pg_cron via pg_net; no header check needed.
  const _cronSecret = Deno.env.get("CRON_SECRET");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    // Fetch all recurring tasks where next_occurrence is due
    const { data: recurringTasks, error: fetchError } = await supabase
      .from("staff_tasks")
      .select("*")
      .eq("is_recurring", true)
      .lte("next_occurrence", now.toISOString())
      .or("recurrence_end_date.is.null,recurrence_end_date.gte." + now.toISOString());

    if (fetchError) {
      console.error("Error fetching recurring tasks:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${recurringTasks?.length || 0} recurring tasks to process`);

    const createdTasks: string[] = [];
    const notifications: Promise<Response>[] = [];

    for (const task of (recurringTasks as RecurringTask[]) || []) {
      // Create a new task instance
      const { data: newTask, error: createError } = await supabase
        .from("staff_tasks")
        .insert({
          title: task.title,
          description: task.description,
          priority: task.priority,
          category: task.category,
          assigned_to_staff_id: task.assigned_to_staff_id,
          business_id: task.business_id,
          status: "pending",
          parent_task_id: task.id,
          is_recurring: false,
          due_date: now.toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error(`Error creating task instance for ${task.id}:`, createError);
        continue;
      }

      createdTasks.push(newTask.id);
      console.log(`Created task instance ${newTask.id} from recurring task ${task.id}`);

      // Calculate and update next occurrence
      const nextOccurrence = getNextOccurrence(
        task.recurrence_pattern,
        task.recurrence_days,
        now
      );

      // Check if next occurrence is past end date
      const shouldContinue = !task.recurrence_end_date || 
        nextOccurrence <= new Date(task.recurrence_end_date);

      if (shouldContinue) {
        await supabase
          .from("staff_tasks")
          .update({ next_occurrence: nextOccurrence.toISOString() })
          .eq("id", task.id);
      } else {
        // Mark as no longer recurring if past end date
        await supabase
          .from("staff_tasks")
          .update({ is_recurring: false, next_occurrence: null })
          .eq("id", task.id);
      }

      // Send notification if assigned to a specific staff member
      if (task.assigned_to_staff_id) {
        const notificationPromise = fetch(
          `${supabaseUrl}/functions/v1/send-task-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              taskTitle: task.title,
              taskDescription: task.description,
              taskPriority: task.priority,
              taskDueDate: now.toISOString(),
              staffId: task.assigned_to_staff_id,
              businessId: task.business_id,
            }),
          }
        );
        notifications.push(notificationPromise);
      }
    }

    // Wait for all notifications to be sent
    await Promise.allSettled(notifications);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${createdTasks.length} task instances`,
        taskIds: createdTasks,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-recurring-tasks:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
