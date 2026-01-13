-- Add recurrence columns to staff_tasks table
ALTER TABLE public.staff_tasks
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN recurrence_pattern text CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly')),
ADD COLUMN recurrence_days text[],
ADD COLUMN recurrence_end_date timestamp with time zone,
ADD COLUMN parent_task_id uuid REFERENCES public.staff_tasks(id) ON DELETE SET NULL,
ADD COLUMN next_occurrence timestamp with time zone;

-- Create index for efficient recurring task queries
CREATE INDEX idx_staff_tasks_recurring ON public.staff_tasks(is_recurring, next_occurrence) WHERE is_recurring = true;

-- Create index for parent task lookups
CREATE INDEX idx_staff_tasks_parent ON public.staff_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;