-- Action Items / Team Assignments Migration
-- Creates action_items table linked to huddle_checklist_items

-- 1. Create action_items table
CREATE TABLE IF NOT EXISTS public.action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID REFERENCES public.huddle_checklist_items(id) ON DELETE SET NULL,
  huddle_id UUID REFERENCES public.huddles(id) ON DELETE SET NULL,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  assigned_owner_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action_required TEXT NOT NULL DEFAULT '',
  source_text TEXT DEFAULT '',
  due_date DATE,
  priority_level TEXT NOT NULL DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high')),
  task_status TEXT NOT NULL DEFAULT 'pending' CHECK (task_status IN ('pending', 'in_progress', 'completed')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_action_items_office_id ON public.action_items(office_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_owner ON public.action_items(assigned_owner_id);
CREATE INDEX IF NOT EXISTS idx_action_items_task_status ON public.action_items(task_status);
CREATE INDEX IF NOT EXISTS idx_action_items_due_date ON public.action_items(due_date);
CREATE INDEX IF NOT EXISTS idx_action_items_huddle_id ON public.action_items(huddle_id);

-- 2. Helper function for action_items access
CREATE OR REPLACE FUNCTION public.user_can_access_action_item(item_office_id UUID, item_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND (
      up.role::TEXT IN ('super_admin', 'admin')
      OR (up.role::TEXT = 'office_manager' AND up.office_id = item_office_id)
      OR (up.office_id = item_office_id AND up.id = item_owner_id)
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_action_item(item_office_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND (
      up.role::TEXT IN ('super_admin', 'admin')
      OR (up.role::TEXT = 'office_manager' AND up.office_id = item_office_id)
    )
  )
$$;

-- 3. Enable RLS
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "action_items_select" ON public.action_items;
CREATE POLICY "action_items_select"
ON public.action_items FOR SELECT TO authenticated
USING (public.user_can_access_action_item(office_id, assigned_owner_id));

DROP POLICY IF EXISTS "action_items_insert" ON public.action_items;
CREATE POLICY "action_items_insert"
ON public.action_items FOR INSERT TO authenticated
WITH CHECK (public.user_can_access_huddle_office(office_id));

DROP POLICY IF EXISTS "action_items_update" ON public.action_items;
CREATE POLICY "action_items_update"
ON public.action_items FOR UPDATE TO authenticated
USING (public.user_can_access_action_item(office_id, assigned_owner_id))
WITH CHECK (public.user_can_access_action_item(office_id, assigned_owner_id));

DROP POLICY IF EXISTS "action_items_delete" ON public.action_items;
CREATE POLICY "action_items_delete"
ON public.action_items FOR DELETE TO authenticated
USING (public.user_can_manage_action_item(office_id));
