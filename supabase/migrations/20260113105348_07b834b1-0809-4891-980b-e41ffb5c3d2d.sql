-- Create enum for task priority
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create enum for task status
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Create staff_tasks table
CREATE TABLE public.staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assigned_to_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  assigned_by_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  category TEXT DEFAULT 'other',
  completed_at TIMESTAMPTZ,
  completed_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

-- Business owners can manage all tasks for their business
CREATE POLICY "Business owners can manage tasks"
ON public.staff_tasks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = staff_tasks.business_id
    AND b.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = staff_tasks.business_id
    AND b.owner_id = auth.uid()
  )
);

-- Staff members can view tasks assigned to them or to all staff (NULL assigned_to_staff_id)
CREATE POLICY "Staff can view their tasks"
ON public.staff_tasks
FOR SELECT
USING (
  public.is_staff_member_of_business(auth.uid(), business_id)
  AND (
    assigned_to_staff_id IS NULL
    OR assigned_to_staff_id IN (
      SELECT sm.linked_staff_id FROM public.staff_memberships sm
      WHERE sm.user_id = auth.uid() AND sm.business_id = staff_tasks.business_id AND sm.status = 'active'
    )
  )
);

-- Staff members can update status of their assigned tasks
CREATE POLICY "Staff can update their task status"
ON public.staff_tasks
FOR UPDATE
USING (
  public.is_staff_member_of_business(auth.uid(), business_id)
  AND (
    assigned_to_staff_id IS NULL
    OR assigned_to_staff_id IN (
      SELECT sm.linked_staff_id FROM public.staff_memberships sm
      WHERE sm.user_id = auth.uid() AND sm.business_id = staff_tasks.business_id AND sm.status = 'active'
    )
  )
)
WITH CHECK (
  public.is_staff_member_of_business(auth.uid(), business_id)
  AND (
    assigned_to_staff_id IS NULL
    OR assigned_to_staff_id IN (
      SELECT sm.linked_staff_id FROM public.staff_memberships sm
      WHERE sm.user_id = auth.uid() AND sm.business_id = staff_tasks.business_id AND sm.status = 'active'
    )
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_staff_tasks_updated_at
BEFORE UPDATE ON public.staff_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_staff_tasks_business_id ON public.staff_tasks(business_id);
CREATE INDEX idx_staff_tasks_assigned_to ON public.staff_tasks(assigned_to_staff_id);
CREATE INDEX idx_staff_tasks_status ON public.staff_tasks(status);
CREATE INDEX idx_staff_tasks_due_date ON public.staff_tasks(due_date);